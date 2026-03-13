# Repository Guidelines

Guidelines for AI agents working in this codebase.

## Build/Lint/Test Commands

```bash
# Development server with Socket.IO (uses custom server.ts)
npm run dev

# Production build
npm run build

# Linting (ESLint with Next.js core-web-vitals rules)
npm run lint

# Production server (must run build first)
npm run start

# Deploy to Fly.io
./deploy.sh

# Version management
npm run version:patch
npm run version:minor
npm run version:major
```

**No test framework configured.** The project has zero test files. Discuss with the team before adding tests (Jest, Vitest, Playwright, etc.).

## Project Overview

Real-time collaborative Planning Poker app for agile teams. Built with:

- **Next.js 14** (App Router) + TypeScript with strict mode
- **Tailwind CSS** + Framer Motion animations
- **PostgreSQL** (via direct `pg` driver connection, NOT Supabase client)
- **Socket.IO** for WebSocket presence, reactions, and real-time game sync
- **Fly.io** for production deployment with Docker

### Key Features
- Socket.IO Emoji Reactions - Real-time emoji sync between players
- Viewer Mode - Users can join as viewers (no voting cards shown)
- Vote Reset Sync - All users see votes reset immediately via WebSocket
- Custom Server - Next.js + Socket.IO integrated in `server.ts`

## Architecture & Data Flow

### High-Level Architecture

```
┌─────────────────┐     WebSocket      ┌──────────────────┐
│   React Client  │ ◄─────────────────►│  Socket.IO Server│
│   (useSocket)   │    /api/socket     │  (presence-server│
└─────────────────┘                    │   + db.ts)       │
         │                             └────────┬─────────┘
         │                                      │
         ▼                                      ▼
┌─────────────────┐                    ┌──────────────────┐
│  LocalStorage   │                    │   PostgreSQL     │
│  (player prefs) │                    │   (Supabase)     │
└─────────────────┘                    └──────────────────┘
```

### Socket.IO Event Flow

1. **Client connects** via `useSocket()` hook → establishes WebSocket at `/api/socket`
2. **Player joins game** → `join-game` event → joins Socket.IO room per gameId
3. **Database operations** emit to room → all clients receive updates
4. **Presence tracking** via 5-second pings, 10-second offline threshold

### Key Events (Server-Client)

| Event | Direction | Purpose |
|-------|-----------|---------|
| `create-game` | C→S | Create new game |
| `join-game` | C→S | Player joins room |
| `create-player` | C→S | New player registration |
| `submit-vote` | C→S | Cast a vote |
| `reset-votes` | C→S | Clear votes for issue |
| `update-game-status` | C→S | lobby→voting→revealed |
| `reaction` | C→S→C | Emoji reaction broadcast |
| `game-updated` | S→C | Game state changes |
| `votes-updated` | S→C | New vote submitted |
| `votes-reset` | S→C | Votes cleared |
| `presence-update` | S→C | Online player list |

## Key Directories

```
src/
├── app/                    # Next.js 14 App Router
│   ├── api/socket/        # Socket.IO route handler
│   ├── game/[id]/         # Game room page (dynamic route)
│   ├── globals.css        # Tailwind + custom styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Landing page (game creation)
├── components/            # React components
│   ├── GameRoom.tsx       # Main game room (1000+ lines)
│   ├── PokerCard.tsx      # Card with Framer Motion animations
│   ├── PokerTable.tsx     # Game table visual layout
│   ├── Reactions.tsx      # Emoji reaction animations
│   └── ...
├── hooks/                 # Custom React hooks
│   ├── useGame.ts         # Game state + Socket.IO actions
│   ├── usePlayer.ts       # Player session + localStorage
│   ├── useSocket.ts       # Socket.IO connection management
│   └── useActivePlayers.ts
├── lib/                   # Utilities
│   ├── db.ts              # PostgreSQL queries via pg pool
│   ├── presence-server.ts # Socket.IO server singleton
│   ├── database.types.ts  # Supabase-style DB types
│   ├── funnyNames.ts      # Random name generator
│   └── avatar.ts          # Avatar generation utilities
└── types/                 # TypeScript types
    └── index.ts           # Core shared types

# Root files
├── server.ts              # Custom Node.js + Socket.IO server entry
├── Dockerfile             # Multi-stage Docker build
├── fly.toml               # Fly.io deployment config
├── deploy.sh              # Deployment script with env checks
└── next.config.js         # Next.js config (standalone output)
```

## Development Commands

### Local Development
```bash
npm run dev          # Starts server.ts with tsx (includes Socket.IO)
```

### Build & Production
```bash
npm run build        # Next.js static + server build
npm run start        # Production server (NODE_ENV=production)
```

### Deployment (Fly.io)
```bash
./deploy.sh          # Builds Docker image, deploys to Fly.io
```

Required environment variables for deploy:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `DATABASE_URL` (set as Fly.io secret)

## Code Conventions & Common Patterns

### TypeScript

- **Strict mode enabled** - no implicit any, strict null checks
- Explicit return types for exported functions
- Prefer `interface` over `type` for object shapes
- Use `type` for unions and mapped types
- Import types explicitly: `import type { Foo } from '@/types'`

### Import Order

```typescript
// 1. React/Next imports
import { useState } from 'react'
import { useRouter } from 'next/navigation'

// 2. Third-party libraries
import { motion } from 'framer-motion'
import { io } from 'socket.io-client'

// 3. Absolute imports (@/)
import { PokerCard } from '@/components/PokerCard'
import { useGame } from '@/hooks/useGame'

// 4. Relative imports (avoid when possible)
import { helper } from '../lib/helper'

// Types last
import type { Player, Game } from '@/types'
```

### Naming Conventions

