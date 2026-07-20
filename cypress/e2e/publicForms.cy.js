// Covers the anonymous-facing side of Forms: submitting without an account,
// getting a reference ID, emailing yourself a magic link to view the
// response later, and browsing a tenant's published forms without a direct
// link. All three routes (/forms/:id, /claim, /forms/directory/:accountId)
// bypass auth entirely (see PUBLIC_ROUTES in app.js) — this suite never
// logs in as the *respondent*, only as the admin who sets up the form.
describe("Public forms — anonymous submission, magic-link claim, and directory", () => {
  let authToken;
  let accountId;
  let formId;
  const formName = `Cypress Public Form ${Date.now()}`;

  before(() => {
    cy.session("admin", () => {
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

        // Set up via the API directly rather than the multi-step form
        // builder UI — the builder isn't what this suite is testing; a
        // published, field-less form is enough to exercise submit → claim.
        return cy.request({
          method: "POST",
          url: "/api/forms/from-template",
          headers: { Authorization: `Bearer ${authToken}` },
          body: { templateKey: "blank", name: formName },
        });
      })
      .then((res) => {
        formId = res.body.id;
        return cy.request({
          method: "PUT",
          url: `/api/forms/${formId}/publish`,
          headers: { Authorization: `Bearer ${authToken}` },
        });
      });
  });

  after(() => {
    if (!formId) return;
    cy.request({
      method: "DELETE",
      url: `/api/forms/${formId}`,
      headers: { Authorization: `Bearer ${authToken}` },
      failOnStatusCode: false,
    });
  });

  it("submits anonymously and shows a reference ID", () => {
    cy.visit(`/forms/${formId}`);
    cy.contains("button", "Submit").click();
    cy.contains("Thanks for your submission!").should("be.visible");
    cy.contains("Reference ID").should("be.visible");
    cy.contains(/FR-[A-Z2-9]{6}/).should("be.visible");
  });

  it("emails a magic link and the link opens the saved response", () => {
    let referenceId;
    cy.intercept("POST", "**/api/forms/*/responses/*/send-link").as("sendLink");

    cy.visit(`/forms/${formId}`);
    cy.contains("button", "Submit").click();
    cy.contains(/FR-[A-Z2-9]{6}/)
      .invoke("text")
      .then((text) => {
        referenceId = text.match(/FR-[A-Z2-9]{6}/)[0];
      });

    const email = `cypress+${Date.now()}@example.com`;
    cy.get('input[type="email"]').type(email);
    cy.contains("button", "Send").click();

    cy.wait("@sendLink").then(({ response }) => {
      expect(response.statusCode).to.eq(200);
      // Dev-only convenience field (no real SMTP in this environment) —
      // see POST /:id/responses/:responseId/send-link in routes/forms.js.
      expect(response.body.devClaimLink).to.be.a("string");
      const token = new URL(response.body.devClaimLink).searchParams.get(
        "token",
      );

      cy.contains("for a link to view this later.").should("be.visible");
      cy.visit(`/claim?token=${token}`);
      cy.contains(formName).should("be.visible");
      cy.contains(referenceId).should("be.visible");
    });
  });

  it("rejects a token that doesn't exist", () => {
    cy.visit(
      "/claim?token=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd",
    );
    cy.contains("Link invalid or expired").should("be.visible");
  });

  it("rejects a real claim token once its 24h TTL has actually expired", () => {
    cy.intercept("POST", "**/api/forms/*/responses/*/send-link").as("sendLink");

    cy.visit(`/forms/${formId}`);
    cy.contains("button", "Submit").click();
    cy.contains(/FR-[A-Z2-9]{6}/).should("be.visible");

    const email = `cypress+expiry+${Date.now()}@example.com`;
    cy.get('input[type="email"]').type(email);
    cy.contains("button", "Send").click();

    cy.wait("@sendLink").then(({ request, response }) => {
      expect(response.body.devClaimLink).to.be.a("string");
      const token = new URL(response.body.devClaimLink).searchParams.get(
        "token",
      );
      // responseId is the URL segment right before "/send-link".
      const responseId = request.url.match(
        /\/responses\/([^/]+)\/send-link/,
      )[1];

      // Confirm the link is genuinely valid *before* backdating it — this
      // proves the later rejection is really about expiry, not some other
      // reason the token happened to be invalid.
      cy.visit(`/claim?token=${token}`);
      cy.contains(formName).should("be.visible");

      cy.task("expireClaimToken", responseId).then(() => {
        cy.visit(`/claim?token=${token}`);
        cy.contains("Link invalid or expired").should("be.visible");
      });
    });
  });

  it("lists the published form in the account's public forms directory", () => {
    cy.visit(`/forms/directory/${accountId}`);
    cy.contains(formName).should("be.visible");
    cy.contains(formName).click();
    cy.url().should("include", `/forms/${formId}`);
  });

  it("shows an error page for an unknown account id", () => {
    cy.visit("/forms/directory/does-not-exist");
    cy.contains("This page isn't available").should("be.visible");
  });
});
