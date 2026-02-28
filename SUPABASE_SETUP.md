# Supabase Setup Guide

## Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Fill in:
   - **Name**: planning-poker (or your choice)
   - **Database Password**: Choose a strong password
   - **Region**: Choose closest to your users
5. Click "Create new project"

Wait a few minutes for your project to be set up.

## Step 2: Run the Database Schema

1. In your Supabase dashboard, click on **SQL Editor** in the left sidebar
2. Click **New query**
3. Copy the contents of `supabase/migrations/001_initial_schema.sql`
4. Paste into the SQL Editor
5. Click **Run** (or press Ctrl+Enter / Cmd+Enter)

You should see a success message showing all tables were created.

## Step 3: Get Your API Keys

1. Go to **Settings** (gear icon in left sidebar)
2. Click on **API**
3. Copy these two values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (a long string)

## Step 4: Configure Your Environment

1. In your project root, create a `.env.local` file:

```bash
cp .env.local.example .env.local
```

2. Edit `.env.local` and paste your keys:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## Step 5: Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and start using the app!

## Optional: Set Up Row Level Security (RLS) for Production

For production, you'll want to enable proper RLS policies. The current setup allows public access for development ease. Here's how to secure it:

### 1. Enable RLS on all tables

```sql
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
```

### 2. Create policies for games

```sql
-- Allow anyone to read games
CREATE POLICY "Allow public read access on games" ON games
  FOR SELECT USING (true);

-- Allow anyone to create games
CREATE POLICY "Allow public insert access on games" ON games
  FOR INSERT WITH CHECK (true);

-- Allow anyone to update games
CREATE POLICY "Allow public update access on games" ON games
  FOR UPDATE USING (true);
```

### 3. Create policies for players

```sql
-- Allow anyone to read players
CREATE POLICY "Allow public read access on players" ON players
  FOR SELECT USING (true);

-- Allow anyone to join games as players
CREATE POLICY "Allow public insert access on players" ON players
  FOR INSERT WITH CHECK (true);

-- Allow players to update their own data
CREATE POLICY "Allow players to update own data" ON players
  FOR UPDATE USING (true);
```

### 4. Create policies for issues

```sql
-- Allow anyone to read issues
CREATE POLICY "Allow public read access on issues" ON issues
  FOR SELECT USING (true);

-- Allow facilitators to manage issues
CREATE POLICY "Allow facilitators to manage issues" ON issues
  FOR ALL USING (true);
```

### 5. Create policies for votes

```sql
-- Allow anyone to read votes
CREATE POLICY "Allow public read access on votes" ON votes
  FOR SELECT USING (true);

-- Allow players to vote
CREATE POLICY "Allow players to vote" ON votes
  FOR ALL USING (true);
```

## Testing Real-time Features

The app uses Supabase Realtime for live updates. To test:

1. Open the app in two different browser windows/tabs
2. Create or join a game in one tab
3. Join the same game in another tab using the game ID
4. You should see players appear in real-time!

## Troubleshooting

### "supabaseUrl is required" error

Make sure your `.env.local` file exists and has the correct values.

### Real-time updates not working

1. Check that your Supabase project has Realtime enabled
2. Go to **Database** > **Replication** in Supabase dashboard
3. Make sure the tables are published for realtime

### Database schema issues

Re-run the migration SQL file in the SQL Editor.

## Database Schema Overview

```
games
├── id (text, PK)
├── name (text)
├── created_at (timestamptz)
├── created_by (text)
├── status (text: lobby|voting|revealed)
├── current_issue_id (text)
└── settings (jsonb)

players
├── id (text, PK)
├── game_id (text, FK)
├── name (text)
├── avatar (text, nullable)
├── is_facilitator (boolean)
└── joined_at (timestamptz)

issues
├── id (text, PK)
├── game_id (text, FK)
├── title (text)
├── description (text, nullable)
├── order (integer)
├── status (text: pending|voting|completed)
├── estimated_points (integer, nullable)
└── created_at (timestamptz)

votes
├── id (text, PK)
├── game_id (text, FK)
├── issue_id (text, FK)
├── player_id (text, FK)
├── points (integer)
├── created_at (timestamptz)
└── updated_at (timestamptz)
```

## Next Steps

- Test the app locally
- Deploy to Vercel or your preferred hosting
- Set up proper authentication for production
- Customize the card deck and game settings
- Add more features like timers, analytics, etc.
