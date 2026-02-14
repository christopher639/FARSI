import { NavLink, useLocation } from "react-router-dom";
import { 
  Shield, 
  Map, 
  Bell, 
  MapPin,
  Network, 
  Eye,
  FileText,
  Radio,
  Database,
  Settings,
  ChevronLeft,
  ChevronRight,
  Building2,
  Users
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useThreatAlerts } from "@/hooks/useThreatAlerts";

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  badge?: number;
  adminOnly?: boolean;
  allowedRoles?: Array<"admin" | "analyst" | "viewer" | "security_agent">;
}

interface Agency {
  code: string;
  name: string;
  status: 'online' | 'offline' | 'syncing';
}

const navItems: NavItem[] = [
  { icon: Shield, label: "Command Center", path: "/" },
  { icon: Map, label: "Threat Heatmap", path: "/threat-heatmap" },
  { icon: MapPin, label: "Report Crime", path: "/crime-reports", allowedRoles: ["admin", "analyst", "security_agent"] },
  { icon: Bell, label: "Alerts", path: "/alerts" },
  { icon: Network, label: "Network Analysis", path: "/network-analysis" },
  { icon: Eye, label: "Surveillance", path: "/surveillance" },
  { icon: FileText, label: "Intelligence Reports", path: "/intelligence-reports" },
  { icon: Radio, label: "Communications", path: "/communications" },
  { icon: Database, label: "Data Fusion Hub", path: "/data-fusion" },
  { icon: Users, label: "User Management", path: "/users", adminOnly: true },
  { icon: Settings, label: "System Settings", path: "/system-settings", adminOnly: true },
];

const agencies: Agency[] = [
  { code: "NPS", name: "National Police Service", status: 'online' },
  { code: "NIS", name: "National Intelligence Service", status: 'online' },
  { code: "KWS", name: "Kenya Wildlife Service", status: 'online' },
  { code: "DCI", name: "Directorate of Criminal Investigations", status: 'syncing' },
];

const statusColors = {
  online: 'bg-success',
  offline: 'bg-destructive',
  syncing: 'bg-warning animate-pulse',
};

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose?: () => void;
}

