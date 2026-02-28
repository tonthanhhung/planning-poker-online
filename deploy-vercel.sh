#!/bin/bash
# Vercel CLI Deployment Script
# Run: ./deploy-vercel.sh

set -e

echo "🚀 Deploying to Vercel"
echo "======================"
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

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "⚠️  Vercel CLI not found. Installing..."
    npm install -g vercel
fi

echo "✅ Vercel CLI installed"
echo ""

# Create vercel.json if it doesn't exist
if [ ! -f vercel.json ]; then
    echo "📝 Creating vercel.json..."
    cat > vercel.json << 'EOF'
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "outputDirectory": ".next"
}
EOF
    echo "✅ vercel.json created"
fi

echo ""
echo "📝 Step 1: Login to Vercel"
echo "   Running: vercel login"
echo "   (This will open your browser)"
echo ""
vercel login

echo ""
echo "🚀 Step 2: Deploying to production..."
echo "   (Will create new project automatically)"
echo ""
vercel deploy --prod

echo ""
echo "✅ Deployment complete!"
echo "🌐 Open your app with: vercel open"
