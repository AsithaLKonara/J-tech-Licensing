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

describe('Dashboard API Integration', () => {
  let testUser: { id: string; email: string; accessToken: string };
  let deviceFingerprint: string;
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

  it('should list user licenses', async () => {
    if (!isFunctionDeployed) return;
    if (!testUser.accessToken) {
      console.warn('Skipping test: no access token available (rate limit)');
      return;
    }

    // Create multiple licenses
    const issue1 = await callIssueLicense(testUser.accessToken, {
      product: 'Product 1',
      plan: 'premium',
      features: {},
      device_fingerprint: generateDeviceFingerprint('device1'),
      expires_in_days: 365,
    });

    const issue2 = await callIssueLicense(testUser.accessToken, {
      product: 'Product 2',
      plan: 'basic',
      features: {},
      device_fingerprint: generateDeviceFingerprint('device2'),
      expires_in_days: 180,
    });

    expect(issue1.status).toBe(200);
    expect(issue2.status).toBe(200);

    // List licenses via Supabase
    const { data: licenses, error } = await supabaseService
      .from('licenses')
      .select('*')
      .eq('user_id', testUser.id)
      .order('created_at', { ascending: false });

    expect(error).toBeNull();
    expect(licenses).toBeDefined();
    expect(licenses?.length).toBeGreaterThanOrEqual(2);

    if (licenses) {
      testDataCleanup.licenseIds.push(...licenses.map(l => l.id));
    }
  });

  it('should list user devices', async () => {
    if (!isFunctionDeployed) return;
    if (!testUser.accessToken) {
      console.warn('Skipping test: no access token available (rate limit)');
      return;
    }

    // Register multiple devices
    const device1 = await callRegisterDevice(testUser.accessToken, {
      fingerprint: generateDeviceFingerprint('device1'),
      name: 'Device 1',
    });

    const device2 = await callRegisterDevice(testUser.accessToken, {
      fingerprint: generateDeviceFingerprint('device2'),
      name: 'Device 2',
    });

    expect(device1.status).toBe(200);
    expect(device2.status).toBe(200);

    // List devices via Supabase
    const { data: devices, error } = await supabaseService
      .from('devices')
      .select('*')
      .eq('user_id', testUser.id)
      .order('created_at', { ascending: false });

    expect(error).toBeNull();
    expect(devices).toBeDefined();
    expect(devices?.length).toBeGreaterThanOrEqual(2);

    if (devices) {
      testDataCleanup.deviceIds.push(...devices.map(d => d.id));
    }
  });

  it('should issue license via dashboard', async () => {
    if (!isFunctionDeployed) return;
    if (!testUser.accessToken) {
      console.warn('Skipping test: no access token available (rate limit)');
      return;
    }

    const response = await callIssueLicense(testUser.accessToken, {
      product: 'Dashboard Product',
      plan: 'premium',
      features: { feature1: true, feature2: true },
      device_fingerprint: deviceFingerprint,
      expires_in_days: 365,
    });

    expect(response.status).toBe(200);
    expect(response.data.license).toBeDefined();

    // Verify license in database
    const { data: license } = await supabaseService
      .from('licenses')
      .select('*')
      .eq('user_id', testUser.id)
      .single();

    expect(license).toBeDefined();
    expect(license?.product).toBe('Dashboard Product');
    expect(license?.plan).toBe('premium');

    if (license) {
      testDataCleanup.licenseIds.push(license.id);
    }
  });

  it('should revoke license via dashboard', async () => {
    if (!isFunctionDeployed) return;
    if (!testUser.accessToken) {
      console.warn('Skipping test: no access token available (rate limit)');
      return;
    }

    // Issue license first
    const issueResponse = await callIssueLicense(testUser.accessToken, {
      product: 'Test Product',
      plan: 'premium',
      features: {},
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
      testDataCleanup.licenseIds.push(license.id);

      // Revoke via dashboard
      const revokeResponse = await callRevokeLicense(testUser.accessToken, {
        license_id: license.id,
        reason: 'Dashboard revocation',
      });

      expect(revokeResponse.status).toBe(200);

      // Verify license is revoked
      const { data: revokedLicense } = await supabaseService
        .from('licenses')
        .select('is_active')
        .eq('id', license.id)
        .single();

      expect(revokedLicense?.is_active).toBe(false);
    }
  });

  it('should handle API errors gracefully', async () => {
    if (!isFunctionDeployed) return;

    // Test with invalid access token
    const response = await callIssueLicense('invalid-token', {
      product: 'Test',
      plan: 'test',
      features: {},
      device_fingerprint: deviceFingerprint,
      expires_in_days: 365,
    });

    expect(response.status).toBe(401);
    expect(response.error).toBeDefined();
  });

  it('should validate license status via dashboard', async () => {
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

      // Validate license
      const validateResponse = await callValidateLicense({
        license_jwt: licenseJWT,
        device_fingerprint: deviceFingerprint,
      }, testUser.accessToken);

      expect(validateResponse.status).toBe(200);
      expect(validateResponse.data.message).toBe('License is valid');
    }
  });
});

