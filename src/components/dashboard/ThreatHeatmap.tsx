import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";
import "leaflet/dist/leaflet.css";
import { Filter, MapPin, Maximize2, RefreshCw } from "lucide-react";

type HeatmapPoint = {
  lat: number;
  lon: number;
  weight: number;
  severity: string;
  area_name?: string | null;
  crime_desc?: string | null;
  date?: string | null;
  hour?: number | null;
};

type HeatmapQuery = {
  startDate?: string;
  endDate?: string;
  startHour?: number;
  endHour?: number;
  severities?: string[];
  crime?: string;
  limit?: number;
  seed?: number;
};

type HeatmapRow = {
  "AREA NAME": string;
  incident_count: number;
  severity: string;
};

type HeatPoint = [number, number, number];

type HeatOptions = {
  radius: number;
  blur: number;
  minOpacity: number;
  intensity: number;
  threshold: number;
  dynamicRadius: boolean;
  gradientMode: "multi" | "single";
  weightMode: "max" | "p95" | "log";
};

type HeatFilters = {
  startDate: string;
  endDate: string;
  startHour: number;
  endHour: number;
  severities: string[];
  crime: string;
  limit: number;
};

const API_URL = "http://127.0.0.1:8000";
const severityOptions = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const severityColorMap: Record<string, { light: string; mid: string; dark: string }> = {
  LOW: { light: "#86efac", mid: "#22c55e", dark: "#15803d" },
  MEDIUM: { light: "#93c5fd", mid: "#3b82f6", dark: "#1d4ed8" },
  HIGH: { light: "#fdba74", mid: "#f59e0b", dark: "#b45309" },
  CRITICAL: { light: "#fca5a5", mid: "#ef4444", dark: "#b91c1c" }
};

const MAX_HOVER_POINTS = 2500;
const baseMapOptions = ["dark", "satellite"] as const;
type BaseMapMode = (typeof baseMapOptions)[number];
const baseMapConfig: Record<
  BaseMapMode,
  { label: string; url: string; attribution: string }
> = {
  dark: {
    label: "Dark",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
  },
  satellite: {
    label: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Tiles &copy; Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
  }
};

const buildQuery = (params?: HeatmapQuery) => {
  if (!params) return "";
  const search = new URLSearchParams();
  if (params.startDate) search.set("start_date", params.startDate);
  if (params.endDate) search.set("end_date", params.endDate);
  if (params.startHour !== undefined) search.set("start_hour", String(params.startHour));
  if (params.endHour !== undefined) search.set("end_hour", String(params.endHour));
  if (params.severities && params.severities.length) {
    search.set("severities", params.severities.join(","));
  }
  if (params.crime) search.set("crime", params.crime);
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.seed !== undefined) search.set("seed", String(params.seed));
  const query = search.toString();
  return query ? `?${query}` : "";
};

const request = async <T,>(path: string, options?: RequestInit): Promise<T> => {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
};

const getHeatmap = (params?: HeatmapQuery) =>
  request<{ rows: HeatmapRow[] }>(`/ml/heatmap${buildQuery(params)}`);

const getHeatmapPoints = (params?: HeatmapQuery) =>
  request<{ points: HeatmapPoint[] }>(`/ml/heatmap/points${buildQuery(params)}`);

const formatTooltip = (point: HeatmapPoint) => {
  const lines = [];
  lines.push(point.area_name ? `<strong>${point.area_name}</strong>` : "<strong>Incident</strong>");
  lines.push(`Severity: ${point.severity || "UNKNOWN"}`);
  lines.push(`Coords: ${point.lat.toFixed(4)}, ${point.lon.toFixed(4)}`);
  if (point.crime_desc) {
    lines.push(point.crime_desc);
  }
  if (point.date) {
    lines.push(`Date: ${point.date}`);
  }
  if (point.hour !== null && point.hour !== undefined) {
    const hourLabel = String(point.hour).padStart(2, "0");
    lines.push(`Hour: ${hourLabel}:00`);
  }
  return lines.join("<br/>");
};

