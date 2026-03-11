'use client'

import { useEffect, useCallback, useState } from 'react'
import { useSocket } from './useSocket'

const OFFLINE_THRESHOLD = 30000 // Consider offline after 30 seconds

export function useActivePlayers(
  gameId: string | null,
  playerId: string | null,
  playerName: string
) {
  const { presence, isConnected } = useSocket(gameId, playerId, playerName)
  const [activePlayerIds, setActivePlayerIds] = useState<Set<string>>(new Set())

  // Check which players are active based on presence
  const checkActivePlayers = useCallback(() => {
    if (!gameId) return

    const now = Date.now()
    const activeIds = new Set<string>()

    presence.forEach((player) => {
      const timeSinceLastPing = now - player.lastPing
      if (timeSinceLastPing < OFFLINE_THRESHOLD && player.isOnline) {
        activeIds.add(player.playerId)
      }
    })

    setActivePlayerIds(activeIds)
  }, [gameId, presence])

  // Periodically check active players
  useEffect(() => {
    if (!gameId || !isConnected) return

    // Initial check
    checkActivePlayers()

    // Set up interval to check every 5 seconds
    const checkInterval = setInterval(checkActivePlayers, 5000)

    return () => {
      clearInterval(checkInterval)
    }
  }, [gameId, isConnected, checkActivePlayers])

  const isPlayerActive = useCallback(
    (id: string) => activePlayerIds.has(id),
    [activePlayerIds]
  )

  return { isPlayerActive, activePlayerIds, presence }
}
