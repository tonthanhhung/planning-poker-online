import { Server as NetServer } from 'http'
import { Server as SocketIOServer, Socket } from 'socket.io'
import {
  createGame,
  joinGame,
  getGame,
  submitVote,
  resetVotes,
  updateGameStatus,
  getVotesForIssue,
  createIssue,
  updateIssue,
  deleteIssue,
  setCurrentIssue,
  removePlayer,
  updatePlayerLastActive,
  updatePlayerName,
} from './db'
import type { Game, Player, Issue, Vote } from '@/types'

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
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
      connectTimeout: 45000,
    })

    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id)

      // === Database Operations ===

      // Create a new game
      socket.on('create-game', async ({ name, createdBy }, callback) => {
        try {
          console.log(`Creating game: ${name} by ${createdBy}`)
          const game = await createGame(name, createdBy)
          console.log(`Game created: ${game.id}`)
          callback({ success: true, game })
        } catch (error) {
          console.error('Failed to create game:', error)
          callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
        }
      })

      // Get game data
      socket.on('get-game', async ({ gameId }, callback) => {
        try {
          console.log(`Fetching game: ${gameId}`)
          const data = await getGame(gameId)
          callback({ success: true, ...data })
        } catch (error) {
          console.error('Failed to get game:', error)
          callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
        }
      })

      // Join a game
      socket.on('join-game', async ({ gameId, playerId, playerName }, callback) => {
        try {
          console.log(`Player joining: ${playerName} (${playerId}) to game ${gameId}`)
          
          // Join socket room
          socket.join(gameId)
          
          // Update database if player is new
          if (playerId) {
            await updatePlayerLastActive(playerId)
          }
          
          // Set up presence
          const presence: PlayerPresence = {
            playerId,
            playerName,
            gameId,
            lastPing: Date.now(),
            isOnline: true,
          }
          
          this.presence.set(playerId, presence)
          
          // Broadcast presence update
          this.broadcastPresence(gameId)
          
          // Send confirmation
          socket.emit('joined-game', { gameId, playerId, playerName })
          
          console.log(`Player ${playerName} joined game ${gameId}`)
          if (callback) callback({ success: true })
        } catch (error) {
          console.error('Failed to join game:', error)
          if (callback) callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
        }
      })

      // Create player (for new joins)
      socket.on('create-player', async ({ gameId, playerName, isViewer }, callback) => {
        try {
          console.log(`Creating player: ${playerName} in game ${gameId}, isViewer: ${isViewer}`)
          const player = await joinGame(gameId, playerName, isViewer || false)
          
          // Broadcast to all clients in game
          this.io?.to(gameId).emit('player-joined', player)
          
          callback({ success: true, player })
        } catch (error) {
          console.error('Failed to create player:', error)
          callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
        }
      })

      // Update game status
      socket.on('update-game-status', async ({ gameId, status }, callback) => {
        try {
          console.log(`Updating game ${gameId} status to ${status}`)
          const game = await updateGameStatus(gameId, status)
          
          // Broadcast to all clients in game
          this.io?.to(gameId).emit('game-updated', game)
          
          if (callback) callback({ success: true, game })
        } catch (error) {
          console.error('Failed to update game status:', error)
          if (callback) callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
        }
      })

      // Submit vote
      socket.on('submit-vote', async ({ gameId, issueId, playerId, points }, callback) => {
        try {
          console.log(`Player ${playerId} voted ${points} on issue ${issueId}`)
          const vote = await submitVote(gameId, issueId, playerId, points)
          
          // Get updated votes for this issue
          const votes = await getVotesForIssue(gameId, issueId)
          
          // Broadcast to all clients in game
          this.io?.to(gameId).emit('votes-updated', { issueId, votes })
          
          if (callback) callback({ success: true, vote })
        } catch (error) {
          console.error('Failed to submit vote:', error)
          if (callback) callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
        }
      })

      // Reset votes
      socket.on('reset-votes', async ({ gameId, issueId }, callback) => {
        try {
          console.log(`Resetting votes for issue ${issueId}`)
          await resetVotes(gameId, issueId)
          
          // Broadcast to all clients in game
          this.io?.to(gameId).emit('votes-reset', { issueId })
          
          if (callback) callback({ success: true })
        } catch (error) {
          console.error('Failed to reset votes:', error)
          if (callback) callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
        }
      })

      // Create issue
      socket.on('create-issue', async ({ gameId, title, description, order, status }, callback) => {
        try {
          console.log(`Creating issue: ${title} in game ${gameId}`)
          const issue = await createIssue(gameId, title, description, order, status)
          
          // Broadcast to all clients in game
          this.io?.to(gameId).emit('issue-created', issue)
          
          if (callback) callback({ success: true, issue })
        } catch (error) {
          console.error('Failed to create issue:', error)
          if (callback) callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
        }
      })

      // Update issue
      socket.on('update-issue', async ({ issueId, updates }, callback) => {
        try {
          console.log(`Updating issue ${issueId}:`, updates)
          const issue = await updateIssue(issueId, updates)
          
          // Broadcast to all clients in game
          this.io?.to(issue.game_id).emit('issue-updated', issue)
          
          if (callback) callback({ success: true, issue })
        } catch (error) {
          console.error('Failed to update issue:', error)
          if (callback) callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
        }
      })

      // Delete issue
      socket.on('delete-issue', async ({ issueId, gameId }, callback) => {
        try {
          console.log(`Deleting issue ${issueId}`)
          await deleteIssue(issueId)
          
          // Broadcast to all clients in game
          this.io?.to(gameId).emit('issue-deleted', { issueId })
          
          if (callback) callback({ success: true })
        } catch (error) {
          console.error('Failed to delete issue:', error)
          if (callback) callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
        }
      })

      // Set current issue
      socket.on('set-current-issue', async ({ gameId, issueId }, callback) => {
        try {
          console.log(`Setting current issue ${issueId} for game ${gameId}`)
          const game = await setCurrentIssue(gameId, issueId)
          
          // Broadcast to all clients in game
          this.io?.to(gameId).emit('game-updated', game)
          
          if (callback) callback({ success: true, game })
        } catch (error) {
          console.error('Failed to set current issue:', error)
          if (callback) callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
        }
      })

      // Remove player
      socket.on('remove-player', async ({ playerId, gameId }, callback) => {
        try {
          console.log(`Removing player ${playerId} from game ${gameId}`)
          await removePlayer(playerId)
          
          // Remove from presence
          this.presence.delete(playerId)
          this.broadcastPresence(gameId)
          
          // Broadcast to all clients in game
          this.io?.to(gameId).emit('player-left', { playerId })
          
          if (callback) callback({ success: true })
        } catch (error) {
          console.error('Failed to remove player:', error)
          if (callback) callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
        }
      })

      // Update player name
      socket.on('update-player-name', async ({ playerId, newName }, callback) => {
        try {
          console.log(`Updating player ${playerId} name to: ${newName}`)
          await updatePlayerName(playerId, newName)
          
          // Update presence
          const presence = this.presence.get(playerId)
          if (presence) {
            presence.playerName = newName
            this.presence.set(playerId, presence)
          }
          
          // Broadcast to all clients in game
          const gameId = presence?.gameId
          if (gameId) {
            this.io?.to(gameId).emit('player-updated', { playerId, newName })
          }
          
          if (callback) callback({ success: true })
        } catch (error) {
          console.error('Failed to update player name:', error)
          if (callback) callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
        }
      })

      // Get votes for an issue
      socket.on('get-votes', async ({ gameId, issueId }, callback) => {
        try {
          console.log(`Getting votes for issue ${issueId}`)
          const votes = await getVotesForIssue(gameId, issueId)
          if (callback) callback({ success: true, votes })
        } catch (error) {
          console.error('Failed to get votes:', error)
          if (callback) callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
        }
      })

      // === Presence & Animations ===

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
        console.log(`Reaction from ${playerName} in game ${gameId}: ${emoji} -> ${targetPlayerId || 'random'}`)
        const room = this.io?.to(gameId)
        if (room) {
          room.emit('reaction', { emoji, playerName, targetPlayerId, isImage, imageUrl })
        }
      })

      // Handle card placement animations
      socket.on('card-placed', ({ gameId, playerId, playerName, cardValue }) => {
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
