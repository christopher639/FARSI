import { useState } from "react";
import { useThreatAlerts } from "@/hooks/useThreatAlerts";
import { useAuth } from "@/contexts/AuthContext";
import { apiPost, apiPut, apiDelete, apiPatch } from "@/lib/api";
import { Bell, Filter, Download, CheckCircle, AlertTriangle, XCircle, Plus, Loader2, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

const alertSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  description: z.string().max(1000).optional(),
  location: z.string().max(200).optional(),
  severity: z.enum(["critical", "high", "medium", "low", "info"]),
  source: z.string().max(200).optional(),
});

type AlertSeverity = "critical" | "high" | "medium" | "low" | "info";
type AlertStatus = "new" | "investigating" | "resolved" | "dismissed";

const severityColors: Record<AlertSeverity, string> = {
  critical: "bg-destructive/20 text-destructive border-destructive/30",
  high: "bg-warning/20 text-warning border-warning/30",
  medium: "bg-primary/20 text-primary border-primary/30",
  low: "bg-muted text-muted-foreground",
  info: "bg-success/20 text-success border-success/30",
};

const statusColors: Record<AlertStatus, string> = {
  new: "bg-primary/20 text-primary",
  investigating: "bg-warning/20 text-warning",
  resolved: "bg-success/20 text-success",
  dismissed: "bg-muted text-muted-foreground",
};

