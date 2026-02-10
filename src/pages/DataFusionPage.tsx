import { useEffect, useMemo, useRef, useState } from "react";
import { useAgencies } from "@/hooks/useAgencies";
import { useBackendEvents } from "@/hooks/useBackendEvents";
import { useAuth } from "@/contexts/AuthContext";
import { apiDelete, apiPost, apiPostForm } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import Papa from "papaparse";
import { Database, Upload, Download, RefreshCw, Server, HardDrive, Activity, Clock, Plus, Edit, Trash2, Loader2, Building, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
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

type ImportSummary = {
  filename: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  inserted: number;
};

type DataSourceRow = {
  name: string;
  status: "synced" | "syncing" | "offline";
  records: string;
  lastSync: string;
  health: number;
};

const dataStatusColors = {
  synced: "bg-success/20 text-success border-success/30",
  syncing: "bg-warning/20 text-warning border-warning/30",
  offline: "bg-destructive/20 text-destructive border-destructive/30",
};

export default function DataFusionPage() {
  const { agencies, loading, refetch } = useAgencies();
  const { events, loading: eventsLoading, error: eventsError, refetch: refetchEvents } = useBackendEvents();
  const { isAdmin } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingAgency, setEditingAgency] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

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

  // ── Agency CRUD via Supabase ──

  const handleCreateAgency = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = agencySchema.safeParse(formData);
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }
    setCreating(true);
    try {
      const { error } = await supabase.from("connected_agencies").insert({
        name: formData.name,
        code: formData.code.toUpperCase(),
        description: formData.description || null,
        status: formData.status as any,
        contact_person: formData.contact_person || null,
        contact_email: formData.contact_email || null,
        contact_phone: formData.contact_phone || null,
      });
      if (error) throw error;
      toast.success("Agency created successfully");
      setIsCreateDialogOpen(false);
      resetForm();
      refetch();
    } catch (error: any) {
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
      const { error } = await supabase
        .from("connected_agencies")
        .update({
          name: formData.name,
          code: formData.code.toUpperCase(),
          description: formData.description || null,
          status: formData.status as any,
          contact_person: formData.contact_person || null,
          contact_email: formData.contact_email || null,
          contact_phone: formData.contact_phone || null,
        })
        .eq("id", editingAgency.id);
      if (error) throw error;
      toast.success("Agency updated successfully");
      setIsEditDialogOpen(false);
      setEditingAgency(null);
      resetForm();
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Failed to update agency");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteAgency = async (id: string) => {
    try {
      const { error } = await supabase.from("connected_agencies").delete().eq("id", id);
      if (error) throw error;
      toast.success("Agency deleted");
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete agency");
    }
  };

  const handleToggleAgencyConnection = async (agency: any) => {
    try {
      if (agency.status === "active") {
        await apiPost(`/agencies/${agency.id}/disconnect`, {});
        toast.success(`${agency.name} disconnected`);
      } else {
        const result = await apiPost<{
          pipeline?: { stages?: string[] };
        }>(`/agencies/${agency.id}/connect`, {
          source_system: `agency_connector_${String(agency.code || "unknown").toLowerCase()}`,
          dataset_version: "kenya-v1",
          run_training: true,
          run_prediction: true,
        });
        const stages = result?.pipeline?.stages || [];
        toast.success(
          stages.length
            ? `${agency.name} connected. Pipeline: ${stages.join(" -> ")}`
            : `${agency.name} connected`
        );

        // Bootstrap an initial dataset on connect to start real ingestion immediately.
        try {
          const response = await fetch("/data/crime/2025-11-kenya-simulated-street.csv", { cache: "no-store" });
          if (!response.ok) throw new Error(`Failed to load bootstrap CSV (${response.status})`);
          const blob = await response.blob();
          const file = new File([blob], `${String(agency.code || "agency").toLowerCase()}-bootstrap.csv`, {
            type: "text/csv",
          });

          const formData = new FormData();
          formData.append("csv_file", file);
          formData.append("source_system", `agency_feed_${String(agency.code || "unknown").toLowerCase()}`);
          formData.append("source_agency", agency.name);

          const ingest = await apiPostForm<{
            inserted: number;
            total_rows: number;
            invalid_rows: number;
          }>("/ingest/crime-csv", formData);
          toast.success(
            `${agency.name} feed ingested: ${Number(ingest?.inserted || 0).toLocaleString()} records`
          );
        } catch (bootstrapError: any) {
          toast.error(
            bootstrapError?.message ||
              `Connected ${agency.name}, but bootstrap ingest failed. You can import manually from Data Fusion.`
          );
        }
      }
      await Promise.all([refetch(), refetchEvents(), fetchCrimeCount()]);
    } catch (error: any) {
      toast.error(error.message || "Failed to change agency connection");
    }
  };

  const openEditDialog = (agency: any) => {
    setEditingAgency(agency);
    setFormData({
      name: agency.name,
      code: agency.code,
      description: agency.description || "",
      status: agency.status || "pending",
      contact_person: agency.contact_person || "",
      contact_email: agency.contact_email || "",
      contact_phone: agency.contact_phone || "",
    });
    setIsEditDialogOpen(true);
  };

  const activeAgencies = agencies.filter(a => a.status === 'active').length;

  // ── Crime events count ──
  const [crimeCount, setCrimeCount] = useState(0);
  const fetchCrimeCount = async () => {
    const { count } = await supabase
      .from("crime_events")
      .select("*", { count: "exact", head: true });
    setCrimeCount(count || 0);
  };
  useEffect(() => {
    fetchCrimeCount();
  }, []);

  const totalRecords = crimeCount ? crimeCount.toLocaleString() : "0";

  const dataSources = useMemo<DataSourceRow[]>(() => {
    const lastBackendEvent = events[0];
    const backendHealthy = !eventsError;

    return [
      {
        name: "Crime Events Database",
        status: crimeCount > 0 ? "synced" : "offline",
        records: crimeCount.toLocaleString(),
        lastSync: importing ? "syncing now..." : crimeCount > 0 ? "live" : "never",
        health: crimeCount > 0 ? 96 : 0,
      },
      {
        name: "Ingestion Events",
        status: backendHealthy && events.length > 0 ? "synced" : "offline",
        records: events.length.toString(),
        lastSync: lastBackendEvent
          ? formatDistanceToNow(new Date(lastBackendEvent.created_at), { addSuffix: true })
          : "no events",
        health: backendHealthy && events.length > 0 ? 95 : 0,
      },
      {
        name: "Connected Agencies Directory",
        status: agencies.length ? "synced" : "offline",
        records: agencies.length.toString(),
        lastSync: agencies[0]
          ? formatDistanceToNow(new Date(agencies[0].updated_at), { addSuffix: true })
          : "never",
        health: agencies.length ? Math.min(100, 40 + activeAgencies * 10) : 0,
      },
    ];
  }, [events, eventsError, crimeCount, importing, agencies, activeAgencies]);

  const latestAgencyPipeline = useMemo(() => {
    const pipelineByAgency = new Map<string, string[]>();
    for (const event of events) {
      const agencyName = event.provenance?.source_agency || "";
      if (!agencyName || pipelineByAgency.has(agencyName)) continue;
      if (!Array.isArray(event.provenance?.transformations)) continue;
      pipelineByAgency.set(agencyName, event.provenance.transformations);
    }
    return pipelineByAgency;
  }, [events]);

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      await Promise.all([refetch(), refetchEvents(), fetchCrimeCount()]);
      toast.success("Data fusion sync completed");
    } catch (error: any) {
      toast.error(error.message || "Failed to sync data sources");
    } finally {
      setSyncing(false);
    }
  };

  // ── CSV Import (client-side parsing → Supabase upsert) ──

  const handleImportButton = () => {
    fileInputRef.current?.click();
  };

  const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please select a CSV file");
      e.target.value = "";
      return;
    }

    setImporting(true);
    setImportProgress(10);

    try {
      const formData = new FormData();
      formData.append("csv_file", file);
      formData.append("source_system", "data_fusion_upload");
      formData.append("source_agency", "Data Fusion Hub");
      setImportProgress(35);

      const result = await apiPostForm<{
        filename: string;
        total_rows: number;
        valid_rows: number;
        invalid_rows: number;
        inserted: number;
      }>("/ingest/crime-csv", formData);
      setImportProgress(100);
      setImportSummary({
        filename: result.filename || file.name,
        total_rows: Number(result.total_rows || 0),
        valid_rows: Number(result.valid_rows || 0),
        invalid_rows: Number(result.invalid_rows || 0),
        inserted: Number(result.inserted || 0),
      });
      await Promise.all([refetchEvents(), fetchCrimeCount()]);
      toast.success(`Imported ${Number(result.inserted || 0).toLocaleString()} records from ${file.name}`);
    } catch (error: any) {
      toast.error(error.message || "CSV import failed");
    } finally {
      setImporting(false);
      setTimeout(() => setImportProgress(0), 700);
      e.target.value = "";
    }
  };

  const handleDeleteIngestionEvent = async (eventId: string) => {
    try {
      await apiDelete(`/events/${eventId}`);
      toast.success("Ingestion event deleted");
      refetchEvents();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete ingestion event");
    }
  };

  const handleDeleteAllCrimeData = async () => {
    try {
      const { error: crimeDeleteError } = await supabase
        .from("crime_events")
        .delete()
        .gte("created_at", "1970-01-01T00:00:00Z");
      if (crimeDeleteError) throw crimeDeleteError;

      const { error: eventsDeleteError } = await supabase
        .from("ingestion_events")
        .delete()
        .in("event_type", ["csv_import", "crime_csv_import"]);
      if (eventsDeleteError) throw eventsDeleteError;

      await Promise.all([fetchCrimeCount(), refetchEvents()]);
      toast.success("All imported crime data deleted");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete imported crime data");
    }
  };

  // ── CSV Export (query Supabase → generate CSV client-side) ──

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase
        .from("crime_events")
        .select("crime_id,crime_type,month,location,latitude,longitude,reported_by,falls_within,lsoa_code,lsoa_name,last_outcome_category,context")
        .limit(10000);

      if (error) throw error;

      const csv = Papa.unparse(data || []);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      a.href = url;
      a.download = `farsi-crime-events-${ts}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Crime events CSV exported");
    } catch (error: any) {
      toast.error(error.message || "CSV export failed");
    } finally {
      setExporting(false);
    }
  };

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
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleImportCsv}
          />
          <Button variant="outline" size="sm" onClick={handleImportButton} disabled={importing}>
            {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            {importing ? "Importing..." : "Import CSV"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={exporting}>
            {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            {exporting ? "Exporting..." : "Export CSV"}
          </Button>
          <Button size="sm" onClick={handleSyncAll} disabled={syncing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync All"}
          </Button>
          {isAdmin && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="destructive">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Imported Data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Delete Imported Crime Data
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will delete all rows in crime events and CSV import ingestion logs. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDeleteAllCrimeData}>
                    Delete Data
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {importing && (
        <div className="bg-card border border-panel-border rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Importing CSV into crime_events</span>
            <span className="font-medium">{importProgress}%</span>
          </div>
          <Progress value={importProgress} className="h-2" />
        </div>
      )}

      {importSummary && !importing && (
        <div className="bg-card border border-panel-border rounded-lg p-3 text-sm flex flex-wrap gap-4">
          <span>
            <span className="text-muted-foreground">Last import file:</span> {importSummary.filename}
          </span>
          <span>
            <span className="text-muted-foreground">Inserted:</span> {importSummary.inserted.toLocaleString()}
          </span>
          <span>
            <span className="text-muted-foreground">Invalid rows:</span> {importSummary.invalid_rows.toLocaleString()}
          </span>
        </div>
      )}

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
              <p className="text-xl sm:text-2xl font-bold">{activeAgencies}/{agencies.length}</p>
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
              <p className="text-xl sm:text-2xl font-bold">{Math.round(dataSources.reduce((acc, s) => acc + s.health, 0) / Math.max(1, dataSources.length))}%</p>
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
              <p className="text-xl sm:text-2xl font-bold">{events.length}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Ingestion Events</p>
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
                    <Badge className={statusColors[(agency.status as keyof typeof statusColors) || "pending"]}>
                      {agency.status || "pending"}
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
                  {latestAgencyPipeline.get(agency.name)?.length ? (
                    <div className="text-xs text-muted-foreground mt-1">
                      Pipeline: {latestAgencyPipeline.get(agency.name)!.join(" -> ")}
                    </div>
                  ) : null}
                </div>
                {isAdmin && (
                  <div className="flex gap-2 shrink-0 flex-wrap">
                    <Button
                      variant={agency.status === "active" ? "outline" : "default"}
                      size="sm"
                      onClick={() => handleToggleAgencyConnection(agency)}
                    >
                      {agency.status === "active" ? "Disconnect" : "Connect"}
                    </Button>
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
                  <Badge className={dataStatusColors[source.status]}>
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
              <Button variant="ghost" size="sm" className="shrink-0" onClick={handleSyncAll} disabled={syncing}>
                <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Ingestion Events */}
      <div className="bg-card border border-panel-border rounded-lg">
        <div className="p-4 border-b border-panel-border flex items-center justify-between">
          <h2 className="font-semibold">Recent Ingestion Events</h2>
          <Badge variant="outline" className="text-xs">Live</Badge>
        </div>
        {eventsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : eventsError ? (
          <div className="p-4 text-sm text-muted-foreground">
            Error loading events: {eventsError}
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
                <div className="flex items-center gap-2">
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                  </div>
                  {isAdmin && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteIngestionEvent(event.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

