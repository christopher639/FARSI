import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type Communication = Tables<'communications_monitoring'>;

export function useCommunications() {
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCommunications = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('communications_monitoring')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);

      if (error) throw error;
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
