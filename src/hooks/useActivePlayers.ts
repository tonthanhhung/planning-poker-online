'use client'

import { useEffect, useCallback, useState } from 'react'
import { useSocket } from './useSocket'

const OFFLINE_THRESHOLD = 60000 // Consider offline after 60 seconds (allows server to auto-suspend)

export function useActivePlayers(
  gameId: string | null,
  playerName: string
) {
  const { presence, isConnected } = useSocket(gameId, playerName)
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

  // Check active players when presence updates (not on a timer to save CPU)
  useEffect(() => {
    if (!gameId || !isConnected) return
    checkActivePlayers()
  }, [gameId, isConnected, presence, checkActivePlayers])

  const isPlayerActive = useCallback(
    (id: string) => activePlayerIds.has(id),
    [activePlayerIds]
  )

  return { isPlayerActive, activePlayerIds, presence }
}
