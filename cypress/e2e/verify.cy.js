describe("Landing page", () => {
  it("renders new hero, social proof, comparison, features, industries, security, pricing, FAQ, final CTA", () => {
    cy.visit("/");
    cy.contains("Build AI Forms. Automate Everything After Submission.").should("be.visible");
    cy.contains("Forms are just the beginning.").should("be.visible");
    cy.contains("Built for teams that want to spend less time managing forms").should("be.visible");
    cy.contains("See the Difference").should("be.visible");
    cy.contains("Create manually").should("be.visible");
    cy.contains("Why Businesses Switch to Flowora").should("be.visible");
    cy.contains("One Platform.").should("be.visible");
    cy.contains("Everything Your Team Needs").should("be.visible");
    cy.contains("How Flowora compares").should("be.visible");
    cy.contains("After someone submits a form…").should("be.visible");
    cy.contains("Google Forms").should("be.visible");
    cy.contains("Typeform").should("be.visible");
    cy.contains("Perfect for").should("be.visible");
    cy.contains("Administration").should("be.visible");
    cy.contains("Security & Reliability").should("be.visible");
    cy.contains("Encrypted in transit and at rest").should("be.visible");
    cy.contains("Save Hours Every Week").scrollIntoView().should("be.visible");
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
    cy.contains("Stop Managing Work Across Five Different Tools").scrollIntoView().should("be.visible");
    cy.screenshot("landing-full", { capture: "fullPage" });
  });

  // The hero mock and the "How it works" chip row (Landing.jsx) share one
  // timer (useSyncedPhase) cycling Prompt (2s) → AI Creates Assets (2s) →
  // Workflow Executes (3s) → Business Updates (3s) = 10s/loop, looping
  // continuously. Rather than assert exact timing (flaky against real
  // browser/CI speed), just confirm every phase's distinctive content
  // shows up somewhere within one full loop — proves the animation
  // actually cycles through the real story instead of being stuck on one
  // frame.
  it("hero mock cycles through Prompt → AI Creates Assets → Workflow Executes → Business Updates", () => {
    cy.visit("/");
    cy.contains("See Flowora build an approval-ready form in seconds").should("be.visible");

    // Chip row — all four phase labels present.
    cy.contains("Prompt").should("be.visible");
    cy.contains("AI Creates Assets").should("be.visible");
    cy.contains("Workflow Executes").should("be.visible");
    cy.contains("Business Updates").should("be.visible");

    // Prompt panel — always visible regardless of phase.
    cy.contains("Create an Employee Leave Process").should("be.visible");

    // AI Creates Assets panel — appears once the loop reaches "assets"
    // and stays visible through every later phase (10s loop, so a 12s
    // timeout covers a full cycle either way).
    cy.contains("Form", { timeout: 12000 }).should("be.visible");
    cy.contains("Approval", { timeout: 12000 }).should("be.visible");
    cy.contains("Task", { timeout: 12000 }).should("be.visible");

    // Right-hand panel — Workflow Executes then Business Updates content,
    // each within one full loop.
    cy.contains("Employee submits", { timeout: 12000 }).should("be.visible");
    cy.contains("Manager approves", { timeout: 12000 }).should("be.visible");
    cy.contains("CRM updated", { timeout: 12000 }).should("be.visible");
    cy.contains("Process complete", { timeout: 12000 }).should("be.visible");
  });
});

describe("Login", () => {
  it("logs in as master admin", () => {
    cy.visit("/login");
    cy.contains("Welcome back").should("be.visible");
    cy.get('input[type="email"]').first().type("admin@pipeline.com");
    cy.get('input[type="password"]').first().type("admin123");
    cy.get('button[type="submit"]').click();
    cy.url({ timeout: 15000 }).should("include", "/app");
    cy.screenshot("logged-in-dashboard");
  });

  it("shows an inline, field-specific error instead of one message at the end of the form", () => {
    cy.visit("/login");
    cy.get('input[type="email"]').first().type("not-an-email");
    cy.get('input[type="password"]').first().type("whatever123");
    cy.get('button[type="submit"]').click();
    // The error renders directly under the Email field, not after the
    // Google button / trust badges at the bottom of the card.
    cy.contains("Enter a valid email address.").should("be.visible");
  });
});

