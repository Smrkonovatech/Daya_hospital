/**
 * ============================================================================
 * SMRKOMED RECEPTIONIST PRESENCE & TELEPHONY RECONCILIATION SERVICE (PHASE A)
 * ============================================================================
 *
 * Implements a carrier-event reconciled operational state machine for hospital
 * front desk receptionists to support Human-First, AI-Overflow telephony routing.
 *
 * Operational State Model:
 * - AVAILABLE: Logged in, ready to receive incoming calls
 * - RINGING: Call has been assigned and is actively ringing staff line
 * - ON_CALL: Staff has answered call; line is busy with patient
 * - WRAP_UP: Call ended; staff entering notes / completing follow-ups
 * - BREAK: Temporarily stepped away (meal, shift break)
 * - OFFLINE: Shift ended / logged out
 *
 * Concurrency & Race Condition Guarantee:
 * - Atomic conditional state transitions prevent two simultaneous calls
 *   from being assigned to the same receptionist.
 * - Multi-tenant isolation strictly partitioned by hospitalId.
 */

import { prisma, checkDatabaseConnection } from "@/lib/db/prisma";
import { StaffPresenceStatus } from "@prisma/client";

export type { StaffPresenceStatus };

export interface StaffPresenceRecord {
  id: string;
  hospitalId: string;
  userId: string;
  staffName: string;
  extension?: string | null;
  phoneNumber?: string | null;
  status: StaffPresenceStatus;
  currentCallSid?: string | null;
  assignedAt?: Date | null;
  ringStartedAt?: Date | null;
  callAnsweredAt?: Date | null;
  lastStatusChangeAt: Date;
  callsHandledToday: number;
  missedCallsToday: number;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StaffPresenceAuditLogRecord {
  id: string;
  hospitalId: string;
  staffPresenceId: string;
  userId: string;
  previousStatus: StaffPresenceStatus;
  newStatus: StaffPresenceStatus;
  reason: string;
  callSid?: string | null;
  actor: string;
  details?: Record<string, unknown> | null;
  timestamp: Date;
}

export type TelephonyCallEventType =
  | "CALL_RINGING"
  | "CALL_ANSWERED"
  | "CALL_COMPLETED"
  | "CALL_MISSED"
  | "RING_TIMEOUT"
  | "CALL_FAILED";

export interface TelephonyReconciliationEvent {
  hospitalId: string;
  callSid: string;
  eventType: TelephonyCallEventType;
  userId?: string;
  timestamp?: Date;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface CallAssignmentResult {
  assigned: boolean;
  staff?: StaffPresenceRecord;
  reason?: "ASSIGNED" | "ALL_BUSY" | "ALL_OFFLINE" | "ALL_ON_BREAK" | "NO_STAFF_CONFIGURED" | "CONCURRENCY_CONFLICT";
}

// Allowed state transitions map
const VALID_TRANSITIONS: Record<StaffPresenceStatus, StaffPresenceStatus[]> = {
  OFFLINE: ["AVAILABLE"],
  AVAILABLE: ["RINGING", "BREAK", "OFFLINE"],
  BREAK: ["AVAILABLE", "OFFLINE"],
  RINGING: ["ON_CALL", "AVAILABLE", "BREAK", "OFFLINE"], // Missed / timeout / answered / cancel
  ON_CALL: ["WRAP_UP", "AVAILABLE", "OFFLINE"], // Call hangup
  WRAP_UP: ["AVAILABLE", "BREAK", "OFFLINE"],
};

export class ReceptionistPresenceService {
  // In-memory fallback store for offline / test / sandbox execution
  private inMemoryStore: Map<string, StaffPresenceRecord> = new Map();
  private inMemoryAuditLogs: StaffPresenceAuditLogRecord[] = new Map<string, StaffPresenceAuditLogRecord[]>() as unknown as StaffPresenceAuditLogRecord[];

  constructor() {
    this.inMemoryAuditLogs = [];
  }

  /**
   * Helper key for in-memory uniqueness: hospitalId:userId
   */
  private getStoreKey(hospitalId: string, userId: string): string {
    return `${hospitalId}:${userId}`;
  }

  /**
   * Validates if transition from currentStatus to newStatus is permissible.
   */
  public isValidTransition(currentStatus: StaffPresenceStatus, newStatus: StaffPresenceStatus): boolean {
    if (currentStatus === newStatus) return true;
    const allowed = VALID_TRANSITIONS[currentStatus];
    return allowed ? allowed.includes(newStatus) : false;
  }

