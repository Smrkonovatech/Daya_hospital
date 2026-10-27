import { describe, it, expect, beforeEach } from "vitest";
import { actionsService } from "./actions-service";
import { ActionWebhookEvent } from "@/types";

describe("ActionsService (Phase 4)", () => {
  beforeEach(() => {
    actionsService.resetStore();
  });

  it("returns paginated AI actions with summary counts", async () => {
    const result = await actionsService.getActions({ page: 1, limit: 5 });

    expect(result.actions.length).toBeLessThanOrEqual(5);
    expect(result.totalCount).toBeGreaterThanOrEqual(10);
    expect(result.totalPages).toBeGreaterThanOrEqual(2);
    expect(result.summaryCounts.confirmed).toBeGreaterThan(0);
    expect(result.summaryCounts.requiresFollowUp).toBeGreaterThan(0);
  });

  it("filters actions by execution status", async () => {
    const confirmed = await actionsService.getActions({ status: "CONFIRMED" });
    expect(confirmed.actions.every((a) => a.status === "CONFIRMED")).toBe(true);

    const followUp = await actionsService.getActions({ status: "REQUIRES_STAFF_FOLLOW_UP" });
    expect(followUp.actions.every((a) => a.status === "REQUIRES_STAFF_FOLLOW_UP")).toBe(true);
  });

  it("filters actions for the staff follow-up queue", async () => {
    const queue = await actionsService.getActions({ onlyFollowUp: true });

    expect(queue.actions.length).toBeGreaterThan(0);
    expect(
      queue.actions.every(
        (a) =>
          a.status === "REQUIRES_STAFF_FOLLOW_UP" ||
          a.status === "FAILED" ||
          a.status === "PENDING_VERIFICATION" ||
          a.errorDetails?.followUpRequired === true
      )
    ).toBe(true);
  });

  it("filters actions by action category / type", async () => {
    const bookings = await actionsService.getActions({ actionType: "APPOINTMENT_BOOKING" });
    expect(
      bookings.actions.every(
        (a) => a.actionType === "APPOINTMENT_BOOKING" || a.category === "APPOINTMENT_BOOKING"
      )
    ).toBe(true);
  });

  it("searches actions across doctor name, HMS ref, and linked call ID", async () => {
    const byDoctor = await actionsService.getActions({ searchQuery: "Suresh Kumar" });
    expect(byDoctor.actions.length).toBeGreaterThan(0);
    expect(byDoctor.actions.some((a) => a.doctorName?.includes("Suresh Kumar"))).toBe(true);

    const byRef = await actionsService.getActions({ searchQuery: "DAYA-HMS-OPD-78219" });
    expect(byRef.actions.length).toBeGreaterThan(0);
    expect(byRef.actions[0].hmsBookingRef).toBe("DAYA-HMS-OPD-78219");

    const byCall = await actionsService.getActions({ searchQuery: "call_901" });
    expect(byCall.actions.length).toBeGreaterThan(0);
    expect(byCall.actions[0].callId).toBe("call_901");
  });

  it("allows staff to add internal review notes and assign follow-up", async () => {
    const updated = await actionsService.updateStaffReview("act_102", {
      reviewerName: "Sister Mary",
      reviewerId: "staff_mary",
      notes: "Contacted patient on alternative slot.",
      assignedStaff: "Sister Mary (Cardiology)",
      markReviewed: true,
    });

    expect(updated).not.toBeNull();
    expect(updated?.staffNotes).toBe("Contacted patient on alternative slot.");
    expect(updated?.assignedStaff).toBe("Sister Mary (Cardiology)");
    expect(updated?.isReviewed).toBe(true);
    expect(updated?.reviewHistory?.some((r) => r.action === "NOTE_ADDED")).toBe(true);
  });

  it("verifies booking with authoritative HMS adapter", async () => {
    // Valid HMS booking reference check
    const verifyResult = await actionsService.verifyWithHms("act_101", "Dr. Anjali Menon");
    expect(verifyResult.success).toBe(true);
    expect(verifyResult.action?.status).toBe("CONFIRMED");

    // Invalid action with no valid booking reference check
    const invalidResult = await actionsService.verifyWithHms("act_102", "Dr. Anjali Menon");
    expect(invalidResult.success).toBe(false);
    expect(invalidResult.message).toContain("No HMS Booking Reference");
  });

  it("consumes integration webhook events and enforces idempotency", async () => {
    const event: ActionWebhookEvent = {
      eventId: "evt_webhook_test_01",
      idempotencyKey: "idem_webhook_test_01",
      callId: "call_999",
      callerNumber: "+919846001122",
      callerName: "Kavitha Nair",
      actionType: "APPOINTMENT_BOOKING",
      timestamp: "2026-10-27T11:00:00+05:30",
      callerRequest: "Patient requested appointment with Dr. Jacob",
      aiAttempt: "AI reserved slot and confirmed with HMS",
      doctorName: "Dr. Jacob Pulikkal",
      department: "Gastroenterology",
      hmsResult: {
        status: "SUCCESS",
        bookingRef: "DAYA-HMS-OPD-88991",
        tokenNumber: 5,
        transactionId: "TXN-88991",
      },
    };

    // First ingestion: processed
    const firstIngest = await actionsService.consumeWebhookEvent(event);
    expect(firstIngest.success).toBe(true);
    expect(firstIngest.status).toBe("PROCESSED");
    expect(firstIngest.action.status).toBe("CONFIRMED");
    expect(firstIngest.action.hmsBookingRef).toBe("DAYA-HMS-OPD-88991");

    // Duplicate ingestion with same idempotency key: returns DUPLICATE without creating duplicate record
    const duplicateIngest = await actionsService.consumeWebhookEvent(event);
    expect(duplicateIngest.success).toBe(true);
    expect(duplicateIngest.status).toBe("DUPLICATE");
    expect(duplicateIngest.action.id).toBe(firstIngest.action.id);
  });

  it("falls back gracefully for unknown action types and missing fields", async () => {
    const malformedEvent: ActionWebhookEvent = {
      eventId: "evt_malformed_01",
      idempotencyKey: "idem_malformed_01",
      callId: "",
      callerNumber: "",
      actionType: "NON_EXISTENT_FUTURE_ACTION",
      timestamp: "",
    };

    const result = await actionsService.consumeWebhookEvent(malformedEvent);
    expect(result.success).toBe(true);
    expect(result.action.category).toBe("OTHER_ACTION");
    expect(result.action.callerNumber).toBe("+910000000000");
    expect(result.action.callId).toContain("call_orphan_");
  });

  it("generates privacy-masked RFC-4180 compliant CSV export", async () => {
    const { actions } = await actionsService.getActions({ limit: 3 });
    const csv = actionsService.generateCSV(actions, false);

    expect(csv).toContain('"Action ID","Timestamp (IST)"');
    expect(csv).toContain("•••••"); // Masked caller number
    expect(csv).toContain('"DAYA-HMS-OPD-78219"');
  });
});
