#!/bin/bash
# Push schema to Supabase online database
# This script provides instructions and SQL for manual execution

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCHEMA_FILE="$SCRIPT_DIR/../supabase/migrations/0000_complete_schema.sql"
RLS_FILE="$SCRIPT_DIR/../supabase/migrations/0001_rls_policies.sql"

echo "📋 Schema Push Script for Supabase"
echo "====================================="
echo ""

if [ ! -f "$SCHEMA_FILE" ]; then
    echo "❌ Error: Schema file not found: $SCHEMA_FILE"
    exit 1
fi

echo "✅ Found schema file: $SCHEMA_FILE"
echo ""

# Check if Supabase CLI is available
if command -v supabase &> /dev/null; then
    echo "📝 Option 1: Using Supabase CLI (Recommended)"
    echo "   Run: cd apps/license-system && supabase db push"
    echo ""
fi

echo "📝 Option 2: Use Supabase Dashboard SQL Editor"
echo "   1. Go to: https://app.supabase.com/project/_/sql/new"
echo "   2. Copy and paste the SQL from the files:"
echo "      - $SCHEMA_FILE"
echo "      - $RLS_FILE"
echo ""
echo "📝 Option 3: Use psql (if you have database credentials)"
echo "   You'll need your database connection string from Supabase dashboard"
echo "   Project Settings > Database > Connection string"
echo ""

echo "--- SQL Content Preview (first 50 lines) ---"
head -n 50 "$SCHEMA_FILE"
echo "..."
echo "--- End Preview ---"
echo ""

echo "📄 Full SQL files location:"
echo "   Schema: $SCHEMA_FILE"
echo "   RLS Policies: $RLS_FILE"
echo ""
