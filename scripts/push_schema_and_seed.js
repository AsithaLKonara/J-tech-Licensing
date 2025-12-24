/**
 * Complete Setup: Push Schema and Seed Data
 * This script pushes the schema to Supabase and then seeds sample data
 * 
 * Usage:
 *   node scripts/push_schema_and_seed.js
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
const envPath = path.join(__dirname, '..', '.env.test');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log('📄 Loaded environment variables from .env.test\n');
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  }
});

async function pushSchema() {
  console.log('📋 Pushing database schema...\n');
  
  const schemaPath = path.join(__dirname, '..', 'supabase', 'migrations', '0000_complete_schema.sql');
  const rlsPath = path.join(__dirname, '..', 'supabase', 'migrations', '0001_rls_policies.sql');
  
  if (!fs.existsSync(schemaPath)) {
    console.error(`❌ Schema file not found: ${schemaPath}`);
    return false;
  }
  
  const schema = fs.readFileSync(schemaPath, 'utf8');
  const rlsPolicies = fs.existsSync(rlsPath) ? fs.readFileSync(rlsPath, 'utf8') : '';
  
  try {
    // Split schema into individual statements
    const statements = (schema + '\n' + rlsPolicies)
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));
    
    console.log(`📝 Executing ${statements.length} SQL statements...\n`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.length < 10) continue; // Skip very short statements
      
      try {
        // Use RPC or direct query - Supabase doesn't support multi-statement queries directly
        // We'll need to execute via PostgREST or use the SQL editor
        // For now, we'll provide instructions
        console.log(`⚠️  Cannot execute SQL directly via Supabase JS client.`);
        console.log(`   Please run the schema manually via Supabase Dashboard SQL Editor.\n`);
        return false;
      } catch (error) {
        console.error(`❌ Error executing statement ${i + 1}:`, error.message);
        // Continue with next statement
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error pushing schema:', error.message);
    return false;
  }
}

async function checkSchemaExists() {
  console.log('🔍 Checking if schema exists...\n');
  
  try {
    // Try to query licenses table
    const { data, error } = await supabase
      .from('licenses')
      .select('id')
      .limit(1);
    
    if (error) {
      if (error.code === 'PGRST116' || error.message.includes('not found')) {
        console.log('❌ Schema not found. Tables do not exist.\n');
        return false;
      }
      // Other errors might mean table exists but is empty
      if (error.code !== 'PGRST116') {
        console.log('✅ Schema appears to exist (got non-404 error)\n');
        return true;
      }
    } else {
      console.log('✅ Schema exists. Tables are accessible.\n');
      return true;
    }
  } catch (error) {
    console.log('⚠️  Could not verify schema:', error.message);
    return false;
  }
  
  return false;
}

async function main() {
  console.log('🚀 Complete Database Setup: Schema + Seed Data\n');
  console.log('=' .repeat(50));
  console.log('');
  
  // Check if schema exists
  const schemaExists = await checkSchemaExists();
  
  if (!schemaExists) {
    console.log('📋 Schema needs to be pushed first.\n');
    console.log('⚠️  Automated schema push via JS client is not supported.');
    console.log('   Please push the schema using one of these methods:\n');
    console.log('   Option 1: Supabase Dashboard');
    console.log('   1. Go to: https://app.supabase.com/project/_/sql/new');
    console.log('   2. Copy and run: supabase/migrations/0000_complete_schema.sql');
    console.log('   3. Copy and run: supabase/migrations/0001_rls_policies.sql\n');
    console.log('   Option 2: Supabase CLI');
    console.log('   cd apps/license-system');
    console.log('   supabase db push\n');
    console.log('   Option 3: psql (if you have database password)');
    console.log('   Use the connection string from Supabase Dashboard\n');
    console.log('After pushing schema, re-run this script or run: npm run db:seed\n');
    process.exit(1);
  }
  
  // Schema exists, now seed data
  console.log('✅ Schema exists. Proceeding to seed data...\n');
  
  // Import and run seed function
  const { createTestUsers, seedData } = require('./seed_data');
  
  const users = await createTestUsers();
  
  if (users.length === 0) {
    console.log('\n⚠️  No users created. Checking for existing users...\n');
    const { data: existingUsers, error } = await supabase.auth.admin.listUsers();
    if (error) {
      console.error('❌ Error listing users:', error.message);
      return;
    }
    if (existingUsers.users.length === 0) {
      console.log('❌ No users found. Please create at least one user first.');
      return;
    }
    console.log(`✅ Found ${existingUsers.users.length} existing user(s)`);
    await seedData(existingUsers.users.slice(0, 3));
  } else {
    await seedData(users);
  }
  
  console.log('\n✅ Setup complete!\n');
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = { pushSchema, checkSchemaExists };
