'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useSocket } from './useSocket'
import type { Game, Player, Issue, GameStatus, Vote, PlayerStreakStats, IssueVoteStats, VoteDistribution } from '@/types'

interface UseGameState {
  game: Game | null
  players: Player[]
  issues: Issue[]
  currentPlayer: Player | null
  isLoading: boolean
  error: string | null
  // Kick state for current player (if they are the target)
  pendingKick: {
    targetPlayerId: string
    initiatorPlayerName: string
    timeout: number
  } | null
  // Active kicks for all players (visible to everyone)
  activeKicks: Map<string, {
    targetPlayerId: string
    targetPlayerName: string
    initiatorPlayerId: string
    initiatorPlayerName: string
    remainingSeconds: number
  }>
  // Kicked state
  wasKicked: boolean
}

interface UseGameActions {
  refreshGame: () => Promise<void>
  updateGameStatus: (status: GameStatus) => Promise<void>
  submitVote: (issueId: string, points: number) => Promise<void>
  createIssue: (title: string, description?: string, status?: 'pending' | 'voting') => Promise<void>
  updateIssue: (issueId: string, updates: Partial<Issue>) => Promise<void>
  deleteIssue: (issueId: string) => Promise<void>
  setCurrentIssue: (issueId: string | null) => Promise<void>
  resetVotes: (issueId: string) => Promise<void>
  setVotes: React.Dispatch<React.SetStateAction<Record<string, Vote[]>>>
  // Kick functionality
  initiateKick: (targetPlayerId: string) => Promise<void>
  rejectKick: () => Promise<void>
  setWasKicked: (value: boolean) => void
  setPendingKick: (value: { targetPlayerId: string; initiatorPlayerName: string; timeout: number } | null) => void
  // Error handling
  setError: (error: string | null) => void
}

interface UseGameSyncState {
  votesResetKey: number
  voteChangesAfterReveal: Record<string, Set<string>>
}

interface UseGameGamification {
  streakStats: PlayerStreakStats[]
  topStreakLeaders: PlayerStreakStats[]
  shouldShowStreakStats: boolean
  totalRevotes: number
  allIssueStats: IssueVoteStats[]
}

