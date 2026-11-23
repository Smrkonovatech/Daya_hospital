/**
 * ============================================================================
 * SARVAM REAL-TIME SPEECH-TO-TEXT (STT) STREAMING PROVIDER
 * ============================================================================
 *
 * Streams real-time Exotel caller audio (8000 Hz 16-bit linear PCM) to
 * Sarvam's Saaras streaming model (`saaras:v4`) over WebSockets.
 *
 * Features:
 * - Real-time Malayalam (`ml-IN`) speech transcription.
 * - Energy-based local Voice Activity Detection (VAD) for instant barge-in detection.
 * - Rolling buffer with REST STT fallback for resiliency against connection drops.
 * - Graceful mock mode fallback when running offline or in unit tests.
 */

import { WebSocket as WsClient } from "ws";
import { SpeechToTextProvider, TranscriptTurnResult } from "./speech-interfaces";
import { getSarvamConfig, SarvamConfig } from "./sarvam-config";

export interface SarvamSttOptions {
  languageCode?: string;
  model?: string;
  sampleRate?: number;
  vadThreshold?: number; // RMS energy threshold (default 400)
  silenceTimeoutMs?: number; // Silence duration before utterance finalize (default 1000ms)
}

export class SarvamSpeechToTextProvider implements SpeechToTextProvider {
  private config: SarvamConfig;
  private ws: WsClient | null = null;
  private isConnected = false;
  private isConnecting = false;
  private transcriptCallback?: (turn: TranscriptTurnResult) => void;
  private speechStartCallback?: () => void;
  private speechEndCallback?: (vadTimestampMs: number) => void;

  private languageCode: string;
  private model: string;
  private sampleRate: number;
  private vadThreshold: number;
  private silenceTimeoutMs: number;

  // Utterance tracking & VAD state
  private isSpeaking = false;
  private lastSpeechTimestamp = 0;
  private lastCallerAudioReceivedTimestamp = 0;
  private silenceTimer: NodeJS.Timeout | null = null;
  private accumulatedPcmChunks: Buffer[] = [];
  private currentTurnText = "";
  private lastFinalTranscriptText = "";
  private lastFinalTranscriptTimestamp = 0;

  constructor(options?: SarvamSttOptions, configOverrides?: Partial<SarvamConfig>) {
    this.config = getSarvamConfig(configOverrides);
    this.languageCode = options?.languageCode || this.config.languageCode || "ml-IN";
    this.model = options?.model || this.config.sttModel || "saaras:v4";
    this.sampleRate = options?.sampleRate || 8000;
    this.vadThreshold = options?.vadThreshold ?? 400;
    this.silenceTimeoutMs =
      options?.silenceTimeoutMs ?? this.config.sttSilenceTimeoutMs ?? 400;
  }

  /**
   * Initializes the WebSocket stream with Sarvam's streaming speech recognizer.
   */
  public async connect(): Promise<void> {
    if (!this.config.isConfigured) {
      if (
        process.env.NODE_ENV === "production" ||
        process.env.RAILWAY_ENVIRONMENT === "production"
      ) {
        console.error(
          "[SarvamSTT:MOCK_MODE_WARNING] STT connect requested but SARVAM_API_KEY is not configured in production! Mock STT will be used."
        );
      }
      // Mock mode: immediately mark connected without network
      this.isConnected = true;
      return;
    }

    if (this.isConnected || this.isConnecting) return;
    this.isConnecting = true;

    return new Promise((resolve) => {
      try {
        const query = new URLSearchParams({
          language_code: this.languageCode,
          model: this.model,
          sample_rate: String(this.sampleRate),
        });

        const url = `${this.config.sttWsUrl}?${query.toString()}`;
        this.ws = new WsClient(url, {
          headers: {
            "api-subscription-key": this.config.apiKey,
          },
        });

        this.ws.on("open", () => {
          this.isConnected = true;
          this.isConnecting = false;
          resolve();
        });

        this.ws.on("message", (raw) => {
          this.handleIncomingMessage(raw.toString("utf8"));
        });

        this.ws.on("error", (err) => {
          console.warn("[SarvamSTT] WebSocket error:", err.message);
          this.isConnected = false;
          this.isConnecting = false;
          resolve(); // Resolve to prevent hanging session initialization
        });

        this.ws.on("close", () => {
          this.isConnected = false;
          this.isConnecting = false;
        });

        // Fail-safe timeout
        setTimeout(() => {
          if (this.isConnecting) {
            this.isConnecting = false;
            resolve();
          }
        }, 3000);
      } catch (err) {
        console.warn("[SarvamSTT] Connect exception:", err);
        this.isConnecting = false;
        resolve();
      }
    });
  }