function HeatLayer({
  points,
  options,
  fitPoints,
  gradientOverride
}: {
  points: HeatPoint[];
  options: HeatOptions;
  fitPoints?: HeatPoint[];
  gradientOverride?: Record<number, string>;
}) {
  const map = useMap();
  const layerRef = useRef<any>(null);

  useEffect(() => {
    if (!points.length) {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
      return;
    }

    const gradient =
      gradientOverride ??
      (options.gradientMode === "single"
        ? { 0.2: "#38bdf8", 1.0: "#38bdf8" }
        : { 0.2: "#22c55e", 0.5: "#f59e0b", 0.8: "#ef4444" });

    const getRadiusOptions = () => {
      if (!options.dynamicRadius) {
        return { radius: options.radius, blur: options.blur };
      }
      const zoom = map.getZoom();
      const scale = Math.max(0.7, Math.min(1.6, zoom / 10));
      return {
        radius: Math.max(10, Math.round(options.radius * scale)),
        blur: Math.max(8, Math.round(options.blur * scale))
      };
    };

    const applyOptions = () => {
      const { radius, blur } = getRadiusOptions();
      layerRef.current?.setOptions({
        radius,
        blur,
        maxZoom: 12,
        minOpacity: options.minOpacity,
        gradient,
        max: Math.max(0.1, options.intensity)
      });
    };

    if (!layerRef.current) {
      const { radius, blur } = getRadiusOptions();
      layerRef.current = (L as any).heatLayer(points, {
        radius,
        blur,
        maxZoom: 12,
        minOpacity: options.minOpacity,
        gradient,
        max: Math.max(0.1, options.intensity)
      });
      layerRef.current.addTo(map);
    } else {
      layerRef.current.setLatLngs(points);
    }

    applyOptions();

    if (options.dynamicRadius) {
      map.on("zoomend", applyOptions);
      return () => {
        map.off("zoomend", applyOptions);
      };
    }
  }, [gradientOverride, map, options, points]);

  useEffect(() => {
    if (!fitPoints || !fitPoints.length) return;
    const latlngs = fitPoints.map((p) => [p[0], p[1]]);
    const bounds = L.latLngBounds(latlngs as [number, number][]);
    map.fitBounds(bounds, { padding: [24, 24] });
  }, [fitPoints, map]);

  useEffect(() => {
    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map]);

  return null;
}

function HeatHoverLayer({ points, enabled }: { points: HeatmapPoint[]; enabled: boolean }) {
  const map = useMap();
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!enabled || !points.length) {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
      return;
    }

    const layer = L.layerGroup();
    points.forEach((point) => {
      const marker = L.circleMarker([point.lat, point.lon], {
        radius: 8,
        weight: 0,
        opacity: 0,
        fillOpacity: 0.05,
        interactive: true,
        className: "heat-hover-point"
      });
      marker.bindTooltip(formatTooltip(point), {
        direction: "top",
        offset: [0, -6],
        opacity: 0.95,
        sticky: true,
        className: "heat-tooltip"
      });
      layer.addLayer(marker);
    });

    layer.addTo(map);
    layerRef.current = layer;

    return () => {
      map.removeLayer(layer);
      layerRef.current = null;
    };
  }, [enabled, map, points]);

  return null;
}

function MapSizeSync({ fullscreen }: { fullscreen: boolean }) {
  const map = useMap();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      map.invalidateSize();
    }, 150);
    return () => window.clearTimeout(timer);
  }, [fullscreen, map]);

  return null;
}

