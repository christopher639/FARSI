import { useCallback, useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip, useMap } from "react-leaflet";
import { MapPin, RefreshCw, Layers, AlertTriangle, Maximize2, Minimize2 } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { apiGet } from "@/lib/api";

const CSV_URL = "/data/crime/2025-11-kenya-simulated-street.csv";
const SUPABASE_TABLE = import.meta.env.VITE_CRIME_SUPABASE_TABLE || "crime_events";
const SUPABASE_ENABLED = Boolean(import.meta.env.VITE_SUPABASE_URL);
const DEFAULT_SOURCE: DataSource =
  import.meta.env.VITE_CRIME_SOURCE === "csv"
    ? "csv"
    : import.meta.env.VITE_CRIME_SOURCE === "backend"
    ? "backend"
    : SUPABASE_ENABLED
    ? "supabase"
    : "csv";

const CRIME_SEVERITY: Record<string, number> = {
  "Anti-social behaviour": 2,
  Burglary: 4,
  "Criminal damage and arson": 3,
  Drugs: 4,
  "Other theft": 2,
  "Possession of weapons": 5,
  "Public order": 3,
  Robbery: 5,
  Shoplifting: 2,
  "Vehicle crime": 3,
  "Violence and sexual offences": 5,
};

type CrimeRecord = {
  latitude: number;
  longitude: number;
  crimeType: string;
  month?: string;
  location?: string;
  score?: number;
  areaName?: string;
  outcome?: string;
  context?: string;
};

type AreaRisk = {
  areaName: string;
  incidents: number;
  ratePer100: number;
  avgSeverity: number;
  openCaseRate: number;
  borderExposure: number;
  riskScore: number;
  tier: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  centroid: [number, number];
};

type DataSource = "csv" | "supabase" | "backend";
type MapView = "heatmap" | "points";
type SupabaseCrimeRow = {
  latitude: number | string;
  longitude: number | string;
  crime_type?: string | null;
  month?: string | null;
  location?: string | null;
  lsoa_name?: string | null;
  last_outcome_category?: string | null;
  context?: string | null;
};

type HeatmapSummary = {
  area: string;
  incidents: number;
  avg_severity: number;
  open_case_rate: number;
  border_exposure_rate: number;
  risk_score: number;
  tier: AreaRisk["tier"];
  centroid: [number, number];
  last_reported_at: string | null;
};

function FitBounds({ points }: { points: Array<[number, number]> }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;
    const bounds = L.latLngBounds(points.map(([lat, lng]) => L.latLng(lat, lng)));
    map.fitBounds(bounds, { padding: [24, 24] });
  }, [map, points]);

  return null;
}

function HeatmapLayer({ points }: { points: Array<[number, number, number]> }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;
    const layer = (L as any).heatLayer(points, {
      radius: 18,
      blur: 14,
      maxZoom: 12,
    });
    layer.addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [map, points]);

  return null;
}

function ResizeMap({ trigger }: { trigger: boolean }) {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 60);
    return () => clearTimeout(timer);
  }, [map, trigger]);

  return null;
}

function parseAreaFromLsoa(lsoaName?: string) {
  if (!lsoaName) return "Unknown";
  const match = lsoaName.match(/^(.*?)\s+Ward\s+\d+/i);
  return match?.[1]?.trim() || lsoaName.trim() || "Unknown";
}

function parseAreaFromLocation(location?: string) {
  if (!location) return "Unknown";
  const parts = location.split(",");
  const fallback = parts[parts.length - 1]?.trim();
  return fallback || "Unknown";
}

function severityOf(crimeType: string) {
  return CRIME_SEVERITY[crimeType] ?? 3;
}

function markerColorForSeverity(crimeType: string) {
  const sev = severityOf(crimeType);
  if (sev >= 5) return "#ef4444";
  if (sev >= 4) return "#f97316";
  if (sev >= 3) return "#eab308";
  return "#22c55e";
}

function tierFromScore(score: number): AreaRisk["tier"] {
  if (score >= 75) return "CRITICAL";
  if (score >= 55) return "HIGH";
  if (score >= 35) return "MEDIUM";
  return "LOW";
}

