'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { FlyingReactions, ReactionPicker, type FlyingEmoji } from './Reactions'
import type { Player } from '@/types'
import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import {
  useFloating,
  useHover,
  useDismiss,
  useInteractions,
  safePolygon,
  offset,
  flip,
  shift,
  autoUpdate,
  FloatingPortal,
} from '@floating-ui/react'

interface PokerTableProps {
  players: Player[]
  currentPlayerName: string
  currentPlayerId: string | null
  votes: Record<string, { player_id: string; points: number }[]>
  currentIssueId: string | null
  isRevealed: boolean
  isPlayerActive: (id: string) => boolean
  gameId: string
  pendingVote?: {
    value: number | string
    playerId: string
    issueId: string
  } | null
}

// Floating-UI powered hover popover for emoji reactions
function PlayerPopover({
  children,
  onReact,
  placement = 'top',
}: {
  children: React.ReactNode
  onReact: (emoji: string, isImage?: boolean, imageUrl?: string) => void
  placement?: 'top' | 'bottom' | 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement,
    middleware: [offset(8), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  })

  const hover = useHover(context, {
    delay: { open: 100, close: 300 },
    handleClose: safePolygon({ blockPointerEvents: true }),
  })
  const dismiss = useDismiss(context)
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, dismiss])

  return (
    <div ref={refs.setReference} {...getReferenceProps()}>
      {children}
      <FloatingPortal>
        {open && (
          <div
            ref={refs.setFloating}
            style={{ ...floatingStyles, zIndex: 999999 }}
            {...getFloatingProps()}
          >
            <div className="relative">
              <ReactionPicker
                onReact={(emoji, isImage, imageUrl) => {
                  onReact(emoji, isImage, imageUrl)
                }}
              />
            </div>
          </div>
        )}
      </FloatingPortal>
    </div>
  )
}

// helper: create a FlyingEmoji with randomized physics params targeting a specific card
function createFlyingEmoji(
  emoji: string,
  playerName: string,
  targetPlayerId: string | undefined,
  targetEl: HTMLElement | null,
  isImage?: boolean,
  imageUrl?: string,
): FlyingEmoji {
  const cardRect = targetEl?.getBoundingClientRect()
  const endX = cardRect ? cardRect.left + cardRect.width / 2 : window.innerWidth / 2
  const endY = cardRect ? cardRect.top + cardRect.height / 2 : window.innerHeight / 2

  // start from left or right side only (not top/bottom) for full arc visibility
  const side = Math.random() > 0.5 ? 'left' : 'right'
  let startX: number, startY: number
  if (side === 'left') {
    startX = -40 - Math.random() * 60
    startY = endY + (Math.random() - 0.5) * 300
  } else {
    startX = window.innerWidth + 40 + Math.random() * 60
    startY = endY + (Math.random() - 0.5) * 300
  }

  const seed = Math.floor(Math.random() * 2147483647)

  return {
    id: Math.random().toString(36).substr(2, 9) + Date.now().toString(36),
    emoji,
    startX,
    startY,
    endX,
    endY,
    playerName,
    targetPlayerId,
    isImage,
    imageUrl,
    seed,
    flightDuration: 500 + Math.random() * 400, // 500-900ms
    arcHeight: 80 + Math.random() * 180,        // 80-260px
    spinDirection: Math.random() > 0.5 ? 1 : -1,
  }
}

