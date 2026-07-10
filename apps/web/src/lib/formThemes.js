// One-click design themes for the public form page — each bundles a page
// background (solid color or CSS gradient) with an accent color used for
// the submit button and selected-answer states. Selecting a theme is just
// a shortcut that writes concrete values into branding; the underlying
// branding fields (backgroundCss / accentColor) are what actually render.
export const FORM_THEMES = [
  { key: "classic", name: "Classic", background: "#F5F6F8", accent: "#2F5D50" },
  { key: "ocean", name: "Ocean", background: "linear-gradient(135deg, #3E6FA3, #1F3A5F)", accent: "#3E6FA3" },
  { key: "sunset", name: "Sunset", background: "linear-gradient(135deg, #FFB88C, #DE6262)", accent: "#C1443C" },
  { key: "forest", name: "Forest", background: "linear-gradient(135deg, #134E5E, #71B280)", accent: "#2F5D50" },
  { key: "lavender", name: "Lavender", background: "linear-gradient(135deg, #C9B6E4, #8E7CC3)", accent: "#8B5FBF" },
  { key: "midnight", name: "Midnight", background: "#14172B", accent: "#E8A33D" },
  { key: "minimal", name: "Minimal", background: "#FFFFFF", accent: "#14172B" },
  { key: "sunrise", name: "Sunrise", background: "linear-gradient(135deg, #FDEB71, #F8D800)", accent: "#E8A33D" },
];

export function findFormTheme(key) {
  return FORM_THEMES.find((t) => t.key === key);
}
