import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Brain, Search, RefreshCw, Loader2, Tag, MessageSquare, Eye, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";

type InferenceResult = {
  id: string;
  event_id: string | null;
  model_id: string | null;
  result: any;
  created_at: string;
  event_title?: string;
  event_type?: string;
  model_name?: string;
  model_type?: string;
};

type MLModel = {
  id: string;
  name: string;
  version: string;
  model_type: string;
  framework: string;
};

export default function MLIntelligencePage() {
  const [results, setResults] = useState<InferenceResult[]>([]);
  const [models, setModels] = useState<MLModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [inferenceRes, modelsRes, eventsRes] = await Promise.all([
        supabase.from("ml_inference_results").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("ml_models").select("*"),
        supabase.from("ingestion_events").select("id, title, event_type"),
      ]);

      const modelsData = modelsRes.data || [];
      const eventsData = eventsRes.data || [];
      setModels(modelsData as MLModel[]);

      const modelsMap = new Map(modelsData.map((m: any) => [m.id, m]));
      const eventsMap = new Map(eventsData.map((e: any) => [e.id, e]));

      const enriched: InferenceResult[] = (inferenceRes.data || []).map((r: any) => {
        const model = modelsMap.get(r.model_id);
        const event = eventsMap.get(r.event_id);
        return {
          ...r,
          event_title: event?.title || "Unknown Event",
          event_type: event?.event_type || "",
          model_name: model?.name || "Unknown Model",
          model_type: model?.model_type || "unknown",
        };
      });

      setResults(enriched);
    } catch (err) {
      console.error("Failed to fetch ML intelligence data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    return results.filter((r) => {
      const matchesSearch =
        r.event_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.model_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        JSON.stringify(r.result).toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType =
        filterType === "all" || r.model_type === filterType;
      return matchesSearch && matchesType;
    });
  }, [results, searchQuery, filterType]);

  const stats = useMemo(() => ({
    total: results.length,
    nlp: results.filter((r) => r.model_type === "nlp").length,
    cv: results.filter((r) => r.model_type === "cv").length,
    models: models.length,
  }), [results, models]);

  const renderNlpResult = (result: any) => {
    const entities = result?.entities || [];
    const sentiment = result?.sentiment || [];

    return (
      <div className="space-y-3">
        {entities.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
              <Tag className="w-3 h-3" /> Named Entities ({entities.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {entities.slice(0, 20).map((e: any, i: number) => (
                <Badge key={i} variant="outline" className="text-xs">
                  <span className="font-semibold">{e.word || e.entity_group || "?"}</span>
                  {e.entity_group && (
                    <span className="ml-1 text-muted-foreground">({e.entity_group})</span>
                  )}
                  {e.score != null && (
                    <span className="ml-1 text-primary">{(e.score * 100).toFixed(0)}%</span>
                  )}
                </Badge>
              ))}
              {entities.length > 20 && (
                <span className="text-xs text-muted-foreground">+{entities.length - 20} more</span>
              )}
            </div>
          </div>
        )}
        {sentiment.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
              <MessageSquare className="w-3 h-3" /> Sentiment
            </p>
            <div className="flex flex-wrap gap-1.5">
              {sentiment.map((s: any, i: number) => {
                const label = (s.label || "").toLowerCase();
                const color =
                  label.includes("positive") ? "bg-success/20 text-success border-success/30" :
                  label.includes("negative") ? "bg-destructive/20 text-destructive border-destructive/30" :
                  "bg-muted text-muted-foreground";
                return (
                  <Badge key={i} className={color}>
                    {s.label} ({(s.score * 100).toFixed(0)}%)
                  </Badge>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCvResult = (result: any) => {
    const detections = result?.detections || [];

    return (
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
          <Eye className="w-3 h-3" /> Object Detections ({detections.length})
        </p>
        {detections.length === 0 ? (
          <p className="text-xs text-muted-foreground">No objects detected</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {detections.slice(0, 15).map((d: any, i: number) => (
              <Badge key={i} variant="outline" className="text-xs">
                <span className="font-semibold">{d.label || "object"}</span>
                {d.score != null && (
                  <span className="ml-1 text-primary">{(d.score * 100).toFixed(0)}%</span>
                )}
              </Badge>
            ))}
            {detections.length > 15 && (
              <span className="text-xs text-muted-foreground">+{detections.length - 15} more</span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">ML Intelligence Engine</h1>
          <p className="text-sm text-muted-foreground">
            NLP entity extraction, sentiment analysis & computer vision results
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Results", value: stats.total, icon: Layers, color: "bg-primary/20 text-primary" },
          { label: "NLP Results", value: stats.nlp, icon: Tag, color: "bg-success/20 text-success" },
          { label: "CV Results", value: stats.cv, icon: Eye, color: "bg-warning/20 text-warning" },
          { label: "Registered Models", value: stats.models, icon: Brain, color: "bg-accent/20 text-accent-foreground" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-panel-border rounded-lg p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${s.color}`}>
              <s.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search entities, models, events..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="nlp">NLP Only</SelectItem>
            <SelectItem value="cv">Computer Vision</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No inference results found</p>
          <p className="text-xs mt-1">Run the ML inference pipeline to generate NLP and CV results</p>
        </div>
      ) : (
        <ScrollArea className="h-[calc(100vh-22rem)]">
          <div className="space-y-3 pr-4">
            {filtered.map((r) => (
              <div
                key={r.id}
                className="bg-card border border-panel-border rounded-lg p-4 hover:border-primary/30 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-primary border-primary/30">
                        {r.model_type === "nlp" ? "NLP" : r.model_type === "cv" ? "Computer Vision" : r.model_type}
                      </Badge>
                      <Badge variant="outline">{r.model_name}</Badge>
                      <span className="text-xs text-muted-foreground font-mono">
                        {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-foreground">{r.event_title}</p>
                    {r.event_type && (
                      <p className="text-xs text-muted-foreground">Event: {r.event_type}</p>
                    )}
                  </div>
                </div>

                {r.model_type === "nlp" ? renderNlpResult(r.result) : r.model_type === "cv" ? renderCvResult(r.result) : (
                  <pre className="text-xs bg-muted/50 p-2 rounded overflow-auto max-h-32">
                    {JSON.stringify(r.result, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
