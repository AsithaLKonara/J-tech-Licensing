import { createTestUser, createTestLicense } from '../helpers/test-utils';
import { callValidateLicense, callIssueLicense, isEdgeFunctionAvailable } from '../helpers/edge-function-client';
import { generateDeviceFingerprint } from '../helpers/device-utils';
import { signLicense, generateKeyPair, createExpiredLicense } from '../helpers/crypto-utils';
import { cleanupAfterTest } from '../helpers/db-cleanup';
import { supabaseService, testDataCleanup } from '../setup';

describe('validate_license Edge Function', () => {
  let testUser: { id: string; email: string; accessToken: string };
  let deviceFingerprint: string;
  let validLicenseJWT: string;
  let licenseId: string;
  let isFunctionDeployed = true;

  beforeAll(async () => {
    // Check both functions since beforeEach uses issue_license
    const validateAvailable = await isEdgeFunctionAvailable('validate_license');
    const issueAvailable = await isEdgeFunctionAvailable('issue_license');
    isFunctionDeployed = validateAvailable && issueAvailable;
    if (!isFunctionDeployed) {
      console.warn('validate_license or issue_license edge function not deployed, skipping tests');
    }
  });

  beforeEach(async () => {
    if (!isFunctionDeployed) return;

    testUser = await createTestUser();
    deviceFingerprint = generateDeviceFingerprint();

    // Create a valid license
    const issueResponse = await callIssueLicense(testUser.accessToken, {
      product: 'Test Product',
      plan: 'premium',
      features: { cloud_sync: true },
      device_fingerprint: deviceFingerprint,
      expires_in_days: 365,
    });

    expect(issueResponse.status).toBe(200);
    validLicenseJWT = issueResponse.data.license;

    // Get license ID from database
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

  it('should validate a valid license', async () => {
    if (!isFunctionDeployed) return;
    
    const response = await callValidateLicense({
      license_jwt: validLicenseJWT,
      device_fingerprint: deviceFingerprint,
    });

    expect(response.status).toBe(200);
    expect(response.data.message).toBe('License is valid');
    expect(response.data.license).toBeDefined();
  });

  it('should reject expired license', async () => {
    if (!isFunctionDeployed) return;
    
    // Create an expired license using crypto utils
    const keyPair = await generateKeyPair();
    const expiredPayload = {
      license_id: licenseId,
      user_id: testUser.id,
      product: 'Test Product',
      plan: 'premium',
      features: { cloud_sync: true },
      device_fingerprint: deviceFingerprint,
      issued_at: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
      expires_at: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      nonce: crypto.randomUUID(),
    };

    const expiredJWT = await createExpiredLicense(expiredPayload, keyPair.privateKey);

    const response = await callValidateLicense({
      license_jwt: expiredJWT,
      device_fingerprint: deviceFingerprint,
    });

    expect(response.status).toBe(403);
    expect(response.error).toContain('expired');
  });

  it('should reject license with wrong device fingerprint', async () => {
    if (!isFunctionDeployed) return;
    
    const wrongFingerprint = generateDeviceFingerprint('different-device');

    const response = await callValidateLicense({
      license_jwt: validLicenseJWT,
      device_fingerprint: wrongFingerprint,
    });

    expect(response.status).toBe(403);
    expect(response.error).toContain('not bound to this device');
  });

  it('should reject revoked license', async () => {
    if (!isFunctionDeployed) return;
    
    // Revoke the license
    await supabaseService.from('revoked_licenses').insert({
      license_id: licenseId,
      user_id: testUser.id,
      reason: 'Test revocation',
    });

    const response = await callValidateLicense({
      license_jwt: validLicenseJWT,
      device_fingerprint: deviceFingerprint,
    });

    expect(response.status).toBe(403);
    expect(response.error).toContain('revoked');
  });

  it('should reject license with invalid signature', async () => {
    if (!isFunctionDeployed) return;
    
    // Create a tampered JWT
    const tamperedJWT = validLicenseJWT.substring(0, validLicenseJWT.length - 10) + 'tampered';

    const response = await callValidateLicense({
      license_jwt: tamperedJWT,
      device_fingerprint: deviceFingerprint,
    });

    expect(response.status).toBe(403);
    expect(response.error).toContain('Invalid license signature');
  });

  it('should reject inactive license', async () => {
    if (!isFunctionDeployed) return;
    
    // Mark license as inactive
    await supabaseService
      .from('licenses')
      .update({ is_active: false })
      .eq('id', licenseId);

    const response = await callValidateLicense({
      license_jwt: validLicenseJWT,
      device_fingerprint: deviceFingerprint,
    });

    expect(response.status).toBe(403);
    expect(response.error).toContain('inactive');
  });

  it('should update device last_seen on validation', async () => {
    if (!isFunctionDeployed) return;
    
    // Register device first
    const { data: device } = await supabaseService
      .from('devices')
      .insert({
        user_id: testUser.id,
        fingerprint: deviceFingerprint,
        device_name: 'Test Device',
      })
      .select()
      .single();

    if (device) {
      testDataCleanup.deviceIds.push(device.id);
    }

    const initialLastSeen = device?.last_seen;

    // Wait a bit to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 1000));

    const response = await callValidateLicense({
      license_jwt: validLicenseJWT,
      device_fingerprint: deviceFingerprint,
    });

    expect(response.status).toBe(200);

    // Check that last_seen was updated
    const { data: updatedDevice } = await supabaseService
      .from('devices')
      .select('last_seen')
      .eq('fingerprint', deviceFingerprint)
      .single();

    expect(updatedDevice).toBeDefined();
    if (initialLastSeen && updatedDevice) {
      expect(new Date(updatedDevice.last_seen).getTime()).toBeGreaterThan(
        new Date(initialLastSeen).getTime()
      );
    }
  });

  it('should create audit log entry on validation', async () => {
    if (!isFunctionDeployed) return;
    
    const response = await callValidateLicense({
      license_jwt: validLicenseJWT,
      device_fingerprint: deviceFingerprint,
    }, testUser.accessToken);

    expect(response.status).toBe(200);

    // Check audit log
    const { data: auditLogs } = await supabaseService
      .from('audit_logs')
      .select('*')
      .eq('event_type', 'license_validation')
      .eq('user_id', testUser.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    expect(auditLogs).toBeDefined();
    expect(auditLogs?.event_type).toBe('license_validation');
    expect(auditLogs?.details).toBeDefined();
  });

  it('should reject request with missing license_jwt', async () => {
    if (!isFunctionDeployed) return;
    
    const response = await callValidateLicense({
      device_fingerprint: deviceFingerprint,
    } as any);

    expect(response.status).toBe(400);
    expect(response.error).toContain('Missing required fields');
  });

  it('should reject request with missing device_fingerprint', async () => {
    if (!isFunctionDeployed) return;
    
    const response = await callValidateLicense({
      license_jwt: validLicenseJWT,
    } as any);

    expect(response.status).toBe(400);
    expect(response.error).toContain('Missing required fields');
  });
});

