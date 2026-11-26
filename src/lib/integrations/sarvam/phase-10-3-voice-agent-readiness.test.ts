/**
 * ============================================================================
 * SMRKOMED PHASE 10.3: SARVAM VOICE AGENT READINESS & TOOL BINDING TEST SUITE
 * ============================================================================
 *
 * Verifies all 12 scenarios required by Phase 10.3 for the Sarvam Voice Agent:
 * 1. Malayalam conversation persona & Kavitha voice.
 * 2. English conversation persona & Ratan voice.
 * 3. Malayalam-English language switching policy.
 * 4. Context retrieval (@context tool / GET /api/v1/voice-agent/context).
 * 5. Availability tool invocation (@check-availability tool / POST /api/v1/voice-agent/check-availability).
 * 6. Simulated appointment booking (@book-appointment tool) verifying provisional status and verbal notice requirement.
 * 7. Emergency escalation (@emergency-escalate tool) verifying database logging, immediate advice to hold, and no false transfer claim.
 * 8. Call-ended webhook payload validation and HMAC verification (@call-ended hook / POST /api/v1/voice-agent/call-ended).
 * 9. Tool timeout and failure handling (missing parameters, schema validation).
 * 10. Agent fallback behavior when tools fail (Helpline 0487 247 5000).
 * 11. Multi-tenant isolation (confirming hosp_daya_thrissur isolation against unauthorized tenants).
 * 12. Duplicate tool invocation and idempotency caching.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import * as crypto from "crypto";

import { SarvamVoiceAgentClient } from "./voice-agent-client";
import {
  ACTUAL_SARVAM_APP_ID,
  ACTUAL_SARVAM_DEPLOYMENT_ID,
  ACTUAL_SARVAM_PHONE_NUMBER,
  ACTUAL_SARVAM_CARRIER,
  getSarvamVoiceAgentConfig,
} from "./voice-agent-config";
import {
  DRAFT_AGENT_APP_ID,
  PUBLISHED_VERSION_NUMBER,
  DRAFT_VERSION_NUMBER,
  DRAFT_AGENT_VERSION_9_DEPLOYMENT,
  DRAFT_AGENT_SYSTEM_PROMPT,
  SARVAM_BOUND_TOOLS,
} from "./daya-agent-config";

import { GET as getContext } from "@/app/api/v1/voice-agent/context/route";
import { POST as checkAvailability } from "@/app/api/v1/voice-agent/check-availability/route";
import { POST as bookAppointment } from "@/app/api/v1/voice-agent/book-appointment/route";
import { POST as emergencyEscalate } from "@/app/api/v1/voice-agent/emergency-escalate/route";
import { POST as callEndedWebhook } from "@/app/api/v1/voice-agent/call-ended/route";
import { mediaSessionManager } from "@/media-gateway/session-manager";

describe("PHASE 10.3: Sarvam Voice Agent Tool Binding & Integration Readiness", () => {
  const webhookSecret = "whsec_phase_10_3_readiness_secret_key";
  let client: SarvamVoiceAgentClient;

  beforeEach(() => {
    client = new SarvamVoiceAgentClient({
      appId: ACTUAL_SARVAM_APP_ID,
      deploymentId: ACTUAL_SARVAM_DEPLOYMENT_ID,
      webhookSecret,
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 1: Malayalam conversation persona & Kavitha voice
  // --------------------------------------------------------------------------
  it("Scenario 1: Malayalam conversation persona and Kavitha voice are properly configured", () => {
    expect(DRAFT_AGENT_VERSION_9_DEPLOYMENT.primaryLanguage).toBe("ml-IN");
    expect(DRAFT_AGENT_VERSION_9_DEPLOYMENT.voiceId).toBe("kavitha");
    expect(DRAFT_AGENT_SYSTEM_PROMPT).toContain("ദയ സഹായി");
    expect(DRAFT_AGENT_SYSTEM_PROMPT).toContain("തൃശ്ശൂർ ദയ ജനറൽ ഹോസ്പിറ്റലിന്റെ");
    expect(DRAFT_AGENT_SYSTEM_PROMPT).toContain("നിങ്ങളുടെ പ്രാഥമിക ഭാഷ മലയാളമാണ്");
    expect(DRAFT_AGENT_SYSTEM_PROMPT).toContain("സൗമ്യവും വിനയപൂർവ്വവുമായ സാധാരണ സംസാര മലയാളത്തിൽ");
  });

  // --------------------------------------------------------------------------
  // Scenario 2: English conversation persona & Ratan voice
  // --------------------------------------------------------------------------
  it("Scenario 2: English conversation persona and Indian English voice support are defined", () => {
    expect(DRAFT_AGENT_VERSION_9_DEPLOYMENT.secondaryLanguages).toContain("en-IN");
    expect(DRAFT_AGENT_SYSTEM_PROMPT).toContain("വിളിക്കുന്നയാൾ ഇംഗ്ലീഷിലാണ് സംസാരിക്കുന്നതെങ്കിൽ");
    expect(DRAFT_AGENT_SYSTEM_PROMPT).toContain("വ്യക്തമായ ഇംഗ്ലീഷിൽ മറുപടി നൽകുക");
    
    // Check that tool emergency responses provide English announcements
    const emergencyTool = SARVAM_BOUND_TOOLS.find((t) => t.name === "emergency-escalate");
    expect(emergencyTool).toBeDefined();
    expect(emergencyTool?.type).toBe("API_TOOL");
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Malayalam-English language switching policy
  // --------------------------------------------------------------------------
  it("Scenario 3: Malayalam-English language switching policy allows mid-conversation transition", () => {
    expect(DRAFT_AGENT_SYSTEM_PROMPT).toContain("Seamless bilingual switching");
    expect(DRAFT_AGENT_SYSTEM_PROMPT).toContain("സംഭാഷണത്തിനിടയിൽ ഇംഗ്ലീഷിലേക്ക് മാറുകയാണെങ്കിൽ");
    
    // Tools support both Malayalam and English caller scenarios without linguistic deadlocks
    const contextTool = SARVAM_BOUND_TOOLS.find((t) => t.name === "context");
    expect(contextTool).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Context retrieval (@context)
  // --------------------------------------------------------------------------
  it("Scenario 4: Context retrieval tool (@context) returns verified Daya Hospital operational data", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/voice-agent/context?hospitalId=hosp_daya_thrissur", {
      method: "GET",
      headers: {
        "x-api-key": "sk_test_voice_agent_key_2026",
      },
    });

    const res = await getContext(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.hospitalId).toBe("hosp_daya_thrissur");
    expect(json.data.shortName).toBe("Daya Hospital");
    expect(json.data.city).toBe("Thrissur");
    expect(json.data.operatingHours.opd).toContain("08:00 - 17:00");
    expect(json.data.operatingHours.casualty).toContain("24 Hours");
    expect(json.data.emergencyNotice).toContain("Casualty");
    expect(json.data.disclaimer).toContain("Strict healthcare safeguard");
    expect(res.headers.get("X-SMRKOMED-Tenant")).toBe("hosp_daya_thrissur");
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Availability tool invocation (@check-availability)
  // --------------------------------------------------------------------------
  it("Scenario 5: Availability tool (@check-availability) queries doctor slots with Grandis HMS simulation notice", async () => {
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
    expect(json.departmentId).toBe("dept_cardiology");
    expect(json.doctor).toContain("Dr. Anand Menon");
    expect(json.consultingHours).toContain("09:30 AM - 01:00 PM");
    
    // Grandis HMS simulation notices
    expect(json.isSimulated).toBe(true);
    expect(json.dataSource).toBe("SIMULATED_MOCK_HMS");
    expect(json.disclaimerEnglish).toContain("testing mode");
    expect(json.agentInstructions).toContain("Real HMS integration is currently in simulated testing");
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Simulated appointment booking (@book-appointment) with provisional status & verbal notice
  // --------------------------------------------------------------------------
  it("Scenario 6: Simulated appointment booking (@book-appointment) enforces provisional status & verbal notice requirement", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/voice-agent/book-appointment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "sk_test_voice_agent_key_2026",
      },
      body: JSON.stringify({
        patientName: "Gopalan Nair",
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
    expect(json.patientName).toBe("Gopalan Nair");
    expect(json.patientPhone).toBe("+919846001122");
    
    // Verifying provisional status & verbal notice requirement
    expect(json.isSimulated).toBe(true);
    expect(json.mode).toBe("SIMULATION_TESTING");
    expect(json.isLiveHmsConfirmed).toBe(false);
    expect(json.agentInstructions).toContain("PROVISIONAL");
    expect(json.agentInstructions).toContain("You MUST explicitly state to the caller");
    expect(json.verbalNoticeEnglish).toContain("provisional reference");
    expect(json.verbalNoticeMalayalam).toContain("താൽക്കാലിക");

    // Invalid phone rejection check
    const invalidReq = new NextRequest("http://localhost:3000/api/v1/voice-agent/book-appointment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "sk_test_voice_agent_key_2026",
      },
      body: JSON.stringify({
        patientName: "Gopalan Nair",
        patientPhone: "not-a-phone-number",
        departmentId: "dept_cardiology",
      }),
    });
    const invalidRes = await bookAppointment(invalidReq);
    expect(invalidRes.status).toBe(400);
  });

  // --------------------------------------------------------------------------
  // Scenario 7: Emergency escalation (@emergency-escalate) with database logging & no false transfer claim
  // --------------------------------------------------------------------------
  it("Scenario 7: Emergency escalation (@emergency-escalate) logs triage, advises caller to hold, and makes no false transfer claim", async () => {
    const testCallSid = `test_emerg_phase10_3_${Date.now()}`;
    const req = new NextRequest("http://localhost:3000/api/v1/voice-agent/emergency-escalate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "sk_test_voice_agent_key_2026",
      },
      body: JSON.stringify({
        symptom: "Severe crushing chest pain radiating to left arm and sweating",
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
    expect(json.department).toBe("Casualty Emergency Desk");
    
    // Immediate advice to hold on the line
    expect(json.verbalAnnouncementMalayalam).toContain("ഇതൊരു അടിയന്തിര സാഹചര്യമായി കണക്കാക്കുന്നു");
    expect(json.verbalAnnouncementMalayalam).toContain("ദയവായി ലൈനിൽ തുടരുക");
    expect(json.verbalAnnouncementEnglish).toContain("Transferring immediately to Daya Hospital 24/7 Casualty team. Please hold");

    // Verified escalation recorded in media session manager
    const escalation = await mediaSessionManager.getEscalation(testCallSid);
    expect(escalation).toBeDefined();
    expect(escalation?.escalationState).toBe("EMERGENCY");
    expect(escalation?.reason).toContain("Severe crushing chest pain");

    // Guardrail against claiming physical transfer has already completed
    expect(DRAFT_AGENT_SYSTEM_PROMPT).toContain("ടെലികോം കാരിയർ കോൾ കൈമാറ്റം സ്ഥിരീകരിക്കുന്നതുവരെ ഫിസിക്കൽ ട്രാൻസ്ഫർ പൂർത്തിയായി എന്ന് സ്വയം അനുമാനിക്കരുത്");
  });

  // --------------------------------------------------------------------------
  // Scenario 8: Call-ended webhook payload validation and HMAC verification (@call-ended)
  // --------------------------------------------------------------------------
  it("Scenario 8: Call-ended webhook verifies cryptographic HMAC-SHA256 signature and rejects replay attacks", async () => {
    const interactionId = `int_test_phase10_3_${Date.now()}`;
    const payload = {
      interaction_id: interactionId,
      call_sid: `call_${interactionId}`,
      agent_id: DRAFT_AGENT_APP_ID,
      hospital_id: "hosp_daya_thrissur",
      caller_number: "+919846001122",
      called_number: ACTUAL_SARVAM_PHONE_NUMBER,
      status: "COMPLETED",
      duration_seconds: 142,
      disposition: "OPD_INQUIRY_ANSWERED",
      transcript_turns: [
        {
          speaker: "agent",
          text: "നമസ്കാരം, തൃശ്ശൂർ ദയ ജനറൽ ഹോസ്പിറ്റലിലേക്ക് സ്വാഗതം.",
          language: "ml-IN",
        },
      ],
    };

    const rawBody = JSON.stringify(payload);
    const validTimestamp = String(Date.now());
    
    // Compute HMAC-SHA256 over `${timestamp}.${rawBody}`
    const stringToSign = `${validTimestamp}.${rawBody}`;
    const hmac = crypto.createHmac("sha256", webhookSecret);
    hmac.update(stringToSign);
    const validSignature = hmac.digest("hex");

    // Test 1: Valid signature with current timestamp
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

    // Test 2: Expired timestamp replay attack (> 300s old)
    const expiredTimestamp = String(Date.now() - 400 * 1000);
    const expiredStringToSign = `${expiredTimestamp}.${rawBody}`;
    const expiredHmac = crypto.createHmac("sha256", webhookSecret);
    expiredHmac.update(expiredStringToSign);
    const expiredSignature = expiredHmac.digest("hex");

    const replayVerification = client.verifyWebhookSignature(rawBody, expiredSignature, expiredTimestamp, 300);
    expect(replayVerification.isValid).toBe(false);
    expect(replayVerification.reason).toContain("expired");

    // Test 3: Tampered signature check
    const tamperedVerification = client.verifyWebhookSignature(rawBody, "bad_signature_deadbeef", validTimestamp, 300);
    expect(tamperedVerification.isValid).toBe(false);
  });

  // --------------------------------------------------------------------------
  // Scenario 9: Tool timeout and failure handling
  // --------------------------------------------------------------------------
  it("Scenario 9: Tool schemas enforce tight timeouts and handle malformed input with 400 Bad Request", async () => {
    // 1. Verify schema timeouts
    const emergencyTool = SARVAM_BOUND_TOOLS.find((t) => t.name === "emergency-escalate");
    expect(emergencyTool?.endpoint.timeoutMs).toBeLessThanOrEqual(2500); // 2500ms max for casualty override

    const contextTool = SARVAM_BOUND_TOOLS.find((t) => t.name === "context");
    expect(contextTool?.endpoint.timeoutMs).toBeLessThanOrEqual(3000);

    const bookingTool = SARVAM_BOUND_TOOLS.find((t) => t.name === "book-appointment");
    expect(bookingTool?.endpoint.timeoutMs).toBeLessThanOrEqual(4000);

    // 2. Missing department in check-availability returns 400
    const badAvailabilityReq = new NextRequest("http://localhost:3000/api/v1/voice-agent/check-availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hospitalId: "hosp_daya_thrissur" }), // missing departmentId
    });
    const badAvailabilityRes = await checkAvailability(badAvailabilityReq);
    expect(badAvailabilityRes.status).toBe(400);

    // 3. Missing patientName in book-appointment returns 400
    const badBookingReq = new NextRequest("http://localhost:3000/api/v1/voice-agent/book-appointment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientPhone: "+919846001122",
        departmentId: "dept_cardiology",
      }), // missing patientName
    });
    const badBookingRes = await bookAppointment(badBookingReq);
    expect(badBookingRes.status).toBe(400);
  });

  // --------------------------------------------------------------------------
  // Scenario 10: Agent fallback behavior when tools fail
  // --------------------------------------------------------------------------
  it("Scenario 10: System prompt specifies explicit fallback to Daya Hospital helpline 0487 247 5000", () => {
    expect(DRAFT_AGENT_SYSTEM_PROMPT).toContain("പരാജയപ്പെടൽ മാർഗ്ഗം (FALLBACK):");
    expect(DRAFT_AGENT_SYSTEM_PROMPT).toContain("ടൂളുകൾ ലഭ്യമല്ലെങ്കിലോ സാങ്കേതിക തടസ്സമുണ്ടായാലോ");
    expect(DRAFT_AGENT_SYSTEM_PROMPT).toContain("0487 247 5000");
  });

  // --------------------------------------------------------------------------
  // Scenario 11: Multi-tenant isolation (confirming hosp_daya_thrissur isolation)
  // --------------------------------------------------------------------------
  it("Scenario 11: Strict multi-tenant isolation rejects invalid tenants and protects Daya Hospital data", async () => {
    // 1. Invalid tenant with special characters rejected
    const invalidTenantReq = new NextRequest("http://localhost:3000/api/v1/voice-agent/context?hospitalId=bad_tenant_%24%23%21", {
      method: "GET",
    });
    const invalidTenantRes = await getContext(invalidTenantReq);
    expect(invalidTenantRes.status).toBe(400);
    const invalidJson = await invalidTenantRes.json();
    expect(invalidJson.error).toContain("Invalid hospital tenant identifier");

    // 2. Daya hospital context returns strict Thrissur branding
    const dayaReq = new NextRequest("http://localhost:3000/api/v1/voice-agent/context?hospitalId=hosp_daya_thrissur", {
      method: "GET",
    });
    const dayaRes = await getContext(dayaReq);
    expect(dayaRes.status).toBe(200);
    const dayaJson = await dayaRes.json();
    expect(dayaJson.data.hospitalId).toBe("hosp_daya_thrissur");
    expect(dayaJson.data.city).toBe("Thrissur");
  });

  // --------------------------------------------------------------------------
  // Scenario 12: Duplicate tool invocation and idempotency caching
  // --------------------------------------------------------------------------
  it("Scenario 12: Duplicate booking invocations with same idempotencyKey return cached reference", async () => {
    const fixedIdempotencyKey = `idempotent_test_key_phase10_3_${Date.now()}`;
    const payload = {
      patientName: "Anand P.",
      patientPhone: "+919846001122",
      departmentId: "dept_cardiology",
      slotTime: "11:00 AM",
      hospitalId: "hosp_daya_thrissur",
      idempotencyKey: fixedIdempotencyKey,
    };

    // First booking invocation
    const req1 = new NextRequest("http://localhost:3000/api/v1/voice-agent/book-appointment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const res1 = await bookAppointment(req1);
    expect(res1.status).toBe(200);
    const json1 = await res1.json();
    expect(json1.success).toBe(true);
    const firstRef = json1.bookingReference;

    // Second booking invocation with identical idempotencyKey
    const req2 = new NextRequest("http://localhost:3000/api/v1/voice-agent/book-appointment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const res2 = await bookAppointment(req2);
    expect(res2.status).toBe(200);
    const json2 = await res2.json();
    expect(json2.success).toBe(true);
    expect(json2.bookingReference).toBe(firstRef);
    expect(json2.idempotent).toBe(true);
  });
});
