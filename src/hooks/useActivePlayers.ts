'use client'

import { useEffect, useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'

const ACTIVITY_INTERVAL = 10000 // Update every 10 seconds
const OFFLINE_THRESHOLD = 30000 // Consider offline after 30 seconds

export function useActivePlayers(gameId: string | null, playerId: string | null) {
  const [activePlayerIds, setActivePlayerIds] = useState<Set<string>>(new Set())

  // Update last_active timestamp for current user
  const updateActivity = useCallback(async () => {
    if (!gameId || !playerId) return

    const { error } = await supabase
      .from('players')
      .update({ last_active: new Date().toISOString() })
      .eq('id', playerId)

    if (error) {
      console.error('Failed to update activity:', error)
    }
  }, [gameId, playerId])

  // Check which players are active
  const checkActivePlayers = useCallback(async () => {
    if (!gameId) return

    const cutoffTime = new Date(Date.now() - OFFLINE_THRESHOLD).toISOString()

    const { data, error } = await supabase
      .from('players')
      .select('id')
      .eq('game_id', gameId)
      .gte('last_active', cutoffTime)

    if (error) {
      console.error('Failed to check active players:', error)
      return
    }

    if (data) {
      setActivePlayerIds(new Set(data.map(p => p.id)))
    }
  }, [gameId])

  // Periodically update activity and check active players
  useEffect(() => {
    if (!gameId) return

    // Initial check
    checkActivePlayers()
    updateActivity()

    // Set up intervals
    const activityInterval = setInterval(updateActivity, ACTIVITY_INTERVAL)
    const checkInterval = setInterval(checkActivePlayers, ACTIVITY_INTERVAL)

    // Clean up on visibility change (user switches tabs)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateActivity()
        checkActivePlayers()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(activityInterval)
      clearInterval(checkInterval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [gameId, updateActivity, checkActivePlayers])

  // Subscribe to player updates
  useEffect(() => {
    if (!gameId) return

    const channel = supabase
      .channel(`players-activity:${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'players',
          filter: `game_id=eq.${gameId}`,
        },
        () => {
          checkActivePlayers()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameId, checkActivePlayers])

  const isPlayerActive = useCallback(
    (id: string) => activePlayerIds.has(id),
    [activePlayerIds]
  )

  return { isPlayerActive, activePlayerIds }
}
