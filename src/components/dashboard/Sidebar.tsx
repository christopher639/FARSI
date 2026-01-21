import { 
  Shield, 
  Map, 
  Bell, 
  Users, 
  BarChart3, 
  Network, 
  Settings, 
  Radio,
  Eye,
  Lock
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  badge?: number;
}

const navItems: NavItem[] = [
  { icon: Map, label: "Threat Map", active: true },
  { icon: Bell, label: "Alerts", badge: 12 },
  { icon: Network, label: "Networks" },
  { icon: Users, label: "Entities" },
  { icon: BarChart3, label: "Analytics" },
  { icon: Eye, label: "Surveillance" },
  { icon: Radio, label: "Comms" },
];

const bottomNavItems: NavItem[] = [
  { icon: Settings, label: "Settings" },
];

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-screen w-20 bg-sidebar border-r border-sidebar-border flex flex-col items-center py-6 z-50">
      {/* Logo */}
      <div className="mb-8 relative">
        <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center glow-primary">
          <Shield className="w-6 h-6 text-primary" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-success rounded-full border-2 border-sidebar" />
      </div>

      {/* Main Nav */}
      <nav className="flex-1 flex flex-col items-center gap-2 stagger-children">
        {navItems.map((item) => (
          <NavButton key={item.label} {...item} />
        ))}
      </nav>

      {/* Security Badge */}
      <div className="my-4 px-2">
        <div className="w-12 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      </div>

      {/* Bottom Nav */}
      <nav className="flex flex-col items-center gap-2">
        {bottomNavItems.map((item) => (
          <NavButton key={item.label} {...item} />
        ))}
        <div className="mt-2 flex items-center justify-center w-12 h-12 text-muted-foreground">
          <Lock className="w-4 h-4" />
        </div>
      </nav>
    </aside>
  );
}

function NavButton({ icon: Icon, label, active, badge }: NavItem) {
  return (
    <button
      className={cn(
        "relative w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 group",
        active 
          ? "bg-primary/10 text-primary glow-primary border border-primary/30" 
          : "text-muted-foreground hover:text-foreground hover:bg-secondary"
      )}
      title={label}
    >
      <Icon className="w-5 h-5" />
      
      {/* Badge */}
      {badge && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1">
          {badge}
        </span>
      )}
      
      {/* Tooltip */}
      <span className="absolute left-full ml-3 px-2 py-1 bg-card border border-panel-border rounded text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
        {label}
      </span>
    </button>
  );
}
