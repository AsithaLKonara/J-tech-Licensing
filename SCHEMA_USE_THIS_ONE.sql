-- ⚠️ USE THIS FILE - 100% CORRECT SCHEMA ⚠️
-- Copy and paste this ENTIRE file into Supabase SQL Editor
-- This version drops all tables first to ensure correct UUID types

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop all existing tables to ensure clean state
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.revoked_licenses CASCADE;
DROP TABLE IF EXISTS public.entitlements CASCADE;
DROP TABLE IF EXISTS public.devices CASCADE;
DROP TABLE IF EXISTS public.licenses CASCADE;

-- licenses Table
CREATE TABLE public.licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
CREATE TABLE public.devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_fingerprint TEXT NOT NULL,
    device_name TEXT,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (user_id, device_fingerprint)
);

-- entitlements Table
CREATE TABLE public.entitlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product TEXT NOT NULL,
    plan TEXT NOT NULL,
    features JSONB DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'active',
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- revoked_licenses Table
CREATE TABLE public.revoked_licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_id UUID NOT NULL REFERENCES public.licenses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    revoked_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    reason TEXT
);

-- audit_logs Table
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    entity_id UUID,
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

-- Trigger for entitlements
CREATE TRIGGER update_entitlements_updated_at BEFORE UPDATE ON public.entitlements
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX idx_licenses_user_id ON public.licenses(user_id);
CREATE INDEX idx_licenses_device_fingerprint ON public.licenses(device_fingerprint);
CREATE INDEX idx_licenses_is_active ON public.licenses(is_active);
CREATE INDEX idx_devices_user_id ON public.devices(user_id);
CREATE INDEX idx_devices_device_fingerprint ON public.devices(device_fingerprint);
CREATE INDEX idx_revoked_licenses_license_id ON public.revoked_licenses(license_id);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_event_type ON public.audit_logs(event_type);

-- RLS Policies
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own licenses" ON public.licenses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Edge Functions can insert licenses" ON public.licenses FOR INSERT WITH CHECK (true);
CREATE POLICY "Edge Functions can update licenses" ON public.licenses FOR UPDATE USING (true);

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own devices" ON public.devices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own devices" ON public.devices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own devices" ON public.devices FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own devices" ON public.devices FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own entitlements" ON public.entitlements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Edge Functions can insert entitlements" ON public.entitlements FOR INSERT WITH CHECK (true);
CREATE POLICY "Edge Functions can update entitlements" ON public.entitlements FOR UPDATE USING (true);

ALTER TABLE public.revoked_licenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users cannot directly access revoked licenses" ON public.revoked_licenses FOR SELECT USING (false);
CREATE POLICY "Edge Functions can insert revoked licenses" ON public.revoked_licenses FOR INSERT WITH CHECK (true);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own audit logs" ON public.audit_logs FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Edge Functions can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (true);
