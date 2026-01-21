import { NetworkGraph } from "@/components/dashboard/NetworkGraph";
import { Search, Filter, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function NetworkAnalysisPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Network Analysis</h1>
          <p className="text-muted-foreground">Entity relationship mapping and threat network visualization</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon">
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon">
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon">
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search entities, organizations, locations..." className="pl-10" />
        </div>
        <Button variant="outline">
          <Filter className="w-4 h-4 mr-2" />
          Filter by Type
        </Button>
      </div>

      {/* Network Graph */}
      <div className="h-[calc(100vh-16rem)] bg-card border border-panel-border rounded-lg">
        <NetworkGraph />
      </div>
    </div>
  );
}
