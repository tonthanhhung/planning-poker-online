'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase, subscribeToGame, getGame } from '@/lib/supabase'
import type { Game, Player, Issue, GameStatus, Vote } from '@/types'

interface UseGameState {
  game: Game | null
  players: Player[]
  issues: Issue[]
  votes: Record<string, Vote[]> // issueId -> votes
  currentPlayer: Player | null
  isLoading: boolean
  error: string | null
}

export function useGame(gameId: string | null): UseGameState & {
  refreshGame: () => Promise<void>
  updateGameStatus: (status: GameStatus) => Promise<void>
  setVotes: React.Dispatch<React.SetStateAction<Record<string, Vote[]>>>
} {
  const [state, setState] = useState<UseGameState>({
    game: null,
    players: [],
    issues: [],
    votes: {},
    currentPlayer: null,
    isLoading: true,
    error: null,
  })

  const [votes, setVotes] = useState<Record<string, Vote[]>>({})

  // Load initial game data
  const loadGame = useCallback(async () => {
    if (!gameId) return

    try {
      const data = await getGame(gameId)
      setState(prev => ({
        ...prev,
        game: data.game,
        players: data.players,
        issues: data.issues,
        isLoading: false,
      }))

      // Load votes for each issue
      const votesData: Record<string, Vote[]> = {}
      for (const issue of data.issues) {
        const { data: issueVotes } = await supabase
          .from('votes')
          .select('*')
          .eq('game_id', gameId)
          .eq('issue_id', issue.id)

        if (issueVotes) {
          votesData[issue.id] = issueVotes
        }
      }
      setVotes(votesData)
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to load game',
        isLoading: false,
      }))
    }
  }, [gameId])

  useEffect(() => {
    loadGame()
  }, [loadGame])

  // Subscribe to real-time updates
  useEffect(() => {
    if (!gameId) return

    const unsubscribe = subscribeToGame(gameId, async (payload) => {
      const { event, table, new: newRow } = payload

      if (table === 'games' && newRow) {
        setState(prev => ({ ...prev, game: newRow as Game }))
      } else if (table === 'players') {
        console.log('Player event:', { event, payload, old: payload.old, new: newRow })
        if (event === 'DELETE') {
          const deletedId = payload.old?.id
          console.log('Removing player:', deletedId)
          setState(prev => ({
            ...prev,
            players: prev.players.filter(p => p.id !== deletedId),
          }))
        } else {
          setState(prev => ({
            ...prev,
            players: prev.players.some(p => p.id === newRow!.id)
              ? prev.players.map(p => p.id === newRow!.id ? newRow! as Player : p)
              : [...prev.players, newRow! as Player],
          }))
        }
      } else if (table === 'issues') {
        if (event === 'DELETE') {
          setState(prev => ({
            ...prev,
            issues: prev.issues.filter(i => i.id !== payload.old.id),
          }))
        } else {
          setState(prev => ({
            ...prev,
            issues: prev.issues.some(i => i.id === newRow!.id)
              ? prev.issues.map(i => i.id === newRow!.id ? newRow! as Issue : i)
              : [...prev.issues, newRow! as Issue],
          }))
        }
      } else if (table === 'votes') {
        // Reload votes for the affected issue
        if (newRow) {
          const issueId = (newRow as Vote).issue_id
          const { data: issueVotes } = await supabase
            .from('votes')
            .select('*')
            .eq('game_id', gameId)
            .eq('issue_id', issueId)

          if (issueVotes) {
            setVotes(prev => ({ ...prev, [issueId]: issueVotes }))
          }
        }
      }
    })

    return () => {
      unsubscribe()
    }
  }, [gameId])

  const updateGameStatus = async (status: GameStatus) => {
    if (!gameId) return

    const { error } = await supabase
      .from('games')
      .update({ status })
      .eq('id', gameId)

    if (error) throw error
  }

  return {
    ...state,
    votes,
    refreshGame: loadGame,
    updateGameStatus,
    setVotes,
  }
}
