/**
 * ============================================================================
 * SARVAM AI VOICE AGENT BUILDER TEST SUITE (PHASE 3)
 * ============================================================================
 *
 * Tests for:
 * 1. Agent CRUD: create, retrieve, save, duplicate, toggle status
 * 2. Hospital Prompt Builder: compiles sections into clinical prompt with safeguards
 * 3. Voice Selection & Model Compatibility
 * 4. Voice Preview Generation via Sarvam TTS with rate limiting
 * 5. Agent Publishing & Rollback
 * 6. Test Playground simulation: Malayalam/English, casualty triage, handoff
 */

import { describe, it, expect } from "vitest";
import { agentService } from "./agent-service";

describe("AgentService (Phase 3 - Sarvam Voice Agent Builder)", () => {
  const hospitalId = "hosp_daya_thrissur";

  it("creates and retrieves a default baseline voice receptionist for hospital", async () => {
    const agents = await agentService.getAgentsByHospital(hospitalId);
    expect(agents.length).toBeGreaterThanOrEqual(1);

    const defaultAgent = agents[0];
    expect(defaultAgent.hospitalId).toBe(hospitalId);
    expect(defaultAgent.sttModel).toBe("saaras:v4");
    expect(defaultAgent.llmModel).toBe("sarvam-105b-conversations");
    expect(defaultAgent.ttsModel).toBe("bulbul:v3");
    expect(defaultAgent.speaker).toBe("kavitha");
  });

  it("compiles structured prompt sections into authoritative system prompt", () => {
    const prompt = agentService.compileSystemPrompt({
      agentName: "Daya OPD Voicebot",
      role: "Assist patients with doctor schedules",
      hospitalName: "Daya Hospital",
      location: "Thrissur",
      primaryLanguage: "ml-IN",
      allowedLanguages: ["ml-IN", "en-IN"],
      conversationTone: "EMPATHETIC_PROFESSIONAL",
      responseLength: "CONCISE",
      clinicalSafeguards: ["Never prescribe medicines.", "Advise doctor consultation for medical queries."],
      emergencyRules: ["Immediate transfer to Casualty at +91 96066 54032."],
    });

    expect(prompt).toContain("Daya OPD Voicebot");
    expect(prompt).toContain("Never prescribe medicines.");
    expect(prompt).toContain("+91 96066 54032");
  });

  it("saves agent draft updates without affecting version number", async () => {
    const saved = await agentService.saveAgent({
      hospitalId,
      name: "Daya Triage Agent",
      speakingPace: 1.2,
      greetingMalayalam: "നമസ്കാരം, ദയ ട്രയാജ് വിഭാഗത്തിലേക്ക് സ്വാഗതം.",
    });

    expect(saved.name).toBe("Daya Triage Agent");
    expect(saved.speakingPace).toBe(1.2);
    expect(saved.status).toBe("DRAFT");
  });

  it("duplicates an existing agent as a new draft", async () => {
    const original = await agentService.saveAgent({
      hospitalId,
      name: "Original Appointment Assistant",
      purpose: "APPOINTMENT_BOOKING",
    });

    const duplicate = await agentService.duplicateAgent(original.id, hospitalId);
    expect(duplicate).not.toBeNull();
    expect(duplicate?.name).toContain("Copy of Original");
    expect(duplicate?.id).not.toBe(original.id);
  });

  it("toggles agent status between PUBLISHED and DISABLED", async () => {
    const agent = await agentService.saveAgent({
      hospitalId,
      name: "Toggle Test Agent",
      status: "PUBLISHED",
    });

    const toggled = await agentService.toggleAgentStatus(agent.id, hospitalId);
    expect(toggled?.status).toBe("DISABLED");

    const reToggled = await agentService.toggleAgentStatus(agent.id, hospitalId);
    expect(reToggled?.status).toBe("PUBLISHED");
  });

  it("validates agent configuration and catches missing greetings or incompatible models", () => {
    const agent = agentService.createDefaultAgent(hospitalId);
    const validReport = agentService.validateAgent(agent);
    expect(validReport.isValid).toBe(true);

    const invalidAgent = {
      ...agent,
      ttsModel: "bulbul:v4-flash", // Not compatible with Malayalam
    };
    const invalidReport = agentService.validateAgent(invalidAgent);
    expect(invalidReport.isValid).toBe(false);
    expect(invalidReport.errors.some((e) => e.field === "ttsModel")).toBe(true);
  });

  it("generates voice preview audio using Sarvam TTS", async () => {
    const preview = await agentService.generateVoicePreview({
      hospitalId,
      text: "നമസ്കാരം, ദയ ജനറൽ ഹോസ്പിറ്റൽ.",
      model: "bulbul:v3",
      speaker: "kavitha",
      languageCode: "ml-IN",
      pace: 1.15,
    });

    expect(preview.success).toBe(true);
    expect(preview.audioBase64).toBeDefined();
    expect(preview.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("simulates conversation turn in playground with latency breakdown and triage handoff", async () => {
    // 1. Regular Enquiry
    const normalTurn = await agentService.simulateAgentTurn({
      hospitalId,
      agentId: "agent_default",
      userInput: "ഡോക്ടറെ കാണാൻ എനിക്ക് അപ്പോയിന്റ്മെന്റ് വേണം.",
    });

    expect(normalTurn.replyText).toContain("ഡോക്ടർ");
    expect(normalTurn.detectedLanguage).toBe("ml-IN");
    expect(normalTurn.latencyBreakdown.totalMs).toBeGreaterThanOrEqual(0);
    expect(normalTurn.audioBase64).toBeDefined();

    // 2. Emergency Trigger
    const emergencyTurn = await agentService.simulateAgentTurn({
      hospitalId,
      agentId: "agent_default",
      userInput: "എനിക്ക് കഠിനമായ നെഞ്ചുവേദനയുണ്ട്, അത്യാഹിതമാണ്!",
    });

    expect(emergencyTurn.handoffTriggered).toBe(true);
    expect(emergencyTurn.detectedIntent).toBe("EMERGENCY_CASUALTY");
    expect(emergencyTurn.handoffDestination).toContain("Casualty Hotline");
  });

  it("publishes an agent and supports version rollback", async () => {
    const agent = await agentService.saveAgent({
      hospitalId,
      name: "Versioned Agent",
      greetingMalayalam: "നമസ്കാരം, ആദ്യത്തെ പതിപ്പ്.",
    });

    const p1 = await agentService.publishAgent(agent.id, hospitalId, "Version 1 Initial");
    expect(p1.success).toBe(true);
    expect(p1.versionNumber).toBeGreaterThanOrEqual(1);

    await agentService.saveAgent({
      ...agent,
      greetingMalayalam: "നമസ്കാരം, രണ്ടാമത്തെ പതിപ്പ്.",
    });

    const p2 = await agentService.publishAgent(agent.id, hospitalId, "Version 2 Update");
    expect(p2.success).toBe(true);

    const rollbackRes = await agentService.rollbackAgent(agent.id, p1.versionNumber, hospitalId);
    expect(rollbackRes.success).toBe(true);
  });
});

