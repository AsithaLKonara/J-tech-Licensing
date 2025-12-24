-- Seed Sample Data for Testing
-- This adds sample data for development and testing purposes
-- WARNING: Only run this in development/test environments, NOT in production

-- Note: We can't insert into auth.users directly, so sample users need to be created
-- through Supabase Auth first. This seed file creates sample licenses and data
-- that reference user IDs that should exist in auth.users.

-- Sample License Products and Plans
DO $$
DECLARE
    sample_user_id_1 UUID;
    sample_user_id_2 UUID;
    sample_user_id_3 UUID;
    license_id_1 UUID;
    license_id_2 UUID;
    license_id_3 UUID;
    license_id_4 UUID;
    device_id_1 UUID;
    device_id_2 UUID;
    device_id_3 UUID;
BEGIN
    -- Generate sample user IDs (these should match actual auth.users IDs in your Supabase project)
    -- For testing, you can get real user IDs from auth.users table:
    -- SELECT id FROM auth.users LIMIT 3;
    
    -- For now, we'll use placeholder UUIDs that need to be replaced with real user IDs
    -- Or you can create test users first and update these IDs
    sample_user_id_1 := '00000000-0000-0000-0000-000000000001'::UUID;
    sample_user_id_2 := '00000000-0000-0000-0000-000000000002'::UUID;
    sample_user_id_3 := '00000000-0000-0000-0000-000000000003'::UUID;
    
    -- Only insert if we have real user IDs (skip if using placeholder UUIDs)
    -- Check if at least one real user exists
    IF EXISTS (SELECT 1 FROM auth.users LIMIT 1) THEN
        -- Get first user from auth.users
        SELECT id INTO sample_user_id_1 FROM auth.users ORDER BY created_at LIMIT 1;
        
        -- Get additional users if available
        SELECT id INTO sample_user_id_2 FROM auth.users ORDER BY created_at OFFSET 1 LIMIT 1;
        IF sample_user_id_2 IS NULL THEN sample_user_id_2 := sample_user_id_1; END IF;
        
        SELECT id INTO sample_user_id_3 FROM auth.users ORDER BY created_at OFFSET 2 LIMIT 1;
        IF sample_user_id_3 IS NULL THEN sample_user_id_3 := sample_user_id_1; END IF;
        
        -- Generate UUIDs for licenses
        license_id_1 := gen_random_uuid();
        license_id_2 := gen_random_uuid();
        license_id_3 := gen_random_uuid();
        license_id_4 := gen_random_uuid();
        device_id_1 := gen_random_uuid();
        device_id_2 := gen_random_uuid();
        device_id_3 := gen_random_uuid();
        
        -- Sample Licenses
        INSERT INTO public.licenses (id, user_id, product, plan, features, device_fingerprint, issued_at, expires_at, nonce, signature, is_active)
        VALUES 
        -- Active Premium License (1 year, expires in future)
        (
            license_id_1,
            sample_user_id_1,
            'UploadBridge Pro',
            'premium',
            '{"cloud_sync": true, "unlimited_uploads": true, "priority_support": true, "advanced_features": true}'::jsonb,
            'DEVICE_FINGERPRINT_001',
            EXTRACT(EPOCH FROM NOW())::BIGINT - 86400, -- Issued 1 day ago
            EXTRACT(EPOCH FROM NOW())::BIGINT + (365 * 86400), -- Expires in 1 year
            gen_random_uuid()::TEXT,
            'sample_jwt_signature_1',
            true
        ),
        -- Active Monthly License (expires in 20 days)
        (
            license_id_2,
            sample_user_id_2,
            'UploadBridge Pro',
            'monthly',
            '{"cloud_sync": true, "unlimited_uploads": true}'::jsonb,
            'DEVICE_FINGERPRINT_002',
            EXTRACT(EPOCH FROM NOW())::BIGINT - (10 * 86400), -- Issued 10 days ago
            EXTRACT(EPOCH FROM NOW())::BIGINT + (20 * 86400), -- Expires in 20 days
            gen_random_uuid()::TEXT,
            'sample_jwt_signature_2',
            true
        ),
        -- Expired License (for testing expiration handling)
        (
            license_id_3,
            sample_user_id_1,
            'UploadBridge Pro',
            'yearly',
            '{"cloud_sync": true, "unlimited_uploads": true}'::jsonb,
            'DEVICE_FINGERPRINT_003',
            EXTRACT(EPOCH FROM NOW())::BIGINT - (400 * 86400), -- Issued 400 days ago
            EXTRACT(EPOCH FROM NOW())::BIGINT - (35 * 86400), -- Expired 35 days ago
            gen_random_uuid()::TEXT,
            'sample_jwt_signature_3',
            false -- Inactive
        ),
        -- Revoked License
        (
            license_id_4,
            sample_user_id_3,
            'UploadBridge Basic',
            'monthly',
            '{"basic_uploads": true}'::jsonb,
            'DEVICE_FINGERPRINT_004',
            EXTRACT(EPOCH FROM NOW())::BIGINT - (30 * 86400), -- Issued 30 days ago
            EXTRACT(EPOCH FROM NOW())::BIGINT + (335 * 86400), -- Would expire in ~1 year
            gen_random_uuid()::TEXT,
            'sample_jwt_signature_4',
            false -- Inactive (revoked)
        )
        ON CONFLICT (id) DO NOTHING;
        
        -- Sample Devices
        INSERT INTO public.devices (id, user_id, device_fingerprint, device_name, last_seen, created_at)
        VALUES 
        (
            device_id_1,
            sample_user_id_1,
            'DEVICE_FINGERPRINT_001',
            'Main Desktop - Windows',
            NOW() - INTERVAL '1 hour',
            NOW() - INTERVAL '365 days'
        ),
        (
            device_id_2,
            sample_user_id_2,
            'DEVICE_FINGERPRINT_002',
            'Laptop - macOS',
            NOW() - INTERVAL '2 days',
            NOW() - INTERVAL '30 days'
        ),
        (
            device_id_3,
            sample_user_id_1,
            'DEVICE_FINGERPRINT_003',
            'Secondary Device - Linux',
            NOW() - INTERVAL '7 days',
            NOW() - INTERVAL '180 days'
        )
        ON CONFLICT (id) DO NOTHING;
        
        -- Sample Revoked Licenses
        INSERT INTO public.revoked_licenses (license_id, user_id, revoked_at, reason)
        VALUES 
        (
            license_id_4,
            sample_user_id_3,
            NOW() - INTERVAL '5 days',
            'User requested cancellation'
        )
        ON CONFLICT (license_id) DO NOTHING;
        
        -- Sample Entitlements
        INSERT INTO public.entitlements (user_id, product, plan, features, status, expires_at)
        VALUES 
        (
            sample_user_id_1,
            'UploadBridge Pro',
            'yearly',
            '["cloud_sync", "unlimited_uploads", "priority_support", "advanced_features"]'::jsonb,
            'active',
            NOW() + INTERVAL '350 days'
        ),
        (
            sample_user_id_2,
            'UploadBridge Pro',
            'monthly',
            '["cloud_sync", "unlimited_uploads"]'::jsonb,
            'active',
            NOW() + INTERVAL '20 days'
        ),
        (
            sample_user_id_3,
            'UploadBridge Basic',
            'monthly',
            '["basic_uploads"]'::jsonb,
            'cancelled',
            NOW() - INTERVAL '5 days'
        )
        ON CONFLICT DO NOTHING;
        
        -- Sample Audit Logs
        INSERT INTO public.audit_logs (user_id, event_type, entity_id, details, created_at)
        VALUES 
        (
            sample_user_id_1,
            'license_issued',
            license_id_1,
            '{"product": "UploadBridge Pro", "plan": "premium"}'::jsonb,
            NOW() - INTERVAL '1 day'
        ),
        (
            sample_user_id_1,
            'license_validated',
            license_id_1,
            '{"device_fingerprint": "DEVICE_FINGERPRINT_001", "result": "valid"}'::jsonb,
            NOW() - INTERVAL '1 hour'
        ),
        (
            sample_user_id_2,
            'license_issued',
            license_id_2,
            '{"product": "UploadBridge Pro", "plan": "monthly"}'::jsonb,
            NOW() - INTERVAL '10 days'
        ),
        (
            sample_user_id_3,
            'license_revoked',
            license_id_4,
            '{"reason": "User requested cancellation"}'::jsonb,
            NOW() - INTERVAL '5 days'
        ),
        (
            sample_user_id_1,
            'device_registered',
            device_id_1,
            '{"device_name": "Main Desktop - Windows", "device_fingerprint": "DEVICE_FINGERPRINT_001"}'::jsonb,
            NOW() - INTERVAL '365 days'
        )
        ON CONFLICT DO NOTHING;
        
        RAISE NOTICE 'Sample data seeded successfully for users: %, %, %', sample_user_id_1, sample_user_id_2, sample_user_id_3;
    ELSE
        RAISE NOTICE 'No users found in auth.users. Please create users first, then run this seed script.';
        RAISE NOTICE 'Sample data will be skipped. Create test users through Supabase Auth, then re-run this migration.';
    END IF;
END $$;
