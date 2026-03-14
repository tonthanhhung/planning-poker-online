# Architecture & Data Flow

Detailed system architecture for Planning Poker Online.

## High-Level Architecture

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

## Socket.IO Event Flow

1. **Client connects** via `useSocket()` hook → establishes WebSocket at `/api/socket`
2. **Player joins game** → `join-game` event → joins Socket.IO room per gameId
3. **Database operations** emit to room → all clients receive updates
4. **Presence tracking** via 5-second pings, 10-second offline threshold

## Key Events (Server-Client)

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

## Data Models

### Game
```typescript
interface Game {
  id: string;
  name: string;
  created_at: string;
  created_by: string;
  status: 'lobby' | 'voting' | 'revealed';
  current_issue_id: string | null;
  settings: GameSettings;
}

interface GameSettings {
  maxVotes: number;
  autoReveal: boolean;
  anonymousVotes: boolean;
}
```

### Player
```typescript
interface Player {
  id: string;
  game_id: string;
  name: string;
  avatar?: string;
  is_facilitator: boolean;
  is_viewer: boolean;
  joined_at: string;
}
```

### Issue
```typescript
interface Issue {
  id: string;
  game_id: string;
  title: string;
  description?: string;
  order: number;
  status: 'pending' | 'voting' | 'completed';
  estimated_points?: number;
  created_at: string;
}
```

### Vote
```typescript
interface Vote {
  id: string;
  game_id: string;
  issue_id: string;
  player_id: string;
  points: number;
  created_at: string;
  updated_at: string;
}
```

## Presence Tracking

The app uses activity-based presence tracking:

1. **Client-side**: Tracks user interactions (clicks, keypresses, visibility)
2. **WebSocket**: Sends presence pings every 5 seconds
3. **Server-side**: Maintains presence state with 10-second timeout
4. **Broadcasts**: Sends presence updates to all clients in the game room

## Key Features

- **Socket.IO Emoji Reactions** - Real-time emoji sync between players
- **Viewer Mode** - Users can join as viewers (no voting cards shown)
- **Vote Reset Sync** - All users see votes reset immediately via WebSocket
- **CSV Import** - Import JIRA issues from CSV files
- **Card Placement Animation** - Visual card dealing animations
- **Confetti Celebration** - Fun effects when votes are revealed
- **Simple Game Room** - Streamlined UI mode option
- **Activity-Based Presence** - Enhanced presence tracking via WebSocket
