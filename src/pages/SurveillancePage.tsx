import { useState } from "react";
import { useSurveillanceLogs } from "@/hooks/useSurveillanceLogs";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Eye, Video, Camera, MapPin, Clock, Plus, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { z } from "zod";

const surveillanceSchema = z.object({
  event_type: z.string().min(2, "Event type is required").max(100),
  subject: z.string().max(200).optional(),
  location: z.string().max(200).optional(),
  event_description: z.string().max(2000).optional(),
});

// Static camera data for the UI
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
  const { logs, loading, refetch } = useSurveillanceLogs();
  const { user, isAdmin } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<"cameras" | "logs">("cameras");

  const [formData, setFormData] = useState({
    event_type: "",
    subject: "",
    location: "",
    event_description: "",
  });

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
      const { error } = await supabase.from("surveillance_logs").insert({
        event_type: formData.event_type,
        subject: formData.subject || null,
        location: formData.location || null,
        event_description: formData.event_description || null,
        recorded_by: user.id,
      });

      if (error) throw error;

      toast.success("Surveillance log created");
      setIsCreateDialogOpen(false);
      setFormData({
        event_type: "",
        subject: "",
        location: "",
        event_description: "",
      });
      refetch();
    } catch (error: any) {
      console.error("Error creating log:", error);
      toast.error(error.message || "Failed to create log");
    } finally {
      setCreating(false);
    }
  };

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
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-primary hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Log Event
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] p-0 bg-card border-primary/20 overflow-hidden">
                <DialogHeader className="px-4 pt-4 sm:px-6 sm:pt-6 pb-2">
                  <DialogTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5 text-primary" />
                    Log Surveillance Event
                  </DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[calc(90vh-120px)] px-4 pb-4 sm:px-6 sm:pb-6">
                  <form onSubmit={handleCreateLog} className="space-y-4">
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
                          <SelectItem value="motion_detected">Motion Detected</SelectItem>
                          <SelectItem value="facial_recognition">Facial Recognition</SelectItem>
                          <SelectItem value="vehicle_identified">Vehicle Identified</SelectItem>
                          <SelectItem value="perimeter_breach">Perimeter Breach</SelectItem>
                          <SelectItem value="suspicious_activity">Suspicious Activity</SelectItem>
                          <SelectItem value="crowd_gathering">Crowd Gathering</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
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
                          Creating...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          Log Event
                        </>
                      )}
                    </Button>
                  </form>
                </ScrollArea>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

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
      </div>

      {activeTab === "cameras" ? (
        /* Camera Grid */
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
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
