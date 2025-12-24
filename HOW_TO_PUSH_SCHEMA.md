# How to Push Schema to Supabase - Step by Step Guide

## Method 1: Using Supabase Dashboard SQL Editor (Easiest)

### Step 1: Open SQL Editor

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project: `ogvvunuupibiecisvlik`
3. Click on **"SQL Editor"** in the left sidebar
4. Click **"New query"** button (top right)

### Step 2: Run the Schema File

1. **Open the schema file** on your computer:
   - Location: `apps/license-system/supabase/migrations/0000_complete_schema.sql`
   - Open it in any text editor (Notepad, VS Code, etc.)

2. **Copy ALL the contents** of the file (Ctrl+A, then Ctrl+C)

3. **Paste into the SQL Editor** in Supabase (Ctrl+V)

4. **Click the "Run" button** (or press Ctrl+Enter / Cmd+Enter)

5. Wait for it to complete - you should see "Success. No rows returned" or similar

### Step 3: Run the RLS Policies File

1. **Open the RLS policies file** on your computer:
   - Location: `apps/license-system/supabase/migrations/0001_rls_policies.sql`
   - Open it in any text editor

2. **Copy ALL the contents** of the file (Ctrl+A, then Ctrl+C)

3. In the SQL Editor, **click "New query"** again (or clear the previous query)

4. **Paste the RLS policies** (Ctrl+V)

5. **Click "Run"** (or press Ctrl+Enter / Cmd+Enter)

6. Wait for it to complete

### Step 4: Verify Tables Were Created

1. In the SQL Editor, click **"New query"** again
2. Paste this verification query:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

3. Click **"Run"**

4. You should see these tables listed:
   - `audit_logs`
   - `devices`
   - `entitlements`
   - `licenses`
   - `revoked_licenses`

### Step 5: Re-run Seed Script

After the schema is pushed, go back to your terminal and run:

```bash
cd apps/license-system
npm run db:seed
```

This will populate the tables with sample data.

## Visual Guide

```
Supabase Dashboard
├── SQL Editor (left sidebar)
│   ├── New query button (top right)
│   ├── Text area (paste SQL here)
│   └── Run button (bottom right)
│
Steps:
1. Click "SQL Editor"
2. Click "New query"
3. Paste SQL from file
4. Click "Run"
5. Repeat for next file
```

## Troubleshooting

**Error: "relation already exists"**
- Tables already exist - this is fine, the schema uses `CREATE TABLE IF NOT EXISTS`
- You can continue to the next step

**Error: "permission denied"**
- Make sure you're using the SQL Editor (not the Table Editor)
- You should have full access via the dashboard

**Can't find the SQL files?**
- Files are located at: `apps/license-system/supabase/migrations/`
- Use Windows Explorer to navigate there
- Or use your code editor (VS Code, etc.) to open them

## Quick Copy-Paste Method

If you want, I can also provide the complete SQL here that you can copy-paste directly. Just let me know!
