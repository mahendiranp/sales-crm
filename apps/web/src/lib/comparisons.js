// Data for /compare/[slug] pages. Each entry is one full comparison page —
// only add a slug here once its content has been fact-checked against the
// competitor's actual current pricing/features (claims about a real
// competitor that turn out to be wrong or stale are worse for trust than
// not having the page at all).
//
// Shape:
//   name          — competitor's display name, e.g. "Google Forms"
//   tagline       — one-line summary shown under the H1
//   summary       — 2-3 sentence honest framing (not a sales pitch)
//   features      — [{ label, us: bool|string, them: bool|string }]
//   pricingUs     — short string, e.g. "Free forever (Starter) — ₹999/mo (Growth)"
//   pricingThem   — short string
//   chooseThemIf  — string, honest "pick the competitor when..." framing
//   chooseUsIf    — string
//   faqs          — [{ q, a }]
import { APP_NAME } from "./brand";

export const COMPARISONS = {
  "google-forms": {
    name: "Google Forms",
    tagline: `${APP_NAME} vs Google Forms — which form builder is right for you?`,
    summary:
      "Google Forms is free, familiar, and great for quick surveys inside Google Workspace. It isn't built for approval routing, automation, or business workflows — that's the gap Flowora fills.",
    features: [
      { label: "Free plan", us: "Yes (Starter)", them: "Yes" },
      { label: "Drag-and-drop builder", us: true, them: true },
      { label: "Conditional logic", us: true, them: true },
      { label: "Approval workflows", us: true, them: false },
      { label: "AI-assisted form building", us: true, them: false },
      { label: "WhatsApp delivery", us: true, them: false },
      { label: "Custom branding", us: true, them: "Limited" },
      { label: "Custom domain", us: "Coming soon", them: false },
      { label: "Response export (CSV/Excel)", us: true, them: true },
      { label: "Google Workspace integration", us: false, them: true },
    ],
    pricingUs: "Free forever (Starter) — ₹999/mo for Growth (workflows, WhatsApp, AI)",
    pricingThem: "Free, included with any Google account",
    chooseThemIf: "You just need a quick, free survey and already live in Google Workspace.",
    chooseUsIf: "You need submissions to route through an approval chain, get delivered over WhatsApp, or feed a CRM instead of just a spreadsheet.",
    faqs: [
      {
        q: "Is Flowora really free?",
        a: `Yes — the Starter plan is free forever: up to 3 forms and 100 responses/month. No card required.`,
      },
      {
        q: "Can I import my existing Google Form?",
        a: "There's no automatic importer yet — you'd rebuild the form in Flowora's builder, which usually takes a few minutes for a typical form.",
      },
      {
        q: `What does ${APP_NAME} do that Google Forms can't?`,
        a: "Multi-step approval routing (e.g. Employee → Manager → HR), an AI assistant that builds fields from a description, and delivering the form as a WhatsApp conversation instead of a web link.",
      },
    ],
  },
  // TODO before publishing: verify current pricing/features directly against
  // each competitor's live pricing page, then fill in and add the slug to
  // getStaticPaths in pages/compare/[slug].jsx.
  // "typeform": { ... },
  // "jotform": { ... },
  // "tally": { ... },
  // "fillout": { ... },
};
