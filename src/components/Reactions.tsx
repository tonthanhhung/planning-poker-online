'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'

// --- types ---

interface FlyingEmoji {
  id: string
  emoji: string
  startX: number
  startY: number
  endX: number
  endY: number
  playerName: string
  targetPlayerId?: string
  // seeded randomness params (computed at creation for deterministic replay)
  seed: number
  flightDuration: number // 500-900ms
  arcHeight: number      // how high the arc goes (randomized)
  spinDirection: number  // 1 or -1
}

// settled emoji that sticks near the card after animation
interface SettledEmoji {
  id: string
  emoji: string
  targetPlayerId: string
  offsetX: number
  offsetY: number
  rotation: number
  createdAt: number
}

const REACTIONS = [
  { emoji: '👍', label: 'Like' },
  { emoji: '❤️', label: 'Love' },
  { emoji: '🎉', label: 'Celebrate' },
  { emoji: '🤔', label: 'Think' },
  { emoji: '😂', label: 'Laugh' },
  { emoji: '👎', label: 'Dislike' },
  { emoji: '🍺', label: 'Cheers' },
  { emoji: '☕', label: 'Coffee' },
  { emoji: '🔥', label: 'Fire' },
  { emoji: '💩', label: 'Poop' },
]

interface ReactionsProps {
  onReact: (emoji: string) => void
}

