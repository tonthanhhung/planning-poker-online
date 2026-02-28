// Database types
export interface Game {
  id: string;
  name: string;
  created_at: string;
  created_by: string;
  status: 'lobby' | 'voting' | 'revealed';
  current_issue_id: string | null;
  settings: GameSettings;
}

export interface GameSettings {
  maxVotes: number;
  autoReveal: boolean;
  anonymousVotes: boolean;
}

export interface Player {
  id: string;
  game_id: string;
  name: string;
  avatar?: string;
  is_facilitator: boolean;
  joined_at: string;
}

export interface Issue {
  id: string;
  game_id: string;
  title: string;
  description?: string;
  order: number;
  status: 'pending' | 'voting' | 'completed';
  estimated_points?: number;
  created_at: string;
}

export interface Vote {
  id: string;
  game_id: string;
  issue_id: string;
  player_id: string;
  points: number;
  created_at: string;
  updated_at: string;
}

// Card values for planning poker (Fibonacci-like sequence)
export const CARD_VALUES = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 100];

// Coffee break card
export const COFFEE_CARD = '☕';

// Game status types
export type GameStatus = 'lobby' | 'voting' | 'revealed';

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
}
