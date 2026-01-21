import { Eye, Video, Camera, Radio, MapPin, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const cameras = [
  { id: "CAM-001", location: "Nairobi CBD - Kenyatta Ave", status: "active", type: "CCTV" },
  { id: "CAM-002", location: "JKIA Terminal 1", status: "active", type: "CCTV" },
  { id: "CAM-003", location: "Mombasa Port Entry", status: "active", type: "CCTV" },
  { id: "CAM-004", location: "Garissa Border Post", status: "maintenance", type: "CCTV" },
  { id: "CAM-005", location: "Nakuru Highway", status: "active", type: "Traffic" },
  { id: "CAM-006", location: "Kisumu Airport", status: "active", type: "CCTV" },
];

const statusColors = {
  active: "bg-success/20 text-success border-success/30",
  maintenance: "bg-warning/20 text-warning border-warning/30",
  offline: "bg-destructive/20 text-destructive border-destructive/30",
};

export default function SurveillancePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Surveillance Network</h1>
          <p className="text-muted-foreground">Real-time CCTV feeds and monitoring stations</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="bg-success/20 text-success">
            <span className="w-2 h-2 bg-success rounded-full mr-2 animate-pulse" />
            {cameras.filter(c => c.status === 'active').length} Active
          </Badge>
        </div>
      </div>

      {/* Camera Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cameras.map((camera) => (
          <div key={camera.id} className="bg-card border border-panel-border rounded-lg overflow-hidden group">
            {/* Video Feed Placeholder */}
            <div className="aspect-video bg-muted relative flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <Video className="w-12 h-12 text-muted-foreground/50" />
              
              {/* Status Indicator */}
              <div className="absolute top-3 right-3">
                <Badge className={statusColors[camera.status as keyof typeof statusColors]}>
                  {camera.status}
                </Badge>
              </div>

              {/* Camera ID */}
              <div className="absolute top-3 left-3 text-xs font-mono text-white/80 bg-black/50 px-2 py-1 rounded">
                {camera.id}
              </div>

              {/* Timestamp */}
              <div className="absolute bottom-3 right-3 flex items-center gap-1 text-xs text-white/80 bg-black/50 px-2 py-1 rounded">
                <Clock className="w-3 h-3" />
                LIVE
              </div>

              {/* Hover Controls */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button size="sm" variant="secondary">
                  <Eye className="w-4 h-4 mr-1" />
                  View
                </Button>
              </div>
            </div>

            {/* Camera Info */}
            <div className="p-3">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="truncate">{camera.location}</span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <Camera className="w-3 h-3" />
                <span>{camera.type}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