// Helper to calculate mode (most frequent value)
function calculateMode(votes: number[]): number | null {
  if (votes.length === 0) return null
  const counts: Record<number, number> = {}
  votes.forEach(v => {
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
  return mode
}

// Helper to calculate vote distribution
function calculateVoteDistribution(votes: number[]): VoteDistribution[] {
  if (votes.length === 0) return []
  const counts: Record<number, number> = {}
  votes.forEach(v => {
    counts[v] = (counts[v] || 0) + 1
  })
  return Object.entries(counts)
    .map(([value, count]) => ({
      value: Number(value),
      count,
      percentage: Math.round((count / votes.length) * 100),
    }))
    .sort((a, b) => (typeof a.value === 'number' && typeof b.value === 'number' ? a.value - b.value : 0))
}

export function useGame(
  gameId: string | null,
  playerName: string
): UseGameState & { votes: Record<string, Vote[]>; socket: Socket | null; isConnected: boolean; trackActivity: () => void; isTabActive: boolean } & UseGameActions & UseGameGamification & UseGameSyncState {
  const [game, setGame] = useState<Game | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [issues, setIssues] = useState<Issue[]>([])
  const [votes, setVotes] = useState<Record<string, Vote[]>>({})
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [votesResetKey, setVotesResetKey] = useState(0)
  const [voteChangesAfterReveal, setVoteChangesAfterReveal] = useState<Record<string, Set<string>>>({})
  
  // Kick state
  const [pendingKick, setPendingKick] = useState<{
    targetPlayerId: string
    initiatorPlayerName: string
    timeout: number
  } | null>(null)
  // Ref so socket handlers always read the latest pendingKick without
  // needing it in the useEffect dependency array (avoids listener teardown
  // on every kick state change, which could cause votes-updated to be dropped)
  const pendingKickRef = useRef(pendingKick)
  useEffect(() => {
    pendingKickRef.current = pendingKick
  }, [pendingKick])
  
  // Kicked state - track if current player was kicked
  const [wasKicked, setWasKicked] = useState(false)
  
  // Active kicks for all players (visible to everyone) - tracks countdown overlay
  const [activeKicks, setActiveKicks] = useState<Map<string, {
    targetPlayerId: string
    targetPlayerName: string
    initiatorPlayerId: string
    initiatorPlayerName: string
    remainingSeconds: number
  }>>(new Map())
  
  // Track total revotes across all issues (incremented when votes are reset during voting)
  const [totalRevotes, setTotalRevotes] = useState(() => {
    if (typeof window !== 'undefined' && gameId) {
      const stored = localStorage.getItem(`revotes_${gameId}`)
      return stored ? parseInt(stored, 10) : 0
    }
    return 0
  })
  
  // Persist totalRevotes to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && gameId) {
      localStorage.setItem(`revotes_${gameId}`, totalRevotes.toString())
    }
  }, [totalRevotes, gameId])
  
  // Track all historical votes for streak calculation (persists across reveals)
  const [allIssueStats, setAllIssueStats] = useState<IssueVoteStats[]>(() => {
    if (typeof window !== 'undefined' && gameId) {
      const stored = localStorage.getItem(`issueStats_${gameId}`)
      return stored ? JSON.parse(stored) : []
    }
    return []
  })
  
  // Persist allIssueStats to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && gameId) {
      localStorage.setItem(`issueStats_${gameId}`, JSON.stringify(allIssueStats))
    }
  }, [allIssueStats, gameId])
  
  // Get current issue ID (the one with status 'voting')
  const currentIssueId = useMemo(() => {
    return issues.find(i => i.status === 'voting')?.id || null
  }, [issues])
  
  // Calculate streak stats for all players
  const streakStats = useMemo((): PlayerStreakStats[] => {
    if (allIssueStats.length === 0 || players.length === 0) return []
    
    // Initialize stats for each player
    const statsMap = new Map<string, PlayerStreakStats>()
    players.forEach(player => {
      statsMap.set(player.id, {
        playerId: player.id,
        playerName: player.name,
        totalVotes: 0,
        majorityAlignments: 0,
        alignmentPercentage: 0,
      })
    })
    
    // Process each issue's stats
    allIssueStats.forEach(issueStats => {
      if (!issueStats.mode) return
      
      // Use stored playerVotes from allIssueStats (persists after revotes)
      const playerVotes = issueStats.playerVotes || []
      
      playerVotes.forEach(vote => {
        if (vote.points < 0) return // Skip coffee breaks
        
        const stats = statsMap.get(vote.playerId)
        if (stats) {
          stats.totalVotes++
          if (vote.points === issueStats.mode) {
            stats.majorityAlignments++
          }
        }
      })
    })
    
    // Calculate alignment percentages
    return Array.from(statsMap.values()).map(stats => ({
      ...stats,
      alignmentPercentage: stats.totalVotes > 0
        ? Math.round((stats.majorityAlignments / stats.totalVotes) * 100)
        : 0,
    }))
  }, [allIssueStats, players])
  
  // Get top streak leaders (sorted by alignment percentage, then total votes)
  const topStreakLeaders = useMemo(() => {
    return [...streakStats]
      .filter(s => s.totalVotes > 0)
      .sort((a, b) => {
        if (b.alignmentPercentage !== a.alignmentPercentage) {
          return b.alignmentPercentage - a.alignmentPercentage
        }
        return b.totalVotes - a.totalVotes
      })
      .slice(0, 3)
  }, [streakStats])
  
  // Check if we should show streak stats (after at least 2 issues have been voted on)
  const shouldShowStreakStats = useMemo(() => {
    return allIssueStats.filter(s => s.totalVotes > 1).length >= 2
  }, [allIssueStats])
  
  // Use the shared socket hook
  const { socket, isConnected, trackActivity, isTabActive } = useSocket(gameId, playerName)

  // Derive the current player's DB UUID from the fresh players list.
  // A ref is used so socket-event closures always read the latest value
  // without needing it in their dependency arrays.
  const currentPlayerIdRef = useRef<string | null>(null)
  useEffect(() => {
    currentPlayerIdRef.current = players.find(p => p.name === playerName)?.id ?? null
  }, [players, playerName])

  // Load initial game data
  const loadGame = useCallback(async () => {
    if (!gameId || !socket) return

    try {
      setIsLoading(true)
      setError(null)

      socket.emit('get-game', { gameId }, (response: any) => {
        if (response.success) {
          console.log('Loaded game:', response)
          setGame(response.game)
          setPlayers(response.players)
          setIssues(response.issues)
          setIsLoading(false)

          // Load votes for each issue
          response.issues.forEach((issue: Issue) => {
            socket.emit('get-votes', { gameId, issueId: issue.id }, (voteResponse: any) => {
              if (voteResponse.success) {
                setVotes(prev => ({
                  ...prev,
                  [issue.id]: voteResponse.votes,
                }))
              }
            })
          })
        } else {
          setError(response.error || 'Failed to load game')
          setIsLoading(false)
        }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load game')
      setIsLoading(false)
    }
  }, [gameId, socket])

  useEffect(() => {
    if (socket && isConnected && gameId) {
      loadGame()
    }
  }, [socket, isConnected, gameId, loadGame])

  // Subscribe to real-time updates via Socket.IO
  useEffect(() => {
    if (!socket) return

    // Game updates
    const handleGameUpdated = (updatedGame: Game) => {
      console.log('Game updated:', updatedGame)
      setGame(updatedGame)
    }

    // Player joined
    const handlePlayerJoined = (player: Player) => {
      console.log('Player joined:', player)
      setPlayers(prev =>
        prev.some(p => p.id === player.id)
          ? prev.map(p => (p.id === player.id ? player : p))
          : [...prev, player]
      )
    }

    // Player left
    const handlePlayerLeft = ({ playerId: leftPlayerId }: { playerId: string }) => {
      console.log('Player left:', leftPlayerId)
      setPlayers(prev => prev.filter(p => p.id !== leftPlayerId))
    }

    // Player updated (name change)
    const handlePlayerUpdated = ({ playerId: updatedPlayerId, newName }: { playerId: string; newName: string }) => {
      console.log('Player updated:', updatedPlayerId, newName)
      setPlayers(prev => prev.map(p => (p.id === updatedPlayerId ? { ...p, name: newName } : p)))
    }

    // Issue created
    const handleIssueCreated = (issue: Issue) => {
      console.log('Issue created:', issue)
      setIssues(prev => [...prev, issue])
    }

    // Issue updated
    const handleIssueUpdated = (issue: Issue) => {
      console.log('Issue updated:', issue)
      setIssues(prev => prev.map(i => (i.id === issue.id ? issue : i)))
    }

    // Issue deleted
    const handleIssueDeleted = ({ issueId }: { issueId: string }) => {
      console.log('Issue deleted:', issueId)
      setIssues(prev => prev.filter(i => i.id !== issueId))
    }

    // Votes updated
    const handleVotesUpdated = ({ issueId: votedIssueId, votes: newVotes }: { issueId: string; votes: Vote[] }) => {
      console.log('Votes updated for issue:', votedIssueId)
      setVotes(prev => ({
        ...prev,
        [votedIssueId]: newVotes,
      }))
    }

    // Votes reset
    const handleVotesReset = ({ issueId: resetIssueId }: { issueId: string }) => {
      console.log('Votes reset for issue:', resetIssueId)
      setVotes(prev => ({
        ...prev,
        [resetIssueId]: [],
      }))
      // Clear vote changes after reveal for this issue
      setVoteChangesAfterReveal(prev => {
        const newState = { ...prev }
        delete newState[resetIssueId]
        return newState
      })
      // Increment key to signal all clients to reset local voting state
      setVotesResetKey(prev => prev + 1)
    }

    // Vote changed after reveal
    const handleVoteChangedAfterReveal = ({ issueId, playerId }: { issueId: string; playerId: string }) => {
      console.log('Vote changed after reveal:', { issueId, playerId })
      setVoteChangesAfterReveal(prev => {
        const newState = { ...prev }
        if (!newState[issueId]) {
          newState[issueId] = new Set()
        }
        newState[issueId].add(playerId)
        return newState
      })
    }

    // Kick initiated against current player
    const handleKickInitiated = ({ targetPlayerId, initiatorPlayerName, timeout }: { 
      targetPlayerId: string
      initiatorPlayerId: string
      initiatorPlayerName: string
      timeout: number
    }) => {
      console.log('Kick initiated:', { targetPlayerId, initiatorPlayerName, timeout })
      // Only show notification if this player is the target
      if (targetPlayerId === currentPlayerIdRef.current) {
        setPendingKick({
          targetPlayerId,
          initiatorPlayerName,
          timeout,
        })
      }
    }

    // Kick was rejected by target player
    const handleKickRejected = ({ targetPlayerId }: { targetPlayerId: string; initiatorPlayerId: string; initiatorPlayerName: string }) => {
      console.log('Kick rejected:', { targetPlayerId })
      if (pendingKickRef.current?.targetPlayerId === targetPlayerId) {
        setPendingKick(null)
      }
      // Remove from active kicks so the countdown overlay disappears for everyone
      setActiveKicks(prev => {
        const next = new Map(prev)
        next.delete(targetPlayerId)
        return next
      })
    }

    // Kick countdown update (broadcasted to all players)
    const handleKickCountdown = ({ 
      targetPlayerId, 
      targetPlayerName, 
      initiatorPlayerId, 
      initiatorPlayerName, 
      remainingSeconds 
    }: { 
      targetPlayerId: string
      targetPlayerName: string
      initiatorPlayerId: string
      initiatorPlayerName: string
      remainingSeconds: number
    }) => {
      console.log('Kick countdown:', { targetPlayerId, remainingSeconds })
      setActiveKicks(prev => {
        const next = new Map(prev)
        next.set(targetPlayerId, {
          targetPlayerId,
          targetPlayerName,
          initiatorPlayerId,
          initiatorPlayerName,
          remainingSeconds,
        })
        return next
      })
    }

    // Kick was cancelled (e.g., player disconnected)
    const handleKickCancelled = ({ 
      targetPlayerId 
    }: { 
      targetPlayerId: string 
      targetPlayerName?: string
      reason?: string 
    }) => {
      console.log('Kick cancelled:', { targetPlayerId })
      // Clear from active kicks
      setActiveKicks(prev => {
        const next = new Map(prev)
        next.delete(targetPlayerId)
        return next
      })
      // Also clear pending kick if it matches
      if (pendingKickRef.current?.targetPlayerId === targetPlayerId) {
        setPendingKick(null)
      }
    }

    // Player was kicked
    const handlePlayerKicked = ({ playerId: kickedPlayerId }: { playerId: string }) => {
      console.log('Player kicked:', kickedPlayerId)
      // If this player was kicked, show kicked state with rejoin option
      if (kickedPlayerId === currentPlayerIdRef.current) {
        setWasKicked(true)
        setError('You have been kicked from the game. Click "Rejoin" to come back.')
      }
      setPlayers(prev => prev.filter(p => p.id !== kickedPlayerId))
      if (pendingKickRef.current?.targetPlayerId === kickedPlayerId) {
        setPendingKick(null)
      }
      // Remove from active kicks
      setActiveKicks(prev => {
        const next = new Map(prev)
        next.delete(kickedPlayerId)
        return next
      })
    }

    socket.on('game-updated', handleGameUpdated)
    socket.on('player-joined', handlePlayerJoined)
    socket.on('player-left', handlePlayerLeft)
    socket.on('player-updated', handlePlayerUpdated)
    socket.on('issue-created', handleIssueCreated)
    socket.on('issue-updated', handleIssueUpdated)
    socket.on('issue-deleted', handleIssueDeleted)
    socket.on('votes-updated', handleVotesUpdated)
    socket.on('votes-reset', handleVotesReset)
    socket.on('vote-changed-after-reveal', handleVoteChangedAfterReveal)
    socket.on('kick-initiated', handleKickInitiated)
    socket.on('kick-rejected', handleKickRejected)
    socket.on('player-kicked', handlePlayerKicked)
    socket.on('kick-countdown', handleKickCountdown)
    socket.on('kick-cancelled', handleKickCancelled)

    return () => {
      socket.off('game-updated', handleGameUpdated)
      socket.off('player-joined', handlePlayerJoined)
      socket.off('player-left', handlePlayerLeft)
      socket.off('player-updated', handlePlayerUpdated)
      socket.off('issue-created', handleIssueCreated)
      socket.off('issue-updated', handleIssueUpdated)
      socket.off('issue-deleted', handleIssueDeleted)
      socket.off('votes-updated', handleVotesUpdated)
      socket.off('votes-reset', handleVotesReset)
      socket.off('vote-changed-after-reveal', handleVoteChangedAfterReveal)
      socket.off('kick-initiated', handleKickInitiated)
      socket.off('kick-rejected', handleKickRejected)
      socket.off('player-kicked', handlePlayerKicked)
      socket.off('kick-countdown', handleKickCountdown)
      socket.off('kick-cancelled', handleKickCancelled)
    }
  }, [socket, playerName])

  // Update game status
  const updateGameStatus = useCallback(
    async (status: GameStatus) => {
      if (!gameId || !socket) return

      trackActivity()
      socket.emit('update-game-status', { gameId, status, playerName }, (response: any) => {
        if (!response.success) {
          console.error('Failed to update game status:', response.error)
        }
      })
    },
    [gameId, socket, playerName, trackActivity]
  )

  // Submit vote — send playerName; server resolves UUID from DB
  const submitVote = useCallback(
    async (issueId: string, points: number) => {
      if (!gameId || !playerName || !socket) return

      socket.emit('submit-vote', { gameId, issueId, playerName, points }, (response: any) => {
        if (!response.success) {
          console.error('Failed to submit vote:', response.error)
        }
      })
    },
    [gameId, playerName, socket]
  )

  // Create issue
  const createIssue = useCallback(
    async (title: string, description?: string, status?: 'pending' | 'voting') => {
      if (!gameId || !socket) return

      const order = issues.length
      socket.emit('create-issue', { gameId, title, description, order, status }, (response: any) => {
        if (!response.success) {
          console.error('Failed to create issue:', response.error)
        }
      })
    },
    [gameId, socket, issues.length]
  )

  // Update issue
  const updateIssue = useCallback(
    async (issueId: string, updates: Partial<Issue>) => {
      if (!socket) return

      socket.emit('update-issue', { issueId, updates }, (response: any) => {
        if (!response.success) {
          console.error('Failed to update issue:', response.error)
        }
      })
    },
    [socket]
  )

  // Delete issue
  const deleteIssue = useCallback(
    async (issueId: string) => {
      if (!gameId || !socket) return

      socket.emit('delete-issue', { issueId, gameId }, (response: any) => {
        if (!response.success) {
          console.error('Failed to delete issue:', response.error)
        }
      })
    },
    [gameId, socket]
  )

  // Set current issue
  const setCurrentIssue = useCallback(
    async (issueId: string | null) => {
      if (!gameId || !socket) return

      socket.emit('set-current-issue', { gameId, issueId }, (response: any) => {
        if (!response.success) {
          console.error('Failed to set current issue:', response.error)
        }
      })
    },
    [gameId, socket]
  )

  // Reset votes
  const resetVotes = useCallback(
    async (issueId: string) => {
      if (!gameId || !socket) return

      setTotalRevotes(prev => prev + 1)
      trackActivity()
      socket.emit('reset-votes', { gameId, issueId, playerName }, (response: any) => {
        if (!response.success) {
          console.error('Failed to reset votes:', response.error)
        }
      })
    },
    [gameId, socket, playerName, trackActivity]
  )

  // Initiate kick vote on another player — send initiatorPlayerName; server resolves UUID
  const initiateKick = useCallback(
    async (targetPlayerId: string) => {
      if (!gameId || !socket || !playerName) return

      socket.emit(
        'initiate-kick',
        { gameId, targetPlayerId, initiatorPlayerName: playerName },
        (response: any) => {
          if (!response.success) {
            console.error('Failed to initiate kick:', response.error)
          }
        }
      )
    },
    [gameId, socket, playerName]
  )

  // Reject kick (called when current player clicks reject)
  const rejectKick = useCallback(async () => {
    if (!gameId || !socket || !pendingKick) return

    socket.emit('reject-kick', { gameId, targetPlayerId: pendingKick.targetPlayerId }, (response: any) => {
      if (response.success) {
        setPendingKick(null)
      } else {
        console.error('Failed to reject kick:', response.error)
      }
    })
  }, [gameId, socket, pendingKick])
  
  // Track issue stats when game status changes to revealed
  useEffect(() => {
    if (game?.status === 'revealed' && currentIssueId) {
      const currentVotesForIssue = votes[currentIssueId] || []
      const numericVotes = currentVotesForIssue
        .map(v => v.points)
        .filter(p => p >= 0)
      
      if (numericVotes.length > 0) {
        const mode = calculateMode(numericVotes)
        const distribution = calculateVoteDistribution(numericVotes)
        const currentIssue = issues.find(i => i.id === currentIssueId)
        
        if (mode !== null && currentIssue) {
          setAllIssueStats(prev => {
            // Check if we already have stats for this issue
            const existingIndex = prev.findIndex(s => s.issueId === currentIssueId)
            const newStats: IssueVoteStats = {
              issueId: currentIssueId,
              issueTitle: currentIssue.title,
              mode,
              modeCount: distribution.find(d => d.value === mode)?.count || 0,
              distribution,
              totalVotes: numericVotes.length,
              // Store actual votes with player IDs for streak calculation
              playerVotes: currentVotesForIssue
                .filter(v => v.points >= 0)
                .map(v => ({ playerId: v.player_id, points: v.points })),
            }
            
            if (existingIndex >= 0) {
              // Update existing stats
              const updated = [...prev]
              updated[existingIndex] = newStats
              return updated
            }
            // Add new stats
            return [...prev, newStats]
          })
        }
      }
    }
  }, [game?.status, currentIssueId, votes, issues])

  return {
    game,
    players,
    issues,
    votes,
    currentPlayer,
    isLoading,
    error,
    setError,
    refreshGame: loadGame,
    updateGameStatus,
    submitVote,
    createIssue,
    updateIssue,
    deleteIssue,
    setCurrentIssue,
    resetVotes,
    setVotes,
    socket,
    isConnected,
    trackActivity,
    isTabActive,
    // Kick functionality
    initiateKick,
    rejectKick,
    pendingKick,
    setPendingKick,
    activeKicks,
    wasKicked,
    setWasKicked,
    // Gamification stats
    streakStats,
    topStreakLeaders,
    shouldShowStreakStats,
    totalRevotes,
    allIssueStats,
    // Sync state
    votesResetKey,
    voteChangesAfterReveal,
  }
}
