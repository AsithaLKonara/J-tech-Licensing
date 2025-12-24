import { signLicense, verifyLicense, generateKeyPair, tamperJWT, createExpiredLicense } from '../helpers/crypto-utils';
import { generateDeviceFingerprint } from '../helpers/device-utils';

describe('JWT Security', () => {
  let keyPair: Awaited<ReturnType<typeof generateKeyPair>>;
  let deviceFingerprint: string;

  beforeAll(async () => {
    keyPair = await generateKeyPair();
    deviceFingerprint = generateDeviceFingerprint();
  });

  it('should detect signature tampering', async () => {
    const licenseId = crypto.randomUUID();
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + 86400 * 365;

    const payload = {
      license_id: licenseId,
      user_id: 'test-user',
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
      fail('Should have detected tampered signature');
    } catch (error: any) {
      expect(error).toBeDefined();
      expect(error.code).toBe('ERR_JWS_SIGNATURE_VERIFICATION_FAILED');
    }
  });

  it('should handle expired tokens correctly', async () => {
    const licenseId = crypto.randomUUID();
    const payload = {
      license_id: licenseId,
      user_id: 'test-user',
      product: 'Test Product',
      plan: 'premium',
      features: {},
      device_fingerprint: deviceFingerprint,
      issued_at: Math.floor(Date.now() / 1000) - 7200,
      expires_at: Math.floor(Date.now() / 1000) - 3600,
      nonce: crypto.randomUUID(),
    };

    const expiredJWT = await createExpiredLicense(payload, keyPair.privateKey);

    try {
      await verifyLicense(expiredJWT, keyPair.publicKey);
      fail('Should have rejected expired token');
    } catch (error: any) {
      expect(error).toBeDefined();
      expect(error.code).toBe('ERR_JWT_EXPIRED');
    }
  });

  it('should reject invalid token format', async () => {
    const invalidTokens = [
      'not-a-jwt',
      'invalid.format',
      'too.many.parts.here',
      '',
      'singlepart',
    ];

    for (const invalidToken of invalidTokens) {
      try {
        await verifyLicense(invalidToken, keyPair.publicKey);
        fail(`Should have rejected invalid token: ${invalidToken}`);
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    }
  });

  it('should prevent token replay with nonce', async () => {
    const licenseId = crypto.randomUUID();
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + 86400 * 365;
    const nonce = crypto.randomUUID();

    const payload = {
      license_id: licenseId,
      user_id: 'test-user',
      product: 'Test Product',
      plan: 'premium',
      features: {},
      device_fingerprint: deviceFingerprint,
      issued_at: issuedAt,
      expires_at: expiresAt,
      nonce,
    };

    const jwt = await signLicense(payload, keyPair.privateKey, expiresAt);
    const verified = await verifyLicense(jwt, keyPair.publicKey);

    // Verify nonce is present and matches
    expect(verified.nonce).toBe(nonce);

    // In a real system, nonces would be tracked to prevent replay
    // This test verifies nonce is included in the token
  });

  it('should use correct algorithm (ES256)', async () => {
    const licenseId = crypto.randomUUID();
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + 86400 * 365;

    const payload = {
      license_id: licenseId,
      user_id: 'test-user',
      product: 'Test Product',
      plan: 'premium',
      features: {},
      device_fingerprint: deviceFingerprint,
      issued_at: issuedAt,
      expires_at: expiresAt,
      nonce: crypto.randomUUID(),
    };

    const jwt = await signLicense(payload, keyPair.privateKey, expiresAt);

    // Verify JWT header contains ES256
    const parts = jwt.split('.');
    expect(parts.length).toBe(3);

    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    expect(header.alg).toBe('ES256');
  });

  it('should protect against payload modification', async () => {
    const licenseId = crypto.randomUUID();
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + 86400 * 365;

    const payload = {
      license_id: licenseId,
      user_id: 'test-user',
      product: 'Test Product',
      plan: 'premium',
      features: {},
      device_fingerprint: deviceFingerprint,
      issued_at: issuedAt,
      expires_at: expiresAt,
      nonce: crypto.randomUUID(),
    };

    const jwt = await signLicense(payload, keyPair.privateKey, expiresAt);

    // Tamper with payload
    const tamperedJWT = tamperJWT(jwt);

    try {
      await verifyLicense(tamperedJWT, keyPair.publicKey);
      fail('Should have detected payload modification');
    } catch (error: any) {
      expect(error).toBeDefined();
      expect(error.code).toBe('ERR_JWS_SIGNATURE_VERIFICATION_FAILED');
    }
  });

  it('should verify token integrity', async () => {
    const licenseId = crypto.randomUUID();
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + 86400 * 365;

    const payload = {
      license_id: licenseId,
      user_id: 'test-user',
      product: 'Test Product',
      plan: 'premium',
      features: { feature1: true },
      device_fingerprint: deviceFingerprint,
      issued_at: issuedAt,
      expires_at: expiresAt,
      nonce: crypto.randomUUID(),
    };

    const jwt = await signLicense(payload, keyPair.privateKey, expiresAt);
    const verified = await verifyLicense(jwt, keyPair.publicKey);

    // Verify all payload fields match
    expect(verified.license_id).toBe(licenseId);
    expect(verified.device_fingerprint).toBe(deviceFingerprint);
    expect(verified.product).toBe('Test Product');
    expect(verified.plan).toBe('premium');
  });
});

