"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useToast } from "@/components/ui/toast";
import { CanvasGroup, ScaledCanvas } from "@/components/smrkomed/smrkomed-shell";
import {
  ActionBar,
  ActionDistributionCard,
  AlertItem,
  AlertList,
  AssistantIllustration,
  BackgroundGlows,
  CallVolumeCard,
  CreditUsageCard,
  HeroRing,
  HeroTitle,
  KpiTile,
  MiniStats,
  StaffAttention,
  StaffTask,
  StatusPills,
} from "@/components/smrkomed/dashboard-sections";
import { overviewService, OverviewDashboardData } from "@/lib/services/overview-service";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/** Figma values used until the service responds */
const DESIGN_DEFAULTS = {
  callsOffered: 1248,
  callsAnswered: 1184,
  callsCompleted: 1042,
  appointmentsBooked: 312,
  transferredToStaff: 142,
  requiresFollowUp: 38,
};

const ACTION_LABELS: Record<string, [string, string]> = {
  BOOK_APPOINTMENT: ["Book", "Appointment"],
  CHECK_DOCTOR_SLOT: ["Doctor Slot", "Search"],
  RESCHEDULE_APPOINTMENT: ["Reschedule", "Appointment"],
  TRANSFER_CALL_TO_STAFF: ["Staff", "Transfer"],
  CANCEL_APPOINTMENT: ["Cancel", "Appointment"],
};
const ACTION_COLORS = ["#866be3", "#c178f5", "#209bb2", "#ffa75d", "#0388bd"];
const DESIGN_ACTION_BARS: ActionBar[] = [
  { label: ["Book", "Appointment"], value: 312, color: ACTION_COLORS[0] },
  { label: ["Doctor Slot", "Search"], value: 450, color: ACTION_COLORS[1] },
  { label: ["Reschedule", "Appointment"], value: 118, color: ACTION_COLORS[2] },
  { label: ["Staff", "Transfer"], value: 142, color: ACTION_COLORS[3] },
  { label: ["Cancel", "Appointment"], value: 48, color: ACTION_COLORS[4] },
];

const ALERTS: AlertItem[] = [
  { label: "Casualty & Trauma Transfers", count: 2, tone: "red", href: "/calls?intent=EMERGENCY_AMBULANCE" },
  { label: "Failed HMS Bookings", count: 3, tone: "red", href: "/actions?status=FAILED" },
  { label: "Staff Follow-Up Queue", count: 5, tone: "amber", href: "/actions?view=follow-up" },
  { label: "Verified OPD Queries", count: 18, tone: "green", href: "/calls?status=ANSWERED" },
];

const STAFF_TASKS: StaffTask[] = [
  { time: "09:58 am", patient: "Biju P. (+91 94471 •••••)", task: "Appointment Booking", assignee: "Sister Mary", avatar: 1, href: "/actions?id=ACT-2026-001" },
  { time: "10:14 am", patient: "Ananya M. (+91 98460 •••••)", task: "Doctor Availability", assignee: "OPD Lead", avatar: 2, href: "/calls?callId=CALL-2026-002" },
  { time: "10:32 am", patient: "Ramesh K. (+91 97455 •••••)", task: "Insurance TPA", assignee: "TPA Desk", avatar: 3, href: "/calls?intent=INSURANCE_TPA", shift: 10 },
  { time: "11:05 am", patient: "Sujatha V. (+91 94470 •••••)", task: "Clinical Follow-Up", assignee: "Care Team", avatar: 4, href: "/actions?view=follow-up" },
];

const AI_CALLS_HOURLY = [26, 37, 22, 29, 37, 16, 22, 43, 37, 50, 61];

