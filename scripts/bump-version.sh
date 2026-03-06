#!/bin/bash

# Bump version and create git tag for deployment
# Usage: ./scripts/bump-version.sh [patch|minor|major]

set -e

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Not a git repository"
    exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "❌ You have uncommitted changes. Please commit or stash them first."
    git status --short
    exit 1
fi

# Get the last tag
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

if [ -n "$LAST_TAG" ]; then
    # Check if there are commits since the last tag
    COMMITS_SINCE_TAG=$(git log "$LAST_TAG"..HEAD --oneline 2>/dev/null || echo "")
    
    if [ -z "$COMMITS_SINCE_TAG" ]; then
        echo "❌ No changes since last tag ($LAST_TAG)"
        echo ""
        echo "Make some commits before bumping version:"
        echo "   git log --oneline -5"
        exit 1
    fi
    
    echo "📋 Changes since $LAST_TAG:"
    echo "$COMMITS_SINCE_TAG" | head -10
    if [ $(echo "$COMMITS_SINCE_TAG" | wc -l) -gt 10 ]; then
        echo "   ... and $(($(echo "$COMMITS_SINCE_TAG" | wc -l) - 10)) more commits"
    fi
    echo ""
else
    echo "⚠️  No previous tag found. This will be the first release."
fi

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
