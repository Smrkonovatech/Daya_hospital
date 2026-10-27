import { describe, it, expect } from "vitest";
import { MockSarvamVoiceAdapter } from "./mock-adapter";

describe("MockSarvamVoiceAdapter", () => {
  const adapter = new MockSarvamVoiceAdapter();

  it("returns healthy status for Malayalam voice engine", async () => {
    const health = await adapter.healthCheck();
    expect(health.status).toBe("HEALTHY");
    expect(health.service).toBe("sarvam_ai");
    expect(health.latencyMs).toBe(240);
  });

  it("transcribes Malayalam audio buffer", async () => {
    const buffer = Buffer.from("mock_audio_data");
    const result = await adapter.transcribeMalayalamAudio(buffer);
    expect(result.transcriptText).toContain("ഡോക്ടർ");
    expect(result.languageConfidence).toBeGreaterThanOrEqual(0.9);
  });

  it("generates spoken Malayalam audio metadata", async () => {
    const result = await adapter.generateSpokenMalayalam("നമസ്കാരം!");
    expect(result.audioUrl).toBeDefined();
    expect(result.durationSecs).toBeGreaterThan(0);
  });
});