describe("Signup", () => {
  it("no longer collects a Company field, and validates email/password inline", () => {
    cy.visit("/signup");
    cy.contains("Create your Flowora account").should("be.visible");
    cy.contains("label", "Company").should("not.exist");

    cy.get('input[type="email"]').first().type("not-an-email");
    cy.contains("button", "Create account").click();
    cy.contains("Enter a valid email address.").should("be.visible");
  });
});

describe("Forms — Add Form page", () => {
  beforeEach(() => {
    cy.session("admin", () => {
      cy.visit("/login");
      cy.get('input[type="email"]').first().type("admin@pipeline.com");
      cy.get('input[type="password"]').first().type("admin123");
      cy.get('button[type="submit"]').click();
      cy.url({ timeout: 15000 }).should("include", "/app");
    });
  });

  it("opens the Add Form page with AI card, search, category filter, popular section", () => {
    cy.visit("/app/forms");
    // "New Form" is a grouped dropdown now (Forms.jsx's NewFormMenu), not
    // a direct link — every Forms-group entry lands on /app/forms/new
    // either way, so "Create Blank Form" gets there same as before.
    cy.contains("button", "New Form").click();
    cy.contains("button", "Create Blank Form").click();
    cy.url({ timeout: 15000 }).should("include", "/app/forms/new");

    cy.contains("h1", "Add Form").should("be.visible");
    cy.contains("Generate with AI").should("be.visible");
    cy.contains("Browse Templates").should("be.visible");
    cy.contains("Start from Scratch").should("be.visible");
    // "Import from File" (added below the AI/Browse/Scratch grid) pushes
    // Popular Templates further down — below the fold on a 900px-tall
    // viewport, same reasoning as the category filter scroll below.
    cy.contains("Popular Templates").scrollIntoView().should("be.visible");

    // Category filter is a <select>, not pill buttons. It's below the AI
    // card / Browse Templates / Start from Scratch grid and the Popular
    // Templates strip, so on a 900px-tall viewport it's below the fold —
    // scrollIntoView() first, since plain .should("be.visible") doesn't
    // auto-scroll the way .click()/.type() do.
    cy.get('input[placeholder="Search templates by name or category…"]').scrollIntoView().should("be.visible");
    cy.get("select").contains("option", "All Categories").should("exist");
    cy.screenshot("add-form-page");

    // search — asserting the "N templates" results count (not just that
    // "Customer Feedback" text is somewhere on the page) because the AI
    // card's static "Try these examples" row has its own unrelated
    // "Customer Feedback" prompt-suggestion button that's always visible
    // regardless of whether search actually filtered anything.
    cy.get('input[placeholder="Search templates by name or category…"]').type("feedback");
    cy.contains(/^\d+ templates?$/).should("be.visible");
    cy.get('input[placeholder="Search templates by name or category…"]').clear();
  });

  it("creates a form from a template and lands in the 3-column builder with field Logic/Appearance", () => {
    cy.visit("/app/forms/new");
    cy.intercept("POST", "/api/forms/from-template").as("createForm");

    // Click the Popular Templates strip card specifically — the AI card's
    // "Try these examples" row (EXAMPLE_PROMPTS) also has a "Customer
    // Feedback" button (a prompt suggestion, not a template) rendered
    // earlier in the DOM, so an unscoped cy.contains("button", ...) matches
    // that one instead and just fills the AI textarea.
    cy.contains("h2", "Popular Templates").closest(".mb-8").within(() => {
      cy.contains("button", "Customer Feedback").click();
    });

    // Template selection creates the form immediately (name defaults to
    // "Untitled Form") and redirects straight into the builder — there's
    // no intermediate "name your form" step anymore. Assert the request
    // actually succeeded before checking the URL, so a real backend/plan
    // error surfaces here instead of a confusing "URL never changed".
    cy.wait("@createForm").its("response.statusCode").should("be.oneOf", [200, 201]);
    cy.url({ timeout: 15000 }).should("match", /\/app\/forms\/.+\/build/);

    // The horizontal Build/Workflow/Settings/Responses/Analytics tab bar
    // this used to be doesn't exist anymore — per the comment at the top
    // of pages/app/forms/[id]/build.jsx, the canvas builder is now its own
    // page, and Workflow/Settings/Responses/Analytics are separate
    // per-form quick-link panels/pages reached from the Forms list instead.
    // Assert what's actually on this page's header now.
    cy.contains("a", "Back to Forms").should("be.visible");
    cy.contains("button", "Preview").should("be.visible");
    cy.contains("button", "Publish").should("be.visible");

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

    // Appearance: real per-field width control (no longer a "coming soon" stub)
    cy.contains("Appearance").click();
    cy.contains("label", "Width").parent().find("select").should("be.visible");
    cy.contains("Auto (default for field type)").should("exist");
    cy.contains("Full width").should("exist");

    // Logic: conditional show/hide (no longer a "coming soon" stub)
    cy.contains("Logic").click();
    cy.contains("Only show this field conditionally").should("be.visible");
    cy.contains("label", "Only show this field conditionally").find("input[type=checkbox]").check({ force: true });
    cy.contains("Show this field if").should("be.visible");
    cy.contains("Condition").should("be.visible");
    cy.contains("Equals").should("exist");
    cy.contains("Contains").should("exist");
    cy.contains("Is empty").should("exist");

    // Permissions: still an intentional stub — not built yet
    cy.contains("Permissions").click();
    cy.contains("Field-level visibility/edit permissions are coming soon").should("be.visible");

    // floating save button fixed position
    cy.contains("button", "Save Changes").should("be.visible");
    cy.screenshot("form-builder-3col");
  });

  it("creates a form with 4 Short Text fields, saves it, then deletes it from the Forms list", () => {
    // Every template-created (and blank-started) form defaults to the same
    // "Untitled Form" name, so rename it to something unique here — that's
    // how we reliably find (and only delete) this exact form later on the
    // Forms list, which can otherwise be full of same-named forms from
    // other test runs.
    const uniqueName = `Cypress 4-Field Form ${Date.now()}`;

    cy.visit("/app/forms/new");
    cy.intercept("POST", "/api/forms/from-template").as("createBlank");
    cy.contains("button", "Start Blank Form").click();
    cy.wait("@createBlank").its("response.statusCode").should("be.oneOf", [200, 201]);
    cy.url({ timeout: 15000 }).should("match", /\/app\/forms\/.+\/build/);

    // Blank forms start with zero fields — add exactly 4 Short Text ones.
    cy.contains("button", "Short Text").click();
    cy.contains("button", "Short Text").click();
    cy.contains("button", "Short Text").click();
    cy.contains("button", "Short Text").click();
    cy.get(".cursor-pointer").should("have.length", 4);

    // Rename the form (click the title to edit it in place).
    cy.contains("h1", "Untitled Form").click();
    cy.focused().clear().type(`${uniqueName}{enter}`);

    cy.intercept("PUT", "/api/forms/*").as("saveForm");
    cy.contains("button", "Save Changes").click();
    cy.wait("@saveForm").its("response.statusCode").should("eq", 200);
    cy.screenshot("form-builder-4-fields-saved");

    // Go to the Forms list, find this exact form by its unique name, and
    // delete it — scoped to its own row so this can't accidentally hit
    // another form's Delete button.
    cy.visit("/app/forms");
    cy.contains("a", uniqueName).should("be.visible");
    // Delete now lives inside the row's "⋯ More" menu (Forms.jsx's
    // FormMoreMenu) instead of being its own always-visible button.
    cy.contains("a", uniqueName).closest("div.px-5").within(() => {
      cy.get('[title="More actions"]').click();
      cy.contains("button", "Delete").click();
    });
    cy.contains(`Delete "${uniqueName}"?`).should("be.visible");
    cy.contains("button", "Delete").click();
    cy.contains("a", uniqueName).should("not.exist");
  });
});
