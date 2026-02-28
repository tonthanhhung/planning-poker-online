# Deployment Guide - Planning Poker Online

## Option 1: Railway (Recommended - Full Stack)

Railway provides the easiest full-stack deployment with persistent WebSocket support.

### Prerequisites
- GitHub account
- Railway account (free tier available at railway.app)
- Supabase project (already set up)

### Steps:

1. **Push code to GitHub**
   ```bash
   git push origin main
   ```

2. **Deploy on Railway**
   - Go to https://railway.app/new
   - Select "Deploy from GitHub repo"
   - Choose your planning-poker repository
   - Railway will auto-detect the Node.js app

3. **Set Environment Variables**
   In Railway dashboard, add these variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
   NODE_ENV=production
   ```

4. **Configure Custom Domain (Optional)**
   - Go to your Railway project settings
   - Add custom domain or use the provided railway.app URL

### Cost: Free tier includes:
- 500 hours of runtime per month
- 1 GB RAM
- 1 GB disk
- Enough for small-medium teams

---

## Option 2: Vercel + Render (Serverless + WebSocket)

This splits frontend (Vercel) and backend (Render for WebSocket server).

### Part A: Deploy Frontend on Vercel

1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Set environment variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
   ```
4. Deploy

### Part B: Deploy WebSocket Server on Render

1. Create `render.yaml` in repo root:
   ```yaml
   services:
     - type: web
       name: planning-poker-server
       runtime: node
       plan: free
       buildCommand: npm install && npm run build
       startCommand: npm start
       envVars:
         - key: NODE_ENV
           value: production
   ```

2. Go to https://render.com
3. Create "Blueprint" from your repo
4. Set environment variables
5. Deploy

6. Update frontend to use Render WebSocket URL

### Cost:
- Vercel: Free (unlimited for hobby projects)
- Render: Free (WebSocket server sleeps after 15 min inactivity)

---

## Option 3: Self-Hosted (VPS/DigitalOcean)

For maximum control, deploy on any VPS.

### Using Docker:

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

Create `docker-compose.yml`:
```yaml
version: '3'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_KEY}
      - NODE_ENV=production
    restart: unless-stopped
```

Deploy:
```bash
docker-compose up -d
```

---

## Quick Start: Railway (Recommended)

The fastest way to get public access:

1. **Fork/push this repo to GitHub**
2. **Go to https://railway.app/new**
3. **Select your repo**
4. **Add env vars:**
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```
5. **Deploy!**

Your app will be live at: `https://planning-poker-[random].railway.app`

---

## Environment Variables Required

All deployment methods need these:

```bash
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Optional: for production optimizations
NODE_ENV=production
```

---

## Post-Deployment Checklist

- [ ] App loads without errors
- [ ] Can create new game
- [ ] Can join existing game
- [ ] WebSocket connections work (check browser console)
- [ ] Cards can be placed with animation
- [ ] Votes are saved to database
- [ ] Reveal works
- [ ] Emoji reactions work after reveal

---

## Troubleshooting

**WebSocket not connecting:**
- Check that server is running on the same origin
- For Railway: WebSocket works automatically
- For Vercel: Need separate WebSocket server

**Build errors:**
- Make sure `npm run build` works locally
- Check Node.js version (use 18+)

**Database connection issues:**
- Verify Supabase URL and key
- Check Supabase Row Level Security policies

---

## Recommended: Railway (5-minute setup)

Railway is the best choice because:
- ✅ Native WebSocket support
- ✅ No server sleep (unlike Render free tier)
- ✅ Simple deployment from GitHub
- ✅ Automatic HTTPS
- ✅ Good free tier for hobby projects

**Deploy now:** https://railway.app/new
