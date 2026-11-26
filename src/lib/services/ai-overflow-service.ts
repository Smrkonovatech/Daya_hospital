/**
 * ============================================================================
 * SMRKOMED AI OVERFLOW SERVICE (PHASE B)
 * ============================================================================
 *
 * Implements seamless overflow from human receptionist to Sarvam Core AI when:
 * 1. Receptionist is busy (on another call or wrap-up).
 * 2. Receptionist does not answer within the configured ring timeout.
 * 3. Receptionist is offline, on break, or unconfigured.
 *
 * Responsibilities:
 * - Dynamic routing decision evaluation (human first vs. AI overflow).
 * - Contextual Malayalam and English overflow greeting generation.
 * - Call context and tenant preservation.
 * - Durable audit logging and telemetry analytics of all overflow events.
 */

import { prisma, checkDatabaseConnection } from "@/lib/db/prisma";
import { AiOverflowReason } from "@prisma/client";

export type { AiOverflowReason };

export interface AiOverflowRecord {
  id: string;
  hospitalId: string;
  callSid: string;
  callerNumber: string;
  dialedNumber?: string | null;
  reason: AiOverflowReason;
  targetStaffUserId?: string | null;
  targetStaffName?: string | null;
  ringDurationSeconds?: number | null;
  handledByAi: boolean;
  context?: Record<string, unknown> | null;
  timestamp: Date;
}

export interface AiOverflowAnalytics {
  hospitalId: string;
  totalOverflows: number;
  byReason: Record<AiOverflowReason, number>;
  averageRingDurationSeconds: number;
  recentEvents: AiOverflowRecord[];
}

export class AiOverflowService {
  // In-memory fallback store for sandbox / unit tests / resilient failover
  private inMemoryOverflows: AiOverflowRecord[] = [];

  /**
   * Resets the in-memory store for unit test isolation.
   */
  public resetForTest(): void {
    this.inMemoryOverflows = [];
  }

