import { describe, it, expect } from "vitest";
import { systemRepository } from "./system-repository";

describe("SystemRepository & Audit Logging (Phase 7)", () => {
  it("records and retrieves audit log entries", async () => {
    const entry = await systemRepository.recordAuditLog({
      entityType: "CALL",
      entityId: "call_901",
      action: "REVIEW_COMPLETED",
      performedBy: "Dr. Anjali Menon",
      userId: "usr_admin",
      ipAddress: "127.0.0.1",
      details: "Clinical review verified against Sarvam voice recording.",
    });

    expect(entry.id).toBeDefined();
    expect(entry.action).toBe("REVIEW_COMPLETED");

    const logs = await systemRepository.getAuditLogs(10);
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.some((l) => l.id === entry.id)).toBe(true);
  });

  it("records webhooks and tracks idempotency keys", async () => {
    const idempotencyKey = `idem_test_${Date.now()}`;

    const record = await systemRepository.recordWebhook({
      provider: "sarvam",
      eventType: "call_ended",
      externalEventId: `evt_${Date.now()}`,
      idempotencyKey,
      payloadHash: "sha256_mock_hash",
      status: "PROCESSED",
    });

    expect(record.status).toBe("PROCESSED");
    expect(record.idempotencyKey).toBe(idempotencyKey);

    const lookup = await systemRepository.getWebhookByIdempotency(idempotencyKey);
    expect(lookup).not.toBeNull();
    expect(lookup?.payloadHash).toBe("sha256_mock_hash");
  });

  it("retrieves hospital privacy and alert settings", async () => {
    const settings = await systemRepository.getHospitalSettings();
    expect(settings).toBeDefined();
    expect(settings.retentionDays).toBeDefined();
    expect(settings.strictMasking).toBe(true);
    expect(settings.enableMalayalamConsent).toBe(true);
  });
});
