'use client'

import { motion, AnimatePresence, useAnimation } from 'framer-motion'
import { useState, useCallback, useRef, useEffect } from 'react'
import { COFFEE_CARD } from '@/types'
import { createPortal } from 'react-dom'

export type CardAnimationState = 'idle' | 'lifting' | 'flying' | 'landing' | 'placed'

interface FlyingCard {
  id: string
  value: number | typeof COFFEE_CARD
  startX: number
  startY: number
  endX: number
  endY: number
  rotation: number
  state: CardAnimationState
}

interface CardPlacementAnimationProps {
  gameId: string
  currentPlayerId: string | null
  onAnimationComplete?: () => void
}

// Generate a seeded random for deterministic animations
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

// Create a flying card with physics parameters
function createFlyingCard(
  value: number | typeof COFFEE_CARD,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  seed: number,
): FlyingCard {
  return {
    id: `${value}-${Date.now()}-${seed}`,
    value,
    startX,
    startY,
    endX,
    endY,
    rotation: (seededRandom(seed) - 0.5) * 6, // ±3° rotation
    state: 'idle',
  }
}

export function useCardPlacementAnimation() {
  const [flyingCards, setFlyingCards] = useState<FlyingCard[]>([])
  const [animatingCard, setAnimatingCard] = useState<{ value: number | typeof COFFEE_CARD; state: CardAnimationState } | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const startPlacement = useCallback((
    value: number | typeof COFFEE_CARD,
    cardElement: HTMLElement,
    targetElement: HTMLElement | null,
  ) => {
    const cardRect = cardElement.getBoundingClientRect()
    const startX = cardRect.left + cardRect.width / 2
    const startY = cardRect.top + cardRect.height / 2

    // If no target, animate to center screen
    let endX = window.innerWidth / 2
    let endY = window.innerHeight / 2

    if (targetElement) {
      const targetRect = targetElement.getBoundingClientRect()
      endX = targetRect.left + targetRect.width / 2
      endY = targetRect.top + targetRect.height / 2
    }

    const seed = Math.floor(Math.random() * 2147483647)
    const newCard = createFlyingCard(value, startX, startY, endX, endY, seed)

    setAnimatingCard({ value, state: 'lifting' })

    // Start the animation sequence
    setTimeout(() => {
      setAnimatingCard({ value, state: 'flying' })
      setFlyingCards(prev => [...prev, { ...newCard, state: 'flying' }])
    }, 150) // Lift phase duration

    // Cleanup after animation
    setTimeout(() => {
      setFlyingCards(prev => prev.filter(c => c.id !== newCard.id))
      setAnimatingCard({ value, state: 'placed' })
    }, 850) // Total animation duration

    return newCard.id
  }, [])

  const isCardAnimating = useCallback((value: number | typeof COFFEE_CARD) => {
    return animatingCard?.value === value && animatingCard.state !== 'placed'
  }, [animatingCard])

  return {
    flyingCards,
    animatingCard,
    startPlacement,
    isCardAnimating,
    setFlyingCards,
  }
}

