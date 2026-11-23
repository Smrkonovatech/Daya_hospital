/**
 * ============================================================================
 * SARVAM TEXT-TO-SPEECH (TTS) STREAMING PROVIDER
 * ============================================================================
 *
 * Converts Malayalam dialogue text into signed 16-bit 8000 Hz mono linear PCM
 * audio formatted for Exotel AgentStream transmission.
 *
 * Integrates with Sarvam Bulbul model (`bulbul:v3`) with fallback to mock
 * synthesis in sandbox / development environments.
 */

import { TextToSpeechProvider } from "./speech-interfaces";
import { defaultAudioEngine } from "./audio-engine";
import { getSarvamConfig, SarvamConfig } from "./sarvam-config";

export class SarvamTextToSpeechProvider implements TextToSpeechProvider {
  private config: SarvamConfig;
  private static audioCache: Map<string, Buffer> = new Map();

  constructor(configOverrides?: Partial<SarvamConfig>) {
    this.config = getSarvamConfig(configOverrides);
  }

  /**
   * Pre-warms the static audio cache with common phrases (e.g. welcome greeting).
   */
  public static async prewarmCache(phrases: string[], options?: { voiceId?: string; pace?: number }): Promise<void> {
    const provider = new SarvamTextToSpeechProvider();
    for (const phrase of phrases) {
      try {
        await provider.synthesize(phrase, options);
      } catch {
        // Ignored
      }
    }
  }

  /**
   * Synthesizes Malayalam text to signed 16-bit 8000 Hz mono PCM Buffer.
   * Leverages static in-memory caching to eliminate 1-3s TTS latency on recurring phrases.
   */
  public async synthesize(
    text: string,
    options?: {
      language?: string;
      voiceId?: string;
      pitch?: number;
      pace?: number;
    }
  ): Promise<Buffer> {
    if (!text || !text.trim()) {
      return Buffer.alloc(0);
    }

    const trimmed = text.trim();
    const speaker = options?.voiceId || this.config.ttsSpeaker || "kavitha";
    const pace = options?.pace || this.config.ttsPace || 1.15;
    const cacheKey = `${trimmed}::${speaker}::${pace}`;

    if (SarvamTextToSpeechProvider.audioCache.has(cacheKey)) {
      return SarvamTextToSpeechProvider.audioCache.get(cacheKey)!;
    }

    // In Mock Mode or when API key is not configured, return test audio
    if (!this.config.isConfigured) {
      if (
        process.env.NODE_ENV === "production" ||
        process.env.RAILWAY_ENVIRONMENT === "production"
      ) {
        console.error(
          `[SarvamTTS:MOCK_MODE_WARNING] Synthesize requested for text "${trimmed.slice(0, 30)}..." but SARVAM_API_KEY is not configured in production!`
        );
      }
      return this.generateMockAudio(trimmed);
    }

    try {
      const endpoint = `${this.config.baseUrl}/text-to-speech`;
      const payload = {
        inputs: [trimmed],
        target_language_code: options?.language || this.config.languageCode || "ml-IN",
        speaker,
        speech_sample_rate: 8000,
        model: this.config.ttsModel || "bulbul:v3",
        enable_preprocessing: true,
        pace,
      };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "api-subscription-key": this.config.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`[SarvamTTS] Synthesis failed (HTTP ${res.status}):`, errorText);
        // Fallback to synthetic tone on API error
        return this.generateMockAudio(trimmed);
      }

      const data = (await res.json()) as { audios?: string[] };
      const base64Audio = data.audios?.[0];

      if (!base64Audio) {
        console.warn("[SarvamTTS] API returned empty audio array.");
        return this.generateMockAudio(trimmed);
      }

      const rawBuffer = Buffer.from(base64Audio, "base64");
      const pcmBuffer = this.extractPcmFromWav(rawBuffer);

      if (SarvamTextToSpeechProvider.audioCache.size < 150) {
        SarvamTextToSpeechProvider.audioCache.set(cacheKey, pcmBuffer);
      }

      return pcmBuffer;
    } catch (err: unknown) {
      console.error("[SarvamTTS] Network or processing error:", err instanceof Error ? err.message : err);
      return this.generateMockAudio(trimmed);
    }
  }

  /**
   * Extracts raw linear 16-bit PCM from a WAV container, resampling to 8kHz if required.
   */
  public extractPcmFromWav(buffer: Buffer): Buffer {
    if (buffer.length < 44) {
      return defaultAudioEngine.alignPcmToFrame(buffer, 320);
    }

    // Check for RIFF header
    const isRiff = buffer.subarray(0, 4).toString("ascii") === "RIFF";
    const isWave = buffer.subarray(8, 12).toString("ascii") === "WAVE";

    if (!isRiff || !isWave) {
      // Already raw PCM
      return defaultAudioEngine.alignPcmToFrame(buffer, 320);
    }

    try {
      let sampleRate = 8000;
      let channels = 1;
      let dataOffset = 44;

      // Scan chunks to locate 'fmt ' and 'data'
      let offset = 12;
      while (offset + 8 <= buffer.length) {
        const chunkId = buffer.subarray(offset, offset + 4).toString("ascii");
        const chunkSize = buffer.readUInt32LE(offset + 4);

        if (chunkId === "fmt ") {
          channels = buffer.readUInt16LE(offset + 10);
          sampleRate = buffer.readUInt32LE(offset + 12);
        } else if (chunkId === "data") {
          dataOffset = offset + 8;
          break;
        }

        offset += 8 + chunkSize;
      }

      const pcmData = buffer.subarray(dataOffset);

      // Downsample to 8000 Hz if returned at 16000 or 24000 Hz
      let normalizedPcm = pcmData;
      if (sampleRate !== 8000) {
        normalizedPcm = this.resampleTo8k(pcmData, sampleRate, channels);
      }

      return defaultAudioEngine.alignPcmToFrame(normalizedPcm, 320);
    } catch {
      // Fallback: strip standard 44-byte WAV header
      const fallbackPcm = buffer.subarray(44);
      return defaultAudioEngine.alignPcmToFrame(fallbackPcm, 320);
    }
  }

  /**
   * Resamples 16-bit PCM to 8000 Hz mono linear PCM.
   */
  public resampleTo8k(buffer: Buffer, originalSampleRate: number, channels: number): Buffer {
    if (originalSampleRate === 8000 && channels === 1) {
      return buffer;
    }

    const ratio = originalSampleRate / 8000;
    const sourceSamples = Math.floor(buffer.length / (2 * channels));
    const targetSamples = Math.floor(sourceSamples / ratio);
    const targetBuffer = Buffer.alloc(targetSamples * 2);

    for (let i = 0; i < targetSamples; i++) {
      const sourceIndex = Math.floor(i * ratio) * channels;
      const byteOffset = sourceIndex * 2;
      if (byteOffset + 1 < buffer.length) {
        const sample = buffer.readInt16LE(byteOffset);
        targetBuffer.writeInt16LE(sample, i * 2);
      }
    }

    return targetBuffer;
  }

  /**
   * Generates mock PCM audio for tests and offline development.
   */
  private generateMockAudio(text: string): Buffer {
    // Generate ~300ms of audio per word, minimum 3200 bytes (200ms)
    const wordCount = Math.max(1, text.split(/\s+/).length);
    const durationMs = Math.max(400, Math.min( wordCount * 250, 4000 ));
    const silentPcm = defaultAudioEngine.generateSilentPcm(durationMs, 8000);
    return defaultAudioEngine.alignPcmToFrame(silentPcm, 320);
  }
}

