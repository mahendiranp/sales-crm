describe("Landing page", () => {
  it("renders new hero, problem, comparison, industries, testimonials, pricing, FAQ, final CTA", () => {
    cy.visit("/");
    cy.contains("Forms that don't just collect responses").should("be.visible");
    cy.contains("Still using Google Forms?").should("be.visible");
    cy.contains("No approval workflow").should("be.visible");
    cy.contains("How Flowora compares").should("be.visible");
    cy.contains("Google Forms").should("be.visible");
    cy.contains("Typeform").should("be.visible");
    cy.contains("Perfect for").should("be.visible");
    cy.contains("Loved by teams").should("be.visible");
    cy.contains("Reduced HR paperwork by 70%").should("be.visible");
    cy.get("#pricing").within(() => {
      cy.contains("Free").should("be.visible");
      cy.contains("Team").should("be.visible");
      cy.contains("Enterprise").should("be.visible");
      cy.contains("For individuals").should("be.visible");
      cy.contains("For growing businesses").should("be.visible");
    });
    cy.get("#faq").within(() => {
      cy.contains("Is Flowora free?").click();
      cy.contains("no credit card required").should("be.visible");
      cy.contains("Can AI build my form?").should("be.visible");
    });
    cy.contains("Build your first AI-powered form in under 60 seconds").should("be.visible");
    cy.screenshot("landing-full", { capture: "fullPage" });
  });
});

describe("Login", () => {
  it("logs in as master admin", () => {
    cy.visit("/login");
    cy.get('input[type="email"], input[name="email"]').first().type("admin@pipeline.com");
    cy.get('input[type="password"], input[name="password"]').first().type("admin123");
    cy.get('button[type="submit"]').click();
    cy.url({ timeout: 15000 }).should("include", "/app");
    cy.screenshot("logged-in-dashboard");
  });
});

describe("Forms — New Form modal", () => {
  beforeEach(() => {
    cy.session("admin", () => {
      cy.visit("/login");
      cy.get('input[type="email"], input[name="email"]').first().type("admin@pipeline.com");
      cy.get('input[type="password"], input[name="password"]').first().type("admin123");
      cy.get('button[type="submit"]').click();
      cy.url({ timeout: 15000 }).should("include", "/app");
    });
  });

  it("opens New Form modal with AI card, search, category pills, popular section", () => {
    cy.visit("/app/forms");
    cy.contains("button", "New Form").click();
    cy.get(".fixed.inset-0.z-50").within(() => {
      cy.contains("Choose a Template").should("be.visible");
      cy.contains("Generate with AI").should("be.visible");
      cy.get('input[placeholder="Search templates…"]').should("be.visible");
      cy.contains("button", "All").should("be.visible");
      cy.contains("Popular").should("be.visible");
      cy.contains("Start from Scratch").should("be.visible");
      cy.contains("Browse Templates").should("be.visible");
    });
    cy.screenshot("new-form-modal");

    cy.get(".fixed.inset-0.z-50").within(() => {
      // category pill filter
      cy.contains("button", "HR").click();
      cy.contains("Job Application").should("be.visible");
      cy.contains("button", "All").click();

      // search
      cy.get('input[placeholder="Search templates…"]').type("feedback");
      cy.contains("Customer Feedback").should("be.visible");
      cy.get('input[placeholder="Search templates…"]').clear();
    });
  });

  it("creates a form from a template and lands in the 3-column builder with new layout", () => {
    cy.visit("/app/forms");
    cy.contains("button", "New Form").click();
    cy.get(".fixed.inset-0.z-50").within(() => {
      cy.contains("Customer Feedback").click();
    });
    cy.get('input[placeholder="e.g. Contact Us"]').clear().type("Cypress Test Form");
    cy.contains("button", "Use Template").click();
    cy.url({ timeout: 15000 }).should("include", "/app/forms");

    // studio tabs
    cy.contains("Build").should("be.visible");
    cy.contains("Workflow").should("be.visible");
    cy.contains("Settings").should("be.visible");
    cy.contains("Responses").should("be.visible");
    cy.contains("Analytics").should("be.visible");

    // field palette icons present (svg inside palette buttons)
    cy.contains("Short Text").parent().find("svg").should("exist");

    // canvas has fields, click one to open properties + collapsible sections
    cy.contains("Field Properties").should("not.exist");
    cy.get(".cursor-pointer").contains("Name").click({ force: true });
    cy.contains("Field Properties").should("be.visible");
    cy.contains("General").should("be.visible");
    cy.contains("Validation").should("be.visible");
    cy.contains("Appearance").should("be.visible");
    cy.contains("Logic").should("be.visible");
    cy.contains("Permissions").should("be.visible");
    cy.contains("Appearance").click();
    cy.contains("Per-field styling options are coming soon").should("be.visible");

    // floating save button fixed position
    cy.contains("button", "Save Changes").should("be.visible");
    cy.screenshot("form-builder-3col");
  });
});
