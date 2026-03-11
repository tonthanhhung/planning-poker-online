'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { io, Socket } from 'socket.io-client'

interface PlayerPresence {
  playerId: string
  playerName: string
  isOnline: boolean
  lastPing: number
}

interface UseSocketReturn {
  socket: Socket | null
  isConnected: boolean
  isConnecting: boolean
  error: string | null
  presence: Map<string, PlayerPresence>
}

export function useSocket(
  gameId: string | null,
  playerId: string | null,
  playerName: string
): UseSocketReturn {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [presence, setPresence] = useState<Map<string, PlayerPresence>>(new Map())
  
  // Initialize socket connection
  useEffect(() => {
    console.log('Initializing socket connection...')
    setIsConnecting(true)
    setError(null)

    const socketInstance = io({
      path: '/api/socket',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    socketInstance.on('connect', () => {
      console.log('Connected to server:', socketInstance.id)
      setIsConnected(true)
      setIsConnecting(false)
      setError(null)
    })

    socketInstance.on('connect_error', (err) => {
      console.error('Socket connection error:', err)
      setError(err.message)
      setIsConnecting(false)
    })

    socketInstance.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason)
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
      console.log('Disconnecting socket...')
      socketInstance.disconnect()
    }
  }, [])

  // Join game when we have gameId and playerId
  useEffect(() => {
    if (!socket || !isConnected || !gameId || !playerId) return

    console.log(`Joining game ${gameId} as ${playerName} (${playerId})`)
    
    socket.emit('join-game', {
      gameId,
      playerId,
      playerName,
    }, (response: { success: boolean; error?: string }) => {
      if (response?.success) {
        console.log('Successfully joined game')
      } else {
        console.error('Failed to join game:', response?.error)
        setError(response?.error || 'Failed to join game')
      }
    })
  }, [socket, isConnected, gameId, playerId, playerName])

  // Send periodic pings to maintain presence
  useEffect(() => {
    if (!socket || !isConnected || !gameId || !playerId) return

    const pingInterval = setInterval(() => {
      socket.emit('ping', { gameId, playerId })
    }, 5000)

    return () => {
      clearInterval(pingInterval)
    }
  }, [socket, isConnected, gameId, playerId])

  return {
    socket,
    isConnected,
    isConnecting,
    error,
    presence,
  }
}
