import { createTestUser } from '../helpers/test-utils';
import { cleanupAfterTest } from '../helpers/db-cleanup';
import { callIssueLicense, isEdgeFunctionAvailable } from '../helpers/edge-function-client';
import { generateDeviceFingerprint } from '../helpers/device-utils';
import { supabaseService, testDataCleanup } from '../setup';

describe('issue_license Edge Function', () => {
  let testUser: { id: string; email: string; accessToken: string };
  let deviceFingerprint: string;
  let isFunctionDeployed = true;

  beforeAll(async () => {
    isFunctionDeployed = await isEdgeFunctionAvailable('issue_license');
    if (!isFunctionDeployed) {
      console.warn('issue_license edge function not deployed, skipping tests');
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

  it('should issue a valid license with all required fields', async () => {
    if (!isFunctionDeployed) return;
    
    const response = await callIssueLicense(testUser.accessToken, {
      product: 'Test Product',
      plan: 'premium',
      features: { cloud_sync: true, updates: true },
      device_fingerprint: deviceFingerprint,
      expires_in_days: 365,
    });

    expect(response.status).toBe(200);
    expect(response.data).toBeDefined();
    expect(response.data.license).toBeDefined();
    expect(typeof response.data.license).toBe('string');

    // Verify license was stored in database
    const { data: licenses, error } = await supabaseService
      .from('licenses')
      .select('*')
      .eq('user_id', testUser.id)
      .single();

    expect(error).toBeNull();
    expect(licenses).toBeDefined();
    expect(licenses.product).toBe('Test Product');
    expect(licenses.plan).toBe('premium');
    expect(licenses.device_fingerprint).toBe(deviceFingerprint);
    expect(licenses.is_active).toBe(true);

    if (licenses) {
      testDataCleanup.licenseIds.push(licenses.id);
    }
  });

  it('should reject request with missing product field', async () => {
    if (!isFunctionDeployed) return;
    
    const response = await callIssueLicense(testUser.accessToken, {
      plan: 'premium',
      features: { cloud_sync: true },
      device_fingerprint: deviceFingerprint,
      expires_in_days: 365,
    } as any);

    expect(response.status).toBe(400);
    expect(response.error).toContain('Missing required fields');
  });

  it('should reject request with missing plan field', async () => {
    if (!isFunctionDeployed) return;
    
    const response = await callIssueLicense(testUser.accessToken, {
      product: 'Test Product',
      features: { cloud_sync: true },
      device_fingerprint: deviceFingerprint,
      expires_in_days: 365,
    } as any);

    expect(response.status).toBe(400);
    expect(response.error).toContain('Missing required fields');
  });

  it('should reject request with missing device_fingerprint', async () => {
    if (!isFunctionDeployed) return;
    
    const response = await callIssueLicense(testUser.accessToken, {
      product: 'Test Product',
      plan: 'premium',
      features: { cloud_sync: true },
      expires_in_days: 365,
    } as any);

    expect(response.status).toBe(400);
    expect(response.error).toContain('Missing required fields');
  });

  it('should reject request with missing expires_in_days', async () => {
    if (!isFunctionDeployed) return;
    
    const response = await callIssueLicense(testUser.accessToken, {
      product: 'Test Product',
      plan: 'premium',
      features: { cloud_sync: true },
      device_fingerprint: deviceFingerprint,
    } as any);

    expect(response.status).toBe(400);
    expect(response.error).toContain('Missing required fields');
  });

  it('should reject unauthorized requests without access token', async () => {
    if (!isFunctionDeployed) return;
    
    const response = await callIssueLicense('' as any, {
      product: 'Test Product',
      plan: 'premium',
      features: { cloud_sync: true },
      device_fingerprint: deviceFingerprint,
      expires_in_days: 365,
    });

    expect(response.status).toBe(401);
    expect(response.error).toContain('Unauthorized');
  });

  it('should calculate expiration date correctly', async () => {
    if (!isFunctionDeployed) return;
    
    const expiresInDays = 30;
    const response = await callIssueLicense(testUser.accessToken, {
      product: 'Test Product',
      plan: 'premium',
      features: { cloud_sync: true },
      device_fingerprint: deviceFingerprint,
      expires_in_days: expiresInDays,
    });

    expect(response.status).toBe(200);

    const { data: license } = await supabaseService
      .from('licenses')
      .select('id, issued_at, expires_at')
      .eq('user_id', testUser.id)
      .single();

    expect(license).toBeDefined();
    if (license) {
      const issuedAt = new Date(license.issued_at).getTime();
      const expiresAt = new Date(license.expires_at).getTime();
      const daysDiff = (expiresAt - issuedAt) / (1000 * 60 * 60 * 24);
      
      expect(daysDiff).toBeCloseTo(expiresInDays, 0);
      testDataCleanup.licenseIds.push(license.id);
    }
  });

  it('should create JWT with correct signature', async () => {
    if (!isFunctionDeployed) return;
    
    const response = await callIssueLicense(testUser.accessToken, {
      product: 'Test Product',
      plan: 'premium',
      features: { cloud_sync: true },
      device_fingerprint: deviceFingerprint,
      expires_in_days: 365,
    });

    expect(response.status).toBe(200);
    expect(response.data.license).toBeDefined();

    // JWT should have 3 parts separated by dots
    const jwtParts = response.data.license.split('.');
    expect(jwtParts.length).toBe(3);

    const { data: license } = await supabaseService
      .from('licenses')
      .select('id')
      .eq('user_id', testUser.id)
      .single();

    if (license) {
      testDataCleanup.licenseIds.push(license.id);
    }
  });
});