export function PokerTable({
  players,
  currentPlayerName,
  currentPlayerId,
  votes,
  currentIssueId,
  isRevealed,
  isPlayerActive,
  gameId,
  pendingVote,
}: PokerTableProps) {
  const currentVotes = currentIssueId ? votes[currentIssueId] || [] : []
  const [flyingReactions, setFlyingReactions] = useState<FlyingEmoji[]>([])
  const [socket, setSocket] = useState<Socket | null>(null)

  // flying cards from other players
  const [flyingCards, setFlyingCards] = useState<Array<{
    id: string
    value: number | string
    startX: number
    startY: number
    endX: number
    endY: number
  }>>([])

  // spam queue: stagger reactions by 50-100ms
  const reactionQueueRef = useRef<{ emoji: string; targetPlayerId?: string; fromSocket?: boolean; isImage?: boolean; imageUrl?: string }[]>([])
  const processingRef = useRef(false)

  const processQueue = useCallback(() => {
    if (processingRef.current) return
    processingRef.current = true

    const processNext = () => {
      const item = reactionQueueRef.current.shift()
      if (!item) {
        processingRef.current = false
        return
      }

      let targetEl: HTMLElement | null = null
      if (item.targetPlayerId) {
        targetEl = document.querySelector(`[data-player-card="${item.targetPlayerId}"]`)
      }
      if (!targetEl) {
        const allCards = document.querySelectorAll('[data-player-card]')
        if (allCards.length > 0) {
          targetEl = allCards[Math.floor(Math.random() * allCards.length)] as HTMLElement
        }
      }

      const reaction = createFlyingEmoji(
        item.emoji,
        item.fromSocket ? 'remote' : currentPlayerName,
        item.targetPlayerId,
        targetEl,
        item.isImage,
        item.imageUrl
      )

      setFlyingReactions(prev => [...prev, reaction])

      // remove after full animation (~flight + impact + bounces + settle)
      const totalDuration = (reaction.flightDuration * 1.5) + 100 + 600 + 400 + 500 // flight + impact + bounces + settle + buffer (adjusted for slower animation)
      setTimeout(() => {
        setFlyingReactions(prev => prev.filter(r => r.id !== reaction.id))
      }, totalDuration)

      // stagger next by 50-100ms
      const stagger = 50 + Math.random() * 50
      setTimeout(processNext, stagger)
    }

    processNext()
  }, [currentPlayerName])

  // Setup reaction socket
  useEffect(() => {
    if (!gameId) return

    const socketInstance = io({
      path: '/api/socket',
      transports: ['websocket'],
    })

    socketInstance.on('reaction', (data: { emoji: string; playerName: string; targetPlayerId?: string; isImage?: boolean; imageUrl?: string }) => {
      if (data.playerName === currentPlayerName) return

      reactionQueueRef.current.push({
        emoji: data.emoji,
        targetPlayerId: data.targetPlayerId,
        fromSocket: true,
        isImage: data.isImage,
        imageUrl: data.imageUrl
      })
      processQueue()
    })

    // Listen for other players' card placement animations
    socketInstance.on('card-placed', (data: { playerId: string; playerName: string; cardValue: number | string }) => {
      if (data.playerName === currentPlayerName) return // Skip own animation

      // Find the player's card slot
      const targetEl = document.querySelector(`[data-player-card="${data.playerId}"]`)
      if (!targetEl) return

      const slotRect = targetEl.getBoundingClientRect()
      const endX = slotRect.left + slotRect.width / 2 - 28
      const endY = slotRect.top + slotRect.height / 2 - 40

      // Start from a position near the bottom center (hand area approximation)
      const startX = window.innerWidth / 2 + (Math.random() - 0.5) * 100
      const startY = window.innerHeight - 100

      const flyingCard = {
        id: Math.random().toString(36).substr(2, 9),
        value: data.cardValue,
        startX,
        startY,
        endX,
        endY,
      }

      setFlyingCards(prev => [...prev, flyingCard])

      // Remove after animation completes
      setTimeout(() => {
        setFlyingCards(prev => prev.filter(c => c.id !== flyingCard.id))
      }, 900)
    })

    setSocket(socketInstance)
    return () => {
      socketInstance.disconnect()
    }
  }, [gameId, players, currentPlayerName, processQueue])

  const handleReact = useCallback((emoji: string, targetPlayerId?: string, isImage?: boolean, imageUrl?: string) => {
    if (socket) {
      socket.emit('reaction', { 
        gameId, 
        emoji, 
        playerName: currentPlayerName, 
        targetPlayerId,
        isImage,
        imageUrl
      })
    }

    reactionQueueRef.current.push({ 
      emoji, 
      targetPlayerId,
      fromSocket: false,
      isImage,
      imageUrl
    })
    processQueue()
  }, [socket, gameId, currentPlayerName, processQueue])

  // calculate vote distribution for the bar chart
  const voteDistribution = useMemo(() => {
    if (!isRevealed || currentVotes.length === 0) return []
    const counts: Record<string, number> = {}
    currentVotes.forEach(v => {
      const label = v.points < 0 ? '?' : String(v.points)
      counts[label] = (counts[label] || 0) + 1
    })
    const entries = Object.entries(counts).sort((a, b) => {
      if (a[0] === '?') return 1
      if (b[0] === '?') return -1
      return Number(a[0]) - Number(b[0])
    })
    const maxCount = Math.max(...entries.map(e => e[1]))
    return entries.map(([value, count]) => ({ value, count, maxCount }))
  }, [isRevealed, currentVotes])

  // Calculate vote statistics
  const voteStats = {
    total: currentVotes.length,
    average: currentVotes.length > 0
      ? (currentVotes.filter(v => v.points >= 0).reduce((a, b) => a + b.points, 0) /
         Math.max(currentVotes.filter(v => v.points >= 0).length, 1)).toFixed(1)
      : '0',
    min: currentVotes.filter(v => v.points >= 0).length > 0
      ? Math.min(...currentVotes.filter(v => v.points >= 0).map(v => v.points))
      : null,
    max: currentVotes.filter(v => v.points >= 0).length > 0
      ? Math.max(...currentVotes.filter(v => v.points >= 0).map(v => v.points))
      : null,
    consensus: new Set(currentVotes.filter(v => v.points >= 0).map(v => v.points)).size === 1 && currentVotes.length > 0,
    coffeeBreaks: currentVotes.filter(v => v.points < 0).length,
  }

  // Split players into sections around the table
  const topPlayers = players.slice(0, 3)
  const rightPlayers = players.slice(3, 5)
  const bottomPlayers = players.slice(5, 8).reverse()
  const leftPlayers = players.slice(8, 10).reverse()

  // Render a player's card (face-down or face-up)
  const renderPlayerCard = (player: Player) => {
    // Check for pending vote (optimistic UI) - shows face-down card immediately
    const hasPendingVote = pendingVote && pendingVote.playerId === player.id && pendingVote.issueId === currentIssueId
    const hasVoted = currentVotes.some(v => v.player_id === player.id) || hasPendingVote
    const playerVote = currentVotes.find(v => v.player_id === player.id)

    const cardContent = (() => {
      if (hasVoted && !isRevealed) {
        return (
          <div
            data-player-card={player.id}
            className="w-[46px] h-[64px] rounded-lg bg-gradient-to-br from-primary to-blue-700 border-2 border-blue-400 shadow-md relative group cursor-pointer transition-transform hover:scale-105"
          />
        )
      }

      if (isRevealed && playerVote) {
        return (
          <div
            data-player-card={player.id}
            className="w-[46px] h-[64px] rounded-lg bg-surface border-2 border-primary shadow-md flex items-center justify-center relative group cursor-pointer transition-transform hover:scale-105"
          >
            <span className="text-lg font-bold text-primary">
              {playerVote.points < 0 ? '☕' : playerVote.points}
            </span>
          </div>
        )
      }

      return (
        <div
          data-player-card={player.id}
          className="w-[46px] h-[64px] rounded-lg bg-neutral-light border-2 border-border shadow-sm relative group"
        />
      )
    })()

    return cardContent
  }

  // Top/Bottom players
  const renderVerticalPlayer = (player: Player, position: 'top' | 'bottom') => {
    const isCurrentPlayer = player.name === currentPlayerName

    return (
      <motion.div
        key={player.id}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex flex-col items-center gap-1"
      >
        <PlayerPopover
          placement={position === 'top' ? 'top' : 'bottom'}
          onReact={(emoji, isImage, imageUrl) => handleReact(emoji, player.id, isImage, imageUrl)}
        >
          <div className="flex flex-col items-center gap-1">
            {position === 'top' && renderPlayerCard(player)}
            <span className={`text-xs font-semibold block text-center ${isCurrentPlayer ? 'text-primary' : 'text-neutral'}`}>
              {player.name}
            </span>
            {position === 'bottom' && renderPlayerCard(player)}
          </div>
        </PlayerPopover>
      </motion.div>
    )
  }

  // Left/Right players
  const renderHorizontalPlayer = (player: Player, position: 'left' | 'right') => {
    const isCurrentPlayer = player.name === currentPlayerName

    return (
      <motion.div
        key={player.id}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex items-center gap-2"
      >
        <PlayerPopover
          placement={position}
          onReact={(emoji, isImage, imageUrl) => handleReact(emoji, player.id, isImage, imageUrl)}
        >
          <div className="flex items-center gap-2">
            {position === 'left' && (
              <>
                <span className={`text-xs font-semibold ${isCurrentPlayer ? 'text-primary' : 'text-neutral'}`}>
                  {player.name}
                </span>
                {renderPlayerCard(player)}
              </>
            )}
            {position === 'right' && (
              <>
                {renderPlayerCard(player)}
                <span className={`text-xs font-semibold ${isCurrentPlayer ? 'text-primary' : 'text-neutral'}`}>
                  {player.name}
                </span>
              </>
            )}
          </div>
        </PlayerPopover>
      </motion.div>
    )
  }

  // Render the vote distribution bar chart
  const renderVoteDistribution = () => {
    if (voteDistribution.length === 0) return null
    const barMaxHeight = 80

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-end justify-center gap-6"
      >
        {voteDistribution.map(({ value, count, maxCount }) => {
          const barHeight = Math.max(8, (count / maxCount) * barMaxHeight)
          const isHighest = count === maxCount

          return (
            <div key={value} className="flex flex-col items-center gap-1">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: barHeight }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className={`w-3 rounded-full ${isHighest ? 'bg-primary' : 'bg-neutral-light'}`}
              />
              <div className={`w-10 h-10 rounded-md border-2 flex items-center justify-center text-sm font-bold
                ${isHighest ? 'border-primary bg-blue-light text-primary' : 'border-border bg-surface text-neutral'}`}>
                {value}
              </div>
              <span className={`text-[10px] font-medium ${isHighest ? 'text-secondary' : 'text-neutral'}`}>
                {count} {count === 1 ? 'Vote' : 'Votes'}
              </span>
            </div>
          )
        })}

        <div className="flex flex-col items-start gap-1 ml-6 pl-6 border-l border-border">
          <div>
            <span className="text-neutral text-xs">Average:</span>
            <div className="text-2xl font-bold text-secondary">{voteStats.average}</div>
          </div>
          {voteStats.consensus && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-success font-semibold text-sm inline-flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Consensus!
            </motion.div>
          )}
          {!voteStats.consensus && voteStats.min !== null && (
            <div>
              <span className="text-neutral text-xs">Range:</span>
              <div className="text-sm font-medium text-secondary">{voteStats.min} - {voteStats.max}</div>
            </div>
          )}
        </div>
      </motion.div>
    )
  }

  return (
    <>
      <FlyingReactions reactions={flyingReactions} />
      
      {/* Flying cards from other players */}
      <AnimatePresence>
        {flyingCards.map(card => (
          <motion.div
            key={card.id}
            className="fixed w-14 h-20 z-40 pointer-events-none"
            initial={{
              x: card.startX,
              y: card.startY,
              scale: 1.1,
              rotate: (Math.random() - 0.5) * 6,
            }}
            animate={{
              x: [card.startX, (card.startX + card.endX) / 2, card.endX],
              y: [card.startY, Math.min(card.startY, card.endY) - 80, card.endY],
              scale: [1.1, 1.15, 1],
              rotate: [0, (Math.random() - 0.5) * 4, 0],
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.85,
              times: [0, 0.5, 1],
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
          >
            <motion.div
              className="w-full h-full rounded-lg bg-surface border-2 border-primary shadow-xl flex items-center justify-center"
              animate={{
                scaleY: [1, 1, 0.96, 1],
                scaleX: [1, 1, 1.04, 1],
              }}
              transition={{
                duration: 0.85,
                times: [0, 0.7, 0.85, 1],
              }}
            >
              <span className="font-bold text-primary text-2xl">
                {typeof card.value === 'number' ? card.value : '☕'}
              </span>
            </motion.div>
          </motion.div>
        ))}
      </AnimatePresence>

      <div className="w-full max-w-4xl mx-auto py-4">
        <div className="grid grid-cols-[auto_1fr_auto] grid-rows-[auto_1fr_auto] gap-4 items-center justify-items-center">

          {/* Top row */}
          <div className="col-span-3 flex justify-center gap-6 md:gap-10 mb-2">
            {topPlayers.map(p => renderVerticalPlayer(p, 'top'))}
          </div>

          {/* Left players */}
          <div className="flex flex-col gap-6 justify-center">
            {leftPlayers.map(p => renderHorizontalPlayer(p, 'left'))}
          </div>

          {/* Central table */}
          <div className="w-full min-h-[180px] md:min-h-[220px] rounded-2xl bg-slate-100 border border-slate-200 shadow-sm flex flex-col items-center justify-center px-6 py-8 relative">
            {!currentIssueId ? (
              <p className="text-neutral font-medium text-sm">Add an issue to start voting</p>
            ) : currentVotes.length === 0 ? (
              <p className="text-neutral font-medium text-sm">Waiting for player&apos;s votes...</p>
            ) : !isRevealed ? (
              <p className="text-neutral font-medium text-sm">Waiting for player&apos;s votes...</p>
            ) : (
              renderVoteDistribution()
            )}
          </div>

          {/* Right players */}
          <div className="flex flex-col gap-6 justify-center">
            {rightPlayers.map(p => renderHorizontalPlayer(p, 'right'))}
          </div>

          {/* Bottom row */}
          <div className="col-span-3 flex justify-center gap-6 md:gap-10 mt-2">
            {bottomPlayers.map(p => renderVerticalPlayer(p, 'bottom'))}
          </div>
        </div>
      </div>
    </>
  )
}

// Re-export components from Reactions
export { ReactionPicker } from './Reactions'