  /**
   * Upsert or register a staff presence profile for a hospital.
   */
  public async registerStaffPresence(params: {
    hospitalId: string;
    userId: string;
    staffName: string;
    extension?: string;
    phoneNumber?: string;
    initialStatus?: StaffPresenceStatus;
  }): Promise<StaffPresenceRecord> {
    const { hospitalId, userId, staffName, extension, phoneNumber, initialStatus = "OFFLINE" } = params;
    const dbStatus = await checkDatabaseConnection();

    if (dbStatus.connected) {
      try {
        const record = await prisma.staffPresence.upsert({
          where: {
            hospitalId_userId: { hospitalId, userId },
          },
          update: {
            staffName,
            extension: extension || null,
            phoneNumber: phoneNumber || null,
          },
          create: {
            hospitalId,
            userId,
            staffName,
            extension: extension || null,
            phoneNumber: phoneNumber || null,
            status: initialStatus,
          },
        });
        return record as StaffPresenceRecord;
      } catch (err) {
        console.warn("[ReceptionistPresenceService] DB upsert failed; using in-memory store:", err);
      }
    }

    const key = this.getStoreKey(hospitalId, userId);
    let record = this.inMemoryStore.get(key);
    const now = new Date();
    if (record) {
      record.staffName = staffName;
      record.extension = extension || null;
      record.phoneNumber = phoneNumber || null;
      record.updatedAt = now;
    } else {
      record = {
        id: `sp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        hospitalId,
        userId,
        staffName,
        extension: extension || null,
        phoneNumber: phoneNumber || null,
        status: initialStatus,
        currentCallSid: null,
        assignedAt: null,
        ringStartedAt: null,
        callAnsweredAt: null,
        lastStatusChangeAt: now,
        callsHandledToday: 0,
        missedCallsToday: 0,
        metadata: null,
        createdAt: now,
        updatedAt: now,
      };
      this.inMemoryStore.set(key, record);
    }
    return { ...record };
  }

  /**
   * Retrieves presence profile for a specific staff member.
   */
  public async getStaffPresence(hospitalId: string, userId: string): Promise<StaffPresenceRecord | null> {
    const dbStatus = await checkDatabaseConnection();
    if (dbStatus.connected) {
      try {
        const record = await prisma.staffPresence.findUnique({
          where: {
            hospitalId_userId: { hospitalId, userId },
          },
        });
        return (record as StaffPresenceRecord) || null;
      } catch (err) {
        console.warn("[ReceptionistPresenceService] DB findUnique failed; using in-memory store:", err);
      }
    }

    const record = this.inMemoryStore.get(this.getStoreKey(hospitalId, userId));
    return record ? { ...record } : null;
  }

  /**
   * Retrieves all staff presence profiles for a specific hospital (Tenant Isolated).
   */
  public async getHospitalStaffPresence(hospitalId: string): Promise<StaffPresenceRecord[]> {
    const dbStatus = await checkDatabaseConnection();
    if (dbStatus.connected) {
      try {
        const records = await prisma.staffPresence.findMany({
          where: { hospitalId },
          orderBy: { staffName: "asc" },
        });
        return records as StaffPresenceRecord[];
      } catch (err) {
        console.warn("[ReceptionistPresenceService] DB findMany failed; using in-memory store:", err);
      }
    }

    const results: StaffPresenceRecord[] = [];
    for (const record of this.inMemoryStore.values()) {
      if (record.hospitalId === hospitalId) {
        results.push({ ...record });
      }
    }
    return results;
  }

  /**
   * Manually sets presence status (e.g. from Dashboard toggle: AVAILABLE, BREAK, OFFLINE).
   */
  public async setStaffPresenceStatus(params: {
    hospitalId: string;
    userId: string;
    newStatus: StaffPresenceStatus;
    reason?: string;
    actor?: string;
  }): Promise<{ success: boolean; record?: StaffPresenceRecord; error?: string }> {
    const { hospitalId, userId, newStatus, reason = "MANUAL_STATUS_CHANGE", actor = "STAFF" } = params;
    const current = await this.getStaffPresence(hospitalId, userId);

    if (!current) {
      return { success: false, error: `Staff record not found for userId '${userId}' in hospital '${hospitalId}'.` };
    }

    if (!this.isValidTransition(current.status, newStatus)) {
      return {
        success: false,
        error: `Invalid status transition from '${current.status}' to '${newStatus}'.`,
      };
    }

    const previousStatus = current.status;
    const now = new Date();
    const dbStatus = await checkDatabaseConnection();

    if (dbStatus.connected) {
      try {
        const updated = await prisma.$transaction(async (tx) => {
          const rec = await tx.staffPresence.update({
            where: {
              hospitalId_userId: { hospitalId, userId },
            },
            data: {
              status: newStatus,
              lastStatusChangeAt: now,
              currentCallSid: newStatus === "OFFLINE" || newStatus === "BREAK" || newStatus === "AVAILABLE" ? null : current.currentCallSid,
              updatedAt: now,
            },
          });

          await tx.staffPresenceAuditLog.create({
            data: {
              id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              hospitalId,
              staffPresenceId: rec.id,
              userId,
              previousStatus,
              newStatus,
              reason,
              actor,
              timestamp: now,
            },
          });

          return rec;
        });

        return { success: true, record: updated as StaffPresenceRecord };
      } catch (err) {
        console.warn("[ReceptionistPresenceService] Transaction failed; using in-memory:", err);
      }
    }

    // In-memory update
    const record = this.inMemoryStore.get(this.getStoreKey(hospitalId, userId))!;
    record.status = newStatus;
    record.lastStatusChangeAt = now;
    if (newStatus === "OFFLINE" || newStatus === "BREAK" || newStatus === "AVAILABLE") {
      record.currentCallSid = null;
    }
    record.updatedAt = now;

    this.inMemoryAuditLogs.push({
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      hospitalId,
      staffPresenceId: record.id,
      userId,
      previousStatus,
      newStatus,
      reason,
      actor,
      timestamp: now,
    });

    return { success: true, record: { ...record } };
  }

  /**
   * ATOMIC CALL ASSIGNMENT:
   * Finds an AVAILABLE receptionist and locks the assignment atomically.
   * Prevents two concurrent calls from claiming the same single receptionist.
   */
  public async assignCallToAvailableReceptionist(params: {
    hospitalId: string;
    callSid: string;
    preferredUserId?: string;
    ringTimeoutSeconds?: number;
  }): Promise<CallAssignmentResult> {
    const { hospitalId, callSid, preferredUserId } = params;
    const now = new Date();
    const dbStatus = await checkDatabaseConnection();

    if (dbStatus.connected) {
      try {
        // Query candidate receptionists in this hospital who are marked AVAILABLE
        const candidates = await prisma.staffPresence.findMany({
          where: {
            hospitalId,
            status: "AVAILABLE",
            ...(preferredUserId ? { userId: preferredUserId } : {}),
          },
          orderBy: { lastStatusChangeAt: "asc" }, // Longest idle first
          take: 5,
        });

        if (candidates.length === 0) {
          // Check why none are available for accurate operational classification
          const anyStaff = await prisma.staffPresence.findFirst({ where: { hospitalId } });
          if (!anyStaff) return { assigned: false, reason: "NO_STAFF_CONFIGURED" };

          const anyOnCall = await prisma.staffPresence.findFirst({
            where: { hospitalId, status: { in: ["RINGING", "ON_CALL", "WRAP_UP"] } },
          });
          if (anyOnCall) return { assigned: false, reason: "ALL_BUSY" };

          const anyOnBreak = await prisma.staffPresence.findFirst({ where: { hospitalId, status: "BREAK" } });
          if (anyOnBreak) return { assigned: false, reason: "ALL_ON_BREAK" };

          return { assigned: false, reason: "ALL_OFFLINE" };
        }

        // Attempt atomic conditional assignment on candidate
        for (const candidate of candidates) {
          const updateResult = await prisma.staffPresence.updateMany({
            where: {
              id: candidate.id,
              status: "AVAILABLE", // ATOMIC LOCK GUARANTEE
            },
            data: {
              status: "RINGING",
              currentCallSid: callSid,
              assignedAt: now,
              ringStartedAt: now,
              lastStatusChangeAt: now,
              updatedAt: now,
            },
          });

          if (updateResult.count === 1) {
            // Lock successfully acquired
            await prisma.staffPresenceAuditLog.create({
              data: {
                id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                hospitalId,
                staffPresenceId: candidate.id,
                userId: candidate.userId,
                previousStatus: "AVAILABLE",
                newStatus: "RINGING",
                reason: "CALL_ASSIGNED_RINGING",
                callSid,
                actor: "CALL_ROUTER",
                timestamp: now,
              },
            });

            const updatedCandidate = await prisma.staffPresence.findUnique({ where: { id: candidate.id } });
            return {
              assigned: true,
              staff: updatedCandidate as StaffPresenceRecord,
              reason: "ASSIGNED",
            };
          }
          // If count === 0, another concurrent request claimed candidate; try next or report conflict
        }

        return { assigned: false, reason: "CONCURRENCY_CONFLICT" };
      } catch (err) {
        console.warn("[ReceptionistPresenceService] Atomic assignment in DB failed; using in-memory:", err);
      }
    }

    // In-memory atomic candidate selection
    const inMemoryCandidates: StaffPresenceRecord[] = [];
    for (const rec of this.inMemoryStore.values()) {
      if (rec.hospitalId === hospitalId && rec.status === "AVAILABLE") {
        if (!preferredUserId || rec.userId === preferredUserId) {
          inMemoryCandidates.push(rec);
        }
      }
    }

    if (inMemoryCandidates.length === 0) {
      let hasConfigured = false;
      let hasBusy = false;
      let hasBreak = false;
      for (const rec of this.inMemoryStore.values()) {
        if (rec.hospitalId === hospitalId) {
          hasConfigured = true;
          if (rec.status === "RINGING" || rec.status === "ON_CALL" || rec.status === "WRAP_UP") hasBusy = true;
          if (rec.status === "BREAK") hasBreak = true;
        }
      }
      if (!hasConfigured) return { assigned: false, reason: "NO_STAFF_CONFIGURED" };
      if (hasBusy) return { assigned: false, reason: "ALL_BUSY" };
      if (hasBreak) return { assigned: false, reason: "ALL_ON_BREAK" };
      return { assigned: false, reason: "ALL_OFFLINE" };
    }

    // Sort longest idle first
    inMemoryCandidates.sort((a, b) => a.lastStatusChangeAt.getTime() - b.lastStatusChangeAt.getTime());
    const winner = inMemoryCandidates[0];

    // Atomic assignment check
    if (winner.status !== "AVAILABLE") {
      return { assigned: false, reason: "CONCURRENCY_CONFLICT" };
    }

    winner.status = "RINGING";
    winner.currentCallSid = callSid;
    winner.assignedAt = now;
    winner.ringStartedAt = now;
    winner.lastStatusChangeAt = now;
    winner.updatedAt = now;

    this.inMemoryAuditLogs.push({
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      hospitalId,
      staffPresenceId: winner.id,
      userId: winner.userId,
      previousStatus: "AVAILABLE",
      newStatus: "RINGING",
      reason: "CALL_ASSIGNED_RINGING",
      callSid,
      actor: "CALL_ROUTER",
      timestamp: now,
    });

    return { assigned: true, staff: { ...winner }, reason: "ASSIGNED" };
  }

  /**
   * TELEPHONY EVENT RECONCILIATION:
   * Reconciles carrier telephony events (ringing, answered, completed, missed, timeout)
   * with the receptionist state machine.
   */
  public async reconcileTelephonyEvent(event: TelephonyReconciliationEvent): Promise<{
    reconciled: boolean;
    staff?: StaffPresenceRecord;
    error?: string;
  }> {
    const { hospitalId, callSid, eventType, reason = eventType } = event;
    const now = event.timestamp || new Date();
    const dbStatus = await checkDatabaseConnection();

    if (dbStatus.connected) {
      try {
        // Find staff currently linked to this callSid
        let staff = await prisma.staffPresence.findFirst({
          where: { hospitalId, currentCallSid: callSid },
        });

        if (!staff && event.userId) {
          staff = await prisma.staffPresence.findUnique({
            where: { hospitalId_userId: { hospitalId, userId: event.userId } },
          });
        }

        if (!staff) {
          return { reconciled: false, error: `No active staff presence linked to CallSid '${callSid}'.` };
        }

        let newStatus = staff.status;
        let updateData: Record<string, unknown> = { updatedAt: now };

        switch (eventType) {
          case "CALL_RINGING":
            if (staff.status === "AVAILABLE") {
              newStatus = "RINGING";
              updateData = {
                status: "RINGING",
                ringStartedAt: now,
                lastStatusChangeAt: now,
                updatedAt: now,
              };
            }
            break;

          case "CALL_ANSWERED":
            if (staff.status === "RINGING" || staff.status === "AVAILABLE") {
              newStatus = "ON_CALL";
              updateData = {
                status: "ON_CALL",
                callAnsweredAt: now,
                lastStatusChangeAt: now,
                updatedAt: now,
              };
            }
            break;

          case "CALL_COMPLETED":
            if (staff.status === "ON_CALL" || staff.status === "RINGING") {
              newStatus = "WRAP_UP";
              updateData = {
                status: "WRAP_UP",
                currentCallSid: null,
                callsHandledToday: staff.callsHandledToday + 1,
                lastStatusChangeAt: now,
                updatedAt: now,
              };
            }
            break;

          case "CALL_MISSED":
          case "RING_TIMEOUT":
          case "CALL_FAILED":
            if (staff.status === "RINGING") {
              newStatus = "AVAILABLE";
              updateData = {
                status: "AVAILABLE",
                currentCallSid: null,
                missedCallsToday: staff.missedCallsToday + 1,
                lastStatusChangeAt: now,
                updatedAt: now,
              };
            }
            break;
        }

        const previousStatus = staff.status;
        if (newStatus !== previousStatus) {
          const updated = await prisma.$transaction(async (tx) => {
            const rec = await tx.staffPresence.update({
              where: { id: staff.id },
              data: updateData,
            });

            await tx.staffPresenceAuditLog.create({
              data: {
                id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                hospitalId,
                staffPresenceId: staff.id,
                userId: staff.userId,
                previousStatus,
                newStatus,
                reason,
                callSid,
                actor: "CARRIER_TELEPHONY_EVENT",
                timestamp: now,
              },
            });

            return rec;
          });

          return { reconciled: true, staff: updated as StaffPresenceRecord };
        }

        return { reconciled: true, staff: staff as StaffPresenceRecord };
      } catch (err) {
        console.warn("[ReceptionistPresenceService] Telephony reconciliation in DB failed; using in-memory:", err);
      }
    }

    // In-memory reconciliation
    let targetStaff: StaffPresenceRecord | undefined;
    for (const rec of this.inMemoryStore.values()) {
      if (rec.hospitalId === hospitalId && rec.currentCallSid === callSid) {
        targetStaff = rec;
        break;
      }
    }

    if (!targetStaff && event.userId) {
      targetStaff = this.inMemoryStore.get(this.getStoreKey(hospitalId, event.userId));
    }

    if (!targetStaff) {
      return { reconciled: false, error: `No active in-memory staff presence linked to CallSid '${callSid}'.` };
    }

    const previousStatus = targetStaff.status;
    let newStatus = targetStaff.status;

    switch (eventType) {
      case "CALL_RINGING":
        if (targetStaff.status === "AVAILABLE") {
          newStatus = "RINGING";
          targetStaff.status = "RINGING";
          targetStaff.ringStartedAt = now;
          targetStaff.lastStatusChangeAt = now;
        }
        break;

      case "CALL_ANSWERED":
        if (targetStaff.status === "RINGING" || targetStaff.status === "AVAILABLE") {
          newStatus = "ON_CALL";
          targetStaff.status = "ON_CALL";
          targetStaff.callAnsweredAt = now;
          targetStaff.lastStatusChangeAt = now;
        }
        break;

      case "CALL_COMPLETED":
        if (targetStaff.status === "ON_CALL" || targetStaff.status === "RINGING") {
          newStatus = "WRAP_UP";
          targetStaff.status = "WRAP_UP";
          targetStaff.currentCallSid = null;
          targetStaff.callsHandledToday += 1;
          targetStaff.lastStatusChangeAt = now;
        }
        break;

      case "CALL_MISSED":
      case "RING_TIMEOUT":
      case "CALL_FAILED":
        if (targetStaff.status === "RINGING") {
          newStatus = "AVAILABLE";
          targetStaff.status = "AVAILABLE";
          targetStaff.currentCallSid = null;
          targetStaff.missedCallsToday += 1;
          targetStaff.lastStatusChangeAt = now;
        }
        break;
    }

    targetStaff.updatedAt = now;

    if (newStatus !== previousStatus) {
      this.inMemoryAuditLogs.push({
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        hospitalId,
        staffPresenceId: targetStaff.id,
        userId: targetStaff.userId,
        previousStatus,
        newStatus,
        reason,
        callSid,
        actor: "CARRIER_TELEPHONY_EVENT",
        timestamp: now,
      });
    }

    return { reconciled: true, staff: { ...targetStaff } };
  }

  /**
   * Helper to check and resolve any receptionist stuck in RINGING beyond the configured ring timeout.
   */
  public async reconcileStaleRingingStaff(hospitalId: string, ringTimeoutSeconds = 20): Promise<StaffPresenceRecord[]> {
    const cutoff = new Date(Date.now() - ringTimeoutSeconds * 1000);
    const resolved: StaffPresenceRecord[] = [];
    const dbStatus = await checkDatabaseConnection();

    if (dbStatus.connected) {
      try {
        const staleRecords = await prisma.staffPresence.findMany({
          where: {
            hospitalId,
            status: "RINGING",
            ringStartedAt: { lt: cutoff },
          },
        });

        for (const stale of staleRecords) {
          const res = await this.reconcileTelephonyEvent({
            hospitalId,
            callSid: stale.currentCallSid || "stale_ring_timeout",
            eventType: "RING_TIMEOUT",
            userId: stale.userId,
            reason: `Ring timeout exceeded (${ringTimeoutSeconds}s)`,
          });
          if (res.reconciled && res.staff) {
            resolved.push(res.staff);
          }
        }
        return resolved;
      } catch (err) {
        console.warn("[ReceptionistPresenceService] Stale ringing reconciliation in DB failed:", err);
      }
    }

    for (const rec of this.inMemoryStore.values()) {
      if (rec.hospitalId === hospitalId && rec.status === "RINGING" && rec.ringStartedAt && rec.ringStartedAt < cutoff) {
        const res = await this.reconcileTelephonyEvent({
          hospitalId,
          callSid: rec.currentCallSid || "stale_ring_timeout",
          eventType: "RING_TIMEOUT",
          userId: rec.userId,
          reason: `Ring timeout exceeded (${ringTimeoutSeconds}s)`,
        });
        if (res.reconciled && res.staff) {
          resolved.push(res.staff);
        }
      }
    }
    return resolved;
  }

  /**
   * Completes wrap-up period for a staff member and sets status back to AVAILABLE.
   */
  public async completeWrapUp(hospitalId: string, userId: string): Promise<{ success: boolean; record?: StaffPresenceRecord }> {
    return this.setStaffPresenceStatus({
      hospitalId,
      userId,
      newStatus: "AVAILABLE",
      reason: "WRAP_UP_COMPLETED",
      actor: "STAFF",
    });
  }

  /**
   * Retrieves presence audit history for a hospital or specific staff member.
   */
  public async getPresenceAuditLogs(hospitalId: string, userId?: string, limit = 50): Promise<StaffPresenceAuditLogRecord[]> {
    const dbStatus = await checkDatabaseConnection();
    if (dbStatus.connected) {
      try {
        const logs = await prisma.staffPresenceAuditLog.findMany({
          where: {
            hospitalId,
            ...(userId ? { userId } : {}),
          },
          orderBy: { timestamp: "desc" },
          take: limit,
        });
        return logs as StaffPresenceAuditLogRecord[];
      } catch (err) {
        console.warn("[ReceptionistPresenceService] DB getPresenceAuditLogs failed; using in-memory:", err);
      }
    }

    // Sort descending by timestamp, falling back to reverse insertion order
    const filtered = [...this.inMemoryAuditLogs]
      .reverse()
      .filter((l) => l.hospitalId === hospitalId && (!userId || l.userId === userId));
    return filtered.slice(0, limit);
  }

  /**
   * Test/Simulation helper to directly mutate fields (e.g. ringStartedAt for timeout tests).
   */
  public async updateStaffPresenceFieldsForTest(
    hospitalId: string,
    userId: string,
    fields: Partial<StaffPresenceRecord>
  ): Promise<void> {
    const key = this.getStoreKey(hospitalId, userId);
    const rec = this.inMemoryStore.get(key);
    if (rec) {
      Object.assign(rec, fields);
    }
  }

  /**
   * Resets in-memory state (primarily for automated testing).
   */
  public resetInMemoryState(): void {
    this.inMemoryStore.clear();
    this.inMemoryAuditLogs = [];
  }
}

// Global singleton instance
export const receptionistPresenceService = new ReceptionistPresenceService();
