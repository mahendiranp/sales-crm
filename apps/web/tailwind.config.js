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
        card: "0 1px 2px rgba(20, 23, 43, 0.04), 0 1px 8px rgba(20, 23, 43, 0.04)",
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
      },
    },
  },
  plugins: [],
};
