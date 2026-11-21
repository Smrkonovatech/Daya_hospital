/**
 * ============================================================================
 * SMRKOMED AUDIO ENGINE — PROVIDER-INDEPENDENT REAL-TIME AUDIO PROCESSING
 * ============================================================================
 *
 * Format: Raw Linear PCM, Signed 16-bit Little-Endian, Mono, 8000 Hz
 * Transport: Base64 encoded payload over WebSocket
 *
 * Exotel Audio Rules:
 * - Chunk size must be a multiple of 320 bytes (20ms frame at 8kHz 16-bit mono)
 * - Minimum chunk size: 3,200 bytes (3.2k / 200ms)
 * - Maximum chunk size: 100,000 bytes (100k)
 */

export interface ChunkValidationOptions {
  minChunkBytes?: number; // default: 3200
  maxChunkBytes?: number; // default: 100000
  chunkMultipleBytes?: number; // default: 320
  enforceMinimum?: boolean; // default: true
  sampleRate?: number; // default: 8000
}

export interface ChunkValidationResult {
  valid: boolean;
  byteLength: number;
  sampleCount: number;
  durationMs: number;
  error?: string;
}

export class AudioEngine {
  private minChunkBytes: number;
  private maxChunkBytes: number;
  private chunkMultipleBytes: number;
  private enforceMinimum: boolean;
  private sampleRate: number;
  private bytesPerSample: number;

  constructor(options?: ChunkValidationOptions) {
    this.minChunkBytes = options?.minChunkBytes ?? 3200;
    this.maxChunkBytes = options?.maxChunkBytes ?? 100000;
    this.chunkMultipleBytes = options?.chunkMultipleBytes ?? 320;
    this.enforceMinimum = options?.enforceMinimum ?? true;
    this.sampleRate = options?.sampleRate ?? 8000;
    this.bytesPerSample = 2; // 16-bit audio = 2 bytes per sample
  }

  /**
   * Decodes Base64-encoded PCM audio from Exotel media payload into a raw Buffer.
   */
  public decodeBase64Audio(base64Payload: string): Buffer {
    if (!base64Payload || typeof base64Payload !== "string") {
      return Buffer.alloc(0);
    }
    return Buffer.from(base64Payload, "base64");
  }

  /**
   * Encodes a raw PCM Buffer into a Base64 string for Exotel WebSocket transmission.
   */
  public encodeBase64Audio(pcmBuffer: Buffer): string {
    if (!pcmBuffer || !Buffer.isBuffer(pcmBuffer) || pcmBuffer.length === 0) {
      return "";
    }
    return pcmBuffer.toString("base64");
  }

  /**
   * Validates PCM buffer against 16-bit alignment and Exotel chunk constraints.
   */
  public validatePcmChunk(
    buffer: Buffer,
    overrides?: Partial<ChunkValidationOptions>
  ): ChunkValidationResult {
    if (!buffer || !Buffer.isBuffer(buffer)) {
      return {
        valid: false,
        byteLength: 0,
        sampleCount: 0,
        durationMs: 0,
        error: "Invalid input: buffer is null or not a Node.js Buffer.",
      };
    }

    const len = buffer.length;
    const minBytes = overrides?.minChunkBytes ?? this.minChunkBytes;
    const maxBytes = overrides?.maxChunkBytes ?? this.maxChunkBytes;
    const multiple = overrides?.chunkMultipleBytes ?? this.chunkMultipleBytes;
    const enforceMin = overrides?.enforceMinimum ?? this.enforceMinimum;
    const sampleRate = overrides?.sampleRate ?? this.sampleRate;

    // 1. Basic 16-bit sample alignment check (must be an even number of bytes)
    if (len % this.bytesPerSample !== 0) {
      return {
        valid: false,
        byteLength: len,
        sampleCount: Math.floor(len / this.bytesPerSample),
        durationMs: (Math.floor(len / this.bytesPerSample) / sampleRate) * 1000,
        error: `PCM alignment error: buffer length (${len} bytes) is not divisible by 2 for 16-bit audio.`,
      };
    }

    // 2. Minimum chunk size check
    if (enforceMin && len < minBytes) {
      return {
        valid: false,
        byteLength: len,
        sampleCount: len / this.bytesPerSample,
        durationMs: (len / this.bytesPerSample / sampleRate) * 1000,
        error: `Chunk too small: buffer length (${len} bytes) is less than required minimum (${minBytes} bytes / 3.2k).`,
      };
    }

    // 3. Maximum chunk size check
    if (len > maxBytes) {
      return {
        valid: false,
        byteLength: len,
        sampleCount: len / this.bytesPerSample,
        durationMs: (len / this.bytesPerSample / sampleRate) * 1000,
        error: `Chunk too large: buffer length (${len} bytes) exceeds maximum ceiling (${maxBytes} bytes / 100k).`,
      };
    }

    // 4. Multiple of 320 bytes check
    if (multiple > 0 && len % multiple !== 0) {
      return {
        valid: false,
        byteLength: len,
        sampleCount: len / this.bytesPerSample,
        durationMs: (len / this.bytesPerSample / sampleRate) * 1000,
        error: `Frame multiple error: buffer length (${len} bytes) is not a multiple of ${multiple} bytes (20ms frames).`,
      };
    }

    const sampleCount = len / this.bytesPerSample;
    const durationMs = (sampleCount / sampleRate) * 1000;

    return {
      valid: true,
      byteLength: len,
      sampleCount,
      durationMs,
    };
  }

