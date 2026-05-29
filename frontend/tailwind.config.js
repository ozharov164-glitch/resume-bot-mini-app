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
        surface: "#ffffff",
        "surface-container": "#f8f9fa",
        "surface-container-low": "#f4f4f5",
        "surface-container-high": "#ececec",
        "surface-variant": "#ececec",
        "outline-variant": "#e5e7eb",
        secondary: "#707579",
        "text-muted-light": "#707579",
        "brand-muted": "rgba(16, 185, 129, 0.12)",
      },
      fontFamily: {
        sans: ['"Nunito Sans"', "Nunito", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "0.75rem",
      },
      boxShadow: {
        card: "0 2px 12px rgba(0, 0, 0, 0.06)",
        brand: "0 4px 20px rgba(16, 185, 129, 0.2)",
      },
    },
  },
  plugins: [],
};
