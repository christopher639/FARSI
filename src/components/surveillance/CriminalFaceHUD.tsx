import { useState, useEffect, useRef, useCallback } from "react";
import { useFaceRecognition, type FaceSearchResult, type SuspectMatch, type FaceMatch } from "@/hooks/useFaceRecognition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import {
  Upload,
  Search,
  Camera,
  AlertTriangle,
  Shield,
  User,
  Eye,
  Loader2,
  XCircle,
  CheckCircle2,
  FileWarning,
  ScanFace,
  Database,
} from "lucide-react";

// ── Face mesh SVG points & lines ────────────────────────────────────────────
const FACE_POINTS: [number, number][] = [
  [50, 30], [30, 50], [70, 50], [50, 70], [35, 60], [65, 60], [50, 45],
  [40, 35], [60, 35], [45, 55], [55, 55], [50, 65], [38, 48], [62, 48],
];
const FACE_LINES: [number, number][] = [
  [0, 1], [0, 2], [1, 3], [2, 3], [1, 4], [2, 5], [4, 6], [5, 6], [6, 3],
  [7, 8], [7, 4], [8, 5], [9, 10], [9, 3], [10, 3], [11, 3], [4, 9], [5, 10],
];

function FaceMesh({ active, matched }: { active: boolean; matched: boolean }) {
  const color = matched ? "#ff3333" : active ? "#00ff88" : "#0088ff";
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" style={{ filter: `drop-shadow(0 0 6px ${color})` }}>
      {FACE_LINES.map(([a, b], i) => (
        <line key={i}
          x1={FACE_POINTS[a][0]} y1={FACE_POINTS[a][1]}
          x2={FACE_POINTS[b][0]} y2={FACE_POINTS[b][1]}
          stroke={color} strokeWidth="0.8" strokeOpacity="0.7"
        />
      ))}
      {FACE_POINTS.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.2" fill={color} opacity="0.9" />
      ))}
      {([[-2, -2], [72, -2], [-2, 72], [72, 72]] as [number, number][]).map(([bx, by], i) => {
        const sx = bx < 0 ? 1 : -1;
        const sy = by < 0 ? 1 : -1;
        return (
          <g key={i} stroke={color} strokeWidth="2" fill="none">
            <line x1={bx} y1={by} x2={bx + sx * 10} y2={by} />
            <line x1={bx} y1={by} x2={bx} y2={by + sy * 10} />
          </g>
        );
      })}
    </svg>
  );
}

function ScanLineAnimation({ active }: { active: boolean }) {
  const [y, setY] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setY((p) => (p + 2) % 100), 20);
    return () => clearInterval(id);
  }, [active]);

  if (!active) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        className="absolute w-full h-0.5 transition-none"
        style={{
          top: `${y}%`,
          background: "linear-gradient(90deg,transparent,#00ff88,transparent)",
          boxShadow: "0 0 8px #00ff88",
        }}
      />
    </div>
  );
}