export default function OverviewPage() {
  const { showToast } = useToast();
  const [range, setRange] = React.useState("Today");
  const [data, setData] = React.useState<OverviewDashboardData | null>(null);

          const fetchOverview = React.useCallback(
            (rangeValue: string) => {
              let alive = true;
              overviewService
                .getOverviewData(rangeValue)
                .then((result) => {
                  if (alive) setData(result);
                })
                .catch((err: unknown) => {
                  if (!alive) return;
                  showToast({
                    type: "error",
                    title: "Failed to load dashboard",
                    message: err instanceof Error ? err.message : "Could not load overview data.",
                  });
                });
    return () => {
      alive = false;
    };
  },
    [showToast]
  );

  React.useEffect(() => {
    return fetchOverview(range);
  }, [fetchOverview, range]);

  const m = data?.metrics ?? DESIGN_DEFAULTS;
  const dropped = Math.max(0, m.callsOffered - m.callsAnswered);
  const aiHandlingRate = m.callsOffered > 0 ? Math.round((m.callsCompleted / m.callsOffered) * 100) : 84;

  const bars: ActionBar[] = data?.actionDistribution?.length
    ? data.actionDistribution.slice(0, 5).map((a, i) => ({
      label: ACTION_LABELS[a.actionType] ?? [a.actionLabel, ""],
      value: a.count,
      color: ACTION_COLORS[i % ACTION_COLORS.length],
    }))
    : DESIGN_ACTION_BARS;

  return (
      <DashboardLayout
        selectedDateRange={range}
        onDateRangeChange={setRange}
        onRefresh={() => fetchOverview(range)}
      >
        {/* ================================================================= */}
        {/* DESKTOP VIEW (>=1024px): Authentic Scaled Figma Design Canvas     */}
        {/* ================================================================= */}
        <div className="hidden lg:flex w-full h-[calc(100vh-140px)] min-h-[660px] max-h-[780px] items-center justify-center overflow-hidden rounded-2xl bg-[#fffffb] shadow-xs border border-slate-200/80">
          <ScaledCanvas>
            <BackgroundGlows />

            {/* Column A: Top KPI tiles (non-duplicated) + call volume trend (anchored left) */}
            <CanvasGroup spread={0}>
              {/* Tile 1: Calls Offered to AI */}
              <KpiTile
                label={
                  <>
                    Calls Offered
                    <br />
                    to AI
                  </>
                }
                value={m.callsOffered}
                delta="12% Vs Yesterday"
                top={34}
                deltaTop={71}
                href="/calls"
                spark={{ variant: "up", x: 119, y: 17, h: 46, start: [117, 60], end: [193, 15] }}
              />

              {/* Tile 2: Transferred to Staff */}
              <KpiTile
                label="Transferred to Staff"
                value={m.transferredToStaff}
                delta="6% Vs Yesterday"
                top={136}
                deltaTop={71}
                href="/calls?status=TRANSFERRED"
                spark={{ variant: "down", x: 119, y: 31, h: 24, start: [117, 28], end: [195, 53] }}
              />

              {/* Tile 3: Required Follow Up */}
              <KpiTile
                label={
                  <>
                    Required
                    <br />
                    Follow up
                  </>
                }
                value={m.requiresFollowUp}
                delta="4% Vs Yesterday"
                top={240}
                deltaTop={72}
                href="/actions?view=follow-up"
                spark={{ variant: "up", x: 118, y: 20, h: 46, start: [116, 63], end: [192, 18] }}
              />

            {/* Tile 4: Appointments Booked (Verified against HMS) */}
            <KpiTile
              label={
                <>
                  Appointments
                  <br />
                  Booked (HMS)
                </>
              }
              value={m.appointmentsBooked}
              delta="8% Vs Yesterday"
              top={342}
              deltaTop={72}
              href="/actions?actionType=BOOK_APPOINTMENT"
              spark={{ variant: "up", x: 120, y: 18, h: 46, start: [118, 61], end: [194, 16] }}
            />

            {/* Call Volume Trend Card */}
            <CallVolumeCard offered={m.callsOffered} completed={m.callsCompleted} />
          </CanvasGroup>

          {/* Column B: Hero Title, Donut Ring & Illustration + Action Distribution */}
          <CanvasGroup spread={1 / 3}>
            <HeroTitle />
            <HeroRing
              total={m.callsOffered}
              completed={m.callsCompleted}
              transferred={m.transferredToStaff}
              dropped={dropped}
              completedPct={aiHandlingRate}
              transferredPct={Math.round((m.transferredToStaff / m.callsOffered) * 100) || 11}
              droppedPct={Math.round((dropped / m.callsOffered) * 100) || 5}
              totalDeltaPct={12}
            />
            <AssistantIllustration />
            <ActionDistributionCard bars={bars} />
          </CanvasGroup>

          {/* Column C: Status Pills, Mini Stats, Credit Usage */}
          <CanvasGroup spread={2 / 3}>
            <StatusPills range={range} onRangeChange={setRange} />
            <MiniStats
              appointmentsPct={Math.round((m.appointmentsBooked / m.callsOffered) * 100) || 25}
              growthPct={40}
              deltaVsYesterday={248}
              hourly={AI_CALLS_HOURLY}
            />
            <CreditUsageCard
              used={3750}
              total={5000}
              onAddCredits={() =>
                showToast({
                  type: "info",
                  title: "Add Smrko Voice Credits",
                  message: "Credit top-up is managed through your Smrko Voice institutional billing portal.",
                })
              }
            />
          </CanvasGroup>

          {/* Column D: Operational Alerts & Staff Attention Panel (anchored right) */}
          <CanvasGroup spread={1}>
            <AlertList items={ALERTS} />
            <StaffAttention tasks={STAFF_TASKS} />
          </CanvasGroup>
        </ScaledCanvas>
      </div>

      {/* ================================================================= */}
      {/* RESPONSIVE TABLET & MOBILE VIEW (<1024px)                        */}
      {/* ================================================================= */}
      <div className="lg:hidden space-y-5">
        {/* Mobile Header Banner */}
        <div className="rounded-2xl border border-slate-200 bg-linear-to-r from-blue-50/60 via-white to-indigo-50/60 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">AI Calling Overview</h2>
              <p className="text-xs text-slate-500">
                Live performance for Daya General Hospital, Thrissur
              </p>
            </div>
            <Badge variant="teal" size="sm">
              AI Active
            </Badge>
          </div>
        </div>

        {/* Primary KPI Grid (6 Non-duplicated KPIs) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card className="border-slate-200 shadow-2xs">
            <CardContent className="p-3.5 space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Offered to AI
              </span>
              <div className="text-xl font-bold text-slate-900">{m.callsOffered}</div>
              <div className="text-[10px] text-emerald-600 font-medium">+12% vs yesterday</div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-2xs">
            <CardContent className="p-3.5 space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                AI Completed
              </span>
              <div className="text-xl font-bold text-[#0C5DB8]">{m.callsCompleted}</div>
              <div className="text-[10px] text-emerald-600 font-medium">{aiHandlingRate}% handled</div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-2xs">
            <CardContent className="p-3.5 space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Staff Transferred
              </span>
              <div className="text-xl font-bold text-amber-600">{m.transferredToStaff}</div>
              <div className="text-[10px] text-slate-500 font-medium">IVR rollover fallback</div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-2xs">
            <CardContent className="p-3.5 space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Booked (HMS)
              </span>
              <div className="text-xl font-bold text-[#18A99D]">{m.appointmentsBooked}</div>
              <div className="text-[10px] text-emerald-600 font-medium">Verified slots</div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-2xs">
            <CardContent className="p-3.5 space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Follow-Ups
              </span>
              <div className="text-xl font-bold text-rose-600">{m.requiresFollowUp}</div>
              <div className="text-[10px] text-rose-500 font-medium">Pending callback</div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-2xs">
            <CardContent className="p-3.5 space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Dropped / Busy
              </span>
              <div className="text-xl font-bold text-slate-700">{dropped}</div>
              <div className="text-[10px] text-slate-400 font-medium">Eliminated ~200/day</div>
            </CardContent>
          </Card>
        </div>

        {/* Requires Staff Attention Card (Mobile/Tablet) */}
        <Card className="border-slate-200 shadow-2xs">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span>Requires Staff Attention</span>
              </CardTitle>
              <Link
                href="/actions?view=follow-up"
                className="text-xs font-semibold text-[#0C5DB8] hover:underline"
              >
                View all ({STAFF_TASKS.length})
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2.5">
            {STAFF_TASKS.map((t, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/70 text-xs"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="font-semibold text-slate-800 truncate">{t.patient}</div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <span>{t.time}</span>
                    <span>•</span>
                    <span className="text-[#866be3] font-medium">{t.task}</span>
                  </div>
                </div>
                <Link
                  href={t.href}
                  className="rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-xs font-semibold text-[#0C5DB8] hover:bg-blue-50 transition-colors shrink-0"
                >
                  Review
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* AI Action Distribution (Mobile/Tablet) */}
        <Card className="border-slate-200 shadow-2xs">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-bold text-slate-900">
              AI Action Distribution
            </CardTitle>
            <CardDescription className="text-xs">
              HMS actions executed during inbound patient calls
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-2.5">
            {bars.map((b, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-slate-700">{b.label.join(" ")}</span>
                  <span className="font-bold text-slate-900">{b.value}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, (b.value / 450) * 100)}%`,
                      backgroundColor: b.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
