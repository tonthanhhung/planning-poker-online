import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  // Safelist card color classes to ensure they're included in the build
  safelist: [
    // Slate colors (for 0 and ?)
    'bg-slate-500', 'bg-slate-600', 'from-slate-400', 'to-slate-600', 'from-slate-500', 'to-slate-700',
    'border-slate-700', 'border-slate-800', 'text-slate-700', 'shadow-slate-500',
    // Gray colors (for 0.5)
    'bg-gray-400', 'bg-gray-500', 'from-gray-300', 'to-gray-500', 'border-gray-600',
    // Green colors (for 1)
    'bg-green-500', 'bg-green-600', 'from-green-400', 'to-green-600', 'border-green-700',
    // Emerald colors (for 2)
    'bg-emerald-500', 'bg-emerald-600', 'from-emerald-400', 'to-emerald-600', 'border-emerald-700',
    // Teal colors (for 3) - REPLACED with Lime
    'bg-lime-500', 'bg-lime-600', 'from-lime-400', 'to-lime-600', 'border-lime-700',
    // Cyan colors (for 5) - REPLACED with Orange
    'bg-orange-500', 'bg-orange-600', 'from-orange-400', 'to-orange-600', 'border-orange-700',
    // Sky colors (for 8)
    'bg-sky-500', 'bg-sky-600', 'from-sky-400', 'to-sky-600', 'border-sky-700',
    // Blue colors (for 13)
    'bg-blue-600', 'bg-blue-700', 'from-blue-500', 'to-blue-700', 'border-blue-800',
    // Indigo colors (for 20)
    'bg-indigo-600', 'bg-indigo-700', 'from-indigo-500', 'to-indigo-700', 'border-indigo-800',
    // Purple colors (for 40)
    'bg-purple-600', 'bg-purple-700', 'from-purple-500', 'to-purple-700', 'border-purple-800',
    // Pink/Fuchsia colors (for 100)
    'bg-pink-600', 'bg-pink-700', 'from-pink-500', 'to-pink-700', 'border-pink-800',
    // Amber colors (for coffee)
    'bg-amber-600', 'bg-amber-700', 'from-amber-500', 'to-amber-700', 'border-amber-800',
    // Text colors
    'text-white',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['var(--font-outfit)', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        // Primary - Warm teal (playful, modern, less corporate)
        primary: "#0D9488",
        "primary-hover": "#0F766E",
        "primary-light": "#CCFBF1",
        "primary-dark": "#115E59",
        // Secondary - Deep slate (warmer than navy)
        secondary: "#334155",
        // Accent - Coral (energetic, warm contrast to teal)
        accent: "#F97066",
        "accent-hover": "#E05A52",
        "accent-light": "#FEE8E6",
        // Success - Vibrant emerald (celebratory, energetic)
        success: "#10B981",
        "success-hover": "#059669",
        "success-light": "#D1FAE5",
        // Warning - Warm amber
        warning: "#F59E0B",
        "warning-light": "#FEF3C7",
        // Error - Vibrant coral red
        error: "#EF4444",
        "error-light": "#FEE2E2",
        // Neutral - Slate with warmth
        neutral: "#475569",
        "neutral-light": "#CBD5E1",
        "neutral-dark": "#1E293B",
        "neutral-subtle": "#F1F5F9",
        // Vote value colors - Low (green), Medium (amber), High (red)
        "vote-low": "#10B981",
        "vote-low-light": "#D1FAE5",
        "vote-medium": "#F59E0B",
        "vote-medium-light": "#FEF3C7",
        "vote-high": "#EF4444",
        "vote-high-light": "#FEE2E2",
        // Backgrounds - Warm neutrals (not cold gray)
        background: "#F8FAFC",
        "background-warm": "#FDFDFD",
        surface: "#FFFFFF",
        "surface-elevated": "#FFFFFF",
        border: "#E2E8F0",
        "border-subtle": "#F1F5F9",
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
          "0%, 100%": { boxShadow: "0 0 20px rgba(13, 148, 136, 0.15)" },
          "50%": { boxShadow: "0 0 40px rgba(13, 148, 136, 0.3)" },
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
        // Warmer shadows with slate undertones (not cold blue-gray)
        "elevation-low": "0 1px 2px 0 rgba(15, 23, 42, 0.05)",
        "elevation-medium": "0 4px 6px -1px rgba(15, 23, 42, 0.1), 0 2px 4px -2px rgba(15, 23, 42, 0.1)",
        "elevation-high": "0 10px 15px -3px rgba(15, 23, 42, 0.1), 0 4px 6px -4px rgba(15, 23, 42, 0.1)",
        "elevation-raised": "0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.1)",
        // Colored shadows for primary elements
        "primary-shadow": "0 4px 14px 0 rgba(13, 148, 136, 0.4)",
        "primary-shadow-hover": "0 6px 20px rgba(13, 148, 136, 0.23), 0 6px 6px rgba(13, 148, 136, 0.19)",
        "accent-shadow": "0 4px 14px 0 rgba(249, 112, 102, 0.4)",
        "success-shadow": "0 4px 14px 0 rgba(16, 185, 129, 0.4)",
      },
    },
  },
  plugins: [],
}
export default config
