import { describe, it, expect } from "vitest";
import {
  callsQuerySchema,
  callReviewUpdateSchema,
  actionsQuerySchema,
  knowledgeQuerySchema,
} from "./query-schema";

describe("Backend Query Validation Schemas (Phase 7)", () => {
  it("validates and applies defaults for call list query parameters", () => {
    const parsed = callsQuerySchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.page).toBe(1);
      expect(parsed.data.limit).toBe(8);
      expect(parsed.data.sortBy).toBe("startTime");
      expect(parsed.data.sortOrder).toBe("desc");
      expect(parsed.data.status).toBe("ALL");
      expect(parsed.data.intent).toBe("ALL");
    }
  });

  it("coerces string numbers for page and limit", () => {
    const parsed = callsQuerySchema.safeParse({
      page: "3",
      limit: "15",
      status: "ANSWERED",
      intent: "APPOINTMENT_BOOKING",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.page).toBe(3);
      expect(parsed.data.limit).toBe(15);
      expect(parsed.data.status).toBe("ANSWERED");
      expect(parsed.data.intent).toBe("APPOINTMENT_BOOKING");
    }
  });

  it("rejects invalid page numbers or statuses", () => {
    const invalidPage = callsQuerySchema.safeParse({ page: 0 });
    expect(invalidPage.success).toBe(false);

    const invalidStatus = callsQuerySchema.safeParse({ status: "INVALID_STATUS" });
    expect(invalidStatus.success).toBe(false);
  });

  it("validates call review update payloads", () => {
    const valid = callReviewUpdateSchema.safeParse({
      isReviewed: true,
      notes: "Verified Malayalam patient details.",
      requiresFollowUp: false,
      followUpStatus: "RESOLVED",
    });
    expect(valid.success).toBe(true);

    const invalid = callReviewUpdateSchema.safeParse({
      followUpStatus: "NOT_AN_ENUM_VALUE",
    });
    expect(invalid.success).toBe(false);
  });

  it("validates actions query schema", () => {
    const parsed = actionsQuerySchema.safeParse({
      page: "2",
      limit: "10",
      status: "CONFIRMED",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.page).toBe(2);
      expect(parsed.data.status).toBe("CONFIRMED");
    }
  });

  it("validates knowledge query schema", () => {
    const parsed = knowledgeQuerySchema.safeParse({
      category: "CONSULTATION_FEES",
      status: "PUBLISHED",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.category).toBe("CONSULTATION_FEES");
      expect(parsed.data.status).toBe("PUBLISHED");
    }
  });
});
