import { createTestUser } from '../helpers/test-utils';
import { callRegisterDevice, isEdgeFunctionAvailable } from '../helpers/edge-function-client';
import { generateDeviceFingerprint } from '../helpers/device-utils';
import { cleanupAfterTest } from '../helpers/db-cleanup';
import { supabaseService, testDataCleanup } from '../setup';

describe('register_device Edge Function', () => {
  let testUser: { id: string; email: string; accessToken: string };
  let deviceFingerprint: string;
  let isFunctionDeployed = true;

  beforeAll(async () => {
    isFunctionDeployed = await isEdgeFunctionAvailable('register_device');
    if (!isFunctionDeployed) {
      console.warn('register_device edge function not deployed, skipping tests');
    }
  });

  beforeEach(async () => {
    testUser = await createTestUser();
    deviceFingerprint = generateDeviceFingerprint();
  });

  afterEach(async () => {
    await cleanupAfterTest({
      userIds: [testUser.id],
      deviceIds: testDataCleanup.deviceIds,
    });
  });

  it('should successfully register a device', async () => {
    if (!isFunctionDeployed) return;
    
    const response = await callRegisterDevice(testUser.accessToken, {
      fingerprint: deviceFingerprint,
      name: 'Test Device',
    });

    expect(response.status).toBe(200);
    expect(response.data.device).toBeDefined();
    expect(response.data.device.fingerprint).toBe(deviceFingerprint);
    expect(response.data.device.device_name).toBe('Test Device');
    expect(response.data.device.user_id).toBe(testUser.id);

    if (response.data.device.id) {
      testDataCleanup.deviceIds.push(response.data.device.id);
    }
  });

  it('should handle duplicate fingerprint for same user', async () => {
    if (!isFunctionDeployed) return;
    
    // Register device first time
    const firstResponse = await callRegisterDevice(testUser.accessToken, {
      fingerprint: deviceFingerprint,
      name: 'Test Device',
    });

    expect(firstResponse.status).toBe(200);
    const deviceId = firstResponse.data.device.id;
    if (deviceId) {
      testDataCleanup.deviceIds.push(deviceId);
    }

    // Try to register same fingerprint again
    const secondResponse = await callRegisterDevice(testUser.accessToken, {
      fingerprint: deviceFingerprint,
      name: 'Updated Device Name',
    });

    expect(secondResponse.status).toBe(200);
    expect(secondResponse.data.message).toContain('already registered');
    expect(secondResponse.data.device.fingerprint).toBe(deviceFingerprint);
  });

  it('should reject duplicate fingerprint from different user', async () => {
    if (!isFunctionDeployed) return;
    
    // Register device for first user
    const firstResponse = await callRegisterDevice(testUser.accessToken, {
      fingerprint: deviceFingerprint,
      name: 'First User Device',
    });

    expect(firstResponse.status).toBe(200);
    if (firstResponse.data.device.id) {
      testDataCleanup.deviceIds.push(firstResponse.data.device.id);
    }

    // Try to register same fingerprint with different user
    const otherUser = await createTestUser();
    const secondResponse = await callRegisterDevice(otherUser.accessToken, {
      fingerprint: deviceFingerprint,
      name: 'Second User Device',
    });

    expect(secondResponse.status).toBe(409);
    expect(secondResponse.error).toContain('already registered by another user');

    // Clean up other user
    testDataCleanup.userIds.push(otherUser.id);
  });

  it('should reject request with missing fingerprint', async () => {
    if (!isFunctionDeployed) return;
    
    const response = await callRegisterDevice(testUser.accessToken, {
      name: 'Test Device',
    } as any);

    expect(response.status).toBe(400);
    expect(response.error).toContain('Missing device fingerprint');
  });

  it('should reject unauthorized requests without access token', async () => {
    if (!isFunctionDeployed) return;
    
    const response = await callRegisterDevice('' as any, {
      fingerprint: deviceFingerprint,
      name: 'Test Device',
    });

    expect(response.status).toBe(401);
    expect(response.error).toContain('Unauthorized');
  });

  it('should register device without name', async () => {
    if (!isFunctionDeployed) return;
    
    const response = await callRegisterDevice(testUser.accessToken, {
      fingerprint: deviceFingerprint,
    });

    expect(response.status).toBe(200);
    expect(response.data.device).toBeDefined();
    expect(response.data.device.fingerprint).toBe(deviceFingerprint);
    expect(response.data.device.device_name).toBeNull();

    if (response.data.device.id) {
      testDataCleanup.deviceIds.push(response.data.device.id);
    }
  });

  it('should set last_seen timestamp on registration', async () => {
    if (!isFunctionDeployed) return;
    
    const response = await callRegisterDevice(testUser.accessToken, {
      fingerprint: deviceFingerprint,
      name: 'Test Device',
    });

    expect(response.status).toBe(200);
    expect(response.data.device.last_seen).toBeDefined();

    const { data: device } = await supabaseService
      .from('devices')
      .select('last_seen')
      .eq('fingerprint', deviceFingerprint)
      .single();

    expect(device).toBeDefined();
    expect(device?.last_seen).toBeDefined();
    expect(new Date(device!.last_seen).getTime()).toBeLessThanOrEqual(Date.now());

    if (response.data.device.id) {
      testDataCleanup.deviceIds.push(response.data.device.id);
    }
  });

  it('should allow multiple devices per user', async () => {
    if (!isFunctionDeployed) return;
    
    const fingerprint1 = generateDeviceFingerprint('device1');
    const fingerprint2 = generateDeviceFingerprint('device2');

    const response1 = await callRegisterDevice(testUser.accessToken, {
      fingerprint: fingerprint1,
      name: 'Device 1',
    });

    const response2 = await callRegisterDevice(testUser.accessToken, {
      fingerprint: fingerprint2,
      name: 'Device 2',
    });

    expect(response1.status).toBe(200);
    expect(response2.status).toBe(200);

    // Verify both devices exist
    const { data: devices } = await supabaseService
      .from('devices')
      .select('*')
      .eq('user_id', testUser.id);

    expect(devices).toBeDefined();
    expect(devices?.length).toBe(2);

    if (response1.data.device.id) {
      testDataCleanup.deviceIds.push(response1.data.device.id);
    }
    if (response2.data.device.id) {
      testDataCleanup.deviceIds.push(response2.data.device.id);
    }
  });
});

