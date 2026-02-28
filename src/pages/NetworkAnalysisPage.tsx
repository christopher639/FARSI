import { useState, useMemo } from "react";
import { useNetworkData } from "@/hooks/useNetworkData";
import { useAuth } from "@/contexts/AuthContext";
import { apiPost, apiDelete } from "@/lib/api";
import { NetworkGraph } from "@/components/dashboard/NetworkGraph";
import { Search, Filter, ZoomIn, ZoomOut, Maximize2, Plus, AlertTriangle, Activity, Server, Globe, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { z } from "zod";

const networkSchema = z.object({
  source_ip: z.string().min(1, "Source IP is required"),
  destination_ip: z.string().optional(),
  protocol: z.string().min(1, "Protocol is required"),
  port: z.coerce.number().min(1).max(65535).optional(),
  bytes_transferred: z.coerce.number().min(0).optional(),
  threat_detected: z.boolean(),
  threat_type: z.string().optional(),
  payload_summary: z.string().max(500).optional(),
});

export default function NetworkAnalysisPage() {
  const { networkData, loading, refetch, getStats } = useNetworkData();
  const { isAdmin } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [rebuildingGraph, setRebuildingGraph] = useState(false);
  const [graphVersion, setGraphVersion] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterThreat, setFilterThreat] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"graph" | "table">("graph");

  const [formData, setFormData] = useState({
    source_ip: "",
    destination_ip: "",
    protocol: "TCP",
    port: "",
    bytes_transferred: "",
    threat_detected: false,
    threat_type: "",
    payload_summary: "",
  });

  const stats = useMemo(() => getStats(), [getStats]);

  const filteredData = networkData.filter(data => {
    const matchesSearch = 
      data.source_ip?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      data.destination_ip?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      data.threat_type?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesThreat = filterThreat === "all" || 
      (filterThreat === "threats" && data.threat_detected) ||
      (filterThreat === "clean" && !data.threat_detected);
    return matchesSearch && matchesThreat;
  });

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = networkSchema.safeParse({
      ...formData,
      port: formData.port ? Number(formData.port) : undefined,
      bytes_transferred: formData.bytes_transferred ? Number(formData.bytes_transferred) : undefined,
    });
    
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setCreating(true);
    try {
      await apiPost("/network", {
        source_ip: formData.source_ip,
        destination_ip: formData.destination_ip || null,
        protocol: formData.protocol,
        port: formData.port ? Number(formData.port) : null,
        bytes_transferred: formData.bytes_transferred ? Number(formData.bytes_transferred) : null,
        threat_detected: formData.threat_detected,
        threat_type: formData.threat_detected ? formData.threat_type : null,
        payload_summary: formData.payload_summary || null,
      });

      toast.success("Network entry created successfully");
      setIsCreateDialogOpen(false);
      setFormData({
        source_ip: "",
        destination_ip: "",
        protocol: "TCP",
        port: "",
        bytes_transferred: "",
        threat_detected: false,
        threat_type: "",
        payload_summary: "",
      });
      refetch();
    } catch (error: any) {
      console.error("Error creating entry:", error);
      toast.error(error.message || "Failed to create entry");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      await apiDelete(`/network/${id}`);
      toast.success("Entry deleted");
      refetch();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete entry");
    }
  };

  const handleRebuildGraph = async () => {
    setRebuildingGraph(true);
    try {
      await apiPost("/graph/rebuild?clear_existing=true", {});
      toast.success("Entity graph rebuilt");
      setGraphVersion((v) => v + 1);
    } catch (error: any) {
      toast.error(error.message || "Failed to rebuild graph");
    } finally {
      setRebuildingGraph(false);
    }
  };

  const formatBytes = (bytes: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${(bytes / 1073741824).toFixed(2)} GB`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Network Analysis</h1>
          <p className="text-sm text-muted-foreground">Entity relationship mapping and threat network visualization</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={viewMode === "graph" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("graph")}
          >
            Graph
          </Button>
          <Button
            variant={viewMode === "table" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("table")}
          >
            Table
          </Button>
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={handleRebuildGraph} disabled={rebuildingGraph}>
              {rebuildingGraph ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Rebuilding
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Rebuild Graph
                </>
              )}
            </Button>
          )}
          {isAdmin && (
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-primary hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Entry
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] p-0 bg-card border-primary/20 overflow-hidden">
                <DialogHeader className="px-4 pt-4 sm:px-6 sm:pt-6 pb-2">
                  <DialogTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-primary" />
                    Add Network Entry
                  </DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[calc(90vh-120px)] px-4 pb-4 sm:px-6 sm:pb-6">
                  <form onSubmit={handleCreateEntry} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="source_ip">Source IP *</Label>
                        <Input
                          id="source_ip"
                          value={formData.source_ip}
                          onChange={(e) => setFormData({ ...formData, source_ip: e.target.value })}
                          placeholder="192.168.1.1"
                          className="bg-background/50 font-mono"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="destination_ip">Destination IP</Label>
                        <Input
                          id="destination_ip"
                          value={formData.destination_ip}
                          onChange={(e) => setFormData({ ...formData, destination_ip: e.target.value })}
                          placeholder="10.0.0.1"
                          className="bg-background/50 font-mono"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="protocol">Protocol *</Label>
                        <Select
                          value={formData.protocol}
                          onValueChange={(value) => setFormData({ ...formData, protocol: value })}
                        >
                          <SelectTrigger className="bg-background/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="TCP">TCP</SelectItem>
                            <SelectItem value="UDP">UDP</SelectItem>
                            <SelectItem value="HTTP">HTTP</SelectItem>
                            <SelectItem value="HTTPS">HTTPS</SelectItem>
                            <SelectItem value="SSH">SSH</SelectItem>
                            <SelectItem value="FTP">FTP</SelectItem>
                            <SelectItem value="DNS">DNS</SelectItem>
                            <SelectItem value="ICMP">ICMP</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="port">Port</Label>
                        <Input
                          id="port"
                          type="number"
                          value={formData.port}
                          onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                          placeholder="443"
                          className="bg-background/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="bytes">Bytes</Label>
                        <Input
                          id="bytes"
                          type="number"
                          value={formData.bytes_transferred}
                          onChange={(e) => setFormData({ ...formData, bytes_transferred: e.target.value })}
                          placeholder="1024"
                          className="bg-background/50"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
                      <div>
                        <Label htmlFor="threat_detected">Threat Detected</Label>
                        <p className="text-xs text-muted-foreground">Mark as potential security threat</p>
                      </div>
                      <Switch
                        id="threat_detected"
                        checked={formData.threat_detected}
                        onCheckedChange={(checked) => setFormData({ ...formData, threat_detected: checked })}
                      />
                    </div>
                    {formData.threat_detected && (
                      <div className="space-y-2">
                        <Label htmlFor="threat_type">Threat Type</Label>
                        <Select
                          value={formData.threat_type}
                          onValueChange={(value) => setFormData({ ...formData, threat_type: value })}
                        >
                          <SelectTrigger className="bg-background/50">
                            <SelectValue placeholder="Select threat type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="malware">Malware</SelectItem>
                            <SelectItem value="phishing">Phishing</SelectItem>
                            <SelectItem value="ddos">DDoS Attack</SelectItem>
                            <SelectItem value="intrusion">Intrusion Attempt</SelectItem>
                            <SelectItem value="data_exfiltration">Data Exfiltration</SelectItem>
                            <SelectItem value="suspicious">Suspicious Activity</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <Button type="submit" className="w-full" disabled={creating}>
                      {creating ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          Add Entry
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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-panel-border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold">{stats.totalConnections}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Connections</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-panel-border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/20">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold">{stats.threatCount}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Threats</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-panel-border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/20">
              <Server className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold">{stats.uniqueProtocols}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Protocols</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-panel-border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/20">
              <Globe className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold">{formatBytes(stats.totalBytesTransferred)}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Transferred</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search IPs, threats..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={filterThreat} onValueChange={setFilterThreat}>
          <SelectTrigger className="w-[180px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Traffic</SelectItem>
            <SelectItem value="threats">Threats Only</SelectItem>
            <SelectItem value="clean">Clean Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {viewMode === "graph" ? (
        <div className="h-[calc(100vh-24rem)] bg-card border border-panel-border rounded-lg">
          <NetworkGraph key={graphVersion} />
        </div>
      ) : (
        <div className="bg-card border border-panel-border rounded-lg overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-panel-border">
                    <TableHead>Source IP</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Protocol</TableHead>
                    <TableHead>Port</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time</TableHead>
                    {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.slice(0, 50).map((data) => (
                    <TableRow key={data.id} className="border-panel-border">
                      <TableCell className="font-mono text-sm">{data.source_ip}</TableCell>
                      <TableCell className="font-mono text-sm">{data.destination_ip || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{data.protocol}</Badge>
                      </TableCell>
                      <TableCell className="font-mono">{data.port || "-"}</TableCell>
                      <TableCell>{formatBytes(data.bytes_transferred)}</TableCell>
                      <TableCell>
                        {data.threat_detected ? (
                          <Badge className="bg-destructive/20 text-destructive">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            {data.threat_type || "Threat"}
                          </Badge>
                        ) : (
                          <Badge className="bg-success/20 text-success">Clean</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDistanceToNow(new Date(data.timestamp), { addSuffix: true })}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDeleteEntry(data.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

