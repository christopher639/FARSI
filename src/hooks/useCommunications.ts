import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { apiGet } from '@/lib/api';

type Communication = {
  id: string;
  channel_type: string;
  sender?: string | null;
  recipient?: string | null;
  content_summary?: string | null;
  priority?: string | null;
  flagged?: boolean | null;
  related_alert_id?: string | null;
  timestamp: string;
  created_at: string;
};

export function useCommunications() {
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCommunications = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiGet<Communication[]>('/communications');
      setCommunications(data || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching communications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCommunications();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('communications_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'communications_monitoring' },
        () => fetchCommunications()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCommunications]);

  return { communications, loading, error, refetch: fetchCommunications };
}
