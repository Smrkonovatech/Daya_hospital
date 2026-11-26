/**
 * ============================================================================
 * SMRKOMED PHASE B: AI OVERFLOW & HUMAN-FIRST TELEPHONY TESTS
 * ============================================================================
 *
 * Verifies:
 * 1. Receptionist busy detection -> AI overflow routing decision
 * 2. Ring timeout detection -> Telephony reconciliation & AI overflow logging
 * 3. Offline & break receptionist detection -> Immediate AI overflow
 * 4. Contextual Malayalam (Bulbul:v3 Kavitha) & English overflow greetings
 * 5. Original caller context, tenant isolation & call source preservation
 * 6. Concurrency & collision resolution (single receptionist with simultaneous callers)
 * 7. Overflow telemetry & analytics aggregation
 */

import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  receptionistPresenceService,
} from "./receptionist-presence-service";
import {
  aiOverflowService,
  AiOverflowReason,
} from "./ai-overflow-service";
import { GET as routingDecisionGET } from "@/app/api/v1/receptionist/routing-decision/route";
import { GET as overflowLogsGET } from "@/app/api/v1/receptionist/overflow-logs/route";
import { CallMediaSession, SocketSender } from "@/media-gateway/session-manager";
import { AudioEngine } from "@/media-gateway/audio-engine";
import { SpeechToTextProvider, TextToSpeechProvider } from "@/media-gateway/speech-interfaces";
import { EventEmitter } from "events";

// Mock STT Provider
class MockSTT extends EventEmitter implements SpeechToTextProvider {
  public connect = async () => {};
  public disconnect = async () => {};
  public sendAudio = async (_audioChunk: Buffer) => {};
  public sendAudioChunk = () => {};
  public onTranscript(callback: any): void {
    this.on("transcript", callback);
  }
}

// Mock TTS Provider
class MockTTS implements TextToSpeechProvider {
  public synthesizedTexts: string[] = [];
  public async synthesize(text: string): Promise<Buffer> {
    this.synthesizedTexts.push(text);
    return Buffer.alloc(1600); // 100ms of synthetic 8kHz PCM
  }
}

// Mock Socket
class MockSocket implements SocketSender {
  public sentMessages: string[] = [];
  public readyState = 1;
  public send(data: string, cb?: (err?: Error) => void): void {
    this.sentMessages.push(data);
    if (cb) cb();
  }
}

