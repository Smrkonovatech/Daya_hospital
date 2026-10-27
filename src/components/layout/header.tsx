"use client";

import * as React from "react";
import {
  Bell,
  RefreshCw,
  Server,
  Activity,
  PhoneForwarded,
  Calendar,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  onRefresh?: () => void;
  selectedDateRange?: string;
  onDateRangeChange?: (range: string) => void;
}

export function Header({
  onRefresh,
  selectedDateRange = "Today",
  onDateRangeChange,
}: HeaderProps) {
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    onRefresh?.();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-6 backdrop-blur-xs">
      {/* Left Title & Status */}
      <div className="flex items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-slate-900 tracking-tight">
              AI Calling Operations
            </h1>
            <Badge variant="teal" size="sm">
              Malayalam Voice v2.4
            </Badge>
            <span className="hidden lg:inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-600/20">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              Mock Mode (Ready for Daya HMS & Sarvam)
            </span>
          </div>
          <p className="text-xs text-slate-500 hidden sm:block">
            Daya General Hospital Ltd & Speciality Surgical Centre, Thrissur
          </p>
        </div>
      </div>

      {/* Right Controls & Integration Status */}
      <div className="flex items-center gap-3">
        {/* System Health Indicators (Desktop) */}
        <div className="hidden xl:flex items-center gap-3 border-r border-slate-200 pr-4 text-xs">
          <div className="flex items-center gap-1.5 text-slate-600" title="Sarvam AI Malayalam Speech-to-Speech Engine">
            <Activity className="h-3.5 w-3.5 text-emerald-600" />
            <span className="font-medium text-slate-700">Sarvam Voice:</span>
            <span className="text-emerald-700 font-semibold">240ms</span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-600" title="Daya Authorized Hospital Management System">
            <Server className="h-3.5 w-3.5 text-emerald-600" />
            <span className="font-medium text-slate-700">Daya HMS:</span>
            <span className="text-emerald-700 font-semibold">Connected</span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-600" title="Hospital IVR Rollover Lines">
            <PhoneForwarded className="h-3.5 w-3.5 text-sky-600" />
            <span className="font-medium text-slate-700">IVR Trunk:</span>
            <span className="text-sky-700 font-semibold">18/30 lines</span>
          </div>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs">
          <Calendar className="h-3.5 w-3.5 text-slate-500 ml-1.5" />
          {["Today", "Yesterday", "Last 7 Days"].map((range) => (
            <button
              key={range}
              onClick={() => onDateRangeChange?.(range)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                selectedDateRange === range
                  ? "bg-white text-[#0C5DB8] shadow-2xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {range}
            </button>
          ))}
        </div>

        {/* Refresh Action */}
        <Button
          variant="outline"
          size="icon-sm"
          onClick={handleRefresh}
          title="Refresh dashboard data"
          className="h-8 w-8 text-slate-600"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-[#0C5DB8]" : ""}`}
          />
        </Button>

        {/* Notification Bell */}
        <div className="relative">
          <Button
            variant="outline"
            size="icon-sm"
            className="h-8 w-8 text-slate-600"
            title="Follow-up alerts"
          >
            <Bell className="h-3.5 w-3.5" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">
              3
            </span>
          </Button>
        </div>
      </div>
    </header>
  );
}
