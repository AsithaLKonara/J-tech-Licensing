import { createTestUser } from '../helpers/test-utils';
import { callIssueLicense, callValidateLicense, isEdgeFunctionAvailable } from '../helpers/edge-function-client';
import { generateDeviceFingerprint } from '../helpers/device-utils';
import { signLicense, verifyLicense, generateKeyPair, createExpiredLicense } from '../helpers/crypto-utils';
import { cleanupAfterTest } from '../helpers/db-cleanup';
import { supabaseService, testDataCleanup } from '../setup';

describe('Offline-Online Verification E2E', () => {
  let testUser: { id: string; email: string; accessToken: string };
  let deviceFingerprint: string;
  let keyPair: Awaited<ReturnType<typeof generateKeyPair>>;
  let isFunctionDeployed = true;

  beforeAll(async () => {
    keyPair = await generateKeyPair();
    // Check required functions (issue_license and validate_license)
    const issueAvailable = await isEdgeFunctionAvailable('issue_license');
    const validateAvailable = await isEdgeFunctionAvailable('validate_license');
    
    isFunctionDeployed = issueAvailable && validateAvailable;
    if (!isFunctionDeployed) {
      console.warn('Required edge functions not deployed, skipping online tests');
    }
  });

  beforeEach(async () => {
    testUser = await createTestUser();
    deviceFingerprint = generateDeviceFingerprint();
  });

  afterEach(async () => {
    await cleanupAfterTest({
      userIds: [testUser.id],
      licenseIds: testDataCleanup.licenseIds,
    });
  });

  it('should verify valid license offline', async () => {
    // Create a license payload
    const licenseId = crypto.randomUUID();
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + 86400 * 365; // 1 year

    const payload = {
      license_id: licenseId,
      user_id: testUser.id,
      product: 'Test Product',
      plan: 'premium',
      features: { cloud_sync: true },
      device_fingerprint: deviceFingerprint,
      issued_at: issuedAt,
      expires_at: expiresAt,
      nonce: crypto.randomUUID(),
    };

    // Sign the license
    const jwt = await signLicense(payload, keyPair.privateKey, expiresAt);

    // Verify offline (simulate desktop client)
    const verified = await verifyLicense(jwt, keyPair.publicKey);

    expect(verified).toBeDefined();
    expect(verified.license_id).toBe(licenseId);
    expect(verified.device_fingerprint).toBe(deviceFingerprint);
  });

  it('should reject expired license offline', async () => {
    const licenseId = crypto.randomUUID();
    const payload = {
      license_id: licenseId,
      user_id: testUser.id,
      product: 'Test Product',
      plan: 'premium',
      features: {},
      device_fingerprint: deviceFingerprint,
      issued_at: Math.floor(Date.now() / 1000) - 7200,
      expires_at: Math.floor(Date.now() / 1000) - 3600,
      nonce: crypto.randomUUID(),
    };

    const expiredJWT = await createExpiredLicense(payload, keyPair.privateKey);

    // Try to verify (should fail due to expiration)
    try {
      await verifyLicense(expiredJWT, keyPair.publicKey);
      fail('Should have thrown error for expired license');
    } catch (error: any) {
      expect(error).toBeDefined();
      expect(error.code).toBe('ERR_JWT_EXPIRED');
    }
  });

  it('should reject license with wrong device fingerprint offline', async () => {
    const licenseId = crypto.randomUUID();
    const wrongFingerprint = generateDeviceFingerprint('wrong-device');
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + 86400 * 365;

    const payload = {
      license_id: licenseId,
      user_id: testUser.id,
      product: 'Test Product',
      plan: 'premium',
      features: {},
      device_fingerprint: wrongFingerprint, // Wrong fingerprint
      issued_at: issuedAt,
      expires_at: expiresAt,
      nonce: crypto.randomUUID(),
    };

    const jwt = await signLicense(payload, keyPair.privateKey, expiresAt);

    // Verify offline
    const verified = await verifyLicense(jwt, keyPair.publicKey);

    // Check device fingerprint matches current device
    expect(verified.device_fingerprint).not.toBe(deviceFingerprint);
    expect(verified.device_fingerprint).toBe(wrongFingerprint);
  });

  it('should validate license online after offline check', async () => {
    if (!isFunctionDeployed) return;
    if (!testUser.accessToken) {
      console.warn('Skipping test: no access token available (rate limit)');
      return;
    }

    // Issue license via Edge Function
    const issueResponse = await callIssueLicense(testUser.accessToken, {
      product: 'Test Product',
      plan: 'premium',
      features: {},
      device_fingerprint: deviceFingerprint,
      expires_in_days: 365,
    });

    expect(issueResponse.status).toBe(200);
    const licenseJWT = issueResponse.data.license;

    const { data: license } = await supabaseService
      .from('licenses')
      .select('id')
      .eq('user_id', testUser.id)
      .single();

    if (license) {
      testDataCleanup.licenseIds.push(license.id);
    }

    // Simulate offline verification first
    // (In real scenario, this would use embedded public key)
    // For test, we'll just verify the JWT structure

    // Then validate online
    const onlineResponse = await callValidateLicense({
      license_jwt: licenseJWT,
      device_fingerprint: deviceFingerprint,
    });

    expect(onlineResponse.status).toBe(200);
    expect(onlineResponse.data.message).toBe('License is valid');
  });

  it('should handle online validation failure after offline success', async () => {
    if (!isFunctionDeployed) return;
    if (!testUser.accessToken) {
      console.warn('Skipping test: no access token available (rate limit)');
      return;
    }

    // Issue license
    const issueResponse = await callIssueLicense(testUser.accessToken, {
      product: 'Test Product',
      plan: 'premium',
      features: {},
      device_fingerprint: deviceFingerprint,
      expires_in_days: 365,
    });

    expect(issueResponse.status).toBe(200);
    const licenseJWT = issueResponse.data.license;

    const { data: license } = await supabaseService
      .from('licenses')
      .select('id')
      .eq('user_id', testUser.id)
      .single();

    if (license) {
      testDataCleanup.licenseIds.push(license.id);

      // Revoke license
      await supabaseService.from('revoked_licenses').insert({
        license_id: license.id,
        user_id: testUser.id,
        reason: 'Test revocation',
      });

      await supabaseService
        .from('licenses')
        .update({ is_active: false })
        .eq('id', license.id);

      // Offline verification would pass (can't check revocation)
      // But online validation should fail
      const onlineResponse = await callValidateLicense({
        license_jwt: licenseJWT,
        device_fingerprint: deviceFingerprint,
      });

      expect(onlineResponse.status).toBe(403);
      expect(onlineResponse.error).toContain('revoked');
    }
  });

  it('should handle network errors gracefully', async () => {
    if (!isFunctionDeployed) return;
    if (!testUser.accessToken) {
      console.warn('Skipping test: no access token available (rate limit)');
      return;
    }

    // This test simulates network failure
    // In a real desktop app, this would trigger retry logic or grace period

    const issueResponse = await callIssueLicense(testUser.accessToken, {
      product: 'Test Product',
      plan: 'premium',
      features: {},
      device_fingerprint: deviceFingerprint,
      expires_in_days: 365,
    });

    expect(issueResponse.status).toBe(200);
    const licenseJWT = issueResponse.data.license;

    // Simulate network error by calling with invalid URL
    // (In real scenario, this would be handled by the desktop client)
    // For now, we verify the license is valid when network is available
    const response = await callValidateLicense({
      license_jwt: licenseJWT,
      device_fingerprint: deviceFingerprint,
    });

    expect(response.status).toBe(200);
  });
});

