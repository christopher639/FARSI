-- ML model registry
CREATE TABLE IF NOT EXISTS public.ml_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    model_type TEXT NOT NULL,
    framework TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (name, version)
);

-- Inference results
CREATE TABLE IF NOT EXISTS public.ml_inference_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.ingestion_events(id) ON DELETE SET NULL,
    model_id UUID REFERENCES public.ml_models(id) ON DELETE SET NULL,
    result JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Surveillance streams metadata
CREATE TABLE IF NOT EXISTS public.surveillance_streams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    rtsp_url TEXT,
    status TEXT NOT NULL DEFAULT 'inactive',
    last_heartbeat TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Per-frame detections
CREATE TABLE IF NOT EXISTS public.surveillance_frames (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID REFERENCES public.surveillance_streams(id) ON DELETE CASCADE,
    captured_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    storage_path TEXT,
    detections JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Threat heatmap cells
CREATE TABLE IF NOT EXISTS public.threat_heatmap_cells (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    window_end TIMESTAMP WITH TIME ZONE NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lon DOUBLE PRECISION NOT NULL,
    score DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Entity graph
CREATE TABLE IF NOT EXISTS public.entity_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.entity_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID REFERENCES public.entity_nodes(id) ON DELETE CASCADE,
    target_id UUID REFERENCES public.entity_nodes(id) ON DELETE CASCADE,
    relation TEXT NOT NULL,
    weight DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ml_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ml_inference_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surveillance_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surveillance_frames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.threat_heatmap_cells ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_edges ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authorized users can view ml models"
ON public.ml_models FOR SELECT TO authenticated
USING (public.is_authorized(auth.uid()));

CREATE POLICY "Admins can manage ml models"
ON public.ml_models FOR ALL TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Authorized users can view inference results"
ON public.ml_inference_results FOR SELECT TO authenticated
USING (public.is_authorized(auth.uid()));

CREATE POLICY "Analysts can create inference results"
ON public.ml_inference_results FOR INSERT TO authenticated
WITH CHECK (public.is_analyst(auth.uid()) OR public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage inference results"
ON public.ml_inference_results FOR ALL TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Authorized users can view surveillance streams"
ON public.surveillance_streams FOR SELECT TO authenticated
USING (public.is_authorized(auth.uid()));

CREATE POLICY "Admins can manage surveillance streams"
ON public.surveillance_streams FOR ALL TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Authorized users can view surveillance frames"
ON public.surveillance_frames FOR SELECT TO authenticated
USING (public.is_authorized(auth.uid()));

CREATE POLICY "Analysts can create surveillance frames"
ON public.surveillance_frames FOR INSERT TO authenticated
WITH CHECK (public.is_analyst(auth.uid()) OR public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage surveillance frames"
ON public.surveillance_frames FOR ALL TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Authorized users can view heatmap cells"
ON public.threat_heatmap_cells FOR SELECT TO authenticated
USING (public.is_authorized(auth.uid()));

CREATE POLICY "Analysts can create heatmap cells"
ON public.threat_heatmap_cells FOR INSERT TO authenticated
WITH CHECK (public.is_analyst(auth.uid()) OR public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage heatmap cells"
ON public.threat_heatmap_cells FOR ALL TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Authorized users can view entity nodes"
ON public.entity_nodes FOR SELECT TO authenticated
USING (public.is_authorized(auth.uid()));

CREATE POLICY "Admins can manage entity nodes"
ON public.entity_nodes FOR ALL TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Authorized users can view entity edges"
ON public.entity_edges FOR SELECT TO authenticated
USING (public.is_authorized(auth.uid()));

CREATE POLICY "Admins can manage entity edges"
ON public.entity_edges FOR ALL TO authenticated
USING (public.is_admin(auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ml_inference_event ON public.ml_inference_results(event_id);
CREATE INDEX IF NOT EXISTS idx_surveillance_frames_stream ON public.surveillance_frames(stream_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_heatmap_window ON public.threat_heatmap_cells(window_start, window_end);
