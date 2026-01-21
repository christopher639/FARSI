import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
  variant?: 'default' | 'warning' | 'danger' | 'success';
  className?: string;
}

export function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend, 
  variant = 'default',
  className 
}: MetricCardProps) {
  const variantStyles = {
    default: 'border-panel-border',
    warning: 'border-warning/30 glow-warning',
    danger: 'border-destructive/30 glow-danger',
    success: 'border-success/30 glow-success',
  };

  const iconStyles = {
    default: 'bg-primary/10 text-primary border-primary/30',
    warning: 'bg-warning/10 text-warning border-warning/30',
    danger: 'bg-destructive/10 text-destructive border-destructive/30',
    success: 'bg-success/10 text-success border-success/30',
  };

  return (
    <div className={cn(
      "panel-glow p-4 border-glow-hover",
      variantStyles[variant],
      className
    )}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
            {title}
          </p>
          <p className="text-2xl font-bold font-mono text-foreground">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className={cn(
              "flex items-center gap-1 mt-2 text-xs font-medium",
              trend.direction === 'up' ? 'text-destructive' : 'text-success'
            )}>
              {trend.direction === 'up' ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              <span>{trend.value}% from last week</span>
            </div>
          )}
        </div>
        <div className={cn(
          "w-10 h-10 rounded-lg border flex items-center justify-center",
          iconStyles[variant]
        )}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
