# Planning Poker Online - Agent Guidelines

> Quick reference for AI agents working on this codebase.

## Project Overview

Real-time collaborative Planning Poker app for agile teams. Built with **Next.js 14** + **Socket.IO** + **PostgreSQL**.

### Tech Stack
- **Framework**: Next.js 14 (App Router) + TypeScript (strict mode)
- **Styling**: Tailwind CSS + Framer Motion animations
- **Database**: PostgreSQL (via `pg` driver, NOT Supabase client)
- **Real-time**: Socket.IO for WebSocket presence, reactions, and game sync
- **Deployment**: Fly.io (Docker-based)

### Quick Start
```bash
npm run dev    # Start dev server (tsx server.ts)
npm run build  # Production build
npm run lint   # ESLint check
```

## Architecture Overview

```
┌──────────────┐  WebSocket  ┌─────────────────┐
│ React Client │ ◄──────────►│ Socket.IO Server│
└──────────────┘  /api/socket └────────┬────────┘
      │                                 │
      ▼                                 ▼
┌──────────────┐               ┌─────────────────┐
│ LocalStorage │               │   PostgreSQL    │
│ (player data)│               │   (game data)   │
└──────────────┘               └─────────────────┘
```

## Module Documentation

| Module | Description | File |
|--------|-------------|------|
| **Architecture** | System design, data flow, Socket.IO events | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| **Commands** | Build, lint, deploy commands | [docs/COMMANDS.md](docs/COMMANDS.md) |
| **Conventions** | Code style, naming, patterns | [docs/CONVENTIONS.md](docs/CONVENTIONS.md) |
| **Deployment** | Fly.io, Railway, Vercel deployment | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |
| **Components** | React components | [src/components/AGENTS.md](src/components/AGENTS.md) |
| **Hooks** | Custom React hooks | [src/hooks/AGENTS.md](src/hooks/AGENTS.md) |
| **Libraries** | Utilities, database, server | [src/lib/AGENTS.md](src/lib/AGENTS.md) |

## Key Principles

1. **No Supabase Client** - Use `pg` driver directly (see `src/lib/db.ts`)
2. **Socket.IO Events** - All real-time updates via WebSocket (not HTTP)
3. **Custom Server** - Production runs `tsx server.ts` (not `next start`)
4. **Strict TypeScript** - No implicit any, explicit return types

## Environment Variables

```bash
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_SUPABASE_URL="https://..."
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."
```

## Important Files

| File | Purpose |
|------|---------|
| `server.ts` | Entry point - HTTP server + Socket.IO + Next.js |
| `src/lib/presence-server.ts` | Socket.IO server singleton |
| `src/lib/db.ts` | PostgreSQL connection & queries |
| `src/types/index.ts` | Shared TypeScript types |

---

**Need details?** Navigate to the relevant module documentation above.
