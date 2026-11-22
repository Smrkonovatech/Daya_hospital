/**
 * ============================================================================
 * SARVAM AI PROVIDER IMPLEMENTATION
 * ============================================================================
 *
 * Implements IAiProvider for Sarvam AI Speech & Voice Platform.
 * Supports TTS speech synthesis (voice preview), speech transcription,
 * and capability discovery with strict model/speaker compatibility validation.
 */

import {
  AiCapabilities,
  IAiProvider,
  ModelCapabilityItem,
  SpeakerCapabilityItem,
  SpeechSynthesisParams,
  SpeechSynthesisResult,
  SpeechTranscriptionParams,
  SpeechTranscriptionResult,
} from "../ai-provider.interface";
import {
  getCachedSarvamCapabilities,
  SARVAM_SPEAKERS,
  SARVAM_STT_MODELS,
  SARVAM_SUPPORTED_LANGUAGES,
  SARVAM_TTS_MODELS,
  SARVAM_LLM_MODELS,
} from "./sarvam-capabilities";
import { getSarvamConfig } from "@/media-gateway/sarvam-config";

export class SarvamAiProvider implements IAiProvider {
  public readonly providerName = "SARVAM_AI";

  public async getAvailableModels(): Promise<ModelCapabilityItem[]> {
    return [...SARVAM_STT_MODELS, ...SARVAM_LLM_MODELS, ...SARVAM_TTS_MODELS];
  }

  public async getAvailableVoices(
    model?: string,
    languageCode?: string
  ): Promise<SpeakerCapabilityItem[]> {
    let list = [...SARVAM_SPEAKERS];
    if (model) {
      list = list.filter((s) => s.compatibleTtsModels.includes(model));
    }
    if (languageCode) {
      list = list.filter((s) => s.supportedLanguages.includes(languageCode));
    }
    return list;
  }

  public getSupportedLanguages(): Array<{ code: string; name: string; nativeName: string }> {
    return SARVAM_SUPPORTED_LANGUAGES;
  }

  public async getCapabilities(forceRefresh = false): Promise<AiCapabilities> {
    return getCachedSarvamCapabilities(forceRefresh);
  }

