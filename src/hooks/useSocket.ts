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
  trackActivity: () => void
  isTabActive: boolean
}

// Time after which we stop sending activity if tab is inactive (10 minutes)
const TAB_INACTIVE_TIMEOUT = 10 * 60 * 1000

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
  const [isTabActive, setIsTabActive] = useState(true)
  
  // Track last activity time and tab visibility
  const lastActivityTime = useRef<number>(Date.now())
  const tabInactiveTimer = useRef<NodeJS.Timeout | null>(null)
  
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

  // Track tab visibility and focus
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible'
      console.log('Tab visibility changed:', isVisible ? 'visible' : 'hidden')
      
      if (isVisible) {
        // Tab became active - resume activity tracking
        setIsTabActive(true)
        lastActivityTime.current = Date.now()
        if (tabInactiveTimer.current) {
          clearTimeout(tabInactiveTimer.current)
          tabInactiveTimer.current = null
        }
      } else {
        // Tab became inactive - start timer
        lastActivityTime.current = Date.now()
        tabInactiveTimer.current = setTimeout(() => {
          console.log('Tab inactive for 10 minutes, pausing activity tracking')
          setIsTabActive(false)
        }, TAB_INACTIVE_TIMEOUT)
      }
    }

    const handleFocus = () => {
      console.log('Window focused')
      setIsTabActive(true)
      lastActivityTime.current = Date.now()
      if (tabInactiveTimer.current) {
        clearTimeout(tabInactiveTimer.current)
        tabInactiveTimer.current = null
      }
    }

    const handleBlur = () => {
      console.log('Window blurred')
      lastActivityTime.current = Date.now()
      tabInactiveTimer.current = setTimeout(() => {
        console.log('Tab inactive for 10 minutes, pausing activity tracking')
        setIsTabActive(false)
      }, TAB_INACTIVE_TIMEOUT)
    }

    // Listen for visibility and focus events
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)

    // Initial check
    if (document.visibilityState === 'hidden') {
      handleVisibilityChange()
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
      if (tabInactiveTimer.current) {
        clearTimeout(tabInactiveTimer.current)
      }
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

  // Activity tracking to maintain presence (only on meaningful actions, not periodic pings)
  // This allows the server to auto-suspend when idle while still tracking active players
  const trackActivity = useCallback(() => {
    // Don't send activity if tab has been inactive for 10+ minutes
    if (!isTabActive) {
      console.log('Activity tracking paused (tab inactive for 10+ minutes)')
      return
    }
    
    if (!socket || !isConnected || !gameId || !playerId) return
    
    lastActivityTime.current = Date.now()
    socket.emit('activity', { gameId, playerId })
  }, [socket, isConnected, gameId, playerId, isTabActive])

  return {
    trackActivity,
    socket,
    isConnected,
    isConnecting,
    error,
    presence,
    isTabActive,
  }
}
