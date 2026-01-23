import { useState } from "react";
import { useIntelligenceReports } from "@/hooks/useIntelligenceReports";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Search, Filter, Download, Plus, Clock, User, Tag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { format } from "date-fns";
import { z } from "zod";

const reportSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(300),
  content: z.string().max(10000).optional(),
  source: z.string().max(200).optional(),
  category: z.string().max(100).optional(),
  classification: z.enum(["top_secret", "secret", "confidential", "unclassified"]),
});

const classificationColors: Record<string, string> = {
  top_secret: "bg-destructive/20 text-destructive border-destructive/30",
  secret: "bg-warning/20 text-warning border-warning/30",
  confidential: "bg-primary/20 text-primary border-primary/30",
  unclassified: "bg-muted text-muted-foreground",
};

const classificationLabels: Record<string, string> = {
  top_secret: "TOP SECRET",
  secret: "SECRET",
  confidential: "CONFIDENTIAL",
  unclassified: "UNCLASSIFIED",
};

export default function IntelligenceReportsPage() {
  const { reports, loading, refetch } = useIntelligenceReports();
  const { user, isAdmin, isAnalyst } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterClassification, setFilterClassification] = useState<string>("all");

  const [formData, setFormData] = useState({
    title: "",
    content: "",
    source: "",
    category: "",
    classification: "unclassified" as const,
  });

  const canCreate = isAdmin || isAnalyst;

  const filteredReports = reports.filter(report => {
    const matchesSearch = report.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (report.source?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (report.category?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesClassification = filterClassification === "all" || report.classification === filterClassification;
    return matchesSearch && matchesClassification;
  });

  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = reportSchema.safeParse(formData);
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    if (!user) {
      toast.error("You must be logged in to create reports");
      return;
    }

    setCreating(true);
    try {
      const { error } = await supabase.from("intelligence_reports").insert({
        title: formData.title,
        content: formData.content || null,
        source: formData.source || null,
        category: formData.category || null,
        classification: formData.classification,
        author_id: user.id,
      });

      if (error) throw error;

      toast.success("Report created successfully");
      setIsCreateDialogOpen(false);
      setFormData({
        title: "",
        content: "",
        source: "",
        category: "",
        classification: "unclassified",
      });
      refetch();
    } catch (error: any) {
      console.error("Error creating report:", error);
      toast.error(error.message || "Failed to create report");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Intelligence Reports</h1>
          <p className="text-sm text-muted-foreground">Classified documents and threat assessments</p>
        </div>
        {canCreate && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" />
                New Report
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] p-0 bg-card border-primary/20 overflow-hidden">
              <DialogHeader className="px-4 pt-4 sm:px-6 sm:pt-6 pb-2">
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Create Intelligence Report
                </DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[calc(90vh-120px)] px-4 pb-4 sm:px-6 sm:pb-6">
                <form onSubmit={handleCreateReport} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Report Title *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Brief title for the intelligence report"
                      required
                      className="bg-background/50"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="classification">Classification *</Label>
                      <Select
                        value={formData.classification}
                        onValueChange={(value: any) => setFormData({ ...formData, classification: value })}
                      >
                        <SelectTrigger className="bg-background/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unclassified">Unclassified</SelectItem>
                          <SelectItem value="confidential">Confidential</SelectItem>
                          <SelectItem value="secret">Secret</SelectItem>
                          <SelectItem value="top_secret">Top Secret</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <Input
                        id="category"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        placeholder="Terrorism, Cybercrime, etc."
                        className="bg-background/50"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="source">Source</Label>
                    <Input
                      id="source"
                      value={formData.source}
                      onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                      placeholder="NIS, DCI, Field Agent, etc."
                      className="bg-background/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="content">Report Content</Label>
                    <Textarea
                      id="content"
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      placeholder="Detailed intelligence report content..."
                      rows={6}
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
                        Create Report
                      </>
                    )}
                  </Button>
                </form>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search reports..." 
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={filterClassification} onValueChange={setFilterClassification}>
          <SelectTrigger className="w-[180px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Classification" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classifications</SelectItem>
            <SelectItem value="top_secret">Top Secret</SelectItem>
            <SelectItem value="secret">Secret</SelectItem>
            <SelectItem value="confidential">Confidential</SelectItem>
            <SelectItem value="unclassified">Unclassified</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Reports List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No reports found</p>
          </div>
        ) : (
          filteredReports.map((report) => (
            <div
              key={report.id}
              className="bg-card border border-panel-border rounded-lg p-4 hover:border-primary/50 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <Badge className={classificationColors[report.classification || 'unclassified']}>
                      {classificationLabels[report.classification || 'unclassified']}
                    </Badge>
                    {report.category && (
                      <Badge variant="outline" className="text-xs">
                        <Tag className="w-2 h-2 mr-1" />
                        {report.category}
                      </Badge>
                    )}
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{report.title}</h3>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    {report.source && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {report.source}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(new Date(report.created_at), 'MMM dd, yyyy')}
                    </span>
                  </div>
                  {report.content && (
                    <p className="text-sm text-muted-foreground/80 mt-2 line-clamp-2">{report.content}</p>
                  )}
                </div>
                <Button variant="ghost" size="icon">
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
