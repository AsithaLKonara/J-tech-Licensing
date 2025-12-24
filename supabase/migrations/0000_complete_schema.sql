-- Complete License System Schema for Supabase
-- This combines the initial schema with all required columns

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- licenses Table
-- Stores issued licenses
CREATE TABLE IF NOT EXISTS public.licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    product TEXT NOT NULL,
    plan TEXT NOT NULL,
    features JSONB DEFAULT '[]'::jsonb,
    device_fingerprint TEXT NOT NULL,
    issued_at BIGINT NOT NULL,
    expires_at BIGINT NOT NULL,
    nonce TEXT NOT NULL,
    signature TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- devices Table
-- Tracks devices bound to user entitlements/licenses
CREATE TABLE IF NOT EXISTS public.devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    device_fingerprint TEXT NOT NULL,
    device_name TEXT,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (user_id, device_fingerprint)
);

-- entitlements Table
-- Stores user entitlements (subscriptions, plans, features)
CREATE TABLE IF NOT EXISTS public.entitlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    product TEXT NOT NULL,
    plan TEXT NOT NULL, -- e.g., 'monthly', 'yearly', 'perpetual'
    features JSONB DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'expired', 'cancelled', 'payment_failed'
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- revoked_licenses Table
-- Stores revoked license IDs to prevent reuse (online check)
CREATE TABLE IF NOT EXISTS public.revoked_licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_id UUID REFERENCES public.licenses(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    revoked_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    reason TEXT
);

-- audit_logs Table
-- Logs significant events like license issuance, revocation, device changes
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Keep logs even if user deleted
    event_type TEXT NOT NULL,
    entity_id UUID, -- e.g., license_id, device_id, entitlement_id
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to auto-update updated_at for entitlements
DROP TRIGGER IF EXISTS update_entitlements_updated_at ON public.entitlements;
CREATE TRIGGER update_entitlements_updated_at BEFORE UPDATE ON public.entitlements
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_licenses_user_id ON public.licenses(user_id);
CREATE INDEX IF NOT EXISTS idx_licenses_device_fingerprint ON public.licenses(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_licenses_is_active ON public.licenses(is_active);
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON public.devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_device_fingerprint ON public.devices(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_revoked_licenses_license_id ON public.revoked_licenses(license_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON public.audit_logs(event_type);
