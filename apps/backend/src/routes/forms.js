const express = require("express");
const dayjs = require("dayjs");
const XLSX = require("xlsx");
const crypto = require("crypto");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const { randomUUID: uuid } = crypto;
const { collection, scopedCollection } = require("../db/store");
const { tenantAccountsFor: tenantAccountsForId } = require("../utils/tenantAccounts");
const { requireManager, requireFullAccess } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const { encryptAnswers, decryptResponse } = require("../utils/formCrypto");
const { listTemplates, getTemplate } = require("../data/formTemplates");
const {
  buildSnapshot,
  autoAdvance,
  currentApprovers,
  applyDecision,
  applyEscalations,
} = require("../utils/workflowEngine");
const {
  isConfigured: aiConfigured,
  generateFormFields,
  generateInsights,
} = require("../integrations/aiClient");
const { getLimitsForAccount, getAiProviderForAccount } = require("./settings");
const {
  hasEnoughCredits,
  deductCredits,
  CREDIT_COSTS,
} = require("../utils/aiCredits");
const {
  availableDates,
  allSlotsForDate,
  slotsForDate,
  extractBookedTimes,
} = require("../utils/bookingSlots");
const { validateFileAnswer, validateImageAnswer, storeFileAnswer, resolveFileAnswer } = require("../utils/fileUploads");
const { validateSubmission } = require("../utils/formValidation");
const turnstile = require("../integrations/turnstileClient");
const r2Client = require("../integrations/r2Client");
const emailClient = require("../integrations/emailClient");
const { emailLayout } = require("../utils/emailTemplate");
const {
  recordEvent,
  EVENT_TYPES,
  EVENT_SOURCES,
  SEVERITY,
} = require("../services/eventEngine");
const { evaluateRules } = require("../services/ruleEngine");
const { skipRateLimit } = require("../utils/rateLimitSkip");

// There's no scheduled job running the Rule Engine on a timer (see
// ruleEngine.js's doc comment) — recommendations are only ever (re)computed
// when something calls this, so every place an approval-related event is
// recorded also triggers it, for this account only. Best-effort: a failure
// here must never turn an otherwise-successful submission/decision into a
// 500 for the user, so it's caught and logged, never awaited by the caller
// for its result.
async function evaluateRulesQuietly(accountId) {
  try {
    await evaluateRules(accountId);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`evaluateRules failed for account ${accountId}:`, err);
  }
}

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const CLAIM_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
// No ambiguous chars (0/O, 1/I) — this is read aloud/typed by support agents.
const REFERENCE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateReferenceId() {
  let code = "";
  for (let i = 0; i < 6; i++)
    code += REFERENCE_CHARS[crypto.randomInt(REFERENCE_CHARS.length)];
  return `FR-${code}`;
}

function hashClaimToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Resolves every R2-backed file answer in a decrypted answers object to a
// fresh presigned URL before it goes out over the API — a legacy inline-
// base64 answer (no r2Key) passes through resolveFileAnswer unchanged, so
// this is safe to call on every response regardless of when it was
// submitted (before or after R2 was configured).
async function resolveAnswersFileFields(answers) {
  const entries = await Promise.all(
    Object.entries(answers || {}).map(async ([key, value]) => [
      key,
      // "images" answers are arrays of file-answer objects — resolveFileAnswer
      // only ever looks at a single object's r2Key, so an array needs
      // resolving item-by-item instead of being handed to it directly
      // (which would just silently no-op and leave every r2Key unresolved).
      Array.isArray(value) ? await Promise.all(value.map(resolveFileAnswer)) : await resolveFileAnswer(value),
    ])
  );
  return Object.fromEntries(entries);
}

// Same idea as resolveAnswersFileFields, but for a form's branding logo —
// `logoR2Key` (set when R2 is configured) resolves to a fresh presigned
// `logoDataUrl` so every existing render site (`<img src={branding.logoDataUrl}>`
// in Forms.jsx / forms/[id].jsx / TemplateCustomizeEditor.jsx) keeps working
// unchanged. A form with no logo, or a legacy inline logoDataUrl, passes
// through untouched.
async function resolveBrandingLogo(settings) {
  const key = settings?.branding?.logoR2Key;
  if (!key) return settings;
  const logoDataUrl = await r2Client.getSignedReadUrl(key);
  return { ...settings, branding: { ...settings.branding, logoDataUrl } };
}

const router = express.Router();

// Public form submission is the one unauthenticated write in this file — no
// session, so IP is the only thing to key on. AI build runs behind auth
// (requirePermission), so it's keyed per-organization instead of per-IP: one
// tenant hammering the AI assistant shouldn't get a free pass just because
// its users share an office IP, and shouldn't throttle unrelated tenants
// either. Both skipped in NODE_ENV=test, same reasoning as app.js's limiters.
const publicFormSubmitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many submissions. Please try again in a minute." },
  skip: skipRateLimit,
});
const aiBuildLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.accountId || ipKeyGenerator(req.ip),
  message: { error: "Too many AI requests. Please try again in a minute." },
  skip: skipRateLimit,
});

// Public routes (/public, /responses POST) bypass auth entirely (see
// index.js's PUBLIC_ROUTES allowlist), so they use the raw, unscoped
// collection — there's no req.user to scope by. Every admin-facing route
// below scopes fresh per request via req.user.accountId instead.
const rawForms = collection("forms");
const rawResponses = collection("form_responses");
const rawLeads = collection("leads");
const accounts = collection("accounts");
const formsFor = (req) => scopedCollection("forms", req.user.accountId);
const responsesFor = (req) =>
  scopedCollection("form_responses", req.user.accountId);
// Everyone sharing a tenant (owner + teammates) for resolving role-based
// approvers — mirrors the membership check in routes/auth.js's /team route.
const tenantAccountsFor = (req) => tenantAccountsForId(req.user.accountId);

// Master admin bypasses plan limits same as every other gate in this app.
// Returns null (ok to proceed) or an error message to send as a 403.
async function checkFormLimit(req) {
  if (req.user.isMasterAdmin) return null;
  const limits = await getLimitsForAccount(req.user.accountId);
  if (limits.maxForms === Infinity) return null;
  const count = (await formsFor(req).all()).length;
  if (count >= limits.maxForms) {
    return `Your plan (${limits.label}) allows up to ${limits.maxForms} form${limits.maxForms === 1 ? "" : "s"}. Upgrade to create more.`;
  }
  return null;
}

