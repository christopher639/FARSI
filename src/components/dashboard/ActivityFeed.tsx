import { useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { Activity, AlertTriangle, Camera, FileText, Radio, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useThreatAlerts } from "@/hooks/useThreatAlerts";
import { useSurveillanceLogs } from "@/hooks/useSurveillanceLogs";
import { useCommunications } from "@/hooks/useCommunications";
import { useIntelligenceReports } from "@/hooks/useIntelligenceReports";

interface FeedItem {
  id: string;
  type: "report" | "cctv" | "comms" | "alert" | "system";
  message: string;
  source: string;
  timestamp: string;
}

const typeConfig = {
  report: { icon: FileText, color: "text-primary", bg: "bg-primary/10" },
  cctv: { icon: Camera, color: "text-success", bg: "bg-success/10" },
  comms: { icon: Radio, color: "text-warning", bg: "bg-warning/10" },
  alert: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
  system: { icon: Shield, color: "text-muted-foreground", bg: "bg-muted/50" },
};

export function ActivityFeed() {
  const { alerts, loading: alertsLoading } = useThreatAlerts();
  const { logs, loading: logsLoading } = useSurveillanceLogs();
  const { communications, loading: commsLoading } = useCommunications();
  const { reports, loading: reportsLoading } = useIntelligenceReports();

  const loading = alertsLoading || logsLoading || commsLoading || reportsLoading;

  const feedItems = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [];

    for (const alert of alerts) {
      items.push({
        id: `alert-${alert.id}`,
        type: "alert",
        message: alert.title,
        source: alert.location || alert.source || "Threat monitoring",
        timestamp: alert.created_at,
      });
    }

    for (const log of logs) {
      items.push({
        id: `surveillance-${log.id}`,
        type: "cctv",
        message: log.event_description || log.event_type,
        source: log.location || log.recorded_by || "Surveillance node",
        timestamp: log.timestamp,
      });
    }

    for (const comm of communications) {
      items.push({
        id: `comms-${comm.id}`,
        type: "comms",
        message: comm.content_summary || `${comm.channel_type} communication`,
        source: comm.sender || comm.recipient || comm.channel_type || "Secure channel",
        timestamp: comm.timestamp || comm.created_at,
      });
    }

    for (const report of reports) {
      items.push({
        id: `report-${report.id}`,
        type: "report",
        message: report.title,
        source: report.source || report.category || "Intelligence desk",
        timestamp: report.created_at,
      });
    }

    return items
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 50);
  }, [alerts, logs, communications, reports]);

  return (
    <div className="panel-glow flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-panel-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-success/10 border border-success/30 flex items-center justify-center">
            <Activity className="w-4 h-4 text-success" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Data Stream</h2>
            <p className="text-xs text-muted-foreground font-mono">Multi-source intelligence feed</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          <span className="text-xs text-success font-mono">{loading ? "SYNCING" : "LIVE"}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto relative">
        <div className="absolute inset-0 scan-line pointer-events-none" />

        <div className="p-2 space-y-1">
          {!loading && feedItems.length === 0 && (
            <div className="text-xs text-muted-foreground p-3">No activity available yet.</div>
          )}
          {feedItems.map((item, index) => {
            const config = typeConfig[item.type];
            const Icon = config.icon;

            return (
              <div
                key={item.id}
                className={cn(
                  "p-2 rounded hover:bg-secondary/30 transition-colors cursor-pointer group",
                  "animate-fade-in-up"
                )}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="flex items-start gap-2">
                  <div className={cn("w-6 h-6 rounded flex items-center justify-center flex-shrink-0", config.bg)}>
                    <Icon className={cn("w-3 h-3", config.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground truncate group-hover:text-primary transition-colors">
                      {item.message}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground font-mono">{item.source}</span>
                      <span className="text-[10px] text-muted-foreground/50">•</span>
                      <span className="text-[10px] text-muted-foreground/70 font-mono">
                        {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-3 border-t border-panel-border bg-secondary/20">
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { label: "Reports", value: reports.length.toLocaleString() },
            { label: "CCTV", value: logs.length.toLocaleString() },
            { label: "Comms", value: communications.length.toLocaleString() },
            { label: "Alerts", value: alerts.length.toLocaleString() },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-sm font-bold font-mono text-foreground">{stat.value}</p>
              <p className="text-[9px] text-muted-foreground uppercase">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
