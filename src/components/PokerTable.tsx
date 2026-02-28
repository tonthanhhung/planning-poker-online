'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { FlyingReactions, SettledEmojis, type FlyingEmoji, type SettledEmoji, MAX_SETTLED_PER_CARD } from './Reactions'
import { getAvatar } from '@/lib/avatar'
import type { Player } from '@/types'
import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { io, Socket } from 'socket.io-client'

interface PokerTableProps {
  players: Player[]
  currentPlayerName: string
  currentPlayerId: string | null
  votes: Record<string, { player_id: string; points: number }[]>
  currentIssueId: string | null
  isRevealed: boolean
  isPlayerActive: (id: string) => boolean
  gameId: string
}

// helper: create a FlyingEmoji with randomized physics params targeting a specific card
function createFlyingEmoji(
  emoji: string,
  playerName: string,
  targetPlayerId: string | undefined,
  targetEl: HTMLElement | null,
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
}: PokerTableProps) {
  const currentVotes = currentIssueId ? votes[currentIssueId] || [] : []
  const [flyingReactions, setFlyingReactions] = useState<FlyingEmoji[]>([])
  const [settledEmojis, setSettledEmojis] = useState<Record<string, SettledEmoji[]>>({})
  const [socket, setSocket] = useState<Socket | null>(null)
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  
  // flying cards from other players
  const [flyingCards, setFlyingCards] = useState<Array<{
    id: string
    value: number | string
    startX: number
    startY: number
    endX: number
    endY: number
  }>>([])

  // clear selected player when not revealed (reactions only allowed post-reveal)
  useEffect(() => {
    if (!isRevealed) {
      setSelectedPlayerId(null)
    }
  }, [isRevealed])

  // spam queue: stagger reactions by 50-100ms
  const reactionQueueRef = useRef<{ emoji: string; targetPlayerId?: string; fromSocket?: boolean }[]>([])
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
      )

      setFlyingReactions(prev => [...prev, reaction])

      // remove after full animation (~flight + impact + bounces + settle)
      const totalDuration = reaction.flightDuration + 80 + 600 + 300 + 500 // flight + impact + bounces + settle + buffer
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

    socketInstance.on('reaction', (data: { emoji: string; playerName: string; targetPlayerId?: string }) => {
      if (data.playerName === currentPlayerName) return

      reactionQueueRef.current.push({
        emoji: data.emoji,
        targetPlayerId: data.targetPlayerId,
        fromSocket: true,
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

  const handleReact = useCallback((emoji: string, targetPlayerId?: string) => {
    if (socket) {
      socket.emit('reaction', { gameId, emoji, playerName: currentPlayerName, targetPlayerId })
    }

    reactionQueueRef.current.push({ emoji, targetPlayerId })
    processQueue()
  }, [socket, gameId, currentPlayerName, processQueue])

  // handle settled emojis from completed animations
  const handleSettled = useCallback((settled: SettledEmoji) => {
    if (!settled.targetPlayerId) return

    setSettledEmojis(prev => {
      const existing = prev[settled.targetPlayerId] || []
      // enforce max per card
      const updated = [...existing, settled].slice(-MAX_SETTLED_PER_CARD)
      return { ...prev, [settled.targetPlayerId]: updated }
    })

    // auto-fade settled emoji after 4 seconds
    setTimeout(() => {
      setSettledEmojis(prev => {
        const existing = prev[settled.targetPlayerId] || []
        return { ...prev, [settled.targetPlayerId]: existing.filter(e => e.id !== settled.id) }
      })
    }, 4000)
  }, [])

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
    const hasVoted = currentVotes.some(v => v.player_id === player.id)
    const playerVote = currentVotes.find(v => v.player_id === player.id)
    const cardSettled = settledEmojis[player.id] || []

    const cardContent = (() => {
      if (hasVoted && !isRevealed) {
        return (
          <div
            data-player-card={player.id}
            className="w-[46px] h-[64px] rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 border-2 border-blue-400 shadow-md cursor-not-allowed transition-transform"
            title="Reactions available after reveal"
          />
        )
      }

      if (isRevealed && playerVote) {
        return (
          <div
            data-player-card={player.id}
            className="w-[46px] h-[64px] rounded-lg bg-white border-2 border-blue-400 shadow-md flex items-center justify-center cursor-pointer transition-transform hover:scale-105"
            onClick={() => setSelectedPlayerId(prev => prev === player.id ? null : player.id)}
          >
            <span className="text-lg font-bold text-gray-800">
              {playerVote.points < 0 ? '☕' : playerVote.points}
            </span>
          </div>
        )
      }

      return (
        <div
          data-player-card={player.id}
          className="w-[46px] h-[64px] rounded-lg bg-gray-200 border-2 border-gray-300 shadow-sm"
        />
      )
    })()

    return (
      <div className="relative">
        {cardContent}
        {/* Settled emojis on this card */}
        {cardSettled.length > 0 && <SettledEmojis emojis={cardSettled} />}
      </div>
    )
  }

  // Render avatar circle
  const renderAvatar = (player: Player) => {
    const isActive = isPlayerActive(player.id)
    const isCurrentPlayer = player.name === currentPlayerName
    const avatar = getAvatar(player.name)

    return (
      <div className="relative">
        <div
          className={`
            w-10 h-10 rounded-full flex items-center justify-center text-lg
            bg-gradient-to-br ${avatar.gradient}
            border-2 border-white shadow-md
            ${isCurrentPlayer ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
            ${!isActive ? 'opacity-60' : ''}
          `}
        >
          {avatar.emoji}
        </div>
        {player.is_facilitator && (
          <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 text-xs">
            👑
          </div>
        )}
      </div>
    )
  }

  // Emoji picker popup rendered next to a card
  const renderEmojiPopup = (player: Player, popupPosition: 'above' | 'below' | 'left' | 'right') => {
    const isSelected = selectedPlayerId === player.id

    const positionClasses: Record<string, string> = {
      above: '-top-4 -translate-y-full left-1/2 -translate-x-1/2',
      below: '-bottom-4 translate-y-full left-1/2 -translate-x-1/2',
      left: '-left-4 -translate-x-full top-1/2 -translate-y-1/2',
      right: '-right-4 translate-x-full top-1/2 -translate-y-1/2',
    }

    const isVertical = popupPosition === 'left' || popupPosition === 'right'

    return (
      <AnimatePresence>
        {isSelected && isRevealed && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className={`absolute z-30 ${positionClasses[popupPosition]}`}
          >
            <div className={`bg-gray-900/95 backdrop-blur-sm rounded-full shadow-xl border border-gray-700 ${isVertical ? 'px-2 py-3 flex flex-col gap-1' : 'px-3 py-2 flex gap-1'}`}>
              {['👍', '❤️', '🎉', '😂', '🔥'].map(emoji => (
                <button
                  key={emoji}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleReact(emoji, player.id)
                  }}
                  className="emoji-popup-btn w-8 h-8 flex items-center justify-center text-lg hover:bg-gray-700 rounded-full transition-all hover:scale-125 active:scale-95"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    )
  }

  // Top/Bottom players
  const renderVerticalPlayer = (player: Player, position: 'top' | 'bottom') => {
    const isCurrentPlayer = player.name === currentPlayerName

    return (
      <motion.div
        key={player.id}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex flex-col items-center gap-1 relative"
      >
        {position === 'top' && renderPlayerCard(player)}
        <div className="flex flex-col items-center">
          {position === 'top' && (
            <span className={`text-xs font-semibold mb-1 ${isCurrentPlayer ? 'text-blue-600' : 'text-gray-600'}`}>
              {player.name}
            </span>
          )}
          {renderAvatar(player)}
          {position === 'bottom' && (
            <span className={`text-xs font-semibold mt-1 ${isCurrentPlayer ? 'text-blue-600' : 'text-gray-600'}`}>
              {player.name}
            </span>
          )}
        </div>
        {position === 'bottom' && renderPlayerCard(player)}
        {renderEmojiPopup(player, position === 'top' ? 'above' : 'below')}
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
        className="flex items-center gap-2 relative"
      >
        {position === 'left' && (
          <>
            <div className="flex flex-col items-center gap-1">
              {renderAvatar(player)}
              <span className={`text-xs font-semibold ${isCurrentPlayer ? 'text-blue-600' : 'text-gray-600'}`}>
                {player.name}
              </span>
            </div>
            {renderPlayerCard(player)}
          </>
        )}
        {position === 'right' && (
          <>
            {renderPlayerCard(player)}
            <div className="flex flex-col items-center gap-1">
              {renderAvatar(player)}
              <span className={`text-xs font-semibold ${isCurrentPlayer ? 'text-blue-600' : 'text-gray-600'}`}>
                {player.name}
              </span>
            </div>
          </>
        )}
        {renderEmojiPopup(player, position === 'left' ? 'left' : 'right')}
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
                className={`w-3 rounded-full ${isHighest ? 'bg-gray-700' : 'bg-gray-300'}`}
              />
              <div className={`w-10 h-10 rounded-md border-2 flex items-center justify-center text-sm font-bold
                ${isHighest ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-500'}`}>
                {value}
              </div>
              <span className={`text-[10px] font-medium ${isHighest ? 'text-gray-700' : 'text-gray-400'}`}>
                {count} {count === 1 ? 'Vote' : 'Votes'}
              </span>
            </div>
          )
        })}

        <div className="flex flex-col items-start gap-1 ml-6 pl-6 border-l border-gray-300/60">
          <div>
            <span className="text-gray-400 text-xs">Average:</span>
            <div className="text-2xl font-bold text-gray-800">{voteStats.average}</div>
          </div>
          {voteStats.consensus && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-green-600 font-semibold text-sm"
            >
              🎉 Consensus!
            </motion.div>
          )}
          {!voteStats.consensus && voteStats.min !== null && (
            <div>
              <span className="text-gray-400 text-xs">Range:</span>
              <div className="text-sm font-semibold text-gray-600">{voteStats.min} - {voteStats.max}</div>
            </div>
          )}
        </div>
      </motion.div>
    )
  }

  // close emoji popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-player-card]') && !target.closest('.emoji-popup-btn')) {
        setSelectedPlayerId(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  // clear settled emojis when issue changes or votes reset
  useEffect(() => {
    setSettledEmojis({})
  }, [currentIssueId, isRevealed])

  return (
    <>
      <FlyingReactions reactions={flyingReactions} onSettled={handleSettled} />
      
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
              className="w-full h-full rounded-lg bg-white border-2 border-blue-400 shadow-xl flex items-center justify-center"
              animate={{
                scaleY: [1, 1, 0.96, 1],
                scaleX: [1, 1, 1.04, 1],
              }}
              transition={{
                duration: 0.85,
                times: [0, 0.7, 0.85, 1],
              }}
            >
              <span className="font-bold text-blue-600 text-2xl">
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
          <div className="w-full min-h-[180px] md:min-h-[220px] rounded-[2rem] bg-gradient-to-b from-blue-50 to-blue-100/80 border border-blue-200/60 shadow-lg flex flex-col items-center justify-center px-6 py-8 relative">
            {!currentIssueId ? (
              <p className="text-blue-400 font-medium text-sm">Add an issue to start voting</p>
            ) : currentVotes.length === 0 ? (
              <p className="text-blue-400 font-medium text-sm">Waiting for player&apos;s votes...</p>
            ) : !isRevealed ? (
              <p className="text-blue-400 font-medium text-sm">Waiting for player&apos;s votes...</p>
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