export function ThreatHeatmap() {
  const [heatmap, setHeatmap] = useState<HeatmapRow[]>([]);
  const [heatPoints, setHeatPoints] = useState<HeatmapPoint[]>([]);
  const [heatOptions, setHeatOptions] = useState<HeatOptions>({
    radius: 24,
    blur: 18,
    minOpacity: 0.25,
    intensity: 1,
    threshold: 0,
    dynamicRadius: true,
    gradientMode: "multi",
    weightMode: "p95"
  });
  const [heatmapLoading, setHeatmapLoading] = useState(false);
  const [heatmapError, setHeatmapError] = useState("");
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [hoverEnabled, setHoverEnabled] = useState(true);
  const [baseMap, setBaseMap] = useState<BaseMapMode>("dark");
  const [heatFilters, setHeatFilters] = useState<HeatFilters>({
    startDate: "",
    endDate: "",
    startHour: 0,
    endHour: 23,
    severities: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
    crime: "",
    limit: 5000
  });
  const [appliedFilters, setAppliedFilters] = useState<HeatFilters>({
    startDate: "",
    endDate: "",
    startHour: 0,
    endHour: 23,
    severities: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
    crime: "",
    limit: 5000
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showControls, setShowControls] = useState(true);

  useEffect(() => {
    if (!mapFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mapFullscreen]);

  useEffect(() => {
    let isActive = true;
    const baseQuery: HeatmapQuery = {
      startDate: appliedFilters.startDate || undefined,
      endDate: appliedFilters.endDate || undefined,
      startHour: appliedFilters.startHour,
      endHour: appliedFilters.endHour,
      severities: appliedFilters.severities.length ? appliedFilters.severities : undefined,
      crime: appliedFilters.crime || undefined
    };
    const pointsQuery: HeatmapQuery = {
      ...baseQuery,
      limit: appliedFilters.limit
    };

    setHeatmapLoading(true);
    setHeatmapError("");
    setIsRefreshing(true);

    Promise.all([getHeatmap(baseQuery), getHeatmapPoints(pointsQuery)])
      .then(([heatmapData, pointsData]) => {
        if (!isActive) return;
        setHeatmap(heatmapData.rows || []);
        setHeatPoints(pointsData.points || []);
      })
      .catch((err) => {
        if (!isActive) return;
        setHeatmapError(err?.message || "Failed to load heatmap");
        setHeatmap([]);
        setHeatPoints([]);
      })
      .finally(() => {
        if (!isActive) return;
        setHeatmapLoading(false);
        setIsRefreshing(false);
      });

    return () => {
      isActive = false;
    };
  }, [appliedFilters, refreshKey]);

  const mapCenter: [number, number] = [0.0236, 37.9062];

  const weightStats = useMemo(() => {
    if (!heatPoints.length) {
      return { min: 0, max: 1, p50: 0, p95: 1, count: 0 };
    }
    const weights = heatPoints.map((point) => point.weight).sort((a, b) => a - b);
    const percentile = (p: number) =>
      weights[Math.min(weights.length - 1, Math.floor((weights.length - 1) * p))];
    return {
      min: weights[0],
      max: weights[weights.length - 1],
      p50: percentile(0.5),
      p95: percentile(0.95),
      count: weights.length
    };
  }, [heatPoints]);

  const fitHeatPoints = useMemo(
    () => heatPoints.map((point) => [point.lat, point.lon, point.weight] as HeatPoint),
    [heatPoints]
  );

  const hoverPoints = useMemo(() => {
    if (heatPoints.length <= MAX_HOVER_POINTS) return heatPoints;
    const step = Math.ceil(heatPoints.length / MAX_HOVER_POINTS);
    return heatPoints.filter((_, index) => index % step === 0);
  }, [heatPoints]);

  const normalizedPoints = useMemo(() => {
    if (!heatPoints.length) return [];
    const maxWeight = weightStats.max || 1;
    const p95 = weightStats.p95 || maxWeight;
    const logMax = Math.log1p(maxWeight);
    return heatPoints.map((point) => {
      let normalized = 0;
      if (heatOptions.weightMode === "p95") {
        normalized = p95 > 0 ? Math.min(point.weight, p95) / p95 : 0;
      } else if (heatOptions.weightMode === "log") {
        normalized = logMax > 0 ? Math.log1p(point.weight) / logMax : 0;
      } else {
        normalized = maxWeight > 0 ? point.weight / maxWeight : 0;
      }
      return { ...point, normalized };
    });
  }, [heatOptions.weightMode, heatPoints, weightStats]);

  const severityHeatLayers = useMemo(() => {
    const layers: Record<string, HeatPoint[]> = {
      LOW: [],
      MEDIUM: [],
      HIGH: [],
      CRITICAL: []
    };
    normalizedPoints.forEach((point) => {
      const intensityWeight = point.normalized * heatOptions.intensity;
      if (heatOptions.threshold > 0 && intensityWeight < heatOptions.threshold) return;
      const severityKey = (point.severity || "LOW").toUpperCase();
      if (!layers[severityKey]) return;
      layers[severityKey].push([point.lat, point.lon, intensityWeight]);
    });
    return layers;
  }, [heatOptions.intensity, heatOptions.threshold, normalizedPoints]);

  const legendHigh = weightStats.count
    ? heatOptions.weightMode === "p95"
      ? weightStats.p95
      : weightStats.max
    : 0;

  const severityLegend = useMemo(
    () =>
      severityOptions.map((severity) => ({
        severity,
        color: severityColorMap[severity].mid
      })),
    []
  );

  const severityGradients = useMemo(() => {
    const gradients: Record<string, Record<number, string>> = {};
    severityOptions.forEach((severity) => {
      const colors = severityColorMap[severity];
      gradients[severity] =
        heatOptions.gradientMode === "single"
          ? { 0.2: colors.mid, 1.0: colors.mid }
          : { 0.2: colors.light, 0.6: colors.mid, 1.0: colors.dark };
    });
    return gradients;
  }, [heatOptions.gradientMode]);

  const legendBarStyle = {
    background:
      heatOptions.gradientMode === "single"
        ? "linear-gradient(90deg, #38bdf8, #38bdf8)"
        : "linear-gradient(90deg, #22c55e, #f59e0b, #ef4444)"
  };

  return (
    <div className="panel-glow flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-panel-border">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
            <MapPin className="w-4 h-4 text-primary" />
          </div>
          <div className="leading-tight">
            <h2 className="font-semibold text-foreground">Predictive Threat Heatmap</h2>
            <p className="text-xs text-muted-foreground font-mono">Real-time threat analysis • Kenya</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRefreshKey((prev) => prev + 1)}
            className="w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setShowControls((prev) => !prev)}
            className="w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <Filter className="w-4 h-4" />
          </button>
          <button
            onClick={() => setMapFullscreen((prev) => !prev)}
            className="w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 p-4">
        <div className={`grid gap-4 ${showControls ? "lg:grid-cols-[320px_1fr]" : "grid-cols-1"}`}>
          {showControls && (
            <div className="rounded-xl border border-panel-border bg-card/60 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Heatmap Controls</h3>
                <span className="text-xs text-muted-foreground">{heatPoints.length} points</span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs text-muted-foreground">Radius</label>
                  <input
                    type="range"
                    min={10}
                    max={50}
                    step={2}
                    value={heatOptions.radius}
                    onChange={(e) =>
                      setHeatOptions((prev) => ({ ...prev, radius: Number(e.target.value) }))
                    }
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground">{heatOptions.radius}px</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs text-muted-foreground">Blur</label>
                  <input
                    type="range"
                    min={8}
                    max={40}
                    step={2}
                    value={heatOptions.blur}
                    onChange={(e) =>
                      setHeatOptions((prev) => ({ ...prev, blur: Number(e.target.value) }))
                    }
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground">{heatOptions.blur}px</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs text-muted-foreground">Opacity</label>
                  <input
                    type="range"
                    min={0.1}
                    max={0.5}
                    step={0.05}
                    value={heatOptions.minOpacity}
                    onChange={(e) =>
                      setHeatOptions((prev) => ({ ...prev, minOpacity: Number(e.target.value) }))
                    }
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground">{heatOptions.minOpacity.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs text-muted-foreground">Intensity</label>
                  <input
                    type="range"
                    min={0.2}
                    max={2}
                    step={0.1}
                    value={heatOptions.intensity}
                    onChange={(e) =>
                      setHeatOptions((prev) => ({ ...prev, intensity: Number(e.target.value) }))
                    }
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground">{heatOptions.intensity.toFixed(1)}x</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs text-muted-foreground">Threshold</label>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.1}
                    value={heatOptions.threshold}
                    onChange={(e) =>
                      setHeatOptions((prev) => ({ ...prev, threshold: Number(e.target.value) }))
                    }
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground">{heatOptions.threshold.toFixed(1)}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground">Weight scaling</label>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {(["max", "p95", "log"] as const).map((mode) => (
                      <button
                        key={mode}
                        className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                          heatOptions.weightMode === mode
                            ? "border-primary/60 bg-primary/10 text-primary"
                            : "border-panel-border text-muted-foreground hover:text-foreground"
                        }`}
                        onClick={() => setHeatOptions((prev) => ({ ...prev, weightMode: mode }))}
                      >
                        {mode === "max" ? "Max" : mode.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground">Basemap</label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {baseMapOptions.map((mode) => (
                      <button
                        key={mode}
                        className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                          baseMap === mode
                            ? "border-primary/60 bg-primary/10 text-primary"
                            : "border-panel-border text-muted-foreground hover:text-foreground"
                        }`}
                        onClick={() => setBaseMap(mode)}
                      >
                        {baseMapConfig[mode].label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={heatOptions.dynamicRadius}
                    onChange={(e) =>
                      setHeatOptions((prev) => ({ ...prev, dynamicRadius: e.target.checked }))
                    }
                    className="h-3 w-3"
                  />
                  Dynamic radius
                </label>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={hoverEnabled}
                    onChange={(e) => setHoverEnabled(e.target.checked)}
                    className="h-3 w-3"
                  />
                  Point hover tooltips
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                      heatOptions.gradientMode === "multi"
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "border-panel-border text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setHeatOptions((prev) => ({ ...prev, gradientMode: "multi" }))}
                  >
                    Multi-color
                  </button>
                  <button
                    className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                      heatOptions.gradientMode === "single"
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "border-panel-border text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setHeatOptions((prev) => ({ ...prev, gradientMode: "single" }))}
                  >
                    Single-color
                  </button>
                </div>
              </div>

              <div className="space-y-3 border-t border-panel-border pt-4">
                <h4 className="text-xs font-semibold text-foreground">Data Filters</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-xs text-muted-foreground">Max points</label>
                    <input
                      type="range"
                      min={1000}
                      max={10000}
                      step={500}
                      value={heatFilters.limit}
                      onChange={(e) =>
                        setHeatFilters((prev) => ({
                          ...prev,
                          limit: Number(e.target.value)
                        }))
                      }
                      className="flex-1"
                    />
                    <span className="text-xs text-muted-foreground">{heatFilters.limit.toLocaleString()}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Start date</label>
                      <input
                        type="date"
                        value={heatFilters.startDate}
                        onChange={(e) =>
                          setHeatFilters((prev) => ({ ...prev, startDate: e.target.value }))
                        }
                        className="w-full rounded-md border border-panel-border bg-background px-2 py-1 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">End date</label>
                      <input
                        type="date"
                        value={heatFilters.endDate}
                        onChange={(e) =>
                          setHeatFilters((prev) => ({ ...prev, endDate: e.target.value }))
                        }
                        className="w-full rounded-md border border-panel-border bg-background px-2 py-1 text-xs"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Start hour</label>
                      <input
                        type="number"
                        min={0}
                        max={23}
                        value={heatFilters.startHour}
                        onChange={(e) =>
                          setHeatFilters((prev) => ({
                            ...prev,
                            startHour: Number(e.target.value)
                          }))
                        }
                        className="w-full rounded-md border border-panel-border bg-background px-2 py-1 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">End hour</label>
                      <input
                        type="number"
                        min={0}
                        max={23}
                        value={heatFilters.endHour}
                        onChange={(e) =>
                          setHeatFilters((prev) => ({
                            ...prev,
                            endHour: Number(e.target.value)
                          }))
                        }
                        className="w-full rounded-md border border-panel-border bg-background px-2 py-1 text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Severity</label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {severityOptions.map((severity) => {
                        const active = heatFilters.severities.includes(severity);
                        return (
                          <button
                            key={severity}
                            className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                              active
                                ? "border-primary/60 bg-primary/10 text-primary"
                                : "border-panel-border text-muted-foreground hover:text-foreground"
                            }`}
                            onClick={() =>
                              setHeatFilters((prev) => ({
                                ...prev,
                                severities: active
                                  ? prev.severities.filter((item) => item !== severity)
                                  : [...prev.severities, severity]
                              }))
                            }
                          >
                            {severity}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Crime contains</label>
                    <input
                      placeholder="e.g. robbery"
                      value={heatFilters.crime}
                      onChange={(e) =>
                        setHeatFilters((prev) => ({ ...prev, crime: e.target.value }))
                      }
                      className="w-full rounded-md border border-panel-border bg-background px-2 py-1 text-xs"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="flex-1 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                      onClick={() => setAppliedFilters({ ...heatFilters })}
                    >
                      Apply Filters
                    </button>
                    <button
                      className="flex-1 rounded-md border border-panel-border px-3 py-2 text-xs text-muted-foreground"
                      onClick={() => {
                        const resetFilters = {
                          startDate: "",
                          endDate: "",
                          startHour: 0,
                          endHour: 23,
                          severities: [...severityOptions],
                          crime: "",
                          limit: 5000
                        };
                        setHeatFilters(resetFilters);
                        setAppliedFilters(resetFilters);
                      }}
                    >
                      Reset
                    </button>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {heatmapLoading
                      ? "Loading heatmap..."
                      : heatmapError
                        ? `Heatmap error: ${heatmapError}`
                        : "Filters apply to both map and legend."}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div
            className={`relative rounded-xl border border-panel-border bg-background/30 overflow-hidden ${
              mapFullscreen ? "fixed inset-4 z-50 shadow-2xl" : "min-h-[420px]"
            }`}
          >
            <MapContainer
              center={mapCenter}
              zoom={6}
              style={{ height: "100%", width: "100%", zIndex: 0 }}
              preferCanvas
            >
              <TileLayer
                attribution={baseMapConfig[baseMap].attribution}
                url={baseMapConfig[baseMap].url}
              />
              {severityOptions.map((severity) => (
                <HeatLayer
                  key={severity}
                  points={severityHeatLayers[severity]}
                  options={heatOptions}
                  fitPoints={severity === "LOW" ? fitHeatPoints : undefined}
                  gradientOverride={severityGradients[severity]}
                />
              ))}
              <HeatHoverLayer points={hoverPoints} enabled={hoverEnabled} />
              <MapSizeSync fullscreen={mapFullscreen} />
            </MapContainer>

            <div
              className="absolute left-4 bottom-4 rounded-lg bg-card/95 backdrop-blur border border-panel-border p-3 text-xs text-muted-foreground"
              style={{ pointerEvents: "none", zIndex: 20 }}
            >
              <div className="font-semibold text-foreground">Intensity scale</div>
              <div className="mt-2 h-2 w-40 rounded-full" style={legendBarStyle} />
              <div className="mt-1 flex justify-between text-[10px]">
                <span>{weightStats.min.toFixed(2)}</span>
                <span>{weightStats.p50.toFixed(2)}</span>
                <span>{legendHigh.toFixed(2)}</span>
              </div>
            </div>

            <div
              className="absolute right-4 bottom-4 rounded-lg bg-card/95 backdrop-blur border border-panel-border p-3 text-xs"
              style={{ pointerEvents: "none", zIndex: 20 }}
            >
              <div className="space-y-1">
                {severityLegend.map((item) => (
                  <div key={item.severity} className="flex items-center gap-2 text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                    <span>{item.severity}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-[10px] text-muted-foreground">
                Mode: {heatOptions.weightMode.toUpperCase()} • Points: {weightStats.count}
              </div>
            </div>

            {mapFullscreen && (
              <button
                onClick={() => setMapFullscreen(false)}
                className="absolute top-4 right-4 rounded-md border border-panel-border bg-card/90 px-3 py-2 text-xs text-muted-foreground"
              >
                Exit Fullscreen
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-panel-border">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            {(["critical", "high", "medium", "low"] as const).map((level) => (
              <div key={level} className="flex items-center gap-1.5">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    level === "critical"
                      ? "bg-destructive"
                      : level === "high"
                        ? "bg-warning"
                        : level === "medium"
                          ? "bg-primary"
                          : "bg-success"
                  }`}
                />
                <span className="text-muted-foreground capitalize">{level}</span>
              </div>
            ))}
          </div>
          <span className="text-muted-foreground font-mono">{heatmap.length} active zones</span>
        </div>
      </div>
    </div>
  );
}
