/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["\"DM Sans\"", "system-ui", "sans-serif"],
      },
      colors: {
        app: {
          bg: "#0a0a0a",
          sidebar: "#111111",
          chat: "#1a1a1a",
          bubbleIn: "#1e1e2e",
          bubbleOut: "#4f46e5",
        },
      },
      boxShadow: {
        glow: "0 0 20px rgba(99, 102, 241, 0.25)",
        "glow-sm": "0 0 12px rgba(99, 102, 241, 0.2)",
      },
    },
  },
  plugins: [],
};
