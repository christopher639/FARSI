
-- ============================================================
-- 1. ingestion_events
-- ============================================================
CREATE TABLE public.ingestion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  location JSONB,
  entities JSONB,
  tags TEXT[] DEFAULT '{}',
  severity TEXT,
  modality TEXT DEFAULT 'text',
  media_path TEXT,
  provenance JSONB,
  processed_at TIMESTAMPTZ,
  last_inference_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ingestion_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage ingestion events"
  ON public.ingestion_events FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Authorized users can view ingestion events"
  ON public.ingestion_events FOR SELECT
  USING (public.is_authorized(auth.uid()));

CREATE POLICY "Service can insert ingestion events"
  ON public.ingestion_events FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- 2. crime_events
-- ============================================================
CREATE TABLE public.crime_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crime_id TEXT,
  crime_type TEXT,
  month TEXT,
  location TEXT,
  longitude DOUBLE PRECISION,
  latitude DOUBLE PRECISION,
  reported_by TEXT,
  falls_within TEXT,
  lsoa_code TEXT,
  lsoa_name TEXT,
  last_outcome_category TEXT,
  context TEXT,
  record_hash TEXT UNIQUE,
  geo JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.crime_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage crime events"
  ON public.crime_events FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Authorized users can view crime events"
  ON public.crime_events FOR SELECT
  USING (public.is_authorized(auth.uid()));

CREATE POLICY "Service can insert crime events"
  ON public.crime_events FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_crime_events_record_hash ON public.crime_events(record_hash);
CREATE INDEX idx_crime_events_crime_type ON public.crime_events(crime_type);
CREATE INDEX idx_crime_events_coords ON public.crime_events(latitude, longitude);

-- ============================================================
-- 3. audit_logs
-- ============================================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor TEXT NOT NULL,
  role TEXT,
  action TEXT NOT NULL,
  target TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage audit logs"
  ON public.audit_logs FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Authorized users can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.is_authorized(auth.uid()));

CREATE POLICY "Service can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- 4. ml_models
-- ============================================================
CREATE TABLE public.ml_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  model_type TEXT NOT NULL,
  framework TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(name, version)
);

ALTER TABLE public.ml_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage ml models"
  ON public.ml_models FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Authorized users can view ml models"
  ON public.ml_models FOR SELECT
  USING (public.is_authorized(auth.uid()));

CREATE POLICY "Service can upsert ml models"
  ON public.ml_models FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service can update ml models"
  ON public.ml_models FOR UPDATE
  USING (true);

-- ============================================================
-- 5. ml_inference_results
-- ============================================================
CREATE TABLE public.ml_inference_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.ingestion_events(id),
  model_id UUID REFERENCES public.ml_models(id),
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ml_inference_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage inference results"
  ON public.ml_inference_results FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Authorized users can view inference results"
  ON public.ml_inference_results FOR SELECT
  USING (public.is_authorized(auth.uid()));

CREATE POLICY "Service can insert inference results"
  ON public.ml_inference_results FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- 6. entity_nodes
-- ============================================================
CREATE TABLE public.entity_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  entity_type TEXT,
  properties JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.entity_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage entity nodes"
  ON public.entity_nodes FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Authorized users can view entity nodes"
  ON public.entity_nodes FOR SELECT
  USING (public.is_authorized(auth.uid()));

CREATE POLICY "Service can insert entity nodes"
  ON public.entity_nodes FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- 7. entity_edges
-- ============================================================
CREATE TABLE public.entity_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES public.entity_nodes(id),
  target_id UUID REFERENCES public.entity_nodes(id),
  relationship TEXT,
  properties JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.entity_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage entity edges"
  ON public.entity_edges FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Authorized users can view entity edges"
  ON public.entity_edges FOR SELECT
  USING (public.is_authorized(auth.uid()));

CREATE POLICY "Service can insert entity edges"
  ON public.entity_edges FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- 8. surveillance_streams
-- ============================================================
CREATE TABLE public.surveillance_streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  rtsp_url TEXT,
  status TEXT DEFAULT 'inactive',
  last_heartbeat TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.surveillance_streams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage surveillance streams"
  ON public.surveillance_streams FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Authorized users can view surveillance streams"
  ON public.surveillance_streams FOR SELECT
  USING (public.is_authorized(auth.uid()));

-- ============================================================
-- 9. surveillance_frames
-- ============================================================
CREATE TABLE public.surveillance_frames (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID REFERENCES public.surveillance_streams(id),
  storage_path TEXT,
  detections JSONB DEFAULT '[]'::jsonb,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.surveillance_frames ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage surveillance frames"
  ON public.surveillance_frames FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Authorized users can view surveillance frames"
  ON public.surveillance_frames FOR SELECT
  USING (public.is_authorized(auth.uid()));

CREATE POLICY "Service can insert surveillance frames"
  ON public.surveillance_frames FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- 10. threat_heatmap_cells
-- ============================================================
CREATE TABLE public.threat_heatmap_cells (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  score DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.threat_heatmap_cells ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage heatmap cells"
  ON public.threat_heatmap_cells FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Authorized users can view heatmap cells"
  ON public.threat_heatmap_cells FOR SELECT
  USING (public.is_authorized(auth.uid()));

CREATE POLICY "Service can insert heatmap cells"
  ON public.threat_heatmap_cells FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_heatmap_cells_window ON public.threat_heatmap_cells(window_start, window_end);
CREATE INDEX idx_heatmap_cells_coords ON public.threat_heatmap_cells(lat, lon);