// Same shape as checkFormLimit, but for the monthly response quota — this
// runs on the *public*, unauthenticated submission route, so there's no
// req.user to check isMasterAdmin against or scope a collection query by;
// it works off the form's own accountId instead, counting every response
// across every one of that account's forms since the start of the current
// calendar month.
async function checkResponseLimit(form) {
  const account = await accounts.find(form.accountId);
  if (account?.isMasterAdmin) return null;
  const limits = await getLimitsForAccount(form.accountId);
  if (!limits.maxResponsesPerMonth || limits.maxResponsesPerMonth === Infinity)
    return null;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const count = (
    await rawResponses.query(
      (r) =>
        r.accountId === form.accountId &&
        new Date(r.submittedAt) >= startOfMonth,
    )
  ).length;
  if (count >= limits.maxResponsesPerMonth) {
    return `This form's account has reached its monthly response limit (${limits.maxResponsesPerMonth}) on the ${limits.label} plan. Please try again next month, or ask the form owner to upgrade.`;
  }
  return null;
}

async function withResponseCount(form, allResponses) {
  const responses = (
    allResponses || (await rawResponses.query((r) => r.formId === form.id))
  ).filter((r) => r.formId === form.id);
  // lastResponseAt drives the form card's "Last Response" line — undefined
  // (not null) so the card can distinguish "never submitted" from a real
  // past date without an extra falsy check on the frontend.
  const lastResponseAt = responses.length
    ? responses
        .map((r) => r.submittedAt)
        .sort()
        .at(-1)
    : undefined;
  return {
    ...form,
    responseCount: responses.length,
    lastResponseAt,
    settings: await resolveBrandingLogo(form.settings),
  };
}

router.get("/stats", async (req, res) => {
  const [allForms, allResponses] = await Promise.all([
    formsFor(req).all(),
    responsesFor(req).all(),
  ]);
  const recentResponses = [...allResponses]
    .sort((a, b) => dayjs(b.submittedAt).diff(dayjs(a.submittedAt)))
    .slice(0, 5)
    .map((r) => ({
      ...decryptResponse(r),
      formName: allForms.find((f) => f.id === r.formId)?.name || "Unknown form",
    }));

  const startOfToday = dayjs().startOf("day");
  const startOfWeek = dayjs().subtract(7, "day");
  res.json({
    totalForms: allForms.length,
    totalResponses: allResponses.length,
    recentResponses,
    // Card deltas (Forms.jsx's stat row) — computed here rather than
    // client-side since it needs the full response list, which the list
    // page doesn't otherwise fetch (only the top-5 recentResponses above).
    newFormsThisWeek: allForms.filter((f) =>
      dayjs(f.createdAt).isAfter(startOfWeek),
    ).length,
    responsesToday: allResponses.filter((r) =>
      dayjs(r.submittedAt).isAfter(startOfToday),
    ).length,
    publishedCount: allForms.filter((f) => f.status === "Published").length,
    pendingApprovalCount: allResponses.filter(
      (r) => r.workflow?.status === "pending",
    ).length,
  });
});

// Cross-form Responses list — the sidebar's "Responses" entry. Registered
// before GET /:id so "all" (or any of its query params) never gets
// swallowed as a form id. Per-form response viewing/search/export already
// exists at GET /:id/responses; this is the same data, just unscoped to
// one form and enriched with which form each response came from.
router.get("/responses/all", async (req, res) => {
  const { formId, q, page } = req.query;
  const [allForms, allResponses] = await Promise.all([
    formsFor(req).all(),
    responsesFor(req).all(),
  ]);
  const formsById = new Map(allForms.map((f) => [f.id, f]));

  let list = allResponses
    .filter((r) => !formId || r.formId === formId)
    .map(decryptResponse)
    .map((r) => ({
      ...r,
      formName: formsById.get(r.formId)?.name || "Deleted form",
    }));

  if (q) {
    const needle = q.toLowerCase();
    list = list.filter(
      (r) =>
        r.formName.toLowerCase().includes(needle) ||
        Object.values(r.answers || {}).some((v) =>
          String(v ?? "")
            .toLowerCase()
            .includes(needle),
        ),
    );
  }

  const sorted = list.sort((a, b) =>
    dayjs(b.submittedAt).diff(dayjs(a.submittedAt)),
  );

  if (page) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limit = Math.min(
      200,
      Math.max(1, parseInt(req.query.limit, 10) || 50),
    );
    const start = (pageNum - 1) * limit;
    return res.json({
      items: sorted.slice(start, start + limit),
      total: sorted.length,
      page: pageNum,
      limit,
      totalPages: Math.ceil(sorted.length / limit) || 1,
    });
  }

  res.json(sorted);
});

router.get("/", async (req, res) => {
  const [allForms, allResponses] = await Promise.all([
    formsFor(req).all(),
    responsesFor(req).all(),
  ]);
  const withCounts = await Promise.all(
    allForms.map((f) => withResponseCount(f, allResponses)),
  );
  res.json(
    withCounts.sort((a, b) => dayjs(b.updatedAt).diff(dayjs(a.updatedAt))),
  );
});

router.get("/templates", (req, res) => {
  res.json(listTemplates());
});

// Full template detail (including fields) for the public marketplace
// detail page — listTemplates() above intentionally strips fields down to
// a count for the lightweight gallery list.
router.get("/templates/:key", (req, res) => {
  const template = getTemplate(req.params.key);
  if (!template) return res.status(404).json({ error: "Template not found" });
  res.json(template);
});

// Cross-form inbox: every response, in any form owned by this tenant,
// whose current workflow step this user can act on and hasn't yet voted
// on. Placed before /:id so "approvals" isn't swallowed as a form id.
router.get("/approvals/pending", async (req, res) => {
  const [allForms, allResponses, tenantAccounts] = await Promise.all([
    formsFor(req).all(),
    responsesFor(req).all(),
    tenantAccountsFor(req),
  ]);
  const pending = allResponses
    .filter((r) => r.workflow?.status === "pending")
    .filter((r) => {
      const approverIds = currentApprovers(r.workflow, tenantAccounts);
      if (!approverIds.includes(req.user.id)) return false;
      return !r.workflow.history.some(
        (h) =>
          h.stepIndex === r.workflow.currentStep && h.actorId === req.user.id,
      );
    })
    .map((r) => {
      const form = allForms.find((f) => f.id === r.formId);
      return {
        ...decryptResponse(r),
        formName: form?.name || "Unknown form",
        formFields: form?.fields || [],
      };
    })
    .sort((a, b) => dayjs(a.submittedAt).diff(dayjs(b.submittedAt)));
  res.json(pending);
});

// Manual trigger since this repo has no cron infra wired up — call this
// from an external scheduler (Vercel Cron, etc.) on whatever cadence makes
// sense, or run it by hand. Advances overdue steps' escalation.
router.post("/workflow/check-escalations", requirePermission("workflow.publish"), async (req, res) => {
  const allResponses = await responsesFor(req).all();
  let escalated = 0;
  for (const r of allResponses) {
    if (r.workflow?.status !== "pending") continue;
    const before = JSON.stringify(r.workflow.steps[r.workflow.currentStep]);
    const workflow = JSON.parse(JSON.stringify(r.workflow));
    applyEscalations(workflow);
    if (JSON.stringify(workflow.steps[workflow.currentStep]) !== before) {
      await responsesFor(req).update(r.id, { workflow });
      escalated++;
    }
  }
  res.json({ checked: allResponses.length, escalated });
});

