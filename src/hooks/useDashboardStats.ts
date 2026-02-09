import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';

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
      
      const data = await apiGet<DashboardStats>('/stats/dashboard');
      setStats(data);
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
