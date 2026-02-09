import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";

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
  };
}

export function useBackendEvents() {
  const [events, setEvents] = useState<BackendEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const data = await apiGet<BackendEvent[]>("/events?limit=20");
      setEvents(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to fetch backend events");
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