// A valid custom `fields` override needs at least a `type` and `label` on
// every entry — anything else (missing/malformed) falls back to the
// template's own defaults rather than creating a broken form.
function isValidFieldOverride(fields) {
  return (
    Array.isArray(fields) &&
    fields.length > 0 &&
    fields.every((f) => f && typeof f.type === "string" && typeof f.label === "string" && f.label.trim())
  );
}

// Only accentColor/logoDataUrl are accepted from the client — everything
// else in `settings.branding` (theme, background, layout) stays gated
// behind the authenticated builder, matching the public marketplace
// preview's deliberately limited customization surface. A malformed/
// invalid logo is silently dropped (not a hard error) — this is a
// nice-to-have carried over from a public preview, not a required field,
// so a bad image shouldn't block the whole "use this template" action.
async function sanitizedBrandingOverride(branding, { accountId }) {
  if (!branding || typeof branding !== "object") return null;
  const out = {};
  if (typeof branding.accentColor === "string" && branding.accentColor.trim()) out.accentColor = branding.accentColor.trim();
  if (typeof branding.logoDataUrl === "string" && branding.logoDataUrl.startsWith("data:image/")) {
    const err = validateImageAnswer("Logo", { name: "logo", dataUrl: branding.logoDataUrl });
    if (!err) {
      const stored = await storeFileAnswer({ name: "logo", dataUrl: branding.logoDataUrl }, { accountId, flow: "branding-logo" });
      if (stored.r2Key) out.logoR2Key = stored.r2Key;
      else out.logoDataUrl = branding.logoDataUrl;
      out.logoType = "image";
    }
  }
  return Object.keys(out).length ? out : null;
}

router.post("/from-template", requirePermission("forms.create"), async (req, res) => {
  const limitError = await checkFormLimit(req);
  if (limitError) return res.status(403).json({ error: limitError });
  const { templateKey, name, fields: fieldsOverride, branding: brandingOverride } = req.body;
  const template = getTemplate(templateKey);
  if (!template) return res.status(404).json({ error: "Template not found" });

  // Lets the public template marketplace's "customize before you sign up"
  // preview carry the visitor's edits (relabeled/reordered/added/removed
  // fields, accent color, logo) into the created form instead of always
  // using the template's untouched defaults.
  const sourceFields = isValidFieldOverride(fieldsOverride) ? fieldsOverride : template.fields;
  const branding = await sanitizedBrandingOverride(brandingOverride, { accountId: req.user.accountId });

  const form = {
    id: uuid(),
    name: name?.trim() || template.name,
    description: template.description,
    fields: sourceFields.map((f) => ({ ...f, id: uuid() })),
    settings: {
      submitButtonText: "Submit",
      confirmationMessage: "Thanks for your submission!",
      layoutColumns: template.layoutColumns || 1,
      ...(branding ? { branding } : {}),
    },
    status: "Draft",
    createdBy: req.user.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await formsFor(req).insert(form);
  res.status(201).json({ ...form, accountId: req.user.accountId });
});

// Public, unauthenticated: every published form for a tenant, so an
// anonymous visitor can browse and pick one without needing a direct link
// to a specific form. accountId is the only identifier available (no slug
// concept exists yet) — safe to expose since it only unlocks the same
// published/name/description fields /:id/public already exposes per form.
router.get("/directory/:accountId", async (req, res) => {
  const account = await accounts.find(req.params.accountId);
  if (!account) return res.status(404).json({ error: "Not found" });
  const forms = (await rawForms.all()).filter(
    (f) => f.accountId === req.params.accountId && f.status === "Published",
  );
  res.json({
    company: account.company || account.name || "",
    forms: forms.map((f) => ({
      id: f.id,
      name: f.name,
      description: f.description,
    })),
  });
});

// Public, unauthenticated: only exposes published forms, and only the
// fields needed to render + submit them (no response counts/settings internals).
router.get("/:id/public", async (req, res) => {
  const form = await rawForms.find(req.params.id);
  if (!form || form.status !== "Published")
    return res.status(404).json({ error: "Form not found or not published" });
  res.json({
    id: form.id,
    name: form.name,
    description: form.description,
    fields: form.fields,
    settings: await resolveBrandingLogo(form.settings),
  });
});

// Public, unauthenticated: the specific dates the form owner marked
// available for a "booking" field (today or later only). Called first by
// the public form page so it can show a list of pickable dates instead of
// an open-ended date input — the owner set specific dates, not a
// recurring pattern, so an arbitrary date picker would mostly land on
// unavailable days.
router.get("/:id/booking-dates", async (req, res) => {
  const form = await rawForms.find(req.params.id);
  if (!form || form.status !== "Published")
    return res.status(404).json({ error: "Form not found or not published" });
  const field = form.fields.find(
    (f) => f.id === req.query.fieldId && f.type === "booking",
  );
  if (!field)
    return res
      .status(404)
      .json({ error: "Booking field not found on this form." });
  res.json({ dates: availableDates(field) });
});

// Public, unauthenticated: every meeting slot for a "booking" field on a
// given date, each tagged with whether it's already booked — computed
// from the field's availability config plus whatever's already booked by
// existing responses. Called by the public form page after the
// respondent picks one of the dates from /booking-dates, before they've
// submitted anything (so no auth, same as /public and POST /responses).
// Returns already-booked slots too (not just available ones) so the
// picker can show them as visibly taken instead of silently vanishing.
router.get("/:id/booking-slots", async (req, res) => {
  const form = await rawForms.find(req.params.id);
  if (!form || form.status !== "Published")
    return res.status(404).json({ error: "Form not found or not published" });
  const field = form.fields.find(
    (f) => f.id === req.query.fieldId && f.type === "booking",
  );
  if (!field)
    return res
      .status(404)
      .json({ error: "Booking field not found on this form." });
  if (!req.query.date)
    return res.status(400).json({ error: "date is required (YYYY-MM-DD)." });

  const responses = await rawResponses.query((r) => r.formId === form.id);
  const decryptedAnswers = responses.map((r) => decryptResponse(r).answers);
  const bookedIsoTimes = extractBookedTimes(field, decryptedAnswers);
  const slots = allSlotsForDate(field, req.query.date, bookedIsoTimes);
  res.json({ slots });
});

// Public, unauthenticated: resolves a magic-link token (sent by
// /:id/responses/:responseId/send-link) to the response + its form's
// fields, so a respondent can view what they submitted without an account.
// Placed before /:id so "claim" isn't swallowed as a form id.
router.get("/claim", async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: "token is required." });

  const tokenHash = hashClaimToken(String(token));
  const [response] = await rawResponses.query(
    (r) => r.claimTokenHash === tokenHash,
  );
  const valid =
    response?.claimTokenExpiresAt &&
    new Date(response.claimTokenExpiresAt) > new Date();
  if (!valid)
    return res
      .status(400)
      .json({ error: "This link is invalid or has expired." });

  const form = await rawForms.find(response.formId);
  const decrypted = decryptResponse(response);
  res.json({
    response: { ...decrypted, answers: await resolveAnswersFileFields(decrypted.answers) },
    form: form
      ? {
          id: form.id,
          name: form.name,
          description: form.description,
          fields: form.fields,
        }
      : null,
  });
});

