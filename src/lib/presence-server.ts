import { Server as NetServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'

export interface PlayerPresence {
  playerId: string
  playerName: string
  gameId: string
  lastPing: number
  isOnline: boolean
}

export class PresenceServer {
  private io: SocketIOServer | null = null
  private presence: Map<string, PlayerPresence> = new Map()
  private checkInterval: NodeJS.Timeout | null = null
  private readonly PING_INTERVAL = 5000 // 5 seconds
  private readonly OFFLINE_THRESHOLD = 10000 // 10 seconds

  attach(server: NetServer) {
    this.io = new SocketIOServer(server, {
      path: '/api/socket',
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    })

    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id)

      // Handle player joining
      socket.on('join-game', ({ gameId, playerId, playerName }) => {
        socket.join(gameId)
        
        const presence: PlayerPresence = {
          playerId,
          playerName,
          gameId,
          lastPing: Date.now(),
          isOnline: true,
        }
        
        this.presence.set(playerId, presence)
        
        // Broadcast to all clients in game
        this.broadcastPresence(gameId)
        
        console.log(`Player ${playerName} joined game ${gameId}`)
      })

      // Handle ping
      socket.on('ping', ({ gameId, playerId }) => {
        const presence = this.presence.get(playerId)
        if (presence) {
          presence.lastPing = Date.now()
          presence.isOnline = true
          this.presence.set(playerId, presence)
        }
      })

      // Handle reactions
      socket.on('reaction', ({ gameId, emoji, playerName, targetPlayerId, isImage, imageUrl }) => {
        // Broadcast reaction to all players in the game (including targetPlayerId, isImage, imageUrl)
        this.io?.to(gameId).emit('reaction', { emoji, playerName, targetPlayerId, isImage, imageUrl })
      })

      // Handle card placement animations
      socket.on('card-placed', ({ gameId, playerId, playerName, cardValue }) => {
        // Broadcast card placement to all other players in the game
        socket.to(gameId).emit('card-placed', { playerId, playerName, cardValue })
      })

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id)
        
        // Find and mark player as offline
        for (const [playerId, presence] of this.presence.entries()) {
          if (presence.lastPing < Date.now() - this.OFFLINE_THRESHOLD) {
            presence.isOnline = false
            this.presence.set(playerId, presence)
            this.broadcastPresence(presence.gameId)
          }
        }
      })
    })

    // Start checking for inactive players
    this.checkInterval = setInterval(() => {
      this.checkInactivePlayers()
    }, this.PING_INTERVAL)

    return this.io
  }

  private checkInactivePlayers() {
    const now = Date.now()
    
    for (const [playerId, presence] of this.presence.entries()) {
      const timeSinceLastPing = now - presence.lastPing
      
      if (timeSinceLastPing > this.OFFLINE_THRESHOLD && presence.isOnline) {
        presence.isOnline = false
        this.presence.set(playerId, presence)
        this.broadcastPresence(presence.gameId)
        console.log(`Player ${presence.playerName} marked as offline`)
      }
    }
  }

  private broadcastPresence(gameId: string) {
    if (!this.io) return
    
    const gamePlayers = Array.from(this.presence.values())
      .filter(p => p.gameId === gameId)
      .map(p => ({
        playerId: p.playerId,
        playerName: p.playerName,
        isOnline: p.isOnline,
        lastPing: p.lastPing,
      }))

    this.io.to(gameId).emit('presence-update', gamePlayers)
  }

  getPresence(gameId: string) {
    return Array.from(this.presence.values())
      .filter(p => p.gameId === gameId)
  }

  destroy() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
    }
    if (this.io) {
      this.io.close()
    }
  }
}

// Singleton instance
let presenceServer: PresenceServer | null = null

export function getPresenceServer(): PresenceServer {
  if (!presenceServer) {
    presenceServer = new PresenceServer()
  }
  return presenceServer
}
