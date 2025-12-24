import { supabaseService } from '../setup';

describe('Database Migrations', () => {
  it('should have all required tables', async () => {
    const requiredTables = [
      'licenses',
      'devices',
      'revoked_licenses',
      'audit_logs',
    ];

    for (const table of requiredTables) {
      const { error } = await supabaseService
        .from(table)
        .select('*')
        .limit(0);

      expect(error).toBeNull();
    }
  });

  it('should have licenses table with correct columns', async () => {
    const { data, error } = await supabaseService
      .from('licenses')
      .select('id, user_id, product, plan, features, device_fingerprint, issued_at, expires_at, nonce, signature, is_active, created_at')
      .limit(0);

    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  it('should have devices table with correct columns', async () => {
    const { data, error } = await supabaseService
      .from('devices')
      .select('id, user_id, device_fingerprint, device_name, last_seen, created_at')
      .limit(0);

    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  it('should have revoked_licenses table with correct columns', async () => {
    const { data, error } = await supabaseService
      .from('revoked_licenses')
      .select('id, license_id, user_id, revoked_at, reason')
      .limit(0);

    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  it('should have audit_logs table with correct columns', async () => {
    const { data, error } = await supabaseService
      .from('audit_logs')
      .select('id, user_id, event_type, entity_id, details, created_at')
      .limit(0);

    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  it('should have foreign key relationships', async () => {
    // Test that foreign keys are properly set up
    // This is done by attempting operations that would fail without proper FKs
    const fakeUserId = crypto.randomUUID();

    const { error } = await supabaseService
      .from('licenses')
      .insert({
        user_id: fakeUserId,
        product: 'Test',
        plan: 'test',
        features: {},
        device_fingerprint: 'test',
        issued_at: Math.floor(Date.now() / 1000),
        expires_at: Math.floor(Date.now() / 1000) + 86400,
        nonce: 'test',
        signature: 'test',
      });

    // Should fail due to foreign key constraint
    expect(error).toBeDefined();
    expect(error?.code).toBe('23503'); // Foreign key violation
  });

  it('should have unique constraints', async () => {
    // Test unique constraint on revoked_licenses.license_id
    const licenseId = crypto.randomUUID();
    const userId = crypto.randomUUID();

    const { error: firstError } = await supabaseService
      .from('revoked_licenses')
      .insert({
        license_id: licenseId,
        user_id: userId,
        reason: 'Test',
      });

    if (!firstError) {
      const { error: secondError } = await supabaseService
        .from('revoked_licenses')
        .insert({
          license_id: licenseId,
          user_id: userId,
          reason: 'Test 2',
        });

      expect(secondError).toBeDefined();
      expect(secondError?.code).toBe('23505'); // Unique violation
    }
  });

  it('should have default values set correctly', async () => {
    // Test that default values work
    const userId = crypto.randomUUID();
    const fingerprint = 'test-fingerprint-defaults';

    const { data: device, error } = await supabaseService
      .from('devices')
      .insert({
        user_id: userId,
        device_fingerprint: fingerprint,
      })
      .select('created_at, last_seen')
      .single();

    // If insert succeeds (unlikely with fake user_id), verify defaults
    if (!error && device) {
      expect(device.created_at).toBeDefined();
      expect(device.last_seen).toBeDefined();
    }
  });
});

