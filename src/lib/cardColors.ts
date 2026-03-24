// Card color mapping for Planning Poker values
// Each value has a distinct color to help players quickly identify cards

import { COFFEE_CARD, QUESTION_CARD } from '@/types'

export interface CardColorScheme {
  bg: string
  border: string
  text: string
  shadow: string
  gradient: string
}

// Color mapping for each card value
// Using a carefully selected palette that's visually distinct and meaningful
export const CARD_COLOR_MAP: Record<number | typeof COFFEE_CARD | typeof QUESTION_CARD, CardColorScheme> = {
  // 0 - Dark slate (represents zero/nothing)
  0: {
    bg: 'bg-slate-100',
    border: 'border-slate-400',
    text: 'text-slate-700',
    shadow: 'shadow-slate-200',
    gradient: 'from-slate-50 to-slate-100',
  },
  // 0.5 - Light gray (minimal value)
  0.5: {
    bg: 'bg-gray-100',
    border: 'border-gray-400',
    text: 'text-gray-700',
    shadow: 'shadow-gray-200',
    gradient: 'from-gray-50 to-gray-100',
  },
  // 1 - Soft green (small, starting value)
  1: {
    bg: 'bg-green-100',
    border: 'border-green-500',
    text: 'text-green-700',
    shadow: 'shadow-green-200',
    gradient: 'from-green-50 to-green-100',
  },
  // 2 - Mint (light green, small increment)
  2: {
    bg: 'bg-emerald-100',
    border: 'border-emerald-500',
    text: 'text-emerald-700',
    shadow: 'shadow-emerald-200',
    gradient: 'from-emerald-50 to-emerald-100',
  },
  // 3 - Teal (moderate small value)
  3: {
    bg: 'bg-teal-100',
    border: 'border-teal-500',
    text: 'text-teal-700',
    shadow: 'shadow-teal-200',
    gradient: 'from-teal-50 to-teal-100',
  },
  // 5 - Cyan (Fibonacci sequence, noticeable)
  5: {
    bg: 'bg-cyan-100',
    border: 'border-cyan-500',
    text: 'text-cyan-700',
    shadow: 'shadow-cyan-200',
    gradient: 'from-cyan-50 to-cyan-100',
  },
  // 8 - Blue (significant value)
  8: {
    bg: 'bg-blue-100',
    border: 'border-blue-500',
    text: 'text-blue-700',
    shadow: 'shadow-blue-200',
    gradient: 'from-blue-50 to-blue-100',
  },
  // 13 - Indigo (large value)
  13: {
    bg: 'bg-indigo-100',
    border: 'border-indigo-500',
    text: 'text-indigo-700',
    shadow: 'shadow-indigo-200',
    gradient: 'from-indigo-50 to-indigo-100',
  },
  // 20 - Violet (substantial value)
  20: {
    bg: 'bg-violet-100',
    border: 'border-violet-500',
    text: 'text-violet-700',
    shadow: 'shadow-violet-200',
    gradient: 'from-violet-50 to-violet-100',
  },
  // 40 - Purple (large value)
  40: {
    bg: 'bg-purple-100',
    border: 'border-purple-500',
    text: 'text-purple-700',
    shadow: 'shadow-purple-200',
    gradient: 'from-purple-50 to-purple-100',
  },
  // 100 - Pink/Magenta (maximum value)
  100: {
    bg: 'bg-fuchsia-100',
    border: 'border-fuchsia-500',
    text: 'text-fuchsia-700',
    shadow: 'shadow-fuchsia-200',
    gradient: 'from-fuchsia-50 to-fuchsia-100',
  },
  // Coffee card - Amber/Brown
  [COFFEE_CARD]: {
    bg: 'bg-amber-100',
    border: 'border-amber-500',
    text: 'text-amber-800',
    shadow: 'shadow-amber-200',
    gradient: 'from-amber-50 to-amber-100',
  },
  // Question card - Slate/Gray
  [QUESTION_CARD]: {
    bg: 'bg-slate-100',
    border: 'border-slate-500',
    text: 'text-slate-700',
    shadow: 'shadow-slate-200',
    gradient: 'from-slate-50 to-slate-100',
  },
}

// Face-down card colors (hidden votes)
export const FACE_DOWN_CARD_COLORS: CardColorScheme = {
  bg: 'bg-gradient-to-br from-primary to-blue-700',
  border: 'border-blue-400',
  text: 'text-white',
  shadow: 'shadow-blue-500/30',
  gradient: 'from-primary to-blue-700',
}

// Default card colors (when no specific value)
export const DEFAULT_CARD_COLORS: CardColorScheme = {
  bg: 'bg-surface',
  border: 'border-border',
  text: 'text-secondary',
  shadow: 'shadow-sm',
  gradient: 'from-surface to-surface',
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
    return 'bg-gradient-to-br from-primary to-blue-700 border-2 border-blue-400'
  }
  
  const colors = getCardColors(value)
  return `bg-gradient-to-br ${colors.gradient} border-2 ${colors.border}`
}
