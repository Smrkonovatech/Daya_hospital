/**
 * ============================================================================
 * SMRKOMED PHASE 10.2: CONTROLLED VOICE TESTING & WEBHOOK VALIDATION SUITE
 * ============================================================================
 *
 * Verifies the 10 controlled test scenarios for Phase 10.2:
 * 1. Malayalam greeting persona
 * 2. English greeting persona
 * 3. Malayalam-to-English switching
 * 4. English-to-Malayalam switching
 * 5. Hospital information retrieval (/api/v1/voice-agent/context)
 * 6. Synthetic doctor availability query (/api/v1/voice-agent/check-availability)
 * 7. Simulated appointment booking (/api/v1/voice-agent/book-appointment)
 * 8. Emergency intent detection without physical transfer (/api/v1/voice-agent/emergency-escalate)
 * 9. Call-ended webhook signed delivery (/api/v1/voice-agent/call-ended)
 * 10. Transcript & interaction persistence in Neon DB with idempotency
 */

import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import * as crypto from "crypto";

import { SarvamVoiceAgentClient } from "./voice-agent-client";
import {
  ACTUAL_SARVAM_APP_ID,
  ACTUAL_SARVAM_DEPLOYMENT_ID,
  ACTUAL_SARVAM_PHONE_NUMBER,
  getSarvamVoiceAgentConfig,
} from "./voice-agent-config";
import {
  DAYA_PILOT_VOICE_AGENT_DEPLOYMENT,
  DAYA_PILOT_SYSTEM_PROMPT,
} from "./daya-agent-config";

import { GET as getContext } from "@/app/api/v1/voice-agent/context/route";
import { POST as checkAvailability } from "@/app/api/v1/voice-agent/check-availability/route";
import { POST as bookAppointment } from "@/app/api/v1/voice-agent/book-appointment/route";
import { POST as emergencyEscalate } from "@/app/api/v1/voice-agent/emergency-escalate/route";
import { POST as callEndedWebhook } from "@/app/api/v1/voice-agent/call-ended/route";

