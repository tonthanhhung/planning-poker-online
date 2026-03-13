'use client'

import { motion } from 'framer-motion'
import { FlyingReactions, ReactionPicker, type FlyingEmoji } from './Reactions'
import type { Player } from '@/types'
import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { Socket } from 'socket.io-client'
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
  socket: Socket | null
  pendingVote?: {
    value: number | string
    playerId: string
    issueId: string
    timestamp: number
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
  socket,
  pendingVote,
}: PokerTableProps) {
  const currentVotes = currentIssueId ? votes[currentIssueId] || [] : []
  const [flyingReactions, setFlyingReactions] = useState<FlyingEmoji[]>([])

  // spam queue: stagger reactions by 50-100ms
  const reactionQueueRef = useRef<{ emoji: string; targetPlayerId?: string; fromSocket?: boolean; isImage?: boolean; imageUrl?: string }[]>([])
  const processingRef = useRef(false)

  const processQueue = useCallback(() => {
    if (processingRef.current) {
      console.log('Queue already processing, skipping')
      return
    }
    processingRef.current = true
    console.log('Processing reaction queue, items:', reactionQueueRef.current.length)

    const processNext = () => {
      const item = reactionQueueRef.current.shift()
      if (!item) {
        console.log('Queue empty, done processing')
        processingRef.current = false
        return
      }

      console.log('Processing reaction:', item.emoji, 'fromSocket:', item.fromSocket, 'target:', item.targetPlayerId)

      let targetEl: HTMLElement | null = null
      if (item.targetPlayerId) {
        targetEl = document.querySelector(`[data-player-card="${item.targetPlayerId}"]`)
        console.log('Target element for', item.targetPlayerId, ':', targetEl)
      }
      if (!targetEl) {
        const allCards = document.querySelectorAll('[data-player-card]')
        console.log('No specific target, picking random from', allCards.length, 'cards')
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

      console.log('Created flying reaction:', reaction.id)
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

  // Setup reaction listeners on provided socket
  useEffect(() => {
    if (!socket || !gameId) return

    // Listen for reactions from other players
    const handleReaction = (data: { emoji: string; playerName: string; targetPlayerId?: string; isImage?: boolean; imageUrl?: string }) => {
      console.log('Received reaction from socket:', data, 'My name:', currentPlayerName)
      if (data.playerName === currentPlayerName) {
        console.log('Skipping own reaction')
        return
      }

      console.log('Adding reaction to queue from:', data.playerName)
      reactionQueueRef.current.push({
        emoji: data.emoji,
        targetPlayerId: data.targetPlayerId,
        fromSocket: true,
        isImage: data.isImage,
        imageUrl: data.imageUrl
      })
      processQueue()
    }

    socket.on('reaction', handleReaction)

    return () => {
      socket.off('reaction', handleReaction)
    }
  }, [socket, gameId, currentPlayerName, processQueue])

  const handleReact = useCallback((emoji: string, targetPlayerId?: string, isImage?: boolean, imageUrl?: string) => {
    console.log('Sending reaction:', { emoji, targetPlayerId, playerName: currentPlayerName })
    if (socket) {
      socket.emit('reaction', { 
        gameId, 
        emoji, 
        playerName: currentPlayerName, 
        targetPlayerId,
        isImage,
        imageUrl
      })
      console.log('Reaction emitted to socket')
    } else {
      console.log('No socket available!')
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
    
    // Calculate mode (most voted value)
    let mode: string | null = null
    let modeCount = 0
    entries.forEach(([value, count]) => {
      if (value !== '?' && count > modeCount) {
        modeCount = count
        mode = value
      }
    })
    
    return entries.map(([value, count]) => ({ 
      value, 
      count, 
      maxCount,
      isMode: value === mode
    }))
  }, [isRevealed, currentVotes])

  // Calculate vote statistics
  const voteStats = useMemo(() => {
    const numericVotes = currentVotes.filter(v => v.points >= 0).map(v => v.points)
    
    // Calculate mode
    const counts: Record<number, number> = {}
    numericVotes.forEach(v => {
      counts[v] = (counts[v] || 0) + 1
    })
    let maxCount = 0
    let mode: number | null = null
    Object.entries(counts).forEach(([value, count]) => {
      if (count > maxCount) {
        maxCount = count
        mode = Number(value)
      }
    })
    
    return {
      total: currentVotes.length,
      mode,
      modeCount: maxCount,
      average: numericVotes.length > 0
        ? (numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length).toFixed(1)
        : '0',
      min: numericVotes.length > 0 ? Math.min(...numericVotes) : null,
      max: numericVotes.length > 0 ? Math.max(...numericVotes) : null,
      consensus: new Set(numericVotes).size === 1 && numericVotes.length > 0,
      coffeeBreaks: currentVotes.filter(v => v.points < 0).length,
    }
  }, [currentVotes])

  // Split players into sections - all centered around the table
  // No side players, everything is centered
  const topPlayers = players.slice(0, 5)
  const bottomPlayers = players.slice(5, 10).reverse()

  // Track recently placed cards for animation (within last 3 seconds)
  // Stores { playerId: { timestamp, value } }
  const [recentlyPlaced, setRecentlyPlaced] = useState<Record<string, { timestamp: number; value: number | string }>>({})
  
  // Update recently placed when pendingVote changes
  useEffect(() => {
    if (pendingVote && pendingVote.timestamp) {
      setRecentlyPlaced(prev => ({
        ...prev,
        [pendingVote.playerId]: { 
          timestamp: pendingVote.timestamp, 
          value: pendingVote.value 
        },
      }))
    }
  }, [pendingVote])
  
  // Render a player's card (face-down or face-up)
  const renderPlayerCard = (player: Player) => {
    // Viewers don't have cards - show a viewer icon instead
    if (player.is_viewer) {
      return (
        <motion.div
          data-player-card={player.id}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="w-[46px] h-[64px] rounded-lg bg-purple-50 border-2 border-purple-200 shadow-sm flex items-center justify-center relative group"
        >
          <motion.svg 
            className="w-5 h-5 text-purple-400" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </motion.svg>
        </motion.div>
      )
    }

    // Check for pending vote (optimistic UI) - shows face-down card immediately
    const hasPendingVote = pendingVote && pendingVote.playerId === player.id && pendingVote.issueId === currentIssueId
    const hasVoted = currentVotes.some(v => v.player_id === player.id) || hasPendingVote
    const playerVote = currentVotes.find(v => v.player_id === player.id)
    
    // Check if card was recently placed (for animation trigger)
    const recentPlacement = recentlyPlaced[player.id]
    const wasRecentlyPlaced = recentPlacement && (Date.now() - recentPlacement.timestamp < 3000)

    const cardContent = (() => {
      if (hasVoted && !isRevealed) {
        return (
          <motion.div
            data-player-card={player.id}
            className="w-[46px] h-[64px] relative group cursor-pointer"
            initial={{ rotateY: 0, scale: 0.8 }}
            animate={{ rotateY: 180, scale: 1 }}
            transition={{ 
              duration: 0.6, 
              ease: [0.34, 1.56, 0.64, 1],
              type: 'spring',
              stiffness: 200,
              damping: 20,
            }}
            whileHover={{ scale: 1.08, rotateY: 175 }}
            style={{ transformStyle: 'preserve-3d', perspective: 1000 }}
            key={wasRecentlyPlaced && recentPlacement ? `placed-${recentPlacement.timestamp}` : 'static-voted'}
          >
            {/* Front face (face-up, shows value) */}
            <motion.div
              className="absolute inset-0 rounded-lg bg-surface border-2 border-primary shadow-md flex items-center justify-center backface-hidden"
              style={{ backfaceVisibility: 'hidden', transform: 'rotateY(0deg)' }}
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 400 }}
            >
              <motion.span 
                className="text-lg font-bold text-primary"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.4, type: 'spring', stiffness: 400 }}
              >
                {wasRecentlyPlaced && recentPlacement 
                  ? recentPlacement.value 
                  : (playerVote?.points ?? '?')}
              </motion.span>
            </motion.div>
            {/* Back face (face-down, blue) */}
            <motion.div 
              className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary to-blue-700 border-2 border-blue-400 shadow-md backface-hidden"
              style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
              animate={{
                background: [
                  'linear-gradient(135deg, #0052CC 0%, #1E40AF 100%)',
                  'linear-gradient(135deg, #1E40AF 0%, #0052CC 100%)',
                  'linear-gradient(135deg, #0052CC 0%, #1E40AF 100%)',
                ],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            />
          </motion.div>
        )
      }

      if (isRevealed && playerVote) {
        return (
          <motion.div
            data-player-card={player.id}
            initial={{ scale: 0.5, rotate: -180, opacity: 0 }}
            animate={{ 
              scale: 1, 
              rotate: 0, 
              opacity: 1,
            }}
            transition={{ 
              type: 'spring',
              stiffness: 200,
              damping: 15,
              delay: 0.1,
            }}
            whileHover={{ 
              scale: 1.15, 
              rotate: [-2, 2, -2, 0],
              y: -8,
              transition: { duration: 0.3 }
            }}
            className="w-[46px] h-[64px] rounded-lg bg-surface border-2 border-primary shadow-md flex items-center justify-center relative group cursor-pointer"
          >
            <motion.span 
              className="text-lg font-bold text-primary"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 400 }}
            >
              {playerVote.points < 0 ? '☕' : playerVote.points}
            </motion.span>
            {/* Subtle glow effect for revealed cards */}
            <motion.div
              className="absolute inset-0 rounded-lg border-2 border-primary/30"
              initial={{ scale: 1, opacity: 0 }}
              animate={{ 
                scale: [1, 1.2, 1],
                opacity: [0, 0.5, 0],
              }}
              transition={{ duration: 1.5, delay: 0.3 }}
            />
          </motion.div>
        )
      }

      return (
        <motion.div
          data-player-card={player.id}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="w-[46px] h-[64px] rounded-lg bg-neutral-light border-2 border-border shadow-sm relative group"
        />
      )
    })()

    return cardContent
  }

  // Top/Bottom players
  const renderVerticalPlayer = (player: Player, position: 'top' | 'bottom') => {
    const isCurrentPlayer = player.name === currentPlayerName
    const isViewer = player.is_viewer

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
            {isViewer && (
              <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded-full">
                Viewer
              </span>
            )}
            {position === 'bottom' && renderPlayerCard(player)}
          </div>
        </PlayerPopover>
      </motion.div>
    )
  }

  // Left/Right players
  const renderHorizontalPlayer = (player: Player, position: 'left' | 'right') => {
    const isCurrentPlayer = player.name === currentPlayerName
    const isViewer = player.is_viewer

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
                <div className="flex flex-col items-end">
                  <span className={`text-xs font-semibold ${isCurrentPlayer ? 'text-primary' : 'text-neutral'}`}>
                    {player.name}
                  </span>
                  {isViewer && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded-full">
                      Viewer
                    </span>
                  )}
                </div>
                {renderPlayerCard(player)}
              </>
            )}
            {position === 'right' && (
              <>
                {renderPlayerCard(player)}
                <div className="flex flex-col items-start">
                  <span className={`text-xs font-semibold ${isCurrentPlayer ? 'text-primary' : 'text-neutral'}`}>
                    {player.name}
                  </span>
                  {isViewer && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded-full">
                      Viewer
                    </span>
                  )}
                </div>
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
        {voteDistribution.map(({ value, count, maxCount, isMode }) => {
          const barHeight = Math.max(8, (count / maxCount) * barMaxHeight)

          return (
            <div key={value} className="flex flex-col items-center gap-1">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: barHeight }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className={`w-3 rounded-full ${isMode ? 'bg-primary' : 'bg-neutral-light'}`}
              />
              <div className={`w-10 h-10 rounded-md border-2 flex items-center justify-center text-sm font-bold
                ${isMode ? 'border-primary bg-blue-light text-primary' : 'border-border bg-surface text-neutral'}`}>
                {value}
              </div>
              <span className={`text-[10px] font-medium ${isMode ? 'text-secondary' : 'text-neutral'}`}>
                {count} {count === 1 ? 'Vote' : 'Votes'}
              </span>
            </div>
          )
        })}

        <div className="flex flex-col items-start gap-1 ml-6 pl-6 border-l border-border">
          <div>
            <span className="text-neutral text-xs">Most Voted:</span>
            <div className="text-2xl font-bold text-primary">
              {voteStats.mode !== null ? voteStats.mode : '-'}
            </div>
          </div>
          <div className="text-xs text-neutral">
            {voteStats.modeCount} {voteStats.modeCount === 1 ? 'vote' : 'votes'}
          </div>
          {voteStats.consensus && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-success font-semibold text-sm inline-flex items-center gap-1 mt-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Consensus!
            </motion.div>
          )}
          {!voteStats.consensus && voteStats.min !== null && (
            <div className="mt-1">
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

      <div className="w-full max-w-4xl mx-auto py-4">
        {/* Centered layout: top players, center table, bottom players */}
        <div className="flex flex-col items-center gap-4">

          {/* Top row - all players centered */}
          <div className="flex justify-center gap-3 sm:gap-6 md:gap-8">
            {topPlayers.map(p => renderVerticalPlayer(p, 'top'))}
          </div>

          {/* Central table - centered */}
          <div className="w-full max-w-lg md:max-w-xl min-h-[160px] sm:min-h-[200px] md:min-h-[240px] rounded-xl sm:rounded-2xl bg-slate-100 border border-slate-200 shadow-sm flex flex-col items-center justify-center px-6 py-8 sm:px-8 sm:py-10">
            {!currentIssueId ? (
              <div className="text-center">
                <p className="text-neutral font-medium text-sm mb-1">No task selected</p>
                <p className="text-neutral text-xs">Add a task to start your first vote</p>
              </div>
            ) : currentVotes.length === 0 ? (
              <p className="text-neutral font-medium text-sm">Waiting for everyone to vote...</p>
            ) : !isRevealed ? (
              <p className="text-neutral font-medium text-sm">Waiting for everyone to vote...</p>
            ) : (
              renderVoteDistribution()
            )}
          </div>

          {/* Bottom row - all players centered */}
          <div className="flex justify-center gap-3 sm:gap-6 md:gap-8">
            {bottomPlayers.map(p => renderVerticalPlayer(p, 'bottom'))}
          </div>
        </div>
      </div>
    </>
  )
}

// Re-export components from Reactions
export { ReactionPicker } from './Reactions'
