import { AlertTriangle, AlertCircle, Info, ChevronRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  location: string;
  time: string;
  description: string;
}

const alerts: Alert[] = [
  {
    id: '1',
    type: 'critical',
    title: 'IED Threat Detected',
    location: 'Garissa County',
    time: '2 min ago',
    description: 'AI flagged suspicious vehicle movement near checkpoint'
  },
  {
    id: '2',
    type: 'critical',
    title: 'Network Cluster Identified',
    location: 'Mandera',
    time: '8 min ago',
    description: '5 new connections mapped to known threat actor'
  },
  {
    id: '3',
    type: 'warning',
    title: 'Unusual Crowd Formation',
    location: 'Nairobi CBD',
    time: '15 min ago',
    description: 'CCTV anomaly detection triggered at intersection'
  },
  {
    id: '4',
    type: 'warning',
    title: 'Border Activity Spike',
    location: 'Somalia Border',
    time: '23 min ago',
    description: 'Increased movement patterns detected'
  },
  {
    id: '5',
    type: 'info',
    title: 'Patrol Unit Deployed',
    location: 'Lamu County',
    time: '45 min ago',
    description: 'Response team dispatched to maritime zone'
  },
];

const alertConfig = {
  critical: { 
    icon: AlertTriangle, 
    bg: 'bg-destructive/10', 
    border: 'border-destructive/30',
    iconColor: 'text-destructive',
    badge: 'bg-destructive text-destructive-foreground'
  },
  warning: { 
    icon: AlertCircle, 
    bg: 'bg-warning/10', 
    border: 'border-warning/30',
    iconColor: 'text-warning',
    badge: 'bg-warning text-warning-foreground'
  },
  info: { 
    icon: Info, 
    bg: 'bg-primary/10', 
    border: 'border-primary/30',
    iconColor: 'text-primary',
    badge: 'bg-primary text-primary-foreground'
  },
};

export function AlertsPanel() {
  const criticalCount = alerts.filter(a => a.type === 'critical').length;

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
        <div className="p-2 space-y-2 stagger-children">
          {alerts.map((alert) => {
            const config = alertConfig[alert.type];
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
                        {alert.type}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {alert.time}
                      </span>
                    </div>
                    <h3 className="text-sm font-medium text-foreground truncate">{alert.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{alert.location}</p>
                    <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-2">{alert.description}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-2" />
                </div>
              </div>
            );
          })}
        </div>
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
