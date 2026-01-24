import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type Agency = Tables<'connected_agencies'>;

export function useAgencies() {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgencies = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('connected_agencies')
        .select('*')
        .order('name');

      if (error) throw error;
      setAgencies(data || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching agencies:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgencies();

    const channel = supabase
      .channel('agencies_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'connected_agencies' },
        () => fetchAgencies()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAgencies]);

  return { agencies, loading, error, refetch: fetchAgencies };
}
