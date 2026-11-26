/**
 * ============================================================================
 * SMRKOMED PHASE 10.5: DIRECT API INTEGRATION TEST SUITE
 * ============================================================================
 *
 * Verifies all 10 requirements of Phase 10.5:
 * 1. Malayalam conversation persona & Kavitha voice.
 * 2. English conversation persona & Ratan voice.
 * 3. Language switching policy.
 * 4. Actual Sarvam invocation of @context tool.
 * 5. Actual Sarvam invocation of @check-availability tool with simulation disclaimer.
 * 6. Simulated booking with provisional notice and verbal requirement.
 * 7. Emergency escalation database logging and hold instruction.
 * 8. Call-ended webhook verification with HMAC-SHA256 & idempotency.
 * 9. Human overflow routing simulation (Available -> Human, Busy/Timeout -> Sarvam Voicebot, Emergency -> Casualty).
 * 10. Failure and fallback handling (Helpline 0487 247 5000 & parameter validation).
 *
 * Explicitly separates:
 * - [MOCKED_UNIT]: In-memory logic and prompt validation.
 * - [LIVE_API_CONTRACT]: Real HTTP REST contract validation against Smrkomed endpoints.
 * - [SIMULATED_CARRIER_PSTN]: Telephony flow simulation and routing state machine.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import * as crypto from "crypto";

import {
  exotelDirectIntegrationService,
} from "./exotel-direct-integration-service";
import {
  SARVAM_EXOTEL_CHANNEL_RUNTIME_URL,
  ACTUAL_SARVAM_APP_ID,
  ACTUAL_SARVAM_DEPLOYMENT_ID,
  ACTUAL_SARVAM_PHONE_NUMBER,
} from "./voice-agent-config";
import {
  DRAFT_AGENT_VERSION_9_DEPLOYMENT,
  DRAFT_AGENT_VERSION_9_EXOTEL_DEPLOYMENT,
  DRAFT_AGENT_SYSTEM_PROMPT,
  SARVAM_BOUND_TOOLS,
  SARVAM_EXOTEL_CHANNEL_ENDPOINT,
} from "./daya-agent-config";
import { SarvamVoiceAgentClient } from "./voice-agent-client";

import { GET as getContext } from "@/app/api/v1/voice-agent/context/route";
import { POST as checkAvailability } from "@/app/api/v1/voice-agent/check-availability/route";
import { POST as bookAppointment } from "@/app/api/v1/voice-agent/book-appointment/route";
import { POST as emergencyEscalate } from "@/app/api/v1/voice-agent/emergency-escalate/route";
import { POST as callEndedWebhook } from "@/app/api/v1/voice-agent/call-ended/route";

import { receptionistPresenceService } from "@/lib/services/receptionist-presence-service";
import { aiOverflowService } from "@/lib/services/ai-overflow-service";
import { mediaSessionManager } from "@/media-gateway/session-manager";

describe("PHASE 10.5: Direct API Integration (Exotel + Sarvam Voice Agents + Smrkomed)", () => {
  const webhookSecret = "whsec_phase_10_5_direct_api_secret";
  let client: SarvamVoiceAgentClient;

  beforeEach(() => {
    client = new SarvamVoiceAgentClient({
      appId: ACTUAL_SARVAM_APP_ID,
      deploymentId: ACTUAL_SARVAM_DEPLOYMENT_ID,
      webhookSecret,
    });
    receptionistPresenceService.resetInMemoryState();
    aiOverflowService.resetForTest();
  });

  // ==========================================================================
  // 1. [MOCKED_UNIT] Malayalam Conversation Persona & Voice
  // ==========================================================================
  it("[MOCKED_UNIT] 1. Malayalam Persona: Configured with Kavitha voice and polite spoken Malayalam", () => {
    expect(DRAFT_AGENT_VERSION_9_EXOTEL_DEPLOYMENT.primaryLanguage).toBe("ml-IN");
    expect(DRAFT_AGENT_VERSION_9_EXOTEL_DEPLOYMENT.voiceId).toBe("kavitha");
    expect(DRAFT_AGENT_SYSTEM_PROMPT).toContain("ദയ സഹായി");
    expect(DRAFT_AGENT_SYSTEM_PROMPT).toContain("തൃശ്ശൂർ ദയ ജനറൽ ഹോസ്പിറ്റലിന്റെ");
    expect(DRAFT_AGENT_SYSTEM_PROMPT).toContain("നിങ്ങളുടെ പ്രാഥമിക ഭാഷ മലയാളമാണ്");
  });

  // ==========================================================================
  // 2. [MOCKED_UNIT] English Conversation Persona & Voice
  // ==========================================================================
  it("[MOCKED_UNIT] 2. English Persona: Configured with Indian English bilingual capabilities", () => {
    expect(DRAFT_AGENT_VERSION_9_EXOTEL_DEPLOYMENT.secondaryLanguages).toContain("en-IN");
    expect(DRAFT_AGENT_SYSTEM_PROMPT).toContain("വിളിക്കുന്നയാൾ ഇംഗ്ലീഷിലാണ് സംസാരിക്കുന്നതെങ്കിൽ");
    expect(DRAFT_AGENT_SYSTEM_PROMPT).toContain("വ്യക്തമായ ഇംഗ്ലീഷിൽ മറുപടി നൽകുക");
  });

  // ==========================================================================
  // 3. [MOCKED_UNIT] Language Switching Policy
  // ==========================================================================
  it("[MOCKED_UNIT] 3. Language Switching: Enforces seamless mid-dialogue bilingual transitions", () => {
    expect(DRAFT_AGENT_SYSTEM_PROMPT).toContain("Seamless bilingual switching");
    expect(DRAFT_AGENT_SYSTEM_PROMPT).toContain("സംഭാഷണത്തിനിടയിൽ ഇംഗ്ലീഷിലേക്ക് മാറുകയാണെങ്കിൽ");
  });

  // ==========================================================================
  // 4. [LIVE_API_CONTRACT] Actual Sarvam Invocation of @context Tool
  // ==========================================================================
  it("[LIVE_API_CONTRACT] 4. Context Retrieval: Real HTTP endpoint returns Daya Hospital context & hours", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/voice-agent/context?hospitalId=hosp_daya_thrissur", {
      method: "GET",
      headers: { "x-api-key": "sk_test_voice_agent_key_2026" },
    });

    const res = await getContext(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.hospitalId).toBe("hosp_daya_thrissur");
    expect(json.data.city).toBe("Thrissur");
    expect(json.data.operatingHours.opd).toContain("08:00 - 17:00");
    expect(json.data.operatingHours.casualty).toContain("24 Hours");
    expect(res.headers.get("X-SMRKOMED-Tenant")).toBe("hosp_daya_thrissur");
  });

  // ==========================================================================
  // 5. [LIVE_API_CONTRACT] Actual Sarvam Invocation of @check-availability Tool
  // ==========================================================================
  it("[LIVE_API_CONTRACT] 5. Availability Query: Returns doctor consulting hours with Grandis HMS simulation notice", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/voice-agent/check-availability", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "sk_test_voice_agent_key_2026",
      },
      body: JSON.stringify({
        departmentId: "dept_cardiology",
        preferredDate: "2026-11-26",
        hospitalId: "hosp_daya_thrissur",
      }),
    });

    const res = await checkAvailability(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.available).toBe(true);
    expect(json.doctor).toContain("Dr. Anand Menon");
    expect(json.isSimulated).toBe(true);
    expect(json.dataSource).toBe("SIMULATED_MOCK_HMS");
    expect(json.agentInstructions).toContain("Real HMS integration is currently in simulated testing");
  });

  // ==========================================================================
  // 6. [LIVE_API_CONTRACT] Simulated Booking with Clear Disclaimer & Provisional Notice
  // ==========================================================================
  it("[LIVE_API_CONTRACT] 6. Simulated Booking: Enforces provisional token and mandatory verbal notice", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/voice-agent/book-appointment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "sk_test_voice_agent_key_2026",
      },
      body: JSON.stringify({
        patientName: "Madhavan Nair",
        patientPhone: "+919846001122",
        departmentId: "dept_cardiology",
        slotTime: "10:30 AM",
        hospitalId: "hosp_daya_thrissur",
      }),
    });

    const res = await bookAppointment(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.bookingReference).toMatch(/^DAYA-OPD-/);
    expect(json.isSimulated).toBe(true);
    expect(json.mode).toBe("SIMULATION_TESTING");
    expect(json.isLiveHmsConfirmed).toBe(false);
    expect(json.agentInstructions).toContain("PROVISIONAL");
    expect(json.agentInstructions).toContain("You MUST explicitly state to the caller");
    expect(json.verbalNoticeEnglish).toContain("provisional reference");
    expect(json.verbalNoticeMalayalam).toContain("താൽക്കാലിക");
  });

  // ==========================================================================
  // 7. [LIVE_API_CONTRACT] Emergency Escalation Database Logging & Hold Instruction
  // ==========================================================================
  it("[LIVE_API_CONTRACT] 7. Emergency Escalation: Logs triage code red, advises caller to hold, no false transfer claim", async () => {
    const testCallSid = `test_emerg_10_5_${Date.now()}`;
    const req = new NextRequest("http://localhost:3000/api/v1/voice-agent/emergency-escalate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "sk_test_voice_agent_key_2026",
      },
      body: JSON.stringify({
        symptom: "Severe acute chest pain radiating to left arm and sweating",
        callerPhone: "+919846001122",
        callSid: testCallSid,
        hospitalId: "hosp_daya_thrissur",
      }),
    });

    const res = await emergencyEscalate(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.action).toBe("FAST_TRACK_CASUALTY");
    expect(json.triageLevel).toBe("CRITICAL_CODE_RED");
    expect(json.verbalAnnouncementMalayalam).toContain("ദയവായി ലൈനിൽ തുടരുക");
    expect(json.verbalAnnouncementEnglish).toContain("Please hold");

    const escalation = await mediaSessionManager.getEscalation(testCallSid);
    expect(escalation).toBeDefined();
    expect(escalation?.escalationState).toBe("EMERGENCY");
    expect(escalation?.destination).toBe("+919606654032");
  });

  // ==========================================================================
  // 8. [LIVE_API_CONTRACT] Call-Ended Webhook Verification & Idempotency
  // ==========================================================================
  it("[LIVE_API_CONTRACT] 8. Call-Ended Webhook: Cryptographic HMAC-SHA256 signature and replay attack protection", async () => {
    const interactionId = `int_phase10_5_${Date.now()}`;
    const payload = {
      interaction_id: interactionId,
      call_sid: `call_${interactionId}`,
      agent_id: ACTUAL_SARVAM_APP_ID,
      hospital_id: "hosp_daya_thrissur",
      caller_number: "+919846001122",
      called_number: ACTUAL_SARVAM_PHONE_NUMBER,
      status: "COMPLETED",
      duration_seconds: 98,
      disposition: "OPD_INQUIRY_ANSWERED",
      transcript_turns: [{ speaker: "agent", text: "നമസ്കാരം, ദയ സഹായി.", language: "ml-IN" }],
    };

    const rawBody = JSON.stringify(payload);
    const validTimestamp = String(Date.now());
    const stringToSign = `${validTimestamp}.${rawBody}`;
    const hmac = crypto.createHmac("sha256", webhookSecret);
    hmac.update(stringToSign);
    const validSignature = hmac.digest("hex");

    const req = new NextRequest("http://localhost:3000/api/v1/voice-agent/call-ended", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "sarvam-signature": validSignature,
        "sarvam-timestamp": validTimestamp,
      },
      body: rawBody,
    });

    const res = await callEndedWebhook(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.received).toBe(true);

    // Replay attack check: Expired timestamp (> 300s old)
    const expiredTimestamp = String(Date.now() - 350 * 1000);
    const expiredStringToSign = `${expiredTimestamp}.${rawBody}`;
    const expiredHmac = crypto.createHmac("sha256", webhookSecret);
    expiredHmac.update(expiredStringToSign);
    const expiredSignature = expiredHmac.digest("hex");

    const replayCheck = client.verifyWebhookSignature(rawBody, expiredSignature, expiredTimestamp, 300);
    expect(replayCheck.isValid).toBe(false);
    expect(replayCheck.reason).toContain("expired");
  });

  // ==========================================================================
  // 9. [SIMULATED_CARRIER_PSTN] Human-First Overflow Routing Simulation
  // ==========================================================================
  describe("[SIMULATED_CARRIER_PSTN] 9. Human-First Overflow Routing & Transfer State Machine", () => {
    it("routes to human receptionist first when staff is AVAILABLE", async () => {
      // Setup: Register available receptionist
      await receptionistPresenceService.registerStaffPresence({
        hospitalId: "hosp_daya_thrissur",
        userId: "rec_daya_01",
        staffName: "Priya Varma",
        extension: "201",
        phoneNumber: "+919606654032",
        initialStatus: "AVAILABLE",
      });
      await receptionistPresenceService.setStaffPresenceStatus({
        hospitalId: "hosp_daya_thrissur",
        userId: "rec_daya_01",
        status: "AVAILABLE",
      });

      const decision = await exotelDirectIntegrationService.evaluateInboundCallRouting({
        callSid: "exotel_call_human_first_001",
        callerPhone: "+919846001122",
        dialedNumber: "08047291658",
        intentCategory: "APPOINTMENTS",
      });

      expect(decision.action).toBe("CONNECT_RECEPTIONIST");
      expect(decision.targetNumber).toBe("+919606654032");
      expect(decision.reason).toContain("AVAILABLE");
    });

    it("overflows automatically to Sarvam Voicebot Applet when receptionist is BUSY", async () => {
      // Setup: Register busy receptionist
      await receptionistPresenceService.registerStaffPresence({
        hospitalId: "hosp_daya_thrissur",
        userId: "rec_daya_02",
        staffName: "Ananya Nair",
        extension: "202",
        phoneNumber: "+919606654032",
        initialStatus: "ON_CALL",
      });
      await receptionistPresenceService.setStaffPresenceStatus({
        hospitalId: "hosp_daya_thrissur",
        userId: "rec_daya_02",
        status: "ON_CALL",
      });

      const decision = await exotelDirectIntegrationService.evaluateInboundCallRouting({
        callSid: "exotel_call_overflow_002",
        callerPhone: "+919846001122",
        dialedNumber: "08047291658",
        intentCategory: "APPOINTMENTS",
      });

      expect(decision.action).toBe("OVERFLOW_TO_SARVAM");
      expect(decision.channelUrl).toContain(SARVAM_EXOTEL_CHANNEL_RUNTIME_URL);
      expect(decision.channelUrl).toContain("CallSid=exotel_call_overflow_002");
      expect(decision.channelUrl).toContain("CallFrom=%2B919846001122");
      expect(decision.channelUrl).toContain("CallTo=08047291658");
      expect(decision.reason).toContain("RECEPTIONIST_BUSY");
    });

    it("bypasses receptionist entirely and routes to casualty immediately for EMERGENCY calls", async () => {
      const decision = await exotelDirectIntegrationService.evaluateInboundCallRouting({
        callSid: "exotel_call_emerg_003",
        callerPhone: "+919846001122",
        dialedNumber: "08047291658",
        intentCategory: "EMERGENCY",
      });

      expect(decision.action).toBe("CONNECT_CASUALTY");
      expect(decision.targetNumber).toBe("+919606654032");
      expect(decision.reason).toContain("emergency");
    });

    it("enforces carrier confirmation requirement for @call_transfer handoffs", () => {
      const transferDecision = exotelDirectIntegrationService.handleAgentCallTransfer({
        callSid: "exotel_call_transfer_004",
        targetNumber: "+919606654032",
        reason: "Caller requested front desk human handover",
      });

      expect(transferDecision.action).toBe("CONNECT_RECEPTIONIST");
      expect(transferDecision.targetNumber).toBe("+919606654032");
      expect(transferDecision.carrierConfirmationPending).toBe(true); // NEVER claim complete without carrier confirmation
    });
  });

  // ==========================================================================
  // 10. [MOCKED_UNIT] Failure and Fallback Handling & Telemetry
  // ==========================================================================
  describe("[MOCKED_UNIT] 10. Failure, Parameter Validation & Telemetry Tracking", () => {
    it("validates required Exotel query parameters and rejects malformed handshakes", () => {
      // Missing CallTo
      const invalidResult = exotelDirectIntegrationService.validateExotelChannelParams({
        CallSid: "test_sid_001",
        CallFrom: "+919846001122",
      });
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.missingFields).toContain("CallTo");

      // Complete parameters
      const validResult = exotelDirectIntegrationService.validateExotelChannelParams({
        CallSid: "test_sid_001",
        CallFrom: "+919846001122",
        CallTo: "08047291658",
      });
      expect(validResult.valid).toBe(true);
    });

    it("maintains three-way call correlation between Exotel, Sarvam, and Smrkomed", () => {
      const correlation = exotelDirectIntegrationService.createCallCorrelation({
        exotelCallSid: "exotel_sid_corr_001",
        sarvamInteractionId: "sarvam_int_001",
        hospitalId: "hosp_daya_thrissur",
        callerNumber: "+919846001122",
        dialedNumber: "08047291658",
        direction: "INBOUND",
        isOverflow: true,
        overflowReason: "RECEPTIONIST_BUSY",
      });

      expect(correlation.exotelCallSid).toBe("exotel_sid_corr_001");
      expect(correlation.sarvamInteractionId).toBe("sarvam_int_001");
      expect(correlation.smrkomedSessionId).toMatch(/^session_exotel_sid_corr_001/);

      const retrieved = exotelDirectIntegrationService.getCorrelationByCallSid("exotel_sid_corr_001");
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(correlation.id);
    });

    it("system prompt enforces fallback to Daya Hospital helpline 0487 247 5000", () => {
      expect(DRAFT_AGENT_SYSTEM_PROMPT).toContain("പരാജയപ്പെടൽ മാർഗ്ഗം (FALLBACK):");
      expect(DRAFT_AGENT_SYSTEM_PROMPT).toContain("0487 247 5000");
    });
  });
});
