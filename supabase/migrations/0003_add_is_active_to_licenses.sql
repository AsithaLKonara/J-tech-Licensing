-- Add is_active column to licenses table if it doesn't exist
-- This column is used to track whether a license is active or has been revoked
ALTER TABLE public.licenses 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE NOT NULL;

-- Update existing licenses to be active by default
UPDATE public.licenses SET is_active = TRUE WHERE is_active IS NULL;
