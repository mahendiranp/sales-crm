// Forms → Lead auto-creation. Plain submission (response stored, Timeline
// event recorded) is already covered end-to-end by publicForms.cy.js —
// this suite is specifically the createLeadOnSubmit toggle (routes/
// forms.js), which publicForms.cy.js's blank-template fixture doesn't
// exercise since it has no fields to map into a lead at all.
describe("Form → Lead auto-creation", () => {
  let authToken;
  let formId;
  const formName = `Cypress Lead-Gen Form ${Date.now()}`;

  before(() => {
    cy.session("admin-form-to-lead", () => {
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
        // A name field + a phone field is enough for routes/forms.js's
        // best-effort mapping (first text-like field -> name, first phone
        // field -> mobile) to produce a real lead, not just "Website
        // Visitor" with nothing else on it.
        return cy.request({
          method: "POST",
          url: "/api/forms",
          headers: { Authorization: `Bearer ${authToken}` },
          body: {
            name: formName,
            createLeadOnSubmit: true,
            fields: [
              { id: "f_name", type: "text", label: "Your Name" },
              { id: "f_phone", type: "phone", label: "Phone" },
            ],
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
    cy.request({ method: "DELETE", url: `/api/forms/${formId}`, headers: { Authorization: `Bearer ${authToken}` }, failOnStatusCode: false });
  });

  it("creates a lead from a public submission, and it appears in the CRM", () => {
    const visitorName = `Cypress Website Visitor ${Date.now()}`;

    // The submission itself is anonymous (public route, no session) —
    // same as publicForms.cy.js's respondent flow.
    cy.visit(`/forms/${formId}`);
    // The field's label and its input live in sibling wrapper divs, not
    // one nested inside the other (see FieldBlock in pages/forms/[id].jsx)
    // — go up two levels from the label to reach the shared field
    // container both wrappers hang off of.
    cy.contains("label", "Your Name").parent().parent().find("input, textarea").type(visitorName);
    cy.contains("label", "Phone").parent().parent().find("input").type("9812345699");
    cy.contains("button", "Submit").click();
    cy.contains("Thanks for your submission!").should("be.visible");

    // Back as the admin: the lead is real, in the CRM, sourced from this
    // form, not just a response record sitting in the form's inbox.
    cy.request({ url: "/api/leads", headers: { Authorization: `Bearer ${authToken}` } }).then((leadsRes) => {
      const lead = leadsRes.body.find((l) => l.name === visitorName);
      expect(lead).to.exist;
      expect(lead.mobile).to.eq("9812345699");
      expect(lead.source).to.eq(formName);
      cy.request({ method: "DELETE", url: `/api/leads/${lead.id}`, headers: { Authorization: `Bearer ${authToken}` }, failOnStatusCode: false });
    });
  });
});
