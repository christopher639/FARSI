import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Brain,
  MapPin,
  Play,
  Loader2,
  RotateCcw,
  Crosshair,
  BarChart3,
  Table2,
  Map as MapIcon,
} from "lucide-react";
import {
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell as ReCell,
} from "recharts";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Tooltip as LeafletTooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MetricCard } from "@/components/dashboard/MetricCard";
import {
  predictCrimeType,
  predictBatch,
  type HfPredictionInput,
  type HfPredictionResult,
} from "@/lib/hf-predict";

// ─── Preset Kenya test locations (same as Kaggle notebook) ──────────
const PRESET_LOCATIONS: Array<HfPredictionInput & { name: string }> = [
  {
    name: "Nairobi CBD",
    latitude: -1.2864,
    longitude: 36.8172,
    falls_within: "Nairobi Metropolitan Regional Command",
    location: "Near Nairobi CBD Market, Nairobi",
    context: "Urban zone",
  },
  {
    name: "Mombasa Port",
    latitude: -4.0435,
    longitude: 39.6682,
    falls_within: "Coast Regional Command",
    location: "Near Mombasa Port Highway, Mombasa",
    context: "Coastal urban",
  },
  {
    name: "Garissa Border",
    latitude: -0.4532,
    longitude: 39.6461,
    falls_within: "North Eastern Regional Command",
    location: "At Garissa Border Junction, Garissa",
    context: "Border zone",
  },
  {
    name: "Nyeri Rural",
    latitude: -0.4197,
    longitude: 36.951,
    falls_within: "Central Regional Command",
    location: "Near Nyeri Town Market Road, Nyeri",
    context: "Rural highlands",
  },
  {
    name: "Kisumu Lake",
    latitude: -0.1022,
    longitude: 34.7617,
    falls_within: "Nyanza Regional Command",
    location: "Near Kisumu Market Road, Kisumu",
    context: "Lakeside urban",
  },
  {
    name: "Eldoret",
    latitude: 0.5143,
    longitude: 35.2698,
    falls_within: "Rift Valley Regional Command",
    location: "At Eldoret Highway Junction, Uasin Gishu",
    context: "Rift Valley urban",
  },
  {
    name: "Malindi Coast",
    latitude: -3.2138,
    longitude: 40.1169,
    falls_within: "Coast Regional Command",
    location: "Near Malindi Bus Stage, Kilifi",
    context: "Coastal tourism",
  },
];

// ─── Crime type colour palette (matches notebook) ───────────────────
const CRIME_COLORS: Record<string, string> = {
  "Anti-social behaviour": "#6366f1",
  Burglary: "#f59e0b",
  "Criminal damage and arson": "#ef4444",
  Drugs: "#8b5cf6",
  "Other theft": "#06b6d4",
  "Possession of weapons": "#dc2626",
  "Public order": "#14b8a6",
  Robbery: "#f97316",
  Shoplifting: "#10b981",
  "Vehicle crime": "#3b82f6",
  "Violence and sexual offences": "#e11d48",
  Error: "#71717a",
  Unknown: "#71717a",
};

function colorForCrime(crime: string) {
  return CRIME_COLORS[crime] ?? "#a855f7";
}

// ─── Map helpers ────────────────────────────────────────────────────
function FitBounds({ points }: { points: Array<[number, number]> }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const bounds = L.latLngBounds(
      points.map(([lat, lng]) => L.latLng(lat, lng)),
    );
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, points]);
  return null;
}

// ─── Types ──────────────────────────────────────────────────────────
type BatchRow = {
  name: string;
  input: HfPredictionInput;
  result: HfPredictionResult | null;
};

// ═════════════════════════════════════════════════════════════════════
// Page component
// ═════════════════════════════════════════════════════════════════════