export default function AlertsPage() {
  const { alerts, loading, refetch } = useThreatAlerts();
  const { user, isAdmin, isAnalyst } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingAlert, setEditingAlert] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");

  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    location: string;
    severity: AlertSeverity;
    source: string;
  }>({
    title: "",
    description: "",
    location: "",
    severity: "medium",
    source: "",
  });

  const canCreate = isAdmin || isAnalyst;
  const canEdit = isAdmin || isAnalyst;

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      location: "",
      severity: "medium",
      source: "",
    });
  };

  const alertStats = [
    { label: "Critical", count: alerts.filter(a => a.severity === 'critical').length, icon: XCircle, color: "text-destructive" },
    { label: "High", count: alerts.filter(a => a.severity === 'high').length, icon: AlertTriangle, color: "text-warning" },
    { label: "Resolved", count: alerts.filter(a => a.status === 'resolved').length, icon: CheckCircle, color: "text-success" },
  ];

  const filteredAlerts = alerts.filter(alert => {
    const matchesSearch = alert.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (alert.location?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesSeverity = filterSeverity === "all" || alert.severity === filterSeverity;
    return matchesSearch && matchesSeverity;
  });

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = alertSchema.safeParse(formData);
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    if (!user) {
      toast.error("You must be logged in to create alerts");
      return;
    }

    setCreating(true);
    try {
      await apiPost("/alerts", {
        title: formData.title,
        description: formData.description || null,
        location: formData.location || null,
        severity: formData.severity,
        source: formData.source || null,
        status: "new",
      });

      toast.success("Alert created successfully");
      setIsCreateDialogOpen(false);
      resetForm();
      refetch();
    } catch (error: any) {
      console.error("Error creating alert:", error);
      toast.error(error.message || "Failed to create alert");
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAlert) return;
    
    const validation = alertSchema.safeParse(formData);
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setCreating(true);
    try {
      await apiPut(`/alerts/${editingAlert.id}`, {
        title: formData.title,
        description: formData.description || null,
        location: formData.location || null,
        severity: formData.severity,
        source: formData.source || null,
        status: editingAlert.status,
      });

      toast.success("Alert updated successfully");
      setIsEditDialogOpen(false);
      setEditingAlert(null);
      resetForm();
      refetch();
    } catch (error: any) {
      console.error("Error updating alert:", error);
      toast.error(error.message || "Failed to update alert");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteAlert = async (id: string) => {
    try {
      await apiDelete(`/alerts/${id}`);
      toast.success("Alert deleted");
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete alert");
    }
  };

  const handleUpdateStatus = async (alertId: string, newStatus: string) => {
    try {
      await apiPatch(`/alerts/${alertId}/status`, { status: newStatus });
      toast.success(`Alert marked as ${newStatus}`);
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Failed to update alert");
    }
  };

  const openEditDialog = (alert: any) => {
    setEditingAlert(alert);
    setFormData({
      title: alert.title,
      description: alert.description || "",
      location: alert.location || "",
      severity: alert.severity,
      source: alert.source || "",
    });
    setIsEditDialogOpen(true);
  };

  const AlertForm = ({ onSubmit, isEdit = false }: { onSubmit: (e: React.FormEvent) => void; isEdit?: boolean }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Alert Title *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Brief description of the threat"
          required
          className="bg-background/50"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Detailed information about the threat..."
          rows={3}
          className="bg-background/50"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            placeholder="Nairobi CBD"
            className="bg-background/50"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="severity">Severity *</Label>
          <Select
            value={formData.severity}
            onValueChange={(value: AlertSeverity) => setFormData({ ...formData, severity: value })}
          >
            <SelectTrigger className="bg-background/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="source">Source</Label>
        <Input
          id="source"
          value={formData.source}
          onChange={(e) => setFormData({ ...formData, source: e.target.value })}
          placeholder="Intelligence source or reporting agency"
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
            {isEdit ? "Update Alert" : "Create Alert"}
          </>
        )}
      </Button>
    </form>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Security Alerts</h1>
          <p className="text-sm text-muted-foreground">Real-time threat notifications and incident tracking</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          {canCreate && (
            <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
              setIsCreateDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-primary hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-2" />
                  New Alert
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] p-0 bg-card border-primary/20 overflow-hidden">
                <DialogHeader className="px-4 pt-4 sm:px-6 sm:pt-6 pb-2">
                  <DialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                    Create Threat Alert
                  </DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[calc(90vh-120px)] px-4 pb-4 sm:px-6 sm:pb-6">
                  <AlertForm onSubmit={handleCreateAlert} />
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
          setEditingAlert(null);
          resetForm();
        }
      }}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] p-0 bg-card border-primary/20 overflow-hidden">
          <DialogHeader className="px-4 pt-4 sm:px-6 sm:pt-6 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-primary" />
              Edit Alert
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(90vh-120px)] px-4 pb-4 sm:px-6 sm:pb-6">
            <AlertForm onSubmit={handleUpdateAlert} isEdit />
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Alert Stats */}
      <div className="grid grid-cols-3 gap-4">
        {alertStats.map((stat) => (
          <div key={stat.label} className="bg-card border border-panel-border rounded-lg p-4 flex items-center gap-4">
            <div className={`p-3 rounded-lg bg-muted ${stat.color}`}>
              <stat.icon className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold">{stat.count}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Input
            placeholder="Search alerts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-background/50"
          />
        </div>
        <Select value={filterSeverity} onValueChange={setFilterSeverity}>
          <SelectTrigger className="w-[180px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filter by severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No alerts found</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className="bg-card border border-panel-border rounded-lg p-4 hover:border-primary/30 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Badge className={severityColors[alert.severity as AlertSeverity]}>
                      {alert.severity}
                    </Badge>
                    <Badge className={statusColors[alert.status as AlertStatus]}>
                      {alert.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">
                      {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">{alert.title}</h3>
                  {alert.location && (
                    <p className="text-sm text-muted-foreground mb-1">📍 {alert.location}</p>
                  )}
                  {alert.description && (
                    <p className="text-sm text-muted-foreground/80 line-clamp-2">{alert.description}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  {canEdit && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(alert)}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      {alert.status === "new" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateStatus(alert.id, "investigating")}
                        >
                          Investigate
                        </Button>
                      )}
                      {alert.status !== "resolved" && alert.status !== "dismissed" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-success"
                          onClick={() => handleUpdateStatus(alert.id, "resolved")}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Resolve
                        </Button>
                      )}
                    </>
                  )}
                  {isAdmin && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Alert</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this alert? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => handleDeleteAlert(alert.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
