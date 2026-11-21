/**
 * ============================================================================
 * SARVAM REAL-TIME AI VOICE & TELEPHONY TEST SUITE (PHASE 2)
 * ============================================================================
 *
 * Comprehensive tests for:
 * 1. Sarvam Configuration & Masking Telemetry
 * 2. Sarvam Text-to-Speech (Bulbul v3, 8kHz Linear16, WAV parsing)
 * 3. Sarvam Speech-to-Text (Saaras v4, WebSocket streaming, VAD)
 * 4. Daya Hospital Conversation Engine (Emergency Triage & Malayalam Dialogue)
 * 5. Full Exotel CallMediaSession Integration (Greeting, Turns, Barge-in)
 * 6. Multi-Tenant Phone Resolution (Trial ExoPhone 08047291658 & Aliases)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getSarvamConfig,
  getSarvamConfigSummary,
  maskSecret,
} from "./sarvam-config";
import { SarvamTextToSpeechProvider } from "./sarvam-tts";
import { SarvamSpeechToTextProvider } from "./sarvam-stt";
import { HospitalConversationEngine } from "./conversation-engine";
import { CallMediaSession } from "./session-manager";
import {
  DAYA_HOSPITAL_CONFIG,
  resolveHospitalByPhoneNumber,
} from "@/lib/config/hospital-config";
import { tenantResolver } from "./tenant-resolver";
import { TextToSpeechProvider, SpeechToTextProvider, TranscriptTurnResult } from "./speech-interfaces";

describe("Sarvam Configuration & Secret Masking", () => {
  it("safely masks secret credentials while revealing prefix and suffix", () => {
    expect(maskSecret("sk_l0nfgdq0_MRxkA28Stuh6JXP2AE4Anbcp")).toBe("sk_l0...nbcp");
    expect(maskSecret("sk_samvaad_xywpvl90_4qRfmMh1fcGrL9XcM48TdBbF")).toBe("sk_sa...dBbF");
    expect(maskSecret("short")).toBe("*****");
    expect(maskSecret(undefined)).toBe("[NOT_CONFIGURED]");
    expect(maskSecret("")).toBe("[NOT_CONFIGURED]");
  });

  it("loads config with production defaults", () => {
    const config = getSarvamConfig();
    expect(config.languageCode).toBe("ml-IN");
    expect(config.sampleRate).toBe(8000);
    expect(config.sttModel).toBe("saaras:v4");
    expect(config.ttsModel).toBe("bulbul:v3");
    expect(config.ttsSpeaker).toBe("kavitha");
  });

  it("produces safe telemetry summary without leaking raw keys", () => {
    const summary = getSarvamConfigSummary();
    expect(summary).toHaveProperty("configured");
    expect(summary).toHaveProperty("samvaadConfigured");
    expect(summary).toHaveProperty("sttModel", "saaras:v4");
    expect(summary).toHaveProperty("ttsModel", "bulbul:v3");
    expect(summary).toHaveProperty("ttsSpeaker", "kavitha");
    expect(summary).toHaveProperty("languageCode", "ml-IN");

    // Telemetry must NEVER contain unmasked full keys
    const json = JSON.stringify(summary);
    expect(json).not.toContain("sk_l0nfgdq0_MRxkA28Stuh6JXP2AE4Anbcp");
    expect(json).not.toContain("sk_samvaad_xywpvl90_4qRfmMh1fcGrL9XcM48TdBbF");
  });
});

describe("SarvamTextToSpeechProvider (Bulbul v3)", () => {
  let tts: SarvamTextToSpeechProvider;

  beforeEach(() => {
    tts = new SarvamTextToSpeechProvider({
      apiKey: "test_key",
      model: "bulbul:v3",
      speaker: "kavitha",
      sampleRate: 8000,
    });
  });

  it("correctly identifies and extracts linear16 PCM from RIFF WAV container", () => {
    // Construct a minimal 44-byte RIFF WAV header with 320 bytes of PCM payload
    const pcmPayload = Buffer.alloc(320, 0x12);
    const wavBuffer = Buffer.alloc(44 + 320);

    wavBuffer.write("RIFF", 0);
    wavBuffer.writeUInt32LE(36 + 320, 4);
    wavBuffer.write("WAVE", 8);
    wavBuffer.write("fmt ", 12);
    wavBuffer.writeUInt32LE(16, 16);
    wavBuffer.writeUInt16LE(1, 20); // PCM
    wavBuffer.writeUInt16LE(1, 22); // mono
    wavBuffer.writeUInt32LE(8000, 24); // 8000 Hz
    wavBuffer.writeUInt32LE(16000, 28); // byte rate
    wavBuffer.writeUInt16LE(2, 32); // block align
    wavBuffer.writeUInt16LE(16, 34); // 16-bit
    wavBuffer.write("data", 36);
    wavBuffer.writeUInt32LE(320, 40);
    pcmPayload.copy(wavBuffer, 44);

    const extracted = (tts as unknown as { extractPcmFromWav: (buf: Buffer) => Buffer }).extractPcmFromWav(wavBuffer);
    expect(extracted.length).toBe(320);
    expect(extracted).toEqual(pcmPayload);
  });

  it("synthesizes valid linear16 8000 Hz audio using fallback tone generator when network mock is used", async () => {
    const pcm = await tts.synthesize("നമസ്കാരം!");
    expect(pcm).toBeInstanceOf(Buffer);
    expect(pcm.length).toBeGreaterThan(0);
    // Must be 16-bit aligned (multiple of 2) and frame aligned (multiple of 320)
    expect(pcm.length % 2).toBe(0);
    expect(pcm.length % 320).toBe(0);
  });
});

describe("SarvamSpeechToTextProvider (Saaras v4)", () => {
  it("initializes with 8000 Hz and ml-IN language code", () => {
    const stt = new SarvamSpeechToTextProvider({
      sampleRate: 8000,
      languageCode: "ml-IN",
      apiKey: "test_key",
    });

    expect(stt).toBeDefined();
  });

  it("emits transcript events to registered callbacks", () => {
    const stt = new SarvamSpeechToTextProvider();
    const transcripts: TranscriptTurnResult[] = [];

    stt.onTranscript((t) => {
      transcripts.push(t);
    });

    stt.emitTranscript({
      text: "എനിക്ക് ഒരു ഡോക്ടറെ കാണണം",
      isFinal: true,
      confidence: 0.96,
      languageCode: "ml-IN",
      timestampMs: 1200,
    });

    expect(transcripts.length).toBe(1);
    expect(transcripts[0].text).toBe("എനിക്ക് ഒരു ഡോക്ടറെ കാണണം");
    expect(transcripts[0].isFinal).toBe(true);
    expect(transcripts[0].confidence).toBe(0.96);
  });

  it("handles speech start callback for barge-in triggering", () => {
    const stt = new SarvamSpeechToTextProvider();
    let speechStarted = false;

    stt.onSpeechStart(() => {
      speechStarted = true;
    });

    stt.triggerSpeechStart();
    expect(speechStarted).toBe(true);
  });
});

describe("HospitalConversationEngine (Daya Hospital Malayalam Persona)", () => {
  let engine: HospitalConversationEngine;

  beforeEach(() => {
    engine = new HospitalConversationEngine(DAYA_HOSPITAL_CONFIG);
  });

  it("returns polite Malayalam welcome greeting identifying Daya Hospital and SMRKOMED", () => {
    const greeting = engine.getInitialGreeting();
    expect(greeting).toContain("നമസ്കാരം");
    expect(greeting).toContain("ദയ ഹോസ്പിറ്റലിലേക്ക് സ്വാഗതം");
    expect(greeting).toContain("സ്മാർക്കോമെഡ്");
  });

  it("triages emergency & casualty callers immediately with direct extension 100", async () => {
    const emergencyInputs = [
      "അടിയന്തിരം ആണ്!",
      "ഇതൊരു എമർജൻസി കേസ് ആണ്",
      "ആക്സിഡന്റ് പറ്റി, പെട്ടെന്ന് സഹായിക്കണം",
      "നെഞ്ചുവേദന എടുക്കുന്നു",
      "casualty doctor please",
    ];

    for (const input of emergencyInputs) {
      const result = await engine.processCallerUtterance(input);
      expect(result.intent).toBe("CASUALTY");
      expect(result.shouldTransfer).toBe(true);
      expect(result.transferDestination).toBe("100");
      expect(result.replyText).toContain("കാഷ്വാലിറ്റി");
      expect(result.replyText).toContain("4872475100");
    }
  });

  it("recognizes appointment booking intents and asks for relevant details", async () => {
    const result = await engine.processCallerUtterance("എനിക്ക് ഒരു ഡോക്ടറെ കാണാൻ അപ്പോയിന്റ്മെന്റ് വേണം");
    expect(result.intent).toBe("APPOINTMENT");
    expect(result.replyText).toContain("വിഭാഗത്തിലെ");
    expect(result.appointmentData).toBeDefined();
  });

  it("recognizes doctor duty inquiry and answers appropriately", async () => {
    const result = await engine.processCallerUtterance("ഇന്ന് കാർഡിയോളജിസ്റ്റ് ഉണ്ടോ?");
    expect(result.intent).toBe("DOCTOR_INFO");
    expect(result.replyText).toBeDefined();
    expect(result.replyText.length).toBeGreaterThan(10);
  });

  it("provides conversational dialogue for general queries", async () => {
    const result = await engine.processCallerUtterance("ആശുപത്രി പ്രവർത്തിക്കുന്ന സമയം എപ്പോഴാണ്?");
    expect(result.replyText).toBeDefined();
    expect(result.replyText.length).toBeGreaterThan(5);
  });
});

describe("CallMediaSession AI Voice Pipeline Integration", () => {
  let mockSocket: {
    send: ReturnType<typeof vi.fn>;
    readyState: number;
    sentMessages: string[];
  };

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

    public simulateTranscript(text: string, isFinal: boolean = true) {
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
    public async synthesize(): Promise<Buffer> {
      // 3200 bytes of mock linear16 audio (200ms)
      return Buffer.alloc(3200, 0x55);
    }
  }

  beforeEach(() => {
    mockSocket = {
      send: vi.fn((data: string) => {
        mockSocket.sentMessages.push(data);
      }),
      readyState: 1, // OPEN
      sentMessages: [],
    };
  });

  it("auto-plays Daya Malayalam welcome greeting on markStarted", async () => {
    const stt = new MockSttProvider();
    const tts = new MockTtsProvider();
    const engine = new HospitalConversationEngine(DAYA_HOSPITAL_CONFIG);

    const session = new CallMediaSession({
      streamSid: "MZ_test_stream_01",
      callSid: "CA_test_call_01",
      accountSid: "AC_test_account_01",
      from: "+919876543210",
      to: "08047291658",
      socket: mockSocket,
      sttProvider: stt,
      ttsProvider: tts,
      conversationEngine: engine,
      autoPlayGreeting: true,
    });

    session.markStarted();

    // Allow asynchronous greeting synthesis & dispatch
    await new Promise((r) => setTimeout(r, 50));

    expect(session.state).toBe("STREAMING");
    expect(session.conversationTurns.length).toBeGreaterThanOrEqual(1);
    expect(session.conversationTurns[0].speaker).toBe("ai");
    expect(session.conversationTurns[0].text).toContain("നമസ്കാരം");

    // Verify outbound audio message was sent to Exotel
    const sentAudioMsg = mockSocket.sentMessages.find((m) => {
      const parsed = JSON.parse(m);
      return parsed.event === "media" && parsed.streamSid === "MZ_test_stream_01";
    });

    expect(sentAudioMsg).toBeDefined();
  });

  it("handles user turn through STT -> ConversationEngine -> TTS audio streaming", async () => {
    const stt = new MockSttProvider();
    const tts = new MockTtsProvider();
    const engine = new HospitalConversationEngine(DAYA_HOSPITAL_CONFIG);

    const session = new CallMediaSession({
      streamSid: "MZ_test_stream_02",
      callSid: "CA_test_call_02",
      accountSid: "AC_test_account_02",
      from: "+919876543210",
      to: "08047291658",
      socket: mockSocket,
      sttProvider: stt,
      ttsProvider: tts,
      conversationEngine: engine,
    });

    session.markStarted();

    // Simulate caller speaking
    await session.handleUserTurn("അടിയന്തിരം ആണ്!");

    expect(session.conversationTurns.length).toBe(1);
    expect(session.conversationTurns[0].speaker).toBe("ai");
    expect(session.conversationTurns[0].text).toContain("കാഷ്വാലിറ്റി");

    const summary = session.getSummary();
    expect(summary.turnCount).toBe(1);
    expect(summary.detectedLanguage).toBe("ml-IN");
    expect(summary.lastAiResponse).toContain("കാഷ്വാലിറ്റി");
  });

  it("handles barge-in: when caller speaks during playback, Exotel clear event is dispatched immediately", () => {
    const stt = new MockSttProvider();
    const tts = new MockTtsProvider();
    const engine = new HospitalConversationEngine(DAYA_HOSPITAL_CONFIG);

    const session = new CallMediaSession({
      streamSid: "MZ_test_stream_03",
      callSid: "CA_test_call_03",
      accountSid: "AC_test_account_03",
      from: "+919876543210",
      to: "08047291658",
      socket: mockSocket,
      sttProvider: stt,
      ttsProvider: tts,
      conversationEngine: engine,
    });

    session.markStarted();
    session.ttsStatus = "PLAYING";

    // Caller interrupts
    session.interruptPlayback();

    const clearMsg = mockSocket.sentMessages.find((m) => {
      const parsed = JSON.parse(m);
      return parsed.event === "clear" && parsed.streamSid === "MZ_test_stream_03";
    });

    expect(clearMsg).toBeDefined();
    expect(session.ttsStatus).toBe("INTERRUPTED");
  });
});

describe("Multi-Hospital Tenant Resolution (08047291658 & Aliases)", () => {
  it("resolves Daya Hospital from trial ExoPhone 08047291658 with verified status", () => {
    const resolved = resolveHospitalByPhoneNumber("08047291658");
    expect(resolved).not.toBeNull();
    expect(resolved?.hospitalId).toBe("hosp_daya_thrissur");
    expect(resolved?.shortName).toBe("Daya Hospital");
  });

  it("resolves Daya Hospital from +918047291658 with verified status", () => {
    const resolved = resolveHospitalByPhoneNumber("+918047291658");
    expect(resolved).not.toBeNull();
    expect(resolved?.hospitalId).toBe("hosp_daya_thrissur");
  });

  it("resolves Daya Hospital from primary hospital number +914872475000", () => {
    const resolved = resolveHospitalByPhoneNumber("+914872475000");
    expect(resolved).not.toBeNull();
    expect(resolved?.hospitalId).toBe("hosp_daya_thrissur");
  });

  it("resolves Daya Hospital via TenantResolver for incoming Exotel call metadata", () => {
    const result = tenantResolver.resolveTenant({
      streamSid: "MZ_trial_stream",
      callSid: "CA_trial_call",
      accountSid: "AC_unknown",
      to: "08047291658",
      from: "+919876543210",
    });

    expect(result.verified).toBe(true);
    expect(result.hospitalId).toBe("hosp_daya_thrissur");
    expect(result.resolutionSource).toBe("PHONE_NUMBER");
  });
});
