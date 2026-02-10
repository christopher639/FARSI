import { useEffect, useState } from "react";
import { Network, RefreshCw } from "lucide-react";
import { apiGet } from "@/lib/api";

interface Node {
  id: string;
  label: string;
  type: "person" | "organization" | "location" | "vehicle";
  x: number;
  y: number;
  connections: string[];
  threat: boolean;
}

interface GraphNode {
  id: string;
  label: string;
  entity_type: string;
  metadata?: { x?: number; y?: number; threat?: boolean };
}

interface GraphEdge {
  id: string;
  source_id: string;
  target_id: string;
}

const nodeStyles = {
  person: { color: "fill-primary", stroke: "stroke-primary", bg: "bg-primary" },
  organization: { color: "fill-warning", stroke: "stroke-warning", bg: "bg-warning" },
  location: { color: "fill-success", stroke: "stroke-success", bg: "bg-success" },
  vehicle: { color: "fill-muted-foreground", stroke: "stroke-muted-foreground", bg: "bg-muted-foreground" },
};

export function NetworkGraph() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGraph = async () => {
    try {
      setLoading(true);
      setError(null);
      const [nodesData, edgesData] = await Promise.all([
        apiGet<GraphNode[]>("/graph/nodes"),
        apiGet<GraphEdge[]>("/graph/edges"),
      ]);

      if (!nodesData?.length) {
        setNodes([]);
        return;
      }

      const edgesBySource = new Map<string, string[]>();
      for (const edge of edgesData || []) {
        const list = edgesBySource.get(edge.source_id) || [];
        list.push(edge.target_id);
        edgesBySource.set(edge.source_id, list);
      }

      const mapped: Node[] = nodesData.map((n, idx) => ({
        id: n.id,
        label: n.label,
        type: (n.entity_type as Node["type"]) || "person",
        x: n.metadata?.x ?? (idx * 13) % 90 + 5,
        y: n.metadata?.y ?? (idx * 17) % 90 + 5,
        connections: edgesBySource.get(n.id) || [],
        threat: Boolean(n.metadata?.threat),
      }));

      setNodes(mapped);
    } catch (err: any) {
      setNodes([]);
      setError(err?.message || "Failed to load network graph");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGraph();
  }, []);

  return (
    <div className="panel-glow flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-panel-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center">
            <Network className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Network Analysis</h2>
            <p className="text-xs text-muted-foreground font-mono">
              {nodes.length} entities • {nodes.filter((n) => n.threat).length} flagged
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="w-7 h-7 rounded bg-secondary hover:bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            onClick={loadGraph}
            title="Refresh graph"
            disabled={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="flex-1 relative p-4 min-h-[200px]">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground z-10">
            Loading graph...
          </div>
        )}
        {!loading && error && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-destructive z-10 px-4 text-center">
            {error}
          </div>
        )}
        {!loading && !error && nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground z-10 px-4 text-center">
            No network graph data available.
          </div>
        )}

        <svg className="w-full h-full" viewBox="0 0 100 100">
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

          {nodes.map((node) => {
            const style = nodeStyles[node.type] || nodeStyles.person;
            return (
              <g key={node.id} className="cursor-pointer">
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
                <circle
                  cx={node.x}
                  cy={node.y}
                  r="3"
                  className={`${style.color} ${style.stroke}`}
                  strokeWidth="0.5"
                  opacity={node.threat ? 1 : 0.7}
                />
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
