// Structural layout presets for the public form card — distinct from
// FORM_THEMES (which only sets page background/accent color). A layout
// controls the card's corners, shadow, border, spacing density, and label
// styling, applied both in the builder canvas (Forms.jsx) and the public
// form page (pages/forms/[id].jsx) via getLayoutStyleClasses() below, so
// what you see while building matches what respondents see.
// `key` keeps its original evocative internal name (Ledger, Tribunal, …)
// so saved forms/URLs never need migrating; `name` is the user-facing
// label — kept descriptive of the actual visual style, not a document
// metaphor, per feedback that names like "Tribunal" vs "Registry" gave
// users no way to guess what they'd look like without clicking each one.
// `recommended: true` marks the single default surfaced first in the UI.
export const FORM_LAYOUTS = [
  { key: "formal-standard", name: "Standard", category: "classic", recommended: true, corners: "sm", shadow: "sm", border: true, density: "cozy", labelStyle: "plain" },
  { key: "formal-registry", name: "Classic", category: "classic", corners: "sm", shadow: "none", border: true, density: "cozy", labelStyle: "plain" },
  { key: "formal-brief", name: "Minimal", category: "minimal", corners: "none", shadow: "none", border: true, density: "compact", labelStyle: "plain" },
  { key: "formal-ledger", name: "Compact", category: "minimal", corners: "none", shadow: "sm", border: true, density: "compact", labelStyle: "uppercase" },
  { key: "formal-memo", name: "Sharp", category: "minimal", corners: "sm", shadow: "none", border: true, density: "compact", labelStyle: "uppercase" },
  { key: "formal-statute", name: "Plain", category: "minimal", corners: "none", shadow: "none", border: true, density: "compact", labelStyle: "plain" },
  { key: "formal-charter", name: "Professional", category: "business", corners: "sm", shadow: "lg", border: false, density: "cozy", labelStyle: "plain" },
  { key: "formal-dossier", name: "Corporate", category: "business", corners: "none", shadow: "sm", border: true, density: "cozy", labelStyle: "uppercase" },
  { key: "formal-council", name: "Executive", category: "business", corners: "sm", shadow: "lg", border: true, density: "cozy", labelStyle: "uppercase" },
  { key: "formal-tribunal", name: "Formal", category: "business", corners: "sm", shadow: "sm", border: false, density: "cozy", labelStyle: "uppercase" },

  { key: "fancy-marquee", name: "Modern", category: "modern", corners: "lg", shadow: "lg", border: true, density: "cozy", labelStyle: "bold-large" },
  { key: "fancy-lantern", name: "Warm", category: "modern", corners: "lg", shadow: "sm", border: false, density: "cozy", labelStyle: "bold-large" },
  { key: "fancy-glow", name: "Glow", category: "modern", corners: "lg", shadow: "sm", border: false, density: "spacious", labelStyle: "bold-large" },
  { key: "fancy-bloom", name: "Soft", category: "rounded", corners: "lg", shadow: "lg", border: false, density: "spacious", labelStyle: "bold-large" },
  { key: "fancy-carnival", name: "Playful", category: "rounded", corners: "full", shadow: "lg", border: false, density: "spacious", labelStyle: "bold-large" },
  { key: "fancy-confetti", name: "Rounded", category: "rounded", corners: "full", shadow: "sm", border: false, density: "spacious", labelStyle: "plain" },
  { key: "fancy-parade", name: "Vivid", category: "rounded", corners: "full", shadow: "lg", border: false, density: "cozy", labelStyle: "bold-large" },
  { key: "fancy-mosaic", name: "Card", category: "creative", corners: "lg", shadow: "lg", border: true, density: "spacious", labelStyle: "plain" },
  { key: "fancy-velvet", name: "Elegant", category: "creative", corners: "full", shadow: "sm", border: true, density: "cozy", labelStyle: "plain" },
  { key: "fancy-festival", name: "Creative", category: "creative", corners: "lg", shadow: "lg", border: false, density: "spacious", labelStyle: "plain" },
];

export const FORM_LAYOUT_CATEGORIES = [
  { key: "classic", label: "Classic" },
  { key: "modern", label: "Modern" },
  { key: "rounded", label: "Rounded" },
  { key: "minimal", label: "Minimal" },
  { key: "business", label: "Business" },
  { key: "creative", label: "Creative" },
];

export function findFormLayout(key) {
  return FORM_LAYOUTS.find((l) => l.key === key);
}

