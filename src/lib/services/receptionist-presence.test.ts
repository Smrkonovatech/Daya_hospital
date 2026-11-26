/**
 * ============================================================================
 * SMRKOMED PHASE A: RECEPTIONIST PRESENCE & TELEPHONY RECONCILIATION TESTS
 * ============================================================================
 *
 * Verifies:
 * 1. Operational state machine transitions (Available, Ringing, On Call, Wrap-up, Break, Offline)
 * 2. Invalid state transition rejection
 * 3. Atomic call assignment & race condition prevention (2 simultaneous calls claiming 1 receptionist)
 * 4. Carrier telephony event reconciliation (ringing, answered, completed, missed, timeout)
 * 5. Stale ring timeout automatic recovery
 * 6. Multi-tenant isolation (Daya vs Aster)
 * 7. Complete presence audit trail persistence
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  receptionistPresenceService,
  StaffPresenceStatus,
} from "./receptionist-presence-service";

describe("PHASE A: Receptionist Presence & Telephony Reconciliation Engine", () => {
  const TENANT_DAYA = "hosp_daya_thrissur";
  const TENANT_ASTER = "hosp_aster_medcity";

  beforeEach(() => {
    receptionistPresenceService.resetInMemoryState();
  });

  // --------------------------------------------------------------------------
  // 1. STATE MACHINE TRANSITIONS
  // --------------------------------------------------------------------------
  describe("1. State Machine Transitions & Validation", () => {
    it("registers a receptionist with default OFFLINE status and transitions to AVAILABLE", async () => {
      const staff = await receptionistPresenceService.registerStaffPresence({
        hospitalId: TENANT_DAYA,
        userId: "usr_daya_rec_01",
        staffName: "Anjali Menon",
        extension: "201",
        phoneNumber: "+919606654032",
      });

      expect(staff.status).toBe("OFFLINE");
      expect(staff.callsHandledToday).toBe(0);
      expect(staff.missedCallsToday).toBe(0);

      // Transition OFFLINE -> AVAILABLE
      const res = await receptionistPresenceService.setStaffPresenceStatus({
        hospitalId: TENANT_DAYA,
        userId: "usr_daya_rec_01",
        newStatus: "AVAILABLE",
        reason: "STAFF_SHIFT_START",
      });

      expect(res.success).toBe(true);
      expect(res.record?.status).toBe("AVAILABLE");
    });

    it("allows valid operational state transitions: AVAILABLE -> BREAK -> AVAILABLE", async () => {
      await receptionistPresenceService.registerStaffPresence({
        hospitalId: TENANT_DAYA,
        userId: "usr_daya_rec_01",
        staffName: "Anjali Menon",
        initialStatus: "AVAILABLE",
      });

      // Step out for lunch / break
      const breakRes = await receptionistPresenceService.setStaffPresenceStatus({
        hospitalId: TENANT_DAYA,
        userId: "usr_daya_rec_01",
        newStatus: "BREAK",
        reason: "LUNCH_BREAK",
      });
      expect(breakRes.success).toBe(true);
      expect(breakRes.record?.status).toBe("BREAK");

      // Return from break
      const availRes = await receptionistPresenceService.setStaffPresenceStatus({
        hospitalId: TENANT_DAYA,
        userId: "usr_daya_rec_01",
        newStatus: "AVAILABLE",
        reason: "RETURN_FROM_BREAK",
      });
      expect(availRes.success).toBe(true);
      expect(availRes.record?.status).toBe("AVAILABLE");
    });

    it("rejects illegal transitions that violate telephony reality (e.g. OFFLINE -> ON_CALL)", async () => {
      await receptionistPresenceService.registerStaffPresence({
        hospitalId: TENANT_DAYA,
        userId: "usr_daya_rec_offline",
        staffName: "Sujatha Nair",
        initialStatus: "OFFLINE",
      });

      // Attempt illegal transition: OFFLINE directly to ON_CALL
      const res = await receptionistPresenceService.setStaffPresenceStatus({
        hospitalId: TENANT_DAYA,
        userId: "usr_daya_rec_offline",
        newStatus: "ON_CALL",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Invalid status transition");
    });

    it("rejects illegal transition: BREAK -> ON_CALL without answering a ringing call", async () => {
      await receptionistPresenceService.registerStaffPresence({
        hospitalId: TENANT_DAYA,
        userId: "usr_daya_rec_break",
        staffName: "Sujatha Nair",
        initialStatus: "BREAK",
      });

      const res = await receptionistPresenceService.setStaffPresenceStatus({
        hospitalId: TENANT_DAYA,
        userId: "usr_daya_rec_break",
        newStatus: "ON_CALL",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Invalid status transition");
    });
  });

  // --------------------------------------------------------------------------
  // 2. ATOMIC CALL ASSIGNMENT & CONCURRENCY
  // --------------------------------------------------------------------------
  describe("2. Atomic Call Assignment & Race Condition Prevention", () => {
    it("successfully assigns call when exactly one receptionist is AVAILABLE", async () => {
      await receptionistPresenceService.registerStaffPresence({
        hospitalId: TENANT_DAYA,
        userId: "usr_daya_solo",
        staffName: "Anjali Menon",
        initialStatus: "AVAILABLE",
      });

      const assignRes = await receptionistPresenceService.assignCallToAvailableReceptionist({
        hospitalId: TENANT_DAYA,
        callSid: "call_test_001",
      });

      expect(assignRes.assigned).toBe(true);
      expect(assignRes.staff?.userId).toBe("usr_daya_solo");
      expect(assignRes.staff?.status).toBe("RINGING");
      expect(assignRes.staff?.currentCallSid).toBe("call_test_001");
      expect(assignRes.staff?.ringStartedAt).toBeDefined();
    });

    it("prevents two simultaneous calls from claiming the same single receptionist (Atomic Race Protection)", async () => {
      // Exactly 1 receptionist available at Daya Hospital
      await receptionistPresenceService.registerStaffPresence({
        hospitalId: TENANT_DAYA,
        userId: "usr_daya_solo",
        staffName: "Anjali Menon",
        initialStatus: "AVAILABLE",
      });

      // Two calls arrive at the exact same moment
      const [res1, res2] = await Promise.all([
        receptionistPresenceService.assignCallToAvailableReceptionist({
          hospitalId: TENANT_DAYA,
          callSid: "call_simultaneous_A",
        }),
        receptionistPresenceService.assignCallToAvailableReceptionist({
          hospitalId: TENANT_DAYA,
          callSid: "call_simultaneous_B",
        }),
      ]);

      // Exactly ONE call must be assigned
      const assignedCount = (res1.assigned ? 1 : 0) + (res2.assigned ? 1 : 0);
      expect(assignedCount).toBe(1);

      // The unassigned call must fail with ALL_BUSY or CONCURRENCY_CONFLICT (so it can overflow to AI)
      const failed = res1.assigned ? res2 : res1;
      expect(failed.assigned).toBe(false);
      expect(["ALL_BUSY", "CONCURRENCY_CONFLICT"]).toContain(failed.reason);
    });

    it("returns ALL_OFFLINE when all receptionists are logged out", async () => {
      await receptionistPresenceService.registerStaffPresence({
        hospitalId: TENANT_DAYA,
        userId: "usr_daya_off_01",
        staffName: "Staff One",
        initialStatus: "OFFLINE",
      });

      const res = await receptionistPresenceService.assignCallToAvailableReceptionist({
        hospitalId: TENANT_DAYA,
        callSid: "call_test_offline",
      });

      expect(res.assigned).toBe(false);
      expect(res.reason).toBe("ALL_OFFLINE");
    });

    it("returns ALL_ON_BREAK when all receptionists are on break", async () => {
      await receptionistPresenceService.registerStaffPresence({
        hospitalId: TENANT_DAYA,
        userId: "usr_daya_break_01",
        staffName: "Staff Break",
        initialStatus: "BREAK",
      });

      const res = await receptionistPresenceService.assignCallToAvailableReceptionist({
        hospitalId: TENANT_DAYA,
        callSid: "call_test_break",
      });

      expect(res.assigned).toBe(false);
      expect(res.reason).toBe("ALL_ON_BREAK");
    });

    it("assigns the longest idle receptionist first when multiple are AVAILABLE", async () => {
      const now = Date.now();
      // Staff 1 became available 10 minutes ago
      const staff1 = await receptionistPresenceService.registerStaffPresence({
        hospitalId: TENANT_DAYA,
        userId: "usr_idle_10min",
        staffName: "Staff 10min",
        initialStatus: "AVAILABLE",
      });
      staff1.lastStatusChangeAt = new Date(now - 10 * 60 * 1000);

      // Staff 2 became available 2 minutes ago
      const staff2 = await receptionistPresenceService.registerStaffPresence({
        hospitalId: TENANT_DAYA,
        userId: "usr_idle_2min",
        staffName: "Staff 2min",
        initialStatus: "AVAILABLE",
      });
      staff2.lastStatusChangeAt = new Date(now - 2 * 60 * 1000);

      const assignRes = await receptionistPresenceService.assignCallToAvailableReceptionist({
        hospitalId: TENANT_DAYA,
        callSid: "call_test_round_robin",
      });

      expect(assignRes.assigned).toBe(true);
      expect(assignRes.staff?.userId).toBe("usr_idle_10min");
    });
  });

  // --------------------------------------------------------------------------
  // 3. TELEPHONY EVENT RECONCILIATION
  // --------------------------------------------------------------------------
  describe("3. Telephony Event Reconciliation Lifecycle", () => {
    it("reconciles full normal call lifecycle: RINGING -> ON_CALL -> WRAP_UP -> AVAILABLE", async () => {
      await receptionistPresenceService.registerStaffPresence({
        hospitalId: TENANT_DAYA,
        userId: "usr_daya_lifecycle",
        staffName: "Anjali Menon",
        initialStatus: "AVAILABLE",
      });

      const callSid = "call_lifecycle_123";

      // 1. Inbound Call assigns and starts ringing
      await receptionistPresenceService.assignCallToAvailableReceptionist({
        hospitalId: TENANT_DAYA,
        callSid,
      });

      // 2. Carrier webhook confirms staff handset is RINGING
      const ringRes = await receptionistPresenceService.reconcileTelephonyEvent({
        hospitalId: TENANT_DAYA,
        callSid,
        eventType: "CALL_RINGING",
      });
      expect(ringRes.reconciled).toBe(true);
      expect(ringRes.staff?.status).toBe("RINGING");

      // 3. Carrier webhook confirms staff ANSWERED
      const answerRes = await receptionistPresenceService.reconcileTelephonyEvent({
        hospitalId: TENANT_DAYA,
        callSid,
        eventType: "CALL_ANSWERED",
      });
      expect(answerRes.reconciled).toBe(true);
      expect(answerRes.staff?.status).toBe("ON_CALL");
      expect(answerRes.staff?.callAnsweredAt).toBeDefined();

      // 4. Call ends / COMPLETED
      const completeRes = await receptionistPresenceService.reconcileTelephonyEvent({
        hospitalId: TENANT_DAYA,
        callSid,
        eventType: "CALL_COMPLETED",
      });
      expect(completeRes.reconciled).toBe(true);
      expect(completeRes.staff?.status).toBe("WRAP_UP");
      expect(completeRes.staff?.callsHandledToday).toBe(1);
      expect(completeRes.staff?.currentCallSid).toBeNull();

      // 5. Staff finishes wrap-up
      const wrapUpRes = await receptionistPresenceService.completeWrapUp(TENANT_DAYA, "usr_daya_lifecycle");
      expect(wrapUpRes.success).toBe(true);
      expect(wrapUpRes.record?.status).toBe("AVAILABLE");
    });

    it("reconciles MISSED / UNANSWERED call: RINGING -> AVAILABLE with incremented missed count", async () => {
      await receptionistPresenceService.registerStaffPresence({
        hospitalId: TENANT_DAYA,
        userId: "usr_daya_missed",
        staffName: "Anjali Menon",
        initialStatus: "AVAILABLE",
      });

      const callSid = "call_missed_456";

      await receptionistPresenceService.assignCallToAvailableReceptionist({
        hospitalId: TENANT_DAYA,
        callSid,
      });

      // Carrier reports missed / ring timeout
      const missRes = await receptionistPresenceService.reconcileTelephonyEvent({
        hospitalId: TENANT_DAYA,
        callSid,
        eventType: "CALL_MISSED",
        reason: "No answer on physical extension",
      });

      expect(missRes.reconciled).toBe(true);
      expect(missRes.staff?.status).toBe("AVAILABLE");
      expect(missRes.staff?.missedCallsToday).toBe(1);
      expect(missRes.staff?.currentCallSid).toBeNull();
    });

    it("reconciles stale ringing staff who exceed configured ring timeout (e.g. 20s)", async () => {
      const staff = await receptionistPresenceService.registerStaffPresence({
        hospitalId: TENANT_DAYA,
        userId: "usr_stale_ringer",
        staffName: "Anjali Menon",
        initialStatus: "AVAILABLE",
      });

      const callSid = "call_stale_789";
      await receptionistPresenceService.assignCallToAvailableReceptionist({
        hospitalId: TENANT_DAYA,
        callSid,
      });

      // Simulate ring started 30 seconds ago
      await receptionistPresenceService.updateStaffPresenceFieldsForTest(
        TENANT_DAYA,
        "usr_stale_ringer",
        { ringStartedAt: new Date(Date.now() - 30 * 1000) }
      );

      // Reconciler detects timeout (> 20s)
      const timedOut = await receptionistPresenceService.reconcileStaleRingingStaff(TENANT_DAYA, 20);

      expect(timedOut.length).toBe(1);
      expect(timedOut[0].userId).toBe("usr_stale_ringer");
      expect(timedOut[0].status).toBe("AVAILABLE");
      expect(timedOut[0].missedCallsToday).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // 4. MULTI-TENANT ISOLATION
  // --------------------------------------------------------------------------
  describe("4. Multi-Tenant Presence Isolation", () => {
    it("guarantees complete isolation between Daya and Aster Medcity receptionists", async () => {
      // Daya Hospital has Anjali
      await receptionistPresenceService.registerStaffPresence({
        hospitalId: TENANT_DAYA,
        userId: "usr_daya_anjali",
        staffName: "Anjali Menon",
        extension: "201",
        initialStatus: "AVAILABLE",
      });

      // Aster Medcity has Rahul
      await receptionistPresenceService.registerStaffPresence({
        hospitalId: TENANT_ASTER,
        userId: "usr_aster_rahul",
        staffName: "Rahul Sharma",
        extension: "301",
        initialStatus: "AVAILABLE",
      });

      // Call arriving for Daya Hospital
      const dayaAssign = await receptionistPresenceService.assignCallToAvailableReceptionist({
        hospitalId: TENANT_DAYA,
        callSid: "call_daya_isolated",
      });

      expect(dayaAssign.assigned).toBe(true);
      expect(dayaAssign.staff?.userId).toBe("usr_daya_anjali");
      expect(dayaAssign.staff?.hospitalId).toBe(TENANT_DAYA);

      // Rahul at Aster must remain untouched and still AVAILABLE
      const asterRahul = await receptionistPresenceService.getStaffPresence(TENANT_ASTER, "usr_aster_rahul");
      expect(asterRahul?.status).toBe("AVAILABLE");
      expect(asterRahul?.currentCallSid).toBeNull();

      // Listing Daya presence never leaks Aster staff
      const dayaList = await receptionistPresenceService.getHospitalStaffPresence(TENANT_DAYA);
      expect(dayaList.length).toBe(1);
      expect(dayaList[0].userId).toBe("usr_daya_anjali");
    });
  });

  // --------------------------------------------------------------------------
  // 5. AUDIT TRAIL
  // --------------------------------------------------------------------------
  describe("5. Presence Audit Trail & Compliance", () => {
    it("records full audit history for every status change and call event", async () => {
      await receptionistPresenceService.registerStaffPresence({
        hospitalId: TENANT_DAYA,
        userId: "usr_audit_test",
        staffName: "Anjali Menon",
        initialStatus: "OFFLINE",
      });

      await receptionistPresenceService.setStaffPresenceStatus({
        hospitalId: TENANT_DAYA,
        userId: "usr_audit_test",
        newStatus: "AVAILABLE",
        reason: "MANUAL_LOGIN",
        actor: "STAFF_DASHBOARD",
      });

      await receptionistPresenceService.assignCallToAvailableReceptionist({
        hospitalId: TENANT_DAYA,
        callSid: "call_audit_trace",
      });

      await receptionistPresenceService.reconcileTelephonyEvent({
        hospitalId: TENANT_DAYA,
        callSid: "call_audit_trace",
        eventType: "CALL_ANSWERED",
      });

      const auditLogs = await receptionistPresenceService.getPresenceAuditLogs(TENANT_DAYA, "usr_audit_test");

      expect(auditLogs.length).toBeGreaterThanOrEqual(3);
      expect(auditLogs[0].newStatus).toBe("ON_CALL");
      expect(auditLogs[1].newStatus).toBe("RINGING");
      expect(auditLogs[2].newStatus).toBe("AVAILABLE");
    });
  });
});
