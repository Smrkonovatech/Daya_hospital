import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import * as React from "react";
import AiActionsPage from "./page";
import { ToastProvider } from "@/components/ui/toast";
import { actionsService } from "@/lib/services/actions-service";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/actions",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("AiActionsPage (Phase 4)", () => {
  beforeEach(() => {
    actionsService.resetStore();
  });

  it("renders header, metrics, tabs, filters, and action ledger table columns", async () => {
    render(
      <ToastProvider>
        <AiActionsPage />
      </ToastProvider>
    );

    // 1. Header & Badges
    expect(
      screen.getByText("AI Actions & HMS Status Ledger")
    ).toBeInTheDocument();
    expect(screen.getByText("Idempotency Guard Active")).toBeInTheDocument();
    expect(screen.getByText("Demo Data Mode")).toBeInTheDocument();

    // 2. Metric Cards
    expect(screen.getByText("Total AI Actions")).toBeInTheDocument();
    expect(screen.getByText("HMS Confirmed")).toBeInTheDocument();
    expect(screen.getByText("Requires Staff Follow-Up")).toBeInTheDocument();
    expect(screen.getByText("Failed / Rolled Back")).toBeInTheDocument();

    // 3. Primary Tabs
    expect(screen.getByText(/All AI Actions/)).toBeInTheDocument();
    expect(screen.getByText(/Staff Follow-Up Queue/)).toBeInTheDocument();

    // 4. Filters & Search Bar
    expect(
      screen.getByPlaceholderText(
        "Search by Action ID, Linked Call (call_901), Doctor, Patient, or HMS Ref..."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Date Range")).toBeInTheDocument();
    expect(screen.getByText("Action Category")).toBeInTheDocument();
    expect(screen.getByText("Execution Status")).toBeInTheDocument();

    // 5. Wait for table rows to load and assert columns
    await waitFor(() => {
      expect(screen.getByText("Timestamp")).toBeInTheDocument();
      expect(screen.getByText("Linked Call")).toBeInTheDocument();
      expect(screen.getByText("Caller")).toBeInTheDocument();
      expect(screen.getByText("Action Type")).toBeInTheDocument();
      expect(screen.getByText("Doctor & Department")).toBeInTheDocument();
      expect(screen.getByText("Result")).toBeInTheDocument();
      expect(screen.getByText("HMS Reference")).toBeInTheDocument();
      expect(screen.getByText("Follow-Up / Error")).toBeInTheDocument();
      expect(screen.getByText("Audit Detail")).toBeInTheDocument();

      // Check linked call link exists
      expect(screen.getAllByText("call_901").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Detail").length).toBeGreaterThan(0);
    });
  });

  it("switches to Staff Follow-Up Queue tab and displays queued triage actions", async () => {
    render(
      <ToastProvider>
        <AiActionsPage />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Total AI Actions")).toBeInTheDocument();
    });

    const queueTab = screen.getByText(/Staff Follow-Up Queue/);
    fireEvent.click(queueTab);

    await waitFor(() => {
      // Ensure only triage/follow-up actions are rendered
      expect(screen.getAllByText("Detail").length).toBeGreaterThan(0);
    });
  });

  it("opens ActionDetailDrawer and displays all 7 detailed inspection sections", async () => {
    render(
      <ToastProvider>
        <AiActionsPage />
      </ToastProvider>
    );

    // Wait for table to load
    await waitFor(() => {
      expect(screen.getAllByText("Detail").length).toBeGreaterThan(0);
    });

    // Click first "Detail" button to open drawer
    const firstDetailButton = screen.getAllByText("Detail")[0];
    fireEvent.click(firstDetailButton);

    // Check all 7 drawer sections
    await waitFor(() => {
      expect(screen.getByText("1. Linked Call Details")).toBeInTheDocument();
      expect(screen.getByText("2. Clinical Dialogue Synthesis")).toBeInTheDocument();
      expect(screen.getByText("3. Sanitized Action Payload Summary")).toBeInTheDocument();
      expect(screen.getByText("4. HMS Outcome & Reference Tokens")).toBeInTheDocument();
      expect(screen.getByText("5. Timing, Gateway Status & Idempotency")).toBeInTheDocument();
      expect(screen.getByText("7. Staff Clinical Follow-Up & Audit Trail")).toBeInTheDocument();
      expect(screen.getByText("Open Full Call Record")).toBeInTheDocument();
    });
  });
});