  /**
   * Streams raw 16-bit 8000 Hz PCM audio to Sarvam and processes local VAD.
   */
  public async sendAudio(audioChunk: Buffer): Promise<void> {
    if (!audioChunk || audioChunk.length === 0) return;

    this.lastCallerAudioReceivedTimestamp = Date.now();

    // 1. Local Energy-based Voice Activity Detection (VAD)
    const rms = this.calculateRms(audioChunk);
    const speechDetected = rms > this.vadThreshold;

    if (speechDetected) {
      this.lastSpeechTimestamp = Date.now();
      this.accumulatedPcmChunks.push(audioChunk);

      if (!this.isSpeaking) {
        this.isSpeaking = true;
        if (this.speechStartCallback) {
          this.speechStartCallback();
        }
      }

      // Reset silence timer
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }
    } else if (this.isSpeaking) {
      // Caller was speaking, now in silence
      this.accumulatedPcmChunks.push(audioChunk);

      if (!this.silenceTimer) {
        this.silenceTimer = setTimeout(() => {
          const speechEndVadMs = this.lastSpeechTimestamp || Date.now();
          if (this.speechEndCallback) {
            this.speechEndCallback(speechEndVadMs);
          }
          this.finalizeUtterance(this.lastCallerAudioReceivedTimestamp, speechEndVadMs);
        }, this.silenceTimeoutMs);
      }
    }