// Manager-only: same shape as /public but works regardless of publish
// status, so Draft forms can be previewed before going live.
router.get("/:id/preview", requirePermission("forms.view"), async (req, res) => {
  const form = await formsFor(req).find(req.params.id);
  if (!form) return res.status(404).json({ error: "Not found" });
  res.json({
    id: form.id,
    name: form.name,
    description: form.description,
    fields: form.fields,
    settings: form.settings,
  });
});

router.get("/:id", async (req, res) => {
  const form = await formsFor(req).find(req.params.id);
  if (!form) return res.status(404).json({ error: "Not found" });
  res.json(await withResponseCount(form));
});

// Builds or edits a form's field list from a natural-language instruction.
// Returns the proposed change without saving it — the builder UI applies it
// to local state, and the user still has to hit Save. 503 (not a crash)
// when no API key is configured yet, so the frontend can fall back to its
// local "add a field for X" pattern-matcher instead of erroring out.
router.post("/:id/ai/build", requirePermission("forms.edit"), aiBuildLimiter, async (req, res) => {
  const form = await formsFor(req).find(req.params.id);
  if (!form) return res.status(404).json({ error: "Not found" });
  if (!req.user.isMasterAdmin) {
    const limits = await getLimitsForAccount(req.user.accountId);
    if (!limits.aiAssistant) {
      return res
        .status(403)
        .json({
          error: `The AI Assistant requires the Growth plan or higher. Your account is on ${limits.label}.`,
          code: "plan_required",
        });
    }
    if (!(await hasEnoughCredits(req.user.accountId, "formBuild"))) {
      return res.status(403).json({
        error: `You don't have enough AI credits for this (needs ${CREDIT_COSTS.formBuild}). Upgrade your plan for more.`,
        code: "insufficient_credits",
      });
    }
  }
  const provider = await getAiProviderForAccount(req.user.accountId);
  if (!aiConfigured(provider)) {
    const providerLabel = provider === "gemini" ? "Gemini" : "Anthropic";
    const envVar =
      provider === "gemini" ? "GEMINI_API_KEY" : "ANTHROPIC_API_KEY";
    return res
      .status(503)
      .json({
        error: `${providerLabel} isn't configured yet. Ask your admin to set ${envVar} in the backend environment.`,
      });
  }
  const prompt = (req.body.prompt || "").trim();
  if (!prompt) return res.status(400).json({ error: "prompt is required." });
  try {
    const result = await generateFormFields({
      provider,
      prompt,
      currentFields: form.fields || [],
    });
    if (!req.user.isMasterAdmin)
      await deductCredits(req.user.accountId, req.user.id, "formBuild", {
        formId: form.id,
      });
    res.json(result);
  } catch (err) {
    const status = /rate-limited|quota/i.test(err.message) ? 429 : 502;
    res.status(status).json({ error: err.message });
  }
});

router.post("/", requirePermission("forms.create"), async (req, res) => {
  const limitError = await checkFormLimit(req);
  if (limitError) return res.status(403).json({ error: limitError });
  const form = {
    id: uuid(),
    name: req.body.name || "Untitled Form",
    description: req.body.description || "",
    fields: req.body.fields || [],
    settings: req.body.settings || {},
    workflow: req.body.workflow || { enabled: false, steps: [] },
    // Same field PUT /:id already accepts (routes/forms.js's generic
    // update) — missing here meant a form's lead-gen toggle could only
    // ever be set as a second, separate request after creation, with no
    // way to configure it in the one call that actually creates the form.
    createLeadOnSubmit: !!req.body.createLeadOnSubmit,
    status: "Draft",
    createdBy: req.user.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await formsFor(req).insert(form);
  await recordEvent({
    accountId: req.user.accountId,
    type: EVENT_TYPES.FORM_CREATED,
    entityType: "form",
    entityId: form.id,
    actorId: req.user.id,
    actorName: req.user.email,
    source: EVENT_SOURCES.FORMS,
    payload: { name: form.name },
  });
  res.status(201).json({ ...form, accountId: req.user.accountId });
});

router.put("/:id", requirePermission("forms.edit"), async (req, res) => {
  if (req.body.workflow?.enabled && !req.user.isMasterAdmin) {
    const limits = await getLimitsForAccount(req.user.accountId);
    if (!limits.workflows) {
      return res
        .status(403)
        .json({
          error: `Approval workflows require the Growth plan or higher. Your account is on ${limits.label}.`,
        });
    }
  }
  // Re-check the branding logo server-side (same allowlist/size/magic-byte
  // validation as form file-answers and feedback attachments) — this path
  // previously accepted whatever the client sent with no check at all.
  // Only runs when the client actually sent a fresh inline data URL (an
  // unchanged logo already stored via R2 comes back through as `dataUrl`
  // too — see resolveFileAnswer — but that's a resolved read-only URL, not
  // a new upload, so it's left untouched here to avoid re-uploading it).
  const incomingLogo = req.body.settings?.branding?.logoDataUrl;
  if (typeof incomingLogo === "string" && incomingLogo.startsWith("data:")) {
    const err = validateImageAnswer("Logo", { name: "logo", dataUrl: incomingLogo });
    if (err) return res.status(400).json({ error: err });
    const stored = await storeFileAnswer({ name: "logo", dataUrl: incomingLogo }, { accountId: req.user.accountId, flow: "branding-logo" });
    if (stored.r2Key) {
      // Uploaded to R2 — store the reference, not the raw base64.
      req.body.settings.branding.logoR2Key = stored.r2Key;
      delete req.body.settings.branding.logoDataUrl;
    }
    // else: R2 isn't configured, storeFileAnswer returned the answer
    // unchanged — logoDataUrl already holds the validated inline base64,
    // nothing left to do (today's exact pre-R2 behavior).
  }
  const updated = await formsFor(req).update(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "Not found" });
  await recordEvent({
    accountId: req.user.accountId,
    type: EVENT_TYPES.FORM_UPDATED,
    entityType: "form",
    entityId: updated.id,
    actorId: req.user.id,
    actorName: req.user.email,
    source: EVENT_SOURCES.FORMS,
    payload: { name: updated.name, status: updated.status },
  });
  res.json(updated);
});

