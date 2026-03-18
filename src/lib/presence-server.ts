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
  deleteGame,
  getGameLastActivity,
} from './db'
import type { Game, Player, Issue, Vote } from '@/types'

export interface PlayerPresence {
  playerId: string
  playerName: string
  gameId: string
  lastPing: number
  isOnline: boolean
}

// Game cleanup threshold: 30 days of inactivity
const GAME_CLEANUP_THRESHOLD = 30 * 24 * 60 * 60 * 1000

export class PresenceServer {
  private io: SocketIOServer | null = null
  private presence: Map<string, PlayerPresence> = new Map()
  // Track last activity time per game (in-memory only, persists during server lifetime)
  private gameActivity: Map<string, number> = new Map()
  // No more periodic check interval - allows server to auto-suspend when idle
  private readonly OFFLINE_THRESHOLD = 60000 // 60 seconds - longer threshold allows auto-suspend

  private updateActivity(playerId: string, gameId: string) {
    const presence = this.presence.get(playerId)
    if (presence) {
      presence.lastPing = Date.now()
      presence.isOnline = true
      this.presence.set(playerId, presence)
      // Broadcast presence update only on activity, not on a timer
      this.broadcastPresence(gameId)
    }
    // Track game activity for cleanup
    this.gameActivity.set(gameId, Date.now())
  }

  // Check and cleanup stale games (called lazily when game is accessed)
  private async cleanupStaleGame(gameId: string): Promise<boolean> {
    const lastActivity = this.gameActivity.get(gameId)
    
    // If no in-memory activity, check database
    if (!lastActivity) {
      try {
        const dbLastActivity = await getGameLastActivity(gameId)
        if (dbLastActivity) {
          const dbTime = new Date(dbLastActivity).getTime()
          this.gameActivity.set(gameId, dbTime)
          
          if (Date.now() - dbTime > GAME_CLEANUP_THRESHOLD) {
            console.log(`Game ${gameId} stale (DB check), deleting...`)
            await deleteGame(gameId)
            this.gameActivity.delete(gameId)
            return true // Game was deleted
          }
        }
      } catch (error) {
        // Game might not exist
        console.log(`Game ${gameId} not found in DB`)
        return true
      }
      return false
    }
    
    // Check if game is stale based on in-memory activity
    if (Date.now() - lastActivity > GAME_CLEANUP_THRESHOLD) {
      console.log(`Game ${gameId} stale (memory check), deleting...`)
      try {
        await deleteGame(gameId)
        this.gameActivity.delete(gameId)
        return true // Game was deleted
      } catch (error) {
        console.error(`Failed to delete stale game ${gameId}:`, error)
        return false
      }
    }
    
    return false // Game is still active
  }

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
          
          // Check if game is stale and delete if needed
          const wasDeleted = await this.cleanupStaleGame(gameId)
          if (wasDeleted) {
            callback({ success: false, error: 'Game not found or has expired' })
            return
          }
          
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
          
          // Check if game is stale and delete if needed
          const wasDeleted = await this.cleanupStaleGame(gameId)
          if (wasDeleted) {
            callback({ success: false, error: 'Game not found or has expired' })
            return
          }
          
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

      // Update game status - also updates activity
      socket.on('update-game-status', async ({ gameId, status, playerId }, callback) => {
        try {
          console.log(`Updating game ${gameId} status to ${status}`)
          const game = await updateGameStatus(gameId, status)
          
          // Update activity if playerId provided
          if (playerId) {
            this.updateActivity(playerId, gameId)
          }
          
          // Broadcast to all clients in game
          this.io?.to(gameId).emit('game-updated', game)
          
          if (callback) callback({ success: true, game })
        } catch (error) {
          console.error('Failed to update game status:', error)
          if (callback) callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
        }
      })

