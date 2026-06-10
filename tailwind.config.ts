import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        // Primary brand token (used throughout). Points at Wiingy blue.
        brand: {
          DEFAULT: "#2D3DA8",
          dark: "#232F8A",
        },
        // Full Wiingy palette (wiingy.com brand identity).
        wiingy: {
          blue: "#2D3DA8", // primary — logo, CTAs, active states
          "blue-dark": "#232F8A", // hover state
          "blue-light": "#EEF0FB", // tinted backgrounds, badges
          "blue-mid": "#4B5CC4", // secondary accents
          dark: "#1A1A2E", // headings, primary text
          gray: "#6B7280", // secondary text, muted labels
          "gray-light": "#F5F6FA", // page background
          "gray-border": "#E5E7EB", // borders, dividers
          white: "#FFFFFF",
          amber: "#F5A623", // warning badges
          "amber-light": "#FFF8EC",
          green: "#22C55E", // PASS badges
          "green-light": "#F0FDF4",
          red: "#EF4444", // FAIL badges, errors
          "red-light": "#FEF2F2",
        },
      },
    },
  },
  plugins: [],
};

export default config;
