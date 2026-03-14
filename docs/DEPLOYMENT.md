# Deployment

Deployment options and configuration for Planning Poker Online.

## Fly.io Deployment (Primary)

- **App URL**: https://planningpokeronline.fly.dev
- **Region**: sin (Singapore)
- **VM**: 256MB RAM, shared CPU
- **TCP services** for WebSocket support (not HTTP)
- **Auto-suspend** enabled (min_machines_running = 0)

### Deploy to Fly.io
```bash
./deploy.sh
```

### Required Environment Variables
```bash
fly secrets set DATABASE_URL="postgresql://..."
fly secrets set NEXT_PUBLIC_SUPABASE_URL="https://..."
fly secrets set NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."
```

### Build Process
1. Docker multi-stage build with Node 20
2. Build args for NEXT_PUBLIC_* variables
3. Standalone Next.js output copied to final image
4. `tsx server.ts` runs the production server

## Railway Deployment

Alternative cloud platform deployment.

```bash
./deploy-railway.sh
```

## Vercel Deployment

Serverless deployment option.

```bash
./deploy-vercel.sh
```

**Note**: WebSocket support may be limited on Vercel due to serverless architecture.

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

## Key Files

| File | Purpose |
|------|---------|
| `Dockerfile` | Multi-stage Docker build for production |
| `fly.toml` | Fly.io deployment configuration |
| `railway.json` | Railway deployment configuration |
| `vercel.json` | Vercel deployment configuration |
| `deploy.sh` | Fly.io deployment script |
| `deploy-railway.sh` | Railway deployment script |
| `deploy-vercel.sh` | Vercel deployment script |
