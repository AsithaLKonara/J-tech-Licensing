CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now() NOT NULL,
  email text UNIQUE NOT NULL,
  last_login timestamptz
);

CREATE TABLE licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now() NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  product text NOT NULL,
  plan text NOT NULL,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  device_fingerprint text,
  issued_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz NOT NULL,
  nonce text NOT NULL,
  signature text NOT NULL,
  is_active boolean DEFAULT TRUE NOT NULL
);

CREATE TABLE devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now() NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  fingerprint text UNIQUE NOT NULL,
  name text,
  last_seen timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now() NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  license_id uuid REFERENCES licenses(id) ON DELETE CASCADE,
  feature_name text NOT NULL,
  has_access boolean DEFAULT TRUE NOT NULL,
  expires_at timestamptz
);

CREATE TABLE revoked_licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now() NOT NULL,
  license_id uuid UNIQUE REFERENCES licenses(id) ON DELETE CASCADE NOT NULL,
  reason text,
  revoked_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now() NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text
);