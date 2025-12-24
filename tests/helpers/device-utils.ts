import { createHash } from 'crypto';

/**
 * Generate a consistent device fingerprint for testing
 */
export function generateDeviceFingerprint(seed?: string): string {
  const baseSeed = seed || `test-device-${Date.now()}-${Math.random()}`;
  return createHash('sha256').update(baseSeed).digest('hex');
}

/**
 * Generate multiple unique device fingerprints
 */
export function generateDeviceFingerprints(count: number): string[] {
  const fingerprints: string[] = [];
  for (let i = 0; i < count; i++) {
    fingerprints.push(generateDeviceFingerprint(`device-${i}`));
  }
  return fingerprints;
}

/**
 * Verify that a fingerprint is valid (64 character hex string)
 */
export function isValidFingerprint(fingerprint: string): boolean {
  return /^[a-f0-9]{64}$/i.test(fingerprint);
}

