import * as React from "react";
import {
  CheckCircle2,
  Cpu,
  Database,
  Radio,
  ShieldAlert,
} from "lucide-react";
import { SystemHealthStatus } from "@/types";

interface SystemHealthBannerProps {
  health: SystemHealthStatus;
}

export function SystemHealthBanner({ health }: SystemHealthBannerProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Overall Health & Status */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                AI Telephony & HMS Gateway: Fully Operational
              </h3>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                Normal Operations
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Sarvam Malayalam Speech Engine • Daya HMS REST API • 24/7 IVR Rollover Active
            </p>
          </div>
        </div>

        {/* Right: Operational Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
          {/* Sarvam AI Status */}
          <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-2 border border-slate-100">
            <Cpu className="h-4 w-4 text-[#0C5DB8]" />
            <div>
              <div className="text-[10px] text-slate-500 font-medium">
                Sarvam Voice
              </div>
              <div className="font-semibold text-slate-800 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {health.averageLatencyMs}ms Latency
              </div>
            </div>
          </div>

          {/* Daya HMS */}
          <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-2 border border-slate-100">
            <Database className="h-4 w-4 text-[#18A99D]" />
            <div>
              <div className="text-[10px] text-slate-500 font-medium">
                Daya HMS API
              </div>
              <div className="font-semibold text-slate-800 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                100% Synced
              </div>
            </div>
          </div>

          {/* IVR Lines */}
          <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-2 border border-slate-100">
            <Radio className="h-4 w-4 text-sky-600" />
            <div>
              <div className="text-[10px] text-slate-500 font-medium">
                Active Channels
              </div>
              <div className="font-semibold text-slate-800">
                {health.activeChannels} / {health.totalCapacity} Lines
              </div>
            </div>
          </div>

          {/* Mode Pill */}
          <div className="flex items-center gap-2 bg-amber-50/70 rounded-lg p-2 border border-amber-200/60">
            <ShieldAlert className="h-4 w-4 text-amber-700" />
            <div>
              <div className="text-[10px] text-amber-800 font-semibold">
                Adapter Mode
              </div>
              <div className="font-bold text-amber-900 text-[11px]">
                Mock Sandbox
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
