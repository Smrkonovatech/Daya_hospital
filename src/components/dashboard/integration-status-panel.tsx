import * as React from "react";
import {
  Cpu,
  Radio,
  Database,
  CheckCircle2,
  Info,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  IntegrationServiceStatus,
  IntegrationStatusState,
} from "@/lib/services/overview-service";

interface IntegrationStatusPanelProps {
  services: IntegrationServiceStatus[];
  lastSuccessfulSync: string;
  activeIncidents?: string[];
  isMockSandbox?: boolean;
}

export function IntegrationStatusPanel({
  services,
  lastSuccessfulSync,
  activeIncidents = [],
  isMockSandbox = true,
}: IntegrationStatusPanelProps) {
  const getStatusBadge = (state: IntegrationStatusState) => {
    switch (state) {
      case "Connected":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-600/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Connected
          </span>
        );
      case "Degraded":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-600/20">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Degraded
          </span>
        );
      case "Disconnected":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-800 ring-1 ring-rose-600/20">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            Disconnected
          </span>
        );
      case "Demo":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-600/25">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            Demo Mode
          </span>
        );
      case "Unknown":
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            Unknown
          </span>
        );
    }
  };

  const getServiceIcon = (key: string) => {
    switch (key) {
      case "sarvam":
        return <Cpu className="h-4 w-4 text-[#0C5DB8]" />;
      case "ivr":
        return <Radio className="h-4 w-4 text-sky-600" />;
      case "hms":
        return <Database className="h-4 w-4 text-[#18A99D]" />;
      default:
        return <Info className="h-4 w-4 text-slate-500" />;
    }
  };

  return (
    <Card className="shadow-xs border-slate-200">
      <CardHeader className="pb-3 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold">
                Integration Gateways Status
              </CardTitle>
              {isMockSandbox && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 tracking-wide">
                  Demo Environment
                </span>
              )}
            </div>
            <CardDescription>
              Operational connectivity for SMRKO VOICE Intelligence, IVR Provider, and Daya HMS
            </CardDescription>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span>Last Sync: {lastSuccessfulSync}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        {/* Service status items */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {services.map((svc) => (
            <div
              key={svc.serviceKey}
              className="flex flex-col justify-between rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2 text-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="rounded-md bg-white p-1.5 shadow-2xs ring-1 ring-slate-200">
                    {getServiceIcon(svc.serviceKey)}
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 leading-tight">
                      {svc.name}
                    </h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Sync: {svc.lastSync}
                    </p>
                  </div>
                </div>
                {getStatusBadge(svc.state)}
              </div>

              <div className="text-[11px] text-slate-600 bg-white/80 rounded p-1.5 border border-slate-100 space-y-0.5">
                <p className="line-clamp-1">{svc.notes}</p>
                {svc.latencyMs && (
                  <span className="font-mono text-[10px] text-emerald-700 font-semibold">
                    Latency: {svc.latencyMs}ms
                  </span>
                )}
                {svc.activeChannels && (
                  <span className="font-mono text-[10px] text-sky-700 font-semibold">
                    Channels: {svc.activeChannels}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Known Incidents section */}
        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-slate-600">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span className="font-medium">Incident Status:</span>
            {activeIncidents.length === 0 ? (
              <span className="text-emerald-700 font-semibold">
                No active incidents recorded in demo environment.
              </span>
            ) : (
              <span className="text-rose-700 font-semibold">
                {activeIncidents.length} active incident(s) reported.
              </span>
            )}
          </div>

          <div className="text-[11px] text-amber-800 font-medium hidden sm:flex items-center gap-1">
            <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
            <span>Never shows &apos;Connected&apos; without live verified health check.</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
