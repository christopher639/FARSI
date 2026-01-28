type HeatmapRow = {
  "AREA NAME": string;
  incident_count: number;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
};

export async function fetchHeatmap() {
  const res = await fetch("http://localhost:8000/ml/heatmap");
  if (!res.ok) throw new Error("Failed to load heatmap");
  return (await res.json()) as { rows: HeatmapRow[] };
}

export async function fetchSimulatedAlerts() {
  const res = await fetch("http://localhost:8000/simulate/alerts");
  if (!res.ok) throw new Error("Failed to load alerts");
  return (await res.json()) as {
    message: string;
    data: Array<{
      id: string;
      severity: string;
      status: string;
      location: string;
      source: string;
    }>;
  };
}
