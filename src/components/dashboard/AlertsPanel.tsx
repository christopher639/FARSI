import { AlertTriangle, AlertCircle, Info, ChevronRight, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useThreatAlerts } from "@/hooks/useThreatAlerts";
import { formatDistanceToNow } from "date-fns";

const severityConfig = {
  critical: { 
    icon: AlertTriangle, 
    bg: 'bg-destructive/10', 
    border: 'border-destructive/30',
    iconColor: 'text-destructive',
    badge: 'bg-destructive text-destructive-foreground'
  },
  high: { 
    icon: AlertCircle, 
    bg: 'bg-warning/10', 
    border: 'border-warning/30',
    iconColor: 'text-warning',
    badge: 'bg-warning text-warning-foreground'
  },
  medium: { 
    icon: AlertCircle, 
    bg: 'bg-primary/10', 
    border: 'border-primary/30',
    iconColor: 'text-primary',
    badge: 'bg-primary text-primary-foreground'
  },
  low: { 
    icon: Info, 
    bg: 'bg-muted/50', 
    border: 'border-muted-foreground/20',
    iconColor: 'text-muted-foreground',
    badge: 'bg-muted text-muted-foreground'
  },
  info: { 
    icon: Info, 
    bg: 'bg-success/10', 
    border: 'border-success/30',
    iconColor: 'text-success',
    badge: 'bg-success text-success-foreground'
  },
};

export function AlertsPanel() {
  const { alerts, loading } = useThreatAlerts();
  
  const displayAlerts = alerts.slice(0, 10);
  const criticalCount = alerts.filter(a => a.severity === 'critical').length;

  return (
    <div className="panel-glow flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-panel-border">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 rounded-lg bg-destructive/10 border border-destructive/30 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-destructive" />
            </div>
            {criticalCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1 pulse-glow">
                {criticalCount}
              </span>
            )}
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Live Alerts</h2>
            <p className="text-xs text-muted-foreground font-mono">{alerts.length} active alerts</p>
          </div>
        </div>
        <button className="text-xs text-primary hover:text-primary/80 font-medium transition-colors">
          View All
        </button>
      </div>

      {/* Alerts List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : displayAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <AlertTriangle className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">No active alerts</p>
          </div>
        ) : (
          <div className="p-2 space-y-2 stagger-children">
            {displayAlerts.map((alert) => {
              const severity = alert.severity || 'medium';
              const config = severityConfig[severity as keyof typeof severityConfig] || severityConfig.medium;
              const Icon = config.icon;
              
              return (
                <div
                  key={alert.id}
                  className={cn(
                    "p-3 rounded-lg border cursor-pointer transition-all hover:bg-secondary/50 group",
                    config.bg,
                    config.border
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn("mt-0.5", config.iconColor)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={cn(
                          "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded",
                          config.badge
                        )}>
                          {severity}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <h3 className="text-sm font-medium text-foreground truncate">{alert.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{alert.location || 'Unknown location'}</p>
                      {alert.description && (
                        <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-2">{alert.description}</p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-2" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-panel-border">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-mono">Auto-refresh: 30s</span>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span>Live</span>
          </div>
        </div>
      </div>
    </div>
  );
}
