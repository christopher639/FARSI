import { useState } from "react";
import { useAgencies } from "@/hooks/useAgencies";
import { useBackendEvents } from "@/hooks/useBackendEvents";
import { useAuth } from "@/contexts/AuthContext";
import { apiPost, apiPut, apiDelete } from "@/lib/api";
import { Database, Upload, Download, RefreshCw, Server, HardDrive, Activity, Clock, Plus, Edit, Trash2, Loader2, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { z } from "zod";

const agencySchema = z.object({
  name: z.string().min(2, "Name is required").max(200),
  code: z.string().min(2, "Code is required").max(20),
  description: z.string().max(500).optional(),
  status: z.enum(["active", "inactive", "pending"]),
  contact_person: z.string().max(100).optional(),
  contact_email: z.string().email("Invalid email").optional().or(z.literal("")),
  contact_phone: z.string().max(20).optional(),
});

const statusColors = {
  active: "bg-success/20 text-success border-success/30",
  inactive: "bg-muted text-muted-foreground",
  pending: "bg-warning/20 text-warning border-warning/30",
};

// Static data sources for UI (these would be separate system in production)
const dataSources = [
  { name: "NPS Crime Database", status: "synced", records: "2.4M", lastSync: "2 min ago", health: 98 },
  { name: "NIS Intelligence Feed", status: "syncing", records: "890K", lastSync: "syncing...", health: 95 },
  { name: "Border Control System", status: "synced", records: "1.2M", lastSync: "5 min ago", health: 100 },
  { name: "CCTV Analytics", status: "synced", records: "45K", lastSync: "1 min ago", health: 92 },
  { name: "Financial Intelligence", status: "synced", records: "320K", lastSync: "10 min ago", health: 88 },
  { name: "Vehicle Registry", status: "offline", records: "5.1M", lastSync: "2 hours ago", health: 0 },
];

const dataStatusColors = {
  synced: "bg-success/20 text-success border-success/30",
  syncing: "bg-warning/20 text-warning border-warning/30",
  offline: "bg-destructive/20 text-destructive border-destructive/30",
};

export default function DataFusionPage() {
  const { agencies, loading, refetch } = useAgencies();
  const { events, loading: eventsLoading, error: eventsError } = useBackendEvents();
  const { isAdmin } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingAgency, setEditingAgency] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    status: "pending" as const,
    contact_person: "",
    contact_email: "",
    contact_phone: "",
  });

  const resetForm = () => {
    setFormData({
      name: "",
      code: "",
      description: "",
      status: "pending",
      contact_person: "",
      contact_email: "",
      contact_phone: "",
    });
  };

  const handleCreateAgency = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = agencySchema.safeParse(formData);
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setCreating(true);
    try {
      await apiPost("/agencies", {
        name: formData.name,
        code: formData.code.toUpperCase(),
        description: formData.description || null,
        status: formData.status,
        contact_person: formData.contact_person || null,
        contact_email: formData.contact_email || null,
        contact_phone: formData.contact_phone || null,
      });

      toast.success("Agency created successfully");
      setIsCreateDialogOpen(false);
      resetForm();
      refetch();
    } catch (error: any) {
      console.error("Error creating agency:", error);
      toast.error(error.message || "Failed to create agency");
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateAgency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAgency) return;
    
    const validation = agencySchema.safeParse(formData);
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setCreating(true);
    try {
      await apiPut(`/agencies/${editingAgency.id}`, {
        name: formData.name,
        code: formData.code.toUpperCase(),
        description: formData.description || null,
        status: formData.status,
        contact_person: formData.contact_person || null,
        contact_email: formData.contact_email || null,
        contact_phone: formData.contact_phone || null,
      });

      toast.success("Agency updated successfully");
      setIsEditDialogOpen(false);
      setEditingAgency(null);
      resetForm();
      refetch();
    } catch (error: any) {
      console.error("Error updating agency:", error);
      toast.error(error.message || "Failed to update agency");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteAgency = async (id: string) => {
    try {
      await apiDelete(`/agencies/${id}`);
      toast.success("Agency deleted");
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete agency");
    }
  };

  const openEditDialog = (agency: any) => {
    setEditingAgency(agency);
    setFormData({
      name: agency.name,
      code: agency.code,
      description: agency.description || "",
      status: agency.status,
      contact_person: agency.contact_person || "",
      contact_email: agency.contact_email || "",
      contact_phone: agency.contact_phone || "",
    });
    setIsEditDialogOpen(true);
  };

  const activeAgencies = agencies.filter(a => a.status === 'active').length;
  const totalRecords = "9.95M"; // Static for demo

  const AgencyForm = ({ onSubmit, isEdit = false }: { onSubmit: (e: React.FormEvent) => void; isEdit?: boolean }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Agency Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="National Intelligence Service"
            className="bg-background/50"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="code">Agency Code *</Label>
          <Input
            id="code"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            placeholder="NIS"
            className="bg-background/50 uppercase"
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Agency description and scope..."
          rows={3}
          className="bg-background/50"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <Select
          value={formData.status}
          onValueChange={(value: any) => setFormData({ ...formData, status: value })}
        >
          <SelectTrigger className="bg-background/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="contact_person">Contact Person</Label>
          <Input
            id="contact_person"
            value={formData.contact_person}
            onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
            placeholder="John Doe"
            className="bg-background/50"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact_phone">Contact Phone</Label>
          <Input
            id="contact_phone"
            value={formData.contact_phone}
            onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
            placeholder="+254 700 000 000"
            className="bg-background/50"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="contact_email">Contact Email</Label>
        <Input
          id="contact_email"
          type="email"
          value={formData.contact_email}
          onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
          placeholder="contact@agency.go.ke"
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
            {isEdit ? "Update Agency" : "Create Agency"}
          </>
        )}
      </Button>
    </form>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Data Fusion Hub</h1>
          <p className="text-sm text-muted-foreground">Centralized multi-agency data integration platform</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm">
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Sync All
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-panel-border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20">
              <Database className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold">{totalRecords}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Total Records</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-panel-border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/20">
              <Server className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold">{activeAgencies}/{agencies.length || 6}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Agencies Online</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-panel-border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/20">
              <Activity className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold">94.5%</p>
              <p className="text-xs sm:text-sm text-muted-foreground">System Health</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-panel-border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <HardDrive className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold">2.4 TB</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Data Storage</p>
            </div>
          </div>
        </div>
      </div>

      {/* Connected Agencies */}
      <div className="bg-card border border-panel-border rounded-lg">
        <div className="p-4 border-b border-panel-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="font-semibold flex items-center gap-2">
            <Building className="w-4 h-4 text-primary" />
            Connected Agencies
          </h2>
          {isAdmin && (
            <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
              setIsCreateDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-primary hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Agency
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] p-0 bg-card border-primary/20 overflow-hidden">
                <DialogHeader className="px-4 pt-4 sm:px-6 sm:pt-6 pb-2">
                  <DialogTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5 text-primary" />
                    Add Connected Agency
                  </DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[calc(90vh-120px)] px-4 pb-4 sm:px-6 sm:pb-6">
                  <AgencyForm onSubmit={handleCreateAgency} />
                </ScrollArea>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : agencies.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Building className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No connected agencies</p>
          </div>
        ) : (
          <div className="divide-y divide-panel-border">
            {agencies.map((agency) => (
              <div key={agency.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="p-2 rounded-lg bg-muted shrink-0">
                  <Building className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3 mb-1">
                    <span className="font-medium">{agency.name}</span>
                    <Badge variant="outline" className="font-mono text-xs">{agency.code}</Badge>
                    <Badge className={statusColors[agency.status as keyof typeof statusColors]}>
                      {agency.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    {agency.contact_person && <span>{agency.contact_person}</span>}
                    {agency.contact_email && <span>{agency.contact_email}</span>}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(agency.updated_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditDialog(agency)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDeleteAgency(agency.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) {
          setEditingAgency(null);
          resetForm();
        }
      }}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] p-0 bg-card border-primary/20 overflow-hidden">
          <DialogHeader className="px-4 pt-4 sm:px-6 sm:pt-6 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Building className="h-5 w-5 text-primary" />
              Edit Agency
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(90vh-120px)] px-4 pb-4 sm:px-6 sm:pb-6">
            <AgencyForm onSubmit={handleUpdateAgency} isEdit />
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Data Sources */}
      <div className="bg-card border border-panel-border rounded-lg">
        <div className="p-4 border-b border-panel-border">
          <h2 className="font-semibold">Data Sources</h2>
        </div>
        <div className="divide-y divide-panel-border">
          {dataSources.map((source) => (
            <div key={source.name} className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="p-2 rounded-lg bg-muted shrink-0">
                <Database className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-1">
                  <span className="font-medium">{source.name}</span>
                  <Badge className={dataStatusColors[source.status as keyof typeof dataStatusColors]}>
                    {source.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span>{source.records} records</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {source.lastSync}
                  </span>
                </div>
              </div>
              <div className="w-full sm:w-32">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span>Health</span>
                  <span>{source.health}%</span>
                </div>
                <Progress value={source.health} className="h-2" />
              </div>
              <Button variant="ghost" size="sm" className="shrink-0">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Backend Ingestion Events */}
      <div className="bg-card border border-panel-border rounded-lg">
        <div className="p-4 border-b border-panel-border flex items-center justify-between">
          <h2 className="font-semibold">Recent Ingestion Events (Backend)</h2>
          <Badge variant="outline" className="text-xs">Supabase</Badge>
        </div>
        {eventsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : eventsError ? (
          <div className="p-4 text-sm text-muted-foreground">
            Backend unavailable: {eventsError}
          </div>
        ) : events.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            No ingestion events found yet.
          </div>
        ) : (
          <div className="divide-y divide-panel-border">
            {events.map((event) => (
              <div key={event.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-medium">{event.title}</span>
                    <Badge variant="outline" className="text-xs">{event.event_type}</Badge>
                    <Badge className="text-xs bg-muted">{event.modality}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground line-clamp-2">
                    {event.description || "No description"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    Source: {event.provenance.source_system}
                    {event.provenance.source_agency ? ` • ${event.provenance.source_agency}` : ""}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
