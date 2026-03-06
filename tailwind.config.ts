import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#0052CC",
        secondary: "#172B4D",
        accent: "#FF5630",
        success: "#36B37E",
        warning: "#FFAB00",
        error: "#FF5630",
        neutral: "#6B778C",
        "neutral-light": "#DFE1E6",
        "neutral-dark": "#172B4D",
        "blue-light": "#DEEBFF",
        "blue-subtle": "#E6FCFF",
        "green-light": "#E3FCEF",
        "yellow-light": "#FFFAE6",
        "red-light": "#FFEBE6",
        "purple-light": "#F4E5FF",
        background: "#FAFBFC",
        surface: "#FFFFFF",
        border: "#DFE1E6",
      },
      animation: {
        "card-flip": "cardFlip 0.6s ease-in-out",
        "card-reveal": "cardReveal 0.5s ease-out",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        "slide-in": "slideIn 0.2s ease-out",
        "fade-in": "fadeIn 0.15s ease-out",
      },
      keyframes: {
        cardFlip: {
          "0%": { transform: "rotateY(0deg)" },
          "50%": { transform: "rotateY(90deg)" },
          "100%": { transform: "rotateY(0deg)" },
        },
        cardReveal: {
          "0%": { transform: "scale(0.8)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(0, 82, 204, 0.15)" },
          "50%": { boxShadow: "0 0 40px rgba(0, 82, 204, 0.3)" },
        },
        slideIn: {
          "0%": { transform: "translateX(-10px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      boxShadow: {
        "elevation-low": "0 1px 1px rgba(9, 30, 66, 0.07), 0 0 1px rgba(9, 30, 66, 0.08)",
        "elevation-medium": "0 1px 2px rgba(9, 30, 66, 0.1), 0 2px 4px rgba(9, 30, 66, 0.1)",
        "elevation-high": "0 4px 8px rgba(9, 30, 66, 0.07), 0 12px 24px rgba(9, 30, 66, 0.1)",
        "elevation-raised": "0 8px 16px rgba(9, 30, 66, 0.1), 0 16px 32px rgba(9, 30, 66, 0.15)",
      },
    },
  },
  plugins: [],
}
export default config
