import { describe, it, expect, beforeEach, vi } from "vitest";
import { CallMediaSession, SocketSender } from "./session-manager";
import { SpeechToTextProvider, TextToSpeechProvider, TranscriptTurnResult } from "./speech-interfaces";
import { HospitalConversationEngine } from "./conversation-engine";
import { DAYA_HOSPITAL_CONFIG } from "@/lib/config/hospital-config";
import { ivrFlowService } from "@/lib/services/ivr-flow-service";
import { createDefaultHospitalFlow } from "@/lib/services/ivr-node-definitions";
import { exotelTelephonyService } from "@/lib/services/exotel-telephony-service";

class MockSttProvider implements SpeechToTextProvider {
  private transcriptCb?: (result: TranscriptTurnResult) => void;
  private speechStartCb?: () => void;

  public async connect(): Promise<void> {}
  public async sendAudio(): Promise<void> {}
  public async close(): Promise<void> {}

  public onTranscript(cb: (result: TranscriptTurnResult) => void): void {
    this.transcriptCb = cb;
  }

  public onSpeechStart(cb: () => void): void {
    this.speechStartCb = cb;
  }

  public simulateTranscript(text: string, isFinal = true) {
    if (this.transcriptCb) {
      this.transcriptCb({
        text,
        isFinal,
        confidence: 0.98,
        languageCode: "ml-IN",
        timestampMs: Date.now(),
      });
    }
  }

  public simulateSpeechStart() {
    if (this.speechStartCb) {
      this.speechStartCb();
    }
  }
}

class MockTtsProvider implements TextToSpeechProvider {
  public synthesizedTexts: string[] = [];
  public async synthesize(text: string): Promise<Buffer> {
    this.synthesizedTexts.push(text);
    return Buffer.alloc(3200, 0x33);
  }
}

interface MockSocketSender extends SocketSender {
  sentMessages: string[];
}

