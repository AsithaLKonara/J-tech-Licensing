# Schema Push Scripts

These scripts help you push the database schema to your Supabase online database.

## Available Scripts

### push_schema.sh (Linux/macOS)
Bash script that provides instructions and SQL file locations.

```bash
cd apps/license-system
./scripts/push_schema.sh
```

### push_schema_to_supabase.js (Node.js)
Node.js script that displays the SQL to copy/paste.

```bash
cd apps/license-system
node scripts/push_schema_to_supabase.js
```

## Recommended Method

**Use Supabase Dashboard SQL Editor:**

1. Go to: https://app.supabase.com/project/_/sql/new
2. Copy contents of:
   - `supabase/migrations/0000_complete_schema.sql`
   - `supabase/migrations/0001_rls_policies.sql`
3. Paste and run in SQL Editor

This is the safest and most straightforward method.

## Alternative: Supabase CLI

If you have Supabase CLI installed:

```bash
cd apps/license-system
supabase db push
```

See [README_SCHEMA_SETUP.md](../README_SCHEMA_SETUP.md) for detailed instructions.
