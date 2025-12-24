import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Load environment variables from .env.test file if it exists
config({ path: resolve(__dirname, '../.env.test') });

// Test environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing required environment variables: SUPABASE_URL, SUPABASE_ANON_KEY');
}

// Create Supabase clients
export const supabaseAnon: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const supabaseService: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Global test configuration
export const TEST_CONFIG = {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  EDGE_FUNCTION_BASE_URL: `${SUPABASE_URL}/functions/v1`,
};

// Generate unique test run ID for cleanup
export const TEST_RUN_ID = `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;

// Global cleanup tracking
export const testDataCleanup: {
  userIds: string[];
  licenseIds: string[];
  deviceIds: string[];
} = {
  userIds: [],
  licenseIds: [],
  deviceIds: [],
};

// Cleanup function to be called after all tests
export async function globalCleanup() {
  console.log('Performing global cleanup...');
  
  // Clean up in reverse dependency order
  if (testDataCleanup.licenseIds.length > 0) {
    await supabaseService
      .from('revoked_licenses')
      .delete()
      .in('license_id', testDataCleanup.licenseIds);
  }

  if (testDataCleanup.licenseIds.length > 0) {
    await supabaseService
      .from('licenses')
      .delete()
      .in('id', testDataCleanup.licenseIds);
  }

  if (testDataCleanup.deviceIds.length > 0) {
    await supabaseService
      .from('devices')
      .delete()
      .in('id', testDataCleanup.deviceIds);
  }

  // Clean up audit logs
  if (testDataCleanup.userIds.length > 0 || testDataCleanup.licenseIds.length > 0) {
    await supabaseService
      .from('audit_logs')
      .delete()
      .or(
        `user_id.in.(${testDataCleanup.userIds.join(',')}),entity_id.in.(${testDataCleanup.licenseIds.join(',')})`
      );
  }

  // Clean up users (via auth admin API if available)
  for (const userId of testDataCleanup.userIds) {
    try {
      await supabaseService.auth.admin.deleteUser(userId);
    } catch (error) {
      console.warn(`Failed to delete user ${userId}:`, error);
    }
  }

  // Reset cleanup tracking
  testDataCleanup.userIds = [];
  testDataCleanup.licenseIds = [];
  testDataCleanup.deviceIds = [];
}

// Jest setup
beforeAll(async () => {
  console.log(`Starting test run: ${TEST_RUN_ID}`);
});

afterAll(async () => {
  await globalCleanup();
  console.log(`Test run ${TEST_RUN_ID} completed`);
});

