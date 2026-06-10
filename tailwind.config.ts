import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
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
        // ── Brand ───────────────────────────────────────────
        brand: {
          DEFAULT: "#2D3DA8",
          dark: "#232F8A",
          light: "#EEF0FB",
          mid: "#4B5CC4",
          muted: "#A5ADDB",
        },
        // ── Light mode surfaces ─────────────────────────────
        light: {
          bg: "#F5F6FA",
          surface: "#FFFFFF",
          surface2: "#F9FAFB",
          border: "#E5E7EB",
          text: "#1A1A2E",
          text2: "#6B7280",
          text3: "#9CA3AF",
        },
        // ── Dark mode surfaces ──────────────────────────────
        dark: {
          bg: "#0F1117",
          surface: "#1C1E2E",
          surface2: "#252840",
          border: "#2E3151",
          text: "#F0F2FF",
          text2: "#8B8FA8",
          text3: "#555878",
        },
        // ── Semantic ────────────────────────────────────────
        success: { DEFAULT: "#22C55E", light: "#F0FDF4", text: "#15803D" },
        warning: { DEFAULT: "#F59E0B", light: "#FFFBEB", text: "#B45309" },
        danger: { DEFAULT: "#EF4444", light: "#FEF2F2", text: "#DC2626" },
        info: { DEFAULT: "#2D3DA8", light: "#EEF0FB", text: "#1E2A7A" },
        // ── Legacy alias (kept so existing wiingy-* classes still resolve) ──
        wiingy: {
          blue: "#2D3DA8",
          "blue-dark": "#232F8A",
          "blue-light": "#EEF0FB",
          "blue-mid": "#4B5CC4",
          dark: "#1A1A2E",
          gray: "#6B7280",
          "gray-light": "#F5F6FA",
          "gray-border": "#E5E7EB",
          white: "#FFFFFF",
          amber: "#F5A623",
          "amber-light": "#FFF8EC",
          green: "#22C55E",
          "green-light": "#F0FDF4",
          red: "#EF4444",
          "red-light": "#FEF2F2",
        },
      },
    },
  },
  plugins: [],
};

export default config;
