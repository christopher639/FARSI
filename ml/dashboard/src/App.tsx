import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import * as L from "leaflet";
import "leaflet.heat";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  classifyText,
  detectMotion,
  extractEntities,
  getHealth,
  getHeatmap,
  getHeatmapPoints,
  getSimulatedAlerts,
  predictUcfUpload,
  predictUcf,
  predictMl,
  trainMl,
  trainUcf,
  trainNlp
} from "./api";
import type { HeatmapPoint, HeatmapQuery } from "./api";

const sections = [
  "Overview",
  "Threat Heatmap",
  "Threat Alerts",
  "ML Prediction",
  "NLP",
  "CV Motion",
  "Surveillance",
  "System"
] as const;
const severityOptions = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const severityColorMap: Record<string, { light: string; mid: string; dark: string }> = {
  LOW: { light: "#86efac", mid: "#22c55e", dark: "#15803d" },
  MEDIUM: { light: "#93c5fd", mid: "#3b82f6", dark: "#1d4ed8" },
  HIGH: { light: "#fdba74", mid: "#f59e0b", dark: "#b45309" },
  CRITICAL: { light: "#fca5a5", mid: "#ef4444", dark: "#b91c1c" }
};

type Section = (typeof sections)[number];

type HeatmapRow = {
  "AREA NAME": string;
  incident_count: number;
  severity: string;
};

type AlertRow = {
  id: string;
  severity: string;
  status: string;
  location: string;
  source: string;
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
  }, [map, options, points]);

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

