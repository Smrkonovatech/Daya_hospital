/**
 * ============================================================================
 * DURABLE CONCURRENCY & IDEMPOTENCY TEST SUITE (PHASE 2)
 * ============================================================================
 *
 * Tests for:
 * 1. Atomic idempotency reservation (first acquisition = true)
 * 2. Concurrent duplicate request handling (first = true, subsequent = false)
 * 3. Completion of reservation with response caching
 * 4. Token bucket rate limiting (allows up to threshold, blocks above)
 */

import { describe, it, expect } from "vitest";
import { durableConcurrencyService } from "./durable-concurrency";

describe("DurableConcurrencyService (Phase 2)", () => {
  const hospitalId = "hosp_daya_thrissur";

  it("grants first acquisition and blocks concurrent duplicate reservation", async () => {
    const key = `idem_test_${Date.now()}`;

    const first = await durableConcurrencyService.acquireIdempotencyReservation(
      hospitalId,
      key,
      "OUTBOUND_CALL"
    );
    expect(first.isFirstAcquisition).toBe(true);
    expect(first.status).toBe("PENDING");

    const second = await durableConcurrencyService.acquireIdempotencyReservation(
      hospitalId,
      key,
      "OUTBOUND_CALL"
    );
    expect(second.isFirstAcquisition).toBe(false);
  });

  it("caches and returns completed response on duplicate acquisition", async () => {
    const key = `idem_complete_${Date.now()}`;

    await durableConcurrencyService.acquireIdempotencyReservation(
      hospitalId,
      key,
      "OUTBOUND_CALL"
    );

    await durableConcurrencyService.completeIdempotencyReservation(hospitalId, key, {
      status: "COMPLETED",
      callSid: "exo_sid_12345",
      callId: "call_abc_999",
      responseJson: { success: true, callSid: "exo_sid_12345" },
    });

    const duplicate = await durableConcurrencyService.acquireIdempotencyReservation(
      hospitalId,
      key,
      "OUTBOUND_CALL"
    );

    expect(duplicate.isFirstAcquisition).toBe(false);
    expect(duplicate.status).toBe("COMPLETED");
    expect(duplicate.callSid).toBe("exo_sid_12345");
  });

  it("enforces token-bucket rate limits and blocks requests exceeding limit", async () => {
    const bucket = `test_bucket_${Date.now()}`;
    const limit = 3;

    // Call 1
    const r1 = await durableConcurrencyService.checkRateLimit(hospitalId, bucket, limit, 10);
    expect(r1.allowed).toBe(true);

    // Call 2
    const r2 = await durableConcurrencyService.checkRateLimit(hospitalId, bucket, limit, 10);
    expect(r2.allowed).toBe(true);

    // Call 3
    const r3 = await durableConcurrencyService.checkRateLimit(hospitalId, bucket, limit, 10);
    expect(r3.allowed).toBe(true);

    // Call 4 (exceeded)
    const r4 = await durableConcurrencyService.checkRateLimit(hospitalId, bucket, limit, 10);
    expect(r4.allowed).toBe(false);
    expect(r4.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("fails safely when requireDurable is true and shared PostgreSQL is unavailable", async () => {
    // When DB is not connected and requireDurable is strictly enforced
    const key = `idem_strict_${Date.now()}`;
    const result = await durableConcurrencyService.acquireIdempotencyReservation(
      hospitalId,
      key,
      "OUTBOUND_CALL",
      30,
      { requireDurable: true }
    );

    // In unit test environment without real DB, requireDurable must safely reject rather than fake durability
    expect(result.durable).toBe(false);
    expect(result.isFirstAcquisition).toBe(false);
    expect(result.status).toBe("FAILED");
    expect(result.error).toContain("DURABLE_STORAGE_UNAVAILABLE");
  });

  it("handles concurrent atomic requests across simulated multi-instance callers", async () => {
    const sharedKey = `idem_concurrent_${Date.now()}`;

    // Simulate 5 simultaneous requests from concurrent workers
    const promises = Array.from({ length: 5 }).map(() =>
      durableConcurrencyService.acquireIdempotencyReservation(
        hospitalId,
        sharedKey,
        "OUTBOUND_CALL",
        30,
        { requireDurable: false }
      )
    );

    const results = await Promise.all(promises);
    const firstAcquisitions = results.filter((r) => r.isFirstAcquisition);

    // Exactly 1 caller must acquire the reservation
    expect(firstAcquisitions.length).toBe(1);

    // The other 4 must be flagged as duplicates
    const duplicates = results.filter((r) => !r.isFirstAcquisition);
    expect(duplicates.length).toBe(4);
  });
});

