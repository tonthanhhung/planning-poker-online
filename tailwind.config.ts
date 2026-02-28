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
        primary: "#327ACF",
        secondary: "#78B6FF",
        accent: "#FBBD3F",
        dark: "#1a1a2e",
      },
      animation: {
        "card-flip": "cardFlip 0.6s ease-in-out",
        "card-reveal": "cardReveal 0.5s ease-out",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
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
          "0%, 100%": { boxShadow: "0 0 20px rgba(120, 182, 255, 0.5)" },
          "50%": { boxShadow: "0 0 40px rgba(120, 182, 255, 0.8)" },
        },
      },
    },
  },
  plugins: [],
}
export default config
