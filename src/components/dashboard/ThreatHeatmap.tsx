import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip, useMap } from "react-leaflet";
import { MapPin, RefreshCw, Layers } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { apiGet } from "@/lib/api";

const CSV_URL = "/data/crime/2025-11-avon-and-somerset-street.csv";
const SUPABASE_TABLE = import.meta.env.VITE_CRIME_SUPABASE_TABLE || "crime_events";
const DEFAULT_SOURCE = import.meta.env.VITE_CRIME_SOURCE === "supabase" ? "supabase" : "csv";

type CrimeRecord = {
  latitude: number;
  longitude: number;
  crimeType: string;
  month?: string;
  location?: string;
  score?: number;
};

type DataSource = "csv" | "supabase" | "backend";

type MapView = "heatmap" | "points";

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

export function ThreatHeatmap() {
  const [source, setSource] = useState<DataSource>(DEFAULT_SOURCE);
  const [view, setView] = useState<MapView>("heatmap");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<CrimeRecord[]>([]);
  const [selectedType, setSelectedType] = useState<string>("All");
  const [refreshing, setRefreshing] = useState(false);

  const loadFromCsv = async () => {
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
      }))
      .filter((r) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude));

    return cleaned;
  };

  const loadFromSupabase = async () => {
    const { data, error } = await supabase
      .from(SUPABASE_TABLE)
      .select("latitude, longitude, crime_type, month, location");

    if (error) throw error;

    const cleaned: CrimeRecord[] = (data || [])
      .map((row: any) => ({
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        crimeType: row.crime_type || "Unknown",
        month: row.month,
        location: row.location,
      }))
      .filter((r: CrimeRecord) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude));

    return cleaned;
  };

  const loadFromBackend = async () => {
    const data = await apiGet<Array<{ lat: number; lon: number; score: number }>>("/heatmap");
    const cleaned: CrimeRecord[] = (data || []).map((row) => ({
      latitude: Number(row.lat),
      longitude: Number(row.lon),
      crimeType: "Heatmap Cell",
      score: row.score,
    }));
    return cleaned;
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const loaded =
        source === "supabase" ? await loadFromSupabase() : source === "backend" ? await loadFromBackend() : await loadFromCsv();
      setRecords(loaded);
    } catch (err: any) {
      setError(err?.message || "Failed to load crime data");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [source]);

  const crimeTypes = useMemo(() => {
    const unique = new Set(records.map((r) => r.crimeType).filter(Boolean));
    return ["All", ...Array.from(unique).sort()];
  }, [records]);

  const filtered = useMemo(() => {
    if (selectedType === "All") return records;
    return records.filter((r) => r.crimeType === selectedType);
  }, [records, selectedType]);

  const points = useMemo(
    () => filtered.map((r) => [r.latitude, r.longitude] as [number, number]),
    [filtered]
  );

  const heatPoints = useMemo(
    () => filtered.map((r) => [r.latitude, r.longitude, r.score ?? 1] as [number, number, number]),
    [filtered]
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const supabaseEnabled = Boolean(import.meta.env.VITE_SUPABASE_URL);

  return (
    <div className="panel-glow flex flex-col h-full">
      <div className="flex flex-col gap-3 p-4 border-b border-panel-border lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
            <MapPin className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Crime Map - Real Locations</h2>
            <p className="text-xs text-muted-foreground font-mono">Live geo view of reported incidents</p>
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

          <button
            onClick={handleRefresh}
            className="ml-2 w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>

          <div className="flex items-center gap-1 text-muted-foreground ml-2">
            <Layers className="w-3 h-3" />
            <span>{filtered.length} points</span>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4">
        <div className="h-full min-h-[420px] rounded-lg overflow-hidden border border-panel-border">
          {loading && (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              Loading crime data...
            </div>
          )}
          {!loading && error && (
            <div className="h-full flex items-center justify-center text-destructive">
              {error}
            </div>
          )}
          {!loading && !error && (
            <MapContainer
              className="h-full w-full"
              center={[0.0236, 37.9062]}
              zoom={6}
              scrollWheelZoom
            >
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
                    radius={5}
                    pathOptions={{ color: "#22c55e", fillColor: "#22c55e", fillOpacity: 0.7 }}
                  >
                    <Tooltip direction="top" offset={[0, -6]} opacity={1}>
                      <div className="text-xs">
                        <div className="font-semibold">{r.crimeType}</div>
                        <div>Lat: {r.latitude.toFixed(5)}, Lng: {r.longitude.toFixed(5)}</div>
                        {r.location && <div>{r.location}</div>}
                      </div>
                    </Tooltip>
                    <Popup>
                      <div className="text-xs">
                        <div className="font-semibold">{r.crimeType}</div>
                        {r.location && <div>{r.location}</div>}
                        {r.month && <div>Month: {r.month}</div>}
                        <div>Lat: {r.latitude.toFixed(5)}, Lng: {r.longitude.toFixed(5)}</div>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))
              )}

              <FitBounds points={points} />
            </MapContainer>
          )}
        </div>
      </div>
    </div>
  );
}
