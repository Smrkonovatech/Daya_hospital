import { prisma, checkDatabaseConnection } from "@/lib/db/prisma";
import { HospitalSettings } from "@/lib/services/settings-service";

export interface AuditLogItem {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  performedBy: string;
  userId?: string;
  ipAddress?: string;
  details?: string;
  timestamp: string;
}

export interface WebhookRecord {
  id: string;
  provider: string;
  eventType: string;
  externalEventId?: string;
  idempotencyKey?: string;
  payloadHash: string;
  status: "RECEIVED" | "PROCESSED" | "FAILED" | "DUPLICATE";
  retryCount: number;
  errorMessage?: string;
  processedAt?: string;
  createdAt: string;
}

// In-memory fallback stores
const inMemoryAuditLogs: AuditLogItem[] = [
  {
    id: "aud_01",
    entityType: "SYSTEM",
    entityId: "daya_init",
    action: "SYSTEM_INITIALIZED",
    performedBy: "Dr. Anjali Menon",
    ipAddress: "127.0.0.1",
    details: "Daya Hospital AI calling dashboard initialized in demonstration mode.",
    timestamp: "2026-10-27T08:00:00+05:30",
  },
  {
    id: "aud_02",
    entityType: "AUTH",
    entityId: "usr_admin",
    action: "LOGIN",
    performedBy: "Dr. Anjali Menon",
    ipAddress: "127.0.0.1",
    details: "Hospital Administrator logged into operations dashboard.",
    timestamp: "2026-10-27T08:30:00+05:30",
  },
];

const inMemoryWebhooks: WebhookRecord[] = [];

class SystemRepository {
  /**
   * Records an audit log entry.
   */
  async recordAuditLog(item: {
    entityType: string;
    entityId: string;
    action: string;
    performedBy: string;
    userId?: string;
    ipAddress?: string;
    details?: string;
  }): Promise<AuditLogItem> {
    const nowIso = new Date().toISOString();
    const entry: AuditLogItem = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: nowIso,
      ...item,
    };

    const dbStatus = await checkDatabaseConnection();
    if (dbStatus.connected) {
      try {
        const created = await prisma.auditLog.create({
          data: {
            entityType: item.entityType,
            entityId: item.entityId,
            action: item.action,
            performedBy: item.performedBy,
            userId: item.userId,
            ipAddress: item.ipAddress,
            details: item.details,
          },
        });
        entry.id = created.id;
        entry.timestamp = created.timestamp.toISOString();
      } catch (err) {
        console.warn("DB recordAuditLog failed:", err);
      }
    }

