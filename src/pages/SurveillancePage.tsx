import { useEffect, useMemo, useState } from "react";
import { useSurveillanceLogs } from "@/hooks/useSurveillanceLogs";
import { useAuth } from "@/contexts/AuthContext";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { Eye, Video, Camera, MapPin, Clock, Plus, Loader2, Edit, Trash2, ScanFace } from "lucide-react";
import CriminalFaceHUD from "@/components/surveillance/CriminalFaceHUD";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { z } from "zod";

const surveillanceSchema = z.object({
  event_type: z.string().min(2, "Event type is required").max(100),
  subject: z.string().max(200).optional(),
  location: z.string().max(200).optional(),
  event_description: z.string().max(2000).optional(),
});

type Stream = {
  id: string;
  name: string;
  status?: string | null;
  rtsp_url?: string | null;
  created_at?: string;
  last_heartbeat?: string | null;
};

const statusColors = {
  active: "bg-success/20 text-success border-success/30",
  maintenance: "bg-warning/20 text-warning border-warning/30",
  inactive: "bg-muted text-muted-foreground",
  offline: "bg-destructive/20 text-destructive border-destructive/30",
};

const eventTypeOptions = [
  { value: "motion_detected", label: "Motion Detected" },
  { value: "facial_recognition", label: "Facial Recognition" },
  { value: "vehicle_identified", label: "Vehicle Identified" },
  { value: "perimeter_breach", label: "Perimeter Breach" },
  { value: "suspicious_activity", label: "Suspicious Activity" },
  { value: "crowd_gathering", label: "Crowd Gathering" },
  { value: "other", label: "Other" },
];

