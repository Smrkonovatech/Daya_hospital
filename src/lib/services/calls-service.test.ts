import { describe, it, expect } from "vitest";
import { callsService } from "./calls-service";

describe("CallsService (Phase 3)", () => {
  it("returns paginated calls with default sorting and limit", async () => {
    const result = await callsService.getCalls({ page: 1, limit: 5 });

    expect(result.calls.length).toBeLessThanOrEqual(5);
    expect(result.totalCount).toBeGreaterThan(5);
    expect(result.totalPages).toBeGreaterThan(1);
    expect(result.page).toBe(1);
  });

  it("filters calls accurately by call outcome status", async () => {
    const resultAnswered = await callsService.getCalls({ status: "ANSWERED" });
    expect(resultAnswered.calls.every((c) => c.callStatus === "ANSWERED")).toBe(true);

    const resultTransferred = await callsService.getCalls({ status: "TRANSFERRED" });
    expect(resultTransferred.calls.every((c) => c.callStatus === "TRANSFERRED")).toBe(true);
  });

  it("filters calls by intent category and language", async () => {
    const result = await callsService.getCalls({
      intent: "APPOINTMENT_BOOKING",
      language: "MALAYALAM",
    });

    expect(
      result.calls.every(
        (c) => c.intentCategory === "APPOINTMENT_BOOKING" && c.language === "MALAYALAM"
      )
    ).toBe(true);
  });

  it("filters calls by follow-up status", async () => {
    const resultFollowUp = await callsService.getCalls({ followUp: "YES" });
    expect(resultFollowUp.calls.every((c) => c.requiresFollowUp === true)).toBe(true);

    const resultNoFollowUp = await callsService.getCalls({ followUp: "NO" });
    expect(resultNoFollowUp.calls.every((c) => c.requiresFollowUp === false)).toBe(true);
  });

  it("filters calls by duration range", async () => {
    const resultShort = await callsService.getCalls({ durationRange: "LT_1M" });
    expect(resultShort.calls.every((c) => c.durationSeconds < 60)).toBe(true);
  });

  it("searches calls by ID or patient name", async () => {
    const result = await callsService.getCalls({ searchQuery: "call_901" });
    expect(result.calls.length).toBeGreaterThan(0);
    expect(result.calls[0].id).toBe("call_901");

    const resultName = await callsService.getCalls({ searchQuery: "Krishnan" });
    expect(resultName.calls.length).toBeGreaterThan(0);
    expect(resultName.calls[0].callerName).toContain("Krishnan");
  });

  it("retrieves a single call by ID and updates staff review audit trail", async () => {
    const call = await callsService.getCallById("call_901");
    expect(call).not.toBeNull();
    expect(call?.id).toBe("call_901");

    const updated = await callsService.updateCallReview("call_901", {
      isReviewed: true,
      reviewerName: "Dr. Anjali Menon",
      reviewerId: "usr_daya_01",
      notes: "Verified OPD booking token #14 with Daya reception.",
      requiresFollowUp: false,
    });

    expect(updated?.isReviewed).toBe(true);
    expect(updated?.reviewedBy).toBe("Dr. Anjali Menon");
    expect(updated?.followUpNotes).toBe("Verified OPD booking token #14 with Daya reception.");
    expect(updated?.reviewHistory?.length).toBeGreaterThan(0);
  });

  it("generates structured CSV with headers and escaped values", async () => {
    const { calls } = await callsService.getCalls({ limit: 3 });
    const csv = callsService.generateCSV(calls, false);

    expect(csv).toContain("Call ID");
    expect(csv).toContain("Caller Number");
    expect(csv).toContain("AI Summary");
    expect(csv).toContain("HMS Booking Reference");
    // Ensure numbers are masked in exported CSV when privacy masking is active
    expect(csv).toContain("•••••");
  });
});