function HeatHoverLayer({
  points,
  enabled
}: {
  points: HeatmapPoint[];
  enabled: boolean;
}) {
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

export default function App() {
  const [section, setSection] = useState<Section>("Overview");
  const [health, setHealth] = useState<string>("checking...");
  const [heatmap, setHeatmap] = useState<HeatmapRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [trainReport, setTrainReport] = useState<string>("");
  const [nlpReport, setNlpReport] = useState<string>("");
  const [prediction, setPrediction] = useState<string>("");
  const [textInput, setTextInput] = useState<string>("");
  const [entities, setEntities] = useState<string>("");
  const [motionResult, setMotionResult] = useState<string>("");
  const [ucfDatasetPath, setUcfDatasetPath] = useState<string>("");
  const [ucfLabelMode, setUcfLabelMode] = useState<"binary" | "multiclass">("binary");
  const [ucfMaxVideos, setUcfMaxVideos] = useState<number>(200);
  const [ucfEpochs, setUcfEpochs] = useState<number>(2);
  const [ucfTrainOutput, setUcfTrainOutput] = useState<string>("");
  const [ucfVideoPath, setUcfVideoPath] = useState<string>("");
  const [ucfPredictOutput, setUcfPredictOutput] = useState<string>("");
  const [ucfUploadFile, setUcfUploadFile] = useState<File | null>(null);
  const [ucfBusy, setUcfBusy] = useState<boolean>(false);
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

  const [recordPayload, setRecordPayload] = useState(
    JSON.stringify(
      {
        "AREA NAME": "Wilshire",
        "Rpt Dist No": 784,
        "Premis Desc": "STREET",
        "Weapon Desc": "UNKNOWN WEAPON/OTHER WEAPON",
        "Vict Age": 34,
        "Vict Sex": "M",
        "Vict Descent": "O",
        "TIME OCC": 2130,
        "DATE OCC": "01/03/2020",
        "LAT": 34.0375,
        "LON": -118.3506
      },
      null,
      2
    )
  );

  useEffect(() => {
    getHealth()
      .then((data) => setHealth(data.status))
      .catch(() => setHealth("offline"));
  }, []);

  useEffect(() => {
    if (!mapFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mapFullscreen]);

  useEffect(() => {
    if (section === "Threat Alerts") {
      getSimulatedAlerts().then((data) => setAlerts(data.data as AlertRow[]));
    }
  }, [section]);

  useEffect(() => {
    if (section !== "Threat Heatmap") return;
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
    Promise.all([getHeatmap(baseQuery), getHeatmapPoints(pointsQuery)])
      .then(([heatmapData, pointsData]) => {
        setHeatmap(heatmapData.rows as HeatmapRow[]);
        setHeatPoints(pointsData.points as HeatmapPoint[]);
      })
      .catch((err) => {
        setHeatmapError(err?.message || "Failed to load heatmap");
        setHeatmap([]);
        setHeatPoints([]);
      })
      .finally(() => setHeatmapLoading(false));
  }, [appliedFilters, section]);

  const criticalCount = useMemo(
    () => heatmap.filter((row) => row.severity === "CRITICAL").length,
    [heatmap]
  );

  const severityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    heatmap.forEach((row) => {
      counts[row.severity] = (counts[row.severity] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [heatmap]);

  const topHeatmap = useMemo(
    () => [...heatmap].sort((a, b) => b.incident_count - a.incident_count).slice(0, 10),
    [heatmap]
  );

  const maxIncidents = useMemo(() => {
    if (!heatmap.length) return 1;
    return Math.max(...heatmap.map((row) => row.incident_count));
  }, [heatmap]);

  const mapCenter: [number, number] = [34.0522, -118.2437];

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

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>FARSI Command Center</h1>
        <nav>
          {sections.map((item) => (
            <button
              key={item}
              className={item === section ? "active" : ""}
              onClick={() => setSection(item)}
            >
              {item}
            </button>
          ))}
        </nav>
        <p className="notice">API status: {health}</p>
      </aside>

      <main className="content">
        <header className="header">
          <h2>{section}</h2>
        </header>

        {section === "Overview" && (
          <div className="grid">
            <div className="card">
              <h3>Active Threat Zones</h3>
              <p style={{ fontSize: 28, fontWeight: 700 }}>{criticalCount}</p>
              <p className="notice">Critical heatmap zones</p>
            </div>
            <div className="card">
              <h3>System Health</h3>
              <p style={{ fontSize: 28, fontWeight: 700 }}>{health}</p>
              <p className="notice">Realtime API connectivity</p>
            </div>
            <div className="card">
              <h3>Alerts Monitored</h3>
              <p style={{ fontSize: 28, fontWeight: 700 }}>{alerts.length}</p>
              <p className="notice">Simulated alerts feed</p>
            </div>
          </div>
        )}

        {section === "Threat Heatmap" && (
          <div className="grid grid-3">
            <div className="card">
              <h3>Heatmap Intensity</h3>
              <div style={{ marginTop: 12 }}>
                {topHeatmap.map((row) => {
                  const width = Math.max(6, Math.round((row.incident_count / maxIncidents) * 100));
                  return (
                    <div className="heat-row" key={row["AREA NAME"]}>
                      <strong>{row["AREA NAME"]}</strong>
                      <span>{row.incident_count.toLocaleString()}</span>
                      <div className="heat-bar" title={`${row.severity} intensity`}>
                        <span style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  );
                })}
                <div className="heat-legend">
                  <span>Low</span>
                  <span>High</span>
                </div>
              </div>
            </div>
            <div className="card">
              <h3>Top 10 Areas by Incidents</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topHeatmap} layout="vertical" margin={{ left: 10 }}>
                  <XAxis type="number" />
                  <YAxis dataKey="AREA NAME" type="category" width={120} />
                  <Tooltip />
                  <Bar dataKey="incident_count" fill="#38bdf8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card">
              <h3>Severity Distribution</h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={severityCounts} dataKey="value" nameKey="name" outerRadius={90}>
                    {severityCounts.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={
                          entry.name === "CRITICAL"
                            ? "#ef4444"
                            : entry.name === "HIGH"
                              ? "#f59e0b"
                              : entry.name === "MEDIUM"
                                ? "#3b82f6"
                                : "#22c55e"
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="card map-card">
              <h3>Threat Map</h3>
              <div className="map-split">
                <div className="map-controls">
                  <h4>Heatmap Controls</h4>
                  <div className="control-row">
                    <label>Radius</label>
                    <input
                      type="range"
                      min={10}
                      max={50}
                      step={2}
                      value={heatOptions.radius}
                      onChange={(e) =>
                        setHeatOptions((prev) => ({ ...prev, radius: Number(e.target.value) }))
                      }
                    />
                    <span>{heatOptions.radius}px</span>
                  </div>
                  <div className="control-row">
                    <label>Blur</label>
                    <input
                      type="range"
                      min={8}
                      max={40}
                      step={2}
                      value={heatOptions.blur}
                      onChange={(e) =>
                        setHeatOptions((prev) => ({ ...prev, blur: Number(e.target.value) }))
                      }
                    />
                    <span>{heatOptions.blur}px</span>
                  </div>
                  <div className="control-row">
                    <label>Opacity</label>
                    <input
                      type="range"
                      min={0.1}
                      max={0.5}
                      step={0.05}
                      value={heatOptions.minOpacity}
                      onChange={(e) =>
                        setHeatOptions((prev) => ({ ...prev, minOpacity: Number(e.target.value) }))
                      }
                    />
                    <span>{heatOptions.minOpacity.toFixed(2)}</span>
                  </div>
                  <div className="control-row">
                    <label>Intensity</label>
                    <input
                      type="range"
                      min={0.2}
                      max={2}
                      step={0.1}
                      value={heatOptions.intensity}
                      onChange={(e) =>
                        setHeatOptions((prev) => ({ ...prev, intensity: Number(e.target.value) }))
                      }
                    />
                    <span>{heatOptions.intensity.toFixed(1)}x</span>
                  </div>
                  <div className="control-row">
                    <label>Threshold</label>
                    <input
                      type="range"
                      min={0}
                      max={2}
                      step={0.1}
                      value={heatOptions.threshold}
                      onChange={(e) =>
                        setHeatOptions((prev) => ({ ...prev, threshold: Number(e.target.value) }))
                      }
                    />
                    <span>{heatOptions.threshold.toFixed(1)}</span>
                  </div>
                  <div className="control-section">
                    <div className="control-field">
                      <label>Weight scaling</label>
                      <div className="chip-group">
                        {(["max", "p95", "log"] as const).map((mode) => (
                          <button
                            key={mode}
                            className={`chip ${heatOptions.weightMode === mode ? "active" : ""}`}
                            onClick={() => setHeatOptions((prev) => ({ ...prev, weightMode: mode }))}
                          >
                            {mode === "max" ? "Max" : mode.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="control-section">
                    <div className="control-field">
                      <label>Basemap</label>
                      <div className="chip-group">
                        {baseMapOptions.map((mode) => (
                          <button
                            key={mode}
                            className={`chip ${baseMap === mode ? "active" : ""}`}
                            onClick={() => setBaseMap(mode)}
                          >
                            {baseMapConfig[mode].label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={heatOptions.dynamicRadius}
                      onChange={(e) =>
                        setHeatOptions((prev) => ({ ...prev, dynamicRadius: e.target.checked }))
                      }
                    />
                    Dynamic radius
                  </label>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={hoverEnabled}
                      onChange={(e) => setHoverEnabled(e.target.checked)}
                    />
                    Point hover tooltips
                  </label>
                  <div className="pill">
                    <button
                      className={heatOptions.gradientMode === "multi" ? "active" : ""}
                      onClick={() => setHeatOptions((prev) => ({ ...prev, gradientMode: "multi" }))}
                    >
                      Multi-color preset
                    </button>
                    <button
                      className={heatOptions.gradientMode === "single" ? "active" : ""}
                      onClick={() => setHeatOptions((prev) => ({ ...prev, gradientMode: "single" }))}
                    >
                      Single-color preset
                    </button>
                  </div>
                  <div className="control-section">
                    <h4>Data Filters</h4>
                    <div className="control-field">
                      <label>Max points</label>
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
                      />
                      <span className="control-value">{heatFilters.limit.toLocaleString()}</span>
                    </div>
                    <div className="control-grid two">
                      <div className="control-field">
                        <label>Start date</label>
                        <input
                          type="date"
                          value={heatFilters.startDate}
                          onChange={(e) =>
                            setHeatFilters((prev) => ({ ...prev, startDate: e.target.value }))
                          }
                        />
                      </div>
                      <div className="control-field">
                        <label>End date</label>
                        <input
                          type="date"
                          value={heatFilters.endDate}
                          onChange={(e) =>
                            setHeatFilters((prev) => ({ ...prev, endDate: e.target.value }))
                          }
                        />
                      </div>
                    </div>
                    <div className="control-grid two">
                      <div className="control-field">
                        <label>Start hour</label>
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
                        />
                      </div>
                      <div className="control-field">
                        <label>End hour</label>
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
                        />
                      </div>
                    </div>
                    <div className="control-field">
                      <label>Severity</label>
                      <div className="chip-group">
                        {severityOptions.map((severity) => {
                          const active = heatFilters.severities.includes(severity);
                          return (
                            <button
                              key={severity}
                              className={`chip ${active ? "active" : ""}`}
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
                    <div className="control-field">
                      <label>Crime contains</label>
                      <input
                        placeholder="e.g. robbery"
                        value={heatFilters.crime}
                        onChange={(e) =>
                          setHeatFilters((prev) => ({ ...prev, crime: e.target.value }))
                        }
                      />
                    </div>
                    <div className="control-actions">
                      <button
                        className="primary"
                        onClick={() => setAppliedFilters({ ...heatFilters })}
                      >
                        Apply Filters
                      </button>
                      <button
                        className="secondary"
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
                    <div className="notice">
                      {heatmapLoading
                        ? "Loading heatmap..."
                        : heatmapError
                          ? `Heatmap error: ${heatmapError}`
                          : "Filters apply to both map and charts."}
                    </div>
                  </div>
                </div>
                <div className={`map map-large ${mapFullscreen ? "map-fullscreen" : ""}`}>
                  <MapContainer center={mapCenter} zoom={10} style={{ height: "100%" }} preferCanvas>
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
                  <div className="map-overlay">
                    <div className="map-legend">
                      <div className="map-legend-title">Intensity scale</div>
                      <div
                        className={`map-legend-bar ${
                          heatOptions.gradientMode === "single" ? "single" : ""
                        }`}
                      />
                      <div className="map-legend-labels">
                        <span>{weightStats.min.toFixed(2)}</span>
                        <span>{weightStats.p50.toFixed(2)}</span>
                        <span>{legendHigh.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="severity-legend">
                      {severityLegend.map((item) => (
                        <div key={item.severity} className="severity-item">
                          <span
                            className="severity-swatch"
                            style={{ background: item.color }}
                          />
                          <span>{item.severity}</span>
                        </div>
                      ))}
                    </div>
                    <div className="map-meta">
                      Mode: {heatOptions.weightMode.toUpperCase()} | Points: {weightStats.count}
                    </div>
                  </div>
                  <div className="map-actions">
                    <button
                      className="secondary"
                      onClick={() => setMapFullscreen((prev) => !prev)}
                    >
                      {mapFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                    </button>
                  </div>
                </div>
              </div>
              <p className="notice" style={{ marginTop: 8 }}>
                Heatmap built from live incident coordinates.
              </p>
            </div>
          </div>
        )}

        {section === "Threat Alerts" && (
          <div className="card">
            <h3>Live Alerts</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <tr key={alert.id}>
                    <td>{alert.id}</td>
                    <td>
                      <span className={`badge ${alert.severity.toLowerCase()}`}>
                        {alert.severity}
                      </span>
                    </td>
                    <td>{alert.status}</td>
                    <td>{alert.location}</td>
                    <td>{alert.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {section === "ML Prediction" && (
          <div className="grid">
            <div className="card">
              <h3>Train Predictive Model</h3>
              <p className="notice">Uses crime_in_la.csv on the backend.</p>
              <button
                className="primary"
                onClick={async () => {
                  const data = await trainMl();
                  setTrainReport(data.report);
                }}
              >
                Train ML Model
              </button>
              <pre className="notice" style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>
                {trainReport}
              </pre>
            </div>
            <div className="card">
              <h3>Predict Crime Code</h3>
              <textarea value={recordPayload} onChange={(e) => setRecordPayload(e.target.value)} />
              <div className="row" style={{ marginTop: 12 }}>
                <button
                  className="primary"
                  onClick={async () => {
                    const payload = JSON.parse(recordPayload);
                    const data = await predictMl(payload);
                    setPrediction(String(data.prediction));
                  }}
                >
                  Predict
                </button>
                <button className="secondary" onClick={() => setPrediction("")}
                >
                  Clear
                </button>
              </div>
              {prediction && <p style={{ marginTop: 12 }}>Prediction: {prediction}</p>}
            </div>
          </div>
        )}

        {section === "NLP" && (
          <div className="grid">
            <div className="card">
              <h3>Train NLP Classifier</h3>
              <button
                className="primary"
                onClick={async () => {
                  const data = await trainNlp();
                  setNlpReport(data.report);
                }}
              >
                Train NLP Model
              </button>
              <pre className="notice" style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>
                {nlpReport}
              </pre>
            </div>
            <div className="card">
              <h3>Classify Text / Extract Entities</h3>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Paste report text here..."
              />
              <div className="row" style={{ marginTop: 12 }}>
                <button
                  className="primary"
                  onClick={async () => {
                    const data = await classifyText(textInput);
                    setPrediction(String(data.prediction));
                  }}
                >
                  Classify
                </button>
                <button
                  className="secondary"
                  onClick={async () => {
                    const data = await extractEntities(textInput);
                    setEntities(JSON.stringify(data, null, 2));
                  }}
                >
                  Extract Entities
                </button>
              </div>
              {prediction && <p style={{ marginTop: 12 }}>Class Prediction: {prediction}</p>}
              {entities && (
                <pre className="notice" style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>
                  {entities}
                </pre>
              )}
            </div>
          </div>
        )}

        {section === "CV Motion" && (
          <div className="card">
            <h3>Motion Detection</h3>
            <p className="notice">Provide a local video path on the API server machine.</p>
            <div className="row" style={{ marginTop: 12 }}>
              <input
                placeholder="D:\\videos\\sample.mp4"
                onChange={(e) => setMotionResult(e.target.value)}
                value={motionResult}
              />
              <button
                className="primary"
                onClick={async () => {
                  const data = await detectMotion(motionResult, 500);
                  setMotionResult(JSON.stringify(data.events.slice(0, 5), null, 2));
                }}
              >
                Run
              </button>
            </div>
            {motionResult && motionResult.startsWith("[") && (
              <pre className="notice" style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>
                {motionResult}
              </pre>
            )}
          </div>
        )}

        {section === "Surveillance" && (
          <div className="grid">
            <div className="card">
              <h3>Surveillance Crime Prediction (UCF-Crime)</h3>
              <p className="notice">
                Uses transfer learning (R3D-18). Leave dataset path empty to download via kagglehub
                (requires Kaggle credentials on the API machine).
              </p>
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                <input
                  placeholder="Dataset path (optional), e.g. D:\\datasets\\ucf-crime"
                  value={ucfDatasetPath}
                  onChange={(e) => setUcfDatasetPath(e.target.value)}
                />
                <div className="row">
                  <label className="notice" style={{ alignSelf: "center" }}>
                    Label mode
                  </label>
                  <select
                    value={ucfLabelMode}
                    onChange={(e) => setUcfLabelMode(e.target.value as "binary" | "multiclass")}
                  >
                    <option value="binary">binary (Crime vs Normal)</option>
                    <option value="multiclass">multiclass (by folder name)</option>
                  </select>
                </div>
                <div className="row">
                  <label className="notice" style={{ alignSelf: "center" }}>
                    Max videos
                  </label>
                  <input
                    type="number"
                    min={50}
                    max={5000}
                    value={ucfMaxVideos}
                    onChange={(e) => setUcfMaxVideos(Number(e.target.value))}
                  />
                </div>
                <div className="row">
                  <label className="notice" style={{ alignSelf: "center" }}>
                    Epochs
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={ucfEpochs}
                    onChange={(e) => setUcfEpochs(Number(e.target.value))}
                  />
                </div>
                <div className="row">
                  <button
                    className="primary"
                    disabled={ucfBusy}
                    onClick={async () => {
                      setUcfBusy(true);
                      setUcfTrainOutput("Training...");
                      try {
                        const data = await trainUcf({
                          dataset_path: ucfDatasetPath ? ucfDatasetPath : null,
                          label_mode: ucfLabelMode,
                          max_videos: ucfMaxVideos,
                          epochs: ucfEpochs
                        });
                        setUcfTrainOutput(JSON.stringify(data, null, 2));
                      } catch (err) {
                        setUcfTrainOutput(String(err));
                      } finally {
                        setUcfBusy(false);
                      }
                    }}
                  >
                    Train UCF Model
                  </button>
                  <button className="secondary" onClick={() => setUcfTrainOutput("")}
                  >
                    Clear
                  </button>
                </div>
              </div>
              {ucfTrainOutput && (
                <pre className="notice" style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>
                  {ucfTrainOutput}
                </pre>
              )}
            </div>

            <div className="card">
              <h3>Predict From Video</h3>
              <p className="notice">Provide a local video path on the API server machine.</p>
              <div className="row" style={{ marginTop: 12 }}>
                <input
                  placeholder="D:\\videos\\clip.mp4"
                  value={ucfVideoPath}
                  onChange={(e) => setUcfVideoPath(e.target.value)}
                />
                <button
                  className="primary"
                  disabled={ucfBusy}
                  onClick={async () => {
                    setUcfBusy(true);
                    setUcfPredictOutput("Predicting...");
                    try {
                      const data = await predictUcf({
                        video_path: ucfVideoPath,
                        label_mode: ucfLabelMode
                      });
                      setUcfPredictOutput(JSON.stringify(data, null, 2));
                    } catch (err) {
                      setUcfPredictOutput(String(err));
                    } finally {
                      setUcfBusy(false);
                    }
                  }}
                >
                  Predict
                </button>
              </div>

              <div style={{ marginTop: 16 }}>
                <p className="notice">Or upload a clip (recommended for browser usage).</p>
                <div className="row" style={{ marginTop: 10 }}>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => setUcfUploadFile(e.target.files?.[0] ?? null)}
                  />
                  <button
                    className="primary"
                    disabled={ucfBusy || !ucfUploadFile}
                    onClick={async () => {
                      if (!ucfUploadFile) return;
                      setUcfBusy(true);
                      setUcfPredictOutput("Uploading & predicting...");
                      try {
                        const data = await predictUcfUpload(ucfUploadFile, {
                          label_mode: ucfLabelMode
                        });
                        setUcfPredictOutput(JSON.stringify(data, null, 2));
                      } catch (err) {
                        setUcfPredictOutput(String(err));
                      } finally {
                        setUcfBusy(false);
                      }
                    }}
                  >
                    Upload & Predict
                  </button>
                </div>
              </div>

              {ucfPredictOutput && (
                <pre className="notice" style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>
                  {ucfPredictOutput}
                </pre>
              )}
            </div>
          </div>
        )}

        {section === "System" && (
          <div className="card">
            <h3>System Notes</h3>
            <ul style={{ marginLeft: 18, display: "grid", gap: 8 }}>
              <li>Ensure API is running at {import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"}</li>
              <li>Train ML and NLP models before predictions.</li>
              <li>Heatmap data loads from /ml/heatmap endpoint.</li>
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
