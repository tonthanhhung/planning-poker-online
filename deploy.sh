#!/bin/bash
# Deploy script for Planning Poker Online on Fly.io
# Run: ./deploy.sh

set -e

echo "🚀 Planning Poker Fly.io Deployment"
echo "===================================="
echo ""

# Load from .env.local if it exists
if [ -f .env.local ]; then
  echo "📄 Loading environment from .env.local..."
  export $(grep -v '^#' .env.local | xargs)
fi

# Check if variables are set
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
  echo "❌ Missing environment variables!"
  echo ""
  echo "Set them first:"
  echo "  export NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co"
  echo "  export NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key"
  echo ""
  echo "Or create a .env.local file with these variables."
  exit 1
fi

echo "✅ Environment variables set"
echo "   URL: ${NEXT_PUBLIC_SUPABASE_URL:0:30}..."
echo ""

# Deploy to Fly.io
echo "🚀 Deploying to Fly.io..."
fly deploy \
  --build-arg "NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL" \
  --build-arg "NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY"

echo ""
echo "✅ Deployment complete!"
echo "🌐 Your app is live at: https://planningpokeronline.fly.dev"