const CrimePredictionPage = () => {
  // ── Single prediction state ──
  const [singleForm, setSingleForm] = useState<HfPredictionInput>({
    latitude: -1.2864,
    longitude: 36.8172,
    month: "2025-11",
    falls_within: "Nairobi Metropolitan Regional Command",
    location: "Near Nairobi CBD Market, Nairobi",
    context: "Urban zone",
  });
  const [singleResult, setSingleResult] = useState<HfPredictionResult | null>(null);
  const [singleLoading, setSingleLoading] = useState(false);
  const [singleError, setSingleError] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  // ── Batch prediction state ──
  const [batchRows, setBatchRows] = useState<BatchRow[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });

  // ── HF Space status ──
  const [spaceUrl] = useState(
    import.meta.env.VITE_HF_SPACE_URL || "https://otiya-crime-classification.hf.space",
  );

  // ── GPS handler (browser geolocation → IP fallback) ──
  const applyCoords = useCallback((lat: number, lon: number, source: string) => {
    setSingleForm((f) => ({
      ...f,
      latitude: parseFloat(lat.toFixed(4)),
      longitude: parseFloat(lon.toFixed(4)),
    }));
    setSingleResult(null);
    setSingleError(null);
    setGpsLoading(false);
    console.log(`GPS: coordinates set from ${source}`);
  }, []);

  const ipFallback = useCallback(async () => {
    try {
      const res = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error("IP lookup failed");
      const data = await res.json();
      if (typeof data.latitude === "number" && typeof data.longitude === "number") {
        applyCoords(data.latitude, data.longitude, "IP geolocation (approximate)");
      } else {
        throw new Error("No coordinates in IP response");
      }
    } catch {
      setSingleError("Could not determine location. Please enter coordinates manually.");
      setGpsLoading(false);
    }
  }, [applyCoords]);

  const handleRefreshGPS = useCallback(() => {
    setGpsLoading(true);
    setSingleError(null);

    if (!navigator.geolocation) {
      // No browser geolocation → try IP fallback
      ipFallback();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        applyCoords(position.coords.latitude, position.coords.longitude, "device GPS");
      },
      () => {
        // Permission denied or error → try IP-based fallback silently
        ipFallback();
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [applyCoords, ipFallback]);

  // ── Single prediction handler ──
  const handleSinglePredict = useCallback(async () => {
    setSingleLoading(true);
    setSingleError(null);
    setSingleResult(null);
    try {
      const result = await predictCrimeType(singleForm);
      setSingleResult(result);
    } catch (err) {
      setSingleError(err instanceof Error ? err.message : "Prediction failed");
    } finally {
      setSingleLoading(false);
    }
  }, [singleForm]);

  // ── Batch prediction handler ──
  const handleBatchPredict = useCallback(async () => {
    setBatchLoading(true);
    setBatchProgress({ done: 0, total: PRESET_LOCATIONS.length });
    const initial: BatchRow[] = PRESET_LOCATIONS.map((loc) => ({
      name: loc.name,
      input: {
        latitude: loc.latitude,
        longitude: loc.longitude,
        month: "2025-11",
        falls_within: loc.falls_within,
        location: loc.location,
        context: loc.context,
      },
      result: null,
    }));
    setBatchRows(initial);

    const inputs = initial.map((r) => r.input);
    const results = await predictBatch(inputs, 3, (done, total) =>
      setBatchProgress({ done, total }),
    );

    setBatchRows(
      initial.map((row, i) => ({ ...row, result: results[i] })),
    );
    setBatchLoading(false);
  }, []);

  // ── Probability chart data ──
  const probChartData = useMemo(() => {
    if (!singleResult) return [];
    return Object.entries(singleResult.probabilities)
      .map(([label, value]) => ({
        label,
        probability: typeof value === "number" ? value : parseFloat(String(value)),
      }))
      .sort((a, b) => b.probability - a.probability);
  }, [singleResult]);

  // ── Map points from batch ──
  const batchMapPoints = useMemo(() => {
    return batchRows
      .filter((r) => r.result)
      .map((r) => ({
        lat: r.input.latitude,
        lon: r.input.longitude,
        name: r.name,
        crime: r.result!.predicted_crime_type,
        confidence: r.result!.confidence,
      }));
  }, [batchRows]);

  // ── Batch stats ──
  const completedBatch = useMemo(() => batchRows.filter((r) => r.result), [batchRows]);
  const uniqueCrimes = useMemo(
    () => [...new Set(completedBatch.map((r) => r.result!.predicted_crime_type))],
    [completedBatch],
  );
  const avgConfidence = useMemo(() => {
    if (!completedBatch.length) return 0;
    return completedBatch.reduce((s, r) => s + r.result!.confidence, 0) / completedBatch.length;
  }, [completedBatch]);

  const handlePresetSelect = (idx: number) => {
    const loc = PRESET_LOCATIONS[idx];
    setSingleForm({
      latitude: loc.latitude,
      longitude: loc.longitude,
      month: "2025-11",
      falls_within: loc.falls_within,
      location: loc.location,
      context: loc.context ?? "",
    });
    setSingleResult(null);
    setSingleError(null);
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <section className="panel p-6 space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Crosshair className="w-5 h-5" />
              <span className="text-xs uppercase tracking-[0.2em]">Live ML Inference</span>
            </div>
            <h1 className="text-2xl font-semibold">Crime Type Prediction</h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Interactive predictions using the fastai model deployed on HuggingFace Spaces.
              Enter coordinates or use preset Kenya locations to predict likely crime types
              — the same model tested in the Kaggle notebook.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground border border-panel-border rounded-lg px-3 py-1.5">
              <span
                className={`w-2 h-2 rounded-full ${spaceUrl ? "bg-green-500 animate-pulse" : "bg-red-500"}`}
              />
              HF Space
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href={spaceUrl} target="_blank" rel="noopener noreferrer">
                Open Space
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Single Prediction ── */}
      <section className="panel p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Single Prediction</h2>
        </div>

        {/* Preset selector */}
        <div className="flex flex-wrap gap-2">
          {PRESET_LOCATIONS.map((loc, i) => (
            <button
              key={loc.name}
              onClick={() => handlePresetSelect(i)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                singleForm.latitude === loc.latitude && singleForm.longitude === loc.longitude
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-panel-border bg-secondary hover:bg-secondary/80 text-muted-foreground"
              }`}
            >
              <MapPin className="w-3 h-3 inline mr-1" />
              {loc.name}
            </button>
          ))}
        </div>

        {/* Input form */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Latitude</Label>
            <Input
              type="number"
              step="0.0001"
              value={singleForm.latitude}
              onChange={(e) =>
                setSingleForm((f) => ({ ...f, latitude: parseFloat(e.target.value) || 0 }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Longitude</Label>
            <Input
              type="number"
              step="0.0001"
              value={singleForm.longitude}
              onChange={(e) =>
                setSingleForm((f) => ({ ...f, longitude: parseFloat(e.target.value) || 0 }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Month (YYYY-MM)</Label>
            <Input
              value={singleForm.month}
              onChange={(e) => setSingleForm((f) => ({ ...f, month: e.target.value }))}
              placeholder="2025-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Falls Within (Command)</Label>
            <Input
              value={singleForm.falls_within}
              onChange={(e) => setSingleForm((f) => ({ ...f, falls_within: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Location</Label>
            <Input
              value={singleForm.location}
              onChange={(e) => setSingleForm((f) => ({ ...f, location: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Context</Label>
            <Input
              value={singleForm.context}
              onChange={(e) => setSingleForm((f) => ({ ...f, context: e.target.value }))}
              placeholder="Urban zone, Border area, etc."
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSinglePredict} disabled={singleLoading}>
            {singleLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            Predict Crime Type
          </Button>
          <Button variant="outline" onClick={handleRefreshGPS} disabled={gpsLoading}>
            {gpsLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Crosshair className="w-4 h-4 mr-2" />
            )}
            Refresh GPS
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setSingleResult(null);
              setSingleError(null);
            }}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Clear
          </Button>
        </div>

        {singleError && (
          <div className="text-sm text-destructive border border-destructive/30 bg-destructive/10 rounded-lg px-4 py-3">
            {singleError}
          </div>
        )}

        {/* Single prediction result */}
        {singleResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricCard
                title="Predicted Crime"
                value={singleResult.predicted_crime_type}
                subtitle="Most likely classification"
                icon={Brain}
                variant="success"
              />
              <MetricCard
                title="Confidence"
                value={`${(singleResult.confidence * 100).toFixed(1)}%`}
                subtitle="Model certainty"
                icon={BarChart3}
              />
              <MetricCard
                title="Crime Classes"
                value={Object.keys(singleResult.probabilities).length.toString()}
                subtitle="Total categories evaluated"
                icon={Table2}
              />
            </div>

            {/* Probability distribution chart */}
            {probChartData.length > 0 && (
              <div className="rounded-lg border border-panel-border bg-secondary/10 p-4">
                <h3 className="text-sm font-semibold mb-3">
                  Probability Distribution (All Crime Types)
                </h3>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ReBarChart
                      data={probChartData}
                      layout="vertical"
                      margin={{ top: 4, right: 30, left: 10, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="4 4" strokeOpacity={0.3} />
                      <XAxis
                        type="number"
                        tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
                        domain={[0, "auto"]}
                      />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={180}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        formatter={(v: number) => `${(v * 100).toFixed(2)}%`}
                        labelFormatter={(l) => String(l)}
                      />
                      <Bar dataKey="probability" radius={[0, 4, 4, 0]}>
                        {probChartData.map((entry) => (
                          <ReCell
                            key={entry.label}
                            fill={colorForCrime(entry.label)}
                          />
                        ))}
                      </Bar>
                    </ReBarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Batch Predictions ── */}
      <section className="panel p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Table2 className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Batch Predictions</h2>
            <span className="text-xs text-muted-foreground">
              (7 preset Kenya locations — same as Kaggle notebook)
            </span>
          </div>
          <Button onClick={handleBatchPredict} disabled={batchLoading}>
            {batchLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {batchProgress.done}/{batchProgress.total}
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Run Batch
              </>
            )}
          </Button>
        </div>

        {/* Batch stats */}
        {completedBatch.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
              title="Locations Predicted"
              value={completedBatch.length.toString()}
              subtitle={`of ${PRESET_LOCATIONS.length} total`}
              icon={MapPin}
            />
            <MetricCard
              title="Unique Crimes Found"
              value={uniqueCrimes.length.toString()}
              subtitle={uniqueCrimes.slice(0, 3).join(", ")}
              icon={Brain}
            />
            <MetricCard
              title="Avg Confidence"
              value={`${(avgConfidence * 100).toFixed(1)}%`}
              subtitle="Across all predictions"
              icon={BarChart3}
            />
          </div>
        )}

        {/* Results table */}
        {batchRows.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-panel-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Location</th>
                  <th className="px-3 py-2 text-left">Coordinates</th>
                  <th className="px-3 py-2 text-left">Predicted Crime</th>
                  <th className="px-3 py-2 text-right">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {batchRows.map((row, i) => (
                  <tr key={row.name} className="border-t border-panel-border/70">
                    <td className="px-3 py-2 font-mono text-muted-foreground">{i}</td>
                    <td className="px-3 py-2 font-medium">{row.name}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground font-mono">
                      {row.input.latitude.toFixed(4)}, {row.input.longitude.toFixed(4)}
                    </td>
                    <td className="px-3 py-2">
                      {row.result ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full inline-block"
                            style={{ backgroundColor: colorForCrime(row.result.predicted_crime_type) }}
                          />
                          <span className="font-semibold">{row.result.predicted_crime_type}</span>
                        </span>
                      ) : batchLoading ? (
                        <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {row.result
                        ? `${(row.result.confidence * 100).toFixed(2)}%`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Map Visualization ── */}
      {batchMapPoints.length > 0 && (
        <section className="panel p-6 space-y-4">
          <div className="flex items-center gap-2">
            <MapIcon className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Prediction Map</h2>
            <span className="text-xs text-muted-foreground">
              Colour-coded by predicted crime type (mirrors Kaggle folium map)
            </span>
          </div>

          <div className="h-[420px] rounded-lg overflow-hidden border border-panel-border">
            <MapContainer
              className="h-full w-full"
              center={[-0.5, 37.5]}
              zoom={6}
              scrollWheelZoom
            >
              <TileLayer
                attribution="&copy; CARTO"
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />
              {batchMapPoints.map((pt) => (
                <CircleMarker
                  key={pt.name}
                  center={[pt.lat, pt.lon]}
                  radius={10}
                  pathOptions={{
                    color: colorForCrime(pt.crime),
                    fillColor: colorForCrime(pt.crime),
                    fillOpacity: 0.8,
                    weight: 2,
                  }}
                >
                  <LeafletTooltip direction="top" offset={[0, -8]} opacity={1}>
                    <div className="text-xs">
                      <div className="font-bold">{pt.name}</div>
                      <div>
                        Crime: {pt.crime}
                      </div>
                      <div>Confidence: {(pt.confidence * 100).toFixed(1)}%</div>
                    </div>
                  </LeafletTooltip>
                  <Popup>
                    <div className="text-xs space-y-1">
                      <div className="font-bold text-sm">{pt.name}</div>
                      <div>
                        <span className="font-medium">Predicted: </span>
                        {pt.crime}
                      </div>
                      <div>
                        <span className="font-medium">Confidence: </span>
                        {(pt.confidence * 100).toFixed(2)}%
                      </div>
                      <div className="text-muted-foreground">
                        ({pt.lat.toFixed(4)}, {pt.lon.toFixed(4)})
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
              <FitBounds
                points={batchMapPoints.map((pt) => [pt.lat, pt.lon] as [number, number])}
              />
            </MapContainer>
          </div>

          {/* Legend — mirrors Kaggle notebook */}
          <div className="flex flex-wrap gap-3 text-xs">
            {uniqueCrimes.map((crime) => (
              <div key={crime} className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-full inline-block"
                  style={{ backgroundColor: colorForCrime(crime) }}
                />
                {crime}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default CrimePredictionPage;
