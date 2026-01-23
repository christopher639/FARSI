import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DashboardStats {
  activeThreats: number;
  criticalZones: number;
  entitiesTracked: number;
  newEntitiesThisWeek: number;
  reportsToday: number;
  activeOperations: number;
  agenciesOnline: number;
  totalAgencies: number;
}

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats>({
    activeThreats: 0,
    criticalZones: 0,
    entitiesTracked: 0,
    newEntitiesThisWeek: 0,
    reportsToday: 0,
    activeOperations: 0,
    agenciesOnline: 0,
    totalAgencies: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);
      
      // Fetch active threat alerts (new + investigating)
      const { count: activeThreats } = await supabase
        .from('threat_alerts')
        .select('*', { count: 'exact', head: true })
        .in('status', ['new', 'investigating']);
      
      // Fetch critical severity alerts
      const { count: criticalZones } = await supabase
        .from('threat_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('severity', 'critical')
        .in('status', ['new', 'investigating']);

      // Fetch total profiles (entities tracked)
      const { count: entitiesTracked } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Fetch new profiles this week
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { count: newEntitiesThisWeek } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', weekAgo.toISOString());

      // Fetch reports created today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count: reportsToday } = await supabase
        .from('intelligence_reports')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString());

      // Fetch active agencies
      const { data: agencies } = await supabase
        .from('connected_agencies')
        .select('status');
      
      const activeAgencies = agencies?.filter(a => a.status === 'active').length || 0;
      const totalAgencies = agencies?.length || 0;

      setStats({
        activeThreats: activeThreats || 0,
        criticalZones: criticalZones || 0,
        entitiesTracked: entitiesTracked || 0,
        newEntitiesThisWeek: newEntitiesThisWeek || 0,
        reportsToday: reportsToday || 0,
        activeOperations: activeThreats || 0,
        agenciesOnline: activeAgencies,
        totalAgencies,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000);

    return () => clearInterval(interval);
  }, []);

  return { stats, loading, refetch: fetchStats };
}