router.delete("/:id", requirePermission("forms.delete"), async (req, res) => {
  const form = await formsFor(req).find(req.params.id);
  if (!form) return res.status(404).json({ error: "Not found" });
  const formResponses = await responsesFor(req).query(
    (r) => r.formId === req.params.id,
  );
  await Promise.all(formResponses.map((r) => responsesFor(req).remove(r.id)));
  await formsFor(req).remove(req.params.id);
  await recordEvent({
    accountId: req.user.accountId,
    type: EVENT_TYPES.FORM_DELETED,
    entityType: "form",
    entityId: req.params.id,
    actorId: req.user.id,
    actorName: req.user.email,
    source: EVENT_SOURCES.FORMS,
    payload: { name: form.name },
  });
  res.status(204).end();
});

router.post("/:id/duplicate", requirePermission("forms.create"), async (req, res) => {
  const limitError = await checkFormLimit(req);
  if (limitError) return res.status(403).json({ error: limitError });
  const form = await formsFor(req).find(req.params.id);
  if (!form) return res.status(404).json({ error: "Not found" });
  const copy = {
    ...form,
    id: uuid(),
    name: `${form.name} (Copy)`,
    status: "Draft",
    createdBy: req.user.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await formsFor(req).insert(copy);
  res.status(201).json({ ...copy, accountId: req.user.accountId });
});

router.put("/:id/publish", requirePermission("forms.publish"), async (req, res) => {
  const updated = await formsFor(req).update(req.params.id, {
    status: "Published",
  });
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(updated);
});

router.put("/:id/unpublish", requirePermission("forms.publish"), async (req, res) => {
  const updated = await formsFor(req).update(req.params.id, {
    status: "Draft",
  });
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(updated);
});

router.get("/:id/responses", async (req, res) => {
  const form = await formsFor(req).find(req.params.id);
  if (!form) return res.status(404).json({ error: "Not found" });

  const { q, fieldId, value } = req.query;
  // Answers are encrypted at rest — decrypt before filtering/searching or
  // matches against ciphertext would silently never hit.
  let list = (
    await responsesFor(req).query((r) => r.formId === req.params.id)
  ).map(decryptResponse);

  if (fieldId && value) {
    list = list.filter(
      (r) =>
        String(r.answers?.[fieldId] ?? "").toLowerCase() ===
        String(value).toLowerCase(),
    );
  }
  if (q) {
    const needle = q.toLowerCase();
    list = list.filter((r) =>
      Object.values(r.answers || {}).some((v) =>
        String(v ?? "")
          .toLowerCase()
          .includes(needle),
      ),
    );
  }

  const sorted = list.sort((a, b) =>
    dayjs(b.submittedAt).diff(dayjs(a.submittedAt)),
  );

  // Opt-in pagination (same pattern as crudFactory) — answers are encrypted
  // at rest, so search/filter above already has to decrypt+scan every
  // response for this form in JS (Mongo can't $regex ciphertext); paginating
  // here still caps what actually goes over the wire to the browser.
  if (req.query.page) {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      200,
      Math.max(1, parseInt(req.query.limit, 10) || 50),
    );
    const start = (page - 1) * limit;
    const pageItems = sorted.slice(start, start + limit);
    return res.json({
      items: await Promise.all(pageItems.map(async (r) => ({ ...r, answers: await resolveAnswersFileFields(r.answers) }))),
      total: sorted.length,
      page,
      limit,
      totalPages: Math.ceil(sorted.length / limit) || 1,
    });
  }

  res.json(await Promise.all(sorted.map(async (r) => ({ ...r, answers: await resolveAnswersFileFields(r.answers) }))));
});

// Cap on how many responses go into a single AI Insights call — unbounded
// would get slow/expensive as a form accumulates thousands of responses,
// and a summary of the most recent N is what's actually useful (trends
// change over time; nobody wants "insights" blending in 2-year-old data).
const INSIGHTS_MAX_RESPONSES = 100;
// Below this, there's too little data for a summary to say anything real
// — better to tell the user that plainly than spend a credit on filler.
const INSIGHTS_MIN_RESPONSES = 3;

// AI Insights: summarizes themes/trends across a form's most recent
// responses instead of making someone read every submission by hand.
// Gated the same way as every other AI action — plan tier, then credits.
router.post("/:id/insights", requirePermission("forms.view"), async (req, res) => {
  const form = await formsFor(req).find(req.params.id);
  if (!form) return res.status(404).json({ error: "Not found" });

  const allResponses = (
    await responsesFor(req).query((r) => r.formId === req.params.id)
  ).map(decryptResponse);
  if (allResponses.length < INSIGHTS_MIN_RESPONSES) {
    return res
      .status(422)
      .json({
        error: `This form needs at least ${INSIGHTS_MIN_RESPONSES} responses before AI Insights has enough to work with.`,
      });
  }

  if (!req.user.isMasterAdmin) {
    const limits = await getLimitsForAccount(req.user.accountId);
    if (!limits.aiAssistant) {
      return res
        .status(403)
        .json({
          error: `AI Insights requires the Growth plan or higher. Your account is on ${limits.label}.`,
          code: "plan_required",
        });
    }
    if (!(await hasEnoughCredits(req.user.accountId, "formInsights"))) {
      return res.status(403).json({
        error: `You don't have enough AI credits for this (needs ${CREDIT_COSTS.formInsights}). Upgrade your plan for more.`,
        code: "insufficient_credits",
      });
    }
  }

  const provider = await getAiProviderForAccount(req.user.accountId);
  if (!aiConfigured(provider)) {
    const providerLabel = provider === "gemini" ? "Gemini" : "Anthropic";
    const envVar =
      provider === "gemini" ? "GEMINI_API_KEY" : "ANTHROPIC_API_KEY";
    return res
      .status(503)
      .json({
        error: `${providerLabel} isn't configured yet. Ask your admin to set ${envVar} in the backend environment.`,
      });
  }

  const recent = allResponses
    .sort((a, b) => dayjs(b.submittedAt).diff(dayjs(a.submittedAt)))
    .slice(0, INSIGHTS_MAX_RESPONSES)
    // File answers are a { name, type, dataUrl } object — the (potentially
    // megabytes-long) base64 payload has no business going to the model,
    // same reasoning as the CSV/Excel export's file-answer handling above.
    .map((r) => {
      const answers = {};
      for (const f of form.fields) {
        const value = r.answers?.[f.id];
        answers[f.label] =
          f.type === "file" && value?.name
            ? value.name
            : f.type === "images" && Array.isArray(value)
              ? value.map((v) => v?.name).filter(Boolean).join(", ")
              : value;
      }
      return answers;
    });

  try {
    const { summary } = await generateInsights({
      provider,
      formName: form.name,
      fields: form.fields,
      responses: recent,
    });
    if (!req.user.isMasterAdmin)
      await deductCredits(req.user.accountId, req.user.id, "formInsights", {
        formId: form.id,
        responseCount: recent.length,
      });
    res.json({
      summary,
      responseCount: recent.length,
      totalResponses: allResponses.length,
    });
  } catch (err) {
    const status = /rate-limited|quota/i.test(err.message) ? 429 : 502;
    res.status(status).json({ error: err.message });
  }
});

