// The "employee leave request" scenario, driven through the real browser
// UI wherever the point of the test is what a user actually sees (AI
// Center reacting live, the Notify Approver button, the recommendation
// disappearing without a reload) — and through direct API calls wherever
// it isn't (creating the form, submitting as the anonymous employee,
// approving as the manager), same reasoning as publicForms.cy.js's split
// between UI-driven and API-driven setup.
//
// There's no scheduled job re-running the Rule Engine on a timer (see
// services/ruleEngine.js's doc comment) — recommendations only get
// (re)computed when a relevant event fires. So "48+ hours pass with no
// approval" is simulated with the backdateEvent task, and the Rule Engine
// is given its one chance to notice by triggering a second, unrelated
// approval-related event in the same account, exactly as it would happen
// in production.
describe("AI Center — employee leave request scenario", () => {
  let authToken;
  let formId;
  let responseId;
  const formName = `Cypress Leave Request ${Date.now()}`;

  before(() => {
    cy.session("admin-ai-center", () => {
      cy.visit("/login");
      cy.get('input[type="email"]').first().type("admin@pipeline.com");
      cy.get('input[type="password"]').first().type("admin123");
      cy.get('button[type="submit"]').click();
      cy.url({ timeout: 15000 }).should("include", "/app");
    });

    cy.visit("/app");
    cy.window()
      .then((win) => JSON.parse(win.localStorage.getItem("pipeline_auth_user")))
      .then((user) => {
        authToken = user.token;
        // Set up via the API directly — the multi-step form builder UI
        // isn't what this suite is testing, same reasoning as
        // publicForms.cy.js. The approver is "role: admin", which always
        // resolves to the account owner (see workflowEngine.js), so the
        // already-logged-in admin session below can act as "the manager".
        return cy.request({
          method: "POST",
          url: "/api/forms",
          headers: { Authorization: `Bearer ${authToken}` },
          body: {
            name: formName,
            fields: [{ id: "f_reason", type: "text", label: "Reason" }],
            workflow: { enabled: true, steps: [{ id: "step-1", name: "Manager Review", mode: "all", approvers: [{ type: "role", value: "admin" }] }] },
          },
        });
      })
      .then((res) => {
        formId = res.body.id;
        return cy.request({ method: "PUT", url: `/api/forms/${formId}/publish`, headers: { Authorization: `Bearer ${authToken}` } });
      });
  });

  after(() => {
    if (!formId) return;
    // Deleting the form doesn't clean up any recommendation still tied to
    // it — dismiss those too, otherwise a run that fails before reaching
    // the approve step leaves an orphaned OPEN recommendation that drags
    // down Business Health forever and clutters every later run's AI
    // Center list (which is what made the "element is clipped" failure on
    // an earlier run worse than it needed to be — the target card was
    // buried under leftover cards from previous runs).
    cy.request({ url: "/api/recommendations?status=OPEN", headers: { Authorization: `Bearer ${authToken}` } })
      .then((res) => res.body.items.filter((r) => r.payload?.formId === formId))
      .then((orphaned) => {
        orphaned.forEach((r) => {
          cy.request({ method: "PATCH", url: `/api/recommendations/${r.id}/dismiss`, headers: { Authorization: `Bearer ${authToken}` } });
        });
      });
    cy.request({ method: "DELETE", url: `/api/forms/${formId}`, headers: { Authorization: `Bearer ${authToken}` }, failOnStatusCode: false });
  });

  it("flags an overdue approval, notifies the approver from the UI, and auto-resolves once approved — live, with no reload", () => {
    // 1-5. Employee submits (public, unauthenticated route) — response.created
    // and approval.pending events are recorded.
    cy.request({ method: "POST", url: `/api/forms/${formId}/responses`, body: { answers: { f_reason: "Family event" } } }).then((res) => {
      responseId = res.body.id;

      // 6. Manager doesn't approve for 48+ hours.
      cy.task("backdateEvent", { type: "approval.pending", entityId: responseId, hoursAgo: 72 }).then(() => {
        // 7-8. Rule Engine runs — triggered by another approval-related
        // event in the same account (a second employee's request), since
        // nothing re-runs rules on a timer.
        return cy.request({ method: "POST", url: `/api/forms/${formId}/responses`, body: { answers: { f_reason: "Second request" } } });
      });
    });

    // 9-10. AI Center shows it as a HIGH-priority open recommendation.
    // The title names the specific form (see approvalPending48h.js) — that's
    // what lets this test (and a real user) tell it apart from any other
    // account's or run's "overdue approval" card that happens to be open
    // at the same time, rather than matching the first generic-looking card
    // in the DOM.
    const overdueTitle = `Approval overdue — ${formName}`;
    cy.visit("/app/ai-center");
    // AI Center's list sits inside <main>'s own overflow-y-auto scroll
    // container (see Layout.jsx), not the window — Cypress's default
    // auto-scroll doesn't reliably resolve a nested scrollable ancestor,
    // so scroll explicitly before asserting visibility rather than relying
    // on it, especially since the target card can be buried under leftover
    // cards from previous runs.
    cy.contains(overdueTitle).scrollIntoView().should("be.visible");
    cy.contains("HIGH").should("be.visible");

    // 11-12. HR clicks Notify Approver, from the actual recommendation card.
    cy.contains(overdueTitle)
      .scrollIntoView()
      .closest('[class*="shadow-card"]')
      .within(() => {
        cy.contains("button", "Notify Approver").click();
        cy.contains(/Notified \d+ approver/).should("be.visible");
      });

    // 13-14. Manager approves (via the API — the approve/reject control
    // lives on the form's response detail view, already covered by other
    // suites; the point here is AI Center reacting to the resulting event,
    // not re-testing the approve button itself).
    cy.then(() =>
      cy.request({
        method: "POST",
        url: `/api/forms/${formId}/responses/${responseId}/workflow/decide`,
        headers: { Authorization: `Bearer ${authToken}` },
        body: { action: "approve" },
      })
    );

    // 15-16. The recommendation disappears from the default (Needs
    // Attention / OPEN) view WITHOUT a page reload — this is the actual
    // claim under test: store.js's db:change socket broadcast reaching
    // useLiveCollection(["recommendations"]) in AiCenter.jsx.
    cy.contains(overdueTitle, { timeout: 10000 }).should("not.exist");

    // Confirm it really did resolve, not just scroll out of view — same
    // recommendation shows up under the Resolved tab, now with a decision
    // badge (who resolved it, when, and — since this was the Rule Engine's
    // own auto-resolve — why) instead of looking identical to an Open card
    // with the buttons stripped off.
    cy.contains("button", "Resolved").click();
    cy.contains(overdueTitle)
      .scrollIntoView()
      .closest('[class*="shadow-card"]')
      .within(() => {
        cy.contains("RESOLVED").should("be.visible");
        cy.contains("Resolved by System").should("be.visible");
        cy.contains("Manager approved the request.").should("be.visible");
      });
  });

  it("supports priority filtering, search, sort, and bulk resolve from the AI Center toolbar", () => {
    // A second, independent overdue approval on the same form — the first
    // test's recommendation is already Resolved by this point, so this one
    // needs its own fixture to exercise the Open-tab toolbar against.
    let secondResponseId;
    const secondTitle = `Approval overdue — ${formName}`;

    cy.request({ method: "POST", url: `/api/forms/${formId}/responses`, body: { answers: { f_reason: "Second overdue request" } } }).then((res) => {
      secondResponseId = res.body.id;
      cy.task("backdateEvent", { type: "approval.pending", entityId: secondResponseId, hoursAgo: 72 }).then(() =>
        // Explicit trigger via the runRuleEngine-equivalent path used here:
        // another submission on the same form, same reasoning as the first
        // test (nothing re-runs rules on a timer).
        cy.request({ method: "POST", url: `/api/forms/${formId}/responses`, body: { answers: { f_reason: "Trigger evaluation" } } })
      );
    });

    cy.visit("/app/ai-center");

    // Priority filter row is its own scope — the status tabs above it also
    // have an "All" button with the exact same text, so an unscoped
    // cy.contains("button", "All") is ambiguous and would as likely hit
    // the status tab (switching off the Open tab entirely) as the
    // priority pill.
    const priorityRow = () => cy.contains("span", "Priority:").parent();

    // Priority filter: HIGH keeps it visible, LOW hides it.
    priorityRow().contains("button", "🔥 HIGH").click();
    cy.contains(secondTitle).scrollIntoView().should("be.visible");
    priorityRow().contains("button", "ℹ️ LOW").click();
    cy.contains(secondTitle).should("not.exist");
    priorityRow().contains("button", "All").click();

    // Search: a term that doesn't match this form hides it; the form's own
    // name finds it again.
    cy.get('input[type="search"]').type("no-such-form-exists");
    cy.contains(secondTitle).should("not.exist");
    cy.get('input[type="search"]').clear().type(formName);
    cy.contains(secondTitle).scrollIntoView().should("be.visible");

    // Sort: switching between Highest Risk and Newest shouldn't error and
    // the item should stay visible either way — this is a smoke test for
    // the control actually driving a request, not an assertion on exact
    // DOM order (every top-level Card on this page — Business Health, the
    // AI Summary, each recommendation — shares the same "shadow-card"
    // class, so there's no reliable "first recommendation card" selector
    // to assert position against without adding a test hook to the app).
    cy.get("select").select("newest");
    cy.contains(secondTitle).scrollIntoView().should("be.visible");
    cy.get("select").select("score");
    cy.contains(secondTitle).scrollIntoView().should("be.visible");

    // Bulk resolve: select via the card's checkbox, then use the toolbar
    // action instead of the per-card Resolve button.
    cy.contains(secondTitle)
      .closest('[class*="shadow-card"]')
      .within(() => {
        cy.get('input[type="checkbox"]').check();
      });
    cy.contains("1 selected").should("be.visible");
    cy.contains("button", "Resolve Selected").click();
    cy.contains(secondTitle, { timeout: 10000 }).should("not.exist");

    cy.contains("button", "Resolved").click();
    cy.contains(secondTitle).scrollIntoView().should("be.visible");
  });
});
