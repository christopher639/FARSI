import { Activity, FileText, Camera, Radio, Database, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeedItem {
  id: string;
  type: 'report' | 'cctv' | 'comms' | 'data' | 'system';
  message: string;
  source: string;
  time: string;
}

const feedItems: FeedItem[] = [
  { id: '1', type: 'cctv', message: 'Facial recognition match: 87% confidence', source: 'CAM-NAI-042', time: '12:45:32' },
  { id: '2', type: 'report', message: 'NPS report submitted: Armed robbery suspect', source: 'Kilimani Station', time: '12:44:18' },
  { id: '3', type: 'data', message: 'Financial transaction flagged: KES 2.4M transfer', source: 'FIU Database', time: '12:43:55' },
  { id: '4', type: 'comms', message: 'Intercepted communication analyzed', source: 'SIGINT-07', time: '12:42:30' },
  { id: '5', type: 'system', message: 'Threat model updated: +3 new patterns', source: 'AI Engine', time: '12:41:00' },
  { id: '6', type: 'cctv', message: 'Vehicle identified: KBZ 234X', source: 'CAM-MBS-018', time: '12:40:22' },
  { id: '7', type: 'report', message: 'Border incident logged: Unauthorized crossing', source: 'Moyale Post', time: '12:38:45' },
];

const typeConfig = {
  report: { icon: FileText, color: 'text-primary', bg: 'bg-primary/10' },
  cctv: { icon: Camera, color: 'text-success', bg: 'bg-success/10' },
  comms: { icon: Radio, color: 'text-warning', bg: 'bg-warning/10' },
  data: { icon: Database, color: 'text-accent', bg: 'bg-accent/10' },
  system: { icon: Shield, color: 'text-muted-foreground', bg: 'bg-muted/50' },
};

export function ActivityFeed() {
  return (
    <div className="panel-glow flex flex-col h-full">
      {/* Header */}
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
          <span className="text-xs text-success font-mono">LIVE</span>
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto relative">
        {/* Scan line effect */}
        <div className="absolute inset-0 scan-line pointer-events-none" />
        
        <div className="p-2 space-y-1">
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
                      <span className="text-[10px] text-muted-foreground/70 font-mono">{item.time}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats Footer */}
      <div className="p-3 border-t border-panel-border bg-secondary/20">
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { label: 'Reports', value: '1,247' },
            { label: 'CCTV', value: '89' },
            { label: 'SIGINT', value: '34' },
            { label: 'Financial', value: '156' },
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
