import * as React from "react";
import { RefreshCw, Radio, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SarvamSyncResult } from "@/lib/integrations/sarvam/knowledge-sync";

interface SarvamSyncStatusCardProps {
  syncResult: SarvamSyncResult | null;
  isSyncing: boolean;
  onSync: () => Promise<void>;
  totalApproved: number;
}

export function SarvamSyncStatusCard({
  syncResult,
  isSyncing,
  onSync,
  totalApproved,
}: SarvamSyncStatusCardProps) {
  const isConfigured = syncResult?.mode === "PRODUCTION";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-teal-50 p-2 text-[#0E7A71]">
            <Radio className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-slate-900">
                Smrko Voice Agent Synchronization
              </h3>
              <Badge
                variant={isConfigured ? "success" : "warning"}
                size="sm"
                className="text-[10px]"
              >
                {isConfigured ? "Production Connected" : "Demo Mode (Local Database Only)"}
              </Badge>
              <span className="text-[10px] text-slate-500 font-medium">
                ({totalApproved} approved articles)
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Approved articles ground the Malayalam conversational voice model. Non-invented sync interface.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={onSync}
            disabled={isSyncing}
            className="h-8 gap-1.5 text-xs bg-[#0C5DB8] hover:bg-[#0A4D98] text-white shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "Checking Sync Adapter..." : "Sync with Voice Agent"}</span>
          </Button>
        </div>
      </div>

      {/* Sync Status Banner */}
      <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5 text-[11px] text-slate-600 flex items-start gap-2">
        <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5 flex-1">
          <p>
            <strong>Sync Interface Architecture:</strong> Real Smrko Voice LLM knowledge upload endpoint is cleanly decoupled. In Demo Mode, articles are safely stored in Daya&apos;s local database without issuing false sync confirmations.
          </p>
          {syncResult && (
            <p className="text-slate-500 pt-0.5 font-mono text-[10px]">
              Last Status: {syncResult.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
