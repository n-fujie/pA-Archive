import type { Config } from "tailwindcss";

/**
 * Academic palette: white background, black text, deep navy accent.
 * No gradients, restrained radii, tight spacing scale.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#111111",
          soft: "#333333",
          muted: "#5b5b5b",
          faint: "#767676",
        },
        navy: {
          DEFAULT: "#0f2f5f",
          dark: "#0a2144",
          light: "#1c4a8a",
        },
        rule: "#d7d7d7",
        surface: "#ffffff",
        panel: "#f6f7f9",
        danger: "#8a1f11",
        ok: "#1f6b3a",
        warn: "#8a5a00",
      },
      borderRadius: {
        none: "0",
        sm: "2px",
        DEFAULT: "3px",
        md: "4px",
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        serif: ["Georgia", "Cambria", "Times New Roman", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      maxWidth: {
        prose: "72ch",
        page: "1120px",
      },
    },
  },
  plugins: [],
};

export default config;
