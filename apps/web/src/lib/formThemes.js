// One-click design themes for the public form page — each bundles a page
// background (solid color or CSS gradient) with an accent color used for
// the submit button and selected-answer states. Selecting a theme is just
// a shortcut that writes concrete values into branding; the underlying
// branding fields (backgroundCss / accentColor) are what actually render.
// `category` groups themes in the picker (see ThemePicker in Forms.jsx) —
// "classic" for the original set, "formal" for muted/business-appropriate
// looks, "fancy" for bolder/decorative ones.
export const FORM_THEMES = [
  { key: "classic", name: "Classic", background: "#F5F6F8", accent: "#2F5D50", category: "classic" },
  { key: "ocean", name: "Ocean", background: "linear-gradient(135deg, #3E6FA3, #1F3A5F)", accent: "#3E6FA3", category: "classic" },
  { key: "sunset", name: "Sunset", background: "linear-gradient(135deg, #FFB88C, #DE6262)", accent: "#C1443C", category: "classic" },
  { key: "forest", name: "Forest", background: "linear-gradient(135deg, #134E5E, #71B280)", accent: "#2F5D50", category: "classic" },
  { key: "lavender", name: "Lavender", background: "linear-gradient(135deg, #C9B6E4, #8E7CC3)", accent: "#8B5FBF", category: "classic" },
  { key: "midnight", name: "Midnight", background: "#14172B", accent: "#E8A33D", category: "classic" },
  { key: "minimal", name: "Minimal", background: "#FFFFFF", accent: "#14172B", category: "classic" },
  { key: "sunrise", name: "Sunrise", background: "linear-gradient(135deg, #FDEB71, #F8D800)", accent: "#E8A33D", category: "classic" },

  // Formal — muted, business-appropriate palettes for HR/finance/legal-style forms.
  { key: "corporate-navy", name: "Corporate Navy", background: "#1B2A41", accent: "#C9A15A", category: "formal" },
  { key: "boardroom", name: "Boardroom", background: "#F4F2EC", accent: "#3A3A3A", category: "formal" },
  { key: "slate", name: "Slate", background: "#EAECEF", accent: "#37474F", category: "formal" },
  { key: "charcoal", name: "Charcoal", background: "#22262B", accent: "#B0B7BF", category: "formal" },
  { key: "ivory", name: "Ivory", background: "#FAF7F0", accent: "#5B4636", category: "formal" },
  { key: "steel-blue", name: "Steel Blue", background: "#E4EAF0", accent: "#2C4A6B", category: "formal" },
  { key: "hunter-green", name: "Hunter Green", background: "#F2F5F1", accent: "#1F4A34", category: "formal" },
  { key: "graphite", name: "Graphite", background: "#F0F0F0", accent: "#2B2B2B", category: "formal" },
  { key: "burgundy", name: "Burgundy", background: "#F6EEEC", accent: "#6E2A34", category: "formal" },
  { key: "pearl", name: "Pearl", background: "#F7F8FA", accent: "#4A4A4A", category: "formal" },

  // Fancy — bolder gradients and decorative palettes for events/marketing-style forms.
  { key: "rose-gold", name: "Rose Gold", background: "linear-gradient(135deg, #F6D5C0, #E8A99C)", accent: "#B5654E", category: "fancy" },
  { key: "neon-nights", name: "Neon Nights", background: "linear-gradient(135deg, #0F0C29, #302B63, #24243E)", accent: "#FF2E88", category: "fancy" },
  { key: "candy-pop", name: "Candy Pop", background: "linear-gradient(135deg, #FF9A8B, #FF6A88, #FF99AC)", accent: "#FF2D75", category: "fancy" },
  { key: "electric-violet", name: "Electric Violet", background: "linear-gradient(135deg, #7F00FF, #E100FF)", accent: "#7F00FF", category: "fancy" },
  { key: "tropical", name: "Tropical", background: "linear-gradient(135deg, #00C9A7, #92FE9D)", accent: "#00997A", category: "fancy" },
  { key: "citrus-burst", name: "Citrus Burst", background: "linear-gradient(135deg, #F7971E, #FFD200)", accent: "#E85D04", category: "fancy" },
  { key: "cosmic-pink", name: "Cosmic Pink", background: "linear-gradient(135deg, #EE9CA7, #FFDDE1)", accent: "#C2185B", category: "fancy" },
  { key: "aurora", name: "Aurora", background: "linear-gradient(135deg, #00F5A0, #00D9F5)", accent: "#00A8CC", category: "fancy" },
  { key: "gold-rush", name: "Gold Rush", background: "linear-gradient(135deg, #FFD700, #FFA500)", accent: "#B8860B", category: "fancy" },
  { key: "galaxy", name: "Galaxy", background: "linear-gradient(135deg, #360033, #0B8793)", accent: "#E040FB", category: "fancy" },
];

export const FORM_THEME_CATEGORIES = [
  { key: "classic", label: "Classic" },
  { key: "formal", label: "Formal" },
  { key: "fancy", label: "Fancy" },
];

export function findFormTheme(key) {
  return FORM_THEMES.find((t) => t.key === key);
}
