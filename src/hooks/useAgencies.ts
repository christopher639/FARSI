import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

type Agency = {
  id: string;
  code: string;
  contact_email: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  created_at: string;
  description: string | null;
  name: string;
  status: string | null;
  updated_at: string;
};

export function useAgencies() {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgencies = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('connected_agencies')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setAgencies(data || []);
      setError(null);
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
