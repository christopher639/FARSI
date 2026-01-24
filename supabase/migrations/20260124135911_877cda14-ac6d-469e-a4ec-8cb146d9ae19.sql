-- Add biometric authentication columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS biometric_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS biometric_credential_id text,
ADD COLUMN IF NOT EXISTS biometric_public_key text,
ADD COLUMN IF NOT EXISTS biometric_counter integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS biometric_mandatory boolean DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.biometric_enabled IS 'Whether WebAuthn biometric login is enabled';
COMMENT ON COLUMN public.profiles.biometric_credential_id IS 'Base64 encoded credential ID from WebAuthn';
COMMENT ON COLUMN public.profiles.biometric_public_key IS 'Base64 encoded public key from WebAuthn registration';
COMMENT ON COLUMN public.profiles.biometric_counter IS 'Counter for replay attack prevention';
COMMENT ON COLUMN public.profiles.biometric_mandatory IS 'If true, biometric is required as sole login method';