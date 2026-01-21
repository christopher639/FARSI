import { Database, Upload, Download, RefreshCw, Server, HardDrive, Activity, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

const dataSources = [
  { name: "NPS Crime Database", status: "synced", records: "2.4M", lastSync: "2 min ago", health: 98 },
  { name: "NIS Intelligence Feed", status: "syncing", records: "890K", lastSync: "syncing...", health: 95 },
  { name: "Border Control System", status: "synced", records: "1.2M", lastSync: "5 min ago", health: 100 },
  { name: "CCTV Analytics", status: "synced", records: "45K", lastSync: "1 min ago", health: 92 },
  { name: "Financial Intelligence", status: "synced", records: "320K", lastSync: "10 min ago", health: 88 },
  { name: "Vehicle Registry", status: "offline", records: "5.1M", lastSync: "2 hours ago", health: 0 },
];

const statusColors = {
  synced: "bg-success/20 text-success border-success/30",
  syncing: "bg-warning/20 text-warning border-warning/30",
  offline: "bg-destructive/20 text-destructive border-destructive/30",
};

export default function DataFusionPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Data Fusion Hub</h1>
          <p className="text-muted-foreground">Centralized multi-agency data integration platform</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Upload className="w-4 h-4 mr-2" />
            Import Data
          </Button>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button>
            <RefreshCw className="w-4 h-4 mr-2" />
            Sync All
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-card border border-panel-border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20">
              <Database className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">9.95M</p>
              <p className="text-sm text-muted-foreground">Total Records</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-panel-border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/20">
              <Server className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">5/6</p>
              <p className="text-sm text-muted-foreground">Sources Online</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-panel-border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/20">
              <Activity className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">94.5%</p>
              <p className="text-sm text-muted-foreground">System Health</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-panel-border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <HardDrive className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">2.4 TB</p>
              <p className="text-sm text-muted-foreground">Data Storage</p>
            </div>
          </div>
        </div>
      </div>

      {/* Data Sources */}
      <div className="bg-card border border-panel-border rounded-lg">
        <div className="p-4 border-b border-panel-border">
          <h2 className="font-semibold">Connected Data Sources</h2>
        </div>
        <div className="divide-y divide-panel-border">
          {dataSources.map((source) => (
            <div key={source.name} className="p-4 flex items-center gap-4">
              <div className="p-2 rounded-lg bg-muted">
                <Database className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-medium">{source.name}</span>
                  <Badge className={statusColors[source.status as keyof typeof statusColors]}>
                    {source.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{source.records} records</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {source.lastSync}
                  </span>
                </div>
              </div>
              <div className="w-32">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span>Health</span>
                  <span>{source.health}%</span>
                </div>
                <Progress value={source.health} className="h-2" />
              </div>
              <Button variant="ghost" size="sm">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