export function ReactionPicker({ onReact }: ReactionsProps) {
  const [showPicker, setShowPicker] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setShowPicker(!showPicker)}
        className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-full text-white font-semibold shadow-lg transition-all transform hover:scale-105"
      >
        🎭 React
      </button>

      <AnimatePresence>
        {showPicker && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-gray-800 rounded-xl p-3 shadow-2xl border border-gray-700 z-50"
          >
            <div className="grid grid-cols-5 gap-2">
              {REACTIONS.map(({ emoji, label }) => (
                <button
                  key={emoji}
                  onClick={() => {
                    onReact(emoji)
                    setShowPicker(false)
                  }}
                  className="w-10 h-10 flex items-center justify-center text-2xl hover:bg-gray-700 rounded-lg transition-colors"
                  title={label}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// --- seeded random helper (deterministic per emoji) ---
function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

// --- physics constants ---
const GRAVITY = 1800       // px/s², simulates downward pull
const BOUNCE_DAMPING = 0.4 // velocity multiplied by this after each bounce
const MAX_BOUNCES = 2
const SETTLE_FADE_DURATION = 300 // ms
const MAX_SETTLED_PER_CARD = 5

// --- single flying emoji rendered with rAF physics ---
function FlyingEmojiElement({ reaction, onComplete }: {
  reaction: FlyingEmoji
  onComplete: (settled: SettledEmoji) => void
}) {
  const elRef = useRef<HTMLDivElement>(null)
  const startTimeRef = useRef<number | null>(null)

  useEffect(() => {
    const el = elRef.current
    if (!el) return

    // measure the emoji element size so we can center it on targets
    const emojiRect = el.getBoundingClientRect()
    const halfW = emojiRect.width / 2 || 15
    const halfH = emojiRect.height / 2 || 15

    const rand = seededRandom(reaction.seed)
    const flightMs = reaction.flightDuration
    const arcH = reaction.arcHeight
    const spin = reaction.spinDirection

    // re-read the actual target card position right now (not the stale creation-time value)
    // this fixes targeting when cards moved between creation and animation start
    let ex = reaction.endX
    let ey = reaction.endY
    if (reaction.targetPlayerId) {
      const targetEl = document.querySelector(`[data-player-card="${reaction.targetPlayerId}"]`)
      if (targetEl) {
        const rect = targetEl.getBoundingClientRect()
        ex = rect.left + rect.width / 2
        ey = rect.top + rect.height / 2
      }
    }
    // offset so the CENTER of the emoji hits the target, not its top-left corner
    ex -= halfW
    ey -= halfH

    // also offset start coordinates for centering
    const sx = reaction.startX - halfW
    const sy = reaction.startY - halfH

    // control point: midpoint offset upward by arcHeight, with some horizontal jitter
    const cx = (sx + ex) / 2 + (rand() - 0.5) * 120
    const cy = Math.min(sy, ey) - arcH

    // flight rotation range
    const maxFlightRotation = 15 + rand() * 20

    // post-impact state
    let phase: 'flight' | 'impact' | 'drop' | 'bounce1' | 'bounce2' | 'settle' = 'flight'
    let impactTime = 0
    let dropStartY = ey
    let dropVelocity = 0
    let bounceCount = 0
    let bounceBaseY = ey
    let bounceVelocity = 0
    let settleStartTime = 0
    let currentX = ex
    let currentY = ey

    const impactDuration = 80
    const dropDistance = 12 + rand() * 10

    let animId: number

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) startTimeRef.current = timestamp
      const elapsed = timestamp - startTimeRef.current

      if (phase === 'flight') {
        const t = Math.min(elapsed / flightMs, 1)
        const et = t < 0.5
          ? 2 * t * t
          : 1 - Math.pow(-2 * t + 2, 2) / 2

        const oneMinusT = 1 - et
        const px = oneMinusT * oneMinusT * sx + 2 * oneMinusT * et * cx + et * et * ex
        const py = oneMinusT * oneMinusT * sy + 2 * oneMinusT * et * cy + et * et * ey

        const scale = 0.3 + et * 0.9
        const rotation = spin * maxFlightRotation * Math.sin(et * Math.PI)

        el.style.transform = `translate(${px}px, ${py}px) scale(${scale}) rotate(${rotation}deg)`
        el.style.opacity = '1'

        currentX = px
        currentY = py

        if (t >= 1) {
          phase = 'impact'
          impactTime = elapsed
          currentX = ex
          currentY = ey
        }
      } else if (phase === 'impact') {
        const impactElapsed = elapsed - impactTime
        const it = Math.min(impactElapsed / impactDuration, 1)

        let scaleX: number, scaleY: number
        if (it < 0.5) {
          const sq = it * 2
          scaleX = 1.2 + sq * 0.3
          scaleY = 1.2 - sq * 0.4
        } else {
          const rs = (it - 0.5) * 2
          scaleX = 1.5 - rs * 0.4
          scaleY = 0.8 + rs * 0.3
        }

        const shakeX = (rand() - 0.5) * 4 * (1 - it)
        const microRotation = (rand() - 0.5) * 10 * (1 - it)

        el.style.transform = `translate(${currentX + shakeX}px, ${currentY}px) scale(${scaleX}, ${scaleY}) rotate(${microRotation}deg)`

        if (it >= 1) {
          phase = 'drop'
          dropStartY = currentY
          dropVelocity = 60 + rand() * 40
        }
      } else if (phase === 'drop') {
        const dropElapsed = (elapsed - impactTime - impactDuration) / 1000
        const dy = dropVelocity * dropElapsed + 0.5 * GRAVITY * dropElapsed * dropElapsed
        const py = dropStartY + dy

        const driftX = (rand() - 0.5) * 6
        currentY = py

        el.style.transform = `translate(${currentX + driftX}px, ${py}px) scale(1.1) rotate(${spin * 5}deg)`

        if (dy >= dropDistance) {
          phase = 'bounce1'
          bounceBaseY = py
          bounceVelocity = -(Math.sqrt(2 * GRAVITY * dropDistance) * BOUNCE_DAMPING)
          bounceCount = 0
          settleStartTime = elapsed
        }
      } else if (phase === 'bounce1' || phase === 'bounce2') {
        const bounceElapsed = (elapsed - settleStartTime) / 1000
        const by = bounceVelocity * bounceElapsed + 0.5 * GRAVITY * bounceElapsed * bounceElapsed
        const py = bounceBaseY + by

        const bounceRot = spin * 8 * Math.sin(bounceElapsed * 12) * (1 - bounceElapsed * 2)

        el.style.transform = `translate(${currentX}px, ${py}px) scale(1.05) rotate(${bounceRot}deg)`

        if (by >= 0 && bounceElapsed > 0.02) {
          bounceCount++
          if (bounceCount >= MAX_BOUNCES) {
            phase = 'settle'
            settleStartTime = elapsed
            currentY = bounceBaseY
          } else {
            phase = 'bounce2'
            bounceBaseY = py
            bounceVelocity = bounceVelocity * BOUNCE_DAMPING
            settleStartTime = elapsed
          }
        }
      } else if (phase === 'settle') {
        const settleElapsed = elapsed - settleStartTime
        const fadeT = Math.min(settleElapsed / SETTLE_FADE_DURATION, 1)

        el.style.transform = `translate(${currentX}px, ${currentY}px) scale(${1.05 - fadeT * 0.15}) rotate(0deg)`
        el.style.opacity = String(1 - fadeT * 0.6)

        if (fadeT >= 1) {
          const settledEmoji: SettledEmoji = {
            id: reaction.id + '-settled',
            emoji: reaction.emoji,
            targetPlayerId: reaction.targetPlayerId || '',
            offsetX: (rand() - 0.5) * 30,
            offsetY: (rand() - 0.5) * 16 + 8,
            rotation: (rand() - 0.5) * 20,
            createdAt: Date.now(),
          }
          onComplete(settledEmoji)
          return
        }
      }

      animId = requestAnimationFrame(animate)
    }

    animId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animId)
    }
  }, [reaction, onComplete])

  return (
    <div
      ref={elRef}
      className="absolute text-3xl pointer-events-none will-change-transform"
      style={{
        left: 0,
        top: 0,
        opacity: 0,
        filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.25))',
      }}
    >
      {reaction.emoji}
    </div>
  )
}

