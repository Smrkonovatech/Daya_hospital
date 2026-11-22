/**
 * ============================================================================
 * PROVIDER ABSTRACTION & CAPABILITIES TEST SUITE (PHASE 2 & 3)
 * ============================================================================
 *
 * Tests for:
 * 1. Exotel provider interface & Singapore capability audit
 * 2. Sarvam provider interface, models, speakers, and language matrix
 * 3. Model/speaker compatibility validation (rejecting v4-flash on Malayalam)
 * 4. Speech synthesis / live voice preview generation
 * 5. Provider registry resolution
 */

import { describe, it, expect } from "vitest";
import { providerRegistry } from "./provider-registry";
import { exotelTelephonyProvider } from "./telephony/exotel/exotel-provider";
import { sarvamAiProvider } from "./ai/sarvam/sarvam-provider";
import { getExotelCapabilities } from "./telephony/exotel/exotel-capabilities";
import { getCachedSarvamCapabilities } from "./ai/sarvam/sarvam-capabilities";

describe("Provider Abstraction Layer (Phase 2 & 3)", () => {
  describe("Provider Registry", () => {
    it("resolves default Exotel telephony provider", () => {
      const provider = providerRegistry.getTelephonyProvider("EXOTEL");
      expect(provider).toBeDefined();
      expect(provider.providerName).toBe("EXOTEL");
    });

    it("resolves default Sarvam AI provider", () => {
      const provider = providerRegistry.getAiProvider("SARVAM_AI");
      expect(provider).toBeDefined();
      expect(provider.providerName).toBe("SARVAM_AI");
    });
  });

  describe("Exotel Telephony Capabilities (Singapore Region)", () => {
    it("reports verified API capabilities for smrkonova1", () => {
      const caps = getExotelCapabilities("smrkonova1");
      expect(caps.provider).toBe("EXOTEL");
      expect(caps.region).toContain("Singapore");

      const outbound = caps.capabilities.find((c) => c.id === "outbound_calls_connect");
      expect(outbound?.status).toBe("VERIFIED_API_SUPPORTED");

      const stream = caps.capabilities.find((c) => c.id === "agentstream_websocket");
      expect(stream?.status).toBe("VERIFIED_API_SUPPORTED");

      const flowBuilder = caps.capabilities.find((c) => c.id === "flow_builder_api");
      expect(flowBuilder?.status).toBe("VERIFIED_DASHBOARD_ONLY");
    });

    it("validates provider configuration successfully", async () => {
      const validation = await exotelTelephonyProvider.validateConfiguration({
        exotelAccountSid: "smrkonova1",
        exotelApiKey: "9da962760ebb9a1db7e55d4253c6eea61355cd9c499344a0",
        exotelApiToken: "412bf30bbc6efea04d08751e2e04fd972744d422d7d8c229",
        defaultExoPhone: "08047291658",
      });

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("flags missing Account SID in configuration", async () => {
      const validation = await exotelTelephonyProvider.validateConfiguration({
        exotelApiKey: "key_123",
      });

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain("Exotel Account SID is required.");
    });
  });

  describe("Sarvam AI Models & Capabilities", () => {
    it("provides official STT, LLM, and TTS models", async () => {
      const caps = getCachedSarvamCapabilities();
      expect(caps.sttModels.some((m) => m.id === "saaras:v4")).toBe(true);
      expect(caps.llmModels.some((m) => m.id === "sarvam-105b-conversations")).toBe(true);
      expect(caps.ttsModels.some((m) => m.id === "bulbul:v3")).toBe(true);
      expect(caps.speakers.some((s) => s.id === "kavitha")).toBe(true);
    });

    it("includes Malayalam (ml-IN) and English (en-IN) in supported languages", () => {
      const languages = sarvamAiProvider.getSupportedLanguages();
      expect(languages.some((l) => l.code === "ml-IN")).toBe(true);
      expect(languages.some((l) => l.code === "en-IN")).toBe(true);
    });

    it("rejects bulbul:v4-flash for Malayalam speech synthesis", async () => {
      const result = await sarvamAiProvider.generateSpeech({
        text: "നമസ്കാരം",
        languageCode: "ml-IN",
        model: "bulbul:v4-flash",
        speaker: "kavitha",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("does not support Malayalam");
    });

    it("synthesizes valid speech audio in sandbox/test mode", async () => {
      const result = await sarvamAiProvider.generateSpeech({
        text: "നമസ്കാരം, ദയ ഹോസ്പിറ്റലിലേക്ക് സ്വാഗതം.",
        languageCode: "ml-IN",
        model: "bulbul:v3",
        speaker: "kavitha",
        pace: 1.15,
        sampleRate: 8000,
      });

      expect(result.success).toBe(true);
      expect(result.audioBuffer).toBeDefined();
      expect(result.audioBase64).toBeDefined();
      expect(result.mimeType).toBe("audio/wav");
      expect(result.sampleRate).toBe(8000);
    });

    it("rejects unavailable speaker meera with clear explanation", async () => {
      const result = await sarvamAiProvider.generateSpeech({
        text: "നമസ്കാരം",
        languageCode: "ml-IN",
        model: "bulbul:v3",
        speaker: "meera",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Speaker 'meera' is not available");
    });

    it("synthesizes valid English speech audio with verified speaker", async () => {
      const result = await sarvamAiProvider.generateSpeech({
        text: "Welcome to Daya Hospital Thrissur.",
        languageCode: "en-IN",
        model: "bulbul:v3",
        speaker: "ratan",
        pace: 1.0,
        sampleRate: 8000,
      });

      expect(result.success).toBe(true);
      expect(result.audioBuffer).toBeDefined();
      expect(result.mimeType).toBe("audio/wav");
    });
  });
});

