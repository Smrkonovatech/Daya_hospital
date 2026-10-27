import { ISarvamVoiceAdapter, IntegrationHealth } from "../types";

export class MockSarvamVoiceAdapter implements ISarvamVoiceAdapter {
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
