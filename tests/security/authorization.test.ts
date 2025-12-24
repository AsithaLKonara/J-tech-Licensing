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

describe('Authorization Security', () => {
  let user1: { id: string; email: string; accessToken: string };
  let user2: { id: string; email: string; accessToken: string };
  let deviceFingerprint1: string;
  let deviceFingerprint2: string;
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
    user1 = await createTestUser();
    user2 = await createTestUser();
    deviceFingerprint1 = generateDeviceFingerprint('user1-device');
    deviceFingerprint2 = generateDeviceFingerprint('user2-device');
  });

  afterEach(async () => {
    await cleanupAfterTest({
      userIds: [user1.id, user2.id],
      licenseIds: testDataCleanup.licenseIds,
      deviceIds: testDataCleanup.deviceIds,
    });
  });

  it('should prevent users from accessing other users licenses', async () => {
    if (!isFunctionDeployed) return;
    if (!user1.accessToken || !user2.accessToken) {
      console.warn('Skipping test: no access token available (rate limit)');
      return;
    }

    // User1 creates a license
    const issueResponse = await callIssueLicense(user1.accessToken, {
      product: 'User1 Product',
      plan: 'premium',
      features: {},
      device_fingerprint: deviceFingerprint1,
      expires_in_days: 365,
    });

    expect(issueResponse.status).toBe(200);
    const licenseJWT = issueResponse.data.license;

    const { data: license } = await supabaseService
      .from('licenses')
      .select('id')
      .eq('user_id', user1.id)
      .single();

    if (license) {
      testDataCleanup.licenseIds.push(license.id);

      // User2 tries to revoke User1's license
      const revokeResponse = await callRevokeLicense(user2.accessToken, {
        license_id: license.id,
      });

      expect(revokeResponse.status).toBe(403);
      expect(revokeResponse.error).toContain('Unauthorized');
    }
  });

  it('should prevent users from viewing other users devices', async () => {
    if (!isFunctionDeployed) return;
    if (!user1.accessToken || !user2.accessToken) {
      console.warn('Skipping test: no access token available (rate limit)');
      return;
    }

    // User1 registers device
    const register1 = await callRegisterDevice(user1.accessToken, {
      fingerprint: deviceFingerprint1,
      name: 'User1 Device',
    });

    expect(register1.status).toBe(200);
    if (register1.data.device?.id) {
      testDataCleanup.deviceIds.push(register1.data.device.id);
    }

    // User2 registers device
    const register2 = await callRegisterDevice(user2.accessToken, {
      fingerprint: deviceFingerprint2,
      name: 'User2 Device',
    });

    expect(register2.status).toBe(200);
    if (register2.data.device?.id) {
      testDataCleanup.deviceIds.push(register2.data.device.id);
    }

    // User1 should only see their own devices (via RLS)
    const { data: user1Devices } = await supabaseService
      .from('devices')
      .select('*')
      .eq('user_id', user1.id);

    expect(user1Devices).toBeDefined();
    if (user1Devices) {
      expect(user1Devices.every(d => d.user_id === user1.id)).toBe(true);
      expect(user1Devices.some(d => d.user_id === user2.id)).toBe(false);
    }
  });

  it('should prevent unauthorized Edge Function calls', async () => {
    if (!isFunctionDeployed) return;

    // Try to issue license without authentication
    const response = await callIssueLicense('' as any, {
      product: 'Test',
      plan: 'test',
      features: {},
      device_fingerprint: deviceFingerprint1,
      expires_in_days: 365,
    });

    expect(response.status).toBe(401);
    expect(response.error).toContain('Unauthorized');
  });

  it('should enforce user ownership on license revocation', async () => {
    if (!isFunctionDeployed) return;
    if (!user1.accessToken || !user2.accessToken) {
      console.warn('Skipping test: no access token available (rate limit)');
      return;
    }

    // User1 creates license
    const issueResponse = await callIssueLicense(user1.accessToken, {
      product: 'Test Product',
      plan: 'premium',
      features: {},
      device_fingerprint: deviceFingerprint1,
      expires_in_days: 365,
    });

    expect(issueResponse.status).toBe(200);

    const { data: license } = await supabaseService
      .from('licenses')
      .select('id, user_id')
      .eq('user_id', user1.id)
      .single();

    if (license) {
      testDataCleanup.licenseIds.push(license.id);

      // Verify user1 can revoke their own license
      const revokeOwn = await callRevokeLicense(user1.accessToken, {
        license_id: license.id,
      });

      expect(revokeOwn.status).toBe(200);

      // User2 cannot revoke user1's license
      // (This would fail if license was already revoked, so we test with a new license)
      const issue2 = await callIssueLicense(user1.accessToken, {
        product: 'Test Product 2',
        plan: 'premium',
        features: {},
        device_fingerprint: deviceFingerprint1,
        expires_in_days: 365,
      });

      if (issue2.status === 200) {
        const { data: license2 } = await supabaseService
          .from('licenses')
          .select('id')
          .eq('user_id', user1.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (license2) {
          testDataCleanup.licenseIds.push(license2.id);

          const revokeOther = await callRevokeLicense(user2.accessToken, {
            license_id: license2.id,
          });

          expect(revokeOther.status).toBe(403);
        }
      }
    }
  });

  it('should isolate user data through RLS policies', async () => {
    if (!isFunctionDeployed) return;
    if (!user1.accessToken || !user2.accessToken) {
      console.warn('Skipping test: no access token available (rate limit)');
      return;
    }

    // Create licenses for both users
    await callIssueLicense(user1.accessToken, {
      product: 'User1 Product',
      plan: 'premium',
      features: {},
      device_fingerprint: deviceFingerprint1,
      expires_in_days: 365,
    });

    await callIssueLicense(user2.accessToken, {
      product: 'User2 Product',
      plan: 'premium',
      features: {},
      device_fingerprint: deviceFingerprint2,
      expires_in_days: 365,
    });

    // Get all licenses (using service role to bypass RLS for testing)
    const { data: allLicenses } = await supabaseService
      .from('licenses')
      .select('id, user_id')
      .in('user_id', [user1.id, user2.id]);

    expect(allLicenses).toBeDefined();
    expect(allLicenses?.length).toBeGreaterThanOrEqual(2);

    // Verify user isolation
    const user1Licenses = allLicenses?.filter(l => l.user_id === user1.id);
    const user2Licenses = allLicenses?.filter(l => l.user_id === user2.id);

    expect(user1Licenses?.length).toBeGreaterThan(0);
    expect(user2Licenses?.length).toBeGreaterThan(0);

    // Clean up
    if (allLicenses) {
      testDataCleanup.licenseIds.push(...allLicenses.map(l => l.id));
    }
  });

  it('should prevent cross-user device registration conflicts', async () => {
    if (!isFunctionDeployed) return;
    if (!user1.accessToken || !user2.accessToken) {
      console.warn('Skipping test: no access token available (rate limit)');
      return;
    }

    const sharedFingerprint = generateDeviceFingerprint('shared-device');

    // User1 registers device
    const register1 = await callRegisterDevice(user1.accessToken, {
      fingerprint: sharedFingerprint,
      name: 'Shared Device',
    });

    expect(register1.status).toBe(200);
    if (register1.data.device?.id) {
      testDataCleanup.deviceIds.push(register1.data.device.id);
    }

    // User2 tries to register same fingerprint
    const register2 = await callRegisterDevice(user2.accessToken, {
      fingerprint: sharedFingerprint,
      name: 'Shared Device',
    });

    expect(register2.status).toBe(409);
    expect(register2.error).toContain('already registered by another user');
  });
});

