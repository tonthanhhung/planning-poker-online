export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      games: {
        Row: {
          id: string
          name: string
          created_at: string
          created_by: string
          status: 'lobby' | 'voting' | 'revealed'
          current_issue_id: string | null
          settings: Json
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          created_by: string
          status?: 'lobby' | 'voting' | 'revealed'
          current_issue_id?: string | null
          settings?: Json
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          created_by?: string
          status?: 'lobby' | 'voting' | 'revealed'
          current_issue_id?: string | null
          settings?: Json
        }
      }
      players: {
        Row: {
          id: string
          game_id: string
          name: string
          avatar: string | null
          is_facilitator: boolean
          joined_at: string
        }
        Insert: {
          id?: string
          game_id: string
          name: string
          avatar?: string | null
          is_facilitator?: boolean
          joined_at?: string
        }
        Update: {
          id?: string
          game_id?: string
          name?: string
          avatar?: string | null
          is_facilitator?: boolean
          joined_at?: string
        }
      }
      issues: {
        Row: {
          id: string
          game_id: string
          title: string
          description: string | null
          order: number
          status: 'pending' | 'voting' | 'completed'
          estimated_points: number | null
          created_at: string
        }
        Insert: {
          id?: string
          game_id: string
          title: string
          description?: string | null
          order?: number
          status?: 'pending' | 'voting' | 'completed'
          estimated_points?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          game_id?: string
          title?: string
          description?: string | null
          order?: number
          status?: 'pending' | 'voting' | 'completed'
          estimated_points?: number | null
          created_at?: string
        }
      }
      votes: {
        Row: {
          id: string
          game_id: string
          issue_id: string
          player_id: string
          points: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          game_id: string
          issue_id: string
          player_id: string
          points: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          game_id?: string
          issue_id?: string
          player_id?: string
          points?: number
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
