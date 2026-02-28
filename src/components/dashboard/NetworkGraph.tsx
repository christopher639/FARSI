import { useCallback, useEffect, useState } from "react";
import { Network, RefreshCw } from "lucide-react";
import { apiGet } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";

interface Node {
  id: string;
  label: string;
  type: "person" | "organization" | "location" | "vehicle" | "infrastructure";
  x: number;
  y: number;
  connections: string[];
  threat: boolean;
  riskScore: number;
}

interface GraphNode {
  id: string;
  label: string;
  entity_type: string;
  metadata?: { x?: number; y?: number; threat?: boolean; risk_score?: number };
  properties?: { x?: number; y?: number; threat?: boolean; risk_score?: number };
}

interface GraphEdge {
  id: string;
  source_id: string;
  target_id: string;
}

interface HiddenConnection {
  source_id: string;
  target_id: string;
  score: number;
}

interface GraphIntelligenceResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  hidden_connections: HiddenConnection[];
  gnn?: { top_entities?: Array<{ id: string; risk: number }> };
}

const nodeStyles = {
  person: { color: "fill-primary", stroke: "stroke-primary", bg: "bg-primary" },
  organization: { color: "fill-warning", stroke: "stroke-warning", bg: "bg-warning" },
  location: { color: "fill-success", stroke: "stroke-success", bg: "bg-success" },
  vehicle: { color: "fill-muted-foreground", stroke: "stroke-muted-foreground", bg: "bg-muted-foreground" },
  infrastructure: { color: "fill-accent", stroke: "stroke-accent", bg: "bg-accent" },
};

export function NetworkGraph() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [hiddenConnections, setHiddenConnections] = useState<HiddenConnection[]>([]);
  const [topRiskCount, setTopRiskCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGraph = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const intelligence = await apiGet<GraphIntelligenceResponse>("/graph/intelligence");
      const nodesData = intelligence?.nodes || [];
      const edgesData = intelligence?.edges || [];

      if (!nodesData?.length) {
        setNodes([]);
        setHiddenConnections([]);
        setTopRiskCount(0);
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
        x: n.metadata?.x ?? n.properties?.x ?? (idx * 13) % 90 + 5,
        y: n.metadata?.y ?? n.properties?.y ?? (idx * 17) % 90 + 5,
        connections: edgesBySource.get(n.id) || [],
        threat: Boolean(n.metadata?.threat ?? n.properties?.threat),
        riskScore: Number(n.metadata?.risk_score ?? n.properties?.risk_score ?? 0),
      }));

      setNodes(mapped);
      setHiddenConnections(intelligence?.hidden_connections || []);
      setTopRiskCount(intelligence?.gnn?.top_entities?.length || 0);
    } catch (err: unknown) {
      setNodes([]);
      setHiddenConnections([]);
      setTopRiskCount(0);
      setError(getErrorMessage(err, "Failed to load network graph"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGraph();
  }, [loadGraph]);

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
              {nodes.length} entities | {nodes.filter((n) => n.threat).length} flagged | {hiddenConnections.length} hidden links
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
          {hiddenConnections.map((link) => {
            const source = nodes.find((n) => n.id === link.source_id);
            const target = nodes.find((n) => n.id === link.target_id);
            if (!source || !target) return null;
            return (
              <line
                key={`hidden-${link.source_id}-${link.target_id}`}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke="hsl(var(--warning))"
                strokeWidth="0.25"
                opacity="0.5"
                strokeDasharray="1 1"
              />
            );
          })}

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
                  opacity={node.threat ? 1 : Math.max(0.35, node.riskScore)}
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
          <span className="text-muted-foreground font-mono">Top risk entities: {topRiskCount}</span>
        </div>
      </div>
    </div>
  );
}
