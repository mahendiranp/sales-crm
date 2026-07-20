// Tasks — gated by the same "tasks" module toggle as Meetings (see
// meetings.cy.js's docstring for the two checks Layout.jsx's isModuleOn()
// makes: platform-wide release AND this tenant's own settings.modules.tasks).
describe("Tasks", () => {
  let authToken;
  let tasksEnabled = false;

  before(() => {
    cy.request({ method: "GET", url: "/api/platform" }).then((platformRes) => {
      const released = platformRes.body.releasedModules || {};
      if (!released.tasks) {
        cy.log("Tasks isn't released platform-wide — skipping this suite.");
        return;
      }
      cy.request({
        method: "POST",
        url: "/api/auth/login",
        body: { email: "premium1@flowora.test", password: "password123" },
      }).then((loginRes) => {
        authToken = loginRes.body.token;
        cy.request({
          url: "/api/settings",
          headers: { Authorization: `Bearer ${authToken}` },
        }).then((settingsRes) => {
          tasksEnabled = settingsRes.body.modules?.tasks !== false;
          if (!tasksEnabled) {
            cy.log(
              "premium1@flowora.test doesn't have the tasks/Work module enabled — skipping this suite.",
            );
          }
        });
      });
    });
  });

  beforeEach(function () {
    if (!tasksEnabled) this.skip();
    cy.session("premium1-tasks", () => {
      cy.visit("/login");
      cy.get('input[type="email"]').first().type("premium1@flowora.test");
      cy.get('input[type="password"]').first().type("password123");
      cy.get('button[type="submit"]').click();
      cy.url({ timeout: 15000 }).should("include", "/app");
    });
  });

  afterEach(function () {
    if (!authToken) return;
    cy.request({
      url: "/api/tasks",
      headers: { Authorization: `Bearer ${authToken}` },
    }).then((res) => {
      res.body
        .filter((t) => t.title.startsWith("Cypress "))
        .forEach((t) =>
          cy.request({
            method: "DELETE",
            url: `/api/tasks/${t.id}`,
            headers: { Authorization: `Bearer ${authToken}` },
            failOnStatusCode: false,
          }),
        );
    });
    cy.request({
      url: "/api/leads",
      headers: { Authorization: `Bearer ${authToken}` },
    }).then((res) => {
      (res.body || [])
        .filter((l) => l.name.startsWith("Cypress Task Lead"))
        .forEach((l) =>
          cy.request({
            method: "DELETE",
            url: `/api/leads/${l.id}`,
            headers: { Authorization: `Bearer ${authToken}` },
            failOnStatusCode: false,
          }),
        );
    });
  });

  it("creates a task linked to a lead, and the lead shows it back", () => {
    const leadName = `Cypress Task Lead ${Date.now()}`;
    const taskTitle = `Cypress Follow up with ${leadName}`;

    cy.request({
      method: "POST",
      url: "/api/leads",
      headers: { Authorization: `Bearer ${authToken}` },
      body: { name: leadName, mobile: "9812345690" },
    }).then((leadRes) => {
      const leadId = leadRes.body.id;

      cy.intercept("POST", "/api/tasks").as("createTask");
      cy.visit("/app/tasks");
      cy.contains("button", "Add Task").click();
      cy.contains("label", "Task").find("input").type(taskTitle);
      cy.contains("label", "Related Lead (optional)")
        .find("select")
        .select(leadName);
      cy.contains("button", "Save Task").click();
      cy.wait("@createTask").then(({ response }) => {
        expect(response.statusCode).to.eq(201);
        expect(response.body.entityType).to.eq("lead");
        expect(response.body.entityId).to.eq(leadId);
      });

      // Tasks.jsx's card shows "Lead: <name>" under the title when the
      // task is entityType "lead" — this is what "the lead should display
      // the task" maps to in this app (there's no lead detail page with
      // its own task list to check the other direction from).
      cy.contains(taskTitle).scrollIntoView().should("be.visible");
      cy.contains(taskTitle)
        .parents()
        .contains(`Lead: ${leadName}`)
        .should("be.visible");
    });
  });

  it("marks a task Completed and Timeline records the completion", () => {
    const title = `Cypress Complete Me ${Date.now()}`;

    cy.request({
      method: "POST",
      url: "/api/tasks",
      headers: { Authorization: `Bearer ${authToken}` },
      body: { title, priority: "Medium" },
    }).then((taskRes) => {
      cy.visit("/app/tasks");
      cy.contains(title).scrollIntoView().should("be.visible");

      // The checkbox on the card completes it directly — same control the
      // card's onComplete quick-action uses.
      cy.contains(title)
        .parents(".group")
        .first()
        .within(() => {
          cy.get('button[class*="rounded-full"]').first().click();
        });

      cy.contains("button", "Completed").click();
      cy.contains(title).scrollIntoView().should("be.visible");

      // task.status_changed's payload is {from, to} with no title (see
      // routes/tasks.js) — the Timeline can only render the generic
      // "Task status changed" label for it. Verified precisely via the
      // API: the right event, for the right task, really was recorded.
      cy.request({
        url: "/api/events?type=task.status_changed",
        headers: { Authorization: `Bearer ${authToken}` },
      }).then((eventsRes) => {
        const event = eventsRes.body.items.find(
          (e) => e.entityId === taskRes.body.id,
        );
        expect(event).to.exist;
        expect(event.payload.to).to.eq("Completed");
      });
      cy.visit("/app/timeline");
      cy.contains("Task status changed").should("be.visible");
    });
  });

  it("filters to only overdue tasks", () => {
    const overdueTitle = `Cypress Overdue ${Date.now()}`;
    const futureTitle = `Cypress Not Overdue ${Date.now()}`;
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString();

    cy.request({
      method: "POST",
      url: "/api/tasks",
      headers: { Authorization: `Bearer ${authToken}` },
      body: { title: overdueTitle, dueDate: yesterday },
    });
    cy.request({
      method: "POST",
      url: "/api/tasks",
      headers: { Authorization: `Bearer ${authToken}` },
      body: { title: futureTitle, dueDate: nextWeek },
    });

    cy.visit("/app/tasks");
    cy.contains(overdueTitle).should("be.visible");
    cy.contains(futureTitle).should("be.visible");

    // The due-date filter select is the one whose first option reads "Any
    // Due Date" — distinct from the Priority and Assignee selects next to
    // it, which don't share that option text.
    cy.contains("option", "Any Due Date").parent().select("Overdue");
    cy.contains(overdueTitle).should("be.visible");
    cy.contains(futureTitle).should("not.exist");
  });
});
