-- Planning Poker Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (to start fresh)
DROP TABLE IF EXISTS votes CASCADE;
DROP TABLE IF EXISTS issues CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS games CASCADE;

-- Games table
CREATE TABLE games (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT NOT NULL,
  status TEXT DEFAULT 'lobby' CHECK (status IN ('lobby', 'voting', 'revealed')),
  current_issue_id TEXT,
  settings JSONB DEFAULT '{"maxVotes": 9, "autoReveal": false, "anonymousVotes": false}'::jsonb
);

-- Players table
CREATE TABLE players (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar TEXT,
  is_facilitator BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, name)
);

-- Issues table
CREATE TABLE issues (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  "order" INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'voting', 'completed')),
  estimated_points INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Votes table
CREATE TABLE votes (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, issue_id, player_id)
);

-- Indexes for better query performance
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_players_game_id ON players(game_id);
CREATE INDEX idx_issues_game_id ON issues(game_id);
CREATE INDEX idx_issues_order ON issues("order");
CREATE INDEX idx_issues_game_status ON issues(game_id, status);
CREATE INDEX idx_votes_game_id ON votes(game_id);
CREATE INDEX idx_votes_issue_id ON votes(issue_id);
CREATE INDEX idx_votes_player_id ON votes(player_id);

-- Enable Row Level Security
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Policies for games
CREATE POLICY "Allow public read access on games" ON games FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on games" ON games FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on games" ON games FOR UPDATE USING (true);

-- Policies for players
CREATE POLICY "Allow public read access on players" ON players FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on players" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on players" ON players FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on players" ON players FOR DELETE USING (true);

-- Policies for issues
CREATE POLICY "Allow public read access on issues" ON issues FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on issues" ON issues FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on issues" ON issues FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on issues" ON issues FOR DELETE USING (true);

-- Policies for votes
CREATE POLICY "Allow public read access on votes" ON votes FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on votes" ON votes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on votes" ON votes FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on votes" ON votes FOR DELETE USING (true);

-- Enable Realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE games;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE issues;
ALTER PUBLICATION supabase_realtime ADD TABLE votes;
