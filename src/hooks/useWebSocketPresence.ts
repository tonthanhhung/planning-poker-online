'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { io, Socket } from 'socket.io-client'

interface PlayerPresence {
  playerId: string
  playerName: string
  isOnline: boolean
  lastPing: number
}

export function useWebSocketPresence(
  gameId: string | null,
  playerName: string
) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [presence, setPresence] = useState<Map<string, PlayerPresence>>(new Map())
  const [isConnected, setIsConnected] = useState(false)
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize socket connection — no UUID sent, server resolves from playerName
  useEffect(() => {
    if (!gameId || !playerName) return

    const socketInstance = io({
      path: '/api/socket',
      transports: ['websocket'],
    })

    socketInstance.on('connect', () => {
      console.log('Connected to presence server')
      setIsConnected(true)

      socketInstance.emit('join-game', { gameId, playerName })
    })

    socketInstance.on('disconnect', () => {
      console.log('Disconnected from presence server')
      setIsConnected(false)
    })

    socketInstance.on('presence-update', (players: PlayerPresence[]) => {
      console.log('Received presence update:', players)
      const presenceMap = new Map<string, PlayerPresence>()
      players.forEach(player => {
        presenceMap.set(player.playerId, player)
      })
      setPresence(presenceMap)
    })

    setSocket(socketInstance)

    return () => {
      socketInstance.disconnect()
    }
  }, [gameId, playerName])

  // Periodic pings removed — activity is tracked per meaningful action
  // (keeping ref cleanup for safety)
  useEffect(() => {
    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
      }
    }
  }, [])

  const isPlayerActive = useCallback(
    (id: string) => {
      const player = presence.get(id)
      return player?.isOnline ?? false
    },
    [presence]
  )

  const getPlayerPresence = useCallback(
    (id: string) => presence.get(id),
    [presence]
  )

  return {
    socket,
    isConnected,
    isPlayerActive,
    getPlayerPresence,
    presence,
  }
}
