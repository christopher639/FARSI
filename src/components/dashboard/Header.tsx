import { Bell, Search, User, Signal, Clock, Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { Shield } from "lucide-react";

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 h-16 border-b border-panel-border bg-card/95 backdrop-blur-sm flex items-center justify-between px-6 z-50">
      {/* Left Section */}
      <div className="flex items-center gap-4">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center glow-primary">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              FARSI <span className="text-primary text-glow">Command</span>
            </h1>
            <p className="text-[10px] text-muted-foreground font-mono tracking-wide">
              Fusion & Analysis for Real-time Security Intelligence
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

        {/* User */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium">Operator Alpha</p>
            <p className="text-xs text-muted-foreground">Level 5 Access</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
        </div>
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
