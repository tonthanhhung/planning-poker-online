# Code Conventions & Patterns

Coding standards and patterns for Planning Poker Online.

## TypeScript

- **Strict mode enabled** - no implicit any, strict null checks
- Explicit return types for exported functions
- Prefer `interface` over `type` for object shapes
- Use `type` for unions and mapped types
- Import types explicitly: `import type { Foo } from '@/types'`

## Import Order

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

## Naming Conventions

| Category | Pattern | Example |
|----------|---------|---------|
| Components | PascalCase | `GameRoom.tsx`, `PokerCard.tsx` |
| Hooks | camelCase with `use` prefix | `useGame.ts`, `useSocket.ts` |
| Utilities | camelCase | `supabase.ts`, `db.ts` |
| Types/Interfaces | PascalCase | `Player`, `GameStatus` |
| Constants | UPPER_SNAKE_CASE | `CARD_VALUES`, `COFFEE_CARD` |
| Route files | lowercase with dashes | `game/[id]/page.tsx` |

## Component Structure

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

## Tailwind CSS

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

## Error Handling Pattern

```typescript
// Socket.IO callbacks follow this pattern
callback({ 
  success: false, 
  error: error instanceof Error ? error.message : 'Unknown error' 
})

// Always log with context
console.error('Failed to create game:', error)
```

## Database Pattern (src/lib/db.ts)

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

## Socket.IO Pattern (useSocket hook)

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

// Gamification types
interface PlayerStreakStats {
  playerId: string;
  playerName: string;
  totalVotes: number;
  majorityAlignments: number;
  alignmentPercentage: number;
}

interface VoteDistribution {
  value: number | string;
  count: number;
  percentage: number;
}

interface IssueVoteStats {
  issueId: string;
  issueTitle: string;
  mode: number | null;
  modeCount: number;
  distribution: VoteDistribution[];
  totalVotes: number;
  playerVotes?: { playerId: string; points: number }[];
}
```
