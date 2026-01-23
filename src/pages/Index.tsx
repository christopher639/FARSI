import { MetricCard } from "@/components/dashboard/MetricCard";
import { ThreatHeatmap } from "@/components/dashboard/ThreatHeatmap";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { NetworkGraph } from "@/components/dashboard/NetworkGraph";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { AlertTriangle, Shield, Users, FileText, Crosshair, Radio } from "lucide-react";

const Index = () => {
  const { stats, loading } = useDashboardStats();

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

  return (
    <div className="grid-pattern">
      <div className="max-w-[1800px] mx-auto space-y-6">
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
            value={loading ? "..." : Math.min(stats.activeOperations, 12).toString()}
            subtitle={`${Math.min(stats.criticalZones, 3)} high priority`}
            icon={Crosshair}
            variant="success"
          />
          <MetricCard
            title="Agencies Online"
            value={loading ? "..." : `${stats.agenciesOnline}/${stats.totalAgencies || 8}`}
            subtitle={stats.totalAgencies > stats.agenciesOnline ? "Sync pending" : "All connected"}
            icon={Radio}
            variant="default"
          />
        </div>

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
            <span className="font-mono">SESSION: OPS-{new Date().toISOString().split('T')[0].replace(/-/g, '-')}-ALPHA</span>
            <span className="font-mono">CLEARANCE: LEVEL 5</span>
            <span className="font-mono">ENCRYPTION: AES-256</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span>All systems operational</span>
            </div>
            <span className="font-mono opacity-50">v2.4.1</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
