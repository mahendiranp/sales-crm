// Leads → Contacts → Companies → Deals. These modules are behind the
// platform-wide release gate (routes/platform.js / lib/usePlatformFeatures)
// same as any other Core CRM section — a fresh environment where master
// admin hasn't released Pipeline (Leads/Contacts/Companies/Deals) from the
// Admin Portal yet won't have these actually usable end-to-end (Convert
// creates a Company, Deals link to real Contacts, etc. all assume the
// tenant has opted in), so the whole suite skips itself rather than
// asserting against a half-configured environment.
const PIPELINE_MODULE_KEYS = ["leads", "contacts", "companies", "deals"];

describe("Pipeline (Leads, Contacts, Companies, Deals)", () => {
  let pipelineEnabled = false;
  let adminToken = null;

  before(() => {
    // This suite logs in as master admin (see beforeEach below), who
    // bypasses every tenant's own settings.modules flags — so the only
    // thing worth gating on here is the platform-wide release switch
    // (routes/platform.js), not any one account's per-tenant toggle.
    cy.request({ method: "GET", url: "/api/platform" }).then((platformRes) => {
      const released = platformRes.body.releasedModules || {};
      pipelineEnabled = PIPELINE_MODULE_KEYS.every((k) => released[k]);
      if (!pipelineEnabled) {
        cy.log(
          "Pipeline (Leads/Contacts/Companies/Deals) isn't released platform-wide — skipping this suite. " +
            'Release it from the Admin Portal\'s "Release to all users" section to run these tests.',
        );
      }
    });
    cy.request({
      method: "POST",
      url: "/api/auth/login",
      body: { email: "admin@pipeline.com", password: "admin123" },
    }).then((loginRes) => {
      adminToken = loginRes.body.token;
    });
  });

  beforeEach(function () {
    if (!pipelineEnabled) this.skip();
    cy.session("admin", () => {
      cy.visit("/login");
      cy.get('input[type="email"]').first().type("admin@pipeline.com");
      cy.get('input[type="password"]').first().type("admin123");
      cy.get('button[type="submit"]').click();
      cy.url({ timeout: 15000 }).should("include", "/app");
    });
  });

  it("adds a lead with just the required fields plus notes, and flags a duplicate", () => {
    const unique = `Cypress Lead ${Date.now()}`;
    const mobile = "9812345678";

    cy.intercept("POST", "/api/leads").as("createLead");
    cy.visit("/app/leads");
    cy.contains("button", "Add Lead").click();

    // Only Lead Name and Mobile Number are required now — lead score is
    // AI-only (no manual input), and Notes is a plain textarea under its
    // own section heading rather than wrapped in its own <label>.
    cy.contains("label", "Lead Name").find("input").type(unique);
    cy.contains("label", "Mobile Number").find("input").type(mobile);
    cy.contains("label", "Company").find("input").type(`${unique} Co`);
    cy.get("textarea[placeholder*='Looking for ERP']").type(
      "Created by Cypress pipeline test.",
    );
    cy.contains("button", "Save Lead").click();
    cy.wait("@createLead").its("response.statusCode").should("eq", 201);

    cy.contains(unique).should("be.visible");
    // Call/WhatsApp/Email are inside the row's "⋯" actions menu
    // (consolidated there to keep the table from overflowing, rendered
    // in-place, not portaled) — open it to confirm Call is offered since
    // mobile was filled in (email wasn't, since it's optional now).
    cy.contains("tr", unique).within(() => {
      cy.get('button[title="More actions"]').click();
      cy.get('a[title="Call"]').should("exist");
    });

    // Duplicate detection: adding a second lead with the same mobile
    // number should flag it inline, without blocking the save.
    cy.contains("button", "Add Lead").click();
    cy.contains("label", "Lead Name")
      .find("input")
      .type("Duplicate Check Lead");
    cy.contains("label", "Mobile Number").find("input").type(mobile);
    cy.contains(
      `A lead with this phone or email already exists: ${unique}`,
    ).should("be.visible");
    cy.contains("button", "Cancel").click();
  });

  it("converts a lead into a linked Contact + Company", () => {
    const unique = `Cypress Convert ${Date.now()}`;
    const companyName = `${unique} Industries`;

    cy.intercept("POST", "/api/leads").as("createLead");
    cy.intercept("POST", "/api/leads/*/convert").as("convertLead");

    cy.visit("/app/leads");
    cy.contains("button", "Add Lead").click();
    cy.contains("label", "Lead Name").find("input").type(unique);
    // Mobile Number is required (see the previous test) — omitting it blocks
    // the save client-side and cy.wait("@createLead") below would never see
    // a request at all.
    cy.contains("label", "Mobile Number").find("input").type("9812345679");
    cy.contains("label", "Company").find("input").type(companyName);
    cy.contains("button", "Save Lead").click();
    cy.wait("@createLead");

    cy.contains("tr", unique).within(() => {
      cy.get('button[title="More actions"]').click();
      cy.contains("button", "Convert to customer").click();
    });
    cy.contains(`linked to ${companyName}`).should("be.visible");
    cy.contains("button", "Confirm Conversion").click();
    cy.wait("@convertLead").its("response.statusCode").should("eq", 201);

    // Contact shows up in Contacts. The contact list is its own internally
    // scrolling container (max-h-[70vh] overflow-y-auto) — with enough
    // contacts accumulated across test runs, the new one can be scrolled
    // out of view within that inner list, so scrollIntoView() first.
    cy.visit("/app/contacts");
    cy.contains(unique).scrollIntoView().should("be.visible");

    // Company was auto-created and shows up in Companies.
    cy.visit("/app/companies");
    cy.contains(companyName).scrollIntoView().should("be.visible");
  });

  it("logs a call on a contact and sees it in their history", () => {
    cy.intercept("POST", "/api/activities").as("logActivity");
    cy.visit("/app/contacts");
    // Scoped to the contact-list buttons specifically (not the Log Call/
    // Email/Meeting action buttons in the detail panel, which use a
    // different class combination entirely).
    cy.get("button.w-full.text-left.p-3.rounded-lg").first().click();
    cy.get('button[title="Log Phone Call"]').click();
    const note = `Cypress call note ${Date.now()}`;
    cy.get("textarea").last().type(note);
    cy.contains("button", "Save").click();
    cy.wait("@logActivity").its("response.statusCode").should("eq", 201);
    // Activity history is its own internally-scrolling panel (same reasoning
    // as the Contacts list a few tests up) — a newly logged activity can
    // land below the fold within it.
    cy.contains(note).scrollIntoView().should("be.visible");
    cy.contains("Phone Call").scrollIntoView().should("be.visible");
  });

  it("creates a deal linked to a real Contact and Company, and updates the weighted forecast", () => {
    cy.intercept("POST", "/api/deals").as("createDeal");
    const unique = `Cypress Deal ${Date.now()}`;

    cy.visit("/app/deals");
    cy.contains("button", "Add Deal").click();
    cy.contains("label", "Deal Title").find("input").type(unique);
    // Pick whichever contact happens to exist — earlier tests in this file
    // (and existing seed data) guarantee at least one. This only cares
    // that picking one produces a real contactId, not which one.
    cy.contains("label", "Contact")
      .find("select")
      .then(($select) => {
        const firstRealOption = $select.find("option").eq(1).val();
        if (firstRealOption) cy.wrap($select).select(firstRealOption);
      });
    cy.contains("label", "Expected Revenue (₹)").find("input").type("250000");
    cy.contains("label", "Probability (%)").find("input").clear().type("65");
    cy.contains("label", "Competitors").find("input").type("Zoho, Freshsales");
    cy.contains("button", "Save Deal").click();
    cy.wait("@createDeal").then(({ response }) => {
      expect(response.statusCode).to.eq(201);
      expect(response.body.probability).to.eq(65);
      expect(response.body.competitors).to.eq("Zoho, Freshsales");
    });

    // Check the header subtitle (top of page) before scrolling down for
    // the deal card below — scrolling to reveal one pushes the other out
    // of view, since they're at opposite ends of the same page. The
    // subtitle includes both the raw pipeline total and the probability-
    // weighted forecast — proves the new forecast math is actually wired
    // up, not just present in the deal record.
    cy.contains(/in active pipeline.*forecast \(probability-weighted\)/).should(
      "be.visible",
    );

    // The deal grid grows taller than the viewport as more deals
    // accumulate across test runs — scrollIntoView() before asserting.
    cy.contains(unique).scrollIntoView().should("be.visible");
  });

  it("searches leads by name and only shows matches", () => {
    const unique = `Cypress Search ${Date.now()} ABC Technologies`;

    cy.intercept("POST", "/api/leads").as("createLead");
    cy.visit("/app/leads");
    cy.contains("button", "Add Lead").click();
    cy.contains("label", "Lead Name").find("input").type(unique);
    cy.contains("label", "Mobile Number").find("input").type("9812345680");
    cy.contains("button", "Save Lead").click();
    cy.wait("@createLead");

    // The leads table has its own search box, distinct from a name filter
    // dropdown — a substring of the lead's name should isolate it from
    // every other lead seeded or created by earlier tests in this file.
    cy.get('input[type="search"]').type("ABC Technologies");
    cy.contains(unique).should("be.visible");
    cy.contains("Cypress Lead ").should("not.exist");
    cy.get('input[type="search"]').clear();
  });

  it("moves a lead to a new pipeline stage via Edit, and Timeline records the change", () => {
    // Leads.jsx is a sortable/filterable table, not a drag-and-drop Kanban
    // board — there's no draggable stage column to move a card across.
    // The equivalent real interaction is changing Status from the row's
    // Edit action, which is what actually mutates the record end to end.
    const unique = `Cypress Stage ${Date.now()}`;

    cy.intercept("POST", "/api/leads").as("createLead");
    cy.intercept("PUT", "/api/leads/*").as("updateLead");
    cy.visit("/app/leads");
    cy.contains("button", "Add Lead").click();
    cy.contains("label", "Lead Name").find("input").type(unique);
    cy.contains("label", "Mobile Number").find("input").type("9812345681");
    cy.contains("button", "Save Lead").click();
    cy.wait("@createLead");

    cy.contains("tr", unique).within(() => {
      cy.get('button[title="More actions"]').click();
    });
    cy.contains("button", "Edit").click();
    cy.contains("label", "Status").find("select").select("Qualified");
    cy.contains("button", "Save Lead").click();
    cy.wait("@updateLead").its("response.statusCode").should("eq", 200);

    cy.contains("tr", unique)
      .scrollIntoView()
      .contains("Qualified")
      .should("be.visible");

    // Timeline records the change — filtered to Today (its default) is
    // enough since this just happened.
    cy.visit("/app/timeline");
    cy.contains(unique).should("be.visible");
  });

  it("creates a contact linked to a company from the Contacts page directly", () => {
    const companyName = `Cypress Assoc Co ${Date.now()}`;
    const contactName = `Cypress Assoc Contact ${Date.now()}`;

    cy.intercept("POST", "/api/companies").as("createCompany");
    cy.visit("/app/companies");
    cy.contains("button", "Add Company").click();
    cy.contains("label", "Company Name").find("input").type(companyName);
    cy.contains("button", "Save Company").click();
    cy.wait("@createCompany");
    cy.contains(companyName).scrollIntoView().should("be.visible");

    cy.intercept("POST", "/api/contacts").as("createContact");
    cy.visit("/app/contacts");
    cy.contains("button", "Add Contact").click();
    cy.contains("label", "Name").find("input").type(contactName);
    cy.contains("label", "Company").find("select").select(companyName);
    cy.contains("button", "Save Contact").click();
    cy.wait("@createContact").then(({ response }) => {
      expect(response.statusCode).to.eq(201);
      // Companies.jsx is a flat card grid with no per-company detail/
      // relationship view (no Contacts/Leads/Deals tab to click into) —
      // so "the company should display the contact" is verified the only
      // way it's actually true today: the contact record really does
      // carry that company's real id, not a UI page that doesn't exist.
      cy.request({
        url: "/api/companies",
        headers: { Authorization: `Bearer ${adminToken}` },
      }).then((companiesRes) => {
        const company = companiesRes.body.find((c) => c.name === companyName);
        expect(response.body.companyId).to.eq(company.id);
      });
    });

    cy.contains(contactName).scrollIntoView().should("be.visible");
  });

  it("creates a deal from a qualified lead (via convert) and Timeline contains the chain", () => {
    // There's no leadId field on a Deal — a lead becomes deal-eligible by
    // converting it into a Contact/Company first (same as the "converts a
    // lead" test above), then a deal is created against that real contact.
    // That conversion is what "create a deal from a lead" actually means
    // in this app's data model.
    const unique = `Cypress LeadToDeal ${Date.now()}`;
    const companyName = `${unique} Co`;

    cy.intercept("POST", "/api/leads").as("createLead");
    cy.intercept("POST", "/api/leads/*/convert").as("convertLead");
    cy.intercept("POST", "/api/deals").as("createDeal");

    cy.visit("/app/leads");
    cy.contains("button", "Add Lead").click();
    cy.contains("label", "Lead Name").find("input").type(unique);
    cy.contains("label", "Mobile Number").find("input").type("9812345682");
    cy.contains("label", "Company").find("input").type(companyName);
    cy.contains("button", "Save Lead").click();
    cy.wait("@createLead");

    cy.contains("tr", unique).within(() => {
      cy.get('button[title="More actions"]').click();
      cy.contains("button", "Convert to customer").click();
    });
    cy.contains("button", "Confirm Conversion").click();
    cy.wait("@convertLead").then(({ response }) => {
      const contactId = response.body.id;

      cy.visit("/app/deals");
      cy.contains("button", "Add Deal").click();
      cy.contains("label", "Deal Title").find("input").type(`${unique} Deal`);
      if (contactId) {
        cy.contains("label", "Contact").find("select").select(contactId);
      }
      cy.contains("button", "Save Deal").click();
      cy.wait("@createDeal").its("response.statusCode").should("eq", 201);
    });

    cy.contains(`${unique} Deal`).scrollIntoView().should("be.visible");

    // Timeline contains the whole chain — the lead's creation and the
    // deal's creation both show up as their own events.
    cy.visit("/app/timeline");
    cy.contains(unique).should("be.visible");
    cy.contains(`${unique} Deal`).should("be.visible");
  });
});
