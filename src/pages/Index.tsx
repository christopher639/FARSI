import { useState } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ThreatHeatmap } from "@/components/dashboard/ThreatHeatmap";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { NetworkGraph } from "@/components/dashboard/NetworkGraph";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { AlertTriangle, Shield, Users, FileText, Crosshair, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

const Index = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-background">
      {/* Fixed Header */}
      <Header />

      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      {/* Main Content - Scrollable */}
      <main 
        className={cn(
          "pt-16 min-h-screen transition-all duration-300 ease-in-out",
          sidebarOpen ? "pl-64" : "pl-16"
        )}
      >
        <div className="p-6 grid-pattern">
          <div className="max-w-[1800px] mx-auto space-y-6">
            {/* Metrics Row */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 stagger-children">
              <MetricCard
                title="Active Threats"
                value="23"
                subtitle="8 critical zones"
                icon={AlertTriangle}
                variant="danger"
                trend={{ value: 12, direction: 'up' }}
              />
              <MetricCard
                title="Threat Level"
                value="HIGH"
                subtitle="National assessment"
                icon={Shield}
                variant="warning"
              />
              <MetricCard
                title="Entities Tracked"
                value="1,847"
                subtitle="156 new this week"
                icon={Users}
                variant="default"
              />
              <MetricCard
                title="Reports Today"
                value="342"
                subtitle="87 analyzed by AI"
                icon={FileText}
                variant="default"
              />
              <MetricCard
                title="Active Operations"
                value="12"
                subtitle="3 high priority"
                icon={Crosshair}
                variant="success"
              />
              <MetricCard
                title="Agencies Online"
                value="7/8"
                subtitle="NIS sync pending"
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
            <div className="panel p-3 flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-6">
                <span className="font-mono">SESSION: OPS-2024-01-21-ALPHA</span>
                <span className="font-mono">CLEARANCE: LEVEL 5</span>
                <span className="font-mono">ENCRYPTION: AES-256</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-success" />
                  <span>All systems operational</span>
                </div>
                <span className="font-mono opacity-50">v2.4.1</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
