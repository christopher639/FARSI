import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { apiGet } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';

type ThreatAlert = {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  severity?: string | null;
  status?: string | null;
  source?: string | null;
  created_at: string;
  updated_at: string;
};

export function useThreatAlerts() {
  const [alerts, setAlerts] = useState<ThreatAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiGet<ThreatAlert[]>('/alerts');
      setAlerts(data || []);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to fetch threat alerts'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('threat_alerts_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'threat_alerts' },
        () => {
          fetchAlerts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAlerts]);

  return { alerts, loading, error, refetch: fetchAlerts };
}