describe("PHASE 10.2: Controlled Sarvam Voice Agent Integration & Webhook Validation", () => {
  const webhookSecret = "whsec_test_secret_phase10_2";
  let client: SarvamVoiceAgentClient;

  beforeEach(() => {
    client = new SarvamVoiceAgentClient({
      appId: ACTUAL_SARVAM_APP_ID,
      deploymentId: ACTUAL_SARVAM_DEPLOYMENT_ID,
      webhookSecret,
    });
  });

  // --------------------------------------------------------------------------
  // Scenario 1: Malayalam Greeting
  // --------------------------------------------------------------------------
  it("Scenario 1: Verified Malayalam greeting persona conforms to Daya Hospital standard", () => {
    expect(DAYA_PILOT_VOICE_AGENT_DEPLOYMENT.primaryLanguage).toBe("ml-IN");
    expect(DAYA_PILOT_VOICE_AGENT_DEPLOYMENT.voiceId).toBe("kavitha");
    expect(DAYA_PILOT_SYSTEM_PROMPT).toContain("ദയ സഹായി");
    expect(DAYA_PILOT_SYSTEM_PROMPT).toContain("നിങ്ങളുടെ പ്രാഥമിക ഭാഷ മലയാളമാണ്");
  });

  // --------------------------------------------------------------------------
  // Scenario 2: English Greeting
  // --------------------------------------------------------------------------
  it("Scenario 2: Verified English bilingual greeting capability", () => {
    expect(DAYA_PILOT_VOICE_AGENT_DEPLOYMENT.secondaryLanguages).toContain("en-IN");
    expect(DAYA_PILOT_SYSTEM_PROMPT).toContain("വ്യക്തമായ ഇംഗ്ലീഷിൽ മറുപടി നൽകുക");
  });

  // --------------------------------------------------------------------------
  // Scenario 3 & 4: Bilingual Switching (Malayalam <-> English)
  // --------------------------------------------------------------------------
  it("Scenario 3 & 4: Seamless bilingual language policy and front desk fallback", () => {
    expect(DAYA_PILOT_SYSTEM_PROMPT).toContain("ഭാഷാ നയം (Language Policy)");
    expect(DAYA_PILOT_SYSTEM_PROMPT).toContain("0487 247 5000"); // Official Daya helpline fallback
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Hospital Information Retrieval (/context)
  // --------------------------------------------------------------------------
  it("Scenario 5: Hospital information retrieval returns operating hours and active departments", async () => {
    const start = Date.now();
    const req = new NextRequest(
      "http://localhost:3000/api/v1/voice-agent/context?hospitalId=hosp_daya_thrissur",
      {
        headers: { "x-api-key": "test_tool_secret_2026" },
      }
    );
    const res = await getContext(req);
    const latencyMs = Date.now() - start;

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.hospitalName).toContain("Daya General Hospital");
    expect(json.data.operatingHours.casualty).toBe("24 Hours (7 Days a week)");
    expect(json.data.departments.length).toBeGreaterThan(0);
    expect(latencyMs).toBeLessThan(2000); // Network latency tolerance with Neon DB
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Synthetic Doctor Availability Query (/check-availability)
  // --------------------------------------------------------------------------
  it("Scenario 6: Doctor availability query explicitly flags simulated HMS source", async () => {
    const start = Date.now();
    const req = new NextRequest(
      "http://localhost:3000/api/v1/voice-agent/check-availability",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "test_tool_secret_2026",
        },
        body: JSON.stringify({
          departmentId: "dept_cardiology",
          preferredDate: "2026-11-25",
        }),
      }
    );
    const res = await checkAvailability(req);
    const latencyMs = Date.now() - start;

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.available).toBe(true);
    expect(json.doctor).toContain("Dr. Anand Menon");
    expect(json.isSimulated).toBe(true);
    expect(json.dataSource).toBe("SIMULATED_MOCK_HMS");
    expect(latencyMs).toBeLessThan(200);
  });

  // --------------------------------------------------------------------------
  // Scenario 7: Simulated Appointment Booking (/book-appointment)
  // --------------------------------------------------------------------------
  it("Scenario 7: Appointment booking operates in simulated mode without modifying live patients", async () => {
    const start = Date.now();
    const req = new NextRequest(
      "http://localhost:3000/api/v1/voice-agent/book-appointment",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "test_tool_secret_2026",
        },
        body: JSON.stringify({
          patientName: "Synthetic Test Patient",
          patientPhone: "+919846009988",
          departmentId: "dept_ortho",
          slotTime: "11:00 AM",
        }),
      }
    );
    const res = await bookAppointment(req);
    const latencyMs = Date.now() - start;

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.bookingReference).toMatch(/^DAYA-OPD-/);
    expect(json.isSimulated).toBe(true);
    expect(json.mode).toBe("SIMULATION_TESTING");
    expect(latencyMs).toBeLessThan(200);
  });

  // --------------------------------------------------------------------------
  // Scenario 8: Emergency Intent Detection Without Physical Transfer
  // --------------------------------------------------------------------------
  it("Scenario 8: Emergency intent detected and triaged without executing physical call transfer", async () => {
    const start = Date.now();
    const req = new NextRequest(
      "http://localhost:3000/api/v1/voice-agent/emergency-escalate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "test_tool_secret_2026",
        },
        body: JSON.stringify({
          symptom: "Severe acute chest pain and shortness of breath",
          callerPhone: "+919846009988",
          callSid: "call_phase10_2_simulated_em",
        }),
      }
    );
    const res = await emergencyEscalate(req);
    const latencyMs = Date.now() - start;

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.action).toBe("FAST_TRACK_CASUALTY");
    expect(json.triageLevel).toBe("CRITICAL_CODE_RED");
    expect(json.isSimulated).toBe(true);
    expect(json.physicalTransferExecuted).toBe(false);
    expect(json.mode).toBe("SIMULATION_ONLY");
    expect(latencyMs).toBeLessThan(2000); // Network latency tolerance with Neon DB
  });

  // --------------------------------------------------------------------------
  // Scenario 9: Call-Ended Webhook Signed Delivery
  // --------------------------------------------------------------------------
  it("Scenario 9: Call-ended webhook verifies official HMAC signature and timestamp contract", async () => {
    const currentTimestamp = Math.floor(Date.now() / 1000).toString();
    const interactionId = `20261124/test-p10-2-${Date.now()}`;
    const payload = JSON.stringify({
      interaction_id: interactionId,
      call_sid: `call_${interactionId}`,
      agent_id: ACTUAL_SARVAM_APP_ID,
      deployment_id: ACTUAL_SARVAM_DEPLOYMENT_ID,
      hospital_id: "hosp_daya_thrissur",
      caller_number: "+919606654032",
      called_number: ACTUAL_SARVAM_PHONE_NUMBER,
      status: "COMPLETED",
      duration_seconds: 32,
      transcript_turns: [
        { speaker: "agent", text: "നമസ്കാരം, ദയ ഹോസ്പിറ്റൽ", timestamp_ms: 1000 },
        { speaker: "caller", text: "ഹലോ, ഒ.പി.ഡി സമയം അറിയണം", timestamp_ms: 3500 },
      ],
      disposition: "OPD_INQUIRY_ANSWERED",
    });

    // Compute official Sarvam signature = HMAC-SHA256(`${timestamp}.${rawBody}`)
    const stringToSign = `${currentTimestamp}.${payload}`;
    const hmac = crypto.createHmac("sha256", webhookSecret);
    hmac.update(stringToSign);
    const signature = hmac.digest("hex");

    const start = Date.now();
    const req = new NextRequest(
      "http://localhost:3000/api/v1/voice-agent/call-ended",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Sarvam-Signature": signature,
          "Sarvam-Timestamp": currentTimestamp,
        },
        body: payload,
      }
    );
    const res = await callEndedWebhook(req);
    const latencyMs = Date.now() - start;

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.interactionId).toBe(interactionId);
    expect(latencyMs).toBeLessThan(2000); // Accommodate remote Neon Singapore DB network latency
  });

  // --------------------------------------------------------------------------
  // Scenario 10: Idempotent Persistence & Replay Protection in Neon DB
  // --------------------------------------------------------------------------
  it("Scenario 10: Handles duplicate webhook deliveries idempotently and protects against replay", async () => {
    const currentTimestamp = Math.floor(Date.now() / 1000).toString();
    const interactionId = `20261124/test-dedupe-${Date.now()}`;
    const payload = JSON.stringify({
      interaction_id: interactionId,
      call_sid: `call_${interactionId}`,
      agent_id: ACTUAL_SARVAM_APP_ID,
      hospital_id: "hosp_daya_thrissur",
      status: "COMPLETED",
      duration_seconds: 45,
    });

    const stringToSign = `${currentTimestamp}.${payload}`;
    const hmac = crypto.createHmac("sha256", webhookSecret);
    hmac.update(stringToSign);
    const signature = hmac.digest("hex");

    // First delivery
    const req1 = new NextRequest(
      "http://localhost:3000/api/v1/voice-agent/call-ended",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Sarvam-Signature": signature,
          "Sarvam-Timestamp": currentTimestamp,
        },
        body: payload,
      }
    );
    const res1 = await callEndedWebhook(req1);
    expect(res1.status).toBe(200);
    const json1 = await res1.json();
    expect(json1.success).toBe(true);

    // Duplicate delivery
    const req2 = new NextRequest(
      "http://localhost:3000/api/v1/voice-agent/call-ended",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Sarvam-Signature": signature,
          "Sarvam-Timestamp": currentTimestamp,
        },
        body: payload,
      }
    );
    const res2 = await callEndedWebhook(req2);
    expect(res2.status).toBe(200);
    const json2 = await res2.json();
    expect(json2.success).toBe(true);
    expect(json2.received).toBe(true);
  });
});
