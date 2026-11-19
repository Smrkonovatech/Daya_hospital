"use client";

import * as React from "react";
import { useToast } from "@/components/ui/toast";
import { CanvasGroup, SmrkomedShell } from "@/components/smrkomed/smrkomed-shell";
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

/** Figma values used until the service responds (and for widgets with no backing data yet). */
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
  { label: ["Book", "Appointment"], value: 300, color: ACTION_COLORS[0] },
  { label: ["Doctor Slot", "Search"], value: 450, color: ACTION_COLORS[1] },
  { label: ["Reschedule", "Appointment"], value: 100, color: ACTION_COLORS[2] },
  { label: ["Staff", "Transfer"], value: 150, color: ACTION_COLORS[3] },
  { label: ["Cancel", "Appointment"], value: 50, color: ACTION_COLORS[4] },
];

const ALERTS: AlertItem[] = [
  { label: "Clinical Escalations", count: 2, tone: "red", href: "/calls" },
  { label: "Reports Awaiting Review", count: 2, tone: "red", href: "/actions" },
  { label: "Care Loop Exceptions", count: 3, tone: "amber", href: "/actions" },
  { label: "Patient Questions", count: 2, tone: "green", href: "/calls" },
];

const STAFF_TASKS: StaffTask[] = [
  { time: "09:58 am", patient: "Biju Parakkal", task: "Appointment Booking", assignee: "Sister Mary", avatar: 1, href: "/calls" },
  { time: "09:58 am", patient: "Biju Parakkal", task: "Doctor Availability", assignee: "OPD Lead", avatar: 2, href: "/calls" },
  { time: "09:58 am", patient: "Ramesh kumar", task: "Insurance TPA", assignee: "TPA Desk", avatar: 3, href: "/calls", shift: 10 },
  { time: "09:58 am", patient: "Sujatha", task: "Follow-Up", assignee: "Care Team", avatar: 4, href: "/calls" },
];

const AI_CALLS_HOURLY = [26, 37, 22, 29, 37, 16, 22, 43, 37, 50, 61];

export default function OverviewPage() {
  const { showToast } = useToast();
  const [range, setRange] = React.useState("Today");
  const [data, setData] = React.useState<OverviewDashboardData | null>(null);

  React.useEffect(() => {
    let alive = true;
    overviewService
      .getOverviewData(range)
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
  }, [range, showToast]);

  const m = data?.metrics ?? DESIGN_DEFAULTS;
  const dropped = Math.max(0, m.callsOffered - m.callsAnswered);

  const bars: ActionBar[] = data?.actionDistribution?.length
    ? data.actionDistribution.slice(0, 5).map((a, i) => ({
        label: ACTION_LABELS[a.actionType] ?? [a.actionLabel, ""],
        value: a.count,
        color: ACTION_COLORS[i % ACTION_COLORS.length],
      }))
    : DESIGN_ACTION_BARS;

  return (
    <SmrkomedShell>
      <BackgroundGlows />

      {/* Column A: KPI tiles + call volume (anchored left) */}
      <CanvasGroup spread={0}>
      <KpiTile
        label="Appointments Booked"
        value={m.appointmentsBooked}
        delta="6% Vs Yesterday"
        top={34}
        deltaTop={71}
        href="/actions"
        spark={{ variant: "up", x: 119, y: 17, h: 46, start: [117, 60], end: [193, 15] }}
      />
      <KpiTile
        label="Transferred to Staff"
        value={m.transferredToStaff}
        delta="6% Vs Yesterday"
        top={136}
        deltaTop={71}
        href="/calls"
        spark={{ variant: "down", x: 119, y: 31, h: 24, start: [117, 28], end: [195, 53] }}
      />
      <KpiTile
        label={
          <>
            Required
            <br />
            Follow up
          </>
        }
        value={m.requiresFollowUp}
        delta="6% Vs Yesterday"
        top={240}
        deltaTop={72}
        href="/calls"
        spark={{ variant: "up", x: 118, y: 20, h: 46, start: [116, 63], end: [192, 18] }}
      />
      <KpiTile
        label="Appointments Booked"
        value={m.appointmentsBooked}
        delta="6% Vs Yesterday"
        top={342}
        deltaTop={72}
        href="/actions"
        spark={{ variant: "up", x: 120, y: 18, h: 46, start: [118, 61], end: [194, 16] }}
      />
      <CallVolumeCard offered={m.callsOffered} completed={m.callsCompleted} />
      </CanvasGroup>

      {/* Column B: hero + action distribution */}
      <CanvasGroup spread={1 / 3}>
      <HeroTitle />
      <HeroRing
        total={m.callsOffered}
        completed={m.callsCompleted}
        transferred={m.transferredToStaff}
        dropped={dropped}
        completedPct={34}
        transferredPct={5}
        droppedPct={6}
        totalDeltaPct={12}
      />
      <AssistantIllustration />
      <ActionDistributionCard bars={bars} />
      </CanvasGroup>

      {/* Column C: status pills, mini stats, credit usage */}
      <CanvasGroup spread={2 / 3}>
      <StatusPills range={range} onRangeChange={setRange} />
      <MiniStats appointmentsPct={12} growthPct={40} deltaVsYesterday={248} hourly={AI_CALLS_HOURLY} />
      <CreditUsageCard
        used={3750}
        total={5000}
        onAddCredits={() =>
          showToast({ type: "info", title: "Add Credits", message: "Credit top-up will be available once billing is connected." })
        }
      />
      </CanvasGroup>

      {/* Column D: alerts + staff attention (anchored right) */}
      <CanvasGroup spread={1}>
        <AlertList items={ALERTS} />
        <StaffAttention tasks={STAFF_TASKS} />
      </CanvasGroup>
    </SmrkomedShell>
  );
}