| Category | Pattern | Example |
|----------|---------|---------|
| Components | PascalCase | `GameRoom.tsx`, `PokerCard.tsx` |
| Hooks | camelCase with `use` prefix | `useGame.ts`, `useSocket.ts` |
| Utilities | camelCase | `supabase.ts`, `db.ts` |
| Types/Interfaces | PascalCase | `Player`, `GameStatus` |
| Constants | UPPER_SNAKE_CASE | `CARD_VALUES`, `COFFEE_CARD` |
| Route files | lowercase with dashes | `game/[id]/page.tsx` |

### Component Structure

```typescript
'use client'  // MUST be first line if using hooks or browser APIs

// Imports
import { useState } from 'react'
import type { Props } from '@/types'

// Types (if component-specific)
interface ComponentProps {
  gameId: string
}

// Component
export function ComponentName({ gameId }: ComponentProps) {
  // Hooks
  const [state, setState] = useState()
  
  // Handlers
  const handleClick = () => {}
  
  // Render
  return <div>...</div>
}
```

### Tailwind CSS

Use theme colors from `tailwind.config.ts`:

```css
/* Primary palette */
bg-primary text-white           /* Primary blue */
bg-surface border-border        /* Cards/borders */
bg-background                   /* Page background */

/* Status colors */
text-success bg-green-light     /* Success states */
text-warning bg-yellow-light    /* Warnings */
text-error bg-red-light         /* Errors */

/* Elevation */
shadow-elevation-low
shadow-elevation-medium
shadow-elevation-high
```

### Error Handling Pattern

```typescript
// Socket.IO callbacks follow this pattern
callback({ 
  success: false, 
  error: error instanceof Error ? error.message : 'Unknown error' 
})

// Always log with context
console.error('Failed to create game:', error)
```

### Database Pattern (src/lib/db.ts)

```typescript
// PostgreSQL via pg pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

// Query pattern with parameterized queries
export async function createGame(name: string, createdBy: string): Promise<Game> {
  const result = await pool.query(
    `INSERT INTO games (name, created_by, status) 
     VALUES ($1, $2, 'lobby') 
     RETURNING *`,
    [name, createdBy]
  )
  return result.rows[0]
}
```

### Socket.IO Pattern (useSocket hook)

```typescript
const socket = io({
  path: '/api/socket',
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
})

// Emit with callback
socket.emit('submit-vote', { gameId, issueId, playerId, points }, (response) => {
  if (response.success) {
    // Handle success
  } else {
    // Handle error: response.error
  }
})
```

## Important Files

| File | Purpose |
|------|---------|
| `server.ts` | Custom Node.js server - creates HTTP server, attaches Next.js + Socket.IO |
| `src/lib/presence-server.ts` | Socket.IO server singleton - manages connections, rooms, events |
| `src/lib/db.ts` | Database layer - all PostgreSQL queries via `pg` |
| `src/hooks/useSocket.ts` | Client Socket.IO connection + presence tracking |
| `src/hooks/useGame.ts` | Game state management + Socket.IO game actions |
| `src/types/index.ts` | Core TypeScript types |
| `tailwind.config.ts` | Custom theme colors and animations |
| `Dockerfile` | Multi-stage build for production |
| `fly.toml` | Fly.io deployment configuration |

## Runtime/Tooling Preferences

### Runtime
- **Node.js 20** (specified in Dockerfile)
- **TypeScript 5.5+** with strict mode
- **tsx** for running TypeScript directly (dev + production)

### Package Manager
- **npm** (package-lock.json present)

### Key Dependencies
| Package | Purpose |
|---------|---------|
| `next@14.2.5` | React framework with App Router |
| `socket.io@4.8.3` | WebSocket server |
| `socket.io-client@4.8.3` | WebSocket client |
| `pg@8.20.0` | PostgreSQL driver |
| `framer-motion@11.3.0` | Animations |
| `@floating-ui/react@0.27.19` | UI positioning (tooltips/dropdowns) |
| `uuid@10.0.0` | UUID generation |

### Tooling Constraints
- ESLint extends `next/core-web-vitals` only
- No Prettier configuration found
- No testing framework configured
- Docker multi-stage build required for deployment

## Environment Variables

### Required for Development
```bash
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_SUPABASE_URL="https://..."
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."
```

### Production Secrets (Fly.io)
```bash
fly secrets set DATABASE_URL="postgresql://..."
fly secrets set NEXT_PUBLIC_SUPABASE_URL="https://..."
fly secrets set NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."
```

## Testing & QA

**No test framework configured.** The project has:
- Zero test files (no `*.test.ts`, `*.spec.ts` found)
- No test scripts in package.json
- No testing dependencies

Linting is the only automated QA:
```bash
npm run lint   # ESLint with Next.js rules
```

## Key Types

```typescript
// From src/types/index.ts
GameStatus: 'lobby' | 'voting' | 'revealed'
CARD_VALUES: [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 100]
COFFEE_CARD: '☕'

// Core entities
interface Game { id, name, status, current_issue_id, settings }
interface Player { id, game_id, name, avatar, is_facilitator, is_viewer }
interface Issue { id, game_id, title, description, status, estimated_points }
interface Vote { id, game_id, issue_id, player_id, points }
```

## Deployment

### Fly.io Deployment
- App URL: https://planningpokeronline.fly.dev
- Region: sin (Singapore)
- VM: 256MB RAM, shared CPU
- TCP services for WebSocket support (not HTTP)
- Auto-suspend enabled (min_machines_running = 0)

### Build Process
1. Docker multi-stage build with Node 20
2. Build args for NEXT_PUBLIC_* variables
3. Standalone Next.js output copied to final image
4. `tsx server.ts` runs the production server
