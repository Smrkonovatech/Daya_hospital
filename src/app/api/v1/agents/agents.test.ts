/**
 * ============================================================================
 * AGENTS API INTEGRATION TEST SUITE (PHASE 3)
 * ============================================================================
 *
 * Tests for:
 * 1. GET /api/v1/agents (list)
 * 2. POST /api/v1/agents (create)
 * 3. PUT /api/v1/agents/[agentId] (update)
 * 4. POST /api/v1/agents/[agentId]/publish (publish)
 * 5. POST /api/v1/agents/voice-preview (preview)
 * 6. POST /api/v1/agents/test (playground)
 */

import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET as getAgentsHandler, POST as createAgentHandler } from "./route";
import { PUT as updateAgentHandler } from "./[agentId]/route";
import { POST as publishAgentHandler } from "./[agentId]/publish/route";
import { POST as voicePreviewHandler } from "./voice-preview/route";
import { POST as testPlaygroundHandler } from "./test/route";

describe("Agents API Endpoints (Phase 3)", () => {
  const hospitalId = "hosp_daya_thrissur";

  it("GET /api/v1/agents returns hospital agents list", async () => {
    const req = new NextRequest(`http://localhost:3000/api/v1/agents?hospitalId=${hospitalId}`);
    const res = await getAgentsHandler(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBeGreaterThanOrEqual(1);
  });

  it("POST /api/v1/agents creates a new voice agent draft", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hospitalId,
        name: "Test Lab Enquiry Assistant",
        purpose: "DEPARTMENT_ENQUIRY",
        speaker: "kavitha",
      }),
    });

    const res = await createAgentHandler(req);
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.name).toBe("Test Lab Enquiry Assistant");
    expect(json.data.speaker).toBe("kavitha");
  });

  it("PUT /api/v1/agents/[agentId] updates agent parameters", async () => {
    const agentId = "agent_test_update_01";
    const req = new NextRequest(`http://localhost:3000/api/v1/agents/${agentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hospitalId,
        name: "Updated Agent Name",
        speakingPace: 1.25,
      }),
    });

    const res = await updateAgentHandler(req, {
      params: Promise.resolve({ agentId }),
    });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.speakingPace).toBe(1.25);
  });

  it("POST /api/v1/agents/[agentId]/publish publishes a valid agent", async () => {
    const agentId = "agent_default_hosp_daya_thrissur";
    const req = new NextRequest(`http://localhost:3000/api/v1/agents/${agentId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hospitalId,
        changelog: "Published verified baseline",
      }),
    });

    const res = await publishAgentHandler(req, {
      params: Promise.resolve({ agentId }),
    });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.versionNumber).toBeGreaterThanOrEqual(1);
  });

  it("POST /api/v1/agents/voice-preview generates preview audio", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/agents/voice-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hospitalId,
        text: "നമസ്കാരം, ദയ ഹോസ്പിറ്റൽ.",
        model: "bulbul:v3",
        speaker: "kavitha",
        languageCode: "ml-IN",
      }),
    });

    const res = await voicePreviewHandler(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.audioBase64).toBeDefined();
    expect(json.mimeType).toBe("audio/wav");
  });

  it("POST /api/v1/agents/test runs turn simulation in playground", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/agents/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hospitalId,
        agentId: "agent_default_hosp_daya_thrissur",
        userInput: "ഡോക്ടർ ഇന്ന് ലഭ്യമാണോ?",
      }),
    });

    const res = await testPlaygroundHandler(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.replyText).toBeDefined();
    expect(json.data.latencyBreakdown).toBeDefined();
  });
});

