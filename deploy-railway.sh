#!/bin/bash
# Railway CLI Quick Deploy
# Run: ./deploy-railway.sh

set -e

echo "🚀 Deploying to Railway"
echo "======================="
echo ""

# Check for required env vars
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
    echo "❌ Missing environment variables!"
    echo ""
    echo "Set them first:"
    echo "  export NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co"
    echo "  export NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key"
    echo ""
    exit 1
fi

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "⚠️  Railway CLI not found. Installing..."
    npm install -g @railway/cli
fi

echo "✅ Railway CLI installed"
echo ""

# Login (interactive - opens browser)
echo "📝 Step 1: Login to Railway"
echo "   This will open your browser..."
echo ""
railway login

# Initialize project
echo ""
echo "🔧 Step 2: Initialize Railway project..."
echo ""
railway init -n planning-poker-online || railway link

# Add environment variables
echo ""
echo "⚙️  Step 3: Setting environment variables..."
echo ""
railway variables set NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL"
railway variables set NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY"
railway variables set NODE_ENV=production

# Deploy
echo ""
echo "🚀 Step 4: Deploying..."
echo ""
railway up

echo ""
echo "✅ Deployment complete!"
echo "🌐 Your app is live!"
echo ""
echo "Open your app: railway open"
