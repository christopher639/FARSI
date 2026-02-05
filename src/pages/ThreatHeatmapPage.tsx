import { ThreatHeatmap } from "@/components/dashboard/ThreatHeatmap";

export default function ThreatHeatmapPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Crime Map and Heatmap</h1>
        <p className="text-muted-foreground">Interactive view of reported crime locations</p>
      </div>
      <div className="h-[calc(100vh-12rem)]">
        <ThreatHeatmap />
      </div>
    </div>
  );
}