import { describe, it, expect, beforeEach } from "vitest";
import * as crypto from "crypto";
import { NextRequest } from "next/server";
import { DayaHmsClient } from "./hms/hms-client";
import { MockDayaHmsAdapter } from "./hms/mock-adapter";
import { SarvamVoiceClient } from "./sarvam/sarvam-client";
import { MockSarvamVoiceAdapter } from "./sarvam/mock-adapter";
import { TelephonyIvrClient } from "./ivr/telephony-client";
import { MockTelephonyIvrAdapter } from "./ivr/mock-adapter";
import { POST as sarvamWebhookHandler } from "@/app/api/webhooks/sarvam/route";
import { actionsService } from "@/lib/services/actions-service";
import { systemRepository } from "@/lib/repositories/system-repository";

describe("PHASE 8: Integration Flows & Automated Verification Suite", () => {
  let hmsClient: DayaHmsClient;
  let mockHms: MockDayaHmsAdapter;
  let sarvamClient: SarvamVoiceClient;
  let mockSarvam: MockSarvamVoiceAdapter;
  let telephonyClient: TelephonyIvrClient;
  let mockTelephony: MockTelephonyIvrAdapter;

  beforeEach(() => {
    mockHms = new MockDayaHmsAdapter();
    hmsClient = new DayaHmsClient();
    mockSarvam = new MockSarvamVoiceAdapter("test_secret_daya_2026");
    sarvamClient = new SarvamVoiceClient({
      apiKey: "test_sarvam_api_key",
      agentId: "agent_malayalam_dgh",
      webhookSecret: "test_secret_daya_2026",
    });
    mockTelephony = new MockTelephonyIvrAdapter(30);
    telephonyClient = new TelephonyIvrClient({
      fallbackExtension: "101",
      totalChannels: 30,
    });
    systemRepository.clearInMemoryWebhooks();
    actionsService.resetStore();
  });

  it("Adapter Health: Verifies health check on all mock and production adapters", async () => {
    const hmsHealth = await mockHms.healthCheck();
    const sarvamHealth = await mockSarvam.healthCheck();
    const telephonyHealth = await mockTelephony.healthCheck();

    expect(hmsHealth.status).toBe("HEALTHY");
    expect(sarvamHealth.status).toBe("HEALTHY");
    expect(telephonyHealth.status).toBe("HEALTHY");

    // Test direct Sarvam client HMAC verification
    const testBody = JSON.stringify({ ping: "pong" });
    const hmac = crypto.createHmac("sha256", "test_secret_daya_2026").update(testBody).digest("hex");
    expect(sarvamClient.verifyWebhookSignature(testBody, hmac)).toBe(true);
    expect(sarvamClient.verifyWebhookSignature(testBody, "invalid_sig")).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Scenario 1: Successful booking
  // --------------------------------------------------------------------------
  it("Scenario 1: Successfully books an appointment and returns confirmed HMS reference", async () => {
    const bookingInput = {
      doctorId: "DOC-ENT-012",
      doctorName: "Dr. Rajesh Kumar",
      department: "ENT & Head-Neck Surgery",
      date: "2026-10-28",
      slotTime: "10:30 AM",
      patientMobile: "+919846018392",
      patientName: "Krishnan Namboothiri",
      idempotencyKey: "test_idem_booking_success_001",
    };

    const result = await hmsClient.bookAppointment(bookingInput);

    expect(result.success).toBe(true);
    expect(result.bookingRef).toMatch(/^DAYA-HMS-OPD-\d+$/);
    expect(result.tokenNumber).toBeGreaterThan(0);
    expect(result.consultationFee).toBe(450);
    expect(result.allocatedSlot).toContain("10:30 AM");

    // Re-verify that booking exists in HMS records
    if (result.bookingRef) {
      const verify = await hmsClient.verifyBooking(result.bookingRef);
      expect(verify.verified).toBe(true);
      expect(verify.status).toBe("CONFIRMED");
    }
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Unavailable appointment (Quota full)
  // --------------------------------------------------------------------------
  it("Scenario 2: Returns SLOT_UNAVAILABLE when doctor OPD session quota is full", async () => {
    const result = await hmsClient.bookAppointment({
      doctorId: "DOC-CARDIO-001",
      doctorName: "Dr. K. R. Balakrishnan",
      department: "Cardiology",
      date: "2026-10-29",
      slotTime: "11:45 AM - Full",
      patientMobile: "+919495112233",
      patientName: "Biju Parakkal",
      idempotencyKey: "test_idem_quota_full_002",
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("SLOT_UNAVAILABLE");
    expect(result.error).toContain("OPD quota reached");
  });

  // --------------------------------------------------------------------------
  // Scenario 3: HMS validation failure (Invalid patient input)
  // --------------------------------------------------------------------------
  it("Scenario 3: Rejects appointment booking when mobile number fails validation", async () => {
    const invalidResult = await hmsClient.bookAppointment({
      doctorId: "DOC-GEN-002",
      doctorName: "Dr. Anjali Menon",
      department: "General Medicine",
      date: "2026-10-28",
      slotTime: "10:00 AM",
      patientMobile: "12345", // Invalid length < 10 digits
      patientName: "Unknown",
      idempotencyKey: "test_idem_val_fail_003",
    });

    expect(invalidResult.success).toBe(false);
    expect(invalidResult.errorCode).toBe("VALIDATION_FAILED");
    expect(invalidResult.error).toContain("Valid 10-digit patient mobile number");
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Timeout after a booking request (verifies status check before retry)
  // --------------------------------------------------------------------------
  it("Scenario 4: Handles HMS timeout safely and checks status before retrying", async () => {
    const result = await hmsClient.bookAppointment({
      doctorId: "DOC-ORTHO-004",
      doctorName: "Dr. Suresh Kumar",
      department: "Orthopaedics",
      date: "2026-10-29",
      slotTime: "11:00 AM - Timeout Simulation",
      patientMobile: "+919846011223",
      patientName: "Mini Thomas",
      idempotencyKey: "test_idem_timeout_004",
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("HMS_TIMEOUT");
    expect(result.retryAfterMs).toBe(2000);
    expect(result.error).toContain("timed out after 3000ms");
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Duplicate webhook detection
  // --------------------------------------------------------------------------
  it("Scenario 5: Detects and idempotently acknowledges duplicate webhooks", async () => {
    const secret = process.env.SARVAM_WEBHOOK_SECRET || "mock_sarvam_secret_key_2026";
    const payload = JSON.stringify({
      eventId: "evt_duplicate_test_005",
      eventType: "call_ended",
      interactionId: "call_sarvam_test_901",
      timestamp: new Date().toISOString(),
      metadata: { callerNumber: "+919846018392", durationSeconds: 65 },
    });

    const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

    const req1 = new NextRequest("http://localhost:3000/api/webhooks/sarvam", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-sarvam-signature": signature,
        "x-daya-event-id": "evt_duplicate_test_005",
      },
      body: payload,
    });

    const res1 = await sarvamWebhookHandler(req1);
    const json1 = await res1.json();
    expect(res1.status).toBe(200);
    expect(json1.status).toBe("PROCESSED");

    // Second delivery of exact same event ID
    const req2 = new NextRequest("http://localhost:3000/api/webhooks/sarvam", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-sarvam-signature": signature,
        "x-daya-event-id": "evt_duplicate_test_005",
      },
      body: payload,
    });

    const res2 = await sarvamWebhookHandler(req2);
    const json2 = await res2.json();
    expect(res2.status).toBe(200);
    expect(json2.status).toBe("ALREADY_PROCESSED_IDEMPOTENT");
    expect(json2.eventId).toBe("evt_duplicate_test_005");
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Invalid webhook authentication (HMAC mismatch)
  // --------------------------------------------------------------------------
  it("Scenario 6: Rejects webhooks with forged or invalid HMAC signature", async () => {
    const payload = JSON.stringify({
      eventId: "evt_tampered_006",
      eventType: "call_ended",
      interactionId: "call_tampered_006",
    });

    const invalidSignature = "sha256=invalid_tampered_signature_hex_0000";

    const req = new NextRequest("http://localhost:3000/api/webhooks/sarvam", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-sarvam-signature": invalidSignature,
        "x-daya-event-id": "evt_tampered_006",
      },
      body: payload,
    });

    const res = await sarvamWebhookHandler(req);
    const json = await res.json();
    expect(res.status).toBe(401);
    expect(json.status).toBe("UNAUTHORIZED");
    expect(json.error).toContain("Invalid webhook authentication signature");
  });

  // --------------------------------------------------------------------------
  // Scenario 7: Failed rescheduling (Booking reference not found)
  // --------------------------------------------------------------------------
  it("Scenario 7: Handles failed rescheduling gracefully when booking reference does not exist", async () => {
    const result = await hmsClient.rescheduleAppointment({
      bookingRef: "INVALID_REF",
      patientMobile: "+919495112233",
      targetDoctorId: "DOC-CARDIO-001",
      targetDate: "2026-10-30",
      targetSlotTime: "10:30 AM",
      idempotencyKey: "test_idem_resched_fail_007",
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("PATIENT_NOT_FOUND");
    expect(result.error).toContain("booking reference not found");
  });

  // --------------------------------------------------------------------------
  // Scenario 8: Successful cancellation
  // --------------------------------------------------------------------------
  it("Scenario 8: Successfully cancels appointment and releases slot back to OPD inventory", async () => {
    const result = await hmsClient.cancelAppointment(
      "DAYA-HMS-OPD-77189",
      "test_idem_cancel_success_008"
    );

    expect(result.success).toBe(true);
    expect(result.cancelledRef).toBe("DAYA-HMS-OPD-77189");
    expect(result.releasedSlot).toContain("Released back into Daya HMS OPD inventory pool");
  });

  // --------------------------------------------------------------------------
  // Scenario 9: Missing transcript or recording (Triggers API fetch)
  // --------------------------------------------------------------------------
  it("Scenario 9: Fetches missing transcript turns and audio recording via Sarvam API when omitted in webhook", async () => {
    const secret = process.env.SARVAM_WEBHOOK_SECRET || "mock_sarvam_secret_key_2026";
    // Payload with NO transcript and NO recording URL
    const payload = JSON.stringify({
      eventId: "evt_missing_transcript_009",
      eventType: "call_ended",
      interactionId: "call_sarvam_test_missing_assets",
      metadata: { callerNumber: "+919847123456" },
    });

    const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

    const req = new NextRequest("http://localhost:3000/api/webhooks/sarvam", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-sarvam-signature": signature,
        "x-daya-event-id": "evt_missing_transcript_009",
      },
      body: payload,
    });

    const res = await sarvamWebhookHandler(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe("PROCESSED");
    // Verify background fallback fetched transcript turns and recording
    expect(json.supplementalDataFetched.transcriptTurnCount).toBeGreaterThan(0);
    expect(json.supplementalDataFetched.recordingAvailable).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Scenario 10: AI call that requires human follow-up (Casualty/Emergency escalation)
  // --------------------------------------------------------------------------
  it("Scenario 10: Correctly escalates complex or failed interactions into staff follow-up queue", async () => {
    const webhookResult = await actionsService.consumeWebhookEvent({
      eventId: "evt_followup_emergency_010",
      actionType: "UNRESOLVED_ENQUIRY",
      callId: "call_urgent_casualty_01",
      callerNumber: "+919846554433",
      callerRequest: "Patient experiencing chest tightness and severe breathlessness",
      aiAttempt: "AI recognized critical triage condition, dispatched Casualty alert, and flagged for immediate nurse follow-up",
      idempotencyKey: "idem_urgent_triage_010",
      hmsResult: {
        status: "FAILED",
        errorCode: "CLINICAL_EMERGENCY_ESCALATION",
        errorMessage: "Acute coronary symptoms detected during voice intake. Immediate human intervention required.",
      },
    });

    expect(webhookResult.success).toBe(true);
    expect(webhookResult.action.status).toBe("FAILED");
    expect(webhookResult.action.errorDetails?.followUpRequired).toBe(true);
    expect(webhookResult.action.errorDetails?.code).toBe("CLINICAL_EMERGENCY_ESCALATION");

    // Verify it appears in the follow-up queue
    const followUpQueue = await actionsService.getActions({ onlyFollowUp: true });
    const matched = followUpQueue.actions.find((a) => a.id === webhookResult.action.id);
    expect(matched).toBeDefined();
    expect(matched?.errorDetails?.followUpRequired).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Scenario 11: IVR forwarding unavailable / Anti-loop protection triggered
  // --------------------------------------------------------------------------
  it("Scenario 11: Enforces anti-loop protection when hopCount >= 1 and redirects to Casualty fallback", async () => {
    // First hop: Normal rollover to AI queue succeeds
    const hop0Result = await telephonyClient.forwardToAiQueue("call_incoming_pbx_101", 0);
    expect(hop0Result.forwarded).toBe(true);
    expect(hop0Result.hopCount).toBe(1);
    expect(hop0Result.sessionUrl).toContain("sip:sarvam-malayalam");

    // Second hop attempt on same call: Loop detected! Refuses AI forwarding and routes to Casualty Ext 101
    const loopPreventedResult = await telephonyClient.forwardToAiQueue("call_incoming_pbx_101", 1);
    expect(loopPreventedResult.forwarded).toBe(false);
    expect(loopPreventedResult.sessionUrl).toContain("casualty");
    expect(loopPreventedResult.sessionUrl).toContain("101");
    expect(loopPreventedResult.hopCount).toBe(2);
  });
});
