import * as React from "react";
import Link from "next/link";
import { LucideIcon, Info, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface KpiMetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: string;
  trend?: "up" | "down" | "neutral";
  icon: LucideIcon;
  variant?: "default" | "blue" | "teal" | "amber" | "rose" | "purple";
  badge?: string;
  tooltip?: string;
  href?: string;
  onClick?: () => void;
  isDemoData?: boolean;
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
  tooltip,
  href,
  onClick,
  isDemoData,
}: KpiMetricCardProps) {
  const iconColorStyles = {
    default: "bg-slate-100 text-slate-700",
    blue: "bg-[#E8F2FC] text-[#0C5DB8]",
    teal: "bg-[#EAF7F6] text-[#0E7A71]",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
    purple: "bg-indigo-50 text-indigo-700",
  }[variant];

  const content = (
    <Card
      className={cn(
        "group relative transition-all duration-200 border-slate-200 shadow-2xs hover:shadow-xs",
        (href || onClick) && "cursor-pointer hover:border-slate-400 hover:bg-slate-50/40"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">
                {title}
              </p>
              {tooltip && (
                <div
                  className="relative flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  title={tooltip}
                  aria-label={tooltip}
                >
                  <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="sr-only">{tooltip}</span>
                </div>
              )}
            </div>

            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl font-bold tracking-tight text-slate-900">
                {value}
              </span>
              {badge && (
                <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-600">
                  {badge}
                </span>
              )}
              {isDemoData && (
                <span className="rounded bg-amber-50 px-1.5 py-0.2 text-[9px] font-semibold text-amber-700 border border-amber-200/60">
                  Demo
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <div className={cn("rounded-lg p-2.5 shrink-0", iconColorStyles)}>
              <Icon className="h-5 w-5" />
            </div>
            {href && (
              <ArrowUpRight className="h-4 w-4 text-slate-400 group-hover:text-[#0C5DB8] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            )}
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

  if (href) {
    return (
      <Link href={href} className="block no-underline">
        {content}
      </Link>
    );
  }

  return content;
}