  /**
   * Persists an AI overflow event with fallback to memory.
   */
  public async recordOverflow(params: {
    hospitalId: string;
    callSid: string;
    callerNumber: string;
    dialedNumber?: string;
    reason: AiOverflowReason;
    targetStaffUserId?: string;
    targetStaffName?: string;
    ringDurationSeconds?: number;
    handledByAi?: boolean;
    context?: Record<string, unknown>;
    timestamp?: Date;
  }): Promise<AiOverflowRecord> {
    const {
      hospitalId,
      callSid,
      callerNumber,
      dialedNumber,
      reason,
      targetStaffUserId,
      targetStaffName,
      ringDurationSeconds,
      handledByAi = true,
      context,
      timestamp = new Date(),
    } = params;

    const dbStatus = await checkDatabaseConnection();
    if (dbStatus.connected) {
      try {
        const record = await prisma.aiOverflowLog.create({
          data: {
            id: `ovf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            hospitalId,
            callSid,
            callerNumber,
            dialedNumber: dialedNumber || null,
            reason,
            targetStaffUserId: targetStaffUserId || null,
            targetStaffName: targetStaffName || null,
            ringDurationSeconds: ringDurationSeconds || null,
            handledByAi,
            context: (context as any) || undefined,
            timestamp,
          },
        });
        return {
          id: record.id,
          hospitalId: record.hospitalId,
          callSid: record.callSid,
          callerNumber: record.callerNumber,
          dialedNumber: record.dialedNumber,
          reason: record.reason,
          targetStaffUserId: record.targetStaffUserId,
          targetStaffName: record.targetStaffName,
          ringDurationSeconds: record.ringDurationSeconds,
          handledByAi: record.handledByAi,
          context: record.context as Record<string, unknown> | null,
          timestamp: record.timestamp,
        };
      } catch (err) {
        console.warn("[AiOverflowService] DB create failed; recording in memory:", err);
      }
    }

    const memoryRecord: AiOverflowRecord = {
      id: `ovf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      hospitalId,
      callSid,
      callerNumber,
      dialedNumber: dialedNumber || null,
      reason,
      targetStaffUserId: targetStaffUserId || null,
      targetStaffName: targetStaffName || null,
      ringDurationSeconds: ringDurationSeconds || null,
      handledByAi,
      context: context || null,
      timestamp,
    };

    this.inMemoryOverflows.push(memoryRecord);
    return { ...memoryRecord };
  }

  /**
   * Retrieves an overflow record by CallSid.
   */
  public async getOverflowByCallSid(callSid: string): Promise<AiOverflowRecord | null> {
    const dbStatus = await checkDatabaseConnection();
    if (dbStatus.connected) {
      try {
        const record = await prisma.aiOverflowLog.findFirst({
          where: { callSid },
          orderBy: { timestamp: "desc" },
        });
        if (record) {
          return {
            id: record.id,
            hospitalId: record.hospitalId,
            callSid: record.callSid,
            callerNumber: record.callerNumber,
            dialedNumber: record.dialedNumber,
            reason: record.reason,
            targetStaffUserId: record.targetStaffUserId,
            targetStaffName: record.targetStaffName,
            ringDurationSeconds: record.ringDurationSeconds,
            handledByAi: record.handledByAi,
            context: record.context as Record<string, unknown> | null,
            timestamp: record.timestamp,
          };
        }
      } catch (err) {
        console.warn("[AiOverflowService] DB findFirst failed; falling back to memory:", err);
      }
    }

    const match = [...this.inMemoryOverflows]
      .reverse()
      .find((r) => r.callSid === callSid);
    return match ? { ...match } : null;
  }

  /**
   * Retrieves recent overflow records for a hospital tenant.
   */
  public async getRecentOverflows(hospitalId: string, limit = 50): Promise<AiOverflowRecord[]> {
    const dbStatus = await checkDatabaseConnection();
    if (dbStatus.connected) {
      try {
        const records = await prisma.aiOverflowLog.findMany({
          where: { hospitalId },
          orderBy: { timestamp: "desc" },
          take: limit,
        });
        return records.map((r) => ({
          id: r.id,
          hospitalId: r.hospitalId,
          callSid: r.callSid,
          callerNumber: r.callerNumber,
          dialedNumber: r.dialedNumber,
          reason: r.reason,
          targetStaffUserId: r.targetStaffUserId,
          targetStaffName: r.targetStaffName,
          ringDurationSeconds: r.ringDurationSeconds,
          handledByAi: r.handledByAi,
          context: r.context as Record<string, unknown> | null,
          timestamp: r.timestamp,
        }));
      } catch (err) {
        console.warn("[AiOverflowService] DB findMany failed; falling back to memory:", err);
      }
    }

    return this.inMemoryOverflows
      .filter((r) => r.hospitalId === hospitalId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit)
      .map((r) => ({ ...r }));
  }

  /**
   * Calculates aggregate overflow telemetry and operational breakdown.
   */
  public async getOverflowAnalytics(hospitalId: string, timeWindowMs = 86400000): Promise<AiOverflowAnalytics> {
    const since = new Date(Date.now() - timeWindowMs);
    let events: AiOverflowRecord[] = [];

    const dbStatus = await checkDatabaseConnection();
    if (dbStatus.connected) {
      try {
        const records = await prisma.aiOverflowLog.findMany({
          where: {
            hospitalId,
            timestamp: { gte: since },
          },
          orderBy: { timestamp: "desc" },
        });
        events = records.map((r) => ({
          id: r.id,
          hospitalId: r.hospitalId,
          callSid: r.callSid,
          callerNumber: r.callerNumber,
          dialedNumber: r.dialedNumber,
          reason: r.reason,
          targetStaffUserId: r.targetStaffUserId,
          targetStaffName: r.targetStaffName,
          ringDurationSeconds: r.ringDurationSeconds,
          handledByAi: r.handledByAi,
          context: r.context as Record<string, unknown> | null,
          timestamp: r.timestamp,
        }));
      } catch {
        events = this.inMemoryOverflows.filter(
          (r) => r.hospitalId === hospitalId && r.timestamp.getTime() >= since.getTime()
        );
      }
    } else {
      events = this.inMemoryOverflows.filter(
        (r) => r.hospitalId === hospitalId && r.timestamp.getTime() >= since.getTime()
      );
    }

    const byReason: Record<AiOverflowReason, number> = {
      RECEPTIONIST_BUSY: 0,
      RING_TIMEOUT: 0,
      RECEPTIONIST_OFFLINE: 0,
      RECEPTIONIST_BREAK: 0,
      NO_STAFF_CONFIGURED: 0,
      CONCURRENCY_CONFLICT: 0,
      MANUAL_OVERFLOW: 0,
    };

    let totalRingDuration = 0;
    let timedOutCount = 0;

    for (const ev of events) {
      if (byReason[ev.reason] !== undefined) {
        byReason[ev.reason]++;
      }
      if (ev.ringDurationSeconds && ev.ringDurationSeconds > 0) {
        totalRingDuration += ev.ringDurationSeconds;
        timedOutCount++;
      }
    }

    const averageRingDurationSeconds = timedOutCount > 0 ? Math.round(totalRingDuration / timedOutCount) : 0;

    return {
      hospitalId,
      totalOverflows: events.length,
      byReason,
      averageRingDurationSeconds,
      recentEvents: events.slice(0, 20),
    };
  }

  /**
   * Generates a contextual Malayalam or English greeting based on the overflow reason.
   * Tailored for Sarvam Bulbul:v3 Malayalam TTS (Kavitha voice) and English (Ratan voice).
   */
  public getContextualGreeting(
    language = "ml-IN",
    reason?: string | AiOverflowReason,
    hospitalName = "ദയാ ജനറൽ ഹോസ്പിറ്റൽ"
  ): string {
    const normalizedReason = (reason || "RECEPTIONIST_BUSY").toUpperCase();
    const isMalayalam = language.startsWith("ml") || language === "MALAYALAM";

    if (isMalayalam) {
      switch (normalizedReason) {
        case "RECEPTIONIST_BUSY":
        case "ALL_BUSY":
          return `നമസ്കാരം, ${hospitalName}-ലേക്ക് സ്വാഗതം. നിലവിൽ ഞങ്ങളുടെ റിസപ്ഷനിസ്റ്റ് മറ്റ് കോളുകളിലാണ്. ഞാൻ താങ്കളെ സഹായിക്കാം. ഡോക്ടർ അപ്പോയിന്റ്മെന്റുകൾ എടുക്കുന്നതിനോ മറ്റ് അന്വേഷണങ്ങൾക്കോ എന്നോട് സംസാരിക്കാവുന്നതാണ്.`;

        case "RING_TIMEOUT":
        case "NO_ANSWER":
          return `നമസ്കാരം, ${hospitalName}-ലേക്ക് സ്വാഗതം. റിസപ്ഷൻ ഡെസ്കിൽ ഇപ്പോൾ പ്രതികരണമില്ലാത്തതിനാൽ കോൾ എനിക്ക് കൈമാറിയിരിക്കുന്നു. ഞാൻ താങ്കളെ സഹായിക്കാം. എന്ത് വിവരമാണ് അറിയേണ്ടത്?`;

        case "RECEPTIONIST_OFFLINE":
        case "ALL_OFFLINE":
        case "RECEPTIONIST_BREAK":
        case "ALL_ON_BREAK":
        case "NO_STAFF_CONFIGURED":
          return `നമസ്കാരം, ${hospitalName}-ലേക്ക് സ്വാഗതം. ഇപ്പോൾ റിസപ്ഷൻ ഡെസ്ക് ലഭ്യമല്ല. ഞങ്ങളുടെ എഐ അസിസ്റ്റന്റായ ഞാൻ താങ്കളെ സഹായിക്കാം. എന്ത് സഹായമാണ് വേണ്ടത്?`;

        default:
          return `നമസ്കാരം, ${hospitalName}-ലേക്ക് സ്വാഗതം. ഞാൻ താങ്കളെ സഹായിക്കാം. അപ്പോയിന്റ്മെന്റുകൾക്കും അന്വേഷണങ്ങൾക്കുമായി സംസാരിക്കാവുന്നതാണ്.`;
      }
    }

    // English Greetings
    const englishHospitalName = hospitalName.includes("ദയാ") ? "Daya General Hospital" : hospitalName;
    switch (normalizedReason) {
      case "RECEPTIONIST_BUSY":
      case "ALL_BUSY":
        return `Hello, welcome to ${englishHospitalName}. Our receptionist is currently attending to other calls. I can assist you right away with doctor appointments or hospital enquiries. How may I help you today?`;

      case "RING_TIMEOUT":
      case "NO_ANSWER":
        return `Hello, welcome to ${englishHospitalName}. The reception desk is currently busy and could not take your call. I am here to assist you. What can I do for you today?`;

      case "RECEPTIONIST_OFFLINE":
      case "ALL_OFFLINE":
      case "RECEPTIONIST_BREAK":
      case "ALL_ON_BREAK":
      case "NO_STAFF_CONFIGURED":
        return `Hello, welcome to ${englishHospitalName}. Our reception desk is currently unavailable. I am the hospital AI assistant and I am ready to help you with appointments and enquiries.`;

      default:
        return `Hello, welcome to ${englishHospitalName}. How may I help you today?`;
    }
  }
}

export const aiOverflowService = new AiOverflowService();
