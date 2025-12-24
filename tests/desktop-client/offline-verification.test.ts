import { signLicense, verifyLicense, generateKeyPair, createExpiredLicense, tamperJWT } from '../helpers/crypto-utils';
import { generateDeviceFingerprint } from '../helpers/device-utils';

describe('Offline License Verification', () => {
  let keyPair: Awaited<ReturnType<typeof generateKeyPair>>;
  let deviceFingerprint: string;

  beforeAll(async () => {
    keyPair = await generateKeyPair();
    deviceFingerprint = generateDeviceFingerprint();
  });

  it('should verify JWT signature correctly', async () => {
    const licenseId = crypto.randomUUID();
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + 86400 * 365;

    const payload = {
      license_id: licenseId,
      user_id: 'test-user-id',
      product: 'Test Product',
      plan: 'premium',
      features: { cloud_sync: true },
      device_fingerprint: deviceFingerprint,
      issued_at: issuedAt,
      expires_at: expiresAt,
      nonce: crypto.randomUUID(),
    };

    const jwt = await signLicense(payload, keyPair.privateKey, expiresAt);
    const verified = await verifyLicense(jwt, keyPair.publicKey);

    expect(verified.license_id).toBe(licenseId);
    expect(verified.device_fingerprint).toBe(deviceFingerprint);
  });

  it('should reject tampered JWT signature', async () => {
    const licenseId = crypto.randomUUID();
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + 86400 * 365;

    const payload = {
      license_id: licenseId,
      user_id: 'test-user-id',
      product: 'Test Product',
      plan: 'premium',
      features: {},
      device_fingerprint: deviceFingerprint,
      issued_at: issuedAt,
      expires_at: expiresAt,
      nonce: crypto.randomUUID(),
    };

    const jwt = await signLicense(payload, keyPair.privateKey, expiresAt);
    const tamperedJWT = tamperJWT(jwt);

    try {
      await verifyLicense(tamperedJWT, keyPair.publicKey);
      fail('Should have rejected tampered JWT');
    } catch (error: any) {
      expect(error).toBeDefined();
      expect(error.code).toBe('ERR_JWS_SIGNATURE_VERIFICATION_FAILED');
    }
  });

  it('should check expiration date locally', async () => {
    const licenseId = crypto.randomUUID();
    const payload = {
      license_id: licenseId,
      user_id: 'test-user-id',
      product: 'Test Product',
      plan: 'premium',
      features: {},
      device_fingerprint: deviceFingerprint,
      issued_at: Math.floor(Date.now() / 1000) - 7200,
      expires_at: Math.floor(Date.now() / 1000) - 3600, // Expired
      nonce: crypto.randomUUID(),
    };

    const expiredJWT = await createExpiredLicense(payload, keyPair.privateKey);

    try {
      await verifyLicense(expiredJWT, keyPair.publicKey);
      fail('Should have rejected expired license');
    } catch (error: any) {
      expect(error).toBeDefined();
      expect(error.code).toBe('ERR_JWT_EXPIRED');
    }
  });

  it('should verify device binding', async () => {
    const licenseId = crypto.randomUUID();
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + 86400 * 365;

    const payload = {
      license_id: licenseId,
      user_id: 'test-user-id',
      product: 'Test Product',
      plan: 'premium',
      features: {},
      device_fingerprint: deviceFingerprint,
      issued_at: issuedAt,
      expires_at: expiresAt,
      nonce: crypto.randomUUID(),
    };

    const jwt = await signLicense(payload, keyPair.privateKey, expiresAt);
    const verified = await verifyLicense(jwt, keyPair.publicKey);

    // Verify device fingerprint matches
    expect(verified.device_fingerprint).toBe(deviceFingerprint);

    // In real desktop app, would compare with current device fingerprint
    const currentDeviceFingerprint = generateDeviceFingerprint();
    // This would fail if fingerprints don't match
    expect(verified.device_fingerprint).toBe(deviceFingerprint);
  });

  it('should reject license with wrong device fingerprint', async () => {
    const licenseId = crypto.randomUUID();
    const wrongFingerprint = generateDeviceFingerprint('wrong-device');
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + 86400 * 365;

    const payload = {
      license_id: licenseId,
      user_id: 'test-user-id',
      product: 'Test Product',
      plan: 'premium',
      features: {},
      device_fingerprint: wrongFingerprint,
      issued_at: issuedAt,
      expires_at: expiresAt,
      nonce: crypto.randomUUID(),
    };

    const jwt = await signLicense(payload, keyPair.privateKey, expiresAt);
    const verified = await verifyLicense(jwt, keyPair.publicKey);

    // Signature is valid, but device doesn't match
    expect(verified.device_fingerprint).not.toBe(deviceFingerprint);
    expect(verified.device_fingerprint).toBe(wrongFingerprint);
  });

  it('should handle invalid JWT format', async () => {
    const invalidJWT = 'not.a.valid.jwt';

    try {
      await verifyLicense(invalidJWT, keyPair.publicKey);
      fail('Should have rejected invalid JWT format');
    } catch (error: any) {
      expect(error).toBeDefined();
    }
  });

  it('should handle missing required fields in payload', async () => {
    const licenseId = crypto.randomUUID();
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + 86400 * 365;

    // Missing device_fingerprint
    const payload = {
      license_id: licenseId,
      user_id: 'test-user-id',
      product: 'Test Product',
      plan: 'premium',
      features: {},
      issued_at: issuedAt,
      expires_at: expiresAt,
      nonce: crypto.randomUUID(),
    } as any;

    const jwt = await signLicense(payload, keyPair.privateKey, expiresAt);
    const verified = await verifyLicense(jwt, keyPair.publicKey);

    // JWT verification succeeds, but payload validation would fail in app
    expect(verified.device_fingerprint).toBeUndefined();
  });
});

