import * as React from "react";
import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiMetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: string;
  trend?: "up" | "down" | "neutral";
  icon: LucideIcon;
  variant?: "default" | "blue" | "teal" | "amber" | "rose" | "purple";
  badge?: string;
}

export function KpiMetricCard({
  title,
  value,
  subtitle,
  change,
  trend,
  icon: Icon,
  variant = "default",
  badge,
}: KpiMetricCardProps) {
  const iconColorStyles = {
    default: "bg-slate-100 text-slate-700",
    blue: "bg-[#E8F2FC] text-[#0C5DB8]",
    teal: "bg-[#EAF7F6] text-[#0E7A71]",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
    purple: "bg-indigo-50 text-indigo-700",
  }[variant];

  return (
    <Card className="hover:border-slate-300 transition-all hover:shadow-xs">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              {title}
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900">
                {value}
              </span>
              {badge && (
                <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-600">
                  {badge}
                </span>
              )}
            </div>
          </div>
          <div className={cn("rounded-lg p-2.5 shrink-0", iconColorStyles)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>

        {(subtitle || change) && (
          <div className="mt-3 flex items-center text-xs text-slate-500 gap-1.5">
            {change && (
              <span
                className={cn(
                  "font-semibold",
                  trend === "up" && "text-emerald-600",
                  trend === "down" && "text-rose-600",
                  trend === "neutral" && "text-slate-600"
                )}
              >
                {change}
              </span>
            )}
            {subtitle && <span className="truncate">{subtitle}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
