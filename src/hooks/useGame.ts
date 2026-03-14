'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
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
}

interface UseGameSyncState {
  votesResetKey: number
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
  playerId: string | null,
  playerName: string
): UseGameState & { votes: Record<string, Vote[]>; socket: Socket | null; isConnected: boolean; trackActivity: () => void } & UseGameActions & UseGameGamification & UseGameSyncState {
  const [game, setGame] = useState<Game | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [issues, setIssues] = useState<Issue[]>([])
  const [votes, setVotes] = useState<Record<string, Vote[]>>({})
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [votesResetKey, setVotesResetKey] = useState(0)
  
  // Use the shared socket hook
  const { socket, isConnected, trackActivity } = useSocket(gameId, playerId, playerName)

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
      // Increment key to signal all clients to reset local voting state
      setVotesResetKey(prev => prev + 1)
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
    }
  }, [socket])

  // Update game status
  const updateGameStatus = useCallback(
    async (status: GameStatus) => {
      if (!gameId || !socket || !playerId) return

      trackActivity()
      socket.emit('update-game-status', { gameId, status, playerId }, (response: any) => {
        if (!response.success) {
          console.error('Failed to update game status:', response.error)
        }
      })
    },
    [gameId, socket, playerId, trackActivity]
  )

  // Submit vote
  const submitVote = useCallback(
    async (issueId: string, points: number) => {
      if (!gameId || !playerId || !socket) return

      socket.emit('submit-vote', { gameId, issueId, playerId, points }, (response: any) => {
        if (!response.success) {
          console.error('Failed to submit vote:', response.error)
        }
      })
    },
    [gameId, playerId, socket]
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

      // Increment total revotes counter
      setTotalRevotes(prev => prev + 1)

      socket.emit('reset-votes', { gameId, issueId }, (response: any) => {
        if (!response.success) {
          console.error('Failed to reset votes:', response.error)
        }
      })
    },
    [gameId, socket]
  )
  
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
    // Gamification stats
    streakStats,
    topStreakLeaders,
    shouldShowStreakStats,
    totalRevotes,
    allIssueStats,
    // Sync state
    votesResetKey,
  }
}