// Individual flying card component with full Yu-Gi-Oh animation
function FlyingCardElement({
  card,
  onComplete,
}: {
  card: FlyingCard
  onComplete?: () => void
}) {
  const controls = useAnimation()

  useEffect(() => {
    const animateCard = async () => {
      // Phase 1: Lift (150ms)
      await controls.start({
        scale: 1.1,
        y: -20,
        rotate: card.rotation,
        boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
        transition: {
          duration: 0.15,
          ease: [0.25, 0.46, 0.45, 0.94], // ease-out
        },
      })

      // Calculate arc path
      const midX = (card.startX + card.endX) / 2
      const midY = (card.startY + card.endY) / 2 - 60 // Arc height

      // Phase 2: Flight (500ms)
      await controls.start({
        x: [0, midX - card.startX, card.endX - card.startX],
        y: [0, midY - card.startY, card.endY - card.startY],
        scale: [1.1, 1.15, 1.0],
        rotate: [card.rotation, card.rotation * 0.5, 0],
        boxShadow: [
          '0 20px 40px rgba(0,0,0,0.3)',
          '0 30px 60px rgba(0,0,0,0.4)',
          '0 10px 20px rgba(0,0,0,0.2)',
        ],
        transition: {
          duration: 0.5,
          ease: [0.4, 0, 0.2, 1], // Custom bezier for arc motion
          times: [0, 0.5, 1], // Keyframe timing
        },
      })

      // Phase 3: Impact (200ms)
      // Subtle screen shake effect could be added here
      await controls.start({
        scaleY: [1, 0.96, 1.02, 1],
        scaleX: [1, 1.04, 0.98, 1],
        y: [0, 5, -2, 0],
        boxShadow: [
          '0 10px 20px rgba(0,0,0,0.2)',
          '0 15px 30px rgba(59,130,246,0.3)', // Blue glow on impact
          '0 8px 16px rgba(0,0,0,0.15)',
          '0 2px 8px rgba(0,0,0,0.1)',
        ],
        transition: {
          duration: 0.2,
          ease: [0.68, -0.55, 0.265, 1.55], // Bouncy impact
        },
      })

      onComplete?.()
    }

    animateCard()
  }, [controls, card, onComplete])

  const displayValue = card.value === COFFEE_CARD ? '☕' : card.value

  return (
    <motion.div
      className="fixed z-50 pointer-events-none"
      style={{
        left: card.startX,
        top: card.startY,
        x: '-50%',
        y: '-50%',
      }}
      initial={{
        scale: 1,
        x: 0,
        y: 0,
        rotate: 0,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}
      animate={controls}
    >
      <div className="w-14 h-20 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 border-2 border-blue-400 shadow-xl flex items-center justify-center">
        <span className="text-2xl font-bold text-white">{displayValue}</span>
      </div>
    </motion.div>
  )
}

// Container component for all flying cards
export function CardPlacementOverlay({
  flyingCards,
  onCardComplete,
}: {
  flyingCards: FlyingCard[]
  onCardComplete?: (id: string) => void
}) {
  const content = (
    <AnimatePresence>
      {flyingCards.map((card) => (
        <FlyingCardElement
          key={card.id}
          card={card}
          onComplete={() => onCardComplete?.(card.id)}
        />
      ))}
    </AnimatePresence>
  )

  return createPortal(content, document.body)
}

// Hook for handling card placement with proper state management
export function useCardPlacement(
  gameId: string,
  currentPlayerId: string | null,
  onPlacementComplete?: () => void,
) {
  const [isPlacing, setIsPlacing] = useState(false)
  const [placedCard, setPlacedCard] = useState<number | typeof COFFEE_CARD | null>(null)
  const pendingPlacementRef = useRef<{ value: number | typeof COFFEE_CARD; cardEl: HTMLElement } | null>(null)

  const startPlacement = useCallback((
    value: number | typeof COFFEE_CARD,
    cardElement: HTMLElement,
    targetSelector?: string,
  ) => {
    if (isPlacing || placedCard !== null) {
      return null // Prevent duplicate placement
    }

    setIsPlacing(true)
    pendingPlacementRef.current = { value, cardEl: cardElement }

    // Find target element (player's slot on table)
    const targetEl = targetSelector
      ? document.querySelector(targetSelector) as HTMLElement | null
      : null

    // Dispatch custom event for animation
    const event = new CustomEvent('card-placement-start', {
      detail: {
        value,
        startRect: cardElement.getBoundingClientRect(),
        targetRect: targetEl?.getBoundingClientRect() || null,
        playerId: currentPlayerId,
        gameId,
      },
    })
    window.dispatchEvent(event)

    return value
  }, [isPlacing, placedCard, currentPlayerId, gameId])

  const completePlacement = useCallback((value: number | typeof COFFEE_CARD) => {
    setPlacedCard(value)
    setIsPlacing(false)
    pendingPlacementRef.current = null
    onPlacementComplete?.()
  }, [onPlacementComplete])

  const resetPlacement = useCallback(() => {
    setPlacedCard(null)
    setIsPlacing(false)
    pendingPlacementRef.current = null
  }, [])

  return {
    isPlacing,
    placedCard,
    startPlacement,
    completePlacement,
    resetPlacement,
    pendingPlacement: pendingPlacementRef.current,
  }
}
