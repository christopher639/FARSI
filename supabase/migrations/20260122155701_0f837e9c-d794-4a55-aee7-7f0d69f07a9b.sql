-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'analyst', 'viewer');

-- Create status enum for users
CREATE TYPE public.user_status AS ENUM ('active', 'inactive', 'suspended');

-- Create clearance level enum
CREATE TYPE public.clearance_level AS ENUM ('top_secret', 'secret', 'confidential', 'unclassified');

-- Create alert severity enum
CREATE TYPE public.alert_severity AS ENUM ('critical', 'high', 'medium', 'low', 'info');

-- Create alert status enum
CREATE TYPE public.alert_status AS ENUM ('new', 'investigating', 'resolved', 'dismissed');

-- Create agency status enum
CREATE TYPE public.agency_status AS ENUM ('active', 'inactive', 'pending');

-- 1. Profiles table (stores user details)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    department TEXT,
    clearance_level clearance_level DEFAULT 'unclassified',
    badge_number TEXT,
    phone TEXT,
    status user_status DEFAULT 'active',
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 2. User roles table (stores role assignments)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE (user_id, role)
);

-- 3. Connected agencies table
CREATE TABLE public.connected_agencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    contact_person TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    status agency_status DEFAULT 'active',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 4. Threat alerts table
CREATE TABLE public.threat_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    severity alert_severity DEFAULT 'medium',
    status alert_status DEFAULT 'new',
    location TEXT,
    source TEXT,
    assigned_to UUID REFERENCES auth.users(id),
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 5. Intelligence reports table
CREATE TABLE public.intelligence_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT,
    classification clearance_level DEFAULT 'unclassified',
    category TEXT,
    source TEXT,
    author_id UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 6. Surveillance logs table
CREATE TABLE public.surveillance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    event_type TEXT NOT NULL,
    event_description TEXT,
    location TEXT,
    subject TEXT,
    recorded_by UUID REFERENCES auth.users(id),
    related_alert_id UUID REFERENCES public.threat_alerts(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 7. Communications monitoring table
CREATE TABLE public.communications_monitoring (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    channel_type TEXT NOT NULL,
    sender TEXT,
    recipient TEXT,
    content_summary TEXT,
    priority alert_severity DEFAULT 'low',
    flagged BOOLEAN DEFAULT false,
    related_alert_id UUID REFERENCES public.threat_alerts(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 8. Network analysis data table
CREATE TABLE public.network_analysis_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    source_ip TEXT,
    destination_ip TEXT,
    protocol TEXT,
    port INTEGER,
    bytes_transferred BIGINT,
    threat_detected BOOLEAN DEFAULT false,
    threat_type TEXT,
    payload_summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connected_agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.threat_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intelligence_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surveillance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communications_monitoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_analysis_data ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.has_role(_user_id, 'admin')
$$;

-- Helper function to check if user is analyst
CREATE OR REPLACE FUNCTION public.is_analyst(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.has_role(_user_id, 'analyst')
$$;

-- Helper function to check if user is viewer
CREATE OR REPLACE FUNCTION public.is_viewer(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.has_role(_user_id, 'viewer')
$$;

-- Helper function to check if user has any role (authenticated and authorized)
CREATE OR REPLACE FUNCTION public.is_authorized(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
    )
$$;

-- RLS Policies for profiles
CREATE POLICY "Admins can do everything on profiles"
ON public.profiles FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- RLS Policies for user_roles
CREATE POLICY "Admins can manage all roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Authorized users can view roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.is_authorized(auth.uid()));

-- RLS Policies for connected_agencies
CREATE POLICY "Admins can manage agencies"
ON public.connected_agencies FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Authorized users can view agencies"
ON public.connected_agencies FOR SELECT
TO authenticated
USING (public.is_authorized(auth.uid()));

-- RLS Policies for threat_alerts
CREATE POLICY "Admins can manage all alerts"
ON public.threat_alerts FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Analysts can create alerts"
ON public.threat_alerts FOR INSERT
TO authenticated
WITH CHECK (public.is_analyst(auth.uid()));

CREATE POLICY "Analysts can update alerts"
ON public.threat_alerts FOR UPDATE
TO authenticated
USING (public.is_analyst(auth.uid()));

CREATE POLICY "Authorized users can view alerts"
ON public.threat_alerts FOR SELECT
TO authenticated
USING (public.is_authorized(auth.uid()));

-- RLS Policies for intelligence_reports
CREATE POLICY "Admins can manage all reports"
ON public.intelligence_reports FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Analysts can create reports"
ON public.intelligence_reports FOR INSERT
TO authenticated
WITH CHECK (public.is_analyst(auth.uid()));

CREATE POLICY "Analysts can update own reports"
ON public.intelligence_reports FOR UPDATE
TO authenticated
USING (public.is_analyst(auth.uid()) AND author_id = auth.uid());

CREATE POLICY "Authorized users can view reports"
ON public.intelligence_reports FOR SELECT
TO authenticated
USING (public.is_authorized(auth.uid()));

-- RLS Policies for surveillance_logs
CREATE POLICY "Admins can manage surveillance"
ON public.surveillance_logs FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Authorized users can view surveillance"
ON public.surveillance_logs FOR SELECT
TO authenticated
USING (public.is_authorized(auth.uid()));

-- RLS Policies for communications_monitoring
CREATE POLICY "Admins can manage communications"
ON public.communications_monitoring FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Authorized users can view communications"
ON public.communications_monitoring FOR SELECT
TO authenticated
USING (public.is_authorized(auth.uid()));

-- RLS Policies for network_analysis_data
CREATE POLICY "Admins can manage network data"
ON public.network_analysis_data FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Authorized users can view network data"
ON public.network_analysis_data FOR SELECT
TO authenticated
USING (public.is_authorized(auth.uid()));

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agencies_updated_at
    BEFORE UPDATE ON public.connected_agencies
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_alerts_updated_at
    BEFORE UPDATE ON public.threat_alerts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reports_updated_at
    BEFORE UPDATE ON public.intelligence_reports
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, full_name, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        NEW.email
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Insert default agencies
INSERT INTO public.connected_agencies (code, name, status, description) VALUES
    ('NPS', 'National Police Service', 'active', 'Law enforcement agency'),
    ('NIS', 'National Intelligence Service', 'active', 'Intelligence agency'),
    ('KWS', 'Kenya Wildlife Service', 'active', 'Wildlife protection agency'),
    ('DCI', 'Directorate of Criminal Investigations', 'active', 'Criminal investigations unit');