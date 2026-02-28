import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Search, RefreshCw, Loader2, Download, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type AuditLog = {
  id: string;
  action: string;
  actor: string;
  role: string | null;
  target: string | null;
  metadata: any;
  created_at: string;
};

const actionColors: Record<string, string> = {
  create: "bg-success/20 text-success border-success/30",
  update: "bg-primary/20 text-primary border-primary/30",
  delete: "bg-destructive/20 text-destructive border-destructive/30",
  login: "bg-warning/20 text-warning border-warning/30",
  export: "bg-accent/20 text-accent-foreground border-accent/30",
};

function getActionColor(action: string) {
  const lower = action.toLowerCase();
  for (const [key, value] of Object.entries(actionColors)) {
    if (lower.includes(key)) return value;
  }
  return "bg-muted text-muted-foreground";
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAction, setFilterAction] = useState<string>("all");

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      setLogs((data || []) as AuditLog[]);
    } catch (err) {
      console.error("Failed to fetch audit logs", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const actionTypes = useMemo(() => {
    const unique = new Set(logs.map((l) => l.action));
    return ["all", ...Array.from(unique).sort()];
  }, [logs]);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      const matchesSearch =
        l.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.actor.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.target || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesAction = filterAction === "all" || l.action === filterAction;
      return matchesSearch && matchesAction;
    });
  }, [logs, searchQuery, filterAction]);

  const handleExport = () => {
    try {
      const headers = ["id", "action", "actor", "role", "target", "created_at"];
      const rows = filtered.map((l) =>
        [l.id, l.action, l.actor, l.role || "", l.target || "", l.created_at]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      );
      const csv = [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${filtered.length} audit logs`);
    } catch {
      toast.error("Failed to export audit logs");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Audit & Compliance Logs</h1>
          <p className="text-sm text-muted-foreground">
            Security audit trail, data anonymization events & system activity
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-panel-border rounded-lg p-4">
          <p className="text-xl font-bold">{logs.length}</p>
          <p className="text-xs text-muted-foreground">Total Entries</p>
        </div>
        <div className="bg-card border border-panel-border rounded-lg p-4">
          <p className="text-xl font-bold">{new Set(logs.map((l) => l.actor)).size}</p>
          <p className="text-xs text-muted-foreground">Unique Actors</p>
        </div>
        <div className="bg-card border border-panel-border rounded-lg p-4">
          <p className="text-xl font-bold">{new Set(logs.map((l) => l.action)).size}</p>
          <p className="text-xs text-muted-foreground">Action Types</p>
        </div>
        <div className="bg-card border border-panel-border rounded-lg p-4">
          <p className="text-xl font-bold">
            {logs.filter((l) => {
              const age = Date.now() - new Date(l.created_at).getTime();
              return age < 24 * 60 * 60 * 1000;
            }).length}
          </p>
          <p className="text-xs text-muted-foreground">Last 24h</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search actions, actors, targets..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-[200px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filter by action" />
          </SelectTrigger>
          <SelectContent>
            {actionTypes.map((a) => (
              <SelectItem key={a} value={a}>
                {a === "all" ? "All Actions" : a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No audit logs found</p>
        </div>
      ) : (
        <div className="bg-card border border-panel-border rounded-lg overflow-hidden">
          <ScrollArea className="h-[calc(100vh-24rem)]">
            <Table>
              <TableHeader>
                <TableRow className="border-panel-border">
                  <TableHead>Action</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((log) => (
                  <TableRow key={log.id} className="border-panel-border">
                    <TableCell>
                      <Badge className={getActionColor(log.action)}>{log.action}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs max-w-[120px] truncate">
                      {log.actor}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {log.role || "-"}
                    </TableCell>
                    <TableCell className="text-xs max-w-[120px] truncate">
                      {log.target || "-"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate text-muted-foreground">
                      {log.metadata && Object.keys(log.metadata).length > 0
                        ? JSON.stringify(log.metadata)
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
