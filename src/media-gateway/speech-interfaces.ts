/**
 * ============================================================================
 * SPEECH & VOICE AI PROVIDER INTERFACES (PHASE 13 PREPARATION)
 * ============================================================================
 *
 * Provider-independent abstraction layer for real-time speech-to-text (STT)
 * and text-to-speech (TTS) streaming. Decouples the audio gateway from
 * specific AI vendors (Sarvam AI, OpenAI, Google Cloud Speech, ElevenLabs).
 */

export interface TranscriptTurnResult {
  text: string;
  isFinal: boolean;
  language: string;
  confidence: number;
  timestampMs: number;
  lastCallerAudioMs?: number;
  speechEndVadMs?: number;
}

/**
 * Standard interface for real-time streaming Speech-to-Text (e.g. Sarvam AI Malayalam Saarathi).
 */
export interface SpeechToTextProvider {
  /**
   * Initializes the upstream streaming session (e.g. WebSocket connection to AI speech cluster).
   */
  connect(): Promise<void>;

  /**
   * Streams a raw PCM audio chunk to the speech recognizer.
   */
  sendAudio(audioChunk: Buffer): Promise<void>;

  /**
   * Registers a callback for real-time interim or final transcribed speech.
   */
  onTranscript(callback: (turn: TranscriptTurnResult) => void): void;

  /**
   * Gracefully terminates the speech recognition stream.
   */
  close(): Promise<void>;
}

/**
 * Standard interface for Text-to-Speech voice synthesis (e.g. Sarvam AI Malayalam Bulbul).
 */
export interface TextToSpeechProvider {
  /**
   * Synthesizes text into a raw PCM 8kHz 16-bit mono audio buffer ready for Exotel streaming.
   */
  synthesize(
    text: string,
    options?: {
      language?: string;
      voiceId?: string;
      pitch?: number;
      pace?: number;
      signal?: AbortSignal;
    }
  ): Promise<Buffer>;
}

/**
 * Mock speech-to-text provider used for standalone gateway testing and simulation.
 */
export class MockSpeechToTextProvider implements SpeechToTextProvider {
  private transcriptCallback?: (turn: TranscriptTurnResult) => void;
  private isConnected = false;

  async connect(): Promise<void> {
    this.isConnected = true;
  }

  async sendAudio(audioChunk: Buffer): Promise<void> {
    void audioChunk;
    // Simulation: emit mock transcript after receiving audio
    if (this.transcriptCallback && this.isConnected) {
      this.transcriptCallback({
        text: "ഡോക്ടറെ കാണാൻ സമയം ഉണ്ടോ?",
        isFinal: true,
        language: "malayalam",
        confidence: 0.98,
        timestampMs: Date.now(),
      });
    }
  }

  onTranscript(callback: (turn: TranscriptTurnResult) => void): void {
    this.transcriptCallback = callback;
  }

  async close(): Promise<void> {
    this.isConnected = false;
  }
}

/**
 * Mock text-to-speech provider synthesizing silence or tones for gateway validation.
 */
export class MockTextToSpeechProvider implements TextToSpeechProvider {
  async synthesize(text: string): Promise<Buffer> {
    void text;
    // Returns 400ms of aligned test PCM audio (3200 bytes = 1600 samples = 200ms at 8kHz 16-bit)
    return Buffer.alloc(3200, 0);
  }
}

