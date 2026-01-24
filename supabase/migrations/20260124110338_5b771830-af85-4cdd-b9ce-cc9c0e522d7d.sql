-- Create user_invitations table for invitation flow
CREATE TABLE public.user_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    role app_role NOT NULL DEFAULT 'viewer',
    clearance_level clearance_level NOT NULL DEFAULT 'unclassified',
    department TEXT,
    invited_by UUID NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for token lookups
CREATE INDEX idx_user_invitations_token ON public.user_invitations(token);
CREATE INDEX idx_user_invitations_email ON public.user_invitations(email);

-- Enable RLS on user_invitations
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

-- Admins can manage invitations
CREATE POLICY "Admins can manage invitations"
ON public.user_invitations
FOR ALL
USING (is_admin(auth.uid()));

-- Public can read their own invitation by token (for accepting)
CREATE POLICY "Anyone can read invitation by token"
ON public.user_invitations
FOR SELECT
USING (true);

-- Create login_sessions table for tracking logins and device alerts
CREATE TABLE public.login_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    device_fingerprint TEXT,
    location TEXT,
    is_new_device BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for login sessions
CREATE INDEX idx_login_sessions_user_id ON public.login_sessions(user_id);
CREATE INDEX idx_login_sessions_device ON public.login_sessions(user_id, device_fingerprint);

-- Enable RLS on login_sessions
ALTER TABLE public.login_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view their own login sessions
CREATE POLICY "Users can view own login sessions"
ON public.login_sessions
FOR SELECT
USING (user_id = auth.uid());

-- Service role can insert login sessions
CREATE POLICY "Service can insert login sessions"
ON public.login_sessions
FOR INSERT
WITH CHECK (true);

-- Admins can view all login sessions
CREATE POLICY "Admins can view all login sessions"
ON public.login_sessions
FOR ALL
USING (is_admin(auth.uid()));