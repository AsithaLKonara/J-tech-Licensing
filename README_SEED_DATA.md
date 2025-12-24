# Seed Sample Data

This guide explains how to seed sample data into your Supabase database for testing and development.

## Methods

### Method 1: Automated Script (Recommended)

Use the Node.js script to automatically create test users and seed data:

```bash
cd apps/license-system

# Set environment variables
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Run seed script
node scripts/seed_data.js
```

The script will:
1. Create 3 test users (if they don't exist)
2. Create sample licenses (active, expired, revoked)
3. Create sample devices
4. Create sample entitlements
5. Create sample audit logs

### Method 2: SQL Migration (Manual User Creation)

If you prefer to create users manually:

1. **Create test users** via Supabase Dashboard:
   - Go to Authentication > Users > Add User
   - Create at least 1-3 test users

2. **Run the seed migration**:
   ```sql
   -- In Supabase SQL Editor, run:
   -- apps/license-system/supabase/migrations/0004_seed_sample_data.sql
   ```

   Or via Supabase CLI:
   ```bash
   cd apps/license-system
   supabase db push
   ```

The migration will automatically detect existing users and seed data for them.

### Method 3: Supabase Dashboard

1. Create test users: Authentication > Users > Add User
2. Go to SQL Editor
3. Copy and run `0004_seed_sample_data.sql`
4. Or manually insert data using the SQL editor

## Sample Data Created

### Users
- `test_user_1@example.com` - Premium user with active license
- `test_user_2@example.com` - Monthly subscription user
- `test_user_3@example.com` - User with revoked license

### Licenses
- **Active Premium License** - Valid for 1 year
- **Active Monthly License** - Valid for 20 days
- **Expired License** - Expired 35 days ago
- **Revoked License** - Active but marked as revoked

### Devices
- 3 registered devices linked to different users
- Device fingerprints: `DEVICE_FINGERPRINT_001`, `002`, `003`

### Entitlements
- Active yearly entitlement
- Active monthly entitlement
- Cancelled entitlement

### Audit Logs
- License issuance events
- License validation events
- License revocation events
- Device registration events

## Environment Variables

For the automated script, you need:

```bash
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret-key
```

Find these in your Supabase Dashboard:
- Project Settings > API > Project URL
- Project Settings > API > service_role key (secret)

## Verification

After seeding, verify the data:

```sql
-- Check licenses
SELECT id, user_id, product, plan, is_active, 
       to_timestamp(expires_at) as expires_at_readable
FROM public.licenses;

-- Check devices
SELECT * FROM public.devices;

-- Check audit logs
SELECT event_type, COUNT(*) 
FROM public.audit_logs 
GROUP BY event_type;
```

## Notes

- ⚠️ **Only use in development/test environments**, not production
- The seed script checks for existing users and won't duplicate data
- If users already exist, it will use them for seeding
- Sample data uses placeholder JWT signatures - replace with real signatures for production
- Device fingerprints are sample values - replace with real device fingerprints in production

## Troubleshooting

**Error: "No users found"**
- Create at least one user first via Supabase Dashboard or the script
- Make sure you're using the service_role key (not anon key)

**Error: "Foreign key constraint violation"**
- Make sure users exist in `auth.users` before seeding licenses
- Check that user IDs match between auth.users and the seed data

**Error: "Duplicate key violation"**
- Data already exists - this is safe to ignore
- The seed script uses `ON CONFLICT DO NOTHING` to handle duplicates