export function Sidebar({ isOpen, onToggle, onClose }: SidebarProps) {
  const location = useLocation();
  const { isAdmin, userRole } = useAuth();
  const { stats } = useDashboardStats();
  const { alerts } = useThreatAlerts();

  const navItemsWithLiveBadges: NavItem[] = navItems.map((item) => {
    if (item.path === "/threat-heatmap") {
      return { ...item, badge: stats.activeThreats };
    }
    if (item.path === "/alerts") {
      return { ...item, badge: alerts.length };
    }
    return item;
  });

  // Filter nav items based on role
  const filteredNavItems = navItemsWithLiveBadges.filter(item => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.allowedRoles && (!userRole || !item.allowedRoles.includes(userRole))) return false;
    return true;
  });

  return (
    <aside 
      className={cn(
        "fixed left-0 top-16 h-[calc(100vh-4rem)] bg-sidebar border-r border-sidebar-border flex flex-col z-40 transition-all duration-300 ease-in-out",
        // Mobile: slide in/out from left, desktop: expand/collapse
        isOpen ? "w-64 translate-x-0" : "lg:w-16 -translate-x-full lg:translate-x-0"
      )}
    >
      {/* Toggle Button - hide on mobile (use header menu instead) */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-6 w-6 h-6 bg-primary rounded-full items-center justify-center text-primary-foreground shadow-lg hover:scale-110 transition-transform z-50 hidden lg:flex"
      >
        {isOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {/* Main Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <div className="px-3 space-y-1">
          {filteredNavItems.map((item) => (
            <NavButton 
              key={item.label} 
              {...item} 
              isOpen={isOpen} 
              isActive={location.pathname === item.path}
              onNavigate={onClose}
            />
          ))}
        </div>

        {/* Divider */}
        <div className="my-4 mx-3">
          <div className={cn(
            "h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent",
            !isOpen && "mx-2"
          )} />
        </div>

        {/* Connected Agencies Section */}
        <div className="px-3">
          {isOpen && (
            <div className="flex items-center gap-2 px-3 mb-3">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Connected Agencies
              </span>
            </div>
          )}
          <div className="space-y-1">
            {agencies.map((agency) => (
              <AgencyButton key={agency.code} agency={agency} isOpen={isOpen} />
            ))}
          </div>
        </div>
      </nav>

      {/* Settings at Bottom */}
      <div className="p-3 border-t border-sidebar-border">
        <NavButton 
          icon={Settings} 
          label="Settings" 
          path="/settings"
          isOpen={isOpen} 
          isActive={location.pathname === "/settings"}
          onNavigate={onClose}
        />
      </div>
    </aside>
  );
}

function NavButton({ icon: Icon, label, path, badge, isOpen, isActive, onNavigate }: NavItem & { isOpen: boolean; isActive: boolean; onNavigate?: () => void }) {
  return (
    <NavLink
      to={path}
      onClick={onNavigate}
      className={cn(
        "w-full flex items-center gap-3 rounded-lg transition-all duration-200 group relative",
        isOpen ? "px-3 py-2.5" : "px-0 py-2.5 justify-center",
        isActive 
          ? "bg-primary/10 text-primary border border-primary/30" 
          : "text-sidebar-foreground hover:text-foreground hover:bg-sidebar-accent"
      )}
      title={!isOpen ? label : undefined}
    >
      <div className="relative flex-shrink-0">
        <Icon className={cn("w-5 h-5", isActive && "text-glow")} />
        {/* Badge on icon when collapsed */}
        {badge !== undefined && !isOpen && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {badge}
          </span>
        )}
      </div>
      
      {isOpen && (
        <>
          <span className="flex-1 text-left text-sm font-medium truncate">{label}</span>
          {badge !== undefined && (
            <span className="min-w-[20px] h-5 bg-destructive text-destructive-foreground text-xs font-bold rounded-full flex items-center justify-center px-1.5">
              {badge}
            </span>
          )}
        </>
      )}

      {/* Tooltip when collapsed */}
      {!isOpen && (
        <span className="absolute left-full ml-3 px-2 py-1.5 bg-card border border-panel-border rounded-lg text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-lg">
          {label}
          {badge !== undefined && <span className="ml-2 text-destructive">({badge})</span>}
        </span>
      )}
    </NavLink>
  );
}

function AgencyButton({ agency, isOpen }: { agency: Agency; isOpen: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg transition-all duration-200 group relative",
        isOpen ? "px-3 py-2" : "px-0 py-2 justify-center",
        "text-sidebar-foreground hover:text-foreground hover:bg-sidebar-accent cursor-pointer"
      )}
      title={!isOpen ? `${agency.code} - ${agency.name}` : undefined}
    >
      <div className="relative flex-shrink-0">
        <div className={cn(
          "w-8 h-8 rounded-lg border flex items-center justify-center text-[10px] font-bold",
          agency.status === 'online' 
            ? "bg-success/10 border-success/30 text-success"
            : agency.status === 'syncing'
            ? "bg-warning/10 border-warning/30 text-warning"
            : "bg-muted border-muted-foreground/30 text-muted-foreground"
        )}>
          {agency.code}
        </div>
        {/* Status dot */}
        <div className={cn(
          "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-sidebar",
          statusColors[agency.status]
        )} />
      </div>

      {isOpen && (
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{agency.code}</p>
          <p className="text-[10px] text-muted-foreground truncate">{agency.name}</p>
        </div>
      )}

      {/* Tooltip when collapsed */}
      {!isOpen && (
        <span className="absolute left-full ml-3 px-2 py-1.5 bg-card border border-panel-border rounded-lg text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-lg">
          <span className="font-medium">{agency.code}</span>
          <span className="text-muted-foreground ml-1">- {agency.name}</span>
        </span>
      )}
    </div>
  );
}
