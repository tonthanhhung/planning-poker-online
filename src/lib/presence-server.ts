import { Server as NetServer } from 'http'
import { Server as SocketIOServer, Socket } from 'socket.io'
import {
  createGame,
  joinGame,
  getGame,
  getPlayerByGameAndName,
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

// Kick timeout: 30 seconds
const KICK_TIMEOUT = 30 * 1000

interface PendingKick {
  targetPlayerId: string
  targetPlayerName: string
  initiatorPlayerId: string
  initiatorPlayerName: string
  gameId: string
  timeoutId: NodeJS.Timeout
  countdownIntervalId: NodeJS.Timeout | null
  startedAt: number
  duration: number
}

export class PresenceServer {
  private io: SocketIOServer | null = null
  // Presence keyed by "${gameId}:${playerName}" — stable identity, no stale UUIDs
  private presence: Map<string, PlayerPresence> = new Map()
  // Track last activity time per game (in-memory only, persists during server lifetime)
  private gameActivity: Map<string, number> = new Map()
  // Track pending kicks (targetPlayerId -> PendingKick)
  private pendingKicks: Map<string, PendingKick> = new Map()
  // Map socketId → { gameId, playerName } for clean disconnect handling
  private socketPresenceMap: Map<string, { gameId: string; playerName: string }> = new Map()
  // No more periodic check interval - allows server to auto-suspend when idle
  private readonly OFFLINE_THRESHOLD = 60000 // 60 seconds - longer threshold allows auto-suspend

  /** Presence key used throughout this class */
  private presenceKey(gameId: string, playerName: string): string {
    return `${gameId}:${playerName}`
  }

  private updateActivityByName(gameId: string, playerName: string) {
    const key = this.presenceKey(gameId, playerName)
    const presence = this.presence.get(key)
    if (presence) {
      presence.lastPing = Date.now()
      presence.isOnline = true
      this.presence.set(key, presence)
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

      // Join a game — client sends playerName only, server resolves UUID from DB
      socket.on('join-game', async ({ gameId, playerName }, callback) => {
        try {
          console.log(`Player joining: ${playerName} to game ${gameId}`)

          // Check if game is stale and delete if needed
          const wasDeleted = await this.cleanupStaleGame(gameId)
          if (wasDeleted) {
            if (callback) callback({ success: false, error: 'Game not found or has expired' })
            return
          }

          // Join socket room
          socket.join(gameId)

          // Track socket → playerName for disconnect cleanup
          this.socketPresenceMap.set(socket.id, { gameId, playerName })

          // Resolve player UUID from DB (may be null for brand-new users before create-player)
          const player = await getPlayerByGameAndName(gameId, playerName).catch(() => null)
          const key = this.presenceKey(gameId, playerName)

          this.presence.set(key, {
            playerId: player?.id ?? '',
            playerName,
            gameId,
            lastPing: Date.now(),
            isOnline: true,
          })

          if (player) {
            await updatePlayerLastActive(player.id)
          }

          this.broadcastPresence(gameId)
          socket.emit('joined-game', { gameId, playerName })
          console.log(`Player ${playerName} joined game ${gameId}`)
          if (callback) callback({ success: true })
        } catch (error) {
          console.error('Failed to join game:', error)
          if (callback) callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
        }
      })

      // Create / reconnect player — prevents duplicate names, returns existing row on reconnect
      socket.on('create-player', async ({ gameId, playerName, isViewer }, callback) => {
        try {
          console.log(`Creating player: ${playerName} in game ${gameId}, isViewer: ${isViewer}`)
          const { player, isNew } = await joinGame(gameId, playerName, isViewer || false)

          // Update presence with confirmed UUID (join-game may have run first with an empty id)
          const key = this.presenceKey(gameId, playerName)
          const existing = this.presence.get(key)
          this.presence.set(key, {
            playerId: player.id,
            playerName,
            gameId,
            lastPing: Date.now(),
            isOnline: existing?.isOnline ?? true,
          })
          this.broadcastPresence(gameId)

          if (isNew) {
            // Broadcast new player to all clients
            this.io?.to(gameId).emit('player-joined', player)
          }

          callback({ success: true, player, isNew })
        } catch (error) {
          console.error('Failed to create player:', error)
          callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
        }
      })

      // Update game status — client sends playerName for activity tracking
      socket.on('update-game-status', async ({ gameId, status, playerName }, callback) => {
        try {
          console.log(`Updating game ${gameId} status to ${status}`)
          const game = await updateGameStatus(gameId, status)

          if (playerName) this.updateActivityByName(gameId, playerName)

          this.io?.to(gameId).emit('game-updated', game)
          if (callback) callback({ success: true, game })
        } catch (error) {
          console.error('Failed to update game status:', error)
          if (callback) callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
        }
      })

      // Submit vote — client sends playerName; server resolves UUID from DB
      socket.on('submit-vote', async ({ gameId, issueId, playerName, points }, callback) => {
        try {
          console.log(`Player ${playerName} voted ${points} on issue ${issueId}`)

          const player = await getPlayerByGameAndName(gameId, playerName)
          if (!player) {
            if (callback) callback({ success: false, error: 'Player not found in this game' })
            return
          }

          const vote = await submitVote(gameId, issueId, player.id, points)
          this.updateActivityByName(gameId, playerName)

          const votes = await getVotesForIssue(gameId, issueId)
          this.io?.to(gameId).emit('votes-updated', { issueId, votes })

          if (callback) callback({ success: true, vote })
        } catch (error) {
          console.error('Failed to submit vote:', error)
          if (callback) callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
        }
      })

      // Reset votes — client sends playerName for activity tracking
      socket.on('reset-votes', async ({ gameId, issueId, playerName }, callback) => {
        try {
          console.log(`Resetting votes for issue ${issueId}`)
          await resetVotes(gameId, issueId)

          if (playerName) this.updateActivityByName(gameId, playerName)

          this.io?.to(gameId).emit('votes-reset', { issueId })
          if (callback) callback({ success: true })
        } catch (error) {
          console.error('Failed to reset votes:', error)
          if (callback) callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
        }
      })

      // Create issue — client sends playerName for activity tracking
      socket.on('create-issue', async ({ gameId, title, description, order, status, playerName }, callback) => {
        try {
          console.log(`Creating issue: ${title} in game ${gameId}`)
          const issue = await createIssue(gameId, title, description, order, status)

          if (playerName) this.updateActivityByName(gameId, playerName)

          this.io?.to(gameId).emit('issue-created', issue)
          if (callback) callback({ success: true, issue })
        } catch (error) {
          console.error('Failed to create issue:', error)
          if (callback) callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
        }
      })

      // Update issue — client sends playerName for activity tracking
      socket.on('update-issue', async ({ issueId, updates, playerName }, callback) => {
        try {
          console.log(`Updating issue ${issueId}:`, updates)
          const issue = await updateIssue(issueId, updates)

          if (playerName) this.updateActivityByName(issue.game_id, playerName)

          this.io?.to(issue.game_id).emit('issue-updated', issue)
          if (callback) callback({ success: true, issue })
        } catch (error) {
          console.error('Failed to update issue:', error)
          if (callback) callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
        }
      })

      // Delete issue — client sends playerName for activity tracking
      socket.on('delete-issue', async ({ issueId, gameId, playerName }, callback) => {
        try {
          console.log(`Deleting issue ${issueId}`)
          await deleteIssue(issueId)

          if (playerName) this.updateActivityByName(gameId, playerName)

          this.io?.to(gameId).emit('issue-deleted', { issueId })
          if (callback) callback({ success: true })
        } catch (error) {
          console.error('Failed to delete issue:', error)
          if (callback) callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
        }
      })

      // Set current issue — client sends playerName for activity tracking
      socket.on('set-current-issue', async ({ gameId, issueId, playerName }, callback) => {
        try {
          console.log(`Setting current issue ${issueId} for game ${gameId}`)
          const game = await setCurrentIssue(gameId, issueId)

          if (playerName) this.updateActivityByName(gameId, playerName)

          this.io?.to(gameId).emit('game-updated', game)
          if (callback) callback({ success: true, game })
        } catch (error) {
          console.error('Failed to set current issue:', error)
          if (callback) callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
        }
      })

      // Remove player — playerId is the correct DB UUID from the players list
      socket.on('remove-player', async ({ playerId, gameId }, callback) => {
        try {
          console.log(`Removing player ${playerId} from game ${gameId}`)
          await removePlayer(playerId)

          // Remove from presence by matching playerId value
          for (const [key, pres] of this.presence.entries()) {
            if (pres.playerId === playerId) {
              this.presence.delete(key)
              break
            }
          }
          this.broadcastPresence(gameId)

          this.io?.to(gameId).emit('player-left', { playerId })
          if (callback) callback({ success: true })
        } catch (error) {
          console.error('Failed to remove player:', error)
          if (callback) callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
        }
      })

      // Initiate kick vote on another player
      // initiatorPlayerName comes from the client; targetPlayerId is the UUID from the players list (correct)
      socket.on('initiate-kick', async ({ gameId, targetPlayerId, initiatorPlayerName }, callback) => {
        try {
          // Check if there's already a pending kick for this player
          if (this.pendingKicks.has(targetPlayerId)) {
            callback({ success: false, error: 'Kick already pending for this player' })
            return
          }

          // Fetch game to validate players
          const gameData = await getGame(gameId)
          if (!gameData) {
            callback({ success: false, error: 'Game not found' })
            return
          }

          const { players } = gameData

          // Resolve initiator UUID from their name
          const initiator = players.find((p: Player) => p.name === initiatorPlayerName)
          const target = players.find((p: Player) => p.id === targetPlayerId)

          if (!initiator) {
            callback({ success: false, error: 'You are not a player in this game' })
            return
          }

          if (!target) {
            callback({ success: false, error: 'Target player not found' })
            return
          }

          // Validate initiator is not targeting themselves
          if (initiator.id === targetPlayerId) {
            callback({ success: false, error: 'You cannot kick yourself' })
            return
          }

          console.log(`Player ${initiatorPlayerName} initiated kick on player ${target.name} (${targetPlayerId}) in game ${gameId}`)

          // Set up timeout to auto-kick if not rejected
          const timeoutId = setTimeout(async () => {
            console.log(`Kick timeout reached for player ${targetPlayerId}, removing...`)
            await this.executeKick(gameId, targetPlayerId)
          }, KICK_TIMEOUT)

          // Set up countdown interval to broadcast remaining time every second
          const countdownIntervalId = setInterval(() => {
            const pendingKick = this.pendingKicks.get(targetPlayerId)
            if (!pendingKick) {
              clearInterval(countdownIntervalId)
              return
            }
            const elapsed = Date.now() - pendingKick.startedAt
            const remaining = Math.max(0, Math.ceil((KICK_TIMEOUT - elapsed) / 1000))
            
            // Broadcast countdown to all players in the game
            this.io?.to(gameId).emit('kick-countdown', {
              targetPlayerId,
              targetPlayerName: target.name,
              initiatorPlayerId: initiator.id,
              initiatorPlayerName,
              remainingSeconds: remaining,
            })
          }, 1000)

          // Store pending kick
          this.pendingKicks.set(targetPlayerId, {
            targetPlayerId,
            targetPlayerName: target.name,
            initiatorPlayerId: initiator.id,
            initiatorPlayerName,
            gameId,
            timeoutId,
            countdownIntervalId,
            startedAt: Date.now(),
            duration: KICK_TIMEOUT,
          })

          // Initial broadcast to all players
          this.io?.to(gameId).emit('kick-initiated', {
            targetPlayerId,
            targetPlayerName: target.name,
            initiatorPlayerId: initiator.id,
            initiatorPlayerName,
            timeout: KICK_TIMEOUT,
          })

          callback({ success: true })
        } catch (error) {
          console.error('Failed to initiate kick:', error)
          callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
        }
      })

      // Reject kick (target player clicks reject)
      socket.on('reject-kick', async ({ gameId, targetPlayerId }, callback) => {
        try {
          const pendingKick = this.pendingKicks.get(targetPlayerId)
          if (!pendingKick) {
            callback({ success: false, error: 'No pending kick found' })
            return
          }

          // Clear the timeout and countdown interval
          clearTimeout(pendingKick.timeoutId)
          if (pendingKick.countdownIntervalId) {
            clearInterval(pendingKick.countdownIntervalId)
          }
          this.pendingKicks.delete(targetPlayerId)

          console.log(`Player ${targetPlayerId} rejected kick in game ${gameId}`)

          // Notify all players that kick was rejected
          this.io?.to(gameId).emit('kick-rejected', {
            targetPlayerId,
            targetPlayerName: pendingKick.targetPlayerName,
            initiatorPlayerId: pendingKick.initiatorPlayerId,
            initiatorPlayerName: pendingKick.initiatorPlayerName
          })

          callback({ success: true })
        } catch (error) {
          console.error('Failed to reject kick:', error)
          callback({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
        }
      })

      // Update player name — playerId still comes from the players list (correct UUID, not localStorage)
      socket.on('update-player-name', async ({ playerId, gameId: nameGameId, newName }, callback) => {
        try {
          console.log(`Updating player ${playerId} name to: ${newName}`)
          await updatePlayerName(playerId, newName)

          // Rename the presence key: find the old entry by playerId, move it to new name key
          for (const [key, pres] of this.presence.entries()) {
            if (pres.playerId === playerId) {
              const newKey = this.presenceKey(pres.gameId, newName)
              this.presence.delete(key)
              this.presence.set(newKey, { ...pres, playerName: newName })
              // Update socket presence map if this socket owns it
              for (const [sid, sp] of this.socketPresenceMap.entries()) {
                if (sp.gameId === pres.gameId && sp.playerName === pres.playerName) {
                  this.socketPresenceMap.set(sid, { gameId: pres.gameId, playerName: newName })
                }
              }
              this.broadcastPresence(pres.gameId)
              this.io?.to(pres.gameId).emit('player-updated', { playerId, newName })
              break
            }
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

      // Handle activity — client sends playerName instead of playerId
      socket.on('activity', ({ gameId, playerName }) => {
        if (playerName) this.updateActivityByName(gameId, playerName)
      })

      // Handle reactions — already uses playerName for activity lookup
      socket.on('reaction', ({ gameId, emoji, playerName, targetPlayerId, isImage, imageUrl }) => {
        console.log(`Reaction from ${playerName} in game ${gameId}: ${emoji} -> ${targetPlayerId || 'random'}`)
        if (playerName) this.updateActivityByName(gameId, playerName)
        this.io?.to(gameId).emit('reaction', { emoji, playerName, targetPlayerId, isImage, imageUrl })
      })

      // Handle card placement animations — use playerName for activity, keep playerId in broadcast
      // (playerId here is the correct DB UUID from the players list, not localStorage)
      socket.on('card-placed', ({ gameId, playerId, playerName, cardValue }) => {
        if (playerName) this.updateActivityByName(gameId, playerName)
        socket.to(gameId).emit('card-placed', { playerId, playerName, cardValue })
      })

      // Handle vote changes after reveal — playerId is from the players list (correct UUID)
      socket.on('vote-changed-after-reveal', ({ gameId, issueId, playerId }) => {
        console.log(`Vote changed after reveal: player ${playerId} on issue ${issueId} in game ${gameId}`)
        this.io?.to(gameId).emit('vote-changed-after-reveal', { issueId, playerId })
      })

      // Handle disconnect — use socketPresenceMap for reliable lookup
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id)

        const socketData = this.socketPresenceMap.get(socket.id)
        this.socketPresenceMap.delete(socket.id)

        if (!socketData) return

        const { gameId, playerName } = socketData
        const key = this.presenceKey(gameId, playerName)
        const pres = this.presence.get(key)
        if (pres) {
          pres.isOnline = false
          this.presence.set(key, pres)
          this.broadcastPresence(gameId)

          const disconnectedPlayerId = pres.playerId
          if (disconnectedPlayerId) {
            // Clear pending kick where this player is the target
            const pendingKickAsTarget = this.pendingKicks.get(disconnectedPlayerId)
            if (pendingKickAsTarget) {
              clearTimeout(pendingKickAsTarget.timeoutId)
              if (pendingKickAsTarget.countdownIntervalId) {
                clearInterval(pendingKickAsTarget.countdownIntervalId)
              }
              this.pendingKicks.delete(disconnectedPlayerId)
              this.io?.to(pendingKickAsTarget.gameId).emit('kick-cancelled', {
                targetPlayerId: disconnectedPlayerId,
                targetPlayerName: pendingKickAsTarget.targetPlayerName,
                reason: 'disconnected',
              })
            }

            // Clear pending kicks where this player is the initiator
            for (const [targetId, kick] of this.pendingKicks.entries()) {
              if (kick.initiatorPlayerId === disconnectedPlayerId) {
                clearTimeout(kick.timeoutId)
                if (kick.countdownIntervalId) {
                  clearInterval(kick.countdownIntervalId)
                }
                this.pendingKicks.delete(targetId)
                this.io?.to(kick.gameId).emit('kick-cancelled', {
                  targetPlayerId: targetId,
                  targetPlayerName: kick.targetPlayerName,
                  reason: 'initiator_disconnected',
                })
              }
            }
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

    for (const [key, presence] of this.presence.entries()) {
      const timeSinceLastPing = now - presence.lastPing

      if (timeSinceLastPing > this.OFFLINE_THRESHOLD && presence.isOnline) {
        presence.isOnline = false
        this.presence.set(key, presence)
        this.broadcastPresence(presence.gameId)
        console.log(`Player ${presence.playerName} marked as offline`)
      }
    }
  }

  private async executeKick(gameId: string, targetPlayerId: string) {
    try {
      // Verify kick is still pending (wasn't rejected or cancelled)
      const pendingKick = this.pendingKicks.get(targetPlayerId)
      if (!pendingKick) {
        console.log(`Kick for ${targetPlayerId} was already cancelled, skipping execution`)
        return
      }

      // Clear the countdown interval
      if (pendingKick.countdownIntervalId) {
        clearInterval(pendingKick.countdownIntervalId)
      }

      // Remove from pending kicks FIRST to prevent race conditions
      this.pendingKicks.delete(targetPlayerId)

      // Remove player from database
      await removePlayer(targetPlayerId)

      // Remove from presence — find entry by playerId value
      for (const [key, pres] of this.presence.entries()) {
        if (pres.playerId === targetPlayerId) {
          this.presence.delete(key)
          break
        }
      }
      this.broadcastPresence(gameId)

      // Notify all clients that player was kicked
      this.io?.to(gameId).emit('player-kicked', { playerId: targetPlayerId })

      console.log(`Player ${targetPlayerId} kicked from game ${gameId}`)
    } catch (error) {
      console.error(`Failed to execute kick for player ${targetPlayerId}:`, error)
      // Notify clients that kick failed
      this.io?.to(gameId).emit('kick-failed', { 
        targetPlayerId, 
        error: error instanceof Error ? error.message : 'Unknown error'
      })
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
