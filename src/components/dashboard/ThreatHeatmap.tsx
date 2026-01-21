import { useState } from "react";
import { MapPin, Maximize2, Filter, RefreshCw } from "lucide-react";

interface ThreatZone {
  id: string;
  name: string;
  x: number;
  y: number;
  level: 'critical' | 'high' | 'medium' | 'low';
  incidents: number;
  description: string;
}

const threatZones: ThreatZone[] = [
  { id: '1', name: 'Nairobi', x: 52, y: 58, level: 'high', incidents: 23, description: 'Urban crime hotspot' },
  { id: '2', name: 'Garissa', x: 68, y: 55, level: 'critical', incidents: 8, description: 'Cross-border threat zone' },
  { id: '3', name: 'Mombasa', x: 62, y: 72, level: 'medium', incidents: 12, description: 'Port security concern' },
  { id: '4', name: 'Turkana', x: 45, y: 25, level: 'high', incidents: 15, description: 'Livestock rustling area' },
  { id: '5', name: 'Mandera', x: 75, y: 35, level: 'critical', incidents: 6, description: 'Border security zone' },
  { id: '6', name: 'Kisumu', x: 38, y: 52, level: 'low', incidents: 5, description: 'Monitoring zone' },
  { id: '7', name: 'Nakuru', x: 45, y: 52, level: 'medium', incidents: 9, description: 'Transit corridor' },
  { id: '8', name: 'Lamu', x: 72, y: 62, level: 'high', incidents: 7, description: 'Maritime threat zone' },
];

const levelConfig = {
  critical: { color: 'bg-destructive', ring: 'ring-destructive/50', glow: 'shadow-destructive/50' },
  high: { color: 'bg-warning', ring: 'ring-warning/50', glow: 'shadow-warning/50' },
  medium: { color: 'bg-primary', ring: 'ring-primary/50', glow: 'shadow-primary/50' },
  low: { color: 'bg-success', ring: 'ring-success/50', glow: 'shadow-success/50' },
};

export function ThreatHeatmap() {
  const [selectedZone, setSelectedZone] = useState<ThreatZone | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 2000);
  };

  return (
    <div className="panel-glow flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-panel-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
            <MapPin className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Predictive Threat Heatmap</h2>
            <p className="text-xs text-muted-foreground font-mono">Real-time threat analysis • Kenya</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleRefresh}
            className="w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <button className="w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <Filter className="w-4 h-4" />
          </button>
          <button className="w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative p-4 min-h-[400px]">
        {/* Grid Background */}
        <div className="absolute inset-4 grid-pattern rounded-lg opacity-50" />
        
        {/* Kenya Outline - Simplified SVG */}
        <div className="absolute inset-4 flex items-center justify-center">
          <svg viewBox="0 0 100 100" className="w-full h-full max-w-[500px] max-h-[400px]">
            {/* Kenya simplified outline */}
            <path
              d="M35 20 L45 15 L55 18 L70 20 L80 30 L78 45 L75 55 L70 65 L65 75 L55 80 L45 75 L38 68 L35 60 L30 50 L32 40 L35 30 Z"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="0.5"
              opacity="0.3"
              className="drop-shadow-lg"
            />
            {/* Gradient fill */}
            <defs>
              <radialGradient id="mapGradient" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.02" />
              </radialGradient>
            </defs>
            <path
              d="M35 20 L45 15 L55 18 L70 20 L80 30 L78 45 L75 55 L70 65 L65 75 L55 80 L45 75 L38 68 L35 60 L30 50 L32 40 L35 30 Z"
              fill="url(#mapGradient)"
            />
          </svg>
        </div>

        {/* Threat Markers */}
        {threatZones.map((zone) => {
          const config = levelConfig[zone.level];
          return (
            <button
              key={zone.id}
              onClick={() => setSelectedZone(zone)}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 group"
              style={{ left: `${zone.x}%`, top: `${zone.y}%` }}
            >
              {/* Outer pulse ring */}
              <div className={`absolute inset-0 w-6 h-6 -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2 rounded-full ${config.color} opacity-30 animate-ping`} />
              
              {/* Main marker */}
              <div className={`relative w-4 h-4 rounded-full ${config.color} ring-2 ${config.ring} shadow-lg ${config.glow} cursor-pointer transition-transform group-hover:scale-125`}>
                {zone.level === 'critical' && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full animate-pulse" />
                )}
              </div>

              {/* Tooltip */}
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                <div className="bg-card border border-panel-border rounded-lg p-2 shadow-xl min-w-[120px]">
                  <p className="text-xs font-semibold text-foreground">{zone.name}</p>
                  <p className="text-[10px] text-muted-foreground">{zone.incidents} incidents</p>
                </div>
              </div>
            </button>
          );
        })}

        {/* Selected Zone Details */}
        {selectedZone && (
          <div className="absolute bottom-4 left-4 right-4 bg-card/95 backdrop-blur border border-panel-border rounded-lg p-4 animate-fade-in-up">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-3 h-3 rounded-full ${levelConfig[selectedZone.level].color}`} />
                  <h3 className="font-semibold text-foreground">{selectedZone.name}</h3>
                  <span className={`text-xs font-mono uppercase px-2 py-0.5 rounded ${
                    selectedZone.level === 'critical' ? 'bg-destructive/20 text-destructive' :
                    selectedZone.level === 'high' ? 'bg-warning/20 text-warning' :
                    selectedZone.level === 'medium' ? 'bg-primary/20 text-primary' :
                    'bg-success/20 text-success'
                  }`}>
                    {selectedZone.level}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{selectedZone.description}</p>
                <p className="text-xs text-muted-foreground mt-1 font-mono">
                  {selectedZone.incidents} active incidents • Last updated 2 min ago
                </p>
              </div>
              <button 
                onClick={() => setSelectedZone(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="p-4 border-t border-panel-border">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            {(['critical', 'high', 'medium', 'low'] as const).map((level) => (
              <div key={level} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full ${levelConfig[level].color}`} />
                <span className="text-muted-foreground capitalize">{level}</span>
              </div>
            ))}
          </div>
          <span className="text-muted-foreground font-mono">
            {threatZones.length} active zones
          </span>
        </div>
      </div>
    </div>
  );
}
