import {
  CallRecord,
} from "@/types";
import { MOCK_CALL_RECORDS } from "@/lib/mock-data";

export type IntegrationStatusState =
  | "Connected"
  | "Degraded"
  | "Disconnected"
  | "Unknown"
  | "Demo";

export interface IntegrationServiceStatus {
  name: string;
  serviceKey: "sarvam" | "ivr" | "hms";
  state: IntegrationStatusState;
  latencyMs?: number;
  lastSync: string;
  notes: string;
  activeChannels?: string;
}

export interface OverviewMetricsSummary {
  callsOffered: number;
  callsAnswered: number;
  callsCompleted: number;
  appointmentsBooked: number;
  appointmentsRescheduled: number;
  appointmentsCancelled: number;
  transferredToStaff: number;
  requiresFollowUp: number;
}

export interface TimePointTrend {
  date: string;
  label: string;
  offered: number;
  answered: number;
  completed: number;
}

export interface OutcomeDistributionItem {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

export interface ActionDistributionItem {
  actionType: string;
  actionLabel: string;
  count: number;
  percentage: number;
  color: string;
}

export interface HourlyDistributionItem {
  hour: string;
  offered: number;
  handled: number;
  transferred: number;
}

export interface OverviewDashboardData {
  dateRange: string;
  freshnessTimestamp: string;
  isDemoData: boolean;
  metrics: OverviewMetricsSummary;
  volumeOverTime: TimePointTrend[];
  outcomeDistribution: OutcomeDistributionItem[];
  actionDistribution: ActionDistributionItem[];
  hourlyDistribution: HourlyDistributionItem[];
  recentCalls: CallRecord[];
  integrationStatus: {
    services: IntegrationServiceStatus[];
    lastSuccessfulSync: string;
    activeIncidents: string[];
    isMockSandbox: boolean;
  };
}

/**
 * Service Layer abstraction separating data retrieval from UI components.
 * In development, returns consistent date-sensitive demo data.
 * In production, this can be swapped with real PostgreSQL / Prisma queries without rewriting UI components.
 */
class OverviewService {
  async getOverviewData(
    dateRange: string = "Today",
    options?: { timestamp?: string }
  ): Promise<OverviewDashboardData> {
    // Simulate slight network / query latency
    await new Promise((res) => setTimeout(res, 200));

    const freshnessTimestamp =
      options?.timestamp || "Oct 27, 2026, 12:20 PM IST";

    // Dynamic multipliers based on date range selection
    const multipliers: Record<string, { factor: number; days: number }> = {
      Today: { factor: 1, days: 1 },
      Yesterday: { factor: 0.94, days: 1 },
      "Last 7 Days": { factor: 6.8, days: 7 },
      "Last 30 Days": { factor: 28.5, days: 30 },
    };

    const cfg = multipliers[dateRange] || multipliers["Today"];
    const baseOffered = Math.round(1248 * cfg.factor);
    const baseAnswered = Math.round(1184 * cfg.factor);
    const baseCompleted = Math.round(1042 * cfg.factor);
    const baseBooked = Math.round(312 * cfg.factor);
    const baseRescheduled = Math.round(84 * cfg.factor);
    const baseCancelled = Math.round(29 * cfg.factor);
    const baseTransferred = Math.round(142 * cfg.factor);
    const baseFollowUp = Math.round(38 * cfg.factor);

    // 1. Volume over time
    const volumeOverTime: TimePointTrend[] =
      dateRange === "Last 7 Days"
        ? [
            { date: "Oct 21", label: "Tue", offered: 1190, answered: 1120, completed: 980 },
            { date: "Oct 22", label: "Wed", offered: 1240, answered: 1180, completed: 1040 },
            { date: "Oct 23", label: "Thu", offered: 1210, answered: 1150, completed: 1010 },
            { date: "Oct 24", label: "Fri", offered: 1280, answered: 1210, completed: 1060 },
            { date: "Oct 25", label: "Sat", offered: 1310, answered: 1250, completed: 1100 },
            { date: "Oct 26", label: "Sun", offered: 890, answered: 850, completed: 780 },
            { date: "Oct 27", label: "Mon", offered: 1248, answered: 1184, completed: 1042 },
          ]
        : dateRange === "Last 30 Days"
        ? [
            { date: "Week 1", label: "W1", offered: 8200, answered: 7800, completed: 6900 },
            { date: "Week 2", label: "W2", offered: 8450, answered: 8050, completed: 7120 },
            { date: "Week 3", label: "W3", offered: 8600, answered: 8200, completed: 7250 },
            { date: "Week 4", label: "W4", offered: 8550, answered: 8100, completed: 7180 },
          ]
        : [
            { date: "08:00", label: "08:00", offered: 96, answered: 92, completed: 80 },
            { date: "10:00", label: "10:00", offered: 165, answered: 158, completed: 138 },
            { date: "12:00", label: "12:00", offered: 110, answered: 106, completed: 94 },
            { date: "14:00", label: "14:00", offered: 95, answered: 90, completed: 80 },
            { date: "16:00", label: "16:00", offered: 118, answered: 112, completed: 98 },
            { date: "18:00", label: "18:00", offered: 74, answered: 70, completed: 64 },
          ];

    // 2. Call outcome distribution
    const totalOutcomes = baseCompleted + baseTransferred + (baseOffered - baseAnswered);
    const outcomeDistribution: OutcomeDistributionItem[] = [
      {
        name: "Completed by AI",
        value: baseCompleted,
        percentage: Math.round((baseCompleted / totalOutcomes) * 100),
        color: "#18A99D", // Teal
      },
      {
        name: "Transferred to Staff",
        value: baseTransferred,
        percentage: Math.round((baseTransferred / totalOutcomes) * 100),
        color: "#F59E0B", // Amber
      },
      {
        name: "Missed / Dropped",
        value: baseOffered - baseAnswered,
        percentage: Math.round(((baseOffered - baseAnswered) / totalOutcomes) * 100),
        color: "#EF4444", // Rose
      },
      {
        name: "Requires Follow-up",
        value: baseFollowUp,
        percentage: Math.round((baseFollowUp / totalOutcomes) * 100),
        color: "#0C5DB8", // Hospital Blue
      },
    ];

    // 3. AI Action distribution
    const totalActions = baseBooked + baseRescheduled + baseCancelled + 412 + 184;
    const actionDistribution: ActionDistributionItem[] = [
      {
        actionType: "BOOK_APPOINTMENT",
        actionLabel: "Book Appointment",
        count: baseBooked,
        percentage: Math.round((baseBooked / totalActions) * 100),
        color: "#0C5DB8",
      },
      {
        actionType: "CHECK_DOCTOR_SLOT",
        actionLabel: "Doctor Slot Search",
        count: Math.round(412 * cfg.factor),
        percentage: Math.round(((412 * cfg.factor) / totalActions) * 100),
        color: "#18A99D",
      },
      {
        actionType: "RESCHEDULE_APPOINTMENT",
        actionLabel: "Reschedule Appointment",
        count: baseRescheduled,
        percentage: Math.round((baseRescheduled / totalActions) * 100),
        color: "#3B82F6",
      },
      {
        actionType: "TRANSFER_CALL_TO_STAFF",
        actionLabel: "Staff Transfer",
        count: baseTransferred,
        percentage: Math.round((baseTransferred / totalActions) * 100),
        color: "#F59E0B",
      },
      {
        actionType: "CANCEL_APPOINTMENT",
        actionLabel: "Cancel Appointment",
        count: baseCancelled,
        percentage: Math.round((baseCancelled / totalActions) * 100),
        color: "#64748B",
      },
    ];

    // 4. Hourly distribution across 24h
    const hourlyDistribution: HourlyDistributionItem[] = [
      { hour: "00:00", offered: 14, handled: 12, transferred: 2 },
      { hour: "02:00", offered: 8, handled: 7, transferred: 1 },
      { hour: "04:00", offered: 12, handled: 10, transferred: 2 },
      { hour: "06:00", offered: 32, handled: 28, transferred: 4 },
      { hour: "08:00", offered: 96, handled: 84, transferred: 12 },
      { hour: "09:00", offered: 148, handled: 130, transferred: 18 },
      { hour: "10:00", offered: 165, handled: 141, transferred: 24 },
      { hour: "11:00", offered: 152, handled: 132, transferred: 20 },
      { hour: "12:00", handled: 96, offered: 110, transferred: 14 },
      { hour: "13:00", offered: 82, handled: 74, transferred: 8 },
      { hour: "14:00", offered: 95, handled: 84, transferred: 11 },
      { hour: "15:00", offered: 105, handled: 92, transferred: 13 },
      { hour: "16:00", offered: 118, handled: 103, transferred: 15 },
      { hour: "17:00", offered: 98, handled: 89, transferred: 9 },
      { hour: "18:00", offered: 74, handled: 68, transferred: 6 },
      { hour: "20:00", offered: 52, handled: 48, transferred: 4 },
      { hour: "22:00", offered: 28, handled: 25, transferred: 3 },
    ];

    return {
      dateRange,
      freshnessTimestamp,
      isDemoData: true,
      metrics: {
        callsOffered: baseOffered,
        callsAnswered: baseAnswered,
        callsCompleted: baseCompleted,
        appointmentsBooked: baseBooked,
        appointmentsRescheduled: baseRescheduled,
        appointmentsCancelled: baseCancelled,
        transferredToStaff: baseTransferred,
        requiresFollowUp: baseFollowUp,
      },
      volumeOverTime,
      outcomeDistribution,
      actionDistribution,
      hourlyDistribution,
      recentCalls: MOCK_CALL_RECORDS,
      integrationStatus: {
        services: [
          {
            name: "Sarvam Voice Service",
            serviceKey: "sarvam",
            state: "Demo",
            latencyMs: 240,
            lastSync: "2 mins ago",
            notes: "Malayalam speech-to-speech sandbox adapter active",
          },
          {
            name: "IVR / Telephony Trunk",
            serviceKey: "ivr",
            state: "Demo",
            activeChannels: "18 / 30 active",
            lastSync: "Real-time",
            notes: "Hospital SIP trunk rollover simulation",
          },
          {
            name: "Daya HMS API",
            serviceKey: "hms",
            state: "Demo",
            latencyMs: 145,
            lastSync: "5 mins ago",
            notes: "OPD slot booking & token allocation sandbox",
          },
        ],
        lastSuccessfulSync: "Oct 27, 2026, 12:15 PM IST",
        activeIncidents: [],
        isMockSandbox: true,
      },
    };
  }
}

export const overviewService = new OverviewService();
