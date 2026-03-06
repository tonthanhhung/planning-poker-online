#!/bin/bash

# Bump version and create git tag for deployment
# Usage: ./scripts/bump-version.sh [patch|minor|major]

set -e

# Default to patch if no argument provided
BUMP_TYPE=${1:-patch}

# Validate bump type
if [[ "$BUMP_TYPE" != "patch" && "$BUMP_TYPE" != "minor" && "$BUMP_TYPE" != "major" ]]; then
    echo "❌ Invalid bump type. Use: patch, minor, or major"
    echo "Usage: ./scripts/bump-version.sh [patch|minor|major]"
    exit 1
fi

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "📦 Current version: v$CURRENT_VERSION"

# Calculate new version
NEW_VERSION=$(npm version $BUMP_TYPE --no-git-tag-version | sed 's/v//')
echo "⬆️  Bumping to: v$NEW_VERSION"

# Stage package.json and package-lock.json
git add package.json package-lock.json

# Commit the version bump
git commit -m "chore(release): v$NEW_VERSION"

# Create git tag
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"

echo ""
echo "✅ Version bumped to v$NEW_VERSION"
echo ""
echo "🚀 To deploy, run:"
echo "   git push origin main --tags"
echo ""
echo "Or push separately:"
echo "   git push origin main"
echo "   git push origin v$NEW_VERSION"
