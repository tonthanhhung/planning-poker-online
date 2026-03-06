'use client'

import { useState, useEffect, useRef, useCallback, ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { EmojiPicker } from 'frimousse'


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
  isImage?: boolean  // New field to indicate if this is an image reaction
  imageUrl?: string  // New field to store image URL
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
  isImage?: boolean  // New field to indicate if this is an image reaction
  imageUrl?: string  // New field to store image URL
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

const RECENT_EMOJIS_KEY = 'planning_poker_recent_emojis'
const MAX_RECENT = 8
const DEFAULT_EMOJIS = ['👍', '❤️', '🎉']

function useRecentEmojis() {
  const [recentEmojis, setRecentEmojis] = useState<string[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_EMOJIS
    try {
      const stored = localStorage.getItem(RECENT_EMOJIS_KEY)
      return stored ? JSON.parse(stored) : DEFAULT_EMOJIS
    } catch {
      return DEFAULT_EMOJIS
    }
  })

  const addRecentEmoji = useCallback((emoji: string) => {
    setRecentEmojis(prev => {
      const filtered = prev.filter(e => e !== emoji)
      const next = [emoji, ...filtered].slice(0, MAX_RECENT)
      localStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return { recentEmojis, addRecentEmoji }
}

interface ReactionsProps {
  onReact: (emoji: string, isImage?: boolean, imageUrl?: string) => void
  onMouseLeave?: () => void
}

export function ReactionPicker({ onReact, onMouseLeave }: ReactionsProps) {
  const { recentEmojis, addRecentEmoji } = useRecentEmojis()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const handleReact = (emoji: string, isImage?: boolean, imageUrl?: string) => {
    if (!isImage) addRecentEmoji(emoji)
    onReact(emoji, isImage, imageUrl)
    setPickerOpen(false)
  }

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const imageUrl = event.target?.result as string
        if (imageUrl) {
          onReact(imageUrl, true, imageUrl)
          setPickerOpen(false)
        }
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <div onMouseLeave={onMouseLeave}>
      {/* Quick-bar */}
      <div className="flex gap-1 bg-gray-900/95 backdrop-blur-sm rounded-full px-2 py-1 shadow-lg border border-gray-700">
        {recentEmojis.map((emoji) => (
          <button
            key={emoji}
            onClick={() => handleReact(emoji)}
            className="w-8 h-8 flex items-center justify-center text-lg hover:bg-gray-700 rounded-full transition-colors"
          >
            {emoji}
          </button>
        ))}
        <button
          onClick={(e) => { e.stopPropagation(); setPickerOpen(v => !v) }}
          className="w-8 h-8 flex items-center justify-center text-xl font-bold text-white hover:bg-gray-700 rounded-full transition-colors"
          title="More reactions"
        >
          +
        </button>
      </div>

      {/* Full emoji picker — absolutely positioned below the quick-bar */}
      <AnimatePresence>
        {pickerOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full mt-2 rounded-xl overflow-hidden shadow-2xl border border-gray-700 bg-gray-900"
            style={{ zIndex: 1000000 }}
            onClick={(e) => e.stopPropagation()}
          >
            <EmojiPicker.Root
              className="flex flex-col bg-gray-900"
              style={{ width: 300, height: 340 }}
              onEmojiSelect={({ emoji }) => handleReact(emoji)}
            >
              <EmojiPicker.Search
                className="mx-2 mt-2 mb-1 px-3 py-1.5 rounded-lg bg-gray-800 text-gray-100 text-sm placeholder-gray-500 outline-none border border-gray-700 focus:border-gray-500"
                placeholder="Search emoji…"
              />
              <EmojiPicker.Viewport className="flex-1 relative">
                <EmojiPicker.Loading className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
                  Loading…
                </EmojiPicker.Loading>
                <EmojiPicker.Empty className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
                  No emoji found.
                </EmojiPicker.Empty>
                <EmojiPicker.List
                  className="select-none pb-1"
                  components={{
                    CategoryHeader: ({ category, ...props }) => (
                      <div
                        className="bg-gray-900 px-3 pt-2 pb-1 text-xs font-medium text-gray-500 uppercase tracking-wide"
                        {...props}
                      >
                        {category.label}
                      </div>
                    ),
                    Row: ({ children, ...props }) => (
                      <div className="px-1.5" {...props}>{children}</div>
                    ),
                    Emoji: ({ emoji, ...props }) => (
                      <button
                        className="flex size-8 items-center justify-center rounded-md text-xl data-[active]:bg-gray-700 transition-colors"
                        {...props}
                      >
                        {emoji.emoji}
                      </button>
                    ),
                  }}
                />
              </EmojiPicker.Viewport>
            </EmojiPicker.Root>

            <div className="px-2 pb-2">
              <label className="flex items-center justify-center gap-1.5 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 text-sm cursor-pointer transition-colors">
                📷 Image
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
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
const GRAVITY = 1200       // px/s², slightly lower gravity for more visible bounces
const BOUNCE_DAMPING = 0.5 // velocity multiplied by this after each bounce
const MAX_BOUNCES = 3      // Allow more bounces for better realism
const MIN_BOUNCE_VELOCITY = 15 // minimum velocity to continue bouncing
const SETTLE_FADE_DURATION = 400 // ms, increased for smoother fade
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

    // measure the emoji/image element size so we can center it on targets
    const emojiRect = el.getBoundingClientRect()
    const halfW = emojiRect.width / 2 || (reaction.isImage ? 25 : 15) // Larger size for images
    const halfH = emojiRect.height / 2 || (reaction.isImage ? 25 : 15)

    const rand = seededRandom(reaction.seed)
    const flightMs = reaction.flightDuration * 1.5 // Slower flight speed
    const arcH = reaction.arcHeight * 1.2 // Higher arc for more natural look
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
    // also offset start coordinates for centering
    const sx = reaction.startX - halfW
    const sy = reaction.startY - halfH
    
    // offset so the emoji hits the EDGE of the card (not center)
    const cardWidth = 46
    const cameFromLeft = sx < ex
    
    if (cameFromLeft) {
      ex -= halfW + cardWidth/2
    } else {
      ex -= halfW - cardWidth/2
    }
    ey -= halfH

    // control point: midpoint offset upward by arcHeight, with some horizontal jitter
    const cx = (sx + ex) / 2 + (rand() - 0.5) * 150 // Increased jitter for more natural look
    const cy = Math.min(sy, ey) - arcH

    // flight rotation range - increased for more natural spinning
    const maxFlightRotation = 20 + rand() * 180 // Much more spinning

        // post-impact state
        let phase: 'flight' | 'impact' | 'drop' | 'bounce1' | 'bounce2' | 'settle' = 'flight'
        let impactTime = 0
        let dropStartY = ey
        let dropVelocity = 0
        let bounceCount = 0
        let bounceBaseY = ey
        let bounceVelocity = 0
        let bounceVelocityX = 0  // horizontal velocity for bouncing away
        let bounceBaseX = ex     // starting X for bounce
        let settleStartTime = 0
        let currentX = ex
        let currentY = ey
        
        // Determine bounce direction: bounce BACK toward where it came from
        // If came from left, bounce left (-), if from right, bounce right (+)
        const bounceDirection = cameFromLeft ? -1 : 1

        const impactDuration = 100 // Longer impact for smoother effect
        const dropDistance = 15 + rand() * 15 // More varied drop distance

    let animId: number

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) startTimeRef.current = timestamp
      const elapsed = timestamp - startTimeRef.current

      if (phase === 'flight') {
        const t = Math.min(elapsed / flightMs, 1)
        // Using a smoother easing function for more natural movement
        const et = t < 0.5
          ? 2 * t * t // Accelerate in first half
          : 1 - Math.pow(-2 * t + 2, 2) / 2 // Decelerate in second half

        const oneMinusT = 1 - et
        // Quadratic bezier curve for smooth flight path
        const px = oneMinusT * oneMinusT * sx + 2 * oneMinusT * et * cx + et * et * ex
        const py = oneMinusT * oneMinusT * sy + 2 * oneMinusT * et * cy + et * et * ey

        // More natural scaling effect
        const scale = 0.1 + et * 0.9
        // Continuous spinning during flight - more natural rotation
        const rotation = spin * (maxFlightRotation * et * 2) // Spin more continuously

        if (reaction.isImage && reaction.imageUrl) {
          el.style.transform = `translate(${px}px, ${py}px) scale(${scale}) rotate(${rotation}deg)`
          el.style.width = '50px'
          el.style.height = '50px'
        } else {
          el.style.transform = `translate(${px}px, ${py}px) scale(${scale}) rotate(${rotation}deg)`
        }
        
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
          scaleX = 1.2 + sq * 0.4
          scaleY = 1.2 - sq * 0.6
        } else {
          const rs = (it - 0.5) * 2
          scaleX = 1.6 - rs * 0.6
          scaleY = 0.6 + rs * 0.4
        }

        const shakeX = (rand() - 0.5) * 6 * (1 - it)
        const microRotation = (rand() - 0.5) * 20 * (1 - it)

        if (reaction.isImage && reaction.imageUrl) {
          el.style.transform = `translate(${currentX + shakeX}px, ${currentY}px) scale(${scaleX}, ${scaleY}) rotate(${microRotation}deg)`
          el.style.width = '50px'
          el.style.height = '50px'
        } else {
          el.style.transform = `translate(${currentX + shakeX}px, ${currentY}px) scale(${scaleX}, ${scaleY}) rotate(${microRotation}deg)`
        }

        if (it >= 1) {
          phase = 'bounce1'
          bounceCount = 0
          // Realistic bounce physics: use the impact momentum to determine bounce height
          bounceBaseY = currentY
          bounceBaseX = currentX
          // Much stronger initial bounce velocity for visible effect (200-350 px/s upward)
          bounceVelocity = -(200 + rand() * 150)
          // Add horizontal velocity to bounce AWAY from the card (80-150 px/s)
          bounceVelocityX = bounceDirection * (80 + rand() * 70)
          settleStartTime = elapsed
        }
      } else if (phase === 'bounce1' || phase === 'bounce2') {
        const bounceElapsed = (elapsed - settleStartTime) / 1000
        // Physics for bounce: apply gravity to the bounce velocity
        const currentVel = bounceVelocity + GRAVITY * bounceElapsed
        // Calculate new Y position using kinematic equation
        const currentPosY = bounceBaseY + bounceVelocity * bounceElapsed + 0.5 * GRAVITY * bounceElapsed * bounceElapsed
        // Calculate new X position (horizontal movement away from card)
        const currentPosX = bounceBaseX + bounceVelocityX * bounceElapsed

        // Check if it has hit the target surface again (currentPosY >= ey)
        if (currentPosY >= ey) {
          // Reset position to target Y (simulate contact with surface)
          currentY = ey

          // Apply damping to the velocities (energy loss during impact)
          bounceVelocity = -currentVel * BOUNCE_DAMPING
          bounceVelocityX = bounceVelocityX * 0.7 // lose some horizontal speed on each bounce

          bounceCount++

          // Check if bounce should end
          if (Math.abs(bounceVelocity) < MIN_BOUNCE_VELOCITY || bounceCount >= MAX_BOUNCES) {
            phase = 'settle'
            settleStartTime = elapsed
            currentY = ey // Ensure it stays at the target Y
          } else {
            // Prepare for next bounce
            bounceBaseY = currentY
            bounceBaseX = currentPosX
            settleStartTime = elapsed
            // Stay in bounce1 phase for all bounces - no need for bounce2 phase
          }
        } else {
          // Continue the bounce trajectory
          currentY = currentPosY
          currentX = currentPosX
        }

        // Apply rotation during bounce for more realistic movement
        const bounceRot = spin * 20 * Math.sin(bounceElapsed * 15) * (1 - bounceCount * 0.3)

        if (reaction.isImage && reaction.imageUrl) {
          el.style.transform = `translate(${currentX}px, ${currentY}px) scale(1.0) rotate(${bounceRot}deg)`
          el.style.width = '50px'
          el.style.height = '50px'
        } else {
          el.style.transform = `translate(${currentX}px, ${currentY}px) scale(1.0) rotate(${bounceRot}deg)`
        }
      } else if (phase === 'settle') {
        const settleElapsed = elapsed - settleStartTime
        const fadeT = Math.min(settleElapsed / SETTLE_FADE_DURATION, 1)

        if (reaction.isImage && reaction.imageUrl) {
          el.style.transform = `translate(${currentX}px, ${currentY}px) scale(${1.0 - fadeT * 0.2}) rotate(0deg)`
          el.style.width = '50px'
          el.style.height = '50px'
        } else {
          el.style.transform = `translate(${currentX}px, ${currentY}px) scale(${1.0 - fadeT * 0.2}) rotate(0deg)`
        }
        
        el.style.opacity = String(1 - fadeT * 0.6)

        if (fadeT >= 1) {
          const settledEmoji: SettledEmoji = {
            id: reaction.id + '-settled',
            emoji: reaction.emoji,
            targetPlayerId: reaction.targetPlayerId || '',
            offsetX: (rand() - 0.5) * 30,
            offsetY: (rand() - 0.5) * 16 + 8,
            rotation: (rand() - 0.5) * 30, // Increased rotation for settled emojis
            createdAt: Date.now(),
            isImage: reaction.isImage,
            imageUrl: reaction.imageUrl,
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
      className="absolute pointer-events-none will-change-transform"
      style={{
        left: 0,
        top: 0,
        opacity: 0,
        filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.25))',
      }}
    >
      {reaction.isImage && reaction.imageUrl ? (
        <img 
          src={reaction.imageUrl} 
          alt="Custom reaction" 
          className="w-12 h-12 object-contain rounded-sm"
        />
      ) : (
        <span className="text-3xl">{reaction.emoji}</span>
      )}
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
            className="absolute"
            style={{
              left: `calc(50% + ${e.offsetX}px)`,
              top: `calc(100% + ${e.offsetY}px)`,
              transform: `rotate(${e.rotation}deg)`,
              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))',
            }}
          >
            {e.isImage && e.imageUrl ? (
              <img 
                src={e.imageUrl} 
                alt="Custom reaction" 
                className="w-6 h-6 object-contain rounded-sm"
              />
            ) : (
              <span className="text-lg">{e.emoji}</span>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export { REACTIONS, MAX_SETTLED_PER_CARD }
export type { FlyingEmoji, SettledEmoji }