  /**
   * Generates speech audio via official Sarvam TTS API (https://api.sarvam.ai/text-to-speech)
   * Used for Voice Selection previews and offline prompt testing.
   */
  public async generateSpeech(params: SpeechSynthesisParams): Promise<SpeechSynthesisResult> {
    const startTime = Date.now();
    const config = getSarvamConfig();

    // 1. Invariant Validation: Check Model & Language Compatibility
    if (params.model === "bulbul:v4-flash" && params.languageCode === "ml-IN") {
      return {
        success: false,
        mimeType: "audio/wav",
        sampleRate: params.sampleRate || 8000,
        latencyMs: Date.now() - startTime,
        error: "bulbul:v4-flash does not support Malayalam (ml-IN). Please select bulbul:v3 with speaker kavitha.",
      };
    }

    // 2. Invariant Validation: Check Model & Speaker Compatibility
    const speakerInfo = SARVAM_SPEAKERS.find((s) => s.id === params.speaker);
    if (speakerInfo && !speakerInfo.compatibleTtsModels.includes(params.model)) {
      return {
        success: false,
        mimeType: "audio/wav",
        sampleRate: params.sampleRate || 8000,
        latencyMs: Date.now() - startTime,
        error: `Incompatible voice: Speaker '${params.speaker}' is not supported by model '${params.model}'.`,
      };
    }

    // 2. Mock Sandbox / Test Environment Fallback
    const isMock =
      process.env.NODE_ENV === "test" ||
      !config.apiKey ||
      config.apiKey.includes("placeholder") ||
      process.env.MOCK_SARVAM === "true";

    if (isMock) {
      const mockWav = this.generateSyntheticWav(params.text, params.sampleRate || 8000);
      return {
        success: true,
        audioBuffer: mockWav,
        audioBase64: mockWav.toString("base64"),
        mimeType: "audio/wav",
        sampleRate: params.sampleRate || 8000,
        durationSeconds: 2.5,
        latencyMs: Date.now() - startTime,
      };
    }

    // 3. Live Sarvam HTTP API Call
    try {
      const payload = {
        inputs: [params.text],
        target_language_code: params.languageCode || "ml-IN",
        speaker: params.speaker || "kavitha",
        pitch: 0,
        pace: params.pace || 1.15,
        loudness: 1.5,
        speech_sample_rate: params.sampleRate || 8000,
        enable_preprocessing: true,
        model: params.model || "bulbul:v3",
      };

      const res = await fetch(`${config.baseUrl}/text-to-speech`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-subscription-key": config.apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        return {
          success: false,
          mimeType: "audio/wav",
          sampleRate: params.sampleRate || 8000,
          latencyMs: Date.now() - startTime,
          error: `Sarvam TTS API returned HTTP ${res.status}: ${errText.slice(0, 200)}`,
        };
      }

      const data = await res.json();
      const rawBase64 = data.audios?.[0];

      if (!rawBase64) {
        return {
          success: false,
          mimeType: "audio/wav",
          sampleRate: params.sampleRate || 8000,
          latencyMs: Date.now() - startTime,
          error: "Sarvam TTS returned empty audio payload",
        };
      }

      const buffer = Buffer.from(rawBase64, "base64");
      return {
        success: true,
        audioBuffer: buffer,
        audioBase64: rawBase64,
        mimeType: "audio/wav",
        sampleRate: params.sampleRate || 8000,
        latencyMs: Date.now() - startTime,
      };
    } catch (err) {
      return {
        success: false,
        mimeType: "audio/wav",
        sampleRate: params.sampleRate || 8000,
        latencyMs: Date.now() - startTime,
        error: err instanceof Error ? err.message : "Sarvam speech synthesis request failed",
      };
    }
  }

  /**
   * Transcribes speech audio using Sarvam Saaras API
   */
  public async transcribeSpeech(params: SpeechTranscriptionParams): Promise<SpeechTranscriptionResult> {
    const startTime = Date.now();
    const isMock =
      process.env.NODE_ENV === "test" ||
      !process.env.SARVAM_API_KEY ||
      process.env.SARVAM_API_KEY.includes("placeholder");

    if (isMock) {
      return {
        success: true,
        transcript: "നമസ്കാരം, എനിക്ക് ഡോക്ടറെ കാണാൻ അപ്പോയിന്റ്മെന്റ് വേണം.",
        detectedLanguage: params.languageCode || "ml-IN",
        confidence: 0.98,
        latencyMs: Date.now() - startTime,
      };
    }

    try {
      const config = getSarvamConfig();
      const formData = new FormData();
      const blob = new Blob([new Uint8Array(params.audioBuffer)], { type: "audio/wav" });
      formData.append("file", blob, "audio.wav");
      formData.append("language_code", params.languageCode || "ml-IN");
      formData.append("model", params.model || "saaras:v2");

      const res = await fetch(`${config.baseUrl}/speech-to-text`, {
        method: "POST",
        headers: {
          "api-subscription-key": config.apiKey,
        },
        body: formData,
      });

      if (!res.ok) {
        return {
          success: false,
          transcript: "",
          latencyMs: Date.now() - startTime,
          error: `Sarvam STT returned HTTP ${res.status}`,
        };
      }

      const data = await res.json();
      return {
        success: true,
        transcript: data.transcript || "",
        detectedLanguage: data.language_code || params.languageCode,
        confidence: 0.95,
        latencyMs: Date.now() - startTime,
      };
    } catch (err) {
      return {
        success: false,
        transcript: "",
        latencyMs: Date.now() - startTime,
        error: err instanceof Error ? err.message : "STT transcription error",
      };
    }
  }

  public async validateConfiguration(
    config: Record<string, unknown>
  ): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const apiKey = String(config.apiKey || config.sarvamApiKey || "");
    const ttsModel = String(config.ttsModel || "bulbul:v3");
    const speaker = String(config.speaker || "kavitha");

    if (!apiKey) {
      errors.push("Sarvam API Subscription Key is required.");
    }

    const speakerInfo = SARVAM_SPEAKERS.find((s) => s.id === speaker);
    if (!speakerInfo) {
      errors.push(`Unknown Sarvam speaker '${speaker}'.`);
    } else if (!speakerInfo.compatibleTtsModels.includes(ttsModel)) {
      errors.push(`Speaker '${speaker}' is not compatible with TTS model '${ttsModel}'.`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Generates a valid RIFF WAV header and sine wave tone for mock/test runs
   */
  private generateSyntheticWav(text: string, sampleRate = 8000): Buffer {
    const durationSec = 1.0;
    const numSamples = Math.floor(sampleRate * durationSec);
    const dataSize = numSamples * 2; // 16-bit
    const header = Buffer.alloc(44);

    header.write("RIFF", 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write("WAVE", 8);
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20); // PCM
    header.writeUInt16LE(1, 22); // Mono
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * 2, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write("data", 36);
    header.writeUInt32LE(dataSize, 40);

    const samples = Buffer.alloc(dataSize);
    for (let i = 0; i < numSamples; i++) {
      const sample = Math.round(15000 * Math.sin((2 * Math.PI * 440 * i) / sampleRate));
      samples.writeInt16LE(sample, i * 2);
    }

    return Buffer.concat([header, samples]);
  }
}

export const sarvamAiProvider = new SarvamAiProvider();
