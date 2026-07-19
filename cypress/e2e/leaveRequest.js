// Step definitions for leaveRequest.feature. State is shared across steps
// via module-level variables (not `this`) — this file backs exactly one
// scenario, run once per execution, same reasoning aiCenter.cy.js used for
// its plain-Mocha version of this same walkthrough (kept alongside this
// file as the non-Gherkin equivalent; see that file's header comment).
//
// "the recommendation engine evaluates business rules" is triggered via
// the `runRuleEngine` task (see cypress.config.js), which calls the real
// backend evaluateRules(accountId) directly against the same database the
// running backend process uses — this is deliberately more explicit than
// aiCenter.cy.js's approach (submitting an unrelated second response to
// piggyback on forms.js's event-triggered evaluation), because this
// scenario's own wording calls out rule evaluation as its own step.
const { Given, When, Then, After } = require("@badeball/cypress-cucumber-preprocessor");

let authToken;
let accountId;
let formId;
let formName;
let responseId;
let overdueTitle;
let healthScoreAfterFlag;

Given("an employee leave form is published with an approval workflow", () => {
  formName = `Cucumber Leave Request ${Date.now()}`;

  cy.session("hr-leave-request", () => {
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
      accountId = user.accountId || user.id;
      // The approver is "role: admin", which always resolves to the
      // account owner (see workflowEngine.js) — the same HR/admin session
      // above doubles as "the manager" later in this scenario.
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

When("an employee submits a leave request", () => {
  // Public, unauthenticated route — no session for the employee.
  cy.request({ method: "POST", url: `/api/forms/${formId}/responses`, body: { answers: { f_reason: "Family event" } } }).then((res) => {
    responseId = res.body.id;
  });
});

Then("an approval request should be created", () => {
  cy.request({ url: `/api/forms/${formId}/responses/${responseId}/workflow`, headers: { Authorization: `Bearer ${authToken}` } }).then((res) => {
    expect(res.body.status).to.eq("pending");
  });
});

When("the approval remains pending for more than 48 hours", () => {
  cy.task("backdateEvent", { type: "approval.pending", entityId: responseId, hoursAgo: 72 });
});

When("the recommendation engine evaluates business rules", () => {
  cy.task("runRuleEngine", accountId);
});

Then("an {string} recommendation should be generated", (title) => {
  expect(title).to.eq("Approval Overdue");
  // The rule names the specific form in its title (see approvalPending48h.js)
  // so two simultaneously-open "overdue approval" recommendations are
  // distinguishable — both to a real user and to this test, which shouldn't
  // assert against whichever "Approval overdue" card happens to be first
  // in the DOM if more than one is open.
  overdueTitle = `Approval overdue — ${formName}`;
  cy.request({ url: "/api/recommendations?status=OPEN", headers: { Authorization: `Bearer ${authToken}` } }).then((res) => {
    const created = res.body.items.find((r) => r.rule === "approval.pending.48h" && r.entityId === responseId);
    expect(created, "an Approval overdue recommendation for this response").to.exist;
    expect(created.priority).to.eq("HIGH");
    expect(created.title).to.eq(overdueTitle);
  });
});

When("the HR user opens the AI Center", () => {
  cy.visit("/app/ai-center");
});

Then("the recommendation should be visible under {string}", (tabLabel) => {
  expect(tabLabel).to.eq("Open");
  // "Open" is the OPEN tab and AI Center's default — no tab click needed,
  // but asserting the tab's own label is visible alongside the card ties
  // the assertion to the scenario's wording, not just an implicit default.
  // cy.contains does a substring match by default, so this still matches
  // now that the tab also renders a live count, e.g. "Open (11)".
  cy.contains("button", "Open").should("have.class", "bg-primary");
  // AI Center's list sits inside <main>'s own overflow-y-auto scroll
  // container (see Layout.jsx), not the window — and the target card can
  // be pushed well below the fold by other open recommendations (this
  // account accumulates them across runs, since deleting a form doesn't
  // clean up the recommendations tied to it — see the After hook below).
  // Cypress's default auto-scroll doesn't always resolve a nested
  // scrollable ancestor correctly, so this scrolls explicitly before
  // asserting visibility rather than relying on that.
  cy.contains(overdueTitle).scrollIntoView().should("be.visible");
});

When("the HR user selects {string}", (actionLabel) => {
  expect(actionLabel).to.eq("Notify Approver");
  cy.contains(overdueTitle)
    .scrollIntoView()
    .closest('[class*="shadow-card"]')
    .within(() => {
      cy.contains("button", "Notify Approver").click();
    });
});

Then("a notification email should be sent to the approver", () => {
  cy.contains(overdueTitle)
    .scrollIntoView()
    .closest('[class*="shadow-card"]')
    .within(() => {
      cy.contains(/Notified \d+ approver/).should("be.visible");
    });

  cy.request({ url: "/api/recommendations/health", headers: { Authorization: `Bearer ${authToken}` } }).then((res) => {
    healthScoreAfterFlag = res.body.score;
  });
});

When("the manager approves the leave request", () => {
  cy.request({
    method: "POST",
    url: `/api/forms/${formId}/responses/${responseId}/workflow/decide`,
    headers: { Authorization: `Bearer ${authToken}` },
    body: { action: "approve" },
  });
});

Then("the recommendation should be marked as {string}", (status) => {
  expect(status).to.eq("Resolved");
  // Live, with no reload — resolveRecommendation()'s write reaches the
  // page via the same db:change socket broadcast every other collection
  // write already emits (see store.js), which useLiveCollection listens on.
  cy.contains(overdueTitle, { timeout: 10000 }).should("not.exist");
  cy.contains("button", "Resolved").click();
  // Resolved/Dismissed cards now carry a decision badge (who, when, why)
  // instead of looking identical to an Open card with the buttons removed.
  cy.contains(overdueTitle)
    .scrollIntoView()
    .closest('[class*="shadow-card"]')
    .within(() => {
      cy.contains("RESOLVED").should("be.visible");
      cy.contains("Resolved by System").should("be.visible");
    });
});

Then("the Business Health score should improve", () => {
  cy.request({ url: "/api/recommendations/health", headers: { Authorization: `Bearer ${authToken}` } }).then((res) => {
    expect(res.body.score).to.be.greaterThan(healthScoreAfterFlag);
  });
});

// Deletes the test form AND dismisses any recommendation still tied to it —
// without the second half, an orphaned OPEN recommendation (e.g. left by a
// run that failed before reaching the approve step) drags down Business
// Health forever, since nothing else ever notices its underlying form is
// gone, and it also permanently clutters the AI Center list for every
// subsequent run (which is exactly what made the previous run's "element
// is being clipped" failure worse than it needed to be).
After(() => {
  if (!formId || !authToken) return;
  cy.request({ url: "/api/recommendations?status=OPEN", headers: { Authorization: `Bearer ${authToken}` } })
    .then((res) => res.body.items.filter((r) => r.payload?.formId === formId))
    .then((orphaned) => {
      orphaned.forEach((r) => {
        cy.request({ method: "PATCH", url: `/api/recommendations/${r.id}/dismiss`, headers: { Authorization: `Bearer ${authToken}` } });
      });
    });
  cy.request({ method: "DELETE", url: `/api/forms/${formId}`, headers: { Authorization: `Bearer ${authToken}` }, failOnStatusCode: false });
});