// Public submission — anonymous form-fillers and the WhatsApp survey engine
// have no session, so the response inherits the *form's* tenant, not a
// (nonexistent) requester's.
router.post("/:id/responses", publicFormSubmitLimiter, async (req, res) => {
  const form = await rawForms.find(req.params.id);
  if (!form) return res.status(404).json({ error: "Not found" });

  // Blocks automated spam submissions on public forms — same opt-in-by-
  // config pattern as the signup route above, so accounts/environments
  // without a Turnstile secret key configured aren't broken.
  if (turnstile.isConfigured()) {
    const human = await turnstile.verifyToken(req.body.turnstileToken, req.ip);
    if (!human) {
      return res.status(400).json({ error: "Verification failed — please try again." });
    }
  }

  const responseLimitError = await checkResponseLimit(form);
  if (responseLimitError)
    return res.status(403).json({ error: responseLimitError });

  // Re-check required/email/phone/number/length rules server-side — the
  // frontend's validateField() is just UX, not a security boundary; a
  // submission can be crafted directly against this endpoint, bypassing
  // any browser-side format checks entirely.
  const validationError = validateSubmission(form.fields, req.body.answers);
  if (validationError) return res.status(400).json({ error: validationError });

  // Re-check every file field server-side — same reasoning, see
  // utils/fileUploads.js for what's enforced (allowlisted types, size cap,
  // magic-byte sniff). Once validated, the answer is handed to R2 (or left
  // inline if R2 isn't configured) before the whole answers object is
  // encrypted below — storeFileAnswer() is a no-op passthrough either way
  // when there's nothing to upload.
  for (const field of form.fields.filter((f) => f.type === "file")) {
    const answer = req.body.answers?.[field.id];
    const err = validateFileAnswer(field.label, answer);
    if (err) return res.status(400).json({ error: err });
    if (answer) {
      req.body.answers[field.id] = await storeFileAnswer(answer, { accountId: form.accountId, flow: "form-response" });
    }
  }

  // "images" is the multi-file sibling of "file" — same re-validation
  // reasoning, image-only allowlist (ImagesFieldInput never offers
  // non-image types client-side), array of up to field.maxFiles answers
  // instead of one. Every limit is clamped to the account's actual plan
  // tier (utils/plans.js) — a form creator's own field config
  // (Forms.jsx's "Max images" property) is a UX ceiling only; the real
  // enforcement is min(field's config, plan's limit), always, regardless
  // of what the field itself claims. Master admin accounts skip the plan
  // clamp entirely, same as every other plan-gated check in this app.
  const imagesFields = form.fields.filter((f) => f.type === "images");
  if (imagesFields.length > 0) {
    const account = await accounts.find(form.accountId);
    const planLimits = account?.isMasterAdmin ? null : await getLimitsForAccount(form.accountId);

    for (const field of imagesFields) {
      const answers = req.body.answers?.[field.id];
      if (answers === undefined || answers === null) continue;
      if (!Array.isArray(answers)) {
        return res.status(400).json({ error: `"${field.label}": expected a list of images.` });
      }

      const max = planLimits ? Math.min(field.maxFiles || Infinity, planLimits.maxImageFiles) : field.maxFiles || 10;
      if (answers.length > max) {
        return res.status(400).json({ error: `"${field.label}": up to ${max} images allowed.` });
      }

      const maxFileBytes = planLimits
        ? Math.min(field.maxFileBytes || Infinity, planLimits.maxImageFileBytes)
        : field.maxFileBytes || 5 * 1024 * 1024;
      const maxTotalBytes = planLimits
        ? Math.min(field.maxTotalBytes || Infinity, planLimits.maxImageTotalBytes)
        : field.maxTotalBytes || 20 * 1024 * 1024;

      const totalBytes = answers.reduce((sum, a) => {
        const base64 = (a?.dataUrl || "").slice((a?.dataUrl || "").indexOf(",") + 1);
        return sum + Math.floor((base64.length * 3) / 4);
      }, 0);
      if (totalBytes > maxTotalBytes) {
        return res.status(400).json({
          error: `"${field.label}": total upload size exceeds ${(maxTotalBytes / (1024 * 1024)).toFixed(1)} MB.`,
        });
      }

      const stored = [];
      for (const answer of answers) {
        const err = validateImageAnswer(field.label, answer, maxFileBytes);
        if (err) return res.status(400).json({ error: err });
        stored.push(await storeFileAnswer(answer, { accountId: form.accountId, flow: "form-response" }));
      }
      req.body.answers[field.id] = stored;
    }
  }

  // Re-check every booking field server-side — the slot list the
  // respondent saw could be stale by the time they submit (someone else
  // grabbed it, or the availability config changed underneath them).
  const bookingFields = form.fields.filter((f) => f.type === "booking");
  if (bookingFields.length > 0) {
    const existingResponses = await rawResponses.query(
      (r) => r.formId === form.id,
    );
    const decryptedAnswers = existingResponses.map(
      (r) => decryptResponse(r).answers,
    );
    for (const field of bookingFields) {
      const chosen = req.body.answers?.[field.id];
      if (!chosen) continue; // not required at this layer — required-field validation is the client's/field's job
      const dateStr = chosen.slice(0, 10);
      const bookedIsoTimes = extractBookedTimes(field, decryptedAnswers);
      const available = slotsForDate(field, dateStr, bookedIsoTimes);
      if (!available.includes(chosen)) {
        return res
          .status(409)
          .json({
            error: `That time slot for "${field.label}" was just taken — please pick another.`,
          });
      }
    }
  }

  const response = {
    id: uuid(),
    formId: req.params.id,
    // Customer-submitted answers are encrypted (AES-256-GCM) before being
    // written to Mongo — see utils/formCrypto.js.
    answers: encryptAnswers(req.body.answers || {}),
    submittedAt: new Date().toISOString(),
    accountId: form.accountId,
    // Short, human-friendly id a respondent can quote to support — the
    // real lookup key for /claim is still the hashed magic-link token below,
    // never this (it's short enough to be guessable/enumerable).
    referenceId: generateReferenceId(),
  };
  // Snapshotted at submission time so later edits to the form's workflow
  // config don't retroactively change an approval already in flight.
  if (form.workflow?.enabled && form.workflow.steps?.length) {
    response.workflow = autoAdvance(buildSnapshot(form.workflow));
  } else if (bookingFields.length > 0) {
    // A booking field with no explicitly configured workflow still gets
    // routed for approval — the form owner should always get a chance to
    // confirm/decline a meeting request, not just when they remembered to
    // set up a workflow by hand. Single step, resolves to the tenant
    // owner (authRole "admin") via the same role-based approver mechanism
    // as an explicit workflow — the whole approve/reject UI (My Approvals,
    // response detail panel) already works for any response with a
    // .workflow snapshot, no frontend changes needed for this to show up.
    response.workflow = autoAdvance(
      buildSnapshot({
        steps: [
          {
            id: "confirm-booking",
            name: "Confirm Booking",
            mode: "all",
            approvers: [{ type: "role", value: "admin" }],
          },
        ],
      }),
    );
  }
  await rawResponses.insert(response);
  // Everything that happens as a downstream consequence of this one
  // submission — the approval it may create, the lead it may auto-create —
  // shares this correlationId, so the AI Observer can reconstruct the whole
  // "form submitted -> approval pending -> lead created" chain as one
  // process later instead of seeing three unrelated events.
  const correlationId = response.id;
  // Best-effort — a public, unauthenticated route, so these headers are
  // whatever the respondent's client sent and aren't verified/trusted for
  // anything beyond descriptive analytics (e.g. spotting a submission spike
  // from a single IP), never for access control.
  const submissionMetadata = {
    ip: req.ip,
    userAgent: req.get("user-agent") || null,
  };
  await recordEvent({
    accountId: form.accountId,
    type: EVENT_TYPES.RESPONSE_CREATED,
    entityType: "response",
    entityId: response.id,
    source: EVENT_SOURCES.FORMS,
    correlationId,
    payload: {
      formId: form.id,
      formName: form.name,
      referenceId: response.referenceId,
    },
    metadata: submissionMetadata,
  });
  // Submitting a response with an unresolved workflow immediately puts it
  // in someone's approval queue — worth its own event (distinct from the
  // response.created above) so the AI Observer can track approval latency
  // without having to infer "pending" from the response payload's shape.
  if (response.workflow && response.workflow.status === "pending") {
    await recordEvent({
      accountId: form.accountId,
      type: EVENT_TYPES.APPROVAL_PENDING,
      entityType: "response",
      entityId: response.id,
      source: EVENT_SOURCES.FORMS,
      correlationId,
      payload: { formId: form.id, formName: form.name },
    });
    await evaluateRulesQuietly(form.accountId);
  }

  // Optional per-form toggle (Settings tab) — turns a form into a lead-gen
  // source. Best-effort field mapping since a form's fields are whatever
  // the tenant designed, not a fixed schema: first email-type field →
  // email, first phone-type field → mobile, first text-like field → name.
  if (form.createLeadOnSubmit) {
    const rawAnswers = req.body.answers || {};
    const emailField = form.fields.find((f) => f.type === "email");
    const phoneField = form.fields.find((f) => f.type === "phone");
    const nameField = form.fields.find(
      (f) => f.type === "text" || f.type === "longtext",
    );
    const lead = {
      id: uuid(),
      name: (nameField && rawAnswers[nameField.id]) || "Website Visitor",
      email: (emailField && rawAnswers[emailField.id]) || "",
      mobile: (phoneField && rawAnswers[phoneField.id]) || "",
      company: "",
      source: form.name || "Website",
      interestedProduct: "",
      budget: 0,
      priority: "Medium",
      status: "New",
      createdAt: new Date().toISOString(),
      accountId: form.accountId,
    };
    await rawLeads.insert(lead);
    await recordEvent({
      accountId: form.accountId,
      type: EVENT_TYPES.LEAD_CREATED,
      entityType: "lead",
      entityId: lead.id,
      source: EVENT_SOURCES.FORMS,
      correlationId,
      payload: {
        formId: form.id,
        formName: form.name,
        name: lead.name,
        email: lead.email,
      },
    });
  }

  const decryptedResponse = decryptResponse(response);
  res.status(201).json({ ...decryptedResponse, answers: await resolveAnswersFileFields(decryptedResponse.answers) });
});

