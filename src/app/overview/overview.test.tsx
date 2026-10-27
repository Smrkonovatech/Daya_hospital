import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import * as React from "react";
import OverviewPage from "./page";
import { ToastProvider } from "@/components/ui/toast";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/overview",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock overviewService to resolve immediately without artificial timer delay
vi.mock("@/lib/services/overview-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/overview-service")>();
  return {
    ...actual,
    overviewService: {
      getOverviewData: vi.fn().mockImplementation(async (range = "Today") => {
        return {
          dateRange: range,
          freshnessTimestamp: "Oct 27, 2026, 12:20 PM IST",
          isDemoData: true,
          metrics: {
            callsOffered: 1248,
            callsAnswered: 1184,
            callsCompleted: 1042,
            appointmentsBooked: 312,
            appointmentsRescheduled: 84,
            appointmentsCancelled: 29,
            transferredToStaff: 142,
            requiresFollowUp: 38,
          },
          volumeOverTime: [
            { date: "08:00", label: "08:00", offered: 96, answered: 92, completed: 80 },
          ],
          outcomeDistribution: [
            { name: "Completed by AI", value: 1042, percentage: 80, color: "#18A99D" },
          ],
          actionDistribution: [
            { actionType: "BOOK_APPOINTMENT", actionLabel: "Book Appointment", count: 312, percentage: 35, color: "#0C5DB8" },
          ],
          hourlyDistribution: [
            { hour: "10:00", offered: 165, handled: 141, transferred: 24 },
          ],
          recentCalls: [],
          integrationStatus: {
            services: [
              {
                name: "Sarvam Voice Service",
                serviceKey: "sarvam",
                state: "Demo",
                lastSync: "2 mins ago",
                notes: "Sandbox active",
              },
              {
                name: "IVR / Telephony Trunk",
                serviceKey: "ivr",
                state: "Demo",
                lastSync: "Real-time",
                notes: "Trunk active",
              },
              {
                name: "Daya HMS API",
                serviceKey: "hms",
                state: "Demo",
                lastSync: "5 mins ago",
                notes: "HMS sandbox",
              },
            ],
            lastSuccessfulSync: "Oct 27, 2026, 12:15 PM IST",
            activeIncidents: [],
            isMockSandbox: true,
          },
        };
      }),
    },
  };
});

describe("OverviewPage (Phase 2)", () => {
  it("renders page header, demo indicator, freshness, and all 8 metric cards", async () => {
    render(
      <ToastProvider>
        <OverviewPage />
      </ToastProvider>
    );

    // 1. Header & Subtitle
    expect(screen.getByText("Daya Hospital AI Calling")).toBeInTheDocument();
    expect(
      screen.getByText("Monitor AI calls, patient enquiries and appointment actions.")
    ).toBeInTheDocument();

    // Wait for overviewService to resolve and populate data
    await waitFor(() => {
      // 2. Demo data indicator
      expect(screen.getAllByText("Demo data").length).toBeGreaterThan(0);

      // 3. All 8 Metric Cards
      expect(screen.getByText("Calls Offered to AI")).toBeInTheDocument();
      expect(screen.getByText("Calls Answered by AI")).toBeInTheDocument();
      expect(screen.getByText("Calls Completed")).toBeInTheDocument();
      expect(screen.getByText("Appointments Booked")).toBeInTheDocument();
      expect(screen.getByText("Appointments Rescheduled")).toBeInTheDocument();
      expect(screen.getByText("Appointments Cancelled")).toBeInTheDocument();
      expect(screen.getByText("Transferred to Staff")).toBeInTheDocument();
      expect(screen.getByText("Requires Follow-Up")).toBeInTheDocument();

      // 4. Integration status panel
      expect(screen.getByText("Integration Gateways Status")).toBeInTheDocument();
      expect(screen.getByText("Sarvam Voice Service")).toBeInTheDocument();
      expect(screen.getByText("IVR / Telephony Trunk")).toBeInTheDocument();
      expect(screen.getByText("Daya HMS API")).toBeInTheDocument();

      // 5. Four Chart Titles
      expect(screen.getByText("AI Call Volume Over Time")).toBeInTheDocument();
      expect(screen.getByText("Call Outcome Distribution")).toBeInTheDocument();
      expect(screen.getByText("AI Action Distribution")).toBeInTheDocument();
      expect(screen.getByText("Hourly Call Distribution (24 Hours)")).toBeInTheDocument();

      // 6. Recent Calls Table
      expect(screen.getByText("Recent AI Inbound Calls")).toBeInTheDocument();
      expect(screen.getByText("View Full Call History")).toBeInTheDocument();
    });
  });
});
