import { Pool, QueryResult } from 'pg'
import type { Game, Player, Issue, Vote } from '@/types'

// Lazy initialization of pool to ensure env vars are loaded first
let pool: Pool | null = null

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Enable SSL only if DATABASE_URL contains 'supabase' (production)
      // Local PostgreSQL doesn't need SSL
      ssl: process.env.DATABASE_URL?.includes('supabase') ? { 
        rejectUnauthorized: false 
      } : false,
    })
  }
  return pool
}

export { getPool }

// Helper function to create a new game
export async function createGame(name: string, createdBy: string): Promise<Game> {
  const result = await getPool().query(
    `INSERT INTO games (name, created_by, status, settings) 
     VALUES ($1, $2, 'lobby', '{"maxVotes": 9, "autoReveal": false, "anonymousVotes": false}'::jsonb)
     RETURNING *`,
    [name, createdBy]
  )
  return result.rows[0]
}

// Helper function to join a game
// First player automatically becomes facilitator (is_facilitator = true)
export async function joinGame(gameId: string, playerName: string, isViewer: boolean = false): Promise<Player> {
  const result = await getPool().query(
    `INSERT INTO players (game_id, name, is_facilitator, is_viewer) 
     VALUES ($1, $2, NOT EXISTS (SELECT 1 FROM players WHERE game_id = $1), $3)
     RETURNING *`,
    [gameId, playerName, isViewer]
  )
  return result.rows[0]
}

// Helper function to get game with players and issues
export async function getGame(gameId: string): Promise<{ game: Game; players: Player[]; issues: Issue[] }> {
  const [gameResult, playersResult, issuesResult] = await Promise.all([
    getPool().query('SELECT * FROM games WHERE id = $1', [gameId]),
    getPool().query('SELECT * FROM players WHERE game_id = $1 ORDER BY joined_at', [gameId]),
    getPool().query('SELECT * FROM issues WHERE game_id = $1 ORDER BY "order"', [gameId]),
  ])

  if (gameResult.rows.length === 0) {
    throw new Error('Game not found')
  }

  return {
    game: gameResult.rows[0],
    players: playersResult.rows,
    issues: issuesResult.rows,
  }
}

// Submit a vote
export async function submitVote(
  gameId: string, 
  issueId: string, 
  playerId: string, 
  points: number
): Promise<Vote> {
  const result = await getPool().query(
    `INSERT INTO votes (game_id, issue_id, player_id, points, updated_at) 
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (game_id, issue_id, player_id) 
     DO UPDATE SET points = $4, updated_at = NOW()
     RETURNING *`,
    [gameId, issueId, playerId, points]
  )
  return result.rows[0]
}

// Reset votes for an issue
export async function resetVotes(gameId: string, issueId: string): Promise<void> {
  await getPool().query(
    'DELETE FROM votes WHERE game_id = $1 AND issue_id = $2',
    [gameId, issueId]
  )
}

// Update game status
export async function updateGameStatus(
  gameId: string, 
  status: 'lobby' | 'voting' | 'revealed'
): Promise<Game> {
  const result = await getPool().query(
    'UPDATE games SET status = $1 WHERE id = $2 RETURNING *',
    [status, gameId]
  )
  return result.rows[0]
}

// Get votes for an issue
export async function getVotesForIssue(gameId: string, issueId: string): Promise<Vote[]> {
  const result = await getPool().query(
    'SELECT * FROM votes WHERE game_id = $1 AND issue_id = $2',
    [gameId, issueId]
  )
  return result.rows
}

// Add a new issue
export async function createIssue(
  gameId: string, 
  title: string, 
  description?: string,
  order?: number,
  status?: 'pending' | 'voting'
): Promise<Issue> {
  const result = await getPool().query(
    `INSERT INTO issues (game_id, title, description, "order", status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [gameId, title, description || null, order || 0, status || 'pending']
  )
  return result.rows[0]
}

// Update issue
export async function updateIssue(
  issueId: string, 
  updates: Partial<Issue>
): Promise<Issue> {
  const setClause = Object.keys(updates)
    .map((key, index) => `"${key}" = $${index + 2}`)
    .join(', ')
  
  const values = [issueId, ...Object.values(updates)]
  
  const result = await getPool().query(
    `UPDATE issues SET ${setClause} WHERE id = $1 RETURNING *`,
    values
  )
  return result.rows[0]
}

// Delete issue
export async function deleteIssue(issueId: string): Promise<void> {
  await getPool().query('DELETE FROM issues WHERE id = $1', [issueId])
}

// Set current issue for game
export async function setCurrentIssue(gameId: string, issueId: string | null): Promise<Game> {
  const result = await getPool().query(
    'UPDATE games SET current_issue_id = $1 WHERE id = $2 RETURNING *',
    [issueId, gameId]
  )
  return result.rows[0]
}

// Update player last active
export async function updatePlayerLastActive(playerId: string): Promise<void> {
  await getPool().query(
    'UPDATE players SET last_active = NOW() WHERE id = $1',
    [playerId]
  )
}

// Remove player from game
export async function removePlayer(playerId: string): Promise<void> {
  await getPool().query('DELETE FROM players WHERE id = $1', [playerId])
}

// Update player name
export async function updatePlayerName(playerId: string, newName: string): Promise<void> {
  await getPool().query(
    'UPDATE players SET name = $1 WHERE id = $2',
    [newName, playerId]
  )
}

// Get all games
export async function getAllGames(): Promise<Game[]> {
  const result = await getPool().query('SELECT * FROM games ORDER BY created_at DESC')
  return result.rows
}

// Delete a game and all related data (players, issues, votes)
export async function deleteGame(gameId: string): Promise<void> {
  // Delete votes first (foreign key constraint)
  await getPool().query('DELETE FROM votes WHERE game_id = $1', [gameId])
  // Delete issues
  await getPool().query('DELETE FROM issues WHERE game_id = $1', [gameId])
  // Delete players
  await getPool().query('DELETE FROM players WHERE game_id = $1', [gameId])
  // Delete game
  await getPool().query('DELETE FROM games WHERE id = $1', [gameId])
}

// Get game's last activity time (most recent of: player last_active OR game created_at)
// Falls back to created_at so new/empty games are never wrongly treated as stale
export async function getGameLastActivity(gameId: string): Promise<Date | null> {
  const result = await getPool().query(
    `SELECT GREATEST(
       MAX(p.last_active),
       g.created_at
     ) as last_active
     FROM games g
     LEFT JOIN players p ON p.game_id = g.id
     WHERE g.id = $1
     GROUP BY g.created_at`,
    [gameId]
  )
  return result.rows[0]?.last_active || null
}