// Public, unauthenticated — same reasoning as POST /:id/responses: a
// respondent who just submitted has no session, but wants a way to come
// back later. Emails a one-time link (24h TTL) that resolves via GET /claim.
router.post("/:id/responses/:responseId/send-link", async (req, res) => {
  const response = await rawResponses.find(req.params.responseId);
  if (!response || response.formId !== req.params.id)
    return res.status(404).json({ error: "Not found" });

  const email = (req.body.email || "").trim();
  if (!email) return res.status(400).json({ error: "email is required." });

  const form = await rawForms.find(req.params.id);
  const rawToken = crypto.randomBytes(32).toString("hex");
  await rawResponses.update(response.id, {
    claimTokenHash: hashClaimToken(rawToken),
    claimTokenExpiresAt: new Date(
      Date.now() + CLAIM_TOKEN_TTL_MS,
    ).toISOString(),
    claimEmail: email,
  });

  const claimLink = `${FRONTEND_URL}/claim?token=${rawToken}`;
  const mailResult = await emailClient.sendMail({
    to: email,
    subject: `Your response to "${form?.name || "a form"}"`,
    html: emailLayout({
      preheader:
        "View or revisit your submission — this link expires in 24 hours.",
      heading: "Access your submission",
      bodyHtml: `<p>Here's the link to view your submission${form ? ` for <strong>${form.name}</strong>` : ""} (reference <strong>${response.referenceId}</strong>). This link expires in 24 hours.</p>`,
      cta: { label: "View my submission", url: claimLink },
    }),
  });

  const genericResponse = {
    message: "If that's a valid response, a link has been sent.",
  };
  // Dev convenience only, mirroring /forgot-password — always expose the
  // one-time claim link in non-production environments so the local/test
  // flows can verify the token path end-to-end. Never expose this in
  // production, regardless of whether the transport is mocked or real.
  if (process.env.NODE_ENV !== "production") {
    return res.json({ ...genericResponse, devClaimLink: claimLink });
  }
  res.json(genericResponse);
});

router.get("/:id/responses/:responseId/workflow", async (req, res) => {
  const response = await responsesFor(req).find(req.params.responseId);
  if (!response?.workflow)
    return res.status(404).json({ error: "This response has no workflow." });
  const tenantAccounts = await tenantAccountsFor(req);
  res.json({
    ...response.workflow,
    currentApproverIds: currentApprovers(response.workflow, tenantAccounts),
  });
});

