import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { apiGet } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';

type SurveillanceLog = {
  id: string;
  event_type: string;
  event_description?: string | null;
  location?: string | null;
  subject?: string | null;
  timestamp: string;
  recorded_by?: string | null;
};

export function useSurveillanceLogs() {
  const [logs, setLogs] = useState<SurveillanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiGet<SurveillanceLog[]>('/surveillance/logs');
      setLogs(data || []);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to fetch surveillance logs'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('surveillance_logs_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'surveillance_logs' },
        () => {
          fetchLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLogs]);

  return { logs, loading, error, refetch: fetchLogs };
}
