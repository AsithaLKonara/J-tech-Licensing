import { generateDeviceFingerprint, isValidFingerprint } from '../helpers/device-utils';

describe('Device Fingerprint Generation', () => {
  it('should generate consistent fingerprints', () => {
    const seed = 'test-device-seed';
    const fingerprint1 = generateDeviceFingerprint(seed);
    const fingerprint2 = generateDeviceFingerprint(seed);

    expect(fingerprint1).toBe(fingerprint2);
    expect(fingerprint1).toBeDefined();
    expect(fingerprint1.length).toBe(64); // SHA256 hex string
  });

  it('should generate unique fingerprints for different seeds', () => {
    const fingerprint1 = generateDeviceFingerprint('device1');
    const fingerprint2 = generateDeviceFingerprint('device2');

    expect(fingerprint1).not.toBe(fingerprint2);
    expect(fingerprint1.length).toBe(64);
    expect(fingerprint2.length).toBe(64);
  });

  it('should generate valid hex fingerprints', () => {
    const fingerprint = generateDeviceFingerprint();

    expect(isValidFingerprint(fingerprint)).toBe(true);
    expect(/^[a-f0-9]{64}$/i.test(fingerprint)).toBe(true);
  });

  it('should generate fingerprints with correct length', () => {
    const fingerprint = generateDeviceFingerprint();

    expect(fingerprint.length).toBe(64); // SHA256 produces 64 hex characters
  });

  it('should generate stable fingerprints across calls', () => {
    const seed = 'stable-device';
    const fingerprints: string[] = [];

    for (let i = 0; i < 10; i++) {
      fingerprints.push(generateDeviceFingerprint(seed));
    }

    // All should be identical
    const unique = new Set(fingerprints);
    expect(unique.size).toBe(1);
  });

  it('should handle empty seed', () => {
    const fingerprint = generateDeviceFingerprint('');

    expect(fingerprint).toBeDefined();
    expect(fingerprint.length).toBe(64);
    expect(isValidFingerprint(fingerprint)).toBe(true);
  });

  it('should handle special characters in seed', () => {
    const specialSeeds = [
      'device-with-special-chars-!@#$%^&*()',
      'device-with-unicode-测试',
      'device-with-spaces and tabs',
    ];

    specialSeeds.forEach(seed => {
      const fingerprint = generateDeviceFingerprint(seed);
      expect(fingerprint).toBeDefined();
      expect(isValidFingerprint(fingerprint)).toBe(true);
    });
  });
});

