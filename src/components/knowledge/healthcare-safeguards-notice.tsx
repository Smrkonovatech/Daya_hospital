import * as React from "react";
import { ShieldAlert, AlertTriangle, PhoneCall, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function HealthcareSafeguardsNotice() {
  const [isExpanded, setIsExpanded] = React.useState(true);

  return (
    <div
      role="region"
      aria-label="Clinical Editorial Safeguards & Compliance Notice"
      className="rounded-xl border border-amber-200 bg-linear-to-r from-amber-50/90 via-amber-50/40 to-blue-50/40 p-4 shadow-2xs"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-amber-100 p-2 text-amber-800 shrink-0 mt-0.5">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-slate-900">
                Clinical Editorial Safeguards & AI Voice Grounding Rules
              </h3>
              <Badge variant="warning" size="sm">
                Mandatory Policy
              </Badge>
              <Badge variant="outline" size="sm" className="text-blue-800 border-blue-200 bg-blue-50/50">
                NABH Compliance #DGH-SOP-2026
              </Badge>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Approved articles form the authoritative knowledge source for the Smrko Voice Malayalam AI assistant. All editorial staff must adhere to strict clinical boundaries.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          className="text-xs font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1 shrink-0 px-2 py-1 rounded hover:bg-amber-100/60 transition-colors cursor-pointer"
        >
          <span>{isExpanded ? "Hide Rules" : "View Rules"}</span>
          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-3.5 pt-3.5 border-t border-amber-200/70 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="rounded-lg bg-white/90 p-3 border border-amber-100 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-amber-900">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-200 text-[10px] font-bold text-amber-900">
                1
              </span>
              <span>Strict AI Grounding</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              AI answers must strictly derive from approved hospital articles. The voice agent must never improvise hospital policies or unverified procedures.
            </p>
          </div>

          <div className="rounded-lg bg-white/90 p-3 border border-amber-100 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-amber-900">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-200 text-[10px] font-bold text-amber-900">
                2
              </span>
              <span>No Fee / Policy Guessing</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Unknown consultation fees, surgical tariffs, or doctor schedules must NOT be guessed. If an item is unlisted, the AI must offer callback or staff transfer.
            </p>
          </div>

          <div className="rounded-lg bg-white/90 p-3 border border-amber-100 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-amber-900">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-200 text-[10px] font-bold text-amber-900">
                3
              </span>
              <span>Clinical Escalation</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Clinical diagnoses or medical triage beyond the approved scope must be transferred to duty nursing or senior medical officers immediately.
            </p>
          </div>

          <div className="rounded-lg bg-white/90 p-3 border border-rose-200/80 space-y-1 bg-rose-50/30">
            <div className="flex items-center gap-1.5 font-semibold text-rose-900">
              <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
              <span>Emergency & Casualty</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Acute symptoms (chest pain, stroke, trauma) must immediately follow Daya’s emergency protocol:
            </p>
            <div className="flex items-center gap-1.5 font-medium text-[11px] text-rose-800 pt-0.5">
              <PhoneCall className="h-3 w-3 shrink-0" />
              <span>24/7 Casualty: 0487 2475000 / Ext 100</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
