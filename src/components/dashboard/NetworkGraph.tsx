import { Network, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

interface Node {
  id: string;
  label: string;
  type: 'person' | 'organization' | 'location' | 'vehicle';
  x: number;
  y: number;
  connections: string[];
  threat: boolean;
}

const nodes: Node[] = [
  { id: '1', label: 'SUBJECT-A', type: 'person', x: 50, y: 30, connections: ['2', '3', '5'], threat: true },
  { id: '2', label: 'ORG-X', type: 'organization', x: 25, y: 50, connections: ['1', '4'], threat: false },
  { id: '3', label: 'SUBJECT-B', type: 'person', x: 75, y: 45, connections: ['1', '6'], threat: true },
  { id: '4', label: 'LOC-ALPHA', type: 'location', x: 20, y: 75, connections: ['2'], threat: false },
  { id: '5', label: 'VEH-001', type: 'vehicle', x: 55, y: 65, connections: ['1', '6'], threat: false },
  { id: '6', label: 'SUBJECT-C', type: 'person', x: 80, y: 70, connections: ['3', '5'], threat: true },
];

const nodeStyles = {
  person: { color: 'fill-primary', stroke: 'stroke-primary', bg: 'bg-primary' },
  organization: { color: 'fill-warning', stroke: 'stroke-warning', bg: 'bg-warning' },
  location: { color: 'fill-success', stroke: 'stroke-success', bg: 'bg-success' },
  vehicle: { color: 'fill-muted-foreground', stroke: 'stroke-muted-foreground', bg: 'bg-muted-foreground' },
};

export function NetworkGraph() {
  return (
    <div className="panel-glow flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-panel-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center">
            <Network className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Network Analysis</h2>
            <p className="text-xs text-muted-foreground font-mono">{nodes.length} entities • {nodes.filter(n => n.threat).length} flagged</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button className="w-7 h-7 rounded bg-secondary hover:bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button className="w-7 h-7 rounded bg-secondary hover:bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button className="w-7 h-7 rounded bg-secondary hover:bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Graph */}
      <div className="flex-1 relative p-4 min-h-[200px]">
        <svg className="w-full h-full" viewBox="0 0 100 100">
          {/* Connection Lines */}
          {nodes.map((node) =>
            node.connections.map((targetId) => {
              const target = nodes.find((n) => n.id === targetId);
              if (!target || node.id > targetId) return null;
              return (
                <line
                  key={`${node.id}-${targetId}`}
                  x1={node.x}
                  y1={node.y}
                  x2={target.x}
                  y2={target.y}
                  stroke="hsl(var(--primary))"
                  strokeWidth="0.3"
                  opacity="0.4"
                />
              );
            })
          )}

          {/* Nodes */}
          {nodes.map((node) => {
            const style = nodeStyles[node.type];
            return (
              <g key={node.id} className="cursor-pointer">
                {/* Threat indicator ring */}
                {node.threat && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r="5"
                    fill="none"
                    stroke="hsl(var(--destructive))"
                    strokeWidth="0.3"
                    opacity="0.5"
                    className="animate-ping"
                  />
                )}
                {/* Node circle */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r="3"
                  className={`${style.color} ${style.stroke}`}
                  strokeWidth="0.5"
                  opacity={node.threat ? 1 : 0.7}
                />
                {/* Label */}
                <text
                  x={node.x}
                  y={node.y + 7}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[2.5px] font-mono"
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="p-3 border-t border-panel-border">
        <div className="flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-3">
            {Object.entries(nodeStyles).map(([type, style]) => (
              <div key={type} className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${style.bg}`} />
                <span className="text-muted-foreground capitalize">{type}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
