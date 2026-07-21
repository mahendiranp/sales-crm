// Content for the SEO feature landing pages (pages/ai-form-builder.jsx,
// pages/pdf-to-form.jsx, etc.), rendered through components/FeatureLandingPage.jsx
// — one reusable template, one data file per page, so adding another page
// never means writing new JSX. Every claim here must match a real,
// shipped capability (see apps/backend/src/routes/import.js and
// workflowEngine.js) — no fabricated integrations.
//
// Shape:
//   slug            — matches the page file / URL, e.g. "ai-form-builder"
//   metaTitle       — 50-60 chars
//   metaDescription — 150-160 chars
//   keywords        — [string]
//   h1, subtitle
//   ctaSecondaryLabel — defaults to "Watch Demo" but actually smooth-scrolls
//     to How It Works on this same page (no demo video exists to link to —
//     this is a real, working interaction, not a dead link)
//   benefits        — [string], 5-8 short bullets
//   supported       — optional [string], "Supported X" chip list
//   differentiators — optional { heading, items: [string] } second bullet block
//   howItWorks      — [string], numbered steps
//   useCases        — [string]
//   faqs            — [{ q, a }]
//   finalCta        — string
//   related         — [{ label, href }] internal links to other feature pages
import { APP_NAME } from "./brand";

