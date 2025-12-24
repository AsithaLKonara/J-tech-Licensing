
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table (Supabase Auth handles this, but we'll have a public.users for RLS)
-- This table will be managed by Supabase Auth, but we'll define RLS policies for it.
-- We won't explicitly create it here, but rely on Supabase's 'auth.users' table.
-- For simplicity in RLS, we'll create a public.users view or rely on auth.users directly.

-- licenses Table
-- Stores issued licenses
CREATE TABLE public.licenses (
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- devices Table
-- Tracks devices bound to user entitlements/licenses
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
CREATE TABLE public.entitlements (
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
CREATE TABLE public.revoked_licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_id UUID REFERENCES public.licenses(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    revoked_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    reason TEXT
);

-- audit_logs Table
-- Logs significant events like license issuance, revocation, device changes
CREATE TABLE public.audit_logs (
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
CREATE TRIGGER update_entitlements_updated_at BEFORE UPDATE ON public.entitlements
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