// --- impact puff particle ---
function ImpactPuff({ x, y, onDone }: { x: number; y: number; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 500)
    return () => clearTimeout(timer)
  }, [onDone])

  const particles = Array.from({ length: 5 }, (_, i) => {
    const angle = (i / 5) * Math.PI * 2 + Math.random() * 0.5
    const dist = 15 + Math.random() * 15
    return {
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist,
      size: 3 + Math.random() * 4,
      delay: Math.random() * 0.05,
    }
  })

  return (
    <>
      {particles.map((p, i) => (
        <motion.div
          key={i}
          initial={{ x, y, scale: 1, opacity: 0.7 }}
          animate={{
            x: x + p.dx,
            y: y + p.dy,
            scale: 0,
            opacity: 0,
          }}
          transition={{
            duration: 0.4,
            delay: p.delay,
            ease: 'easeOut',
          }}
          className="absolute rounded-full bg-yellow-300/60 pointer-events-none"
          style={{ width: p.size, height: p.size }}
        />
      ))}
    </>
  )
}

// --- main flying reactions container ---
// rendered via portal to document.body so that ancestor transforms/filters
// (e.g. framer-motion, backdrop-blur) don't break position:fixed targeting
export function FlyingReactions({
  reactions,
  onSettled,
}: {
  reactions: FlyingEmoji[]
  onSettled?: (settled: SettledEmoji) => void
}) {
  const [puffs, setPuffs] = useState<{ id: string; x: number; y: number }[]>([])
  const [mounted, setMounted] = useState(false)

  // portal needs to wait for client-side mount
  useEffect(() => {
    setMounted(true)
  }, [])

  const handleComplete = useCallback((settled: SettledEmoji) => {
    const targetEl = document.querySelector(`[data-player-card="${settled.targetPlayerId}"]`)
    if (targetEl) {
      const rect = targetEl.getBoundingClientRect()
      setPuffs(prev => [...prev, {
        id: settled.id + '-puff',
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      }])
    }

    if (onSettled) {
      onSettled(settled)
    }
  }, [onSettled])

  const removePuff = useCallback((id: string) => {
    setPuffs(prev => prev.filter(p => p.id !== id))
  }, [])

  const content = (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {reactions.map((reaction) => (
        <FlyingEmojiElement
          key={reaction.id}
          reaction={reaction}
          onComplete={handleComplete}
        />
      ))}
      {puffs.map((puff) => (
        <ImpactPuff
          key={puff.id}
          x={puff.x}
          y={puff.y}
          onDone={() => removePuff(puff.id)}
        />
      ))}
    </div>
  )

  // render to document.body via portal to escape any ancestor transforms
  if (!mounted) return null
  return createPortal(content, document.body)
}

// --- settled emojis overlay (rendered per card in PokerTable) ---
export function SettledEmojis({ emojis }: { emojis: SettledEmoji[] }) {
  // show the most recent MAX_SETTLED_PER_CARD
  const visible = emojis.slice(-MAX_SETTLED_PER_CARD)

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible">
      <AnimatePresence>
        {visible.map((e) => (
          <motion.div
            key={e.id}
            initial={{ opacity: 0.5, scale: 0.8 }}
            animate={{ opacity: 0.85, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.3 }}
            className="absolute text-lg"
            style={{
              left: `calc(50% + ${e.offsetX}px)`,
              top: `calc(100% + ${e.offsetY}px)`,
              transform: `rotate(${e.rotation}deg)`,
              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))',
            }}
          >
            {e.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export { REACTIONS, MAX_SETTLED_PER_CARD }
export type { FlyingEmoji, SettledEmoji }
