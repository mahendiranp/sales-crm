// Meetings — core module: create via the Add Meeting modal (with a
// non-Lead "Related To" target, since that's the one thing the old
// Lead-only picker couldn't do), see it in the List view, switch to the
// Calendar view and find it on today's cell, then drive the detail
// drawer (notes, an AI-free "action item" that creates a real linked
// Task, and marking it Completed with an Outcome) — which per
// Meetings.jsx's isSettled() logic should move it out of the Upcoming
// tab into Past even though its scheduledStart is still in the future.
//
// Gated the same way Layout.jsx gates the nav item itself: platform-wide
// release of the "tasks" module (Meetings reuses that release key, see
// Layout.jsx's NAV_SECTIONS) AND this tenant's own settings.modules.tasks
// toggle — both have to be on, same two checks isModuleOn() makes.
describe("Meetings", () => {
  let authToken;
  let meetingsEnabled = false;

  before(() => {
    cy.request({ method: "GET", url: "/api/platform" }).then((platformRes) => {
      const released = platformRes.body.releasedModules || {};
      if (!released.tasks) {
        cy.log(
          'Meetings (reuses the "tasks" release key) isn\'t released platform-wide — skipping this suite.',
        );
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
          meetingsEnabled = settingsRes.body.modules?.tasks !== false;
          if (!meetingsEnabled) {
            cy.log(
              "premium1@flowora.test doesn't have the tasks/Work module enabled — skipping this suite.",
            );
          }
        });
      });
    });
  });

  beforeEach(function () {
    if (!meetingsEnabled) this.skip();
    cy.session("premium1-meetings", () => {
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
      url: "/api/meetings",
      headers: { Authorization: `Bearer ${authToken}` },
    }).then((res) => {
      res.body
        .filter((m) => m.title.startsWith("Cypress "))
        .forEach((m) =>
          cy.request({
            method: "DELETE",
            url: `/api/meetings/${m.id}`,
            headers: { Authorization: `Bearer ${authToken}` },
            failOnStatusCode: false,
          }),
        );
    });
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
  });

  it("creates a meeting linked to a Deal (not just a Lead), lists it, and finds it on today's calendar cell", () => {
    const title = `Cypress Meeting ${Date.now()}`;

    // A real Deal to link against — "Related To" isn't Lead-only anymore.
    cy.request({
      method: "POST",
      url: "/api/deals",
      headers: { Authorization: `Bearer ${authToken}` },
      body: {
        title: `Cypress Deal ${Date.now()}`,
        value: 50000,
        stage: "New Lead",
      },
    }).then((dealRes) => {
      const dealName = dealRes.body.title;

      // Today, a couple hours from now, so it lands in the Calendar
      // view's "today" cell regardless of what hour the suite runs at.
      const start = new Date();
      start.setHours(start.getHours() + 2, 0, 0, 0);
      const pad = (n) => String(n).padStart(2, "0");
      const localValue = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}T${pad(start.getHours())}:${pad(start.getMinutes())}`;

      cy.intercept("POST", "/api/meetings").as("createMeeting");
      cy.visit("/app/meetings");
      cy.contains("button", "Add Meeting").click();

      cy.contains("label", "Title").find("input").type(title);
      cy.contains("label", "Start").find("input").type(localValue);
      cy.contains("label", "Related To (optional)").within(() => {
        cy.contains("button", "Deal").click();
        cy.get("select").select(dealName);
      });
      cy.contains("button", "Save Meeting").click();
      cy.wait("@createMeeting").its("response.statusCode").should("eq", 201);

      // List view — the linked Deal's name shows under the title instead
      // of a hardcoded "Lead: …" line.
      cy.contains(title).should("be.visible");
      cy.contains(title)
        .parent()
        .contains(`Deal: ${dealName}`)
        .should("be.visible");

      // Calendar view — Month mode, today's cell shows the meeting.
      cy.get('button[title="Calendar view"]').click();
      cy.contains(title).should("be.visible");

      cy.request({
        method: "DELETE",
        url: `/api/deals/${dealRes.body.id}`,
        headers: { Authorization: `Bearer ${authToken}` },
        failOnStatusCode: false,
      });
    });
  });

  it("adds a note, creates a linked action-item task, and marking it Completed moves it out of Upcoming", () => {
    const title = `Cypress Drawer Meeting ${Date.now()}`;
    const actionTaskTitle = `Cypress Action Item ${Date.now()}`;
    const start = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(); // a few days out

    cy.request({
      method: "POST",
      url: "/api/meetings",
      headers: { Authorization: `Bearer ${authToken}` },
      body: { title, scheduledStart: start, meetingType: "Sales Demo" },
    }).then((meetingRes) => {
      const meetingId = meetingRes.body.id;

      cy.visit("/app/meetings");
      cy.contains(title).click();

      // Notes — the input and its "Add" button share a parent, which
      // scopes the click away from the unrelated "+ Add Meeting" header
      // button (its text also contains the substring "Add").
      cy.get('input[placeholder="Add a note…"]')
        .type("Discussed pricing and next steps.")
        .parent()
        .contains("button", "Add")
        .click();
      // The drawer has its own sticky header (Meetings.jsx: "sticky top-0
      // z-10") inside its scrollable panel. Cypress's default pre-action
      // scroll positions a target flush at the very top edge of that
      // scroll container, landing it directly under the sticky header —
      // real content, genuinely covered on screen at that exact scroll
      // offset, not a false positive. A real user scrolling normally
      // never sees this (nothing overlaps in normal document flow at
      // rest); it only happens at this specific auto-scrolled position.
      // Nudge the scroll target up past the header's height before
      // asserting visibility.
      cy.contains("Discussed pricing and next steps.")
        .scrollIntoView({ offset: { top: -80, left: 0 } })
        .should("be.visible");

      // Action item — creates a real Task linked back to this meeting,
      // not a checklist line on the meeting itself.
      cy.get('input[placeholder="e.g. Send proposal"]')
        .type(actionTaskTitle)
        .parent()
        .contains("button", "Add")
        .click();

      // Outcome + Status: Completed with a Won outcome. Both selects PATCH
      // the same /api/meetings/:id endpoint (one per onChange) — wait for
      // both by index so the second cy.wait() can't resolve against the
      // *first* (Outcome=Won) request and let the test move on before the
      // Status=Completed one — the one this test actually depends on —
      // has actually finished.
      cy.intercept("PATCH", "/api/meetings/*").as("patchMeeting");
      cy.contains("label", "Outcome").find("select").select("Won");
      cy.wait("@patchMeeting");
      cy.contains("label", "Status").find("select").select("Completed");
      cy.wait("@patchMeeting");

      // Confirm the status change actually persisted server-side before
      // testing what the list does with it — decouples "did the Status
      // select really save" from "does the Upcoming/Past split work,"
      // which were previously tangled together in one assertion chain.
      cy.request({
        url: `/api/meetings/${meetingId}`,
        headers: { Authorization: `Bearer ${authToken}` },
      }).then((getRes) => {
        expect(getRes.body.status).to.eq("Completed");
      });

      // Fresh, isolated visit — no drawer, no prior page state to carry
      // over. Assert the page itself really loaded (the heading) before
      // asserting anything about its contents, so a failure here points
      // at "navigation/load didn't finish" instead of masquerading as
      // "the tab button doesn't exist."
      cy.visit("/app/meetings");
      cy.contains("h1", "Meetings").should("be.visible");

      // Defensive: if any meeting's detail drawer ended up open on this
      // fresh visit (e.g. a stray ?open=<id> deep link), its full-screen
      // backdrop sits on top of the Upcoming/Past tabs and hides them
      // without removing them from the DOM — close it before asserting.
      cy.get("body").then(($body) => {
        if ($body.find('button[title="Close"]').length) {
          cy.get('button[title="Close"]').click({ force: true });
        }
      });

      // Even though scheduledStart is days in the future, a Completed
      // meeting is settled — it should have left the Upcoming tab.
      cy.contains("button", "Upcoming", { timeout: 10000 })
        .should("be.visible")
        .click();
      cy.contains(title).should("not.exist");
      cy.contains("button", "Past").click();
      cy.contains(title).should("be.visible");

      // The action-item task really was created and really is linked.
      cy.request({
        url: "/api/tasks",
        headers: { Authorization: `Bearer ${authToken}` },
      }).then((tasksRes) => {
        const task = tasksRes.body.find(
          (t) =>
            t.title === actionTaskTitle &&
            t.entityType === "meeting" &&
            t.entityId === meetingId,
        );
        expect(task).to.exist;
        expect(task.entityType).to.eq("meeting");
        expect(task.entityId).to.eq(meetingId);
        cy.request({
          method: "DELETE",
          url: `/api/tasks/${task.id}`,
          headers: { Authorization: `Bearer ${authToken}` },
          failOnStatusCode: false,
        });
      });
    });
  });

  it("accepting an invitation sets the participant's own response to Accepted", () => {
    const title = `Cypress Invite Meeting ${Date.now()}`;

    cy.request({
      method: "POST",
      url: "/api/meetings",
      headers: { Authorization: `Bearer ${authToken}` },
      body: {
        title,
        scheduledStart: new Date(Date.now() + 86400000).toISOString(),
      },
    }).then(() => {
      cy.visit("/app/meetings");
      cy.contains(title).click();

      // The organizer is auto-Accepted at creation (see routes/meetings.js)
      // — Decline first so clicking Accept is a real, observable state
      // change rather than a no-op against an already-Accepted badge.
      // Same sticky-header offset as the notes test above — the
      // Participants section sits high enough in the drawer that Cypress's
      // pre-click auto-scroll lands it flush under the sticky header.
      cy.contains("button", "Decline").click();
      cy.contains("span", "Declined")
        .scrollIntoView({ offset: { top: -80, left: 0 } })
        .should("be.visible");
      cy.contains("button", "Accept").click();
      cy.contains("span", "Accepted")
        .scrollIntoView({ offset: { top: -80, left: 0 } })
        .should("be.visible");
    });
  });
});
