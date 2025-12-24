import { supabaseAnon, supabaseService, testDataCleanup } from '../setup';
import { generateDeviceFingerprint } from './device-utils';

export interface TestUser {
  id: string;
  email: string;
  accessToken: string;
}

/**
 * Create a test user with Supabase Auth
 * Uses admin API to bypass email validation
 */
export async function createTestUser(
  email?: string,
  password: string = 'test-password-123'
): Promise<TestUser> {
  const testEmail = email || `test_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`;
  
  // Use admin API to create user directly (bypasses email validation)
  const { data: adminUserData, error: adminError } = await supabaseService.auth.admin.createUser({
    email: testEmail,
    password,
    email_confirm: true, // Auto-confirm email to avoid confirmation requirement
  });

  if (adminError) {
    throw new Error(`Failed to create test user: ${adminError.message}`);
  }

  if (!adminUserData.user) {
    throw new Error('Failed to create test user: No user returned');
  }

  // Sign in with the user to get an access token
  // Try with retry logic to handle rate limiting
  let accessToken = '';
  let signInData: any = null;
  
  // Retry once after a short delay if rate limited
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      // Wait 1 second before retry to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    const { data, error: signInError } = await supabaseAnon.auth.signInWithPassword({
    email: testEmail,
    password,
  });

    if (signInError) {
      // Check if it's a rate limit error
      const isRateLimit = signInError.message?.includes('rate limit') || 
                         signInError.message?.includes('too many requests') ||
                         signInError.status === 429;
      
      if (isRateLimit && attempt < 1) {
        // Will retry on next iteration
        continue;
      }
      
      // If sign in fails, we still have the user, but no access token
      // This might happen in some configurations (rate limits, etc.)
      // Tests that need tokens should check and skip gracefully
      if (isRateLimit) {
        console.warn(`⚠️  Rate limit reached when signing in test user ${testEmail}. User created but no access token available.`);
      } else {
        console.warn(`⚠️  Failed to sign in test user (user was created): ${signInError.message}`);
      }
      break;
    }
    
    signInData = data;
    accessToken = data?.session?.access_token || '';
    break;
  }

  // Track for cleanup
  testDataCleanup.userIds.push(adminUserData.user.id);

  return {
    id: adminUserData.user.id,
    email: testEmail,
    accessToken,
  };
}

/**
 * Delete a test user
 */
export async function deleteTestUser(userId: string): Promise<void> {
  try {
    await supabaseService.auth.admin.deleteUser(userId);
    testDataCleanup.userIds = testDataCleanup.userIds.filter(id => id !== userId);
  } catch (error) {
    console.warn(`Failed to delete test user ${userId}:`, error);
  }
}

/**
 * Create a test license (directly in database, bypassing Edge Function)
 * Useful for setting up test scenarios
 */
export async function createTestLicense(
  userId: string,
  options: {
    product?: string;
    plan?: string;
    features?: any;
    deviceFingerprint?: string;
    expiresInDays?: number;
    isActive?: boolean;
  } = {}
): Promise<{ id: string; jwt: string }> {
  const {
    product = 'Test Product',
    plan = 'test-plan',
    features = { feature1: true },
    deviceFingerprint = generateDeviceFingerprint(),
    expiresInDays = 365,
    isActive = true,
  } = options;

  const licenseId = crypto.randomUUID();
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + expiresInDays * 24 * 60 * 60;
  const nonce = crypto.randomUUID();

  // Note: In real tests, we'd sign this with the actual private key
  // For now, we'll create a placeholder JWT
  const jwt = 'test-jwt-placeholder';

  const { data, error } = await supabaseService.from('licenses').insert({
    id: licenseId,
    user_id: userId,
    product,
    plan,
    features,
    device_fingerprint: deviceFingerprint,
    issued_at: issuedAt,
    expires_at: expiresAt,
    nonce,
    signature: jwt,
    is_active: isActive,
  }).select().single();

  if (error) {
    throw new Error(`Failed to create test license: ${error.message}`);
  }

  testDataCleanup.licenseIds.push(licenseId);

  return { id: licenseId, jwt };
}

/**
 * Clean up all test data for a specific test
 */
export async function cleanupTestData(testId: string): Promise<void> {
  // This would clean up data tagged with a specific test ID
  // For now, we rely on the global cleanup mechanism
  console.log(`Cleaning up test data for test: ${testId}`);
}

/**
 * Wait for a specified amount of time (useful for async operations)
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a random email for testing
 */
export function generateTestEmail(): string {
  return `test_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`;
}