describe("PHASE B: Human-First Telephony & AI Overflow Routing Engine", () => {
  const TENANT_DAYA = "hosp_daya_thrissur";
  const TENANT_ASTER = "hosp_aster_medcity";

  beforeEach(() => {
    receptionistPresenceService.resetInMemoryState();
    aiOverflowService.resetForTest();
  });

  // --------------------------------------------------------------------------
  // 1. RECEPTIONIST BUSY DETECTION & ROUTING DECISION
  // --------------------------------------------------------------------------
  describe("1. Receptionist Busy Detection & Pre-Flight Routing", () => {
    it("routes call to human receptionist when staff is AVAILABLE", async () => {
      await receptionistPresenceService.registerStaffPresence({
        hospitalId: TENANT_DAYA,
        userId: "usr_daya_rec_01",
        staffName: "Anjali Menon",
        phoneNumber: "+919606654032",
        initialStatus: "AVAILABLE",
      });

      const assignment = await receptionistPresenceService.assignCallToAvailableReceptionist({
        hospitalId: TENANT_DAYA,
        callSid: "call_daya_test_001",
      });

      expect(assignment.assigned).toBe(true);
      expect(assignment.staff?.userId).toBe("usr_daya_rec_01");
      expect(assignment.staff?.status).toBe("RINGING");
      expect(assignment.staff?.currentCallSid).toBe("call_daya_test_001");
    });

    it("detects busy receptionist (ON_CALL) and triggers AI overflow with reason RECEPTIONIST_BUSY", async () => {
      // Register staff and set ON_CALL (busy with another patient)
      await receptionistPresenceService.registerStaffPresence({
        hospitalId: TENANT_DAYA,
        userId: "usr_daya_rec_01",
        staffName: "Anjali Menon",
        phoneNumber: "+919606654032",
        initialStatus: "AVAILABLE",
      });

      // Claim first call
      await receptionistPresenceService.assignCallToAvailableReceptionist({
        hospitalId: TENANT_DAYA,
        callSid: "call_active_patient_001",
      });
      // Answer first call -> staff is now ON_CALL
      await receptionistPresenceService.reconcileTelephonyEvent({
        hospitalId: TENANT_DAYA,
        callSid: "call_active_patient_001",
        eventType: "CALL_ANSWERED",
      });

      // Second caller arrives
      const secondCallAssignment = await receptionistPresenceService.assignCallToAvailableReceptionist({
        hospitalId: TENANT_DAYA,
        callSid: "call_incoming_second_002",
      });

      expect(secondCallAssignment.assigned).toBe(false);
      expect(secondCallAssignment.reason).toBe("ALL_BUSY");

      // Record AI overflow
      const overflowLog = await aiOverflowService.recordOverflow({
        hospitalId: TENANT_DAYA,
        callSid: "call_incoming_second_002",
        callerNumber: "+919876543210",
        reason: "RECEPTIONIST_BUSY",
        handledByAi: true,
      });

      expect(overflowLog.reason).toBe("RECEPTIONIST_BUSY");
      expect(overflowLog.handledByAi).toBe(true);
      expect(overflowLog.callSid).toBe("call_incoming_second_002");
    });
  });

  // --------------------------------------------------------------------------
  // 2. RING TIMEOUT & TELEPHONY RECONCILIATION
  // --------------------------------------------------------------------------
  describe("2. Ring Timeout Detection & AI Overflow", () => {
    it("detects 20-second ring timeout, restores receptionist availability, and logs overflow", async () => {
      await receptionistPresenceService.registerStaffPresence({
        hospitalId: TENANT_DAYA,
        userId: "usr_daya_rec_01",
        staffName: "Anjali Menon",
        phoneNumber: "+919606654032",
        initialStatus: "AVAILABLE",
      });

      // Call is assigned and starts ringing
      await receptionistPresenceService.assignCallToAvailableReceptionist({
        hospitalId: TENANT_DAYA,
        callSid: "call_timeout_test_003",
      });

      const ringingStaff = await receptionistPresenceService.getStaffPresence(TENANT_DAYA, "usr_daya_rec_01");
      expect(ringingStaff?.status).toBe("RINGING");

      // Carrier sends RING_TIMEOUT telephony event after 20 seconds
      const reconciliation = await receptionistPresenceService.reconcileTelephonyEvent({
        hospitalId: TENANT_DAYA,
        callSid: "call_timeout_test_003",
        eventType: "RING_TIMEOUT",
        reason: "Carrier ring timeout (20s exceeded)",
      });

      expect(reconciliation.reconciled).toBe(true);
      expect(reconciliation.staff?.status).toBe("AVAILABLE"); // Restored for next call
      expect(reconciliation.staff?.missedCallsToday).toBe(1);

      // Log overflow event with ring duration
      const overflow = await aiOverflowService.recordOverflow({
        hospitalId: TENANT_DAYA,
        callSid: "call_timeout_test_003",
        callerNumber: "+919876543210",
        reason: "RING_TIMEOUT",
        targetStaffUserId: "usr_daya_rec_01",
        targetStaffName: "Anjali Menon",
        ringDurationSeconds: 20,
        handledByAi: true,
      });

      expect(overflow.reason).toBe("RING_TIMEOUT");
      expect(overflow.ringDurationSeconds).toBe(20);
      expect(overflow.targetStaffName).toBe("Anjali Menon");
    });
  });

  // --------------------------------------------------------------------------
  // 3. OFFLINE & BREAK RECEPTIONIST DETECTION
  // --------------------------------------------------------------------------
  describe("3. Offline & On-Break Receptionist Handling", () => {
    it("detects when all receptionists are OFFLINE and overflows immediately without ringing", async () => {
      await receptionistPresenceService.registerStaffPresence({
        hospitalId: TENANT_DAYA,
        userId: "usr_daya_rec_01",
        staffName: "Anjali Menon",
        initialStatus: "OFFLINE",
      });

      const assignment = await receptionistPresenceService.assignCallToAvailableReceptionist({
        hospitalId: TENANT_DAYA,
        callSid: "call_offline_test_004",
      });

      expect(assignment.assigned).toBe(false);
      expect(assignment.reason).toBe("ALL_OFFLINE");

      const overflow = await aiOverflowService.recordOverflow({
        hospitalId: TENANT_DAYA,
        callSid: "call_offline_test_004",
        callerNumber: "+919876543210",
        reason: "RECEPTIONIST_OFFLINE",
        handledByAi: true,
      });

      expect(overflow.reason).toBe("RECEPTIONIST_OFFLINE");
    });

    it("detects when all receptionists are on BREAK and triggers AI overflow", async () => {
      await receptionistPresenceService.registerStaffPresence({
        hospitalId: TENANT_DAYA,
        userId: "usr_daya_rec_01",
        staffName: "Anjali Menon",
        initialStatus: "AVAILABLE",
      });

      // Staff goes on lunch break
      await receptionistPresenceService.setStaffPresenceStatus({
        hospitalId: TENANT_DAYA,
        userId: "usr_daya_rec_01",
        newStatus: "BREAK",
        reason: "LUNCH_BREAK",
      });

      const assignment = await receptionistPresenceService.assignCallToAvailableReceptionist({
        hospitalId: TENANT_DAYA,
        callSid: "call_break_test_005",
      });

      expect(assignment.assigned).toBe(false);
      expect(assignment.reason).toBe("ALL_ON_BREAK");

      const overflow = await aiOverflowService.recordOverflow({
        hospitalId: TENANT_DAYA,
        callSid: "call_break_test_005",
        callerNumber: "+919876543210",
        reason: "RECEPTIONIST_BREAK",
        handledByAi: true,
      });

      expect(overflow.reason).toBe("RECEPTIONIST_BREAK");
    });
  });

  // --------------------------------------------------------------------------
  // 4. CONTEXTUAL OVERFLOW GREETINGS
  // --------------------------------------------------------------------------
  describe("4. Contextual Malayalam & English Overflow Greetings", () => {
    it("generates contextual Malayalam greeting when receptionist is busy", () => {
      const greeting = aiOverflowService.getContextualGreeting("ml-IN", "RECEPTIONIST_BUSY", "ദയാ ജനറൽ ഹോസ്പിറ്റൽ");
      expect(greeting).toContain("ദയാ ജനറൽ ഹോസ്പിറ്റൽ");
      expect(greeting).toContain("നിലവിൽ ഞങ്ങളുടെ റിസപ്ഷനിസ്റ്റ് മറ്റ് കോളുകളിലാണ്");
      expect(greeting).toContain("ഞാൻ താങ്കളെ സഹായിക്കാം");
    });

    it("generates contextual Malayalam greeting when call times out", () => {
      const greeting = aiOverflowService.getContextualGreeting("ml-IN", "RING_TIMEOUT", "ദയാ ജനറൽ ഹോസ്പിറ്റൽ");
      expect(greeting).toContain("റിസപ്ഷൻ ഡെസ്കിൽ ഇപ്പോൾ പ്രതികരണമില്ലാത്തതിനാൽ");
      expect(greeting).toContain("ഞാൻ താങ്കളെ സഹായിക്കാം");
    });

    it("generates contextual Malayalam greeting when receptionist is offline", () => {
      const greeting = aiOverflowService.getContextualGreeting("ml-IN", "RECEPTIONIST_OFFLINE", "ദയാ ജനറൽ ഹോസ്പിറ്റൽ");
      expect(greeting).toContain("ഇപ്പോൾ റിസപ്ഷൻ ഡെസ്ക് ലഭ്യമല്ല");
      expect(greeting).toContain("ഞങ്ങളുടെ എഐ അസിസ്റ്റന്റായ ഞാൻ താങ്കളെ സഹായിക്കാം");
    });

    it("generates professional English greeting for English callers", () => {
      const greeting = aiOverflowService.getContextualGreeting("en-IN", "RECEPTIONIST_BUSY", "Daya General Hospital");
      expect(greeting).toContain("Daya General Hospital");
      expect(greeting).toContain("Our receptionist is currently attending to other calls");
      expect(greeting).toContain("I can assist you right away");
    });
  });

  // --------------------------------------------------------------------------
  // 5. CALL CONTEXT & MEDIA GATEWAY SESSION INTEGRATION
  // --------------------------------------------------------------------------
  describe("5. Media Gateway Session Overflow Handling & Caller Context", () => {
    it("initializes CallMediaSession in IVR_ROLLOVER mode with contextual greeting and preserved context", async () => {
      const mockSocket = new MockSocket();
      const mockSTT = new MockSTT();
      const mockTTS = new MockTTS();
      const audioEngine = new AudioEngine({ enforceMinimum: false });

      const session = new CallMediaSession({
        streamSid: "stream_ovf_001",
        callSid: "call_ovf_daya_001",
        accountSid: "smrkonova1",
        from: "+919876543210",
        to: "08047291658",
        socket: mockSocket,
        audioEngine,
        sttProvider: mockSTT,
        ttsProvider: mockTTS,
        autoPlayGreeting: true,
        enableIvrFlow: false, // IVR bypassed for overflow callers
        isOverflow: true,
        overflowReason: "RECEPTIONIST_BUSY",
        callSource: "IVR_ROLLOVER",
      });

      // Verify caller context & tenant are preserved
      expect(session.isOverflow).toBe(true);
      expect(session.overflowReason).toBe("RECEPTIONIST_BUSY");
      expect(session.callSource).toBe("IVR_ROLLOVER");
      expect(session.fromNumber).toBe("+919876543210");
      expect(session.toNumber).toBe("08047291658");
      expect(session.hospitalId).toBe(TENANT_DAYA);

      // Play initial greeting
      await session.playInitialGreeting();

      // Verify contextual overflow greeting was synthesized via TTS
      expect(mockTTS.synthesizedTexts.length).toBe(1);
      const synthesizedGreeting = mockTTS.synthesizedTexts[0];
      expect(synthesizedGreeting).toContain("നിലവിൽ ഞങ്ങളുടെ റിസപ്ഷനിസ്റ്റ് മറ്റ് കോളുകളിലാണ്");
      expect(synthesizedGreeting).toContain("ഞാൻ താങ്കളെ സഹായിക്കാം");

      // Verify session conversation turn was recorded
      expect(session.conversationTurns.length).toBe(1);
      expect(session.conversationTurns[0].speaker).toBe("ai");
      expect(session.conversationTurns[0].text).toBe(synthesizedGreeting);
    });
  });

  // --------------------------------------------------------------------------
  // 6. CONCURRENCY & RACE CONDITION RESOLUTION
  // --------------------------------------------------------------------------
  describe("6. Concurrency & Simultaneous Call Resolution", () => {
    it("prevents double-booking: assigns 1st call to available staff and immediately overflows 2nd call to AI", async () => {
      // 1 single receptionist available
      await receptionistPresenceService.registerStaffPresence({
        hospitalId: TENANT_DAYA,
        userId: "usr_daya_rec_01",
        staffName: "Anjali Menon",
        phoneNumber: "+919606654032",
        initialStatus: "AVAILABLE",
      });

      // Two callers dial in at the exact same millisecond
      const [call1, call2] = await Promise.all([
        receptionistPresenceService.assignCallToAvailableReceptionist({
          hospitalId: TENANT_DAYA,
          callSid: "call_concurrent_A",
        }),
        receptionistPresenceService.assignCallToAvailableReceptionist({
          hospitalId: TENANT_DAYA,
          callSid: "call_concurrent_B",
        }),
      ]);

      const assignedCount = (call1.assigned ? 1 : 0) + (call2.assigned ? 1 : 0);
      const overflowCount = (!call1.assigned ? 1 : 0) + (!call2.assigned ? 1 : 0);

      expect(assignedCount).toBe(1);
      expect(overflowCount).toBe(1);

      // Verify winner is ringing and loser gets proper overflow reason
      if (call1.assigned) {
        expect(call1.staff?.status).toBe("RINGING");
        expect(call2.reason).toMatch(/ALL_BUSY|CONCURRENCY_CONFLICT/);
      } else {
        expect(call2.staff?.status).toBe("RINGING");
        expect(call1.reason).toMatch(/ALL_BUSY|CONCURRENCY_CONFLICT/);
      }
    });
  });

  // --------------------------------------------------------------------------
  // 7. TELEMETRY & ANALYTICS AGGREGATION
  // --------------------------------------------------------------------------
  describe("7. Telemetry & Analytics Aggregation", () => {
    it("accurately computes overflow metrics, breakdown by reason, and average ring duration", async () => {
      await aiOverflowService.recordOverflow({
        hospitalId: TENANT_DAYA,
        callSid: "call_stat_1",
        callerNumber: "+919876543201",
        reason: "RECEPTIONIST_BUSY",
      });
      await aiOverflowService.recordOverflow({
        hospitalId: TENANT_DAYA,
        callSid: "call_stat_2",
        callerNumber: "+919876543202",
        reason: "RECEPTIONIST_BUSY",
      });
      await aiOverflowService.recordOverflow({
        hospitalId: TENANT_DAYA,
        callSid: "call_stat_3",
        callerNumber: "+919876543203",
        reason: "RING_TIMEOUT",
        ringDurationSeconds: 20,
      });
      await aiOverflowService.recordOverflow({
        hospitalId: TENANT_DAYA,
        callSid: "call_stat_4",
        callerNumber: "+919876543204",
        reason: "RING_TIMEOUT",
        ringDurationSeconds: 24,
      });
      await aiOverflowService.recordOverflow({
        hospitalId: TENANT_DAYA,
        callSid: "call_stat_5",
        callerNumber: "+919876543205",
        reason: "RECEPTIONIST_OFFLINE",
      });

      const analytics = await aiOverflowService.getOverflowAnalytics(TENANT_DAYA);

      expect(analytics.totalOverflows).toBe(5);
      expect(analytics.byReason.RECEPTIONIST_BUSY).toBe(2);
      expect(analytics.byReason.RING_TIMEOUT).toBe(2);
      expect(analytics.byReason.RECEPTIONIST_OFFLINE).toBe(1);
      expect(analytics.averageRingDurationSeconds).toBe(22); // (20 + 24) / 2 = 22
      expect(analytics.recentEvents.length).toBe(5);
    });

    it("strictly isolates telemetry between Daya Hospital and Aster Medcity", async () => {
      await aiOverflowService.recordOverflow({
        hospitalId: TENANT_DAYA,
        callSid: "call_daya_iso",
        callerNumber: "+919876543210",
        reason: "RECEPTIONIST_BUSY",
      });
      await aiOverflowService.recordOverflow({
        hospitalId: TENANT_ASTER,
        callSid: "call_aster_iso",
        callerNumber: "+919876543211",
        reason: "RECEPTIONIST_OFFLINE",
      });

      const dayaLogs = await aiOverflowService.getRecentOverflows(TENANT_DAYA);
      const asterLogs = await aiOverflowService.getRecentOverflows(TENANT_ASTER);

      expect(dayaLogs.length).toBe(1);
      expect(dayaLogs[0].callSid).toBe("call_daya_iso");

      expect(asterLogs.length).toBe(1);
      expect(asterLogs[0].callSid).toBe("call_aster_iso");
    });
  });

  // --------------------------------------------------------------------------
  // 8. REST API ROUTING DECISION & OVERFLOW LOGS INTEGRATION
  // --------------------------------------------------------------------------
  describe("8. REST Endpoints (routing-decision & overflow-logs)", () => {
    it("GET /api/v1/receptionist/routing-decision returns HUMAN_RECEPTIONIST when available", async () => {
      await receptionistPresenceService.registerStaffPresence({
        hospitalId: TENANT_DAYA,
        userId: "usr_daya_rec_01",
        staffName: "Anjali Menon",
        phoneNumber: "+919606654032",
        initialStatus: "AVAILABLE",
      });

      const req = new NextRequest(
        "http://localhost:3000/api/v1/receptionist/routing-decision?CallSid=call_http_001&From=%2B919876543210&hospitalId=hosp_daya_thrissur"
      );

      const res = await routingDecisionGET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.decision).toBe("HUMAN_RECEPTIONIST");
      expect(json.action).toBe("DIAL");
      expect(json.destination.numbers).toContain("+919606654032");
      expect(json.max_ringing_duration).toBe(20);
      expect(json.staff.userId).toBe("usr_daya_rec_01");
    });

    it("GET /api/v1/receptionist/routing-decision returns AI_OVERFLOW when staff is offline", async () => {
      await receptionistPresenceService.registerStaffPresence({
        hospitalId: TENANT_DAYA,
        userId: "usr_daya_rec_01",
        staffName: "Anjali Menon",
        phoneNumber: "+919606654032",
        initialStatus: "OFFLINE",
      });

      const req = new NextRequest(
        "http://localhost:3000/api/v1/receptionist/routing-decision?CallSid=call_http_002&From=%2B919876543210&hospitalId=hosp_daya_thrissur"
      );

      const res = await routingDecisionGET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.decision).toBe("AI_OVERFLOW");
      expect(json.action).toBe("CONNECT_VOICEBOT");
      expect(json.reason).toBe("RECEPTIONIST_OFFLINE");
      expect(json.targetApplet).toBe("1393239");
      expect(json.voicebotUrl).toContain("overflow=true");
    });

    it("GET /api/v1/receptionist/overflow-logs returns analytics and recent overflow records", async () => {
      await aiOverflowService.recordOverflow({
        hospitalId: TENANT_DAYA,
        callSid: "call_log_api_001",
        callerNumber: "+919876543210",
        reason: "RECEPTIONIST_BUSY",
      });

      const req = new NextRequest(
        "http://localhost:3000/api/v1/receptionist/overflow-logs?hospitalId=hosp_daya_thrissur"
      );

      const res = await overflowLogsGET(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.hospitalId).toBe(TENANT_DAYA);
      expect(json.analytics.totalOverflows).toBe(1);
      expect(json.analytics.byReason.RECEPTIONIST_BUSY).toBe(1);
      expect(json.logs[0].callSid).toBe("call_log_api_001");
    });
  });
});
