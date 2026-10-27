"use client";

import * as React from "react";
import {
  PhoneCall,
  PhoneForwarded,
  CheckCircle2,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { SystemHealthBanner } from "@/components/dashboard/system-health-banner";
import { KpiMetricCard } from "@/components/dashboard/kpi-metric-card";
import { CallVolumeChart } from "@/components/dashboard/call-volume-chart";
import { IntentDistributionChart } from "@/components/dashboard/intent-distribution-chart";
import { RecentCallsWidget } from "@/components/dashboard/recent-calls-widget";
import { FollowUpQueueWidget } from "@/components/dashboard/follow-up-queue-widget";
import { CallDetailModal } from "@/components/calls/call-detail-modal";
import {
  MOCK_OVERVIEW_METRICS,
  MOCK_CALL_RECORDS,
} from "@/lib/mock-data";
import { CallRecord } from "@/types";

export default function OverviewPage() {
  const [selectedRange, setSelectedRange] = React.useState("Today");
  const [selectedCall, setSelectedCall] = React.useState<CallRecord | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = React.useState(false);
  const [callsList, setCallsList] = React.useState(MOCK_CALL_RECORDS);

  const handleOpenCall = (call: CallRecord) => {
    setSelectedCall(call);
    setIsDetailModalOpen(true);
  };

  const handleCloseCall = () => {
    setIsDetailModalOpen(false);
  };

  const handleResolveFollowUp = (callId: string) => {
    setCallsList((prev) =>
      prev.map((c) =>
        c.id === callId
          ? { ...c, requiresFollowUp: false, followUpStatus: "RESOLVED" }
          : c
      )
    );
  };

  const handleUpdateFollowUp = (
    callId: string,
    notes: string,
    resolved: boolean
  ) => {
    setCallsList((prev) =>
      prev.map((c) =>
        c.id === callId
          ? {
              ...c,
              followUpNotes: notes,
              requiresFollowUp: !resolved,
              followUpStatus: resolved ? "RESOLVED" : "IN_PROGRESS",
            }
          : c
      )
    );
    if (selectedCall?.id === callId) {
      setSelectedCall((prev) =>
        prev
          ? {
              ...prev,
              followUpNotes: notes,
              requiresFollowUp: !resolved,
              followUpStatus: resolved ? "RESOLVED" : "IN_PROGRESS",
            }
          : null
      );
    }
  };

  return (
    <DashboardLayout
      selectedDateRange={selectedRange}
      onDateRangeChange={setSelectedRange}
    >
      <div className="space-y-6">
        {/* Page Header with Breadcrumbs */}
        <PageHeader
          title="Hospital AI Calling Overview"
          description="Real-time audit of inbound telephone traffic routed to the Sarvam Malayalam voice assistant, verified HMS actions, and human staff escalations."
          badge={
            <Badge variant="teal" size="sm">
              24/7 Live Monitoring
            </Badge>
          }
          breadcrumbs={[{ label: "Overview" }]}
        />

        {/* System Health & Adapter Banner */}
        <SystemHealthBanner health={MOCK_OVERVIEW_METRICS.systemHealth} />

        {/* Primary Operational KPI Grid */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Inbound Call Metrics ({selectedRange})
            </h2>
            <span className="text-xs text-slate-400">
              Avg. Duration: ~2m 28s • 24/7 Coverage
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiMetricCard
              title="Calls Offered to AI"
              value={MOCK_OVERVIEW_METRICS.totalCallsOffered}
              subtitle="from IVR rollover & direct lines"
              icon={PhoneCall}
              variant="blue"
              change="+14.2%"
              trend="up"
            />

            <KpiMetricCard
              title="Answered by AI"
              value={MOCK_OVERVIEW_METRICS.callsAnsweredByAi}
              subtitle="94.9% pickup rate (<2 rings)"
              icon={Sparkles}
              variant="teal"
              badge="Malayalam"
              change="+6.1%"
              trend="up"
            />

            <KpiMetricCard
              title="Handled Successfully"
              value={MOCK_OVERVIEW_METRICS.callsHandledSuccessfully}
              subtitle="88.0% end-to-end resolution"
              icon={CheckCircle2}
              variant="teal"
              change="+8.4%"
              trend="up"
            />

            <KpiMetricCard
              title="Transferred to Staff"
              value={MOCK_OVERVIEW_METRICS.callsTransferredToStaff}
              subtitle="11.4% complex/trauma escalations"
              icon={PhoneForwarded}
              variant="amber"
              change="-4.2%"
              trend="down"
            />
          </div>
        </div>

        {/* Clinical & Appointment Actions KPI Grid */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            HMS Verified Appointment Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiMetricCard
              title="Appointments Booked"
              value={MOCK_OVERVIEW_METRICS.appointmentsBooked}
              subtitle="Confirmed directly via HMS"
              icon={CalendarCheck}
              variant="blue"
              change="+22%"
              trend="up"
            />

            <KpiMetricCard
              title="Appointments Rescheduled"
              value={MOCK_OVERVIEW_METRICS.appointmentsRescheduled}
              subtitle="Slots safely updated"
              icon={CalendarClock}
              variant="teal"
            />

            <KpiMetricCard
              title="Appointments Cancelled"
              value={MOCK_OVERVIEW_METRICS.appointmentsCancelled}
              subtitle="Slots released back to HMS"
              icon={CalendarX}
              variant="default"
            />

            <KpiMetricCard
              title="Requires Follow-Up / Failed"
              value={MOCK_OVERVIEW_METRICS.callsRequiringFollowUp}
              subtitle="9 failed, 29 pending callback"
              icon={AlertTriangle}
              variant="rose"
              badge="Staff Action"
            />
          </div>
        </div>

        {/* Charts Row: Call Trends + AI Intent Breakdown */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <CallVolumeChart data={MOCK_OVERVIEW_METRICS.hourlyTrends} />
          <IntentDistributionChart
            intents={MOCK_OVERVIEW_METRICS.intentBreakdown}
          />
        </div>

        {/* Bottom Row: Recent Live Calls + Staff Follow-Up Queue */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <RecentCallsWidget
            calls={callsList}
            onSelectCall={handleOpenCall}
          />
          <FollowUpQueueWidget
            calls={callsList}
            onSelectCall={handleOpenCall}
            onResolveFollowUp={handleResolveFollowUp}
          />
        </div>
      </div>

      {/* Call Detail Modal */}
      <CallDetailModal
        call={selectedCall}
        isOpen={isDetailModalOpen}
        onClose={handleCloseCall}
        onUpdateFollowUp={handleUpdateFollowUp}
      />
    </DashboardLayout>
  );
}
