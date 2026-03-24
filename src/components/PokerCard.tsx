'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { CARD_VALUES, COFFEE_CARD, QUESTION_CARD } from '@/types'
import { getCardColors, type CardColorScheme } from '@/lib/cardColors'
import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'

export type CardAnimationState = 'idle' | 'lifting' | 'flying' | 'landing' | 'placed'

interface PokerCardProps {
  value: number | typeof COFFEE_CARD | typeof QUESTION_CARD
  isSelected?: boolean
  isRevealed?: boolean
  isHidden?: boolean
  variant?: 'default' | 'deck'
  onClick?: () => void
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  animationState?: CardAnimationState
}

// Get card colors based on value and state
const getCardColorClasses = (value: number | typeof COFFEE_CARD | typeof QUESTION_CARD, isSelected: boolean, isRevealed: boolean): CardColorScheme => {
  // Selected state takes precedence
  if (isSelected) {
    return {
      bg: 'bg-gradient-to-br from-primary to-blue-600',
      border: 'border-primary',
      text: 'text-white',
      shadow: 'shadow-lg shadow-blue-500/30',
      gradient: 'from-primary to-blue-600',
    }
  }
  
  // Face-down cards (not revealed) use default blue
  if (!isRevealed) {
    return {
      bg: 'bg-gradient-to-br from-primary to-blue-700',
      border: 'border-blue-400',
      text: 'text-white',
      shadow: 'shadow-blue-500/30',
      gradient: 'from-primary to-blue-700',
    }
  }
  
  // Revealed cards use value-based colors
  return getCardColors(value)
}

// Get static color for deck cards (always show value color)
const getDeckCardColors = (value: number | typeof COFFEE_CARD | typeof QUESTION_CARD, isSelected: boolean): CardColorScheme => {
  if (isSelected) {
    return {
      bg: 'bg-gradient-to-br from-primary to-blue-600',
      border: 'border-primary',
      text: 'text-white',
      shadow: 'shadow-lg shadow-blue-500/30',
      gradient: 'from-primary to-blue-600',
    }
  }
  
  // For deck cards, always show value-based colors
  const colors = getCardColors(value)
  return colors
}

export function PokerCard({ 
  value, 
  isSelected = false, 
  isRevealed = false, 
  isHidden = false,
  variant = 'default',
  onClick, 
  disabled = false, 
  size = 'md',
  animationState = 'idle',
}: PokerCardProps) {
  const sizeClasses = {
    sm: 'w-8 h-11 text-sm sm:w-10 sm:h-14 sm:text-base',
    md: 'w-10 h-14 text-lg sm:w-14 sm:h-20 sm:text-2xl',
    lg: 'w-14 h-20 text-2xl sm:w-20 sm:h-28 sm:text-4xl',
  }

  const displayValue = value === COFFEE_CARD ? COFFEE_CARD : value === QUESTION_CARD ? QUESTION_CARD : value
  const colors = variant === 'deck' 
    ? getDeckCardColors(value, isSelected)
    : getCardColorClasses(value, isSelected, isRevealed)

  if (isHidden && !isRevealed) {
    return (
      <motion.div
        className={`relative ${sizeClasses[size]}`}
        whileHover={!disabled ? { 
          scale: 1.08, 
          y: -8,
          rotate: [-1, 1, -1, 0],
          transition: { duration: 0.2 }
        } : {}}
        whileTap={!disabled ? { scale: 0.92, rotate: 2 } : {}}
        initial={false}
      >
        <motion.div
          className={`
            w-full h-full rounded-lg bg-gradient-to-br from-primary to-blue-700
            flex items-center justify-center
            border-2 border-blue-400 shadow-md
            ${isSelected ? 'ring-2 ring-primary ring-offset-2' : ''}
          `}
          animate={{
            background: [
              'linear-gradient(135deg, #0052CC 0%, #1E40AF 100%)',
              'linear-gradient(135deg, #1E40AF 0%, #0052CC 100%)',
              'linear-gradient(135deg, #0052CC 0%, #1E40AF 100%)',
            ],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        >
          <motion.div 
            className="text-blue-200 font-semibold text-xl"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            ?
          </motion.div>
        </motion.div>
      </motion.div>
    )
  }

  return (
    <motion.div
      className={`relative ${sizeClasses[size]} cursor-pointer`}
      onClick={() => !disabled && onClick?.()}
      whileHover={!disabled ? { 
        scale: 1.08, 
        y: -8,
        rotate: [-0.5, 0.5, -0.5, 0],
        transition: { duration: 0.15 }
      } : {}}
      whileTap={!disabled ? { 
        scale: 0.92, 
        y: -4,
        rotate: 1,
        transition: { duration: 0.1 }
      } : {}}
      animate={isSelected ? { 
        y: -10,
        rotate: [0, -1, 1, 0],
        transition: { duration: 0.3 }
      } : { y: 0, rotate: 0 }}
      initial={{ scale: 0.8, opacity: 0 }}
      whileInView={{ scale: 1, opacity: 1 }}
      viewport={{ once: true }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 25,
      }}
    >
      <motion.div 
        className={`
          w-full h-full rounded-lg
          flex items-center justify-center
          border-2 transition-all duration-200
          ${colors.bg} ${colors.border} ${colors.shadow}
          ${isSelected ? 'ring-2 ring-primary ring-offset-2 elevation-medium' : ''}
        `}
        whileHover={!disabled && !isSelected ? {
          boxShadow: '0 12px 24px rgba(0,82,204,0.15)',
        } : {}}
      >
        <motion.span 
          className={`font-bold ${colors.text}`}
          animate={isSelected ? {
            scale: [1, 1.15, 1],
          } : {}}
          transition={{ duration: 0.3 }}
        >
          {displayValue}
        </motion.span>
      </motion.div>
    </motion.div>
  )
}

// Flying card animation component for the dramatic placement
interface FlyingCardProps {
  value: number | typeof COFFEE_CARD | typeof QUESTION_CARD
  startRect: { left: number; top: number; width: number; height: number }
  endRect: { left: number; top: number; width: number; height: number }
  onComplete?: () => void
}

export function FlyingCard({ value, startRect, endRect, onComplete }: FlyingCardProps) {
  const displayValue = value === COFFEE_CARD ? COFFEE_CARD : value === QUESTION_CARD ? QUESTION_CARD : value
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])
  
  // Calculate positions relative to viewport (for position: fixed)
  const startX = startRect.left + startRect.width / 2 - 28 // 28 = half of 56px card width
  const startY = startRect.top + startRect.height / 2 - 40 // 40 = half of 80px card height
  const endX = endRect.left + endRect.width / 2 - 28
  const endY = endRect.top + endRect.height / 2 - 40
  
  // Calculate arc midpoint (higher than straight line)
  const midX = (startX + endX) / 2
  const midY = Math.min(startY, endY) - 100 // Arc height
  
  const content = (
    <motion.div
      className="fixed w-14 h-20 pointer-events-none"
      style={{ 
        zIndex: 9999,
        left: 0,
        top: 0,
      }}
      initial={{
        x: startX,
        y: startY,
        scale: 1,
        rotate: (Math.random() - 0.5) * 6,
      }}
      animate={{
        x: [startX, midX, endX],
        y: [startY, midY, endY],
        scale: [1, 1.15, 1],
        rotate: [(Math.random() - 0.5) * 3, (Math.random() - 0.5) * 6, 0],
      }}
      transition={{
        duration: 0.7,
        times: [0, 0.5, 1],
        ease: [0.25, 0.1, 0.25, 1],
      }}
      onAnimationComplete={onComplete}
    >
      <motion.div
        className="w-full h-full rounded-lg bg-surface border-2 border-primary shadow-2xl flex items-center justify-center"
        animate={{
          scaleY: [1, 1, 0.95, 1],
          scaleX: [1, 1, 1.05, 1],
          boxShadow: [
            '0 10px 30px rgba(0,0,0,0.3)',
            '0 25px 50px rgba(0,0,0,0.4)',
            '0 5px 15px rgba(0,0,0,0.2)',
            '0 2px 8px rgba(0,0,0,0.15)',
          ],
        }}
        transition={{
          duration: 0.7,
          times: [0, 0.5, 0.85, 1],
        }}
      >
        <span className="font-bold text-primary text-2xl">{displayValue}</span>
      </motion.div>
    </motion.div>
  )
  
  if (!mounted) return null
  return createPortal(content, document.body)
}