    inMemoryAuditLogs.unshift(entry);
    return entry;
  }

  /**
   * Retrieves latest audit logs.
   */
  async getAuditLogs(limit = 50): Promise<AuditLogItem[]> {
    const dbStatus = await checkDatabaseConnection();
    if (dbStatus.connected) {
      try {
        const rows = await prisma.auditLog.findMany({
          take: limit,
          orderBy: { timestamp: "desc" },
        });
        return rows.map((r) => ({
          id: r.id,
          entityType: r.entityType,
          entityId: r.entityId,
          action: r.action,
          performedBy: r.performedBy,
          userId: r.userId || undefined,
          ipAddress: r.ipAddress || undefined,
          details: r.details || undefined,
          timestamp: r.timestamp.toISOString(),
        }));
      } catch (err) {
        console.warn("DB getAuditLogs failed:", err);
      }
    }

    return inMemoryAuditLogs.slice(0, limit);
  }

  /**
   * Records a webhook processing attempt with idempotency tracking.
   */
  async recordWebhook(data: {
    provider: string;
    eventType: string;
    externalEventId?: string;
    idempotencyKey?: string;
    payloadHash: string;
    status: "RECEIVED" | "PROCESSED" | "FAILED" | "DUPLICATE";
    errorMessage?: string;
  }): Promise<WebhookRecord> {
    const nowIso = new Date().toISOString();
    const record: WebhookRecord = {
      id: `whk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      provider: data.provider,
      eventType: data.eventType,
      externalEventId: data.externalEventId,
      idempotencyKey: data.idempotencyKey,
      payloadHash: data.payloadHash,
      status: data.status,
      retryCount: 0,
      errorMessage: data.errorMessage,
      processedAt: data.status === "PROCESSED" ? nowIso : undefined,
      createdAt: nowIso,
    };

    const dbStatus = await checkDatabaseConnection();
    if (dbStatus.connected) {
      try {
        const row = await prisma.webhookProcessingRecord.create({
          data: {
            provider: data.provider,
            eventType: data.eventType,
            externalEventId: data.externalEventId,
            idempotencyKey: data.idempotencyKey,
            payloadHash: data.payloadHash,
            status: data.status,
            errorMessage: data.errorMessage,
            processedAt: data.status === "PROCESSED" ? new Date() : null,
          },
        });
        record.id = row.id;
      } catch (err) {
        console.warn("DB recordWebhook failed:", err);
      }
    }

    inMemoryWebhooks.unshift(record);
    return record;
  }

  /**
   * Checks if a webhook with the given idempotencyKey was already processed.
   */
  async getWebhookByIdempotency(
    key: string
  ): Promise<WebhookRecord | null> {
    const dbStatus = await checkDatabaseConnection();
    if (dbStatus.connected) {
      try {
        const row = await prisma.webhookProcessingRecord.findUnique({
          where: { idempotencyKey: key },
        });
        if (row) {
          return {
            id: row.id,
            provider: row.provider,
            eventType: row.eventType,
            externalEventId: row.externalEventId || undefined,
            idempotencyKey: row.idempotencyKey || undefined,
            payloadHash: row.payloadHash,
            status: row.status as WebhookRecord["status"],
            retryCount: row.retryCount,
            errorMessage: row.errorMessage || undefined,
            processedAt: row.processedAt?.toISOString(),
            createdAt: row.createdAt.toISOString(),
          };
        }
      } catch (err) {
        console.warn("DB getWebhookByIdempotency failed:", err);
      }
    }

    const found = inMemoryWebhooks.find((w) => w.idempotencyKey === key);
    return found ? { ...found } : null;
  }

  /**
   * Checks if a webhook with the given externalEventId was already processed.
   */
  async getWebhookByEventId(
    eventId: string
  ): Promise<WebhookRecord | null> {
    const dbStatus = await checkDatabaseConnection();
    if (dbStatus.connected) {
      try {
        const row = await prisma.webhookProcessingRecord.findUnique({
          where: { externalEventId: eventId },
        });
        if (row) {
          return {
            id: row.id,
            provider: row.provider,
            eventType: row.eventType,
            externalEventId: row.externalEventId || undefined,
            idempotencyKey: row.idempotencyKey || undefined,
            payloadHash: row.payloadHash,
            status: row.status as WebhookRecord["status"],
            retryCount: row.retryCount,
            errorMessage: row.errorMessage || undefined,
            processedAt: row.processedAt?.toISOString(),
            createdAt: row.createdAt.toISOString(),
          };
        }
      } catch (err) {
        console.warn("DB getWebhookByEventId failed:", err);
      }
    }

    const found = inMemoryWebhooks.find((w) => w.externalEventId === eventId);
    return found ? { ...found } : null;
  }

  /**
   * Clears in-memory webhooks for testing purposes.
   */
  clearInMemoryWebhooks(): void {
    inMemoryWebhooks.length = 0;
  }

  /**
   * Retrieves hospital settings from database or default fallback.
   */
  async getHospitalSettings(): Promise<HospitalSettings> {
    const defaultSettings: HospitalSettings = {
      retentionDays: "30",
      enableMalayalamConsent: true,
      strictMasking: true,
      defaultStaffRecordingAccess: false,
      missedCallThreshold: 30,
      urgentFollowUpAlerts: true,
      emergencyCasualtyAlerts: true,
      dailyDigestEmail: true,
      hmsTimeoutThresholdMs: 3000,
      lastUpdatedBy: "Initial Setup",
      updatedAt: "2026-10-27T08:00:00+05:30",
    };

    const dbStatus = await checkDatabaseConnection();
    if (dbStatus.connected) {
      try {
        const row = await prisma.hospitalSetting.findUnique({
          where: { id: "default_hospital_settings" },
        });
        if (row) {
          return {
            retentionDays: row.retentionDays as "15" | "30" | "60" | "90",
            enableMalayalamConsent: row.enableMalayalamConsent,
            strictMasking: row.strictMasking,
            defaultStaffRecordingAccess: row.defaultStaffRecordingAccess,
            missedCallThreshold: row.missedCallThreshold,
            urgentFollowUpAlerts: row.urgentFollowUpAlerts,
            emergencyCasualtyAlerts: row.emergencyCasualtyAlerts,
            dailyDigestEmail: row.dailyDigestEmail,
            hmsTimeoutThresholdMs: row.hmsTimeoutThresholdMs,
            lastUpdatedBy: row.lastUpdatedBy || "Initial Setup",
            updatedAt: row.updatedAt.toISOString(),
          };
        }
      } catch (err) {
        console.warn("DB getHospitalSettings failed:", err);
      }
    }

    return defaultSettings;
  }
}

export const systemRepository = new SystemRepository();
