/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14172B",
        base: "#F7F8FA",
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
        danger: "#C1443C",
        border: "#E4E7EC",
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
    },
  },
  plugins: [],
};
