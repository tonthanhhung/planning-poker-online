-- Add is_viewer column to players table
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_viewer BOOLEAN DEFAULT FALSE;

-- Update existing players to have is_viewer = false
UPDATE players SET is_viewer = FALSE WHERE is_viewer IS NULL;
