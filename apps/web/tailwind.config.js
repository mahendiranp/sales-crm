/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // `ink` stays as the single dark base color that most text/opacity
        // utilities (text-ink/40, /60, etc.) derive from — kept for
        // backwards compat with the hundreds of existing text-ink/NN call
        // sites. The named tokens below are for new/updated call sites that
        // want a guaranteed, non-opacity-diluted contrast level instead of
        // guessing which opacity reads dark enough (the "washed out"
        // feedback: low ink-opacity text blends with a white background
        // more than a solid gray of the same nominal shade would).
        heading: "#111827",
        secondary: "#6B7280",
        hover: "#F1F5F9",
        ink: "#14172B",
        base: "#F8FAFC",
        primary: {
          DEFAULT: "#2F5D50",
          light: "#4A7A6D",
          dark: "#1F4038",
        },
        accent: {
          DEFAULT: "#E8A33D",
          light: "#F4C578",
          dark: "#C9832A",
        },
        danger: "#DC2626",
        border: "#E2E8F0",
      },
      fontFamily: {
        display: ["Sora", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        card: "10px",
      },
      boxShadow: {
        // A softer, more visible lift than a hairline border alone — was
        // faint enough to read as "no shadow" at a glance.
        card: "0 8px 24px rgba(15, 23, 42, 0.06)",
      },
      // Used by Landing.jsx's hero mock (animate-[fadeIn_0.4s_ease-out_forwards])
      // to stagger the "Creating fields / Adding validation / ..." checklist
      // items in without a JS-driven per-item state machine.
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(2px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        // Landing.jsx's floating chips around the hero mock — gently
        // fades in, holds, fades out, on a loop (staggered per chip via
        // inline animationDelay).
        floatFade: {
          "0%, 100%": { opacity: "0", transform: "translateY(6px)" },
          "15%, 40%": { opacity: "1", transform: "translateY(0)" },
          "55%": { opacity: "0", transform: "translateY(-6px)" },
        },
        // Mobile menu panel opening (Landing.jsx's NavBar) and general
        // scroll-reveal (Workflow Demo/Pricing/Security sections) — same
        // shape as fadeIn but a larger travel distance (16-24px, not 2px),
        // since fadeIn's subtlety reads as "barely there" at this scale.
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        // Mobile menu panel opening specifically — slides down FROM the
        // header edge (negative translateY, not up from below like
        // fadeUp), 250ms ease-out per spec.
        slideDown: {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        // Mobile menu glass card entrance specifically — scale 0.96→1 plus
        // a small downward settle, per the "Slide" preset (mobile menu,
        // drawers, modals) in the animation-system spec. slideDown (above)
        // is kept as-is since other callers may still reference it.
        panelIn: {
          "0%": { opacity: "0", transform: "translateY(-8px) scale(0.96)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        backdropIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        // CTA pulse (Landing.jsx's Sign up buttons) — a barely-there
        // "breathe," not a bounce; stops once the visitor has interacted
        // with the page at all (see hasInteracted in Landing.jsx).
        ctaPulse: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.02)" },
        },
        // AI badge shimmer — a narrow light sweep translating across the
        // badge (not a background-position trick, which needs a
        // wider-than-element gradient to look right at this small size),
        // so it reads as "polish" rather than a flashing alert.
        shimmer: {
          "0%, 92%": { transform: "translateX(-120%)" },
          "100%": { transform: "translateX(220%)" },
        },
      },
      animation: {
        // Named so call sites can write animate-fade-up-slow instead of
        // repeating the full animate-[fadeUp_...] arbitrary-value syntax
        // at every scroll-reveal section.
        "fade-up": "fadeUp 0.5s ease-out forwards",
        "cta-pulse": "ctaPulse 7s ease-in-out infinite",
        shimmer: "shimmer 9s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
