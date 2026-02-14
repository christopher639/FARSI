import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getErrorMessage } from "@/lib/errors";

export interface BackendEvent {
  id: string;
  event_type: string;
  title: string;
  description?: string | null;
  modality: string;
  created_at: string;
  provenance: {
    source_system: string;
    source_agency?: string | null;
    ingested_at: string;
    transformations?: string[];
    dataset_version?: string | null;
  };
}

function parseProvenance(input: unknown, fallbackIngestedAt: string): BackendEvent["provenance"] {
  const value = (input && typeof input === "object" ? input : {}) as {
    source_system?: string;
    source_agency?: string | null;
    ingested_at?: string;
    transformations?: string[];
    dataset_version?: string | null;
  };

  return {
    source_system: value.source_system || "unknown",
    source_agency: value.source_agency || null,
    ingested_at: value.ingested_at || fallbackIngestedAt,
    transformations: Array.isArray(value.transformations) ? value.transformations : [],
    dataset_version: value.dataset_version || null,
  };
}

export function useBackendEvents() {
  const [events, setEvents] = useState<BackendEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('ingestion_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (fetchError) throw fetchError;

      const mapped: BackendEvent[] = (data || []).map((row) => ({
        id: row.id,
        event_type: row.event_type,
        title: row.title,
        description: row.description,
        modality: row.modality || "text",
        created_at: row.created_at,
        provenance: parseProvenance(row.provenance, row.created_at),
      }));
      setEvents(mapped);
      setError(null);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to fetch ingestion events"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    const channel = supabase
      .channel("ingestion_events_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ingestion_events" },
        () => fetchEvents()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { events, loading, error, refetch: fetchEvents };
}
