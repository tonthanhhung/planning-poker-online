import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

// Helper function to create a new game
export async function createGame(name: string, createdBy: string) {
  const { data, error } = await supabase
    .from('games')
    .insert({
      name,
      created_by: createdBy,
      status: 'lobby',
      settings: {
        maxVotes: 9,
        autoReveal: false,
        anonymousVotes: false,
      },
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// Helper function to join a game
export async function joinGame(gameId: string, playerName: string) {
  const { data, error } = await supabase
    .from('players')
    .insert({
      game_id: gameId,
      name: playerName,
      is_facilitator: false,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// Helper function to get game with players and issues
export async function getGame(gameId: string) {
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single()

  if (gameError) throw gameError

  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('*')
    .eq('game_id', gameId)
    .order('joined_at')

  if (playersError) throw playersError

  const { data: issues, error: issuesError } = await supabase
    .from('issues')
    .select('*')
    .eq('game_id', gameId)
    .order('order')

  if (issuesError) throw issuesError

  return {
    game,
    players,
    issues,
  }
}

// Subscribe to game changes
export function subscribeToGame(gameId: string, callback: (payload: any) => void) {
  const channel = supabase
    .channel(`game:${gameId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${gameId}`,
      },
      callback
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'players',
        filter: `game_id=eq.${gameId}`,
      },
      callback
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'issues',
        filter: `game_id=eq.${gameId}`,
      },
      callback
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'votes',
        filter: `game_id=eq.${gameId}`,
      },
      callback
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

// Submit a vote
export async function submitVote(gameId: string, issueId: string, playerId: string, points: number) {
  const { data, error } = await supabase
    .from('votes')
    .upsert({
      game_id: gameId,
      issue_id: issueId,
      player_id: playerId,
      points,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'game_id,issue_id,player_id', // Specify the unique constraint columns
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// Reset votes for an issue
export async function resetVotes(gameId: string, issueId: string) {
  const { error } = await supabase
    .from('votes')
    .delete()
    .eq('game_id', gameId)
    .eq('issue_id', issueId)

  if (error) throw error
}

// Update game status
export async function updateGameStatus(gameId: string, status: 'lobby' | 'voting' | 'revealed') {
  const { data, error } = await supabase
    .from('games')
    .update({ status })
    .eq('id', gameId)
    .select()
    .single()

  if (error) throw error
  return data
}
