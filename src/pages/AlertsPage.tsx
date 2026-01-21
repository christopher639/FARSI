import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { Bell, Filter, Download, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const alertStats = [
  { label: "Critical", count: 3, icon: XCircle, color: "text-destructive" },
  { label: "Warning", count: 5, icon: AlertTriangle, color: "text-warning" },
  { label: "Resolved", count: 12, icon: CheckCircle, color: "text-success" },
];

export default function AlertsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Security Alerts</h1>
          <p className="text-muted-foreground">Real-time threat notifications and incident tracking</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Alert Stats */}
      <div className="grid grid-cols-3 gap-4">
        {alertStats.map((stat) => (
          <div key={stat.label} className="bg-card border border-panel-border rounded-lg p-4 flex items-center gap-4">
            <div className={`p-3 rounded-lg bg-muted ${stat.color}`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stat.count}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Full Alerts Panel */}
      <div className="h-[calc(100vh-20rem)]">
        <AlertsPanel />
      </div>
    </div>
  );
}
