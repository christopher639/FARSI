-- Create OTP codes table for 2FA
CREATE TABLE public.otp_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage OTP codes (edge functions use service role)
CREATE POLICY "Service role can manage OTP codes"
ON public.otp_codes
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_otp_codes_user_email ON public.otp_codes(user_id, email);
CREATE INDEX idx_otp_codes_expires ON public.otp_codes(expires_at);

-- Function to clean up expired OTP codes
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.otp_codes WHERE expires_at < now() OR used = true;
END;
$$;