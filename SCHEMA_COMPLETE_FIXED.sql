-- Complete Schema + RLS Policies - Copy and paste this entire file into Supabase SQL Editor
-- This combines both 0000_complete_schema.sql and 0001_rls_policies.sql
-- FIXED VERSION: Handles existing tables properly

-- ============================================
-- PART 1: SCHEMA
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (optional - comment out if you want to keep existing data)
-- DROP TABLE IF EXISTS public.audit_logs CASCADE;
-- DROP TABLE IF EXISTS public.revoked_licenses CASCADE;
-- DROP TABLE IF EXISTS public.entitlements CASCADE;
-- DROP TABLE IF EXISTS public.devices CASCADE;
-- DROP TABLE IF EXISTS public.licenses CASCADE;

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

-- Add is_active column if it doesn't exist (for existing licenses table)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'licenses' 
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE public.licenses ADD COLUMN is_active BOOLEAN DEFAULT TRUE NOT NULL;
    END IF;
END $$;

-- devices Table
-- Tracks devices bound to user entitlements/licenses
-- First, drop the table if it exists with wrong schema
DROP TABLE IF EXISTS public.devices CASCADE;

CREATE TABLE public.devices (
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

-- ============================================
-- PART 2: RLS POLICIES
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own licenses" ON public.licenses;
DROP POLICY IF EXISTS "Edge Functions can insert licenses" ON public.licenses;
DROP POLICY IF EXISTS "Edge Functions can update licenses" ON public.licenses;
DROP POLICY IF EXISTS "Users can view their own devices" ON public.devices;
DROP POLICY IF EXISTS "Users can insert their own devices" ON public.devices;
DROP POLICY IF EXISTS "Users can update their own devices" ON public.devices;
DROP POLICY IF EXISTS "Users can delete their own devices" ON public.devices;
DROP POLICY IF EXISTS "Users can view their own entitlements" ON public.entitlements;
DROP POLICY IF EXISTS "Edge Functions can insert entitlements" ON public.entitlements;
DROP POLICY IF EXISTS "Edge Functions can update entitlements" ON public.entitlements;
DROP POLICY IF EXISTS "Users cannot directly access revoked licenses" ON public.revoked_licenses;
DROP POLICY IF EXISTS "Edge Functions can insert revoked licenses" ON public.revoked_licenses;
DROP POLICY IF EXISTS "Users can view their own audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Edge Functions can insert audit logs" ON public.audit_logs;

-- RLS for public.licenses table
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own licenses" ON public.licenses
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Edge Functions can insert licenses" ON public.licenses
FOR INSERT WITH CHECK (true); -- Managed by Edge Functions, RLS will be bypassed by service_role if needed or enforced by Edge Function logic

CREATE POLICY "Edge Functions can update licenses" ON public.licenses
FOR UPDATE USING (true); -- Managed by Edge Functions

-- RLS for public.devices table
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own devices" ON public.devices
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own devices" ON public.devices
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own devices" ON public.devices
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own devices" ON public.devices
FOR DELETE USING (auth.uid() = user_id);

-- RLS for public.entitlements table
ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own entitlements" ON public.entitlements
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Edge Functions can insert entitlements" ON public.entitlements
FOR INSERT WITH CHECK (true); -- Managed by Edge Functions

CREATE POLICY "Edge Functions can update entitlements" ON public.entitlements
FOR UPDATE USING (true); -- Managed by Edge Functions

-- RLS for public.revoked_licenses table
ALTER TABLE public.revoked_licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users cannot directly access revoked licenses" ON public.revoked_licenses
FOR SELECT USING (false); -- Only Edge Functions can access

CREATE POLICY "Edge Functions can insert revoked licenses" ON public.revoked_licenses
FOR INSERT WITH CHECK (true); -- Managed by Edge Functions

-- RLS for public.audit_logs table
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audit logs" ON public.audit_logs
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Edge Functions can insert audit logs" ON public.audit_logs
FOR INSERT WITH CHECK (true); -- Managed by Edge Functions