      // Submit vote - also updates activity
      socket.on('submit-vote', async ({ gameId, issueId, playerId, points }, callback) => {
        try {
          console.log(`Player ${playerId} voted ${points} on issue ${issueId}`)
          const vote = await submitVote(gameId, issueId, playerId, points)
          
          // Update activity
          this.updateActivity(playerId, gameId)
          
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

      // Reset votes - also updates activity
      socket.on('reset-votes', async ({ gameId, issueId, playerId }, callback) => {
        try {
          console.log(`Resetting votes for issue ${issueId}`)
          await resetVotes(gameId, issueId)
          
          // Update activity if playerId provided
          if (playerId) {
            this.updateActivity(playerId, gameId)
          }
          
          // Broadcast to all clients in game
          this.io?.to(gameId).emit('votes-reset', { issueId })
          
          if (callback) callback({ success: true })
        } catch (error) {
          console.error('Failed to reset votes:', error)
          if (callback) callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
        }
      })

      // Create issue - also updates activity
      socket.on('create-issue', async ({ gameId, title, description, order, status, playerId }, callback) => {
        try {
          console.log(`Creating issue: ${title} in game ${gameId}`)
          const issue = await createIssue(gameId, title, description, order, status)
          
          // Update activity if playerId provided
          if (playerId) {
            this.updateActivity(playerId, gameId)
          }
          
          // Broadcast to all clients in game
          this.io?.to(gameId).emit('issue-created', issue)
          
          if (callback) callback({ success: true, issue })
        } catch (error) {
          console.error('Failed to create issue:', error)
          if (callback) callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
        }
      })

      // Update issue - also updates activity
      socket.on('update-issue', async ({ issueId, updates, playerId }, callback) => {
        try {
          console.log(`Updating issue ${issueId}:`, updates)
          const issue = await updateIssue(issueId, updates)
          
          // Update activity if playerId provided
          if (playerId) {
            this.updateActivity(playerId, issue.game_id)
          }
          
          // Broadcast to all clients in game
          this.io?.to(issue.game_id).emit('issue-updated', issue)
          
          if (callback) callback({ success: true, issue })
        } catch (error) {
          console.error('Failed to update issue:', error)
          if (callback) callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
        }
      })

      // Delete issue - also updates activity
      socket.on('delete-issue', async ({ issueId, gameId, playerId }, callback) => {
        try {
          console.log(`Deleting issue ${issueId}`)
          await deleteIssue(issueId)
          
          // Update activity if playerId provided
          if (playerId) {
            this.updateActivity(playerId, gameId)
          }
          
          // Broadcast to all clients in game
          this.io?.to(gameId).emit('issue-deleted', { issueId })
          
          if (callback) callback({ success: true })
        } catch (error) {
          console.error('Failed to delete issue:', error)
          if (callback) callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
        }
      })

      // Set current issue - also updates activity
      socket.on('set-current-issue', async ({ gameId, issueId, playerId }, callback) => {
        try {
          console.log(`Setting current issue ${issueId} for game ${gameId}`)
          const game = await setCurrentIssue(gameId, issueId)
          
          // Update activity if playerId provided
          if (playerId) {
            this.updateActivity(playerId, gameId)
          }
          
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

      // Handle activity (replaces ping - tracks meaningful interactions)
      socket.on('activity', ({ gameId, playerId }) => {
        this.updateActivity(playerId, gameId)
      })

      // Handle reactions - also updates activity
      socket.on('reaction', ({ gameId, emoji, playerName, targetPlayerId, isImage, imageUrl }) => {
        console.log(`Reaction from ${playerName} in game ${gameId}: ${emoji} -> ${targetPlayerId || 'random'}`)
        // Find playerId from presence map
        for (const [pid, presence] of this.presence.entries()) {
          if (presence.playerName === playerName && presence.gameId === gameId) {
            this.updateActivity(pid, gameId)
            break
          }
        }
        const room = this.io?.to(gameId)
        if (room) {
          room.emit('reaction', { emoji, playerName, targetPlayerId, isImage, imageUrl })
        }
      })

      // Handle card placement animations - also updates activity
      socket.on('card-placed', ({ gameId, playerId, playerName, cardValue }) => {
        this.updateActivity(playerId, gameId)
        socket.to(gameId).emit('card-placed', { playerId, playerName, cardValue })
      })

      // Handle vote changes after reveal
      socket.on('vote-changed-after-reveal', ({ gameId, issueId, playerId }) => {
        console.log(`Vote changed after reveal: player ${playerId} on issue ${issueId} in game ${gameId}`)
        // Broadcast to all clients in game
        this.io?.to(gameId).emit('vote-changed-after-reveal', { issueId, playerId })
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

    // Start checking for inactive players - REMOVED to allow auto-suspend
    // Periodic checks prevent server from suspending; we now use activity-based updates only
    return this.io
  }

  private checkInactivePlayers() {
    // Only called manually now (e.g., on disconnect), not on a timer
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
    // No periodic intervals to clean up anymore
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
