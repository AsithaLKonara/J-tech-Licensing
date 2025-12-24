import * as jose from 'jose';

export interface KeyPair {
  privateKey: jose.KeyLike;
  publicKey: jose.KeyLike;
  privateKeyJWK: jose.JWK;
  publicKeyJWK: jose.JWK;
}

/**
 * Generate a test key pair for JWT signing (ES256 algorithm)
 */
export async function generateKeyPair(): Promise<KeyPair> {
  const { privateKey, publicKey } = await jose.generateKeyPair('ES256');
  
  const privateKeyJWK = await jose.exportJWK(privateKey);
  const publicKeyJWK = await jose.exportJWK(publicKey);

  return {
    privateKey,
    publicKey,
    privateKeyJWK,
    publicKeyJWK,
  };
}

/**
 * Sign a license payload and return a JWT
 */
export async function signLicense(
  payload: Record<string, any>,
  privateKey: jose.KeyLike,
  expiresAt: number
): Promise<string> {
  const jwt = await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'ES256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(privateKey);

  return jwt;
}

/**
 * Verify a JWT signature
 */
export async function verifyLicense(
  jwt: string,
  publicKey: jose.KeyLike
): Promise<jose.JWTPayload> {
  const { payload } = await jose.jwtVerify(jwt, publicKey);
  return payload;
}

/**
 * Create a tampered JWT (for security testing)
 */
export function tamperJWT(jwt: string): string {
  const parts = jwt.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }
  
  // Tamper with the payload
  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
  payload.license_id = 'tampered-license-id';
  
  const tamperedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${parts[0]}.${tamperedPayload}.${parts[2]}`;
}

/**
 * Create an expired JWT (for expiration testing)
 */
export async function createExpiredLicense(
  payload: Record<string, any>,
  privateKey: jose.KeyLike
): Promise<string> {
  const expiredAt = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
  return signLicense(payload, privateKey, expiredAt);
}