export function PokerCardDeck({
  selectedValue,
  onCardClick,
  disabled = false,
  animatingCard = null,
}: {
  selectedValue: number | typeof COFFEE_CARD | typeof QUESTION_CARD | null
  onCardClick: (value: number | typeof COFFEE_CARD | typeof QUESTION_CARD, rect: DOMRect) => void
  disabled?: boolean
  animatingCard?: number | typeof COFFEE_CARD | typeof QUESTION_CARD | null
}) {
  const cardRefs = useRef<Record<string | number, HTMLDivElement | null>>({})

  const handleClick = (value: number | typeof COFFEE_CARD | typeof QUESTION_CARD) => {
    const element = cardRefs.current[value]
    if (element) {
      const rect = element.getBoundingClientRect()
      onCardClick(value, rect)
    }
  }

  return (
    <div className="flex flex-wrap justify-center gap-1 sm:gap-2 p-3 sm:p-4">
      {CARD_VALUES.map((value) => (
        <div
          key={value}
          ref={(el) => { cardRefs.current[value] = el }}
          className={animatingCard === value ? 'opacity-0' : ''}
        >
          <PokerCard
            value={value}
            isSelected={selectedValue === value && animatingCard !== value}
            variant="deck"
            onClick={() => handleClick(value)}
            disabled={disabled || animatingCard !== null}
            size="md"
          />
        </div>
      ))}
      <div
        ref={(el) => { cardRefs.current[QUESTION_CARD] = el }}
        className={animatingCard === QUESTION_CARD ? 'opacity-0' : ''}
      >
        <PokerCard
          value={QUESTION_CARD}
          isSelected={selectedValue === QUESTION_CARD && animatingCard !== QUESTION_CARD}
          variant="deck"
          onClick={() => handleClick(QUESTION_CARD)}
          disabled={disabled || animatingCard !== null}
          size="md"
        />
      </div>
      <div
        ref={(el) => { cardRefs.current[COFFEE_CARD] = el }}
        className={animatingCard === COFFEE_CARD ? 'opacity-0' : ''}
      >
        <PokerCard
          value={COFFEE_CARD}
          isSelected={selectedValue === COFFEE_CARD && animatingCard !== COFFEE_CARD}
          variant="deck"
          onClick={() => handleClick(COFFEE_CARD)}
          disabled={disabled || animatingCard !== null}
          size="md"
        />
      </div>
    </div>
  )
}