export const FEATURE_PAGES = {
  "ai-form-builder": {
    slug: "ai-form-builder",
    metaTitle: "AI Form Builder That Creates Forms in Seconds",
    metaDescription:
      "Generate professional forms with AI from a prompt, PDF, Word doc, image, or existing form — then automate approvals, workflows, and follow-up actions from one platform.",
    keywords: ["AI form builder", "AI form creation", "create with AI", "generate form", "smart form", "prompt to form", "AI assistant", "form builder software"],
    h1: "AI Form Builder That Creates Forms in Seconds",
    subtitle:
      "Create professional forms using AI. Generate forms from a prompt, PDF, Word document, image, or existing form—then automate approvals, workflows, and follow-up actions from one platform.",
    benefits: [
      "Build forms in under 30 seconds from a plain-English description",
      "Import PDFs, Word documents, and images instead of retyping them",
      "Customize every field with a drag-and-drop builder",
      "Automate approvals and email notifications",
      "Collect responses in real time",
      "Connect every submission to your CRM and workflows",
    ],
    supported: ["PDF → Form", "Word → Form", "Image → Form", "Google Forms Import"],
    howItWorks: [
      "Upload your document or describe the form you need.",
      `${APP_NAME} AI extracts fields and builds the form.`,
      "Review and customize the generated form.",
      "Publish and share your form.",
      "Automate approvals and track responses.",
    ],
    useCases: ["HR onboarding", "Customer feedback", "Surveys", "Event registration", "Purchase requests", "Vendor onboarding", "Leave applications", "Inspections"],
    faqs: [
      { q: "Is the AI form builder really free to try?", a: "Yes — the Starter plan is free forever and includes AI-generated forms. No card required." },
      { q: "What can I generate a form from?", a: "A plain-English description, a PDF, a Word (.docx) document, an image (PNG/JPG/WebP), or a Google Form URL." },
      { q: "Can I edit the form after AI generates it?", a: "Yes — every field, validation rule, and layout choice is editable in the drag-and-drop builder before you publish." },
      { q: "Does the AI understand approval workflows?", a: "You describe the workflow (e.g. \"needs manager approval\") and the AI configures the routing — you can still adjust it manually afterward." },
      { q: "What happens to my document after I upload it?", a: "It's processed in memory to extract the form and never stored — see our Privacy Policy for details." },
      { q: "How is this different from a template library?", a: "Templates are a fixed starting point; the AI builder generates fields specific to what you describe or upload, then you can still browse templates too." },
    ],
    finalCta: "Start building AI-powered forms today.",
    related: [
      { label: "PDF to Form", href: "/pdf-to-form" },
      { label: "Approval Workflows", href: "/approval-workflow" },
      { label: "CRM", href: "/crm" },
    ],
  },

  "pdf-to-form": {
    slug: "pdf-to-form",
    metaTitle: "Convert PDF to Online Form with AI",
    metaDescription:
      "Upload any PDF and let Flowora automatically detect questions, fields, checkboxes, and tables to create a fully editable online form in seconds.",
    keywords: ["PDF to form", "convert PDF", "PDF form import", "PDF converter", "generate from PDF", "PDF upload", "pdf to form converter", "convert pdf to online form"],
    h1: "Convert PDF to Online Form with AI",
    subtitle:
      "Upload any PDF and let Flowora automatically detect questions, fields, checkboxes, and tables to create a fully editable online form.",
    benefits: ["No manual retyping of every field", "Preserves the original form's structure", "Edit any field before publishing", "Produces a mobile-friendly form automatically"],
    supported: ["HR forms", "Medical forms", "Government forms", "School forms", "Surveys", "Inspection checklists"],
    differentiators: {
      heading: "Most PDF converters only extract text. Flowora understands:",
      items: ["Checkboxes", "Radio buttons", "Tables", "Dropdowns", "Sections", "Conditional questions"],
    },
    howItWorks: ["Upload PDF.", "AI extracts every field.", "Review the generated form.", "Publish and share it."],
    useCases: ["HR intake forms", "Patient intake forms", "Permit and inspection checklists", "Enrollment forms", "Vendor onboarding paperwork"],
    faqs: [
      { q: "Does this work with scanned PDFs?", a: "Yes — scanned or image-only PDFs are read with AI vision rather than plain text extraction, so checkboxes and handwritten layouts are still detected." },
      { q: "What's the file size limit?", a: "Up to 20MB per PDF." },
      { q: "Will formatting be preserved?", a: "Field structure (sections, options, required fields) carries over; the visual styling is Flowora's own clean form theme, not a pixel copy of the original PDF." },
      { q: "What if the PDF has no fillable fields?", a: "You'll get a clear message rather than a broken import — you can still build the form manually or describe it to the AI instead." },
      { q: "Is my PDF stored after conversion?", a: "No — it's processed in memory for the single import request and discarded." },
    ],
    finalCta: "Convert your first PDF for free.",
    related: [
      { label: "Word to Form", href: "/word-to-form" },
      { label: "Image to Form", href: "/image-to-form" },
      { label: "AI Form Builder", href: "/ai-form-builder" },
    ],
  },

  "word-to-form": {
    slug: "word-to-form",
    metaTitle: "Convert Word Documents to Online Forms",
    metaDescription:
      "Upload a Word (.docx) document and Flowora's AI detects every question and field, turning it into an editable online form in seconds.",
    keywords: ["Word to form", "import Word", "upload DOCX", "DOCX to form", "Word converter", "generate from Word"],
    h1: "Convert Word Documents to Online Forms with AI",
    subtitle:
      "Upload a .docx file and Flowora's AI reads its structure — questions, sections, and options — and rebuilds it as a fully editable online form.",
    benefits: ["Full DOCX support, no re-typing", "Field structure and sections preserved", "Every field is editable after import", "AI detects field types automatically (text, dropdown, checkbox, etc.)"],
    howItWorks: ["Upload your .docx file.", "AI detects fields and builds the form.", "Review and adjust field types.", "Publish and share it."],
    useCases: ["Internal request forms", "Policy acknowledgment forms", "Application forms", "Training sign-up sheets", "Compliance checklists"],
    faqs: [
      { q: "Which Word formats are supported?", a: "Modern .docx files (Word 2007 and later). Legacy .doc files need to be re-saved as .docx first." },
      { q: "What's the file size limit?", a: "Up to 20MB per document." },
      { q: "Does it detect tables and checkboxes?", a: "Yes — tables, checkbox lists, and multi-choice sections are recognized, not just plain paragraphs." },
      { q: "Can I still use the drag-and-drop builder after import?", a: "Yes — the imported form opens directly in the same builder every other form uses." },
    ],
    finalCta: "Convert your first Word document for free.",
    related: [
      { label: "PDF to Form", href: "/pdf-to-form" },
      { label: "Image to Form", href: "/image-to-form" },
      { label: "AI Form Builder", href: "/ai-form-builder" },
    ],
  },

  "image-to-form": {
    slug: "image-to-form",
    metaTitle: "Turn a Photo or Screenshot into an Online Form",
    metaDescription:
      "Snap a photo of a paper form or upload a screenshot — Flowora's AI vision reads the layout and rebuilds it as a fully editable online form.",
    keywords: ["image to form", "import image", "upload image", "scan form", "photo to form", "convert image", "JPG to form", "PNG to form"],
    h1: "Turn a Photo or Screenshot into an Online Form",
    subtitle:
      "Upload a PNG, JPG, or WebP image of a paper form — Flowora's AI vision reads the layout directly, no separate OCR step required.",
    benefits: ["Works from a phone photo, not just a scan", "Reads checkboxes, radio groups, and labels directly from the image", "No manual re-typing", "Produces a mobile-friendly online form"],
    howItWorks: ["Take a photo or upload an image of the form.", "AI vision reads the layout and fields.", "Review and adjust the generated form.", "Publish and share it."],
    useCases: ["Digitizing paper intake forms", "Turning a printed survey into an online one", "Rebuilding a form from a competitor's screenshot", "Field inspection checklists photographed on-site"],
    faqs: [
      { q: "What image formats are supported?", a: "PNG, JPEG, and WebP, up to 20MB." },
      { q: "Does it work with handwritten forms?", a: "It's built for printed layouts (labels, checkboxes, tables); handwritten form structure is read best when the underlying template/labels are printed, even if answers are handwritten." },
      { q: "Can I upload a photo taken on my phone?", a: "Yes — a clear, well-lit photo works the same as a scan." },
      { q: "What if some fields aren't detected correctly?", a: "You can add, remove, or fix any field afterward in the regular form builder — the AI import is a starting point, not a final step." },
    ],
    finalCta: "Turn your first image into a form for free.",
    related: [
      { label: "PDF to Form", href: "/pdf-to-form" },
      { label: "Word to Form", href: "/word-to-form" },
      { label: "AI Form Builder", href: "/ai-form-builder" },
    ],
  },

  "google-forms-import": {
    slug: "google-forms-import",
    metaTitle: "Import Your Google Form in One Click",
    metaDescription:
      "Paste a Google Form link and Flowora imports every question automatically — then add approval workflows and CRM automation on top.",
    keywords: ["Google Forms import", "import Google Form", "Google Forms migration", "migrate Google Forms", "copy Google Form", "Google Form converter"],
    h1: "Import Your Google Form in One Click",
    subtitle:
      "Paste a public Google Form link and Flowora imports every question, option, and required field automatically — no rebuilding from scratch.",
    benefits: ["Import an existing Google Form by URL", "Every question and option carries over", "Keep collecting responses without interruption", "Add approval workflows and automation Google Forms doesn't have"],
    howItWorks: ["Copy your Google Form's share link.", "Paste the URL into Flowora's import screen.", "Review the imported questions.", "Publish and start collecting responses in Flowora."],
    useCases: ["Migrating a survey off Google Forms", "Adding approval routing to an existing intake form", "Bringing a form into your CRM workflow", "Rebranding a form with your own domain and branding"],
    faqs: [
      { q: "Does this work with any Google Form?", a: "It works with public/shareable Google Form links. Forms restricted to \"specific people\" can't be read without being made link-shareable first." },
      { q: "Will my existing Google Form responses come over too?", a: "No — only the form's questions/structure import. Existing responses stay in Google Forms; new responses go through Flowora going forward." },
      { q: "What does Flowora add that Google Forms doesn't have?", a: "Multi-step approval workflows, an AI assistant for editing the form afterward, and direct CRM lead creation from submissions." },
      { q: "Is the import free?", a: "Yes, importing a form is included on every plan, including the free Starter plan." },
    ],
    finalCta: "Import your Google Form for free.",
    related: [
      { label: "Typeform Import", href: "/typeform-import" },
      { label: "Tally Import", href: "/tally-import" },
      { label: "Approval Workflows", href: "/approval-workflow" },
    ],
  },

  "typeform-import": {
    slug: "typeform-import",
    metaTitle: "Migrate from Typeform, Rebuilt with AI",
    metaDescription:
      "Bring your Typeform questions into Flowora and rebuild them in minutes with AI — then add approval workflows Typeform doesn't offer.",
    keywords: ["Typeform import", "Typeform alternative", "Typeform migration", "migrate from Typeform"],
    h1: "Moving from Typeform? Rebuild in Minutes with AI",
    subtitle:
      "There's no one-click Typeform importer yet — but you don't need to rebuild by hand either. Paste your existing questions into Flowora's AI and it drafts the whole form for you.",
    benefits: [
      "Describe or paste your existing Typeform questions — AI builds the matching form",
      "Faster than manually recreating each field",
      "Add approval workflows and CRM automation Typeform doesn't have",
      "No rebuilding logic jumps or branching by hand — describe the flow and AI configures it",
    ],
    howItWorks: [
      "Open your Typeform and copy its questions (or describe the form you want).",
      "Paste that into Flowora's AI Form Builder prompt.",
      "AI generates the matching fields — review and adjust them.",
      "Publish and start collecting responses in Flowora.",
    ],
    useCases: ["Customer surveys", "Lead capture forms", "Event registration", "Feedback forms currently built in Typeform"],
    faqs: [
      { q: "Is there an automatic Typeform importer?", a: "Not yet — Typeform requires an API key/OAuth connection we haven't built. The fastest path today is pasting your questions into the AI builder, which is usually quicker than it sounds for most forms." },
      { q: "Can Flowora match Typeform's one-question-at-a-time style?", a: "Flowora forms currently render as a single scrollable form rather than one-question-per-screen — worth checking if that layout is a hard requirement for you before migrating." },
      { q: "What do I gain by switching?", a: "Multi-level approval routing, an AI assistant for edits, and direct CRM lead creation from every submission — none of which Typeform offers natively." },
    ],
    finalCta: "Start rebuilding your Typeform with AI — free.",
    related: [
      { label: "Tally Import", href: "/tally-import" },
      { label: "AI Form Builder", href: "/ai-form-builder" },
      { label: "Approval Workflows", href: "/approval-workflow" },
    ],
  },

  "tally-import": {
    slug: "tally-import",
    metaTitle: "Migrate from Tally, Rebuilt with AI",
    metaDescription:
      "Bring your Tally form questions into Flowora and rebuild them in minutes with AI — then add approval workflows and CRM integration.",
    keywords: ["Tally import", "Tally alternative", "Tally migration", "migrate from Tally"],
    h1: "Moving from Tally? Rebuild in Minutes with AI",
    subtitle:
      "There's no one-click Tally importer yet — paste your existing questions into Flowora's AI Form Builder and it drafts the matching form for you.",
    benefits: [
      "Describe or paste your existing Tally questions — AI builds the matching form",
      "Faster migration than rebuilding field-by-field",
      "Add multi-level approval workflows Tally doesn't offer",
      "Every submission can create or update a CRM record automatically",
    ],
    howItWorks: [
      "Open your Tally form and copy its questions (or describe the form you want).",
      "Paste that into Flowora's AI Form Builder prompt.",
      "AI generates the matching fields — review and adjust them.",
      "Publish and start collecting responses in Flowora.",
    ],
    useCases: ["Feedback forms", "Internal request forms", "Waitlists and signups", "Simple surveys currently built in Tally"],
    faqs: [
      { q: "Is there an automatic Tally importer?", a: "Not yet — like Typeform, Tally's own form data needs an API connection we haven't built. Pasting your questions into the AI builder is the fastest path today." },
      { q: "What does Flowora add on top of a Tally-style form?", a: "Multi-step approval routing, an AI assistant for ongoing edits, and CRM integration — every submission can automatically create a Lead." },
      { q: "Is migrating free?", a: "Yes — rebuilding your form with the AI builder is included on the free Starter plan." },
    ],
    finalCta: "Start rebuilding your Tally form with AI — free.",
    related: [
      { label: "Typeform Import", href: "/typeform-import" },
      { label: "AI Form Builder", href: "/ai-form-builder" },
      { label: "Workflow Automation", href: "/workflow-automation" },
    ],
  },

  "approval-workflow": {
    slug: "approval-workflow",
    metaTitle: "Approval Workflow Software for Forms",
    metaDescription:
      "Route form submissions through multi-level approval chains automatically — email notifications, full approval history, and an audit trail included.",
    keywords: ["approval workflow software", "approval workflow tool", "multi-level approval", "form approval automation"],
    h1: "Turn Any Form into an Approval Workflow",
    subtitle:
      "Every submission can route through a multi-level approval chain automatically — with email notifications, a full decision history, and an audit trail, no separate tool required.",
    benefits: [
      "Multi-level approval chains (e.g. Employee → Manager → HR)",
      "Automatic email notifications to the current approver",
      "A complete approval history on every response",
      "An audit trail of every decision, timestamped and attributed",
      "Conditional routing based on the submission's own answers",
    ],
    howItWorks: [
      "Build or import your form.",
      "Define who approves it and in what order.",
      "A submission routes to the first approver automatically.",
      "Each decision (approve/reject) notifies the next step or the submitter.",
      "Review the full history and audit trail anytime.",
    ],
    useCases: ["Purchase requests", "Leave/time-off approvals", "Expense reimbursements", "Vendor onboarding sign-off", "Policy exception requests"],
    faqs: [
      { q: "How many approval levels can I set up?", a: "As many sequential steps as your process needs — a request can move through several approvers in order before it's considered fully approved." },
      { q: "Do approvers get notified automatically?", a: "Yes — the current step's approver is emailed automatically, and can also be notified again with a manual reminder if a decision is overdue." },
      { q: "Can routing depend on the submission's answers?", a: "Yes — conditional routing (e.g. \"amounts over $500 also need Finance approval\") is configurable per workflow." },
      { q: "Is there a record of who approved or rejected, and when?", a: "Yes — every decision is logged with the approver's name, the decision, and a timestamp, visible on the response's own history." },
      { q: "Does this require a separate approvals tool?", a: "No — approval workflows are built into the same forms platform, not a bolt-on integration." },
    ],
    finalCta: "Set up your first approval workflow for free.",
    related: [
      { label: "Workflow Automation", href: "/workflow-automation" },
      { label: "CRM", href: "/crm" },
      { label: "AI Form Builder", href: "/ai-form-builder" },
    ],
  },

  "workflow-automation": {
    slug: "workflow-automation",
    metaTitle: "Workflow Automation for Form Submissions",
    metaDescription:
      "Automatically route approvals, create CRM records, send notifications, and log every step the moment a form is submitted — no extra tools needed.",
    keywords: ["workflow automation", "form automation", "business process automation", "automate approvals"],
    h1: "Automate What Happens After a Form Is Submitted",
    subtitle:
      "A form submission shouldn't be the end of the process. Flowora can route it for approval, create a CRM record, notify the right people, and log every step automatically.",
    benefits: [
      "Route submissions through an approval chain automatically",
      "Create or update a CRM Lead directly from a submission",
      "Notify approvers and submitters by email at each step",
      "Log every action to a searchable activity timeline",
      "No separate automation tool or Zapier-style integration required",
    ],
    howItWorks: [
      "A form is submitted.",
      "Flowora checks whether it needs approval and routes it if so.",
      "If configured, a CRM Lead is created or updated from the submission.",
      "Approvers and submitters are notified by email as the decision moves forward.",
      "Every step is recorded on the Activity Timeline.",
    ],
    useCases: ["Lead capture forms that create CRM records automatically", "Purchase requests that need Finance sign-off", "Onboarding forms that kick off a task checklist", "Support/ticket forms that need a manager decision"],
    faqs: [
      { q: "What actually happens automatically after submission?", a: "Depending on how the form is configured: approval routing, a new CRM Lead, and email notifications to the right people — all without manual follow-up." },
      { q: "Can a submission update my CRM?", a: "Yes — a form can be set to create a Lead on submission, so the data doesn't just sit in a response list." },
      { q: "Is this a visual workflow builder like Zapier?", a: "No — it's built-in, form-specific automation (approval routing, CRM linking, notifications) configured per form, not a general-purpose automation canvas." },
      { q: "Where can I see what happened after a form was submitted?", a: "The Activity Timeline records every event — submission, approval decisions, and any CRM record created — in order." },
    ],
    finalCta: "Automate your first workflow for free.",
    related: [
      { label: "Approval Workflows", href: "/approval-workflow" },
      { label: "CRM", href: "/crm" },
      { label: "AI Form Builder", href: "/ai-form-builder" },
    ],
  },

  crm: {
    slug: "crm",
    metaTitle: "CRM Built Around Your Forms",
    metaDescription:
      "Track leads, contacts, companies, and deals in one CRM that's directly connected to your forms — every submission can become a lead automatically.",
    keywords: ["CRM software", "sales CRM", "lead management CRM", "free CRM"],
    h1: "The CRM That's Actually Connected to Your Forms",
    subtitle:
      "Most CRMs and form builders are separate tools you have to wire together. Flowora's CRM lives next to your forms — a submission can become a lead without a single integration.",
    benefits: [
      "Contact, company, and deal management in one place",
      "Lead tracking from first submission to close",
      "A sales pipeline you can move deals through by stage",
      "Tasks and meetings linked to the records they're about",
      "An activity timeline showing everything that happened, in order",
      "AI insights on leads and responses",
    ],
    howItWorks: [
      "A form submission comes in.",
      "It can automatically create a Lead in the CRM.",
      "Your team works the lead — tasks, meetings, notes, and pipeline stage.",
      "Everything is visible on one activity timeline, from submission to close.",
    ],
    useCases: ["Sales lead capture", "Customer onboarding", "Partner/vendor relationship tracking", "Support request tracking", "Event and webinar follow-up"],
    faqs: [
      { q: "Do I need to connect my form builder to my CRM separately?", a: "No — a Flowora form can create a CRM Lead directly on submission, with no separate integration to configure." },
      { q: "What does the CRM track?", a: "Leads, Contacts, Companies, Deals, Tasks, and Meetings, plus an activity timeline tying them together." },
      { q: "Is the CRM free to use?", a: "Yes — CRM features are included on the free Starter plan, with higher limits on paid plans." },
      { q: "Can I still use my forms without the CRM?", a: "Yes — creating a Lead from a submission is optional per form, not required." },
    ],
    finalCta: "Start using the CRM for free.",
    related: [
      { label: "Approval Workflows", href: "/approval-workflow" },
      { label: "Workflow Automation", href: "/workflow-automation" },
      { label: "AI Form Builder", href: "/ai-form-builder" },
    ],
  },
};
