import { createTestUser } from '../helpers/test-utils';
import {
  callIssueLicense,
  callValidateLicense,
  callRevokeLicense,
  callRegisterDevice,
  isEdgeFunctionAvailable,
} from '../helpers/edge-function-client';
import { generateDeviceFingerprint } from '../helpers/device-utils';
import { cleanupAfterTest } from '../helpers/db-cleanup';
import { supabaseService, testDataCleanup } from '../setup';

describe('License Lifecycle E2E', () => {
  let testUser: { id: string; email: string; accessToken: string };
  let deviceFingerprint: string;
  let licenseJWT: string;
  let licenseId: string;
  let isFunctionDeployed = true;

  beforeAll(async () => {
    // Check all required functions
    const issueAvailable = await isEdgeFunctionAvailable('issue_license');
    const validateAvailable = await isEdgeFunctionAvailable('validate_license');
    const revokeAvailable = await isEdgeFunctionAvailable('revoke_license');
    const registerAvailable = await isEdgeFunctionAvailable('register_device');
    
    isFunctionDeployed = issueAvailable && validateAvailable && revokeAvailable && registerAvailable;
    if (!isFunctionDeployed) {
      console.warn('Required edge functions not deployed, skipping tests');
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
      deviceIds: testDataCleanup.deviceIds,
    });
  });

  it('should complete full license lifecycle: issue → register → validate → revoke', async () => {
    if (!isFunctionDeployed) return;
    if (!testUser.accessToken) {
      console.warn('Skipping test: no access token available (rate limit)');
      return;
    }

    // Step 1: Issue license
    const issueResponse = await callIssueLicense(testUser.accessToken, {
      product: 'Test Product',
      plan: 'premium',
      features: { cloud_sync: true, updates: true },
      device_fingerprint: deviceFingerprint,
      expires_in_days: 365,
    });

    expect(issueResponse.status).toBe(200);
    licenseJWT = issueResponse.data.license;

    const { data: license } = await supabaseService
      .from('licenses')
      .select('id')
      .eq('user_id', testUser.id)
      .single();

    if (license) {
      licenseId = license.id;
      testDataCleanup.licenseIds.push(licenseId);
    }

    // Step 2: Register device
    const registerResponse = await callRegisterDevice(testUser.accessToken, {
      fingerprint: deviceFingerprint,
      name: 'Test Device',
    });

    expect(registerResponse.status).toBe(200);
    if (registerResponse.data.device?.id) {
      testDataCleanup.deviceIds.push(registerResponse.data.device.id);
    }

    // Step 3: Validate license
    const validateResponse = await callValidateLicense({
      license_jwt: licenseJWT,
      device_fingerprint: deviceFingerprint,
    }, testUser.accessToken);

    expect(validateResponse.status).toBe(200);
    expect(validateResponse.data.message).toBe('License is valid');

    // Step 4: Revoke license
    const revokeResponse = await callRevokeLicense(testUser.accessToken, {
      license_id: licenseId,
      reason: 'End of lifecycle test',
    });

    expect(revokeResponse.status).toBe(200);

    // Step 5: Verify license is no longer valid
    const validateAfterRevoke = await callValidateLicense({
      license_jwt: licenseJWT,
      device_fingerprint: deviceFingerprint,
    });

    expect(validateAfterRevoke.status).toBe(403);
    expect(validateAfterRevoke.error).toContain('revoked');
  });

  it('should handle multiple devices per user', async () => {
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
    licenseJWT = issueResponse.data.license;

    const { data: license } = await supabaseService
      .from('licenses')
      .select('id')
      .eq('user_id', testUser.id)
      .single();

    if (license) {
      licenseId = license.id;
      testDataCleanup.licenseIds.push(licenseId);
    }

    // Register multiple devices
    const device1 = generateDeviceFingerprint('device1');
    const device2 = generateDeviceFingerprint('device2');

    const register1 = await callRegisterDevice(testUser.accessToken, {
      fingerprint: device1,
      name: 'Device 1',
    });

    const register2 = await callRegisterDevice(testUser.accessToken, {
      fingerprint: device2,
      name: 'Device 2',
    });

    expect(register1.status).toBe(200);
    expect(register2.status).toBe(200);

    if (register1.data.device?.id) {
      testDataCleanup.deviceIds.push(register1.data.device.id);
    }
    if (register2.data.device?.id) {
      testDataCleanup.deviceIds.push(register2.data.device.id);
    }

    // Verify both devices are registered
    const { data: devices } = await supabaseService
      .from('devices')
      .select('*')
      .eq('user_id', testUser.id);

    expect(devices).toBeDefined();
    expect(devices?.length).toBeGreaterThanOrEqual(2);
  });

  it('should handle license expiration', async () => {
    if (!isFunctionDeployed) return;
    if (!testUser.accessToken) {
      console.warn('Skipping test: no access token available (rate limit)');
      return;
    }

    // Issue license with short expiration
    const issueResponse = await callIssueLicense(testUser.accessToken, {
      product: 'Test Product',
      plan: 'trial',
      features: {},
      device_fingerprint: deviceFingerprint,
      expires_in_days: 1, // 1 day expiration
    });

    expect(issueResponse.status).toBe(200);
    licenseJWT = issueResponse.data.license;

    // Register device
    await callRegisterDevice(testUser.accessToken, {
      fingerprint: deviceFingerprint,
      name: 'Test Device',
    });

    // Validate immediately (should work)
    const validateNow = await callValidateLicense({
      license_jwt: licenseJWT,
      device_fingerprint: deviceFingerprint,
    });

    expect(validateNow.status).toBe(200);

    // Note: Testing actual expiration would require time manipulation
    // In a real scenario, you'd mock time or wait for expiration
  });

  it('should handle concurrent validation requests', async () => {
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
    licenseJWT = issueResponse.data.license;

    // Register device
    await callRegisterDevice(testUser.accessToken, {
      fingerprint: deviceFingerprint,
      name: 'Test Device',
    });

    // Make concurrent validation requests
    const concurrentRequests = Array(5).fill(null).map(() =>
      callValidateLicense({
        license_jwt: licenseJWT,
        device_fingerprint: deviceFingerprint,
      })
    );

    const results = await Promise.all(concurrentRequests);

    // All should succeed
    results.forEach(result => {
      expect(result.status).toBe(200);
      expect(result.data.message).toBe('License is valid');
    });
  });
});

