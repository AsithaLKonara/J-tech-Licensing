-- Alternative Seed File: Manual Insert with Real User IDs
-- Use this file if you want to manually specify user IDs
-- Replace the placeholder UUIDs with actual user IDs from auth.users

-- Step 1: Get your user IDs first:
-- SELECT id, email FROM auth.users;

-- Step 2: Replace USER_ID_1, USER_ID_2, USER_ID_3 below with actual IDs

-- Sample Licenses (replace user IDs with real ones)
/*
INSERT INTO public.licenses (id, user_id, product, plan, features, device_fingerprint, issued_at, expires_at, nonce, signature, is_active)
VALUES 
-- Active Premium License
(
    gen_random_uuid(),
    'USER_ID_1_HERE', -- Replace with actual user ID
    'UploadBridge Pro',
    'premium',
    '{"cloud_sync": true, "unlimited_uploads": true, "priority_support": true}'::jsonb,
    'DEVICE_FINGERPRINT_001',
    EXTRACT(EPOCH FROM NOW())::BIGINT - 86400,
    EXTRACT(EPOCH FROM NOW())::BIGINT + (365 * 86400),
    gen_random_uuid()::TEXT,
    'sample_jwt_signature_1',
    true
);
*/

-- This file is commented out by default - uncomment and replace user IDs to use
