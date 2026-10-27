import * as crypto from "crypto";
import {
  ISarvamVoiceAdapter,
  IntegrationHealth,
  SarvamInteractionMetadata,
  SarvamTranscriptTurn,
  SarvamSummary,
} from "../types";

export class MockSarvamVoiceAdapter implements ISarvamVoiceAdapter {
  private webhookSecret: string;

  constructor(webhookSecret?: string) {
    this.webhookSecret = webhookSecret || process.env.SARVAM_WEBHOOK_SECRET || "mock_sarvam_secret_key_2026";
  }

  async healthCheck(): Promise<IntegrationHealth> {
    return {
      service: "sarvam_ai",
      status: "HEALTHY",
      latencyMs: 240,
      mode: "MOCK_MODE",
      lastChecked: new Date().toISOString(),
      details: "Mock Sarvam Voice Adapter — Malayalam Saarathi Engine Sandbox",
    };
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!signature) return false;

    // Allow static mock testing token
    if (signature === "mock_valid_sarvam_signature") return true;
    if (signature === "invalid_signature") return false;

    try {
      const hmac = crypto.createHmac("sha256", this.webhookSecret);
      hmac.update(rawBody);
      const expectedSignature = hmac.digest("hex");

      const sigClean = signature.replace(/^sha256=/, "");
      return sigClean === expectedSignature;
    } catch {
      return false;
    }
  }

  async getInteractionMetadata(
    interactionId: string
  ): Promise<SarvamInteractionMetadata | null> {
    return {
      interactionId,
      agentId: "agent_sarvam_malayalam_dgh",
      startTime: "2026-10-27T08:30:15+05:30",
      endTime: "2026-10-27T08:32:37+05:30",
      durationSeconds: 142,
      status: "COMPLETED",
      callerNumber: "+91 94471 •••••",
      audioRecordingAvailable: true,
      recordingUrl: `https://audio.dayahospital.com/mock/recordings/${interactionId}.opus`,
      language: "malayalam",
    };
  }

  async getTranscript(
    interactionId: string
  ): Promise<SarvamTranscriptTurn[]> {
    void interactionId;
    return [
      {
        id: "turn_01",
        speaker: "agent",
        text: "നമസ്കാരം, ദയാ ജനറൽ ഹോസ്പിറ്റൽ വോയ്സ് അസിസ്റ്റന്റാണ്. ഞാൻ എങ്ങനെ സഹായിക്കണം?",
        textMalayalam: "നമസ്കാരം, ദയാ ജനറൽ ഹോസ്പിറ്റൽ വോയ്സ് അസിസ്റ്റന്റാണ്. ഞാൻ എങ്ങനെ സഹായിക്കണം?",
        timestampMs: 800,
        confidence: 0.99,
      },
      {
        id: "turn_02",
        speaker: "caller",
        text: "ഡോക്ടർ രാജേഷ് കുമാറിനെ കാണാൻ നാളെ സമയം ഉണ്ടോ?",
        textMalayalam: "ഡോക്ടർ രാജേഷ് കുമാറിനെ കാണാൻ നാളെ സമയം ഉണ്ടോ?",
        timestampMs: 3200,
        confidence: 0.97,
      },
      {
        id: "turn_03",
        speaker: "agent",
        text: "നാളെ രാവിലെ 10:30 ന് ഇഎൻടി ഒപിയിൽ ടോക്കൺ 14 ലഭ്യമാണ്.",
        textMalayalam: "നാളെ രാവിലെ 10:30 ന് ഇഎൻടി ഒപിയിൽ ടോക്കൺ 14 ലഭ്യമാണ്.",
        timestampMs: 8500,
        confidence: 0.98,
      },
    ];
  }

  async getSummary(
    interactionId: string
  ): Promise<SarvamSummary | null> {
    void interactionId;
    return {
      summaryMalayalam: "രോഗി ഇഎൻടി ഡോക്ടർ രാജേഷ് കുമാറുമായി നാളത്തെ ഒപി കൺസൾട്ടേഷന് ടോക്കൺ നമ്പർ 14 ഉറപ്പാക്കി.",
      summaryEnglish: "Patient booked OPD consultation token #14 with ENT specialist Dr. Rajesh Kumar for tomorrow.",
      primaryIntent: "APPOINTMENT_BOOKING",
      intentConfidence: 0.98,
      detectedLanguage: "malayalam",
      actionIdentified: "BOOK_APPOINTMENT",
      requiresFollowUp: false,
    };
  }

  async getRecordingUrl(
    interactionId: string
  ): Promise<{ url: string; mimeType: string } | null> {
    return {
      url: `https://audio.dayahospital.com/mock/recordings/${interactionId}.opus`,
      mimeType: "audio/webm;codecs=opus",
    };
  }

  async executeTool(
    toolName: string,
    parameters: Record<string, unknown>
  ): Promise<{ success: boolean; result: unknown; error?: string }> {
    if (toolName === "check_doctor_availability") {
      return {
        success: true,
        result: {
          available: true,
          slots: ["10:30 AM", "11:45 AM"],
          fee: 450,
        },
      };
    }

    if (toolName === "book_opd_slot") {
      return {
        success: true,
        result: {
          bookingRef: `DAYA-HMS-OPD-${Math.floor(10000 + Math.random() * 90000)}`,
          tokenNumber: 14,
          doctor: parameters.doctor || "Dr. Rajesh Kumar",
        },
      };
    }

    return {
      success: true,
      result: { executed: true, toolName, parameters },
    };
  }

  async transcribeMalayalamAudio(audioBuffer: Buffer): Promise<{
    transcriptText: string;
    languageConfidence: number;
  }> {
    void audioBuffer;
    return {
      transcriptText: "എനിക്ക് ഓർത്തോയിൽ ഡോക്ടർ സുരേഷ് കുമാറിനെ കാണണം.",
      languageConfidence: 0.98,
    };
  }

  async generateSpokenMalayalam(textMalayalam: string): Promise<{
    audioUrl: string;
    durationSecs: number;
  }> {
    void textMalayalam;
    return {
      audioUrl: "https://audio.dayahospital.com/mock/sample_malayalam_reply.mp3",
      durationSecs: 4,
    };
  }
}
