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
  RefreshCw,
  Clock,
  Layers,
  Info,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { useToast } from "@/components/ui/toast";
import { KpiMetricCard } from "@/components/dashboard/kpi-metric-card";
import { CallVolumeTrendChart } from "@/components/dashboard/call-volume-trend-chart";
import { OutcomeDistributionChart } from "@/components/dashboard/outcome-distribution-chart";
import { ActionDistributionChart } from "@/components/dashboard/action-distribution-chart";
import { HourlyDistributionChart } from "@/components/dashboard/hourly-distribution-chart";
import { RecentCallsTable } from "@/components/dashboard/recent-calls-table";
import { FollowUpQueueWidget } from "@/components/dashboard/follow-up-queue-widget";
import { IntegrationStatusPanel } from "@/components/dashboard/integration-status-panel";
import { CallDetailModal } from "@/components/calls/call-detail-modal";
import { overviewService, OverviewDashboardData } from "@/lib/services/overview-service";
import { CallRecord } from "@/types";

export default function OverviewPage() {
  const { showToast } = useToast();
  const [selectedRange, setSelectedRange] = React.useState("Today");
  const [data, setData] = React.useState<OverviewDashboardData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [selectedCall, setSelectedCall] = React.useState<CallRecord | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = React.useState(false);
  const [callsList, setCallsList] = React.useState<CallRecord[]>([]);

  // Range and Refresh handlers
  const handleRangeChange = (newRange: string) => {
    setIsLoading(true);
    setSelectedRange(newRange);
  };

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      const currentFormattedTime =
        new Date().toLocaleTimeString("en-IN", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Kolkata",
        }) + " IST";

      const result = await overviewService.getOverviewData(selectedRange, {
        timestamp: currentFormattedTime,
      });

      setData(result);
      setCallsList(result.recentCalls);
      showToast({
        type: "success",
        title: "Dashboard Refreshed",
        message: `Refreshed metrics for ${selectedRange} at ${result.freshnessTimestamp}.`,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to refresh overview data.";
      setError(message);
      showToast({
        type: "error",
        title: "Refresh Failed",
        message,
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Initial fetch and range change
  React.useEffect(() => {
    let isMounted = true;

    overviewService
      .getOverviewData(selectedRange)
      .then((result) => {
        if (isMounted) {
          setData(result);
          setCallsList(result.recentCalls);
          setIsLoading(false);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(
            err instanceof Error ? err.message : "Failed to load overview data."
          );
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedRange]);

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
    showToast({
      type: "info",
      title: "Follow-up Resolved",
      message: `Call ${callId} marked as handled by staff.`,
    });
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
      onDateRangeChange={handleRangeChange}
    >
      <div className="space-y-6">
        {/* 1. Page Header */}
        <PageHeader
          title="Daya Hospital AI Calling"
          description="Monitor AI calls, patient enquiries and appointment actions."
          badge={
            <div className="flex items-center gap-2">
              <Badge variant="teal" size="sm" className="gap-1.5 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                24/7 Voice Operations
              </Badge>
              {data?.isDemoData && (
                <div
                  className="flex items-center gap-1 rounded bg-amber-100/80 px-2 py-0.5 text-[11px] font-bold text-amber-900 border border-amber-300"
                  title="Demo data mode: Metrics reflect simulated hospital call records and sandbox adapters."
                >
                  <Layers className="h-3 w-3 text-amber-700" />
                  <span>Demo data</span>
                </div>
              )}
            </div>
          }
          breadcrumbs={[{ label: "Overview" }]}
          actions={
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Date Freshness Timestamp */}
              <div
                className="hidden lg:flex items-center gap-1.5 rounded-md bg-slate-100/80 px-2.5 py-1 text-xs text-slate-600 border border-slate-200"
                title="Data freshness timestamp"
              >
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                <span>
                  Freshness:{" "}
                  <strong className="text-slate-800">
                    {data?.freshnessTimestamp || "Loading..."}
                  </strong>
                </span>
              </div>

              {/* Date-Range Selector */}
              <div className="flex items-center rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-xs">
                {["Today", "Yesterday", "Last 7 Days", "Last 30 Days"].map(
                  (range) => (
                    <button
                      key={range}
                      onClick={() => handleRangeChange(range)}
                      className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                        selectedRange === range
                          ? "bg-white text-slate-900 shadow-2xs font-semibold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {range}
                    </button>
                  )
                )}
              </div>

              {/* Refresh Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing || isLoading}
                className="h-8 gap-1.5 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-50"
                title="Refresh dashboard data"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-[#0C5DB8]" : "text-slate-500"}`}
                />
                <span className="hidden sm:inline">
                  {isRefreshing ? "Refreshing..." : "Refresh"}
                </span>
              </Button>
            </div>
          }
        />

        {/* Demo Data Banner Alert */}
        {data?.isDemoData && (
          <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-amber-700 shrink-0" />
              <span>
                <strong>Demo data indicator:</strong> This dashboard is currently operating with simulated Daya Hospital call records and sandbox adapters. No live patient calls or HMS production endpoints are altered.
              </span>
            </div>
            <span className="hidden sm:inline-block font-mono text-[10px] text-amber-700 font-semibold uppercase">
              Sandbox Mode
            </span>
          </div>
        )}

        {/* Error Handling */}
        {error && (
          <ErrorState
            title="Failed to Load Overview Data"
            message={error}
            onRetry={() => handleRangeChange(selectedRange)}
          />
        )}

        {/* Loading Skeleton */}
        {isLoading && !data && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-3 w-36" />
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <Skeleton className="h-28 w-full" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Skeleton className="h-72 w-full rounded-xl" />
              <Skeleton className="h-72 w-full rounded-xl" />
            </div>
          </div>
        )}

        {/* Data Loaded */}
        {data && (
          <>
            {/* 2. Metric Cards */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  AI Calling Operations & Appointment Actions ({selectedRange})
                </h2>
                <span className="text-xs text-slate-400">
                  Click any card to inspect filtered calls or actions
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Calls Offered to AI */}
                <KpiMetricCard
                  title="Calls Offered to AI"
                  value={data.metrics.callsOffered}
                  subtitle="From IVR rollover & direct lines"
                  icon={PhoneCall}
                  variant="blue"
                  tooltip="Total inbound calls routed from hospital lines/IVR to the AI assistant"
                  href="/calls"
                  isDemoData={data.isDemoData}
                />

                {/* 2. Calls Answered by AI */}
                <KpiMetricCard
                  title="Calls Answered by AI"
                  value={data.metrics.callsAnswered}
                  subtitle="Picked up within 2 rings"
                  icon={Sparkles}
                  variant="teal"
                  badge="Malayalam"
                  tooltip="Inbound calls successfully answered by Sarvam AI voice assistant in Malayalam"
                  href="/calls?status=ANSWERED"
                  isDemoData={data.isDemoData}
                />

                {/* 3. Calls Completed */}
                <KpiMetricCard
                  title="Calls Completed"
                  value={data.metrics.callsCompleted}
                  subtitle="Resolved end-to-end by AI"
                  icon={CheckCircle2}
                  variant="teal"
                  tooltip="Patient calls completely resolved by AI without requiring human staff escalation"
                  href="/calls?status=ANSWERED&outcome=COMPLETED"
                  isDemoData={data.isDemoData}
                />

                {/* 4. Appointments Booked */}
                <KpiMetricCard
                  title="Appointments Booked"
                  value={data.metrics.appointmentsBooked}
                  subtitle="Confirmed directly into HMS"
                  icon={CalendarCheck}
                  variant="blue"
                  tooltip="Confirmed patient outpatient consultations booked directly into Daya HMS"
                  href="/actions?type=BOOK_APPOINTMENT"
                  isDemoData={data.isDemoData}
                />

                {/* 5. Appointments Rescheduled */}
                <KpiMetricCard
                  title="Appointments Rescheduled"
                  value={data.metrics.appointmentsRescheduled}
                  subtitle="Slots safely updated in HMS"
                  icon={CalendarClock}
                  variant="teal"
                  tooltip="Existing OPD appointments shifted to new available doctor slots"
                  href="/actions?type=RESCHEDULE_APPOINTMENT"
                  isDemoData={data.isDemoData}
                />

                {/* 6. Appointments Cancelled */}
                <KpiMetricCard
                  title="Appointments Cancelled"
                  value={data.metrics.appointmentsCancelled}
                  subtitle="Released back to HMS inventory"
                  icon={CalendarX}
                  variant="default"
                  tooltip="Appointments cancelled and released back to Daya HMS inventory"
                  href="/actions?type=CANCEL_APPOINTMENT"
                  isDemoData={data.isDemoData}
                />

                {/* 7. Transferred to Staff */}
                <KpiMetricCard
                  title="Transferred to Staff"
                  value={data.metrics.transferredToStaff}
                  subtitle="Escalated to human agents"
                  icon={PhoneForwarded}
                  variant="amber"
                  tooltip="Calls escalated to Daya hospital front-desk / duty nurse for complex clinical needs"
                  href="/calls?status=TRANSFERRED"
                  isDemoData={data.isDemoData}
                />

                {/* 8. Requires Follow-Up */}
                <KpiMetricCard
                  title="Requires Follow-Up"
                  value={data.metrics.requiresFollowUp}
                  subtitle="Pending staff callback"
                  icon={AlertTriangle}
                  variant="rose"
                  badge="Staff Action"
                  tooltip="Incomplete queries or failed token bookings requiring manual staff callback"
                  href="/calls?followUp=true"
                  isDemoData={data.isDemoData}
                />
              </div>
            </div>

            {/* 5. Integration Status Panel */}
            <IntegrationStatusPanel
              services={data.integrationStatus.services}
              lastSuccessfulSync={data.integrationStatus.lastSuccessfulSync}
              activeIncidents={data.integrationStatus.activeIncidents}
              isMockSandbox={data.integrationStatus.isMockSandbox}
            />

            {/* 3. Charts: 4 Recharts in 2x2 Grid */}
            <div className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Call Trends & Performance Analytics ({selectedRange})
              </h2>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Chart 1: AI Call Volume Over Time */}
                <CallVolumeTrendChart
                  data={data.volumeOverTime}
                  title="AI Call Volume Over Time"
                  description="Inbound calls offered vs completed by AI over the selected timeframe"
                />

                {/* Chart 2: Call Outcome Distribution */}
                <OutcomeDistributionChart
                  data={data.outcomeDistribution}
                  title="Call Outcome Distribution"
                  description="Proportion of calls completed, transferred to staff, or needing follow-up"
                />

                {/* Chart 3: AI Action Distribution */}
                <ActionDistributionChart
                  data={data.actionDistribution}
                  title="AI Action Distribution"
                  description="Breakdown of automated clinical bookings and enquiry actions taken"
                />

                {/* Chart 4: Hourly Call Distribution */}
                <HourlyDistributionChart
                  data={data.hourlyDistribution}
                  title="Hourly Call Distribution (24 Hours)"
                  description="Day & night hospital call patterns showing peak OPD rush hours"
                />
              </div>
            </div>

            {/* 4. Recent Calls Table & Follow-up Queue */}
            <div className="space-y-6">
              {/* Recent Calls Table */}
              <RecentCallsTable
                calls={callsList}
                onSelectCall={handleOpenCall}
                title="Recent AI Inbound Calls"
                description="Audit time, masked caller, intent, duration, AI action, and final outcome with full history link"
              />

              {/* Staff Follow-Up Queue Widget */}
              <FollowUpQueueWidget
                calls={callsList}
                onSelectCall={handleOpenCall}
                onResolveFollowUp={handleResolveFollowUp}
              />
            </div>
          </>
        )}
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
