import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { apiGet } from '@/lib/api';

type IntelligenceReport = {
  id: string;
  title: string;
  content?: string | null;
  classification?: string | null;
  category?: string | null;
  source?: string | null;
  author_id?: string | null;
  created_at: string;
  updated_at: string;
};

export function useIntelligenceReports() {
  const [reports, setReports] = useState<IntelligenceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const data = await apiGet<IntelligenceReport[]>('/reports');
      setReports(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('intelligence_reports_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'intelligence_reports' },
        () => {
          fetchReports();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { reports, loading, error, refetch: fetchReports };
}
