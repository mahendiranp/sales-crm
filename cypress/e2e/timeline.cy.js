// Timeline is ungated (no `module` key on its nav entry in Layout.jsx) —
// any authenticated user sees it, so this suite doesn't need the
// platform-release / tenant-module double-check the gated suites
// (pipeline.cy.js, tasks.cy.js, meetings.cy.js) do. It logs in as
// premium1@flowora.test anyway, purely so the lead/task/meeting event
// types below are actually creatable (those routes still need Pipeline/
// Tasks to be usable for this tenant).
describe("Activity Timeline", () => {
  let authToken;

  before(() => {
    cy.request({
      method: "POST",
      url: "/api/auth/login",
      body: { email: "premium1@flowora.test", password: "password123" },
    }).then((res) => {
      authToken = res.body.token;
    });
  });

  beforeEach(() => {
    cy.session("premium1-timeline", () => {
      cy.visit("/login");
      cy.get('input[type="email"]').first().type("premium1@flowora.test");
      cy.get('input[type="password"]').first().type("password123");
      cy.get('button[type="submit"]').click();
      cy.url({ timeout: 15000 }).should("include", "/app");
    });
  });

  it("shows a Lead Created event right after creating a lead", () => {
    const name = `Cypress Timeline Lead ${Date.now()}`;
    cy.request({ method: "POST", url: "/api/leads", headers: { Authorization: `Bearer ${authToken}` }, body: { name, mobile: "9812345691" } }).then(
      (leadRes) => {
        cy.visit("/app/timeline");
        cy.contains(`Lead created: ${name}`).should("be.visible");
        cy.request({ method: "DELETE", url: `/api/leads/${leadRes.body.id}`, headers: { Authorization: `Bearer ${authToken}` }, failOnStatusCode: false });
      }
    );
  });

  it("shows a Meeting scheduled event right after scheduling a meeting", () => {
    const title = `Cypress Timeline Meeting ${Date.now()}`;
    cy.request({
      method: "POST",
      url: "/api/meetings",
      headers: { Authorization: `Bearer ${authToken}` },
      body: { title, scheduledStart: new Date(Date.now() + 86400000).toISOString() },
    }).then((meetingRes) => {
      cy.visit("/app/timeline");
      cy.contains(`Meeting scheduled: ${title}`).should("be.visible");
      cy.request({ method: "DELETE", url: `/api/meetings/${meetingRes.body.id}`, headers: { Authorization: `Bearer ${authToken}` }, failOnStatusCode: false });
    });
  });

  it("shows a Task Created event, and completing the task really does record a Task status changed event", () => {
    const title = `Cypress Timeline Task ${Date.now()}`;
    cy.request({ method: "POST", url: "/api/tasks", headers: { Authorization: `Bearer ${authToken}` }, body: { title } }).then((taskRes) => {
      cy.visit("/app/timeline");
      cy.contains(`Task created: ${title}`).should("be.visible");

      cy.request({ method: "PUT", url: `/api/tasks/${taskRes.body.id}`, headers: { Authorization: `Bearer ${authToken}` }, body: { status: "Completed" } }).then(
        () => {
          // task.status_changed's payload carries {from, to}, not a title
          // (see routes/tasks.js) — the Timeline can only render the
          // generic "Task status changed" label for it, with nothing to
          // anchor a title-specific UI match on. Verified precisely via
          // the API instead: the right event, for the right task.
          cy.request({ url: "/api/events?type=task.status_changed", headers: { Authorization: `Bearer ${authToken}` } }).then((eventsRes) => {
            const event = eventsRes.body.items.find((e) => e.entityId === taskRes.body.id);
            expect(event).to.exist;
            expect(event.payload.from).to.eq("Todo");
            expect(event.payload.to).to.eq("Completed");
          });
          cy.contains("Task status changed").should("be.visible");
          cy.request({ method: "DELETE", url: `/api/tasks/${taskRes.body.id}`, headers: { Authorization: `Bearer ${authToken}` }, failOnStatusCode: false });
        }
      );
    });
  });

  it("displays the newest event first", () => {
    const older = `Cypress Timeline Order A ${Date.now()}`;
    const newer = `Cypress Timeline Order B ${Date.now()}`;

    cy.request({ method: "POST", url: "/api/leads", headers: { Authorization: `Bearer ${authToken}` }, body: { name: older, mobile: "9812345692" } }).then(
      (firstRes) => {
        cy.request({ method: "POST", url: "/api/leads", headers: { Authorization: `Bearer ${authToken}` }, body: { name: newer, mobile: "9812345693" } }).then(
          (secondRes) => {
            cy.visit("/app/timeline");
            // Wait for both events to actually be on the page before
            // reading it — cy.contains() retries until it appears (or
            // times out); reading body text with .invoke("text") right
            // after cy.visit() does not retry at all, so it can fire
            // before the async GET /api/events response has rendered,
            // seeing an empty/loading page and finding neither string.
            cy.contains(newer).should("be.visible");
            cy.contains(older).should("be.visible");

            // Both events landed inside the same "Today" group — assert
            // the newer one's DOM position precedes the older one's,
            // rather than just that both exist (already established by
            // the two cy.contains() checks above).
            cy.get("body")
              .invoke("text")
              .then((bodyText) => {
                expect(bodyText.indexOf(newer)).to.be.lessThan(bodyText.indexOf(older));
              });

            cy.request({ method: "DELETE", url: `/api/leads/${firstRes.body.id}`, headers: { Authorization: `Bearer ${authToken}` }, failOnStatusCode: false });
            cy.request({ method: "DELETE", url: `/api/leads/${secondRes.body.id}`, headers: { Authorization: `Bearer ${authToken}` }, failOnStatusCode: false });
          }
        );
      }
    );
  });
});
