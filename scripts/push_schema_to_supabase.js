/**
 * Push schema to Supabase online database
 * 
 * Usage:
 *   node scripts/push_schema_to_supabase.js
 * 
 * Requires environment variables:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY (for direct SQL execution)
 *   OR
 *   - SUPABASE_ACCESS_TOKEN (for Supabase Management API)
 */

const fs = require('fs');
const path = require('path');

// Read schema file
const schemaPath = path.join(__dirname, '../supabase/migrations/0000_complete_schema.sql');
const rlsPath = path.join(__dirname, '../supabase/migrations/0001_rls_policies.sql');

const schema = fs.readFileSync(schemaPath, 'utf8');
const rlsPolicies = fs.readFileSync(rlsPath, 'utf8');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  console.error('You can find these in your Supabase dashboard:');
  console.error('  - Project Settings > API > Project URL');
  console.error('  - Project Settings > API > service_role key (secret)');
  process.exit(1);
}

// Extract database connection info from SUPABASE_URL
// Format: https://[project-ref].supabase.co
const projectRef = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');
const dbUrl = `postgresql://postgres:[YOUR-PASSWORD]@db.${projectRef}.supabase.co:5432/postgres`;

console.log('\n📋 Schema Push Script for Supabase');
console.log('=====================================\n');
console.log('⚠️  IMPORTANT: This script provides SQL that you need to run manually.');
console.log('   Supabase does not allow direct SQL execution via API for security reasons.\n');
console.log('📝 Option 1: Use Supabase Dashboard SQL Editor');
console.log('   1. Go to: https://app.supabase.com/project/_/sql/new');
console.log('   2. Copy and paste the SQL below\n');
console.log('📝 Option 2: Use Supabase CLI');
console.log('   Run: supabase db push\n');
console.log('📝 Option 3: Use psql directly (if you have database password)');
console.log(`   psql "${dbUrl.replace('[YOUR-PASSWORD]', 'YOUR_PASSWORD_HERE')}" -f ${schemaPath}\n`);

console.log('\n--- COPY BELOW TO SUPABASE SQL EDITOR ---\n');
console.log('-- Main Schema');
console.log(schema);
console.log('\n-- RLS Policies');
console.log(rlsPolicies);
console.log('\n--- END OF SQL ---\n');

console.log('\n📝 After running the schema, you can seed sample data:');
console.log('   Option 1: node scripts/seed_data.js');
console.log('   Option 2: Run supabase/migrations/0004_seed_sample_data.sql');
console.log('   See README_SEED_DATA.md for details\n');

console.log('✅ After running the SQL, verify by checking if tables exist:');
console.log('   SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\';');
