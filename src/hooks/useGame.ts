'use client'

import { useState, useEffect, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useSocket } from './useSocket'
import type { Game, Player, Issue, GameStatus, Vote } from '@/types'

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
  createIssue: (title: string, description?: string) => Promise<void>
  updateIssue: (issueId: string, updates: Partial<Issue>) => Promise<void>
  deleteIssue: (issueId: string) => Promise<void>
  setCurrentIssue: (issueId: string | null) => Promise<void>
  resetVotes: (issueId: string) => Promise<void>
  setVotes: React.Dispatch<React.SetStateAction<Record<string, Vote[]>>>
}

export function useGame(
  gameId: string | null,
  playerId: string | null,
  playerName: string
): UseGameState & { votes: Record<string, Vote[]>; socket: Socket | null; isConnected: boolean } & UseGameActions {
  const [game, setGame] = useState<Game | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [issues, setIssues] = useState<Issue[]>([])
  const [votes, setVotes] = useState<Record<string, Vote[]>>({})
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { socket, isConnected } = useSocket(gameId, playerId, playerName)

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
    }

    socket.on('game-updated', handleGameUpdated)
    socket.on('player-joined', handlePlayerJoined)
    socket.on('player-left', handlePlayerLeft)
    socket.on('issue-created', handleIssueCreated)
    socket.on('issue-updated', handleIssueUpdated)
    socket.on('issue-deleted', handleIssueDeleted)
    socket.on('votes-updated', handleVotesUpdated)
    socket.on('votes-reset', handleVotesReset)

    return () => {
      socket.off('game-updated', handleGameUpdated)
      socket.off('player-joined', handlePlayerJoined)
      socket.off('player-left', handlePlayerLeft)
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
      if (!gameId || !socket) return

      socket.emit('update-game-status', { gameId, status }, (response: any) => {
        if (!response.success) {
          console.error('Failed to update game status:', response.error)
        }
      })
    },
    [gameId, socket]
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
    async (title: string, description?: string) => {
      if (!gameId || !socket) return

      const order = issues.length
      socket.emit('create-issue', { gameId, title, description, order }, (response: any) => {
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

      socket.emit('reset-votes', { gameId, issueId }, (response: any) => {
        if (!response.success) {
          console.error('Failed to reset votes:', response.error)
        }
      })
    },
    [gameId, socket]
  )

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
  }
}
