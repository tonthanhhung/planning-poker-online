# Build, Lint & Development Commands

All available npm scripts and commands for the project.

## Development

```bash
# Start development server with Socket.IO (uses custom server.ts)
npm run dev
```
Runs `tsx server.ts` which starts the custom Node.js server with integrated Socket.IO.

## Build & Production

```bash
# Production build (Next.js static + server build)
npm run build

# Production server (must run build first)
npm run start
```

Production runs with `NODE_ENV=production tsx server.ts`.

## Linting

```bash
# ESLint check with Next.js core-web-vitals rules
npm run lint
```

ESLint extends `next/core-web-vitals` only. No Prettier configuration.

## Version Management

```bash
# Bump patch version (0.0.x)
npm run version:patch

# Bump minor version (0.x.0)
npm run version:minor

# Bump major version (x.0.0)
npm run version:major

# Interactive version bump
npm run release
```

Uses `./scripts/bump-version.sh` script.

## Deployment Commands

```bash
# Deploy to Fly.io (primary)
./deploy.sh

# Deploy to Railway
./deploy-railway.sh

# Deploy to Vercel
./deploy-vercel.sh
```

## Testing

**No test framework configured.** The project has:
- Zero test files (no `*.test.ts`, `*.spec.ts` found)
- No test scripts in package.json
- No testing dependencies

Linting is the only automated QA:
```bash
npm run lint   # ESLint with Next.js rules
```

## Runtime/Tooling

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
| `@floating-ui/react@0.27.19` | UI positioning |
| `uuid@10.0.0` | UUID generation |
| `canvas-confetti@1.9.4` | Celebration effects |
| `frimousse@0.3.0` | Emoji picker component |

### Tooling Constraints
- ESLint extends `next/core-web-vitals` only
- No Prettier configuration found
- No testing framework configured
- Docker multi-stage build required for deployment
