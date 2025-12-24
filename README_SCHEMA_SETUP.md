# Schema Setup Guide

This guide explains how to push the database schema to your Supabase online database.

## Prerequisites

1. Supabase project created at https://app.supabase.com
2. Access to your Supabase dashboard
3. (Optional) Supabase CLI installed: `npm install -g supabase`

## Method 1: Supabase Dashboard SQL Editor (Recommended for First Time)

1. Go to your Supabase project dashboard
2. Navigate to: **SQL Editor** > **New Query**
3. Copy the contents of these files:
   - `supabase/migrations/0000_complete_schema.sql`
   - `supabase/migrations/0001_rls_policies.sql`
4. Paste into the SQL editor
5. Click **Run** or press `Ctrl+Enter` (Windows/Linux) or `Cmd+Enter` (Mac)

## Method 2: Supabase CLI

If you have Supabase CLI installed and linked to your project:

```bash
cd apps/license-system
supabase db push
```

To link your project first:
```bash
supabase link --project-ref your-project-ref
```

## Method 3: Using psql (Direct Database Connection)

1. Get your database connection string from Supabase Dashboard:
   - Project Settings > Database > Connection string
   - Format: `postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`

2. Run the SQL files:
```bash
psql "your-connection-string" -f supabase/migrations/0000_complete_schema.sql
psql "your-connection-string" -f supabase/migrations/0001_rls_policies.sql
```

## Verification

After running the schema, verify tables were created:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Expected tables:
- `licenses`
- `devices`
- `entitlements`
- `revoked_licenses`
- `audit_logs`

## Schema Files

- `0000_complete_schema.sql` - Main schema with all tables, indexes, and triggers
- `0001_rls_policies.sql` - Row Level Security policies
- `0003_add_is_active_to_licenses.sql` - Migration to add is_active column (already included in 0000_complete_schema.sql)

## Notes

- The schema uses `auth.users` (Supabase's built-in auth table) - no need to create a users table
- All timestamps use UTC timezone
- License timestamps (`issued_at`, `expires_at`) are stored as BIGINT (Unix timestamps) for JWT compatibility
- RLS policies ensure users can only access their own data

## Troubleshooting

**Error: relation "auth.users" does not exist**
- This is normal - Supabase creates `auth.users` automatically when you enable authentication
- Make sure Authentication is enabled in your Supabase project settings

**Error: permission denied**
- Make sure you're using the service_role key or have proper database permissions
- For SQL Editor, you should have full access

**Tables already exist**
- The schema uses `CREATE TABLE IF NOT EXISTS` so it's safe to run multiple times
- If you need to reset, you can drop tables first (be careful with production data!)
