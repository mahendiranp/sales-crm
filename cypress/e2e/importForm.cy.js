// Covers the "Import from File" flow on the Add Form page (routes/import.js):
// upload a PDF/Word/image, AI (Gemini/Anthropic, whichever the account has
// configured) extracts a title + fields, and a real Draft form is created
// and opened in the builder — all in one request, no queue/polling (see
// the MVP scope discussed when this feature was built).
describe("Import a form from a file", () => {
  beforeEach(() => {
    cy.session("admin", () => {
      cy.visit("/login");
      cy.get('input[type="email"]').first().type("admin@pipeline.com");
      cy.get('input[type="password"]').first().type("admin123");
      cy.get('button[type="submit"]').click();
      cy.url({ timeout: 15000 }).should("include", "/app");
    });
    cy.visit("/app/forms/new");
  });

  // Note: the happy-path import tests (PDF/Word/image → real form) are
  // intentionally not covered here — they'd call the real Gemini API
  // (GEMINI_API_KEY), spending real quota on every CI run. Only the
  // validation paths below are covered, none of which reach the AI provider.

  it("rejects a disallowed file type with a clear error, and stays on the page", () => {
    cy.intercept("POST", "**/api/import").as("importFile");

    cy.get('input[type="file"]').selectFile("cypress/fixtures/not-a-form.txt", { force: true });

    cy.wait("@importFile").then(({ response }) => {
      expect(response.statusCode).to.eq(400);
    });
    cy.contains("Upload a PDF, Word (.docx), or image").scrollIntoView().should("be.visible");
    cy.url().should("include", "/app/forms/new");
  });

  it("rejects a file over the 20MB limit", () => {
    cy.intercept("POST", "**/api/import").as("importFile");

    // Built in-memory rather than as a committed fixture — a 20MB+ binary
    // has no business living in the repo just to exercise this one check.
    cy.get('input[type="file"]').selectFile(
      { contents: Cypress.Buffer.alloc(21 * 1024 * 1024), fileName: "huge.pdf", mimeType: "application/pdf" },
      { force: true }
    );

    cy.wait("@importFile", { timeout: 30000 }).then(({ response }) => {
      expect(response.statusCode).to.eq(413);
    });
    cy.contains("over the 20MB limit").scrollIntoView().should("be.visible");
  });

  it("requires authentication at the API level", () => {
    cy.request({ method: "POST", url: "/api/import", failOnStatusCode: false }).then((res) => {
      expect(res.status).to.eq(401);
    });
  });
});
