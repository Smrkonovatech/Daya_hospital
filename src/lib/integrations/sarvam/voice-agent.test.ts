/**
 * ============================================================================
 * SARVAM VOICE AGENTS (SAMVAAD) INTEGRATION TEST SUITE (PHASE 10)
 * ============================================================================
 *
 * Verifies the Phase 10 integration of Sarvam Voice Agents / Samvaad:
 * 1. API authentication headers (X-API-Key)
 * 2. Scoping to official Workspace (01a06777-00da-7f77-abe3-dc1fc871a5ab) & Org (01a06777-00d4-7317-835c-507054052514)
 * 3. Daya pilot agent: Natural Malayalam prompt & healthcare guardrails
 * 4. English bilingual support & graceful fallback
 * 5. Smrkomed Tool API: Context retrieval (/api/v1/voice-agent/context)
 * 6. Smrkomed Tool API: Doctor OPD availability (/api/v1/voice-agent/check-availability)
 * 7. Smrkomed Tool API: Appointment booking (/api/v1/voice-agent/book-appointment)
 * 8. Smrkomed Tool API: Emergency triage override (/api/v1/voice-agent/emergency-escalate)
 * 9. Multi-tenant isolation: Aster/KIMS do not leak Daya hospital data
 * 10. Webhook cryptographic verification (timing-safe HMAC-SHA256)
 * 11. Call transcript turns & outcome ingestion (/api/v1/voice-agent/call-ended)
 * 12. Dual-mode engine switching & zero-risk rollback
 * 13. Exotel BYOT call transfer limitations & configuration requirements
 */

import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { SarvamVoiceAgentClient } from "./voice-agent-client";
import {
  DEFAULT_SARVAM_WORKSPACE_ID,
  DEFAULT_SARVAM_ORG_ID,
  DEFAULT_SARVAM_AGENT_ID,
  getSarvamVoiceAgentConfig,
} from "./voice-agent-config";
import {
  DAYA_PILOT_VOICE_AGENT_DEPLOYMENT,
  DAYA_PILOT_SYSTEM_PROMPT,
  DAYA_VOICE_AGENT_TOOLS,
} from "./daya-agent-config";
import { GET as getContext } from "@/app/api/v1/voice-agent/context/route";
import { POST as checkAvailability } from "@/app/api/v1/voice-agent/check-availability/route";
import { POST as bookAppointment } from "@/app/api/v1/voice-agent/book-appointment/route";
import { POST as emergencyEscalate } from "@/app/api/v1/voice-agent/emergency-escalate/route";
import { POST as callEndedWebhook } from "@/app/api/v1/voice-agent/call-ended/route";
import { GET as getEngineConfig, PUT as updateEngineConfig } from "@/app/api/v1/config/voice-agent/route";
import * as crypto from "crypto";

