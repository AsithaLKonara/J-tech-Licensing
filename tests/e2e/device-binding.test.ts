import { createTestUser } from '../helpers/test-utils';
import { callIssueLicense, callValidateLicense, callRegisterDevice, isEdgeFunctionAvailable } from '../helpers/edge-function-client';
import { generateDeviceFingerprint } from '../helpers/device-utils';
import { cleanupAfterTest } from '../helpers/db-cleanup';
import { supabaseService, testDataCleanup } from '../setup';

describe('Device Binding E2E', () => {
  let testUser: { id: string; email: string; accessToken: string };
  let deviceFingerprint: string;
  let licenseJWT: string;
  let isFunctionDeployed = true;

  beforeAll(async () => {
    // Check all required functions
    const issueAvailable = await isEdgeFunctionAvailable('issue_license');
    const validateAvailable = await isEdgeFunctionAvailable('validate_license');
    const registerAvailable = await isEdgeFunctionAvailable('register_device');
    
    isFunctionDeployed = issueAvailable && validateAvailable && registerAvailable;
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

  it('should bind license to single device', async () => {
    if (!isFunctionDeployed) return;
    if (!testUser.accessToken) {
      console.warn('Skipping test: no access token available (rate limit)');
      return;
    }

    // Issue license with device fingerprint
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
      testDataCleanup.licenseIds.push(license.id);
    }

    // Register the device
    const registerResponse = await callRegisterDevice(testUser.accessToken, {
      fingerprint: deviceFingerprint,
      name: 'Bound Device',
    });

    expect(registerResponse.status).toBe(200);
    if (registerResponse.data.device?.id) {
      testDataCleanup.deviceIds.push(registerResponse.data.device.id);
    }

    // Validate with correct device
    const validateResponse = await callValidateLicense({
      license_jwt: licenseJWT,
      device_fingerprint: deviceFingerprint,
    });

    expect(validateResponse.status).toBe(200);
  });

  it('should reject validation with wrong device fingerprint', async () => {
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
      testDataCleanup.licenseIds.push(license.id);
    }

    // Try to validate with different device
    const wrongFingerprint = generateDeviceFingerprint('different-device');
    const validateResponse = await callValidateLicense({
      license_jwt: licenseJWT,
      device_fingerprint: wrongFingerprint,
    });

    expect(validateResponse.status).toBe(403);
    expect(validateResponse.error).toContain('not bound to this device');
  });

  it('should handle device fingerprint collision', async () => {
    if (!isFunctionDeployed) return;

    const fingerprint = generateDeviceFingerprint('collision-test');

    // User1 registers device
    const user1 = await createTestUser();
    if (!user1.accessToken) {
      console.warn('Skipping test: no access token available for user1 (rate limit)');
      return;
    }
    const register1 = await callRegisterDevice(user1.accessToken, {
      fingerprint,
      name: 'User1 Device',
    });

    expect(register1.status).toBe(200);
    if (register1.data.device?.id) {
      testDataCleanup.deviceIds.push(register1.data.device.id);
    }

    // User2 tries to register same fingerprint
    const user2 = await createTestUser();
    if (!user2.accessToken) {
      console.warn('Skipping test: no access token available for user2 (rate limit)');
      testDataCleanup.userIds.push(user1.id);
      return;
    }
    const register2 = await callRegisterDevice(user2.accessToken, {
      fingerprint,
      name: 'User2 Device',
    });

    expect(register2.status).toBe(409);
    expect(register2.error).toContain('already registered by another user');

    // Clean up
    testDataCleanup.userIds.push(user1.id, user2.id);
  });

  it('should allow device re-registration for same user', async () => {
    if (!isFunctionDeployed) return;
    if (!testUser.accessToken) {
      console.warn('Skipping test: no access token available (rate limit)');
      return;
    }

    // Register device first time
    const register1 = await callRegisterDevice(testUser.accessToken, {
      fingerprint: deviceFingerprint,
      name: 'Original Device',
    });

    expect(register1.status).toBe(200);
    if (register1.data.device?.id) {
      testDataCleanup.deviceIds.push(register1.data.device.id);
    }

    // Register same device again (should be idempotent)
    const register2 = await callRegisterDevice(testUser.accessToken, {
      fingerprint: deviceFingerprint,
      name: 'Updated Device Name',
    });

    expect(register2.status).toBe(200);
    expect(register2.data.message).toContain('already registered');
  });

  it('should maintain device binding after license re-issue', async () => {
    if (!isFunctionDeployed) return;
    if (!testUser.accessToken) {
      console.warn('Skipping test: no access token available (rate limit)');
      return;
    }

    // Issue first license
    const issue1 = await callIssueLicense(testUser.accessToken, {
      product: 'Test Product',
      plan: 'premium',
      features: {},
      device_fingerprint: deviceFingerprint,
      expires_in_days: 365,
    });

    expect(issue1.status).toBe(200);
    const licenseJWT1 = issue1.data.license;

    // Register device
    await callRegisterDevice(testUser.accessToken, {
      fingerprint: deviceFingerprint,
      name: 'Test Device',
    });

    // Issue second license for same device
    const issue2 = await callIssueLicense(testUser.accessToken, {
      product: 'Test Product',
      plan: 'premium',
      features: {},
      device_fingerprint: deviceFingerprint,
      expires_in_days: 365,
    });

    expect(issue2.status).toBe(200);
    const licenseJWT2 = issue2.data.license;

    // Both licenses should validate with same device
    const validate1 = await callValidateLicense({
      license_jwt: licenseJWT1,
      device_fingerprint: deviceFingerprint,
    });

    const validate2 = await callValidateLicense({
      license_jwt: licenseJWT2,
      device_fingerprint: deviceFingerprint,
    });

    expect(validate1.status).toBe(200);
    expect(validate2.status).toBe(200);

    // Clean up licenses
    const { data: licenses } = await supabaseService
      .from('licenses')
      .select('id')
      .eq('user_id', testUser.id);

    if (licenses) {
      testDataCleanup.licenseIds.push(...licenses.map(l => l.id));
    }
  });
});