    // 2. Stream audio to Sarvam WebSocket if connected
    if (this.ws && this.ws.readyState === WsClient.OPEN) {
      try {
        const payload = JSON.stringify({
          audio: audioChunk.toString("base64"),
        });
        this.ws.send(payload);
      } catch {
        // Ignored if socket closing
      }
    }
  }

  /**
   * Registers callback for transcription results (interim and final).
   */
  public onTranscript(callback: (turn: TranscriptTurnResult) => void): void {
    this.transcriptCallback = callback;
  }

  /**
   * Registers callback when caller speech finishes (triggers speech-end telemetry).
   */
  public onSpeechEnd(callback: (vadTimestampMs: number) => void): void {
    this.speechEndCallback = callback;
  }

  /**
   * Manually emits a transcript event (used by tests or fallbacks).
   */
  public emitTranscript(turn: TranscriptTurnResult): void {
    if (this.transcriptCallback) {
      this.transcriptCallback(turn);
    }
  }

  /**
   * Registers callback when caller speech begins (triggers barge-in).
   */
  public onSpeechStart(callback: () => void): void {
    this.speechStartCallback = callback;
  }

  /**
   * Manually triggers speech start event (used by tests or fallbacks).
   */
  public triggerSpeechStart(): void {
    if (this.speechStartCallback) {
      this.speechStartCallback();
    }
  }

  /**
   * Gracefully terminates STT connection and flushes state.
   */
  public async close(): Promise<void> {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    this.isConnected = false;
    this.isSpeaking = false;
    this.accumulatedPcmChunks = [];
    this.currentTurnText = "";
    this.lastFinalTranscriptText = "";
    this.lastFinalTranscriptTimestamp = 0;

    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // Ignored
      }
      this.ws = null;
    }
  }

  /**
   * Handles incoming WebSocket messages from Sarvam Saaras streaming STT.
   */
  private handleIncomingMessage(raw: string): void {
    try {
      const parsed = JSON.parse(raw);

      // 1. Session start
      if (parsed.event === "session.begin") {
        return;
      }

      // 2. Speech detected by Sarvam server VAD
      if (parsed.event === "speech.start") {
        if (!this.isSpeaking && this.speechStartCallback) {
          this.speechStartCallback();
        }
        this.isSpeaking = true;
        this.lastFinalTranscriptText = "";
        this.lastFinalTranscriptTimestamp = 0;
        return;
      }

      // 3. Transcript event
      let transcriptText = "";
      let isFinal = false;

      if (parsed.event === "transcript") {
        transcriptText = parsed.transcript || parsed.text || "";
        isFinal = Boolean(parsed.is_final);
      } else if (parsed.transcript) {
        transcriptText = parsed.transcript;
        isFinal = Boolean(parsed.is_final);
      }

      if (transcriptText) {
        this.currentTurnText = transcriptText;

        // SAFEGUARD 6 & 7: Deduplication of final transcripts
        if (isFinal) {
          const trimmed = transcriptText.trim();
          const now = Date.now();
          if (
            trimmed &&
            trimmed === this.lastFinalTranscriptText &&
            now - this.lastFinalTranscriptTimestamp < 600
          ) {
            // Drop duplicate final emission
            this.currentTurnText = "";
            return;
          }
          this.lastFinalTranscriptText = trimmed;
          this.lastFinalTranscriptTimestamp = now;
          this.currentTurnText = ""; // Clear turn text to prevent double emission in finalizeUtterance
          this.accumulatedPcmChunks = [];
        }

        if (this.transcriptCallback) {
          this.transcriptCallback({
            text: transcriptText,
            isFinal,
            language: this.languageCode,
            confidence: parsed.confidence || 0.95,
            timestampMs: Date.now(),
          });
        }
      }

      // 4. Speech end detected by Sarvam
      if (parsed.event === "speech.end") {
        const vadMs = this.lastSpeechTimestamp || Date.now();
        if (this.speechEndCallback) {
          this.speechEndCallback(vadMs);
        }
        this.finalizeUtterance(this.lastCallerAudioReceivedTimestamp, vadMs);
      }
    } catch {
      // Ignore unparseable frames
    }
  }

  /**
   * Finalizes the current utterance turn when silence or speech.end is detected.
   */
  private async finalizeUtterance(
    lastCallerAudioMs?: number,
    speechEndVadMs?: number
  ): Promise<void> {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    this.isSpeaking = false;

    // If we have received a transcript from the streaming socket
    if (this.currentTurnText.trim()) {
      const finalText = this.currentTurnText.trim();
      this.currentTurnText = "";
      this.accumulatedPcmChunks = [];

      const now = Date.now();
      if (
        finalText === this.lastFinalTranscriptText &&
        now - this.lastFinalTranscriptTimestamp < 1500
      ) {
        // Drop duplicate utterance already emitted
        return;
      }
      this.lastFinalTranscriptText = finalText;
      this.lastFinalTranscriptTimestamp = now;

      if (this.transcriptCallback) {
        this.transcriptCallback({
          text: finalText,
          isFinal: true,
          language: this.languageCode,
          confidence: 0.98,
          timestampMs: Date.now(),
          lastCallerAudioMs: lastCallerAudioMs || this.lastCallerAudioReceivedTimestamp,
          speechEndVadMs: speechEndVadMs || this.lastSpeechTimestamp || Date.now(),
        });
      }
      return;
    }

    // If streaming socket produced no text, check if we have buffered audio for REST fallback
    if (this.accumulatedPcmChunks.length > 3 && this.config.isConfigured) {
      const combinedPcm = Buffer.concat(this.accumulatedPcmChunks);
      this.accumulatedPcmChunks = [];
      const restText = await this.fallbackRestTranscription(combinedPcm);

      if (restText && this.transcriptCallback) {
        this.transcriptCallback({
          text: restText,
          isFinal: true,
          language: this.languageCode,
          confidence: 0.92,
          timestampMs: Date.now(),
          lastCallerAudioMs: lastCallerAudioMs || this.lastCallerAudioReceivedTimestamp,
          speechEndVadMs: speechEndVadMs || this.lastSpeechTimestamp || Date.now(),
        });
      }
    } else {
      this.accumulatedPcmChunks = [];
    }
  }

  /**
   * Fallback transcription using Sarvam's REST speech-to-text API.
   */
  private async fallbackRestTranscription(pcmBuffer: Buffer): Promise<string> {
    try {
      const wavHeader = this.createWavHeader(pcmBuffer.length, this.sampleRate);
      const fullWav = Buffer.concat([wavHeader, pcmBuffer]);

      const formData = new FormData();
      const blob = new Blob([fullWav], { type: "audio/wav" });
      formData.append("file", blob, "audio.wav");
      formData.append("model", this.model);
      formData.append("language_code", this.languageCode);

      const res = await fetch(`${this.config.baseUrl}/speech-to-text`, {
        method: "POST",
        headers: {
          "api-subscription-key": this.config.apiKey,
        },
        body: formData,
      });

      if (res.ok) {
        const data = (await res.json()) as { transcript?: string };
        return data.transcript || "";
      }
    } catch {
      // Ignored
    }
    return "";
  }

  /**
   * Calculates Root Mean Square (RMS) audio energy of 16-bit linear PCM.
   */
  public calculateRms(buffer: Buffer): number {
    const sampleCount = Math.floor(buffer.length / 2);
    if (sampleCount === 0) return 0;

    let sumSquares = 0;
    for (let i = 0; i < sampleCount; i++) {
      const sample = buffer.readInt16LE(i * 2);
      sumSquares += sample * sample;
    }

    return Math.sqrt(sumSquares / sampleCount);
  }

  /**
   * Constructs a 44-byte standard RIFF WAV header for PCM audio.
   */
  private createWavHeader(pcmLength: number, sampleRate: number): Buffer {
    const header = Buffer.alloc(44);
    header.write("RIFF", 0);
    header.writeUInt32LE(36 + pcmLength, 4);
    header.write("WAVE", 8);
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16); // Subchunk1Size
    header.writeUInt16LE(1, 20); // PCM format
    header.writeUInt16LE(1, 22); // Mono
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * 2, 28); // Byte rate
    header.writeUInt16LE(2, 32); // Block align
    header.writeUInt16LE(16, 34); // Bits per sample
    header.write("data", 36);
    header.writeUInt32LE(pcmLength, 40);
    return header;
  }
}