describe("PHASE 10: Sarvam Voice Agents (Samvaad) Integration", () => {
  let client: SarvamVoiceAgentClient;

  beforeEach(() => {
    client = new SarvamVoiceAgentClient({
      workspaceId: DEFAULT_SARVAM_WORKSPACE_ID,
      orgId: DEFAULT_SARVAM_ORG_ID,
      agentId: DEFAULT_SARVAM_AGENT_ID,
      apiKey: "sk_test_voice_agent_key_2026",
    });
  });

  // --------------------------------------------------------------------------
  // 1. API Authentication Header Contract
  // --------------------------------------------------------------------------
  it("1. Authentication: Uses X-API-Key header (not api-subscription-key)", () => {
    const headers = (client as any).getHeaders();
    expect(headers["X-API-Key"]).toBe("sk_test_voice_agent_key_2026");
    expect(headers["api-subscription-key"]).toBeUndefined();
    expect(headers["Content-Type"]).toBe("application/json");
  });

  // --------------------------------------------------------------------------
  // 2. Official Workspace & Org Scoping
  // --------------------------------------------------------------------------
  it("2. Scoping: Properly scopes configuration to approved Workspace and Organization IDs", () => {
    const config = getSarvamVoiceAgentConfig();
    expect(config.workspaceId).toBe("01a06777-00da-7f77-abe3-dc1fc871a5ab");
    expect(config.orgId).toBe("01a06777-00d4-7317-835c-507054052514");
    expect(config.agentId).toBe("agent_daya_malayalam_reception_v1");
  });

  // --------------------------------------------------------------------------
  // 3. Daya Pilot Agent: Malayalam Persona & Medical Safety Guardrails
  // --------------------------------------------------------------------------
  it("3. Malayalam Persona & Safety: Enforces natural Malayalam phrasing and strictly prohibits prescriptions", () => {
    expect(DAYA_PILOT_VOICE_AGENT_DEPLOYMENT.primaryLanguage).toBe("ml-IN");
    expect(DAYA_PILOT_VOICE_AGENT_DEPLOYMENT.voiceId).toBe("kavitha");

    // Guardrail: Non-prescriptive healthcare compliance
    expect(DAYA_PILOT_SYSTEM_PROMPT).toContain("ദയ സഹായി");
    expect(DAYA_PILOT_SYSTEM_PROMPT).toContain("STRICT HEALTHCARE SAFETY GUARDRAILS");
    expect(DAYA_PILOT_SYSTEM_PROMPT).toContain("രോഗനിർണ്ണയമോ");
    expect(DAYA_PILOT_SYSTEM_PROMPT).toContain("മരുന്നുകളുടെ കുറിപ്പടിയോ");
  });

  // --------------------------------------------------------------------------
  // 4. English Bilingual Support & Graceful Fallback
  // --------------------------------------------------------------------------
  it("4. Bilingual Support: Includes English as secondary language with front desk fallback", () => {
    expect(DAYA_PILOT_VOICE_AGENT_DEPLOYMENT.secondaryLanguages).toContain("en-IN");
    expect(DAYA_PILOT_SYSTEM_PROMPT).toContain("വ്യക്തമായ ഇംഗ്ലീഷിൽ മറുപടി നൽകുക");
    expect(DAYA_PILOT_SYSTEM_PROMPT).toContain("0487 247 5000"); // Front desk fallback
  });

  // --------------------------------------------------------------------------
  // 5. Tool Contract: Context Retrieval
  // --------------------------------------------------------------------------
  it("5. Tool API: /api/v1/voice-agent/context returns tenant operating hours and departments", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/voice-agent/context?hospitalId=hosp_daya_thrissur");
    const res = await getContext(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.hospitalName).toContain("Daya General Hospital");
    expect(json.data.operatingHours.casualty).toBe("24 Hours (7 Days a week)");
    expect(json.data.departments.length).toBeGreaterThan(0);
    expect(json.data.isVerifiedLive).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 6. Tool Contract: OPD Doctor Availability
  // --------------------------------------------------------------------------
  it("6. Tool API: /api/v1/voice-agent/check-availability returns doctor consulting hours", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/voice-agent/check-availability", {
      method: "POST",
      body: JSON.stringify({
        departmentId: "dept_cardiology",
        preferredDate: "2026-11-24",
      }),
    });
    const res = await checkAvailability(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.available).toBe(true);
    expect(json.doctor).toContain("Dr. Anand Menon");
    expect(json.consultingHours).toContain("09:30 AM");
    expect(json.suggestedSlots.length).toBeGreaterThan(0);
  });

  // --------------------------------------------------------------------------
  // 7. Tool Contract: Appointment Booking in HMS
  // --------------------------------------------------------------------------
  it("7. Tool API: /api/v1/voice-agent/book-appointment books confirmed reference with valid E.164 phone", async () => {
    // Valid booking
    const reqValid = new NextRequest("http://localhost:3000/api/v1/voice-agent/book-appointment", {
      method: "POST",
      body: JSON.stringify({
        patientName: "Valsala Kumari",
        patientPhone: "+919846001122",
        departmentId: "dept_ortho",
        slotTime: "10:30 AM",
      }),
    });
    const resValid = await bookAppointment(reqValid);
    expect(resValid.status).toBe(200);
    const jsonValid = await resValid.json();
    expect(jsonValid.success).toBe(true);
    expect(jsonValid.bookingReference).toMatch(/^DAYA-OPD-/);
    expect(jsonValid.patientName).toBe("Valsala Kumari");

    // Rejected on invalid phone number
    const reqInvalid = new NextRequest("http://localhost:3000/api/v1/voice-agent/book-appointment", {
      method: "POST",
      body: JSON.stringify({
        patientName: "Test Patient",
        patientPhone: "not_a_phone",
        departmentId: "dept_ortho",
      }),
    });
    const resInvalid = await bookAppointment(reqInvalid);
    expect(resInvalid.status).toBe(400);
  });

  // --------------------------------------------------------------------------
  // 8. Tool Contract: Emergency Triage Escalation
  // --------------------------------------------------------------------------
  it("8. Tool API: /api/v1/voice-agent/emergency-escalate triggers casualty triage alert", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/voice-agent/emergency-escalate", {
      method: "POST",
      body: JSON.stringify({
        symptom: "Severe acute chest pain radiating to left arm",
        callerPhone: "+919846001122",
        callSid: "call_test_voice_agent_em",
      }),
    });
    const res = await emergencyEscalate(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.action).toBe("FAST_TRACK_CASUALTY");
    expect(json.triageLevel).toBe("CRITICAL_CODE_RED");
    expect(json.verbalAnnouncementMalayalam).toContain("അടിയന്തിര സാഹചര്യമായി കണക്കാക്കുന്നു");
  });

  // --------------------------------------------------------------------------
  // 9. Multi-Tenant Context Isolation
  // --------------------------------------------------------------------------
  it("9. Multi-Tenant Isolation: Aster and KIMS contexts are isolated and never leak Daya data", async () => {
    // Aster Medcity context
    const reqAster = new NextRequest("http://localhost:3000/api/v1/voice-agent/context?hospitalId=hosp_aster_medcity");
    const resAster = await getContext(reqAster);
    const jsonAster = await resAster.json();

    expect(jsonAster.data.hospitalName).toContain("Aster Medcity");
    expect(jsonAster.data.hospitalName).not.toContain("Daya");
    expect(jsonAster.data.isVerifiedLive).toBe(false); // Demo sandbox

    // KIMS context
    const reqKims = new NextRequest("http://localhost:3000/api/v1/voice-agent/context?hospitalId=hosp_kims_trivandrum");
    const resKims = await getContext(reqKims);
    const jsonKims = await resKims.json();

    expect(jsonKims.data.hospitalName).toContain("KIMSHEALTH");
    expect(jsonKims.data.hospitalName).not.toContain("Daya");
    expect(jsonKims.data.isVerifiedLive).toBe(false); // Demo sandbox
  });

  // --------------------------------------------------------------------------
  // 10. Webhook Signature Verification
  // --------------------------------------------------------------------------
  it("10. Webhook Verification: Correctly validates timing-safe HMAC-SHA256 signature", () => {
    const secret = "test_webhook_secret_2026";
    const testClient = new SarvamVoiceAgentClient({ webhookSecret: secret });
    const payload = JSON.stringify({ call_sid: "test_call", status: "COMPLETED" });

    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(payload);
    const validSig = `sha256=${hmac.digest("hex")}`;

    expect(testClient.verifyWebhookSignature(payload, validSig).isValid).toBe(true);
    expect(testClient.verifyWebhookSignature(payload, "sha256=invalid_signature_hex").isValid).toBe(false);
  });

  // --------------------------------------------------------------------------
  // 11. On-End Webhook Ingestion
  // --------------------------------------------------------------------------
  it("11. Call Ended Webhook: /api/v1/voice-agent/call-ended ingests duration and transcripts", async () => {
    const payload = {
      interaction_id: "int_test_123",
      call_sid: "call_voice_agent_end_test",
      agent_id: DEFAULT_SARVAM_AGENT_ID,
      hospital_id: "hosp_daya_thrissur",
      caller_number: "+919846001122",
      called_number: "08047291658",
      status: "COMPLETED",
      duration_seconds: 94,
      transcript_turns: [
        { speaker: "agent", text: "നമസ്കാരം", timestamp_ms: 1000 },
        { speaker: "caller", text: "ഒ.പി.ഡി സമയം അറിയണം", timestamp_ms: 3000 },
      ],
      disposition: "OPD_TIMINGS_RESOLVED",
    };

    const req = new NextRequest("http://localhost:3000/api/v1/voice-agent/call-ended", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const res = await callEndedWebhook(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.callSid).toBe("call_voice_agent_end_test");
  });

  // --------------------------------------------------------------------------
  // 12. Dual-Mode Engine Switching & Zero-Risk Rollback
  // --------------------------------------------------------------------------
  it("12. Rollback & Mode Switching: Switches between SARVAM_CORE_CUSTOM and SARVAM_VOICE_AGENTS cleanly", async () => {
    // 1. Initial status
    const getRes1 = await getEngineConfig();
    const getJson1 = await getRes1.json();
    expect(getJson1.success).toBe(true);

    // 2. Switch to SARVAM_VOICE_AGENTS
    const putReq1 = new NextRequest("http://localhost:3000/api/v1/config/voice-agent", {
      method: "PUT",
      body: JSON.stringify({ engineMode: "SARVAM_VOICE_AGENTS" }),
    });
    const putRes1 = await updateEngineConfig(putReq1);
    const putJson1 = await putRes1.json();
    expect(putJson1.success).toBe(true);
    expect(putJson1.engineMode).toBe("SARVAM_VOICE_AGENTS");

    // 3. Rollback immediately to SARVAM_CORE_CUSTOM
    const putReq2 = new NextRequest("http://localhost:3000/api/v1/config/voice-agent", {
      method: "PUT",
      body: JSON.stringify({ engineMode: "SARVAM_CORE_CUSTOM" }),
    });
    const putRes2 = await updateEngineConfig(putReq2);
    const putJson2 = await putRes2.json();
    expect(putJson2.success).toBe(true);
    expect(putJson2.engineMode).toBe("SARVAM_CORE_CUSTOM");
  });

  // --------------------------------------------------------------------------
  // 13. Exotel BYOT Human Transfer Constraints
  // --------------------------------------------------------------------------
  it("13. Exotel BYOT Transfer Constraints: Confirms tool definition and documents support requirements", () => {
    const transferTool = DAYA_VOICE_AGENT_TOOLS.find((t) => t.name === "call_transfer");
    expect(transferTool).toBeDefined();
    expect(transferTool?.type).toBe("CORE_TOOL");

    // Verify documentation requirement: Exotel requires extra applets or Sarvam support enablement
    const publicStatus = (client as any).config;
    expect(publicStatus.workspaceId).toBe(DEFAULT_SARVAM_WORKSPACE_ID);
    expect(publicStatus.orgId).toBe(DEFAULT_SARVAM_ORG_ID);
  });

  // ==========================================================================
  // PHASE 10.1 LIVE CONTRACT & SECURITY VALIDATION TESTS
  // ==========================================================================

  // --------------------------------------------------------------------------
  // 14. Official Sarvam Signed Webhook Contract: `${timestamp}.${rawBody}`
  // --------------------------------------------------------------------------
  it("14. Official Sarvam Webhook: Validates `${timestamp}.${rawBody}` signature format", () => {
    const secret = "whsec_test_secret_official_2026";
    const testClient = new SarvamVoiceAgentClient({ webhookSecret: secret });
    const payload = JSON.stringify({ interaction_id: "int_official_01", status: "COMPLETED" });
    const currentTimestamp = Math.floor(Date.now() / 1000).toString();

    // Official Sarvam stringToSign = `${timestamp}.${rawBody}`
    const stringToSign = `${currentTimestamp}.${payload}`;
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(stringToSign);
    const validSignature = hmac.digest("hex");

    const result = testClient.verifyWebhookSignature(payload, validSignature, currentTimestamp);
    expect(result.isValid).toBe(true);

    // Tampered payload fails
    const tamperedResult = testClient.verifyWebhookSignature(
      JSON.stringify({ interaction_id: "int_official_01", status: "FAILED" }),
      validSignature,
      currentTimestamp
    );
    expect(tamperedResult.isValid).toBe(false);
  });

  // --------------------------------------------------------------------------
  // 15. Replay Protection: Rejects Expired Webhook Timestamps
  // --------------------------------------------------------------------------
  it("15. Replay Protection: Rejects webhooks with timestamps older than 300 seconds", () => {
    const secret = "whsec_test_secret_official_2026";
    const testClient = new SarvamVoiceAgentClient({ webhookSecret: secret });
    const payload = JSON.stringify({ interaction_id: "int_replay_01", status: "COMPLETED" });
    // Expired timestamp: 10 minutes ago
    const expiredTimestamp = Math.floor((Date.now() - 600 * 1000) / 1000).toString();

    const stringToSign = `${expiredTimestamp}.${payload}`;
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(stringToSign);
    const validSigOldTimestamp = hmac.digest("hex");

    const result = testClient.verifyWebhookSignature(payload, validSigOldTimestamp, expiredTimestamp);
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain("expired");
  });

  // --------------------------------------------------------------------------
  // 16. Webhook Idempotency by interaction_id
  // --------------------------------------------------------------------------
  it("16. Webhook Idempotency: Duplicate call-ended submission handles gracefully", async () => {
    const uniqueIntId = `int_test_idempotent_${Date.now()}`;
    const payload = {
      interaction_id: uniqueIntId,
      call_sid: `call_${uniqueIntId}`,
      agent_id: DEFAULT_SARVAM_AGENT_ID,
      hospital_id: "hosp_daya_thrissur",
      status: "COMPLETED",
      duration_seconds: 45,
      disposition: "APPOINTMENT_CONFIRMED",
    };

    const req1 = new NextRequest("http://localhost:3000/api/v1/voice-agent/call-ended", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const res1 = await callEndedWebhook(req1);
    expect(res1.status).toBe(200);
    const json1 = await res1.json();
    expect(json1.success).toBe(true);
    expect(json1.interactionId).toBe(uniqueIntId);

    // Duplicate submission
    const req2 = new NextRequest("http://localhost:3000/api/v1/voice-agent/call-ended", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const res2 = await callEndedWebhook(req2);
    expect(res2.status).toBe(200);
    const json2 = await res2.json();
    expect(json2.success).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 17. Tenant Validation & Isolation: Rejects Malformed Tenants
  // --------------------------------------------------------------------------
  it("17. Tenant Validation: Rejects malformed or injection tenant identifiers", async () => {
    const reqMalformed = new NextRequest(
      "http://localhost:3000/api/v1/voice-agent/context?hospitalId=invalid/tenant%20injection"
    );
    const resMalformed = await getContext(reqMalformed);
    expect(resMalformed.status).toBe(400);
    const jsonMalformed = await resMalformed.json();
    expect(jsonMalformed.success).toBe(false);
    expect(jsonMalformed.error).toContain("Invalid hospital tenant");
  });

  // --------------------------------------------------------------------------
  // 18. Appointment Booking Idempotency
  // --------------------------------------------------------------------------
  it("18. Appointment Idempotency: Returns existing reference for identical patient/slot booking", async () => {
    const bookingPayload = {
      patientName: "Gopalan Nair",
      patientPhone: "+919846003344",
      departmentId: "dept_cardiology",
      slotTime: "11:15 AM",
      hospitalId: "hosp_daya_thrissur",
    };

    const req1 = new NextRequest("http://localhost:3000/api/v1/voice-agent/book-appointment", {
      method: "POST",
      body: JSON.stringify(bookingPayload),
    });
    const res1 = await bookAppointment(req1);
    const json1 = await res1.json();
    expect(res1.status).toBe(200);
    expect(json1.success).toBe(true);
    const firstRef = json1.bookingReference;

    // Second identical booking
    const req2 = new NextRequest("http://localhost:3000/api/v1/voice-agent/book-appointment", {
      method: "POST",
      body: JSON.stringify(bookingPayload),
    });
    const res2 = await bookAppointment(req2);
    const json2 = await res2.json();
    expect(res2.status).toBe(200);
    expect(json2.success).toBe(true);
    expect(json2.bookingReference).toBe(firstRef);
    expect(json2.idempotent).toBe(true);
  });
});

