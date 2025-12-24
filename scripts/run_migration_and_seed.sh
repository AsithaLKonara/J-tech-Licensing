#!/bin/bash
# Complete Setup Script: Run Schema Migration + Seed Data
# This script helps you set up the database with schema and sample data

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🚀 License System Database Setup"
echo "=================================="
echo ""

# Check if Supabase CLI is available
if command -v supabase &> /dev/null; then
    echo "✅ Supabase CLI found"
    echo ""
    echo "📋 Step 1: Push schema migrations"
    echo "   This will create all tables and apply RLS policies"
    read -p "   Press Enter to continue or Ctrl+C to cancel..."
    
    cd "$PROJECT_DIR"
    supabase db push
    
    echo ""
    echo "📋 Step 2: Seed sample data"
    echo "   This will create test users and sample data"
    read -p "   Continue? (y/n) " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
            echo "⚠️  Environment variables not set"
            echo "   Please set:"
            echo "   export SUPABASE_URL='https://your-project.supabase.co'"
            echo "   export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'"
            echo ""
            echo "   Then run: node scripts/seed_data.js"
        else
            node scripts/seed_data.js
        fi
    fi
else
    echo "⚠️  Supabase CLI not found"
    echo ""
    echo "📋 Manual Setup Instructions:"
    echo ""
    echo "1. Push Schema:"
    echo "   - Go to Supabase Dashboard > SQL Editor"
    echo "   - Run: supabase/migrations/0000_complete_schema.sql"
    echo "   - Run: supabase/migrations/0001_rls_policies.sql"
    echo ""
    echo "2. Seed Data:"
    echo "   - Set environment variables:"
    echo "     export SUPABASE_URL='...'"
    echo "     export SUPABASE_SERVICE_ROLE_KEY='...'"
    echo "   - Run: node scripts/seed_data.js"
    echo ""
    echo "   OR manually create users and run:"
    echo "   - supabase/migrations/0004_seed_sample_data.sql"
    echo ""
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📚 Next steps:"
echo "   - Verify tables: SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"
echo "   - Check sample data: SELECT COUNT(*) FROM public.licenses;"
echo "   - See README_SEED_DATA.md for more info"