export default function SurveillancePage() {
  const { logs, loading, refetch } = useSurveillanceLogs();
  const { user, isAdmin } = useAuth();
  const [streams, setStreams] = useState<Stream[]>([]);
  const [streamsLoading, setStreamsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingLog, setEditingLog] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"cameras" | "logs" | "face_recognition">("cameras");

  const [formData, setFormData] = useState({
    event_type: "",
    subject: "",
    location: "",
    event_description: "",
  });

  const resetForm = () => {
    setFormData({
      event_type: "",
      subject: "",
      location: "",
      event_description: "",
    });
  };

  const fetchStreams = async () => {
    try {
      setStreamsLoading(true);
      const data = await apiGet<Stream[]>("/surveillance/streams");
      setStreams(data || []);
    } catch (error) {
      console.error("Failed to fetch surveillance streams", error);
      setStreams([]);
    } finally {
      setStreamsLoading(false);
    }
  };

  useEffect(() => {
    fetchStreams();
  }, []);

  const cameras = useMemo(() => {
    if (streams.length) {
      return streams.map((s) => ({
        id: s.id,
        location: s.name,
        status: (s.status || "inactive").toLowerCase(),
        type: s.rtsp_url ? "CCTV" : "Sensor",
        lastSeen: s.last_heartbeat || s.created_at || null,
      }));
    }

    // Fallback to inferred camera nodes from real surveillance logs.
    const byLocation = new Map<string, { count: number; latestTs: string }>();
    for (const log of logs) {
      const loc = (log.location || "Unknown Location").trim();
      const prev = byLocation.get(loc);
      if (!prev) {
        byLocation.set(loc, { count: 1, latestTs: log.timestamp });
      } else {
        prev.count += 1;
        if (new Date(log.timestamp).getTime() > new Date(prev.latestTs).getTime()) {
          prev.latestTs = log.timestamp;
        }
      }
    }

    return Array.from(byLocation.entries()).map(([location, meta], idx) => {
      const ageHours = (Date.now() - new Date(meta.latestTs).getTime()) / (1000 * 60 * 60);
      const status = ageHours <= 24 ? "active" : ageHours <= 72 ? "maintenance" : "offline";
      return {
        id: `LOG-CAM-${String(idx + 1).padStart(3, "0")}`,
        location,
        status,
        type: "Derived",
        lastSeen: meta.latestTs,
      };
    });
  }, [streams, logs]);

  const handleCreateLog = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = surveillanceSchema.safeParse(formData);
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    if (!user) {
      toast.error("You must be logged in");
      return;
    }

    setCreating(true);
    try {
      await apiPost("/surveillance/logs", {
        event_type: formData.event_type,
        subject: formData.subject || null,
        location: formData.location || null,
        event_description: formData.event_description || null,
        recorded_by: user.id,
      });

      toast.success("Surveillance log created");
      setIsCreateDialogOpen(false);
      resetForm();
      refetch();
    } catch (error: any) {
      console.error("Error creating log:", error);
      toast.error(error.message || "Failed to create log");
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLog) return;
    
    const validation = surveillanceSchema.safeParse(formData);
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setCreating(true);
    try {
      await apiPut(`/surveillance/logs/${editingLog.id}`, {
        event_type: formData.event_type,
        subject: formData.subject || null,
        location: formData.location || null,
        event_description: formData.event_description || null,
      });

      toast.success("Surveillance log updated");
      setIsEditDialogOpen(false);
      setEditingLog(null);
      resetForm();
      refetch();
    } catch (error: any) {
      console.error("Error updating log:", error);
      toast.error(error.message || "Failed to update log");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteLog = async (id: string) => {
    try {
      await apiDelete(`/surveillance/logs/${id}`);
      toast.success("Surveillance log deleted");
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete log");
    }
  };

  const openEditDialog = (log: any) => {
    setEditingLog(log);
    setFormData({
      event_type: log.event_type,
      subject: log.subject || "",
      location: log.location || "",
      event_description: log.event_description || "",
    });
    setIsEditDialogOpen(true);
  };

  const LogForm = ({ onSubmit, isEdit = false }: { onSubmit: (e: React.FormEvent) => void; isEdit?: boolean }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="event_type">Event Type *</Label>
        <Select
          value={formData.event_type}
          onValueChange={(value) => setFormData({ ...formData, event_type: value })}
        >
          <SelectTrigger className="bg-background/50">
            <SelectValue placeholder="Select event type" />
          </SelectTrigger>
          <SelectContent>
            {eventTypeOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            placeholder="Person, vehicle, etc."
            className="bg-background/50"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            placeholder="Camera ID or location"
            className="bg-background/50"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="event_description">Description</Label>
        <Textarea
          id="event_description"
          value={formData.event_description}
          onChange={(e) => setFormData({ ...formData, event_description: e.target.value })}
          placeholder="Detailed description of the surveillance event..."
          rows={4}
          className="bg-background/50"
        />
      </div>
      <Button type="submit" className="w-full" disabled={creating}>
        {creating ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {isEdit ? "Updating..." : "Creating..."}
          </>
        ) : (
          <>
            <Plus className="w-4 h-4 mr-2" />
            {isEdit ? "Update Event" : "Log Event"}
          </>
        )}
      </Button>
    </form>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Surveillance Network</h1>
          <p className="text-sm text-muted-foreground">Real-time CCTV feeds and monitoring stations</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="bg-success/20 text-success">
            <span className="w-2 h-2 bg-success rounded-full mr-2 animate-pulse" />
            {cameras.filter(c => c.status === 'active').length} Active
          </Badge>
          {isAdmin && (
            <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
              setIsCreateDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-primary hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Log Event
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] p-0 bg-card border-primary/20 overflow-hidden">
                <DialogHeader className="px-4 pt-4 sm:px-6 sm:pt-6 pb-2">
                  <DialogTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5 text-primary" />
                    Log Surveillance Event
                  </DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[calc(90vh-120px)] px-4 pb-4 sm:px-6 sm:pb-6">
                  <LogForm onSubmit={handleCreateLog} />
                </ScrollArea>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) {
          setEditingLog(null);
          resetForm();
        }
      }}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] p-0 bg-card border-primary/20 overflow-hidden">
          <DialogHeader className="px-4 pt-4 sm:px-6 sm:pt-6 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-primary" />
              Edit Surveillance Event
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(90vh-120px)] px-4 pb-4 sm:px-6 sm:pb-6">
            <LogForm onSubmit={handleUpdateLog} isEdit />
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-panel-border pb-2">
        <Button
          variant={activeTab === "cameras" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("cameras")}
        >
          <Camera className="w-4 h-4 mr-2" />
          Live Cameras
        </Button>
        <Button
          variant={activeTab === "logs" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("logs")}
        >
          <Eye className="w-4 h-4 mr-2" />
          Event Logs ({logs.length})
        </Button>
        <Button
          variant={activeTab === "face_recognition" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("face_recognition")}
        >
          <ScanFace className="w-4 h-4 mr-2" />
          Face Recognition
        </Button>
      </div>

      {activeTab === "face_recognition" ? (
        <CriminalFaceHUD />
      ) : activeTab === "cameras" ? (
        /* Camera Grid */
        streamsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : cameras.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Camera className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No surveillance streams available</p>
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cameras.map((camera) => (
            <div key={camera.id} className="bg-card border border-panel-border rounded-lg overflow-hidden group">
              {/* Video Feed Placeholder */}
              <div className="aspect-video bg-muted relative flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <Video className="w-12 h-12 text-muted-foreground/50" />
                
                {/* Status Indicator */}
                <div className="absolute top-3 right-3">
                  <Badge className={statusColors[camera.status as keyof typeof statusColors] || statusColors.inactive}>
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
                  {camera.lastSeen ? formatDistanceToNow(new Date(camera.lastSeen), { addSuffix: true }) : "No heartbeat"}
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
        )
      ) : (
        /* Event Logs */
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Eye className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No surveillance logs found</p>
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="bg-card border border-panel-border rounded-lg p-4 hover:border-primary/30 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <Badge variant="outline" className="text-primary border-primary/30">
                        {log.event_type.replace(/_/g, ' ')}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-mono">
                        {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                    {log.subject && (
                      <p className="text-sm font-medium text-foreground mb-1">Subject: {log.subject}</p>
                    )}
                    {log.location && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {log.location}
                      </p>
                    )}
                    {log.event_description && (
                      <p className="text-sm text-muted-foreground/80 mt-2">{log.event_description}</p>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(log)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Surveillance Log</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this surveillance log? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => handleDeleteLog(log.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