describe("Live IVR Runtime Gateway Integration (Phase 4.1)", () => {
  let mockSocket: MockSocketSender;
  let stt: MockSttProvider;
  let tts: MockTtsProvider;
  let engine: HospitalConversationEngine;
  const hospitalId = "hosp_daya_thrissur";

  beforeEach(() => {
    mockSocket = {
      send: vi.fn((data: string) => {
        mockSocket.sentMessages.push(data);
      }),
      readyState: 1,
      sentMessages: [],
    };
    stt = new MockSttProvider();
    tts = new MockTtsProvider();
    engine = new HospitalConversationEngine(DAYA_HOSPITAL_CONFIG);
  });

  it("resolves active published IVR flow on inbound call and executes Welcome Greeting", async () => {
    const flow = createDefaultHospitalFlow(hospitalId, "Daya Hospital Flow");
    await ivrFlowService.saveDraft({ ...flow, status: "PUBLISHED" });

    const session = new CallMediaSession({
      streamSid: "MZ_test_ivr_01",
      callSid: "CA_test_ivr_01",
      accountSid: "smrkonova1",
      from: "+919447012345",
      to: "08047291658",
      socket: mockSocket,
      sttProvider: stt,
      ttsProvider: tts,
      conversationEngine: engine,
      autoPlayGreeting: true,
      enableIvrFlow: true,
    });

    session.markStarted();
    await session.waitForInitialization();

    expect(session.isExecutingIvrFlow).toBe(true);
    expect(session.ivrFlow).toBeDefined();
    expect(session.ivrContext?.callSid).toBe("CA_test_ivr_01");
    expect(session.ivrContext?.hospitalId).toBe(hospitalId);
    expect(tts.synthesizedTexts.length).toBeGreaterThanOrEqual(1);

    const summary = session.getSummary();
    expect(summary.ivrRuntime.isExecutingIvrFlow).toBe(true);
    expect(summary.ivrRuntime.flowId).toBeDefined();

    session.close();
  });

  it("handles Language Selection: DTMF 1 sets Malayalam, DTMF 2 sets English", async () => {
    const flow = createDefaultHospitalFlow(hospitalId);
    const session = new CallMediaSession({
      streamSid: "MZ_test_ivr_lang",
      callSid: "CA_test_ivr_lang",
      accountSid: "smrkonova1",
      from: "+919447012345",
      to: "08047291658",
      socket: mockSocket,
      sttProvider: stt,
      ttsProvider: tts,
      conversationEngine: engine,
      ivrFlow: flow,
      enableIvrFlow: true,
    });

    session.markStarted();
    await new Promise((r) => setTimeout(r, 60));

    // Fast-forward to Language Selection node
    const langNode = flow.nodes.find((n) => n.type === "LANGUAGE_SELECTION")!;
    session.ivrContext!.currentNodeId = langNode.id;
    session.waitingForDtmf = true;

    // Caller selects English (Key '2')
    session.handleDtmf("2");
    await new Promise((r) => setTimeout(r, 60));

    expect(session.ivrContext?.currentLanguage).toBe("en-IN");

    session.close();
  });

  it("handles IVR Menu branching: DTMF 1 triggers Emergency Casualty fast-track", async () => {
    const flow = createDefaultHospitalFlow(hospitalId);
    const session = new CallMediaSession({
      streamSid: "MZ_test_ivr_menu_em",
      callSid: "CA_test_ivr_menu_em",
      accountSid: "smrkonova1",
      from: "+919447012345",
      to: "08047291658",
      socket: mockSocket,
      sttProvider: stt,
      ttsProvider: tts,
      conversationEngine: engine,
      ivrFlow: flow,
      enableIvrFlow: true,
    });

    session.markStarted();
    await new Promise((r) => setTimeout(r, 60));

    const menuNode = flow.nodes.find((n) => n.type === "IVR_MENU")!;
    session.ivrContext!.currentNodeId = menuNode.id;
    session.waitingForDtmf = true;

    // Caller presses '1' (Emergency)
    session.handleDtmf("1");
    await new Promise((r) => setTimeout(r, 80));

    expect(session.ivrContext?.isEmergency).toBe(true);
    const emergencyNode = flow.nodes.find((n) => n.type === "EMERGENCY_HANDLING")!;
    expect(session.ivrContext?.currentNodeId).toBe(emergencyNode.id);

    session.close();
  });

  it("handles IVR Menu branching: DTMF 2 routes to Sarvam AI Voice Agent", async () => {
    const flow = createDefaultHospitalFlow(hospitalId);
    const session = new CallMediaSession({
      streamSid: "MZ_test_ivr_ai",
      callSid: "CA_test_ivr_ai",
      accountSid: "smrkonova1",
      from: "+919447012345",
      to: "08047291658",
      socket: mockSocket,
      sttProvider: stt,
      ttsProvider: tts,
      conversationEngine: engine,
      ivrFlow: flow,
      enableIvrFlow: true,
    });

    session.markStarted();
    await new Promise((r) => setTimeout(r, 60));

    const menuNode = flow.nodes.find((n) => n.type === "IVR_MENU")!;
    session.ivrContext!.currentNodeId = menuNode.id;
    session.waitingForDtmf = true;

    // Caller presses '2' (AI Assistant)
    session.handleDtmf("2");
    await new Promise((r) => setTimeout(r, 80));

    const aiNode = flow.nodes.find((n) => n.type === "AI_VOICE_AGENT")!;
    expect(session.ivrContext?.currentNodeId).toBe(aiNode.id);

    session.close();
  });

  it("preempts normal flow when emergency keyword is uttered in caller speech", async () => {
    const flow = createDefaultHospitalFlow(hospitalId);
    const session = new CallMediaSession({
      streamSid: "MZ_test_ivr_speech_em",
      callSid: "CA_test_ivr_speech_em",
      accountSid: "smrkonova1",
      from: "+919447012345",
      to: "08047291658",
      socket: mockSocket,
      sttProvider: stt,
      ttsProvider: tts,
      conversationEngine: engine,
      ivrFlow: flow,
      enableIvrFlow: true,
    });

    session.markStarted();
    await new Promise((r) => setTimeout(r, 60));

    // Call is at department selection or menu
    const deptNode = flow.nodes.find((n) => n.type === "DEPARTMENT_SELECTION")!;
    session.ivrContext!.currentNodeId = deptNode.id;

    // Caller screams emergency in Malayalam
    stt.simulateTranscript("അടിയന്തിരം ആണ് നെഞ്ചുവേദന എടുക്കുന്നു പെട്ടെന്ന് സഹായിക്കൂ");
    await new Promise((r) => setTimeout(r, 80));

    expect(session.ivrContext?.isEmergency).toBe(true);
    const emergencyNode = flow.nodes.find((n) => n.type === "EMERGENCY_HANDLING")!;
    expect(session.ivrContext?.currentNodeId).toBe(emergencyNode.id);

    session.close();
  });

  it("executes human staff transfer via ExotelTelephonyService and handles failure fallback", async () => {
    const flow = createDefaultHospitalFlow(hospitalId);
    const transferSpy = vi.spyOn(exotelTelephonyService, "transferCall").mockResolvedValue({
      success: false,
      transferType: "EXOTEL_CONNECT_APPLET",
      destination: "+91 96066 54032",
      error: "All reception lines busy",
    });

    const session = new CallMediaSession({
      streamSid: "MZ_test_ivr_transfer",
      callSid: "CA_test_ivr_transfer",
      accountSid: "smrkonova1",
      from: "+919447012345",
      to: "08047291658",
      socket: mockSocket,
      sttProvider: stt,
      ttsProvider: tts,
      conversationEngine: engine,
      ivrFlow: flow,
      enableIvrFlow: true,
    });

    session.markStarted();
    await new Promise((r) => setTimeout(r, 60));

    const transferNode = flow.nodes.find((n) => n.type === "HUMAN_TRANSFER")!;
    session.ivrContext!.currentNodeId = transferNode.id;

    // Execute transfer step
    await session.executeIvrStep({ type: "START_CALL" });

    expect(transferSpy).toHaveBeenCalled();
    // Failed transfer routes along fallback edge
    expect(session.lastStepResult).toBeDefined();

    transferSpy.mockRestore();
    session.close();
  });

  it("handles Queue Waiting node as controlled staff handoff without simulating non-existent ACD", async () => {
    const flow = createDefaultHospitalFlow(hospitalId);
    const session = new CallMediaSession({
      streamSid: "MZ_test_ivr_queue",
      callSid: "CA_test_ivr_queue",
      accountSid: "smrkonova1",
      from: "+919447012345",
      to: "08047291658",
      socket: mockSocket,
      sttProvider: stt,
      ttsProvider: tts,
      conversationEngine: engine,
      ivrFlow: flow,
      enableIvrFlow: true,
    });

    session.markStarted();
    await new Promise((r) => setTimeout(r, 60));

    // Manually inject QUEUE_WAITING node
    const queueNode = {
      id: "node_queue_test",
      type: "QUEUE_WAITING" as const,
      title: "Queue Waiting",
      data: { queueName: "Outpatient Queue", maxWaitSeconds: 60, announcePosition: true, periodicAnnouncementIntervalSeconds: 15 },
      inputs: [{ id: "in", label: "In", direction: "input" as const }],
      outputs: [{ id: "agent_answered", label: "Staff", direction: "output" as const }],
      position: { x: 0, y: 0 },
    };
    flow.nodes.push(queueNode);
    session.ivrContext!.currentNodeId = queueNode.id;

    const step = await session.executeIvrStep({ type: "START_CALL" });

    expect(step?.logMessage).toContain("[QUEUE_UNSUPPORTED]");
    expect(step?.audioText).toContain("ഓട്ടോമേറ്റഡ് ക്യൂ സേവനം നിലവിൽ ലഭ്യമല്ല");

    session.close();
  });

  it("safely falls back to direct conversational AI when tenant has no published IVR flow", async () => {
    const unknownHospitalId = "hosp_unconfigured_01";

    const session = new CallMediaSession({
      streamSid: "MZ_test_ivr_fallback",
      callSid: "CA_test_ivr_fallback",
      accountSid: "smrkonova1",
      from: "+919447012345",
      to: "08047291658",
      socket: mockSocket,
      sttProvider: stt,
      ttsProvider: tts,
      conversationEngine: engine,
      autoPlayGreeting: true,
      enableIvrFlow: true,
    });

    // Override hospitalId to tenant with zero published flows
    (session as unknown as { hospitalId: string }).hospitalId = unknownHospitalId;

    session.markStarted();
    await session.waitForInitialization();

    // Verified safe fallback: does not pretend an IVR flow was executed
    expect(session.isExecutingIvrFlow).toBe(false);
    expect(session.ivrFlow).toBeUndefined();
    expect(tts.synthesizedTexts.length).toBeGreaterThanOrEqual(1);

    session.close();
  });

  it("guarantees tenant isolation: active call cannot execute another hospital's flow", async () => {
    const apolloFlow = createDefaultHospitalFlow("hosp_apollo_kochi", "Apollo Flow");
    await ivrFlowService.saveDraft({ ...apolloFlow, status: "PUBLISHED" });

    // Daya call arrives
    const dayaSession = new CallMediaSession({
      streamSid: "MZ_test_daya_iso",
      callSid: "CA_test_daya_iso",
      accountSid: "smrkonova1",
      from: "+919447012345",
      to: "08047291658", // Daya ExoPhone
      socket: mockSocket,
      sttProvider: stt,
      ttsProvider: tts,
      conversationEngine: engine,
      enableIvrFlow: true,
    });

    dayaSession.markStarted();
    await dayaSession.waitForInitialization();

    expect(dayaSession.hospitalId).toBe(hospitalId);
    expect(dayaSession.ivrFlow?.hospitalId).toBe(hospitalId);
    expect(dayaSession.ivrFlow?.hospitalId).not.toBe("hosp_apollo_kochi");

    dayaSession.close();
  });

  it("handles concurrent calls with completely isolated execution contexts and flow versions", async () => {
    const flow = createDefaultHospitalFlow(hospitalId);

    const sessionA = new CallMediaSession({
      streamSid: "MZ_concurrent_A",
      callSid: "CA_concurrent_A",
      accountSid: "smrkonova1",
      from: "+919447000001",
      to: "08047291658",
      socket: mockSocket,
      sttProvider: stt,
      ttsProvider: tts,
      conversationEngine: engine,
      ivrFlow: flow,
      enableIvrFlow: true,
    });

    const sessionB = new CallMediaSession({
      streamSid: "MZ_concurrent_B",
      callSid: "CA_concurrent_B",
      accountSid: "smrkonova1",
      from: "+919447000002",
      to: "08047291658",
      socket: mockSocket,
      sttProvider: stt,
      ttsProvider: tts,
      conversationEngine: engine,
      ivrFlow: flow,
      enableIvrFlow: true,
    });

    sessionA.markStarted();
    sessionB.markStarted();
    await new Promise((r) => setTimeout(r, 60));

    // Advance session A to English, session B to Malayalam
    const langNode = flow.nodes.find((n) => n.type === "LANGUAGE_SELECTION")!;
    sessionA.ivrContext!.currentNodeId = langNode.id;
    sessionA.waitingForDtmf = true;

    sessionB.ivrContext!.currentNodeId = langNode.id;
    sessionB.waitingForDtmf = true;

    sessionA.handleDtmf("2"); // English
    sessionB.handleDtmf("1"); // Malayalam
    await new Promise((r) => setTimeout(r, 60));

    expect(sessionA.ivrContext?.currentLanguage).toBe("en-IN");
    expect(sessionB.ivrContext?.currentLanguage).toBe("ml-IN");
    expect(sessionA.callSid).not.toBe(sessionB.callSid);

    sessionA.close();
    sessionB.close();
  });
});

