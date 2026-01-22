import { Bell, Search, User, Clock, LogOut, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { user, userRole, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const getRoleBadgeColor = (role: string | null) => {
    switch (role) {
      case 'admin': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'analyst': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'viewer': return 'bg-green-500/20 text-green-400 border-green-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-16 border-b border-panel-border bg-card/95 backdrop-blur-sm flex items-center justify-between px-6 z-50">
      {/* Left Section */}
      <div className="flex items-center gap-4">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <img 
            src="/android-chrome-192x192.png" 
            alt="FARSI Logo" 
            className="w-10 h-10 rounded-xl"
          />
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              FARSI <span className="text-primary text-glow">Command</span>
            </h1>
            <p className="text-[10px] text-muted-foreground font-mono tracking-wide">
              Forensic Analysis Real-Time Security Intelligence
            </p>
          </div>
        </div>
        
        {/* Status Indicators */}
        <div className="hidden lg:flex items-center gap-4 ml-6 pl-6 border-l border-panel-border">
          <StatusIndicator label="SYSTEM" status="online" />
          <StatusIndicator label="DATA FEED" status="active" />
          <StatusIndicator label="AI ENGINE" status="processing" />
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-4">
        {/* Time Display */}
        <div className="hidden md:flex items-center gap-2 text-muted-foreground font-mono text-sm">
          <Clock className="w-4 h-4" />
          <span>{currentTime.toLocaleTimeString('en-US', { hour12: false })}</span>
          <span className="text-xs opacity-50">EAT</span>
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-panel-border hidden md:block" />

        {/* Search */}
        <button className="w-10 h-10 rounded-lg bg-secondary/50 hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
          <Search className="w-4 h-4" />
        </button>

        {/* Notifications */}
        <button className="relative w-10 h-10 rounded-lg bg-secondary/50 hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full pulse-glow" />
        </button>

        {/* Divider */}
        <div className="h-8 w-px bg-panel-border" />

        {/* User Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 hover:bg-secondary/50 rounded-lg p-2 transition-colors">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium">{user?.email?.split('@')[0] || 'User'}</p>
                <Badge className={`text-[10px] ${getRoleBadgeColor(userRole)}`}>
                  {userRole || 'No Role'}
                </Badge>
              </div>
              <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground hidden sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-card border-primary/20">
            <DropdownMenuLabel>
              <div>
                <p className="font-medium">{user?.email}</p>
                <p className="text-xs text-muted-foreground capitalize">{userRole} Access</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={handleSignOut}
              className="text-destructive focus:text-destructive cursor-pointer"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function StatusIndicator({ label, status }: { label: string; status: 'online' | 'active' | 'processing' | 'offline' }) {
  const statusConfig = {
    online: { color: 'bg-success', text: 'text-success' },
    active: { color: 'bg-primary', text: 'text-primary' },
    processing: { color: 'bg-warning', text: 'text-warning' },
    offline: { color: 'bg-destructive', text: 'text-destructive' },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div className={`w-2 h-2 rounded-full ${config.color}`} />
        {status === 'processing' && (
          <div className={`absolute inset-0 w-2 h-2 rounded-full ${config.color} animate-ping`} />
        )}
      </div>
      <span className={`text-xs font-mono ${config.text}`}>{label}</span>
    </div>
  );
}
