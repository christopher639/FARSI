-- Ingestion events table (multi-modal with provenance)
CREATE TABLE IF NOT EXISTS public.ingestion_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    location JSONB,
    entities JSONB,
    tags TEXT[] DEFAULT '{}'::text[],
    severity TEXT,
    modality TEXT NOT NULL DEFAULT 'text',
    media_path TEXT,
    provenance JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crime events table for ML pipelines
CREATE TABLE IF NOT EXISTS public.crime_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    crime_type TEXT NOT NULL,
    month TEXT,
    location TEXT,
    longitude DOUBLE PRECISION,
    latitude DOUBLE PRECISION,
    reported_by TEXT,
    falls_within TEXT,
    lsoa_code TEXT,
    lsoa_name TEXT,
    last_outcome_category TEXT,
    crime_id TEXT,
    context TEXT,
    record_hash TEXT UNIQUE,
    geo JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Audit logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor TEXT NOT NULL,
    role TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ingestion_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crime_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies: ingestion_events
CREATE POLICY "Authorized users can view ingestion events"
ON public.ingestion_events
FOR SELECT
TO authenticated
USING (public.is_authorized(auth.uid()));

CREATE POLICY "Analysts can create ingestion events"
ON public.ingestion_events
FOR INSERT
TO authenticated
WITH CHECK (public.is_analyst(auth.uid()) OR public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage ingestion events"
ON public.ingestion_events
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));

-- RLS policies: crime_events
CREATE POLICY "Authorized users can view crime events"
ON public.crime_events
FOR SELECT
TO authenticated
USING (public.is_authorized(auth.uid()));

CREATE POLICY "Admins can manage crime events"
ON public.crime_events
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));

-- RLS policies: audit_logs
CREATE POLICY "Admins can view audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage audit logs"
ON public.audit_logs
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ingestion_events_created_at ON public.ingestion_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crime_events_record_hash ON public.crime_events(record_hash);
CREATE INDEX IF NOT EXISTS idx_crime_events_type ON public.crime_events(crime_type);

-- Storage bucket for ingestion media
INSERT INTO storage.buckets (id, name, public)
VALUES ('ingestion-media', 'ingestion-media', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for ingestion media
CREATE POLICY "Authorized can read ingestion media"
ON storage.objects FOR SELECT
USING (bucket_id = 'ingestion-media' AND public.is_authorized(auth.uid()));

CREATE POLICY "Analysts can upload ingestion media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'ingestion-media' AND (public.is_analyst(auth.uid()) OR public.is_admin(auth.uid())));

CREATE POLICY "Admins can manage ingestion media"
ON storage.objects FOR ALL
USING (bucket_id = 'ingestion-media' AND public.is_admin(auth.uid()));
