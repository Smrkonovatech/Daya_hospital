import { describe, it, expect } from "vitest";
import { callsRepository } from "./calls-repository";

describe("CallsRepository & Database Service Layer (Phase 7)", () => {
  it("retrieves paginated call records with accurate metadata", async () => {
    const result = await callsRepository.getCalls({
      page: 1,
      limit: 4,
      sortBy: "startTime",
      sortOrder: "desc",
      dateRange: "ALL",
      status: "ALL",
      intent: "ALL",
      language: "ALL",
      actionType: "ALL",
      followUp: "ALL",
      durationRange: "ALL",
    });

    expect(result.calls.length).toBeLessThanOrEqual(4);
    expect(result.totalCount).toBeGreaterThan(0);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBeGreaterThanOrEqual(1);
    expect(result.calls[0].callerNumber).toBeDefined();
  });

  it("filters calls by intent category and status", async () => {
    const result = await callsRepository.getCalls({
      page: 1,
      limit: 10,
      intent: "APPOINTMENT_BOOKING",
      status: "ANSWERED",
      dateRange: "ALL",
      language: "ALL",
      actionType: "ALL",
      followUp: "ALL",
      durationRange: "ALL",
      sortBy: "startTime",
      sortOrder: "desc",
    });

    result.calls.forEach((c) => {
      expect(c.intentCategory).toBe("APPOINTMENT_BOOKING");
      expect(c.callStatus).toBe("ANSWERED");
    });
  });

  it("retrieves a call by its internal ID including transcripts and actions", async () => {
    const call = await callsRepository.getCallById("call_901");
    expect(call).not.toBeNull();
    expect(call?.id).toBe("call_901");
    expect(call?.externalCallId).toBe("sarvam_sess_084f1a");
    expect(call?.transcript).toBeDefined();
    expect(call?.transcript.length).toBeGreaterThan(0);
  });

  it("updates call review and follow-up status with audit history", async () => {
    const updated = await callsRepository.updateCallReview("call_901", {
      isReviewed: true,
      reviewerName: "Dr. Anjali Menon",
      reviewerId: "usr_admin",
      notes: "Audit verification complete for Malayalam audio.",
      requiresFollowUp: false,
      followUpStatus: "RESOLVED",
    });

    expect(updated).not.toBeNull();
    expect(updated?.isReviewed).toBe(true);
    expect(updated?.reviewedBy).toBe("Dr. Anjali Menon");
    expect(updated?.followUpStatus).toBe("RESOLVED");
    expect(updated?.reviewHistory?.some((h) => h.notes?.includes("Audit verification"))).toBe(true);
  });
});
