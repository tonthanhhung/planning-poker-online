'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { CARD_VALUES, COFFEE_CARD } from '@/types'
import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'

export type CardAnimationState = 'idle' | 'lifting' | 'flying' | 'landing' | 'placed'

interface PokerCardProps {
  value: number | typeof COFFEE_CARD
  isSelected?: boolean
  isRevealed?: boolean
  isHidden?: boolean
  onClick?: () => void
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  animationState?: CardAnimationState
}

export function PokerCard({ 
  value, 
  isSelected = false, 
  isRevealed = false, 
  isHidden = false,
  onClick, 
  disabled = false, 
  size = 'md',
  animationState = 'idle',
}: PokerCardProps) {
  const sizeClasses = {
    sm: 'w-10 h-14 text-base',
    md: 'w-14 h-20 text-2xl',
    lg: 'w-20 h-28 text-4xl',
  }

  const displayValue = value === COFFEE_CARD ? COFFEE_CARD : value

  if (isHidden && !isRevealed) {
    return (
      <motion.div
        className={`relative ${sizeClasses[size]}`}
        whileHover={!disabled ? { scale: 1.05, y: -5 } : {}}
        whileTap={!disabled ? { scale: 0.95 } : {}}
      >
        <div className={`
          w-full h-full rounded-lg bg-gradient-to-br from-blue-600 to-blue-800
          flex items-center justify-center
          border-2 border-blue-400 shadow-xl
          ${isSelected ? 'ring-4 ring-yellow-400 ring-offset-2' : ''}
        `}>
          <div className="text-blue-300 font-bold text-xl">?</div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      className={`relative ${sizeClasses[size]} cursor-pointer`}
      onClick={() => !disabled && onClick?.()}
      whileHover={!disabled ? { scale: 1.05, y: -5 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      animate={isSelected ? { y: -10 } : { y: 0 }}
    >
      <div className={`
        w-full h-full rounded-lg
        flex items-center justify-center
        border-2 transition-all duration-200
        ${isSelected 
          ? 'bg-blue-500 border-blue-500 shadow-lg shadow-blue-200' 
          : 'bg-white border-blue-300 hover:border-blue-400 shadow-sm'}
      `}>
        <span className={`font-bold ${isSelected ? 'text-white' : 'text-blue-600'}`}>
          {displayValue}
        </span>
      </div>
    </motion.div>
  )
}

// Flying card animation component for the dramatic placement
interface FlyingCardProps {
  value: number | typeof COFFEE_CARD
  startRect: { left: number; top: number; width: number; height: number }
  endRect: { left: number; top: number; width: number; height: number }
  onComplete?: () => void
}

export function FlyingCard({ value, startRect, endRect, onComplete }: FlyingCardProps) {
  const displayValue = value === COFFEE_CARD ? COFFEE_CARD : value
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
        className="w-full h-full rounded-lg bg-white border-2 border-blue-500 shadow-2xl flex items-center justify-center"
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
        <span className="font-bold text-blue-600 text-2xl">{displayValue}</span>
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
  selectedValue: number | typeof COFFEE_CARD | null
  onCardClick: (value: number | typeof COFFEE_CARD, rect: DOMRect) => void
  disabled?: boolean
  animatingCard?: number | typeof COFFEE_CARD | null
}) {
  const cardRefs = useRef<Record<string | number, HTMLDivElement | null>>({})

  const handleClick = (value: number | typeof COFFEE_CARD) => {
    const element = cardRefs.current[value]
    if (element) {
      const rect = element.getBoundingClientRect()
      onCardClick(value, rect)
    }
  }

  return (
    <div className="flex flex-wrap justify-center gap-2 p-4">
      {CARD_VALUES.map((value) => (
        <div
          key={value}
          ref={(el) => { cardRefs.current[value] = el }}
          className={animatingCard === value ? 'opacity-0' : ''}
        >
          <PokerCard
            value={value}
            isSelected={selectedValue === value && animatingCard !== value}
            onClick={() => handleClick(value)}
            disabled={disabled || animatingCard !== null}
            size="md"
          />
        </div>
      ))}
      <div
        ref={(el) => { cardRefs.current[COFFEE_CARD] = el }}
        className={animatingCard === COFFEE_CARD ? 'opacity-0' : ''}
      >
        <PokerCard
          value={COFFEE_CARD}
          isSelected={selectedValue === COFFEE_CARD && animatingCard !== COFFEE_CARD}
          onClick={() => handleClick(COFFEE_CARD)}
          disabled={disabled || animatingCard !== null}
          size="md"
        />
      </div>
    </div>
  )
}
