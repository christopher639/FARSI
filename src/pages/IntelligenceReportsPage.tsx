import { FileText, Search, Filter, Download, Plus, Clock, User, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const reports = [
  {
    id: "RPT-2024-0847",
    title: "Cross-Border Movement Analysis: Somalia-Kenya Corridor",
    classification: "TOP SECRET",
    author: "NIS Intelligence Desk",
    date: "2024-01-15",
    status: "active",
    tags: ["Border Security", "Al-Shabaab", "Movement Patterns"],
  },
  {
    id: "RPT-2024-0846",
    title: "Urban Gang Network Assessment: Nairobi Metropolitan",
    classification: "SECRET",
    author: "DCI Organized Crime Unit",
    date: "2024-01-14",
    status: "active",
    tags: ["Organized Crime", "Gang Activity", "Nairobi"],
  },
  {
    id: "RPT-2024-0845",
    title: "Wildlife Poaching Syndicate Investigation Update",
    classification: "CONFIDENTIAL",
    author: "KWS Intelligence",
    date: "2024-01-13",
    status: "closed",
    tags: ["Wildlife Crime", "Poaching", "Trafficking"],
  },
  {
    id: "RPT-2024-0844",
    title: "Financial Intelligence: Suspicious Transaction Patterns",
    classification: "SECRET",
    author: "FRC Analysis Team",
    date: "2024-01-12",
    status: "active",
    tags: ["Financial Crime", "Money Laundering", "Terrorism Financing"],
  },
  {
    id: "RPT-2024-0843",
    title: "Cattle Rustling Threat Assessment: Northern Kenya",
    classification: "CONFIDENTIAL",
    author: "NPS Regional Command",
    date: "2024-01-11",
    status: "active",
    tags: ["Cattle Rustling", "Tribal Conflict", "Northern Region"],
  },
];

const classificationColors = {
  "TOP SECRET": "bg-destructive/20 text-destructive border-destructive/30",
  "SECRET": "bg-warning/20 text-warning border-warning/30",
  "CONFIDENTIAL": "bg-primary/20 text-primary border-primary/30",
};

export default function IntelligenceReportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Intelligence Reports</h1>
          <p className="text-muted-foreground">Classified documents and threat assessments</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />
          New Report
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search reports..." className="pl-10" />
        </div>
        <Button variant="outline">
          <Filter className="w-4 h-4 mr-2" />
          Classification
        </Button>
        <Button variant="outline">
          <Filter className="w-4 h-4 mr-2" />
          Date Range
        </Button>
      </div>

      {/* Reports List */}
      <div className="space-y-3">
        {reports.map((report) => (
          <div
            key={report.id}
            className="bg-card border border-panel-border rounded-lg p-4 hover:border-primary/50 transition-colors cursor-pointer"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <Badge className={classificationColors[report.classification as keyof typeof classificationColors]}>
                    {report.classification}
                  </Badge>
                  <span className="text-xs font-mono text-muted-foreground">{report.id}</span>
                </div>
                <h3 className="font-semibold text-foreground mb-2">{report.title}</h3>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {report.author}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {report.date}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  {report.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      <Tag className="w-2 h-2 mr-1" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button variant="ghost" size="icon">
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
