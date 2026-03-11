# AGENTS.md - Planning Poker Online

Guidelines for AI agents working in this repository.

## Build/Lint/Test Commands

```bash
# Development server with Socket.IO
npm run dev

# Production build
npm run build

# Linting
npm run lint

# Start production server
npm run start

# Deploy to Fly.io (uses deploy.sh)
./deploy.sh
```

**No test framework configured.** Discuss with the team before adding tests (Jest, Vitest, Playwright, etc.).

## Project Overview

Real-time collaborative Planning Poker app for agile teams. Built with:
- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS** + Framer Motion animations
- **PostgreSQL** (via direct connection with pg driver)
- **Socket.IO** for WebSocket presence/reactions/sync
- **Fly.io** for production deployment

## Key Features Implemented

- ✅ **Socket.IO Emoji Reactions** - Real-time emoji sync between players via WebSocket
- ✅ **Viewer Mode** - Users can join as viewers (no voting cards shown)
- ✅ **Vote Reset Sync** - All users see votes reset immediately via WebSocket
- ✅ **Custom Server** - Next.js + Socket.IO integrated in server.ts
- ✅ **PostgreSQL Database** - Direct pg driver connection (not Supabase client)
- ✅ **Fly.io Deployment** - Production app at https://planningpokeronline.fly.dev

## Deployment

### Fly.io Deployment

**Prerequisites:**
- Set environment variables in `.env.local`
- Install flyctl: `brew install flyctl`
- Login: `fly auth login`

**Deploy:**
```bash
./deploy.sh
```

**Required Secrets on Fly.io:**
```bash
fly secrets set DATABASE_URL="postgresql://..."
fly secrets set NEXT_PUBLIC_SUPABASE_URL="https://..."
fly secrets set NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."
```

**App URL:** https://planningpokeronline.fly.dev

### TypeScript
- Enable strict mode (already configured in tsconfig.json)
- Use explicit return types for exported functions
- Prefer `interface` over `type` for object shapes
- Use `type` for unions and mapped types
- Import types explicitly: `import type { Foo } from '@/types'`

### Imports
Order by:
1. React/Next imports
2. Third-party libraries
3. Absolute imports (`@/components`, `@/hooks`, `@/lib`)
4. Relative imports (use `@/` aliases instead when possible)

```typescript
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { PokerCard } from '@/components/PokerCard'
import { useGame } from '@/hooks/useGame'
import type { Player } from '@/types'
```

### Naming Conventions
- Components: PascalCase (`GameRoom.tsx`)
- Hooks: camelCase with `use` prefix (`useGame.ts`)
- Utilities: camelCase (`supabase.ts`)
- Types/Interfaces: PascalCase (`Player`, `GameStatus`)
- Constants: UPPER_SNAKE_CASE for true constants (`CARD_VALUES`)
- Files in `app/`: lowercase with dashes for routes

### Component Structure
```typescript
'use client'  // MUST be first line if using hooks or browser APIs

// Imports
import { useState } from 'react'

// Types
interface Props {
  gameId: string
}

// Component
export function ComponentName({ gameId }: Props) {
  // Hooks
  const [state, setState] = useState()
  
  // Handlers
  const handleClick = () => {}
  
  // Render
  return <div>...</div>
}

// Component
export function ComponentName({ gameId }: Props) {
  // Hooks
  const [state, setState] = useState()
  
  // Handlers
  const handleClick = () => {}
  
  // Render
  return <div>...</div>
}
```

### Tailwind CSS
- Use custom theme colors from `tailwind.config.ts`:
  - `primary`, `secondary`, `accent`, `success`, `warning`, `error`
  - `neutral`, `neutral-light`, `neutral-dark`
  - `background`, `surface`, `border`
- Use elevation classes: `elevation-low`, `elevation-medium`, `elevation-high`
- Custom animations defined in tailwind.config.ts

### Error Handling
- Use try/catch for async operations
- Log errors with context: `console.error('Failed to create game:', error)`
- Show user-friendly messages via alerts or UI state
- Check for `error` property from Supabase responses

### State Management
- Use React hooks for local state (`useState`, `useReducer`)
- Use custom hooks for shared logic (`useGame`, `usePlayer`)
- Prefer `useCallback` for event handlers passed to children
- Use `useMemo` for expensive computations

### Supabase/Database
- Always handle errors from database calls
- Use typed database functions from `@/lib/db`
- Realtime subscriptions via Socket.IO (not Supabase Realtime)
- Follow existing patterns in `db.ts` for queries

### Environment Variables
- Client-side vars must use `NEXT_PUBLIC_` prefix
- Server-side vars (no prefix) for API routes only
- Never commit `.env.local` - use `.env.local.example`
- **Required for deployment:** `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── game/[id]/         # Game room page
│   ├── globals.css        # Tailwind + custom styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Landing page
├── components/            # React components
│   ├── PokerCard.tsx      # Card with animations
│   ├── PokerTable.tsx     # Game table layout
│   ├── GameRoom.tsx       # Main game room
│   └── ...
├── hooks/                 # Custom React hooks
│   ├── useGame.ts         # Game state management
│   ├── usePlayer.ts       # Player session
│   ├── useSocket.ts       # Socket.IO connection
│   └── useWebSocketPresence.ts
├── lib/                   # Utilities
│   ├── presence-server.ts # Socket.IO server logic
│   ├── db.ts              # PostgreSQL database functions
│   ├── database.types.ts  # Database types
│   └── funnyNames.ts      # Random name generator
└── types/                 # TypeScript types
    └── index.ts           # Shared types

# Root files
├── server.ts              # Custom Next.js + Socket.IO server
├── Dockerfile             # Fly.io deployment config
├── fly.toml               # Fly.io app configuration
└── deploy.sh              # Deployment script
```

## Socket.IO Architecture

### Server-side (`src/lib/presence-server.ts`)
- Handles Socket.IO connections
- Manages game rooms
- Broadcasts events to all players in a game
- Database operations via `src/lib/db.ts`

### Client-side (`src/hooks/useSocket.ts`)
- Creates Socket.IO connection
- Handles reconnection logic
- Exports socket for use in components

### Key Events
- `join-game` - Player joins a game room
- `create-player` - New player created
- `reaction` - Emoji reaction sent/received
- `submit-vote` - Player submits vote
- `reset-votes` - Votes reset (revote)
- `update-game-status` - Game status changes

## Database

Uses PostgreSQL directly via `pg` driver (not Supabase client):
- Connection string from `DATABASE_URL` env var
- SSL enabled in production
- Functions in `src/lib/db.ts`

## Key Types

```typescript
// From @/types
GameStatus: 'lobby' | 'voting' | 'revealed'
CARD_VALUES: [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 100]
COFFEE_CARD: '☕'
```

## Deployment

- Production deploys via GitHub Actions to Fly.io
- Lint runs on every PR
- Build must pass before deploy
- Environment variables required in CI/CD
- Use `./deploy.sh` script for manual deployment

## Common Patterns

### Adding a new component
1. Create file in `src/components/`
2. Export named function
3. Add `'use client'` if using browser APIs or hooks
4. Use Framer Motion for animations
5. Follow existing component patterns

### Adding a new hook
1. Create file in `src/hooks/`
2. Export named function with `use` prefix
3. Document return type interface
4. Handle cleanup in useEffect

### Adding types
1. Add to `src/types/index.ts` if shared
2. Add to component file if component-specific
3. Export types that may be used elsewhere
