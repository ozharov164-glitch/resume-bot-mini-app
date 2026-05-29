/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#006c49",
        "primary-container": "#10b981",
        "on-primary": "#ffffff",
        "on-surface": "#161d19",
        "on-surface-variant": "#3c4a42",
        surface: "#f4fbf4",
        "surface-container": "#e8f0e9",
        "surface-container-low": "#eef6ee",
        "surface-container-high": "#e3eae3",
        "surface-variant": "#dde4dd",
        "outline-variant": "#bbcabf",
        secondary: "#555f6b",
        "text-muted-light": "#707579",
        "brand-muted": "rgba(16, 185, 129, 0.1)",
        "tertiary-container": "#fc7c78",
        "on-tertiary-container": "#711419",
      },
      fontFamily: {
        sans: ['"Nunito Sans"', "Nunito", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "0.75rem",
      },
      boxShadow: {
        card: "0 4px 20px rgba(0, 0, 0, 0.08)",
        brand: "0 4px 20px rgba(16, 185, 129, 0.2)",
      },
    },
  },
  plugins: [],
};
