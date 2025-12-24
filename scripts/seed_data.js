/**
 * Seed Sample Data Script
 * Creates test users and seeds sample data for testing
 * 
 * Usage:
 *   node scripts/seed_data.js
 * 
 * Requires environment variables:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

// Load environment variables from .env.test if it exists
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.join(__dirname, '..', '.env.test');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log('📄 Loaded environment variables from .env.test\n');
}

const { createClient } = require('@supabase/supabase-js');

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
  }
});

async function createTestUsers() {
  console.log('👤 Creating test users...\n');
  
  const testUsers = [
    { email: 'test_user_1@example.com', password: 'TestPassword123!' },
    { email: 'test_user_2@example.com', password: 'TestPassword123!' },
    { email: 'test_user_3@example.com', password: 'TestPassword123!' },
  ];
  
  const createdUsers = [];
  
  for (const user of testUsers) {
    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
      });
      
      if (error) {
        if (error.message.includes('already registered')) {
          console.log(`⚠️  User ${user.email} already exists, skipping...`);
          // Try to get existing user
          const { data: users } = await supabase.auth.admin.listUsers();
          const existingUser = users.users.find(u => u.email === user.email);
          if (existingUser) {
            createdUsers.push(existingUser);
          }
        } else {
          console.error(`❌ Error creating user ${user.email}:`, error.message);
        }
      } else {
        console.log(`✅ Created user: ${user.email} (${data.user.id})`);
        createdUsers.push(data.user);
      }
    } catch (err) {
      console.error(`❌ Exception creating user ${user.email}:`, err.message);
    }
  }
  
  return createdUsers;
}

async function seedData(userIds) {
  if (userIds.length === 0) {
    console.log('\n⚠️  No users available for seeding. Please create users first.');
    return;
  }
  
  console.log('\n🌱 Seeding sample data...\n');
  
  const now = Math.floor(Date.now() / 1000);
  const dayInSeconds = 86400;
  
  // Sample Licenses
  const licenses = [
    {
      user_id: userIds[0].id,
      product: 'UploadBridge Pro',
      plan: 'premium',
      features: { cloud_sync: true, unlimited_uploads: true, priority_support: true },
      device_fingerprint: 'DEVICE_FINGERPRINT_001',
      issued_at: now - dayInSeconds,
      expires_at: now + (365 * dayInSeconds),
      nonce: crypto.randomUUID(),
      signature: 'sample_jwt_signature_1',
      is_active: true,
    },
    {
      user_id: userIds[1]?.id || userIds[0].id,
      product: 'UploadBridge Pro',
      plan: 'monthly',
      features: { cloud_sync: true, unlimited_uploads: true },
      device_fingerprint: 'DEVICE_FINGERPRINT_002',
      issued_at: now - (10 * dayInSeconds),
      expires_at: now + (20 * dayInSeconds),
      nonce: crypto.randomUUID(),
      signature: 'sample_jwt_signature_2',
      is_active: true,
    },
    {
      user_id: userIds[0].id,
      product: 'UploadBridge Pro',
      plan: 'yearly',
      features: { cloud_sync: true, unlimited_uploads: true },
      device_fingerprint: 'DEVICE_FINGERPRINT_003',
      issued_at: now - (400 * dayInSeconds),
      expires_at: now - (35 * dayInSeconds), // Expired
      nonce: crypto.randomUUID(),
      signature: 'sample_jwt_signature_3',
      is_active: false,
    },
  ];
  
  const insertedLicenses = [];
  for (const license of licenses) {
    const { data, error } = await supabase
      .from('licenses')
      .insert(license)
      .select()
      .single();
    
    if (error) {
      console.error(`❌ Error inserting license:`, error.message);
    } else {
      console.log(`✅ Created license: ${data.id} (${license.plan})`);
      insertedLicenses.push(data);
    }
  }
  
  // Sample Devices
  const devices = [
    {
      user_id: userIds[0].id,
      device_fingerprint: 'DEVICE_FINGERPRINT_001',
      device_name: 'Main Desktop - Windows',
    },
    {
      user_id: userIds[1]?.id || userIds[0].id,
      device_fingerprint: 'DEVICE_FINGERPRINT_002',
      device_name: 'Laptop - macOS',
    },
    {
      user_id: userIds[0].id,
      device_fingerprint: 'DEVICE_FINGERPRINT_003',
      device_name: 'Secondary Device - Linux',
    },
  ];
  
  for (const device of devices) {
    const { data, error } = await supabase
      .from('devices')
      .insert(device)
      .select()
      .single();
    
    if (error) {
      if (error.code === '23505') { // Unique violation
        console.log(`⚠️  Device ${device.device_fingerprint} already exists, skipping...`);
      } else {
        console.error(`❌ Error inserting device:`, error.message);
      }
    } else {
      console.log(`✅ Created device: ${data.device_fingerprint}`);
    }
  }
  
  // Sample Revoked License (if we have a license to revoke)
  if (insertedLicenses.length > 0) {
    const revokedLicense = insertedLicenses[insertedLicenses.length - 1];
    const { data, error } = await supabase
      .from('revoked_licenses')
      .insert({
        license_id: revokedLicense.id,
        user_id: revokedLicense.user_id,
        reason: 'User requested cancellation',
      })
      .select()
      .single();
    
    if (error) {
      if (error.code === '23505') {
        console.log(`⚠️  Revoked license entry already exists, skipping...`);
      } else {
        console.error(`❌ Error inserting revoked license:`, error.message);
      }
    } else {
      console.log(`✅ Created revoked license entry`);
    }
  }
  
  // Sample Entitlements
  const entitlements = [
    {
      user_id: userIds[0].id,
      product: 'UploadBridge Pro',
      plan: 'yearly',
      features: ['cloud_sync', 'unlimited_uploads', 'priority_support'],
      status: 'active',
      expires_at: new Date(Date.now() + (350 * dayInSeconds * 1000)).toISOString(),
    },
    {
      user_id: userIds[1]?.id || userIds[0].id,
      product: 'UploadBridge Pro',
      plan: 'monthly',
      features: ['cloud_sync', 'unlimited_uploads'],
      status: 'active',
      expires_at: new Date(Date.now() + (20 * dayInSeconds * 1000)).toISOString(),
    },
  ];
  
  for (const entitlement of entitlements) {
    const { data, error } = await supabase
      .from('entitlements')
      .insert(entitlement)
      .select()
      .single();
    
    if (error) {
      console.error(`❌ Error inserting entitlement:`, error.message);
    } else {
      console.log(`✅ Created entitlement: ${data.id}`);
    }
  }
  
  // Sample Audit Logs
  if (insertedLicenses.length > 0) {
    const auditLogs = [
      {
        user_id: insertedLicenses[0].user_id,
        event_type: 'license_issued',
        entity_id: insertedLicenses[0].id,
        details: { product: 'UploadBridge Pro', plan: 'premium' },
      },
      {
        user_id: insertedLicenses[0].user_id,
        event_type: 'license_validated',
        entity_id: insertedLicenses[0].id,
        details: { device_fingerprint: 'DEVICE_FINGERPRINT_001', result: 'valid' },
      },
    ];
    
    for (const log of auditLogs) {
      const { data, error } = await supabase
        .from('audit_logs')
        .insert(log)
        .select()
        .single();
      
      if (error) {
        console.error(`❌ Error inserting audit log:`, error.message);
      } else {
        console.log(`✅ Created audit log: ${data.id}`);
      }
    }
  }
  
  console.log('\n✅ Seeding completed!\n');
}

async function main() {
  console.log('🚀 Starting seed data script...\n');
  
  try {
    // Create test users
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
        console.log('   You can create users via:');
        console.log('   - Supabase Dashboard > Authentication > Users > Add User');
        console.log('   - Or run this script with SUPABASE_SERVICE_ROLE_KEY set');
        return;
      }
      console.log(`✅ Found ${existingUsers.users.length} existing user(s)`);
      await seedData(existingUsers.users.slice(0, 3));
    } else {
      await seedData(users);
    }
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { createTestUsers, seedData };
