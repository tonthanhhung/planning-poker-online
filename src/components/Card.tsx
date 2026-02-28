'use client'

import { motion } from 'framer-motion'
import { CARD_VALUES, COFFEE_CARD } from '@/types'

interface CardProps {
  value: number | typeof COFFEE_CARD
  isSelected?: boolean
  isRevealed?: boolean
  onClick?: () => void
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function Card({ value, isSelected = false, isRevealed = false, onClick, disabled = false, size = 'md' }: CardProps) {
  const sizeClasses = {
    sm: 'w-12 h-16 text-sm',
    md: 'w-16 h-24 text-xl',
    lg: 'w-20 h-32 text-3xl',
  }

  const displayValue = value === COFFEE_CARD ? COFFEE_CARD : value

  return (
    <motion.div
      className={`relative cursor-pointer ${sizeClasses[size]}`}
      onClick={() => !disabled && onClick?.()}
      whileHover={!disabled ? { scale: 1.05, y: -10 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      initial={false}
      animate={isSelected ? { y: -20 } : { y: 0 }}
    >
      <div className={`
        w-full h-full rounded-xl bg-gradient-to-br from-primary to-secondary
        flex items-center justify-center
        border-4 ${isSelected ? 'border-accent ring-4 ring-accent ring-offset-2' : 'border-white'}
        shadow-lg
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer glow-hover'}
      `}>
        <span className="text-white font-bold text-2xl">
          {displayValue}
        </span>
      </div>
    </motion.div>
  )
}

export function CardDeck({
  selectedValue,
  onCardClick,
  disabled = false,
  showValues = true,
}: {
  selectedValue: number | typeof COFFEE_CARD | null
  onCardClick: (value: number | typeof COFFEE_CARD) => void
  disabled?: boolean
  showValues?: boolean
}) {
  return (
    <div className="flex flex-wrap justify-center gap-3 p-4">
      {CARD_VALUES.map((value) => (
        <Card
          key={value}
          value={showValues ? value : COFFEE_CARD}
          isSelected={selectedValue === value}
          onClick={() => onCardClick(value)}
          disabled={disabled}
          size="md"
        />
      ))}
      {/* Coffee break card */}
      <Card
        value={COFFEE_CARD}
        isSelected={selectedValue === COFFEE_CARD}
        onClick={() => onCardClick(COFFEE_CARD)}
        disabled={disabled}
        size="md"
      />
    </div>
  )
}
