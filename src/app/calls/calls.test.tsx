import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import * as React from "react";
import CallHistoryPage from "./page";
import { ToastProvider } from "@/components/ui/toast";

const { mockCallsList } = vi.hoisted(() => {
  return {
    mockCallsList: [
      {
        id: "call_901",
        externalCallId: "sarvam_sess_084f1a",
        callerNumber: "+919846018392",
        callerName: "Krishnan Namboothiri",
        startTime: "2026-10-27T10:45:10+05:30",
        endTime: "2026-10-27T10:47:32+05:30",
        durationSeconds: 142,
        callStatus: "ANSWERED",
        callSource: "IVR_ROLLOVER",
        language: "MALAYALAM",
        intentCategory: "APPOINTMENT_BOOKING",
        aiSummary: "Caller booked an OPD consultation for Dr. Suresh Kumar.",
        aiConfidence: 0.98,
        requiresFollowUp: false,
        followUpStatus: "NOT_REQUIRED",
        hmsTransactionRef: "DAYA-HMS-OPD-78219",
        actions: [
          {
            id: "act_101",
            type: "BOOK_APPOINTMENT",
            status: "CONFIRMED",
            description: "Confirmed OPD Token #14 with HMS",
            timestamp: "2026-10-27T10:46:50+05:30",
          },
        ],
        transcript: [],
        recordingUrl: "/api/calls/call_901/recording",
      },
    ],
  };
});

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/calls",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock callsService at import time
vi.mock("@/lib/services/calls-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/calls-service")>();
  return {
    ...actual,
    callsService: {
      ...actual.callsService,
      getCalls: vi.fn().mockImplementation(async () => ({
        calls: mockCallsList,
        totalCount: 1,
        page: 1,
        limit: 8,
        totalPages: 1,
      })),
      generateCSV: actual.callsService.generateCSV,
    },
  };
});

describe("CallHistoryPage (Phase 3)", () => {
  it("renders Call History page, search bar, filters, export button and 9 table columns", async () => {
    render(
      <ToastProvider>
        <CallHistoryPage />
      </ToastProvider>
    );

    // 1. Header & Actions
    expect(
      screen.getByText("Call History & Detailed Interaction Logs")
    ).toBeInTheDocument();
    expect(screen.getByText("Export CSV")).toBeInTheDocument();
    expect(screen.getByText("Reveal Numbers (Audit)")).toBeInTheDocument();

    // 2. Filters & Search Bar
    expect(
      screen.getByPlaceholderText(
        "Search by Call ID, phone (+91...), patient name, or keyword..."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Date Range")).toBeInTheDocument();
    expect(screen.getByText("Intent Category")).toBeInTheDocument();
    expect(screen.getAllByText("Language").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Action Taken").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Follow-up Status")).toBeInTheDocument();
    expect(screen.getAllByText("Duration").length).toBeGreaterThanOrEqual(1);

    // Wait for calls table to populate
    await waitFor(() => {
      // 3. Check 9 Required Table Columns
      expect(screen.getByText("Call Time")).toBeInTheDocument();
      expect(screen.getByText("Caller")).toBeInTheDocument();
      expect(screen.getAllByText("Duration").length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText("Language").length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText("Primary Intent")).toBeInTheDocument();
      expect(screen.getByText("AI-Generated Summary")).toBeInTheDocument();
      expect(screen.getAllByText("Action Taken").length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText("Status")).toBeInTheDocument();
      expect(screen.getByText("Follow-Up")).toBeInTheDocument();

      // 4. Check data rows loaded
      expect(screen.getByText("call_901", { exact: false })).toBeInTheDocument();
      expect(screen.getAllByText("Details").length).toBeGreaterThan(0);
    });
  });
});
