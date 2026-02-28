#!/bin/bash
# CLI Deployment Script for Planning Poker Online
# Run: ./deploy.sh

set -e

echo "🚀 Planning Poker CLI Deployment"
echo "================================"
echo ""

# Check for required env vars
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
    echo "❌ Missing environment variables!"
    echo ""
    echo "Set them first:"
    echo "  export NEXT_PUBLIC_SUPABASE_URL=your_url"
    echo "  export NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key"
    echo ""
    exit 1
fi

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "⚠️  Railway CLI not found. Installing..."
    npm install -g @railway/cli
fi

echo "✅ Environment variables set"
echo ""

# Login to Railway
echo "📝 Logging into Railway..."
railway login

# Initialize project
echo "🔧 Initializing Railway project..."
railway init -n planning-poker-online || true

# Add environment variables
echo "⚙️  Setting environment variables..."
railway variables set NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL"
railway variables set NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY"
railway variables set NODE_ENV=production

# Deploy
echo "🚀 Deploying..."
railway up

echo ""
echo "✅ Deployment complete!"
echo "🌐 Your app is live!"
echo ""
echo "Get your URL with: railway open"