function RiskBadge({ level }: { level: string }) {
  const variants: Record<string, string> = {
    HIGH: "bg-destructive/20 text-destructive border-destructive/30",
    MEDIUM: "bg-warning/20 text-warning border-warning/30",
    LOW: "bg-success/20 text-success border-success/30",
  };
  return (
    <Badge variant="outline" className={`text-xs font-bold tracking-widest ${variants[level] || "bg-muted text-muted-foreground"}`}>
      {level}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const upper = status.toUpperCase();
  const variants: Record<string, string> = {
    WANTED: "text-destructive border-destructive/50",
    INCARCERATED: "text-muted-foreground border-muted",
    "ON PAROLE": "text-warning border-warning/50",
  };
  return (
    <Badge variant="outline" className={`text-xs font-mono ${variants[upper] || "text-muted-foreground border-muted"}`}>
      {upper}
    </Badge>
  );
}

// ── Sighting log entry ──────────────────────────────────────────────────────
type SightingEntry = {
  suspect_id: string;
  name: string;
  confidence: number;
  timestamp: string;
  camera_id: string;
};

// ── Main component ──────────────────────────────────────────────────────────
export default function CriminalFaceHUD() {
  const {
    searching,
    result,
    searchFaces,
    fetchModelStatus,
    modelStatus,
    clearResult,
  } = useFaceRecognition();

  const [phase, setPhase] = useState<"idle" | "scanning" | "analyzing" | "matched" | "no_match">("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [sightingsLog, setSightingsLog] = useState<SightingEntry[]>([]);
  const [threshold, setThreshold] = useState(0.45);
  const [tick, setTick] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clock tick
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Fetch model status on mount
  useEffect(() => {
    fetchModelStatus();
  }, [fetchModelStatus]);

  const now = new Date();
  const timeStr = now.toTimeString().slice(0, 8);
  const dateStr = now.toDateString();

  // Handle file selection
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setImagePreview(URL.createObjectURL(file));
    clearResult();
    setPhase("idle");
  }, [clearResult]);

  // Run face search
  const runScan = useCallback(async () => {
    if (!selectedFile) {
      toast.error("Upload an image first");
      return;
    }

    setPhase("scanning");

    // Simulate scan progress then call API
    setTimeout(async () => {
      setPhase("analyzing");

      const data = await searchFaces(selectedFile, {
        similarity_threshold: threshold,
        top_k: 5,
      });

      if (!data) {
        setPhase("no_match");
        setTimeout(() => setPhase("idle"), 3000);
        return;
      }

      const hasMatches = data.matches.some((m) => m.suspects.length > 0);

      if (hasMatches) {
        setPhase("matched");
        // Add to sightings log
        const newEntries: SightingEntry[] = [];
        for (const face of data.matches) {
          for (const suspect of face.suspects) {
            newEntries.push({
              suspect_id: suspect.suspect_id,
              name: suspect.name,
              confidence: suspect.confidence,
              timestamp: new Date().toISOString(),
              camera_id: "UPLOAD",
            });
          }
        }
        setSightingsLog((prev) => [...newEntries, ...prev].slice(0, 50));
        toast.success(`${newEntries.length} suspect(s) identified!`);
      } else {
        setPhase("no_match");
        setTimeout(() => setPhase("idle"), 3000);
      }
    }, 1500);
  }, [selectedFile, searchFaces, threshold]);

  // Get the primary matched suspect
  const primaryMatch: SuspectMatch | null =
    result?.matches?.find((m) => m.suspects.length > 0)?.suspects[0] ?? null;

  return (
    <div className="rounded-lg border border-panel-border bg-card overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="border-b border-primary/20 px-4 py-2 flex items-center justify-between bg-card/80">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="text-primary text-xs tracking-widest font-mono">
            CRIMINAL INTELLIGENCE SYSTEM
          </span>
        </div>
        <div className="text-center hidden sm:block">
          <div className="text-warning text-xs tracking-widest font-bold">
            FACIAL RECOGNITION UNIT
          </div>
        </div>
        <div className="text-right font-mono">
          <div className="text-success text-sm">{timeStr}</div>
          <div className="text-muted-foreground text-xs">{dateStr}</div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row" style={{ minHeight: 520 }}>
        {/* ── Left Panel: Image Upload & Scan ──────────────────────────── */}
        <div className="lg:w-1/2 p-4 flex flex-col gap-3">
          {/* Upload controls */}
          <div className="flex gap-2 text-xs items-center">
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-3 h-3 mr-1" />
              Upload Image
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
            {selectedFile && (
              <span className="text-muted-foreground truncate max-w-[200px]">
                {selectedFile.name}
              </span>
            )}
            {modelStatus && (
              <Badge variant="outline" className="ml-auto text-xs">
                <Database className="w-3 h-3 mr-1" />
                {modelStatus.index_vectors} vectors
              </Badge>
            )}
          </div>

          {/* Image preview / scan area */}
          <div
            className="relative flex-1 border border-primary/20 rounded overflow-hidden bg-muted/20 min-h-[300px] flex items-center justify-center"
          >
            {/* Grid overlay */}
            <div
              className="absolute inset-0 pointer-events-none opacity-5"
              style={{
                backgroundImage:
                  "linear-gradient(hsl(var(--primary) / .5) 1px,transparent 1px),linear-gradient(90deg,hsl(var(--primary) / .5) 1px,transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />

            {imagePreview ? (
              <>
                <img
                  src={imagePreview}
                  alt="Upload preview"
                  className="max-w-full max-h-full object-contain relative z-10"
                />
                {/* Overlay bounding boxes from results */}
                {result?.matches?.map((face, i) => (
                  <div
                    key={i}
                    className="absolute z-20 pointer-events-none"
                    style={{
                      /* These are approximate — in production overlay on canvas */
                      border: face.suspects.length > 0 ? "2px solid hsl(var(--destructive))" : "2px solid hsl(var(--success))",
                      borderRadius: 2,
                    }}
                  />
                ))}
                <ScanLineAnimation active={phase === "scanning"} />
              </>
            ) : (
              <div className="flex flex-col items-center gap-4 text-muted-foreground">
                <div className="relative w-32 h-36">
                  <FaceMesh active={false} matched={false} />
                </div>
                <div className="text-xs tracking-widest text-center">
                  <ScanFace className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  UPLOAD AN IMAGE TO BEGIN SCAN
                </div>
              </div>
            )}

            {/* Status overlay */}
            <div
              className="absolute bottom-0 left-0 right-0 p-3 z-30"
              style={{ background: "linear-gradient(transparent, hsl(var(--card) / 0.9))" }}
            >
              {phase === "idle" && !imagePreview && (
                <div className="text-center text-muted-foreground text-xs tracking-widest">
                  AWAITING IMAGE UPLOAD
                </div>
              )}
              {phase === "idle" && imagePreview && (
                <div className="text-center text-primary text-xs tracking-widest">
                  READY TO SCAN
                </div>
              )}
              {phase === "scanning" && (
                <div className="text-center">
                  <div className="text-warning text-xs tracking-widest mb-1 animate-pulse">
                    SCANNING BIOMETRICS
                  </div>
                  <div className="w-full bg-muted rounded-full h-1">
                    <div
                      className="bg-warning h-1 rounded-full animate-pulse"
                      style={{ width: "60%" }}
                    />
                  </div>
                </div>
              )}
              {phase === "analyzing" && (
                <div className="text-primary text-xs tracking-widest text-center animate-pulse flex items-center justify-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  QUERYING DATABASE — PLEASE WAIT
                </div>
              )}
              {phase === "matched" && (
                <div className="text-destructive text-xs tracking-widest text-center animate-pulse flex items-center justify-center gap-2">
                  <AlertTriangle className="w-3 h-3" />
                  SUSPECT IDENTIFIED — ALERT DISPATCHED
                </div>
              )}
              {phase === "no_match" && (
                <div className="text-success text-xs tracking-widest text-center flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-3 h-3" />
                  NO MATCH FOUND IN DATABASE
                </div>
              )}
            </div>

            {/* Scan button */}
            {imagePreview && (
              <Button
                size="sm"
                variant="default"
                className="absolute bottom-12 right-3 z-30 text-xs tracking-widest"
                onClick={runScan}
                disabled={searching || phase === "scanning" || phase === "analyzing"}
              >
                {searching ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <Search className="w-3 h-3 mr-1" />
                )}
                RUN SCAN
              </Button>
            )}
          </div>

          {/* Threshold slider */}
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground whitespace-nowrap">
              Similarity Threshold:
            </span>
            <Slider
              value={[threshold]}
              min={0.2}
              max={0.9}
              step={0.05}
              className="flex-1"
              onValueChange={([v]) => setThreshold(v)}
            />
            <span className="text-primary font-mono w-10 text-right">
              {(threshold * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        {/* ── Right Panel ──────────────────────────────────────────────── */}
        <div className="lg:w-1/2 flex flex-col border-t lg:border-t-0 lg:border-l border-panel-border overflow-hidden">
          {/* Subject Identification Panel */}
          <div className="flex-1 p-4 overflow-y-auto border-b border-panel-border">
            <div className="text-xs text-primary tracking-widest mb-3 flex items-center gap-2 font-mono">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  phase === "matched" ? "bg-destructive animate-pulse" : "bg-muted-foreground/30"
                }`}
              />
              SUBJECT IDENTIFICATION
            </div>

            {phase === "matched" && primaryMatch ? (
              <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* Alert banner */}
                <div className="border border-destructive/50 rounded-lg p-3 flex items-center gap-3 bg-destructive/5">
                  <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
                  <div className="flex-1">
                    <div className="text-destructive text-xs font-bold tracking-widest">
                      DATABASE MATCH CONFIRMED
                    </div>
                    <div className="text-muted-foreground text-xs">
                      Confidence: {primaryMatch.match_pct}
                    </div>
                  </div>
                  <RiskBadge level={primaryMatch.risk_level || "MEDIUM"} />
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {([
                    ["SUSPECT ID", primaryMatch.suspect_id],
                    ["FULL NAME", primaryMatch.name],
                    ["DATE OF BIRTH", primaryMatch.dob || "N/A"],
                    ["ID NUMBER", primaryMatch.id_number || "N/A"],
                    ["NATIONALITY", primaryMatch.nationality || "N/A"],
                    ["CHARGES", primaryMatch.charges || "N/A"],
                    ["LAST KNOWN LOCATION", primaryMatch.last_seen || "N/A"],
                    ["CASE NUMBER", primaryMatch.case_number || "N/A"],
                  ] as [string, string][]).map(([label, val]) => (
                    <div
                      key={label}
                      className="border border-panel-border rounded-md p-2 bg-muted/20"
                    >
                      <div className="text-muted-foreground text-xs mb-0.5 tracking-wider">
                        {label}
                      </div>
                      <div className="text-foreground font-bold truncate">{val}</div>
                    </div>
                  ))}
                </div>

                {/* Status row */}
                <div className="flex items-center gap-3 border border-panel-border rounded-lg p-2 bg-muted/20">
                  <span className="text-muted-foreground text-xs tracking-wider">STATUS</span>
                  <StatusBadge status={primaryMatch.status || "Unknown"} />
                  <span className="text-muted-foreground text-xs tracking-wider ml-auto">
                    RISK
                  </span>
                  <RiskBadge level={primaryMatch.risk_level || "MEDIUM"} />
                </div>

                {/* Show all face matches */}
                {result && result.matches.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    <span className="tracking-wider">
                      FACES DETECTED: {result.faces_detected}
                    </span>
                    {result.matches.map((face, fi) => (
                      <div
                        key={fi}
                        className="mt-1 pl-2 border-l-2 border-primary/30"
                      >
                        Face #{fi + 1} — Age: {face.age ?? "?"}, Gender:{" "}
                        {face.gender ?? "?"}, Score: {face.det_score.toFixed(2)}
                        {face.suspects.length > 0 && (
                          <span className="text-destructive ml-2 font-bold">
                            {face.suspects.length} match(es)
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2">
                  {["DISPATCH UNIT", "FLAG ALERT", "PRINT REPORT"].map((a) => (
                    <Button
                      key={a}
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs border-destructive/50 text-destructive hover:bg-destructive/10 tracking-widest"
                      onClick={() => toast.info(`${a} — not yet implemented`)}
                    >
                      {a}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3 py-8">
                <div className="w-20 h-20 border-2 border-muted rounded-full flex items-center justify-center">
                  <User className="w-8 h-8 opacity-30" />
                </div>
                <div className="text-xs tracking-widest font-mono">
                  {phase === "scanning"
                    ? "SCANNING..."
                    : phase === "analyzing"
                    ? "SEARCHING DATABASE..."
                    : phase === "no_match"
                    ? "NO MATCH FOUND"
                    : "NO SUBJECT DETECTED"}
                </div>
              </div>
            )}
          </div>

          {/* Sightings Log */}
          <div className="h-48 p-3">
            <div className="text-xs text-primary tracking-widest mb-2 flex items-center gap-2 font-mono">
              <Eye className="w-3 h-3" />
              SIGHTINGS LOG
              <span className="ml-auto text-muted-foreground">
                {sightingsLog.length} events
              </span>
            </div>
            <ScrollArea className="h-36">
              <div className="space-y-1">
                {sightingsLog.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-4">
                    No sightings recorded yet
                  </div>
                ) : (
                  sightingsLog.map((s, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-xs border border-panel-border rounded px-2 py-1 hover:border-primary/30 transition-colors bg-muted/10"
                    >
                      <span className="text-destructive">
                        <AlertTriangle className="w-3 h-3" />
                      </span>
                      <span className="text-foreground w-28 truncate font-medium">
                        {s.name}
                      </span>
                      <span className="text-muted-foreground w-16">{s.camera_id}</span>
                      <Badge
                        variant="outline"
                        className="text-success border-success/30 text-xs"
                      >
                        {(s.confidence * 100).toFixed(1)}%
                      </Badge>
                      <span className="text-muted-foreground text-xs ml-auto">
                        {new Date(s.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Stats footer */}
          <div className="border-t border-panel-border px-4 py-2 flex gap-4 text-xs text-muted-foreground font-mono">
            {([
              ["DB SIZE", modelStatus?.index_vectors?.toLocaleString() ?? "—"],
              ["SCANS", String(sightingsLog.length)],
              ["MATCHES", String(sightingsLog.length)],
              ["THRESHOLD", `${(threshold * 100).toFixed(0)}%`],
            ] as [string, string][]).map(([l, v]) => (
              <div key={l} className="text-center">
                <div className="text-primary font-bold text-sm">{v}</div>
                <div className="tracking-wider text-[10px]">{l}</div>
              </div>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-success text-xs">ONLINE</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
