import { MetricCard } from "@/components/dashboard/MetricCard";
import { ThreatHeatmap } from "@/components/dashboard/ThreatHeatmap";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { NetworkGraph } from "@/components/dashboard/NetworkGraph";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Shield, Users, FileText, Crosshair, Radio, RefreshCw, UserCog, Settings, Bell, ShieldCheck } from "lucide-react";
import { apiGet } from "@/lib/api";
import { useEffect, useState, useCallback } from "react";

const Index = () => {
  const { stats, loading, refetch } = useDashboardStats();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [hotspots, setHotspots] = useState<Array<{ label: string; count: number; context?: string; latitude?: number; longitude?: number; last_reported?: string }>>([]);
  const [loadingHotspots, setLoadingHotspots] = useState(false);

  const getThreatLevel = () => {
    if (stats.criticalZones >= 5) return 'CRITICAL';
    if (stats.criticalZones >= 3 || stats.activeThreats >= 10) return 'HIGH';
    if (stats.activeThreats >= 5) return 'MEDIUM';
    return 'LOW';
  };

  const getThreatVariant = () => {
    const level = getThreatLevel();
    if (level === 'CRITICAL') return 'danger';
    if (level === 'HIGH') return 'warning';
    return 'default';
  };

  const getSystemReadiness = () => {
    const agencyCoverage = stats.totalAgencies > 0 ? stats.agenciesOnline / stats.totalAgencies : 0;

    if (stats.criticalZones >= 5 || agencyCoverage < 0.5) {
      return { label: 'DEGRADED', className: 'bg-destructive/20 text-destructive border-destructive/30' };
    }

    if (stats.activeThreats >= 8 || agencyCoverage < 0.8) {
      return { label: 'ELEVATED', className: 'bg-warning/20 text-warning border-warning/30' };
    }

    return { label: 'STABLE', className: 'bg-success/20 text-success border-success/30' };
  };

  const systemReadiness = getSystemReadiness();

  const loadHotspots = useCallback(async () => {
    try {
      setLoadingHotspots(true);
      const data = await apiGet<{ hotspots: typeof hotspots }>("/analytics/predicted-hotspots");
      setHotspots(data.hotspots || []);
    } catch (err) {
      console.error("Failed to load predicted hotspots", err);
    } finally {
      setLoadingHotspots(false);
    }
  }, []);

  useEffect(() => {
    void loadHotspots();
  }, [loadHotspots]);

  return (
    <div className="grid-pattern">
      <div className="max-w-[1800px] mx-auto space-y-6">
        <div className="panel p-4 sm:p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Admin Command Center</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Unified view of threats, agencies, and response operations.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={systemReadiness.className}>
              <ShieldCheck className="h-3.5 w-3.5 mr-1" />
              {systemReadiness.label}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 stagger-children">
          <MetricCard
            title="Active Threats"
            value={loading ? "..." : stats.activeThreats.toString()}
            subtitle={`${stats.criticalZones} critical zones`}
            icon={AlertTriangle}
            variant={stats.criticalZones > 0 ? "danger" : "warning"}
            trend={stats.activeThreats > 0 ? { value: stats.criticalZones, direction: 'up' } : undefined}
          />
          <MetricCard
            title="Threat Level"
            value={loading ? "..." : getThreatLevel()}
            subtitle="National assessment"
            icon={Shield}
            variant={getThreatVariant()}
          />
          <MetricCard
            title="Entities Tracked"
            value={loading ? "..." : stats.entitiesTracked.toLocaleString()}
            subtitle={`${stats.newEntitiesThisWeek} new this week`}
            icon={Users}
            variant="default"
          />
          <MetricCard
            title="Reports Today"
            value={loading ? "..." : stats.reportsToday.toString()}
            subtitle="Intelligence submissions"
            icon={FileText}
            variant="default"
          />
          <MetricCard
            title="Active Operations"
            value={loading ? "..." : stats.activeOperations.toString()}
            subtitle={`${stats.criticalZones} high priority`}
            icon={Crosshair}
            variant="success"
          />
          <MetricCard
            title="Agencies Online"
            value={loading ? "..." : `${stats.agenciesOnline}/${stats.totalAgencies}`}
            subtitle={stats.totalAgencies > stats.agenciesOnline ? "Sync pending" : "All connected"}
            icon={Radio}
            variant="default"
          />
        </div>

        {isAdmin && (
          <div className="panel p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-base sm:text-lg font-semibold">Admin Actions</h2>
                <p className="text-sm text-muted-foreground">Direct access to high-impact operational controls.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => navigate('/users')}>
                  <UserCog className="h-4 w-4 mr-2" />
                  Manage Users
                </Button>
                <Button size="sm" variant="outline" onClick={() => navigate('/system-settings')}>
                  <Settings className="h-4 w-4 mr-2" />
                  System Policy
                </Button>
                <Button size="sm" variant="outline" onClick={() => navigate('/alerts')}>
                  <Bell className="h-4 w-4 mr-2" />
                  Review Alerts
                </Button>
              </div>
            </div>
          </div>
        )}

        {isAdmin && (
          <div className="panel p-4 sm:p-5 border-dashed border-primary/30">
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">
                Use the curated crime pattern dataset to train threat-prediction models.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-primary/20 text-primary border border-primary/40">API: /analytics/crime-patterns</Badge>
                <p className="text-xs text-muted-foreground">
                  Returns hour/day/month, geo, and narrative context for supervised learning. Pull this regularly for retraining.
                </p>
                <Button size="sm" variant="outline" onClick={() => window.open("/analytics/crime-patterns", "_blank")}>
                  View Sample Records
                </Button>
              </div>
            </div>
          </div>
        )}

        {isAdmin && (
          <div className="panel p-4 sm:p-5 border-panel-border">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base sm:text-lg font-semibold">Predicted Hotspots</h2>
                <p className="text-sm text-muted-foreground">
                  Aggregated counts from recent reports act as a proxy score for the next deployment.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => void loadHotspots()} disabled={loadingHotspots}>
                <RefreshCw className={`h-4 w-4 ${loadingHotspots ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
            <div className="mt-4 grid gap-3">
              {hotspots.length === 0 && !loadingHotspots && (
                <p className="text-xs text-muted-foreground">No hotspots detected yet.</p>
              )}
              {hotspots.map((spot) => (
                <div key={spot.label} className="rounded-lg border border-panel-border px-4 py-3 flex flex-col gap-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{spot.label}</span>
                    <Badge className="bg-warning/20 text-warning border-warning/30">
                      {spot.count} reports
                    </Badge>
                  </div>
                  {spot.context && (
                    <p className="text-xs text-muted-foreground italic line-clamp-2">{spot.context}</p>
                  )}
                  {(spot.latitude || spot.longitude) && (
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {spot.latitude?.toFixed(4) ?? "?.???"} , {spot.longitude?.toFixed(4) ?? "?.???"}
                    </span>
                  )}
                  {spot.last_reported && (
                    <span className="text-[11px] text-muted-foreground">Last reported: {new Date(spot.last_reported).toLocaleString()}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Threat Heatmap - Takes 2 columns */}
          <div className="lg:col-span-2">
            <ThreatHeatmap />
          </div>

          {/* Alerts Panel */}
          <div className="lg:row-span-2">
            <AlertsPanel />
          </div>

          {/* Bottom Row */}
          <div className="lg:col-span-1">
            <NetworkGraph />
          </div>
          <div className="lg:col-span-1">
            <ActivityFeed />
          </div>
        </div>

        {/* Footer Status Bar */}
        <div className="panel p-3 flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground gap-2">
          <div className="flex items-center gap-4 sm:gap-6 flex-wrap justify-center sm:justify-start">
            <span className="font-mono">SESSION: OPS-{new Date().toISOString().split('T')[0]}-ALPHA</span>
            <span className="font-mono">CLEARANCE: LEVEL 5</span>
            <span className="font-mono">ENCRYPTION: AES-256</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span>All systems operational</span>
            </div>
            <span className="font-mono opacity-50">v2.4.2</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
