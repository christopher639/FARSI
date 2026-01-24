import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type NetworkData = Tables<'network_analysis_data'>;

export function useNetworkData() {
  const [networkData, setNetworkData] = useState<NetworkData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNetworkData = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('network_analysis_data')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(200);

      if (error) throw error;
      setNetworkData(data || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Error fetching network data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNetworkData();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('network_data_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'network_analysis_data' },
        () => fetchNetworkData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchNetworkData]);

  const getStats = useCallback(() => {
    const threats = networkData.filter(d => d.threat_detected);
    const protocols = [...new Set(networkData.map(d => d.protocol).filter(Boolean))];
    const totalBytes = networkData.reduce((sum, d) => sum + (d.bytes_transferred || 0), 0);
    
    return {
      totalConnections: networkData.length,
      threatCount: threats.length,
      uniqueProtocols: protocols.length,
      totalBytesTransferred: totalBytes,
    };
  }, [networkData]);

  return { networkData, loading, error, refetch: fetchNetworkData, getStats };
}
