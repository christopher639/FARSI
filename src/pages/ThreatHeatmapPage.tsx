import { ThreatHeatmap } from "@/components/dashboard/ThreatHeatmap";

export default function ThreatHeatmapPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Predictive Threat Heatmap</h1>
        <p className="text-muted-foreground">AI-powered threat prediction across Kenya's regions</p>
      </div>
      <div className="h-[calc(100vh-12rem)]">
        <ThreatHeatmap />
      </div>
    </div>
  );
}
