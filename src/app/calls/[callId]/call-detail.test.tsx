import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import * as React from "react";
import CallDetailClient from "./call-detail-client";
import { ToastProvider } from "@/components/ui/toast";

const { mockCall } = vi.hoisted(() => {
  return {
    mockCall: {
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
          description: "Confirmed OPD Token #14 with HMS (Dr. Suresh Kumar)",
          hmsReference: "DAYA-HMS-OPD-78219",
          timestamp: "2026-10-27T10:46:50+05:30",
        },
      ],
      transcript: [
        {
          id: "t_1",
          speaker: "agent",
          speakerName: "Daya AI (Sarvam)",
          text: "Welcome to Daya General Hospital.",
          malayalamText: "ദയ ജനറൽ ഹോസ്പിറ്റലിലേക്ക് സ്വാഗതം.",
          timestampMs: 0,
        },
      ],
      recordingUrl: "/api/calls/call_901/recording",
      isReviewed: false,
      reviewHistory: [],
    },
  };
});

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useParams: () => ({ callId: "call_901" }),
  usePathname: () => "/calls/call_901",
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
      getCallById: vi.fn().mockImplementation(async (id: string) => {
        if (id === "call_901") return mockCall;
        return null;
      }),
      updateCallReview: vi.fn().mockImplementation(async (id: string, update: Record<string, unknown>) => {
        return { ...mockCall, ...update };
      }),
    },
  };
});

describe("CallDetailPage (Phase 3)", () => {
  it("renders all 6 call detail sections (A to F) accurately", async () => {
    render(
      <ToastProvider>
        <CallDetailClient callId="call_901" />
      </ToastProvider>
    );

    // Wait for async call data to load
    await waitFor(() => {
      // Header
      expect(screen.getByText("Call Details: call_901")).toBeInTheDocument();

      // Section A: Call information
      expect(screen.getByText("A. Call Information")).toBeInTheDocument();
      expect(screen.getAllByText("call_901").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("sarvam_sess_084f1a")).toBeInTheDocument();

      // Section B: AI conversation summary
      expect(screen.getByText("B. AI Conversation Summary")).toBeInTheDocument();
      expect(
        screen.getByText("Primary Intent & Patient Request:")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Assistant Actions & Information Provided:")
      ).toBeInTheDocument();
      expect(screen.getByText("Resolution Status:")).toBeInTheDocument();

      // Section C: Conversation transcript
      expect(screen.getByText("C. Conversation Transcript")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Search dialogue phrases...")
      ).toBeInTheDocument();
      expect(screen.getAllByText("Daya AI (Sarvam)").length).toBeGreaterThan(0);

      // Section D: Call audio recording
      expect(screen.getByText("D. Call Audio Recording")).toBeInTheDocument();

      // Section E: AI actions and HMS results
      expect(
        screen.getByText(
          "E. AI Actions & Hospital Management System (HMS) Results"
        )
      ).toBeInTheDocument();
      expect(screen.getAllByText("DAYA-HMS-OPD-78219").length).toBeGreaterThanOrEqual(1);

      // Section F: Staff clinical review & follow-up audit
      expect(
        screen.getByText("F. Staff Clinical Review & Follow-Up Audit")
      ).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText(
          "Add clinical observation, patient follow-up resolution, or token booking instructions..."
        )
      ).toBeInTheDocument();
      expect(screen.getByText("Save Internal Note")).toBeInTheDocument();
    });
  });
});
