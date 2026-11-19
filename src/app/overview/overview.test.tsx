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

describe("OverviewPage (SMRKOMED design)", () => {
  it("renders the SMRKOMED dashboard sections with service data", async () => {
    render(
      <ToastProvider>
        <OverviewPage />
      </ToastProvider>
    );

    // Hero + chrome
    expect(screen.getByText("Daya Hospital")).toBeInTheDocument();
    expect(screen.getByText("AI Calling operations")).toBeInTheDocument();
    expect(screen.getByText("Total Calls Received")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(screen.getByText("Patient Care")).toBeInTheDocument();

    await waitFor(() => {
      // Ring values from overviewService
      expect(screen.getAllByText("1248").length).toBeGreaterThan(0);
      expect(screen.getAllByText("1042").length).toBeGreaterThan(0);
      expect(screen.getAllByText("142").length).toBeGreaterThan(0);
      expect(screen.getByText("64")).toBeInTheDocument();

      // KPI tiles
      expect(screen.getAllByText("Appointments Booked").length).toBe(2);
      expect(screen.getByText("Transferred to Staff")).toBeInTheDocument();

      // Cards
      expect(screen.getByText("Call Volume Trend")).toBeInTheDocument();
      expect(screen.getByText("AI Action Distribution")).toBeInTheDocument();
      expect(screen.getByText("AI Credit Usage")).toBeInTheDocument();
      expect(screen.getByText("Requires Staff Attention")).toBeInTheDocument();
      expect(screen.getByText("Clinical Escalations")).toBeInTheDocument();
    });
  });
});