// Independent of the 20 presets above — these mix freely with any of them
// (a "Formal" corner/shadow preset can still use centered, side-label
// fields, etc). Stored directly on branding: labelPosition, contentAlign,
// presentationMode.
export const LABEL_POSITIONS = [
  { key: "top", label: "Above field" },
  { key: "side", label: "Beside field" },
];
export const CONTENT_ALIGNMENTS = [
  { key: "left", label: "Left-aligned" },
  { key: "center", label: "Centered" },
];
// Multiple named "one question at a time" designs, not just a single on/off
// toggle — each combines a step indicator (progress bar / dots / counter)
// with a navigation style (text Back/Next buttons vs. big left/right arrow
// buttons). "single-page" is the only non-stepped option (today's default:
// every field shown at once).
export const PRESENTATION_TEMPLATES = [
  { key: "single-page", name: "All on one page", stepped: false },
  { key: "steps-bar-buttons", name: "Progress bar", stepped: true, indicator: "bar", nav: "buttons" },
  { key: "steps-bar-arrows", name: "Arrows + progress bar", stepped: true, indicator: "bar", nav: "arrows" },
  { key: "steps-dots-buttons", name: "Dot steps", stepped: true, indicator: "dots", nav: "buttons" },
  { key: "steps-dots-arrows", name: "Dot arrows", stepped: true, indicator: "dots", nav: "arrows" },
  { key: "steps-counter-buttons", name: "Step counter", stepped: true, indicator: "counter", nav: "buttons" },
  { key: "steps-counter-arrows", name: "Arrow navigation", stepped: true, indicator: "counter", nav: "arrows" },
  { key: "steps-percent-buttons", name: "Percentage", stepped: true, indicator: "percent", nav: "buttons" },
  { key: "steps-percent-arrows", name: "Percentage arrows", stepped: true, indicator: "percent", nav: "arrows" },
  { key: "steps-minimal-buttons", name: "Minimal", stepped: true, indicator: "none", nav: "buttons" },
  { key: "steps-minimal-arrows", name: "Minimal arrows", stepped: true, indicator: "none", nav: "arrows" },
];

export function findPresentationTemplate(key) {
  return PRESENTATION_TEMPLATES.find((p) => p.key === key) || PRESENTATION_TEMPLATES[0];
}

const CORNERS_CLASS = { none: "rounded-none", sm: "rounded-lg", lg: "rounded-2xl", full: "rounded-[2rem]" };
const SHADOW_CLASS = { none: "shadow-none", sm: "shadow-card", lg: "shadow-xl" };
const DENSITY_CLASS = {
  compact: { card: "p-5", gap: "gap-x-3 gap-y-3" },
  cozy: { card: "p-6 sm:p-8", gap: "gap-x-4 gap-y-5" },
  spacious: { card: "p-8 sm:p-12", gap: "gap-x-6 gap-y-7" },
};
const LABEL_CLASS = {
  plain: "text-sm font-medium mb-1.5",
  uppercase: "text-[11px] font-semibold uppercase tracking-wider text-ink/60 mb-2",
  "bold-large": "text-base font-display font-semibold mb-2",
};

// Falls back to a "standard" formal-ish shape when no layout is picked, so
// forms created before this feature existed keep rendering the way they
// always did (rounded-card, shadow-card, border, cozy density, plain labels).
export function getLayoutStyleClasses(layoutKey) {
  const l = findFormLayout(layoutKey);
  if (!l) {
    return { cardClass: "rounded-card shadow-card border border-border", gapClass: "gap-x-4 gap-y-5", cardPaddingClass: "p-6 sm:p-8", labelClass: LABEL_CLASS.plain };
  }
  const density = DENSITY_CLASS[l.density] || DENSITY_CLASS.cozy;
  return {
    cardClass: `${CORNERS_CLASS[l.corners] || "rounded-lg"} ${SHADOW_CLASS[l.shadow] || "shadow-card"} ${l.border ? "border border-border" : "border-0"}`,
    gapClass: density.gap,
    cardPaddingClass: density.card,
    labelClass: LABEL_CLASS[l.labelStyle] || LABEL_CLASS.plain,
  };
}

// Row/alignment classes for labelPosition + contentAlign — kept separate
// from getLayoutStyleClasses since these two are independent axes, not
// tied to any specific one of the 20 named presets.
export function getFieldRowClasses(labelPosition, contentAlign) {
  const side = labelPosition === "side";
  return {
    rowClass: side ? "sm:flex sm:items-start sm:gap-4" : "",
    labelWrapClass: side ? "sm:w-1/3 sm:pt-2 sm:shrink-0" : "",
    inputWrapClass: side ? "sm:flex-1 sm:min-w-0" : "",
    formAlignClass: contentAlign === "center" ? "text-center" : "",
    headerAlignClass: contentAlign === "center" ? "text-center mx-auto" : "",
  };
}
