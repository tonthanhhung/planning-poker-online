# Planning Poker Online

A real-time collaborative Planning Poker application for agile teams, built with Next.js 14, Socket.IO, and PostgreSQL.

## Features

- **Real-time Voting**: Vote on story points simultaneously with your team via WebSocket
- **Socket.IO Emoji Reactions**: Send animated emoji reactions to other players in real-time
- **Viewer Mode**: Join as a viewer without voting privileges
- **Live Presence Tracking**: See who's online with real-time presence indicators
- **Card Placement Animations**: Smooth card dealing and flip animations using Framer Motion
- **Issue Management**: Add, edit, delete, and track estimation issues
- **CSV Import**: Bulk import issues from CSV files
- **Vote Reset Sync**: All players see votes reset instantly via WebSocket
- **Coffee Break Cards**: Take a break when needed ☕
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript (strict mode)
- **Styling**: Tailwind CSS + Custom animations
- **Animations**: Framer Motion
- **Real-time**: Socket.IO (WebSocket + fallback)
- **Database**: PostgreSQL (via `pg` driver - direct connection, not Supabase client)
- **Server**: Custom Node.js server with integrated Socket.IO (`server.ts`)
- **Deployment**: Fly.io with Docker

## Architecture

```
React Client <--WebSocket/Socket.IO--> Socket.IO Server <--pg--> PostgreSQL
    |                                       |
    +-- LocalStorage                        +-- Presence tracking
```

### Key Components

- **Socket.IO Events**: Real-time presence, reactions, voting, game state sync
- **Custom Server**: `server.ts` - Node.js HTTP server with Next.js + Socket.IO
- **Database Layer**: `src/lib/db.ts` - PostgreSQL queries via `pg` pool
- **Presence Server**: `src/lib/presence-server.ts` - Socket.IO singleton managing rooms and events

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- PostgreSQL database (Supabase or any provider)

### 1. Set Up PostgreSQL

If using **Supabase**:
1. Create a project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run: `supabase/migrations/001_initial_schema.sql`
3. Copy your database connection string from Settings → Database

### 2. Configure Environment Variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
# PostgreSQL connection string (required)
DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres

# Optional: Git commit hash for version display
NEXT_PUBLIC_GIT_COMMIT=dev
```

**Note**: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are used for build-time configuration but the app uses direct PostgreSQL connection via `DATABASE_URL` for database operations.

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## How to Use

1. **Create a Game**: Enter a game name and click "Create Game"
2. **Share URL**: Copy the game URL and share with your team
3. **Join as Player or Viewer**: Choose your role when joining
4. **Add Issues**: Add issues manually or import from CSV
5. **Vote**: Select a card (Fibonacci sequence)
6. **Send Reactions**: Click emoji to react to other players
7. **Reveal**: Facilitator reveals all votes
8. **Discuss**: If votes differ, discuss and revote
9. **Next Issue**: Move to the next issue when consensus is reached

## Card Values

Standard Planning Poker Fibonacci sequence:
`0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 100` plus Coffee Break (☕)

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/socket/        # Socket.IO route handler
│   ├── game/[id]/         # Game room page
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Landing page
├── components/            # React components
│   ├── GameRoom.tsx       # Main game room (1000+ lines)
│   ├── PokerCard.tsx      # Card with animations
│   ├── PokerTable.tsx     # Game table layout
│   ├── Reactions.tsx      # Emoji reactions
│   ├── CSVImport.tsx      # CSV import modal
│   └── ...
├── hooks/                 # Custom React hooks
│   ├── useSocket.ts       # Socket.IO connection
│   ├── useGame.ts         # Game state management
│   ├── usePlayer.ts       # Player session
│   └── useActivePlayers.ts
├── lib/                   # Utilities
│   ├── db.ts              # PostgreSQL queries
│   ├── presence-server.ts # Socket.IO server
│   ├── database.types.ts  # Database types
│   └── avatar.ts          # Avatar generation
└── types/                 # TypeScript types
    └── index.ts           # Core shared types

# Root files
├── server.ts              # Custom Node.js + Socket.IO server
├── Dockerfile             # Multi-stage Docker build
├── fly.toml               # Fly.io configuration
├── deploy.sh              # Deployment script
└── next.config.js         # Next.js config
```

## Database Schema

4 main tables:

- **games**: Game rooms with settings (status, current_issue_id)
- **players**: Players in each game (is_facilitator, is_viewer)
- **issues**: Stories/tasks to estimate (status, order)
- **votes**: Player votes per issue

See `supabase/migrations/001_initial_schema.sql` for full schema.

## Socket.IO Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `create-game` | C→S | Create new game |
| `join-game` | C→S | Player joins room |
| `submit-vote` | C→S | Cast a vote |
| `reset-votes` | C→S | Clear votes |
| `update-game-status` | C→S | lobby→voting→revealed |
| `reaction` | C→S→C | Emoji reaction broadcast |
| `game-updated` | S→C | Game state changes |
| `votes-updated` | S→C | New vote submitted |
| `presence-update` | S→C | Online player list |

## Deployment

### Fly.io (Recommended)

**Required secrets:**
```bash
# Set on Fly.io (not in code!)
fly secrets set DATABASE_URL="postgresql://..."
fly secrets set NEXT_PUBLIC_SUPABASE_URL="https://..."
fly secrets set NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."
```

**Deploy:**
```bash
./deploy.sh
```

Or manually:
```bash
fly deploy
```

**Features:**
- TCP services for WebSocket support (not HTTP)
- Auto-suspend enabled (min_machines_running = 0)
- 256MB RAM, shared CPU

### Other Platforms

Any platform supporting:
- Node.js 20+
- WebSocket/TCP connections
- PostgreSQL database

## Development Commands

```bash
npm run dev          # Development server with Socket.IO
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint
npm run version:patch # Bump patch version
npm run version:minor # Bump minor version
npm run version:major # Bump major version
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXT_PUBLIC_SUPABASE_URL` | Build | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Build | Supabase anon key |
| `NEXT_PUBLIC_GIT_COMMIT` | No | Version display (default: dev) |

## Game Settings

Games can have these settings (stored in `games.settings` JSONB):

- `maxVotes`: Maximum votes per player (default: 9)
- `autoReveal`: Auto-reveal when all voted (default: false)
- `anonymousVotes`: Hide votes until reveal (default: false)

## Future Enhancements

- [ ] User authentication for persistent history
- [ ] Jira/Linear/Monday.com integrations
- [ ] Advanced analytics and reporting
- [ ] Custom card decks
- [ ] Timer for voting rounds
- [ ] Export estimates to CSV/PDF
- [ ] Mobile app (React Native)

## License

MIT

## Credits

Built for agile teams ❤️
