#!/bin/bash
# Eclipse Second Dawn - Deployment Verification Script
# Run this after deploying to Vercel and seeding the database

set -e  # Exit on error

echo "🔍 Verifying Eclipse Second Dawn Deployment..."
echo ""

# Check 1: Convex connection
echo "✓ Checking Convex configuration..."
if [ -f "convex.json" ]; then
    PROJECT=$(grep '"project"' convex.json | cut -d'"' -f4)
    PROD_URL=$(grep '"prodUrl"' convex.json | cut -d'"' -f4)
    echo "  Project: $PROJECT"
    echo "  Prod URL: $PROD_URL"
else
    echo "  ❌ convex.json not found!"
    exit 1
fi

echo ""

# Check 2: Database seed verification
echo "✓ Verifying database data..."
echo "  Running queries to check seed data..."

# Count factions
FACTION_COUNT=$(npx convex run queries/factions:getAllFactions --prod 2>/dev/null | grep -c "name" || echo "0")
echo "  Factions: $FACTION_COUNT (expected: 8)"

# Count technologies
TECH_COUNT=$(npx convex run queries/technologies:getAllTechnologies --prod 2>/dev/null | grep -c "name" || echo "0")
echo "  Technologies: $TECH_COUNT (expected: 41)"

echo ""

# Check 3: Build artifacts
echo "✓ Checking build artifacts..."
if [ -d "dist" ]; then
    SIZE=$(du -sh dist | cut -f1)
    echo "  Build size: $SIZE"

    if [ -f "dist/index.html" ]; then
        echo "  index.html: ✅"
    else
        echo "  index.html: ❌ Missing!"
    fi

    if [ -f "dist/assets/index-CxXl3AsV.js" ] || ls dist/assets/index-*.js 1> /dev/null 2>&1; then
        echo "  JS bundle: ✅"
    else
        echo "  JS bundle: ❌ Missing!"
    fi
else
    echo "  ❌ dist/ directory not found! Run: npm run build"
    exit 1
fi

echo ""

# Check 4: Vercel configuration
echo "✓ Checking Vercel configuration..."
if [ -f "vercel.json" ]; then
    echo "  vercel.json: ✅"
else
    echo "  vercel.json: ❌ Missing!"
fi

echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Deployment verification complete!"
echo ""
echo "Next steps:"
echo "  1. Visit your Vercel URL"
echo "  2. Open browser DevTools (F12)"
echo "  3. Check for console errors"
echo "  4. Verify galaxy board renders"
echo "  5. Test creating a room and joining"
echo ""
echo "Deployment URL: [Get from Vercel dashboard]"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