  /**
   * Aligns any unaligned audio buffer to the nearest 320-byte boundary (truncating excess or padding silence).
   */
  public alignPcmToFrame(buffer: Buffer, multiple = 320): Buffer {
    if (!buffer || buffer.length === 0) return Buffer.alloc(0);
    const remainder = buffer.length % multiple;
    if (remainder === 0) return buffer;

    // Pad with silence (zeros) to complete the frame
    const padBytes = multiple - remainder;
    return Buffer.concat([buffer, Buffer.alloc(padBytes, 0)]);
  }

  /**
   * Splits a large PCM buffer into chunks satisfying Exotel's constraints
   * (e.g. 3,200 bytes per chunk, each a multiple of 320 bytes).
   */
  public splitIntoExotelChunks(
    pcmBuffer: Buffer,
    chunkSizeBytes = 3200
  ): Buffer[] {
    const safeChunkSize = Math.max(320, Math.floor(chunkSizeBytes / 320) * 320);
    const chunks: Buffer[] = [];

    let offset = 0;
    while (offset < pcmBuffer.length) {
      const end = Math.min(offset + safeChunkSize, pcmBuffer.length);
      let slice = pcmBuffer.subarray(offset, end);
      // Ensure slice is multiple of 320
      if (slice.length % 320 !== 0) {
        slice = this.alignPcmToFrame(slice, 320);
      }
      chunks.push(slice);
      offset = end;
    }

    return chunks;
  }

  /**
   * Generates a silence PCM buffer of specified duration.
   */
  public generateSilentPcm(durationMs: number, sampleRate = 8000): Buffer {
    const sampleCount = Math.floor((durationMs / 1000) * sampleRate);
    return Buffer.alloc(sampleCount * this.bytesPerSample, 0);
  }

  /**
   * Generates a pure sine tone PCM buffer (useful for dial tone, ringback, or test audio).
   */
  public generateSineTonePcm(
    frequencyHz: number,
    durationMs: number,
    sampleRate = 8000,
    amplitude = 16000
  ): Buffer {
    const sampleCount = Math.floor((durationMs / 1000) * sampleRate);
    const buffer = Buffer.alloc(sampleCount * 2);

    for (let i = 0; i < sampleCount; i++) {
      const t = i / sampleRate;
      const sample = Math.round(amplitude * Math.sin(2 * Math.PI * frequencyHz * t));
      buffer.writeInt16LE(sample, i * 2);
    }

    return this.alignPcmToFrame(buffer, 320);
  }

  /**
   * Calculates the exact audio duration in milliseconds from PCM byte length.
   */
  public calculateDurationMs(byteLength: number, sampleRate = 8000): number {
    return (byteLength / (this.bytesPerSample * sampleRate)) * 1000;
  }
}

/**
 * Manages an outbound audio playback queue for an active call session.
 * Supports enqueuing audio chunks, tracking markers, and instant interruption (clear).
 */
export class AudioPlaybackQueue {
  private queue: Buffer[] = [];
  private isPlaying = false;
  private isInterrupted = false;
  private totalBytesSent = 0;

  constructor(private streamSid: string) {}

  public enqueue(chunk: Buffer): void {
    if (this.isInterrupted) return;
    this.queue.push(chunk);
  }

  public clear(): void {
    this.queue = [];
    this.isPlaying = false;
    this.isInterrupted = true;
  }

  public resetInterruption(): void {
    this.isInterrupted = false;
  }

  public hasPending(): boolean {
    return this.queue.length > 0;
  }

  public dequeue(): Buffer | null {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      return null;
    }
    const chunk = this.queue.shift() || null;
    if (chunk) {
      this.totalBytesSent += chunk.length;
      this.isPlaying = true;
    }
    return chunk;
  }

  public getPendingCount(): number {
    return this.queue.length;
  }

  public getTotalBytesSent(): number {
    return this.totalBytesSent;
  }
}

export const defaultAudioEngine = new AudioEngine();

