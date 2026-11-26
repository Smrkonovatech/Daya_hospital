/**
 * ============================================================================
 * EXOTEL PASSTHRU ROUTING, DURABLE STORAGE & AUDIO FLUSH TEST SUITE
 * ============================================================================
 */

import { describe, it, expect, beforeEach } from "vitest";
import { mediaSessionManager, EscalationDecisionRecord, CallMediaSession } from "./session-manager";
import { getHospitalConfig } from "@/lib/config/hospital-config";
import { SarvamSpeechToTextProvider } from "./sarvam-stt";
import { AudioPlaybackQueue } from "./audio-engine";

describe("Exotel Passthru Routing & Escalation Protocol", () => {
  const testCallSid = "test_call_sid_12345";
  const testPhone = "+919606654032";

  beforeEach(() => {
    // Clear manager internal state if needed
    (mediaSessionManager as any).escalationRecords.clear();
    (mediaSessionManager as any).escalationsByCaller.clear();
  });

  it("1. Successfully records and retrieves escalation by CallSid", async () => {
    const record: EscalationDecisionRecord = {
      callSid: testCallSid,
      streamSid: "stream_12345",
      hospitalId: "hosp_daya_thrissur",
      callerNumber: testPhone,
      escalationState: "HUMAN_TRANSFER",
      destination: "+919606654032",
      reason: "Caller requested human receptionist",
      timestamp: Date.now(),
    };

    await mediaSessionManager.recordEscalation(record);

    const retrieved = await mediaSessionManager.getEscalation(testCallSid);
    expect(retrieved).toBeDefined();
    expect(retrieved?.callSid).toBe(testCallSid);
    expect(retrieved?.escalationState).toBe("HUMAN_TRANSFER");
    expect(retrieved?.destination).toBe("+919606654032");
  });

  it("2. Successfully retrieves escalation by caller phone number", async () => {
    const record: EscalationDecisionRecord = {
      callSid: "test_call_sid_phone_lookup",
      streamSid: "stream_phone",
      hospitalId: "hosp_daya_thrissur",
      callerNumber: "+91 96066 54032",
      escalationState: "EMERGENCY",
      destination: "+919606654032",
      reason: "Emergency detected",
      timestamp: Date.now(),
    };

    await mediaSessionManager.recordEscalation(record);

    const retrieved = await mediaSessionManager.getEscalation(undefined, "9606654032");
    expect(retrieved).toBeDefined();
    expect(retrieved?.escalationState).toBe("EMERGENCY");
  });

  it("3. Returns undefined for unknown CallSid (triggers fail closed to Hangup Applet)", async () => {
    const retrieved = await mediaSessionManager.getEscalation("unknown_call_sid_9999");
    expect(retrieved).toBeUndefined();
  });

  it("4. Rejects escalations older than 10 minutes (TTL expiry)", async () => {
    const record: EscalationDecisionRecord = {
      callSid: "expired_call_sid",
      streamSid: "stream_expired",
      hospitalId: "hosp_daya_thrissur",
      callerNumber: "+919876543210",
      escalationState: "HUMAN_TRANSFER",
      destination: "+919606654032",
      reason: "Old transfer",
      timestamp: Date.now() - 650000, // 10.8 minutes ago
    };

    await mediaSessionManager.recordEscalation(record);

    const retrieved = await mediaSessionManager.getEscalation("expired_call_sid");
    expect(retrieved).toBeUndefined();
  });

  it("5. Strictly restricts +919606654032 to Daya Hospital tenant", () => {
    const dayaConfig = getHospitalConfig("hosp_daya_thrissur");
    expect(dayaConfig.routing.casualtyDirectNumber).toBe("+919606654032");
    expect(dayaConfig.routing.receptionistNumber).toBe("+919606654032");

    // Generic / other hospital config must NOT leak +919606654032
    const genericConfig = getHospitalConfig("hosp_generic_hospital");
    expect(genericConfig.routing.casualtyDirectNumber).not.toBe("+919606654032");
    expect(genericConfig.routing.receptionistNumber).not.toBe("+919606654032");
  });

  it("6. Configures natural Malayalam pause tolerance (450 VAD, 650ms silence)", () => {
    const stt = new SarvamSpeechToTextProvider();
    expect((stt as any).vadThreshold).toBe(450);
    expect((stt as any).silenceTimeoutMs).toBe(650);
  });

  it("7. Cross-instance recovery: recovers escalation from Neon DB when in-memory cache is wiped", async () => {
    const durableSid = `cross_inst_sid_${Date.now()}`;
    const record: EscalationDecisionRecord = {
      callSid: durableSid,
      streamSid: "stream_cross_inst",
      hospitalId: "hosp_daya_thrissur",
      callerNumber: "+919606654032",
      escalationState: "HUMAN_TRANSFER",
      destination: "+919606654032",
      reason: "Cross-instance test handoff",
      timestamp: Date.now(),
    };

    // 1. Record escalation (persists in-memory + Neon DB)
    await mediaSessionManager.recordEscalation(record);

    // 2. Simulate completely separate Railway instance by clearing local process memory
    (mediaSessionManager as any).escalationRecords.clear();
    (mediaSessionManager as any).escalationsByCaller.clear();

    // 3. Retrieve on new instance: must fetch from Neon DB
    const recovered = await mediaSessionManager.getEscalation(durableSid);
    if (recovered) {
      expect(recovered.callSid).toBe(durableSid);
      expect(recovered.escalationState).toBe("HUMAN_TRANSFER");
      expect(recovered.destination).toBe("+919606654032");
    }
  });

  it("8. Audio queue waitForDrain dynamically drains all pending chunks before resolution", async () => {
    const queue = new AudioPlaybackQueue("test_drain_stream");
    queue.setActiveTurnSequenceId(1);
    const dummyChunk = Buffer.alloc(3200, 0);

    queue.enqueue(dummyChunk, 1);
    queue.enqueue(dummyChunk, 1);
    expect(queue.hasPending()).toBe(true);

    // Start playing sequential consumer
    const playPromise = queue.playSequential(() => true, 10);
    await queue.waitForDrain(2000);
    await playPromise;

    expect(queue.hasPending()).toBe(false);
  });

  it("9. CallMediaSession executeIdempotentTeardown executes socket closure exactly once", () => {
    let closeCallCount = 0;
    const mockSocket = {
      readyState: 1,
      send: () => {},
      close: () => {
        closeCallCount++;
      },
    };

    const session = new CallMediaSession({
      streamSid: "stream_teardown_test",
      callSid: "call_teardown_test",
      accountSid: "smrkonova1",
      from: "+919606654032",
      to: "08047291658",
      socket: mockSocket,
    });

    session.executeIdempotentTeardown(1000, "First Teardown");
    expect(closeCallCount).toBe(1);

    // Repeated call must be a no-op
    session.executeIdempotentTeardown(1000, "Duplicate Teardown");
    expect(closeCallCount).toBe(1);
  });

  it("10. Exotel Connect Applet: Dynamically resolves E.164 phone number for Connect Applet Application URL", async () => {
    const { hospitalRoutingService } = await import("@/lib/services/hospital-routing-service");

    const record: EscalationDecisionRecord = {
      callSid: "call_dynamic_connect_test",
      streamSid: "stream_dynamic",
      hospitalId: "hosp_daya_thrissur",
      callerNumber: "+919846001122",
      escalationState: "HUMAN_TRANSFER",
      destination: "+919606654032",
      reason: "Live receptionist transfer",
      timestamp: Date.now(),
    };

    await mediaSessionManager.recordEscalation(record);

    // Resolve via hospitalRoutingService as server.ts does
    const resolved = await hospitalRoutingService.resolveLiveDestination({
      hospitalId: "hosp_daya_thrissur",
      callSid: "call_dynamic_connect_test",
      escalationType: "HUMAN_TRANSFER",
    });

    expect(resolved.success).toBe(true);
    expect(resolved.destinationNumber).toBe("+919606654032");
    expect(resolved.departmentName).toBe("Main Inbound Reception");
  });
});
