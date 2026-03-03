/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      keyframes: {
        pop: {
          "0%": { transform: "scale(0.85)" },
          "50%": { transform: "scale(1.05)" },
          "100%": { transform: "scale(1)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { transform: "translateY(100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 6px rgba(34,197,94,0.4)" },
          "50%": { boxShadow: "0 0 14px rgba(34,197,94,0.7)" },
        },
        "badge-bounce": {
          "0%": { transform: "scale(0)" },
          "60%": { transform: "scale(1.2)" },
          "100%": { transform: "scale(1)" },
        },
        "modal-in": {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        pop: "pop 0.3s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        "slide-up": "slide-up 0.2s ease-out",
        "glow-pulse": "glow-pulse 1.5s ease-in-out infinite",
        "badge-bounce": "badge-bounce 0.4s ease-out",
        "modal-in": "modal-in 0.2s ease-out",
      },
    },
  },
  plugins: [],
};