// Best-effort confirmation email to whoever submitted the response, once
// the workflow reaches a final "approved" state — looks for the first
// email-type field's answer (there's no login/session tied to a public
// form submission, so that's the only address we have). Never throws:
// a missing email field or a transient SMTP failure shouldn't turn an
// otherwise-successful approval into a 500 for the approving admin.
async function notifyApprovalIfEmailAvailable(form, response) {
  try {
    const emailField = form.fields.find((f) => f.type === "email");
    if (!emailField) return;
    const { answers } = decryptResponse(response);
    const to = answers?.[emailField.id];
    if (!to || typeof to !== "string") return;

    const bookingField = form.fields.find((f) => f.type === "booking");
    const bookingTime = bookingField ? answers?.[bookingField.id] : null;
    const subject = bookingField
      ? `Your appointment for "${form.name}" is confirmed`
      : `Your submission for "${form.name}" was approved`;
    const bodyHtml = bookingField
      ? `<p>Good news — your appointment request for <strong>${form.name}</strong> has been approved${
          bookingTime
            ? ` for <strong>${new Date(bookingTime).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</strong>`
            : ""
        }.</p>`
      : `<p>Good news — your submission for <strong>${form.name}</strong> has been approved.</p>`;
    await emailClient.sendMail({
      to,
      subject,
      html: emailLayout({
        preheader: subject,
        heading: bookingField
          ? "Appointment confirmed ✅"
          : "Submission approved ✅",
        bodyHtml,
      }),
    });
  } catch {
    // Notification is a nice-to-have — the approval itself already succeeded.
  }
}

router.post("/:id/responses/:responseId/workflow/decide", async (req, res) => {
  const response = await responsesFor(req).find(req.params.responseId);
  if (!response?.workflow)
    return res.status(404).json({ error: "This response has no workflow." });
  const { action, comment } = req.body;
  if (!["approve", "reject"].includes(action))
    return res
      .status(400)
      .json({ error: "action must be 'approve' or 'reject'." });

  const tenantAccounts = await tenantAccountsFor(req);
  const workflow = JSON.parse(JSON.stringify(response.workflow));
  try {
    applyDecision(
      workflow,
      { actorId: req.user.id, actorName: req.user.email, action, comment },
      tenantAccounts,
    );
  } catch (err) {
    return res.status(403).json({ error: err.message });
  }
  await responsesFor(req).update(req.params.responseId, { workflow });

  if (workflow.status === "approved" || workflow.status === "rejected") {
    await recordEvent({
      accountId: req.user.accountId,
      type:
        workflow.status === "approved"
          ? EVENT_TYPES.APPROVAL_APPROVED
          : EVENT_TYPES.APPROVAL_REJECTED,
      entityType: "response",
      entityId: req.params.responseId,
      actorId: req.user.id,
      actorName: req.user.email,
      source: EVENT_SOURCES.FORMS,
      severity:
        workflow.status === "rejected" ? SEVERITY.WARNING : SEVERITY.INFO,
      payload: { formId: req.params.id, comment },
    });
    // Also gives approvalPending48h.js its chance to auto-resolve the
    // "Approval overdue" recommendation this same decision just settled —
    // see evaluateRulesQuietly's doc comment above.
    await evaluateRulesQuietly(req.user.accountId);
  }

  if (workflow.status === "approved") {
    const form = await formsFor(req).find(req.params.id);
    if (form) await notifyApprovalIfEmailAvailable(form, response);
  }

  res.json({
    ...workflow,
    currentApproverIds: currentApprovers(workflow, tenantAccounts),
  });
});

router.delete(
  "/:id/responses/:responseId",
  requirePermission("forms.delete"),
  async (req, res) => {
    const removed = await responsesFor(req).remove(req.params.responseId);
    if (!removed) return res.status(404).json({ error: "Not found" });
    await recordEvent({
      accountId: req.user.accountId,
      type: EVENT_TYPES.RESPONSE_DELETED,
      entityType: "response",
      entityId: req.params.responseId,
      actorId: req.user.id,
      actorName: req.user.email,
      source: EVENT_SOURCES.FORMS,
      payload: { formId: req.params.id },
    });
    res.status(204).end();
  },
);

// Excel/Sheets treats a leading =, +, -, or @ as the start of a formula —
// a form respondent could submit "=cmd|'/c calc'!A1" as an answer and have
// it execute when someone opens the exported file (CSV or Excel — both go
// through this same row-builder). Prefixing with a plain quote defuses it
// (Excel shows the literal text, formula never runs).
function sanitizeCsvCell(value) {
  const str = String(value ?? "");
  return /^[=+\-@]/.test(str) ? `'${str}` : str;
}

function responseRows(form, formResponses) {
  return formResponses.map((r) => {
    const row = {
      "Submitted At": dayjs(r.submittedAt).format("YYYY-MM-DD HH:mm"),
    };
    form.fields.forEach((f) => {
      const answer = r.answers?.[f.id];
      // File answers are a { name, type, dataUrl } object — export just the
      // filename, not the (potentially megabytes-long) base64 payload.
      // "images" is the same idea for an array of them.
      const cell =
        f.type === "file" && answer?.name
          ? answer.name
          : f.type === "images" && Array.isArray(answer)
            ? answer.map((v) => v?.name).filter(Boolean).join(", ")
            : answer;
      row[f.label] = sanitizeCsvCell(cell ?? "");
    });
    return row;
  });
}

router.get("/:id/responses/export/csv", async (req, res) => {
  const form = await formsFor(req).find(req.params.id);
  if (!form) return res.status(404).json({ error: "Not found" });
  const formResponses = (
    await responsesFor(req).query((r) => r.formId === req.params.id)
  ).map(decryptResponse);
  const rows = responseRows(form, formResponses);
  const headers = rows.length
    ? Object.keys(rows[0])
    : ["Submitted At", ...form.fields.map((f) => f.label)];
  const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [
    headers.map(escape).join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h] ?? "")).join(",")),
  ].join("\n");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=${form.name.replace(/\s+/g, "_")}-responses.csv`,
  );
  res.setHeader("Content-Type", "text/csv");
  res.send(csv);
});

router.get("/:id/responses/export/excel", async (req, res) => {
  const form = await formsFor(req).find(req.params.id);
  if (!form) return res.status(404).json({ error: "Not found" });
  const formResponses = (
    await responsesFor(req).query((r) => r.formId === req.params.id)
  ).map(decryptResponse);
  const rows = responseRows(form, formResponses);
  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, sheet, "Responses");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=${form.name.replace(/\s+/g, "_")}-responses.xlsx`,
  );
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.send(buffer);
});

module.exports = router;