function tierClass(tier: AreaRisk["tier"]) {
  if (tier === "CRITICAL") return "text-red-400";
  if (tier === "HIGH") return "text-orange-400";
  if (tier === "MEDIUM") return "text-yellow-400";
  return "text-green-400";
}

function riskColor(tier: AreaRisk["tier"]) {
  if (tier === "CRITICAL") return "#dc2626";
  if (tier === "HIGH") return "#ea580c";
  if (tier === "MEDIUM") return "#ca8a04";
  return "#16a34a";
}

function formatTimestamp(value: string | null) {
  if (!value) return "Unknown";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return "Unknown";
  return new Date(parsed).toLocaleString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

export function ThreatHeatmap() {
  const [source, setSource] = useState<DataSource>(DEFAULT_SOURCE);
  const [view, setView] = useState<MapView>("points");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<CrimeRecord[]>([]);
  const [selectedType, setSelectedType] = useState<string>("All");
  const [selectedArea, setSelectedArea] = useState<string>("All");
  const [heatmapSummary, setHeatmapSummary] = useState<HeatmapSummary[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showRiskOverlay, setShowRiskOverlay] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const data = await apiGet<HeatmapSummary[]>("/heatmap/summary");
      setHeatmapSummary(data);
    } catch (err: unknown) {
      setSummaryError(err instanceof Error ? err.message : "Failed to load heatmap summary");
      setHeatmapSummary([]);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const loadFromCsv = useCallback(async () => {
    const res = await fetch(CSV_URL);
    if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
    const text = await res.text();
    const parsed = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
    });

    if (parsed.errors?.length) {
      console.warn("CSV parse warnings:", parsed.errors);
    }

    const rows = (parsed.data || []) as Array<Record<string, string>>;
    const cleaned: CrimeRecord[] = rows
      .map((row) => ({
        latitude: Number(row.Latitude),
        longitude: Number(row.Longitude),
        crimeType: row["Crime type"] || "Unknown",
        month: row.Month,
        location: row.Location,
        areaName: parseAreaFromLsoa(row["LSOA name"]) || parseAreaFromLocation(row.Location),
        outcome: row["Last outcome category"] || "",
        context: row.Context || "",
      }))
      .filter((r) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude));

    return cleaned;
  }, []);

  const loadFromSupabase = useCallback(async () => {
    const { data, error } = await supabase
      .from(SUPABASE_TABLE)
      .select("latitude, longitude, crime_type, month, location, lsoa_name, last_outcome_category, context");

    if (error) throw error;

    const cleaned: CrimeRecord[] = ((data || []) as unknown as SupabaseCrimeRow[])
      .map((row) => ({
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        crimeType: row.crime_type || "Unknown",
        month: row.month,
        location: row.location,
        areaName: parseAreaFromLsoa(row.lsoa_name) || parseAreaFromLocation(row.location),
        outcome: row.last_outcome_category || "",
        context: row.context || "",
      }))
      .filter((r: CrimeRecord) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude));

    return cleaned;
  }, []);

  const loadFromBackend = useCallback(async () => {
    const data = await apiGet<Array<{ lat: number; lon: number; score: number }>>("/heatmap");
    const cleaned: CrimeRecord[] = (data || []).map((row) => ({
      latitude: Number(row.lat),
      longitude: Number(row.lon),
      crimeType: "Heatmap Cell",
      score: row.score,
      areaName: "Unknown",
      context: "",
      outcome: "",
    }));
    return cleaned;
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const loaded =
        source === "supabase" ? await loadFromSupabase() : source === "backend" ? await loadFromBackend() : await loadFromCsv();
      setRecords(loaded);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load crime data");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [loadFromBackend, loadFromCsv, loadFromSupabase, source]);

  useEffect(() => {
    void loadData();
    void fetchSummary();
  }, [loadData, fetchSummary]);

  const crimeTypes = useMemo(() => {
    const unique = new Set(records.map((r) => r.crimeType).filter(Boolean));
    return ["All", ...Array.from(unique).sort()];
  }, [records]);

  const areas = useMemo(() => {
    const unique = new Set(records.map((r) => r.areaName || "Unknown"));
    return ["All", ...Array.from(unique).sort()];
  }, [records]);

  const filtered = useMemo(() => {
    return records.filter((r) => {
      const passType = selectedType === "All" || r.crimeType === selectedType;
      const passArea = selectedArea === "All" || (r.areaName || "Unknown") === selectedArea;
      return passType && passArea;
    });
  }, [records, selectedType, selectedArea]);

  const points = useMemo(() => filtered.map((r) => [r.latitude, r.longitude] as [number, number]), [filtered]);

  const heatPoints = useMemo(
    () => filtered.map((r) => [r.latitude, r.longitude, r.score ?? severityOf(r.crimeType)] as [number, number, number]),
    [filtered]
  );

  const vulnerableAreas = useMemo(() => {
    if (!filtered.length) return [] as AreaRisk[];

    const byArea = new Map<
      string,
      {
        incidents: number;
        severitySum: number;
        openCases: number;
        borderIncidents: number;
        latSum: number;
        lonSum: number;
      }
    >();

    for (const rec of filtered) {
      const key = rec.areaName || "Unknown";
      const stat = byArea.get(key) || {
        incidents: 0,
        severitySum: 0,
        openCases: 0,
        borderIncidents: 0,
        latSum: 0,
        lonSum: 0,
      };

      stat.incidents += 1;
      stat.severitySum += severityOf(rec.crimeType);
      stat.latSum += rec.latitude;
      stat.lonSum += rec.longitude;

      const outcome = (rec.outcome || "").toLowerCase();
      if (outcome.includes("under investigation") || outcome.includes("awaiting")) {
        stat.openCases += 1;
      }

      const context = (rec.context || "").toLowerCase();
      if (context.includes("border")) {
        stat.borderIncidents += 1;
      }

      byArea.set(key, stat);
    }

    const maxIncidents = Math.max(...Array.from(byArea.values()).map((v) => v.incidents), 1);

    const ranked: AreaRisk[] = Array.from(byArea.entries()).map(([areaName, stat]) => {
      const incidents = stat.incidents;
      const incidentRateNorm = incidents / maxIncidents;
      const avgSeverity = stat.severitySum / incidents;
      const severityNorm = avgSeverity / 5;
      const openCaseRate = stat.openCases / incidents;
      const borderExposure = stat.borderIncidents / incidents;

      const riskScore =
        100 * (0.4 * incidentRateNorm + 0.25 * severityNorm + 0.2 * openCaseRate + 0.15 * borderExposure);

      return {
        areaName,
        incidents,
        ratePer100: (incidents / filtered.length) * 100,
        avgSeverity,
        openCaseRate,
        borderExposure,
        riskScore,
        tier: tierFromScore(riskScore),
        centroid: [stat.latSum / incidents, stat.lonSum / incidents],
      };
    });

    return ranked.sort((a, b) => b.riskScore - a.riskScore);
  }, [filtered]);

  const topVulnerable = useMemo(() => vulnerableAreas.slice(0, 10), [vulnerableAreas]);
  const summaryCriticalHighCount = useMemo(
    () => heatmapSummary.filter((area) => area.tier === "CRITICAL" || area.tier === "HIGH").length,
    [heatmapSummary]
  );
  const summaryAvgRiskScore = useMemo(() => {
    if (!heatmapSummary.length) return 0;
    return heatmapSummary.reduce((sum, area) => sum + area.risk_score, 0) / heatmapSummary.length;
  }, [heatmapSummary]);
  const summaryLatestReportedAt = useMemo(() => {
    let latest: string | null = null;
    let latestTimestamp = 0;
    for (const area of heatmapSummary) {
      if (!area.last_reported_at) continue;
      const ts = Date.parse(area.last_reported_at);
      if (Number.isNaN(ts)) continue;
      if (!latest || ts > latestTimestamp) {
        latest = area.last_reported_at;
        latestTimestamp = ts;
      }
    }
    return latest;
  }, [heatmapSummary]);
  const summaryTopAreas = useMemo(() => heatmapSummary.slice(0, 8), [heatmapSummary]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadData(), fetchSummary()]);
    setRefreshing(false);
  };

  const supabaseEnabled = SUPABASE_ENABLED;

  return (
    <div
      className={
        isExpanded
          ? "panel-glow fixed inset-0 z-[80] flex flex-col bg-background rounded-none border-0"
          : "panel-glow flex flex-col h-full"
      }
    >
      <div className="flex flex-col gap-3 p-4 border-b border-panel-border lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
            <MapPin className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Crime Risk & Vulnerability Map</h2>
            <p className="text-xs text-muted-foreground font-mono">Hotspots, area risk scores, and deployment priorities</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="text-muted-foreground">Source</label>
          <select
            className="bg-secondary border border-panel-border rounded px-2 py-1 text-xs"
            value={source}
            onChange={(e) => setSource(e.target.value as DataSource)}
          >
            <option value="csv">CSV (local)</option>
            <option value="supabase" disabled={!supabaseEnabled}>
              Supabase {supabaseEnabled ? "" : "(not configured)"}
            </option>
            <option value="backend">Backend Heatmap</option>
          </select>

          <label className="text-muted-foreground ml-2">View</label>
          <select
            className="bg-secondary border border-panel-border rounded px-2 py-1 text-xs"
            value={view}
            onChange={(e) => setView(e.target.value as MapView)}
          >
            <option value="heatmap">Heatmap</option>
            <option value="points">Points</option>
          </select>

          <label className="text-muted-foreground ml-2">Crime type</label>
          <select
            className="bg-secondary border border-panel-border rounded px-2 py-1 text-xs max-w-[200px]"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            {crimeTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <label className="text-muted-foreground ml-2">Area</label>
          <select
            className="bg-secondary border border-panel-border rounded px-2 py-1 text-xs max-w-[180px]"
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
          >
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowRiskOverlay((v) => !v)}
            className="px-2 py-1 rounded border border-panel-border bg-secondary hover:bg-secondary/80"
            title="Toggle vulnerable area overlay"
          >
            Risk Overlay: {showRiskOverlay ? "On" : "Off"}
          </button>

          <button
            onClick={handleRefresh}
            className="ml-1 w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={() => setIsExpanded((v) => !v)}
            className="w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            title={isExpanded ? "Minimize map panel" : "Expand map panel"}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-1 text-muted-foreground ml-2">
            <Layers className="w-3 h-3" />
            <span>{filtered.length} incidents</span>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4 overflow-auto">
        <div className={`${isExpanded ? "h-[calc(100vh-160px)]" : "h-[420px]"} rounded-lg overflow-hidden border border-panel-border`}>
          {loading && <div className="h-full flex items-center justify-center text-muted-foreground">Loading crime data...</div>}
          {!loading && error && <div className="h-full flex items-center justify-center text-destructive">{error}</div>}
          {!loading && !error && (
            <MapContainer className="h-full w-full" center={[0.0236, 37.9062]} zoom={6} scrollWheelZoom>
              <ResizeMap trigger={isExpanded} />
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {view === "heatmap" ? (
                <HeatmapLayer points={heatPoints} />
              ) : (
                filtered.map((r, idx) => (
                  <CircleMarker
                    key={`${r.latitude}-${r.longitude}-${idx}`}
                    center={[r.latitude, r.longitude]}
                    radius={4 + severityOf(r.crimeType) * 0.6}
                    pathOptions={{
                      color: markerColorForSeverity(r.crimeType),
                      fillColor: markerColorForSeverity(r.crimeType),
                      fillOpacity: 0.7,
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -6]} opacity={1}>
                      <div className="text-xs">
                        <div className="font-semibold">{r.crimeType}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {r.location || r.areaName || "Unknown location"}
                        </div>
                        {r.context && <div className="text-[10px] italic truncate">{r.context}</div>}
                        <div>Lat: {r.latitude.toFixed(4)}, Lng: {r.longitude.toFixed(4)}</div>
                      </div>
                    </Tooltip>
                    <Popup>
                      <div className="text-xs">
                        <div className="font-semibold">{r.crimeType}</div>
                        {r.location && <div>{r.location}</div>}
                        {r.month && <div>Month: {r.month}</div>}
                        {r.areaName && <div>Area: {r.areaName}</div>}
                        {r.outcome && <div>Outcome: {r.outcome}</div>}
                      </div>
                    </Popup>
                  </CircleMarker>
                ))
              )}

              {showRiskOverlay &&
                topVulnerable.map((area) => (
                  <CircleMarker
                    key={`risk-${area.areaName}`}
                    center={area.centroid}
                    radius={8 + area.riskScore / 15}
                    pathOptions={{
                      color: riskColor(area.tier),
                      fillColor: riskColor(area.tier),
                      fillOpacity: 0.25,
                      weight: 2,
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -6]} opacity={1}>
                      <div className="text-xs">
                        <div className="font-semibold">{area.areaName}</div>
                        <div>Risk: {area.riskScore.toFixed(1)} ({area.tier})</div>
                        <div>Rate: {area.ratePer100.toFixed(2)} per 100 incidents</div>
                      </div>
                    </Tooltip>
                  </CircleMarker>
                ))}

              <FitBounds points={points} />
            </MapContainer>
          )}
        </div>

        {!loading && !error && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-lg border border-panel-border bg-secondary/20 p-3">
              <div className="text-xs text-muted-foreground">Most Vulnerable Area</div>
              <div className="text-sm font-semibold mt-1">{topVulnerable[0]?.areaName || "N/A"}</div>
              <div className="text-xs mt-1 text-muted-foreground">
                Risk Score: {topVulnerable[0] ? topVulnerable[0].riskScore.toFixed(1) : "0.0"}
              </div>
            </div>

            <div className="rounded-lg border border-panel-border bg-secondary/20 p-3">
              <div className="text-xs text-muted-foreground">Critical/High Areas</div>
              <div className="text-sm font-semibold mt-1">
                {vulnerableAreas.filter((a) => a.tier === "CRITICAL" || a.tier === "HIGH").length}
              </div>
              <div className="text-xs mt-1 text-muted-foreground">Priority deployment zones</div>
            </div>

            <div className="rounded-lg border border-panel-border bg-secondary/20 p-3">
              <div className="text-xs text-muted-foreground">Border-Linked Incidents</div>
              <div className="text-sm font-semibold mt-1">
                {filtered.filter((r) => (r.context || "").toLowerCase().includes("border")).length}
              </div>
              <div className="text-xs mt-1 text-muted-foreground">From current filtered view</div>
            </div>
          </div>
        )}

        {!loading && !error && (
          <div className="rounded-lg border border-panel-border overflow-hidden">
            <div className="px-3 py-2 border-b border-panel-border bg-secondary/20 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              <h3 className="text-sm font-semibold">Top Vulnerable Areas</h3>
              <span className="text-xs text-muted-foreground">(ranked by composite risk score)</span>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-secondary/20 text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Area</th>
                    <th className="text-right px-3 py-2">Incidents</th>
                    <th className="text-right px-3 py-2">Rate/100</th>
                    <th className="text-right px-3 py-2">Avg Severity</th>
                    <th className="text-right px-3 py-2">Open Case %</th>
                    <th className="text-right px-3 py-2">Risk</th>
                    <th className="text-right px-3 py-2">Tier</th>
                  </tr>
                </thead>
                <tbody>
                  {topVulnerable.map((area) => (
                    <tr key={area.areaName} className="border-t border-panel-border">
                      <td className="px-3 py-2 font-medium">{area.areaName}</td>
                      <td className="px-3 py-2 text-right">{area.incidents}</td>
                      <td className="px-3 py-2 text-right">{area.ratePer100.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{area.avgSeverity.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{(area.openCaseRate * 100).toFixed(1)}%</td>
                      <td className="px-3 py-2 text-right">{area.riskScore.toFixed(1)}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${tierClass(area.tier)}`}>{area.tier}</td>
                    </tr>
                  ))}
                  {!topVulnerable.length && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                        No vulnerable area data available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
