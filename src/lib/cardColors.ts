// Card color mapping for Planning Poker values
// Each value has a distinct, vibrant color to help players quickly identify cards

import { COFFEE_CARD, QUESTION_CARD } from '@/types'

export interface CardColorScheme {
  bg: string
  border: string
  text: string
  shadow: string
  gradient: string
}

// Vibrant color mapping for each card value
// Using saturated colors that are visually distinct
export const CARD_COLOR_MAP: Record<number | typeof COFFEE_CARD | typeof QUESTION_CARD, CardColorScheme> = {
  // 0 - Dark slate/charcoal (represents zero/nothing)
  0: {
    bg: 'bg-slate-500',
    border: 'border-slate-700',
    text: 'text-white',
    shadow: 'shadow-slate-500/50',
    gradient: 'from-slate-400 to-slate-600',
  },
  // 0.5 - Gray (minimal value)
  0.5: {
    bg: 'bg-gray-400',
    border: 'border-gray-600',
    text: 'text-white',
    shadow: 'shadow-gray-500/50',
    gradient: 'from-gray-300 to-gray-500',
  },
  // 1 - Green (small, starting value)
  1: {
    bg: 'bg-green-500',
    border: 'border-green-700',
    text: 'text-white',
    shadow: 'shadow-green-500/50',
    gradient: 'from-green-400 to-green-600',
  },
  // 2 - Mint/Emerald (light green, small increment)
  2: {
    bg: 'bg-emerald-500',
    border: 'border-emerald-700',
    text: 'text-white',
    shadow: 'shadow-emerald-500/50',
    gradient: 'from-emerald-400 to-emerald-600',
  },
  // 3 - Lime/Yellow-Green (distinct from teal and cyan)
  3: {
    bg: 'bg-lime-500',
    border: 'border-lime-700',
    text: 'text-white',
    shadow: 'shadow-lime-500/50',
    gradient: 'from-lime-400 to-lime-600',
  },
  // 5 - Orange/Amber (distinct from yellow and blue)
  5: {
    bg: 'bg-orange-500',
    border: 'border-orange-700',
    text: 'text-white',
    shadow: 'shadow-orange-500/50',
    gradient: 'from-orange-400 to-orange-600',
  },
  // 8 - Sky Blue (keep this as the blue anchor)
  8: {
    bg: 'bg-sky-500',
    border: 'border-sky-700',
    text: 'text-white',
    shadow: 'shadow-sky-500/50',
    gradient: 'from-sky-400 to-sky-600',
  },
  // 13 - Blue (large value)
  13: {
    bg: 'bg-blue-600',
    border: 'border-blue-800',
    text: 'text-white',
    shadow: 'shadow-blue-500/50',
    gradient: 'from-blue-500 to-blue-700',
  },
  // 20 - Indigo (substantial value)
  20: {
    bg: 'bg-indigo-600',
    border: 'border-indigo-800',
    text: 'text-white',
    shadow: 'shadow-indigo-500/50',
    gradient: 'from-indigo-500 to-indigo-700',
  },
  // 40 - Purple (large value)
  40: {
    bg: 'bg-purple-600',
    border: 'border-purple-800',
    text: 'text-white',
    shadow: 'shadow-purple-500/50',
    gradient: 'from-purple-500 to-purple-700',
  },
  // 100 - Pink/Magenta (maximum value)
  100: {
    bg: 'bg-pink-600',
    border: 'border-pink-800',
    text: 'text-white',
    shadow: 'shadow-pink-500/50',
    gradient: 'from-pink-500 to-pink-700',
  },
  // Coffee card - Amber/Brown
  [COFFEE_CARD]: {
    bg: 'bg-amber-600',
    border: 'border-amber-800',
    text: 'text-white',
    shadow: 'shadow-amber-500/50',
    gradient: 'from-amber-500 to-amber-700',
  },
  // Question card - Slate
  [QUESTION_CARD]: {
    bg: 'bg-slate-600',
    border: 'border-slate-800',
    text: 'text-white',
    shadow: 'shadow-slate-500/50',
    gradient: 'from-slate-500 to-slate-700',
  },
}

// Face-down card colors (hidden votes) - keep the original blue
export const FACE_DOWN_CARD_COLORS: CardColorScheme = {
  bg: 'bg-gradient-to-br from-blue-600 to-blue-800',
  border: 'border-blue-500',
  text: 'text-white',
  shadow: 'shadow-blue-500/50',
  gradient: 'from-blue-600 to-blue-800',
}

// Default card colors (when no specific value)
export const DEFAULT_CARD_COLORS: CardColorScheme = {
  bg: 'bg-slate-400',
  border: 'border-slate-600',
  text: 'text-white',
  shadow: 'shadow-slate-500/50',
  gradient: 'from-slate-300 to-slate-500',
}

// Helper function to get colors for a card value
export function getCardColors(value: number | typeof COFFEE_CARD | typeof QUESTION_CARD | null | undefined): CardColorScheme {
  if (value === null || value === undefined) {
    return DEFAULT_CARD_COLORS
  }
  
  // Check if value exists in the map
  if (value in CARD_COLOR_MAP) {
    return CARD_COLOR_MAP[value]
  }
  
  // Handle special numeric values
  if (typeof value === 'number') {
    // Map -1 to coffee card, -2 to question card
    if (value === -1) return CARD_COLOR_MAP[COFFEE_CARD]
    if (value === -2) return CARD_COLOR_MAP[QUESTION_CARD]
    
    // Find closest value in the map
    const validValues = [0, 0.5, 1, 2, 3, 5, 8, 13, 20, 40, 100]
    const closest = validValues.reduce((prev, curr) => 
      Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
    )
    return CARD_COLOR_MAP[closest]
  }
  
  return DEFAULT_CARD_COLORS
}

// Helper to get Tailwind class string for a card
export function getCardClassName(value: number | typeof COFFEE_CARD | typeof QUESTION_CARD | null | undefined, isRevealed: boolean = true): string {
  if (!isRevealed) {
    return 'bg-gradient-to-br from-blue-600 to-blue-800 border-2 border-blue-500'
  }
  
  const colors = getCardColors(value)
  return `bg-gradient-to-br ${colors.gradient} border-2 ${colors.border}`
}
