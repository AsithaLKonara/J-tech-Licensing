import { createTestUser } from '../helpers/test-utils';
import { callRevokeLicense, callIssueLicense, isEdgeFunctionAvailable } from '../helpers/edge-function-client';
import { generateDeviceFingerprint } from '../helpers/device-utils';
import { cleanupAfterTest } from '../helpers/db-cleanup';
import { supabaseService, testDataCleanup } from '../setup';

describe('revoke_license Edge Function', () => {
  let testUser: { id: string; email: string; accessToken: string };
  let deviceFingerprint: string;
  let licenseId: string;
  let isFunctionDeployed = true;

  beforeAll(async () => {
    // Check if both revoke_license and issue_license are available
    const revokeAvailable = await isEdgeFunctionAvailable('revoke_license');
    const issueAvailable = await isEdgeFunctionAvailable('issue_license');
    isFunctionDeployed = revokeAvailable && issueAvailable;
    if (!isFunctionDeployed) {
      console.warn('revoke_license or issue_license edge function not deployed, skipping tests');
    }
  });

  beforeEach(async () => {
    if (!isFunctionDeployed) return;
    testUser = await createTestUser();
    deviceFingerprint = generateDeviceFingerprint();

    // Create a license to revoke
    const issueResponse = await callIssueLicense(testUser.accessToken, {
      product: 'Test Product',
      plan: 'premium',
      features: { cloud_sync: true },
      device_fingerprint: deviceFingerprint,
      expires_in_days: 365,
    });

    expect(issueResponse.status).toBe(200);

    const { data: license } = await supabaseService
      .from('licenses')
      .select('id')
      .eq('user_id', testUser.id)
      .single();

    if (license) {
      licenseId = license.id;
      testDataCleanup.licenseIds.push(licenseId);
    }
  });

  afterEach(async () => {
    if (!testUser) return;

    await cleanupAfterTest({
      userIds: [testUser.id],
      licenseIds: testDataCleanup.licenseIds,
    });
  });

  it('should successfully revoke a license', async () => {
    if (!isFunctionDeployed) return;
    
    const response = await callRevokeLicense(testUser.accessToken, {
      license_id: licenseId,
      reason: 'Test revocation',
    });

    expect(response.status).toBe(200);
    expect(response.data.message).toContain('revoked');

    // Verify license is marked as inactive
    const { data: license } = await supabaseService
      .from('licenses')
      .select('is_active')
      .eq('id', licenseId)
      .single();

    expect(license).toBeDefined();
    expect(license?.is_active).toBe(false);

    // Verify revocation entry exists
    const { data: revoked } = await supabaseService
      .from('revoked_licenses')
      .select('*')
      .eq('license_id', licenseId)
      .single();

    expect(revoked).toBeDefined();
    expect(revoked?.reason).toBe('Test revocation');
  });

  it('should create revocation entry in revoked_licenses table', async () => {
    if (!isFunctionDeployed) return;
    
    const reason = 'User requested cancellation';
    const response = await callRevokeLicense(testUser.accessToken, {
      license_id: licenseId,
      reason,
    });

    expect(response.status).toBe(200);

    const { data: revoked } = await supabaseService
      .from('revoked_licenses')
      .select('*')
      .eq('license_id', licenseId)
      .single();

    expect(revoked).toBeDefined();
    expect(revoked?.license_id).toBe(licenseId);
    expect(revoked?.reason).toBe(reason);
    expect(revoked?.user_id).toBe(testUser.id);
  });

  it('should update license is_active flag to false', async () => {
    if (!isFunctionDeployed) return;
    
    // Verify license is active initially
    const { data: initialLicense } = await supabaseService
      .from('licenses')
      .select('is_active')
      .eq('id', licenseId)
      .single();

    expect(initialLicense?.is_active).toBe(true);

    const response = await callRevokeLicense(testUser.accessToken, {
      license_id: licenseId,
    });

    expect(response.status).toBe(200);

    // Verify license is now inactive
    const { data: revokedLicense } = await supabaseService
      .from('licenses')
      .select('is_active')
      .eq('id', licenseId)
      .single();

    expect(revokedLicense?.is_active).toBe(false);
  });

  it('should reject unauthorized revocation attempts', async () => {
    if (!isFunctionDeployed) return;
    
    // Create another user
    const otherUser = await createTestUser();

    const response = await callRevokeLicense(otherUser.accessToken, {
      license_id: licenseId,
    });

    expect(response.status).toBe(403);
    expect(response.error).toContain('Unauthorized');

    // Clean up other user
    testDataCleanup.userIds.push(otherUser.id);
  });

  it('should handle non-existent license gracefully', async () => {
    if (!isFunctionDeployed) return;
    
    const fakeLicenseId = crypto.randomUUID();

    const response = await callRevokeLicense(testUser.accessToken, {
      license_id: fakeLicenseId,
    });

    expect(response.status).toBe(404);
    expect(response.error).toContain('not found');
  });

  it('should prevent duplicate revocations', async () => {
    if (!isFunctionDeployed) return;
    
    // Revoke once
    const firstResponse = await callRevokeLicense(testUser.accessToken, {
      license_id: licenseId,
    });

    expect(firstResponse.status).toBe(200);

    // Try to revoke again
    const secondResponse = await callRevokeLicense(testUser.accessToken, {
      license_id: licenseId,
    });

    // Should handle gracefully (either 200 with "already revoked" or error)
    expect([200, 500]).toContain(secondResponse.status);
    if (secondResponse.status === 200) {
      expect(secondResponse.data.message).toContain('already revoked');
    }
  });

  it('should reject request with missing license_id', async () => {
    if (!isFunctionDeployed) return;
    
    const response = await callRevokeLicense(testUser.accessToken, {
      reason: 'Test',
    } as any);

    expect(response.status).toBe(400);
    expect(response.error).toContain('Missing license_id');
  });

  it('should use default reason when not provided', async () => {
    if (!isFunctionDeployed) return;
    
    const response = await callRevokeLicense(testUser.accessToken, {
      license_id: licenseId,
    });

    expect(response.status).toBe(200);

    const { data: revoked } = await supabaseService
      .from('revoked_licenses')
      .select('reason')
      .eq('license_id', licenseId)
      .single();

    expect(revoked?.reason).toBeDefined();
    expect(revoked?.reason).toContain('requested');
  });

  it('should reject request without authentication', async () => {
    if (!isFunctionDeployed) return;
    
    const response = await callRevokeLicense('' as any, {
      license_id: licenseId,
    });

    expect(response.status).toBe(401);
    expect(response.error).toContain('Unauthorized');
  });
});

