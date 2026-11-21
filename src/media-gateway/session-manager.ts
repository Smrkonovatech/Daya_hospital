/**
 * ============================================================================
 * SMRKOMED MEDIA SESSION MANAGER — CONCURRENT CALL STATE & AUDIO ORCHESTRATION
 * ============================================================================
 *
 * Manages active Exotel AgentStream sessions, buffers, DTMF, playback markers,
 * audio queues, Sarvam STT speech streaming, Hospital Conversation Engine,
 * and Sarvam TTS audio synthesis across concurrent hospital telephone calls.
 */

import { EventEmitter } from "events";
import {
  ExotelMediaChunk,
  ExotelMediaFormat,
  ExotelOutboundClearMessage,
  ExotelOutboundMarkMessage,
  ExotelOutboundMediaMessage,
  SessionState,
} from "./types";
import { AudioEngine, AudioPlaybackQueue, defaultAudioEngine } from "./audio-engine";
import { tenantResolver, TenantResolutionResult } from "./tenant-resolver";
import { getHospitalConfig, HospitalConfig } from "@/lib/config/hospital-config";
import { SpeechToTextProvider, TextToSpeechProvider, TranscriptTurnResult } from "./speech-interfaces";
import { SarvamSpeechToTextProvider } from "./sarvam-stt";
import { SarvamTextToSpeechProvider } from "./sarvam-tts";
import { HospitalConversationEngine } from "./conversation-engine";

export interface SocketSender {
  send(data: string, cb?: (err?: Error) => void): void;
  readyState: number;
}

export interface CallSessionInitOptions {
  streamSid: string;
  callSid: string;
  accountSid: string;
  from: string;
  to: string;
  customField?: string;
  mediaFormat?: ExotelMediaFormat;
  socket: SocketSender;
  audioEngine?: AudioEngine;
  sttProvider?: SpeechToTextProvider;
  ttsProvider?: TextToSpeechProvider;
  conversationEngine?: HospitalConversationEngine;
  hospitalConfig?: HospitalConfig;
  autoPlayGreeting?: boolean;
}

export class CallMediaSession extends EventEmitter {
  public readonly streamSid: string;
  public readonly callSid: string;
  public readonly accountSid: string;
  public readonly fromNumber: string;
  public readonly toNumber: string;
  public readonly customField?: string;
  public readonly mediaFormat: ExotelMediaFormat;
  public readonly tenantResult: TenantResolutionResult;
  public readonly hospitalId: string;
  public readonly hospitalConfig: HospitalConfig;

  public state: SessionState = "INITIALIZING";
  public readonly createdAt: Date = new Date();
  public startedAt?: Date;
  public stoppedAt?: Date;

  public audioChunksReceived = 0;
  public totalIncomingBytes = 0;
  public totalOutgoingBytes = 0;
  public dtmfDigits: string[] = [];
  public acknowledgedMarks: string[] = [];

  // Phase 2: Live AI Speech & Conversation State
  public sttStatus: "IDLE" | "CONNECTED" | "STREAMING" | "ERROR" = "IDLE";
  public ttsStatus: "IDLE" | "SYNTHESIZING" | "PLAYING" | "INTERRUPTED" = "IDLE";
  public lastCallerTranscript?: string;
  public lastAiResponse?: string;
  public conversationTurns: Array<{ speaker: "caller" | "ai"; text: string; timestampMs: number }> = [];

  public readonly sttProvider: SpeechToTextProvider;
  public readonly ttsProvider: TextToSpeechProvider;
  public readonly conversationEngine: HospitalConversationEngine;

  private socket: SocketSender;
  private audioEngine: AudioEngine;
  private playbackQueue: AudioPlaybackQueue;
  private autoPlayGreeting: boolean;

  constructor(options: CallSessionInitOptions) {
    super();
    this.streamSid = options.streamSid;
    this.callSid = options.callSid;
    this.accountSid = options.accountSid;
    this.fromNumber = options.from;
    this.toNumber = options.to;
    this.customField = options.customField;
    this.socket = options.socket;
    this.audioEngine = options.audioEngine || defaultAudioEngine;
    this.playbackQueue = new AudioPlaybackQueue(options.streamSid);
    this.autoPlayGreeting = options.autoPlayGreeting ?? false;

    this.mediaFormat = options.mediaFormat || {
      encoding: "audio/x-l16",
      sampleRate: 8000,
      channels: 1,
    };

    // Server-side trusted tenant resolution
    this.tenantResult = tenantResolver.resolveTenant({
      streamSid: options.streamSid,
      callSid: options.callSid,
      accountSid: options.accountSid,
      to: options.to,
      from: options.from,
      customField: options.customField,
    });
    this.hospitalId = this.tenantResult.hospitalId;
    this.hospitalConfig = options.hospitalConfig || getHospitalConfig(this.hospitalId);

    // AI Components Initialization
    this.conversationEngine =
      options.conversationEngine || new HospitalConversationEngine(this.hospitalConfig);
    this.sttProvider =
      options.sttProvider ||
      new SarvamSpeechToTextProvider({ sampleRate: 8000, languageCode: "ml-IN" });
    this.ttsProvider = options.ttsProvider || new SarvamTextToSpeechProvider();

    this.setupSpeechListeners();
    this.state = "CONNECTED";
  }

  private setupSpeechListeners(): void {
    this.sttProvider.onTranscript(async (turn: TranscriptTurnResult) => {
      this.lastCallerTranscript = turn.text;
      this.emit("transcript", turn);

      if (turn.isFinal && turn.text.trim()) {
        this.conversationTurns.push({
          speaker: "caller",
          text: turn.text.trim(),
          timestampMs: turn.timestampMs,
        });

        await this.handleUserTurn(turn.text.trim());
      }
    });

    if ("onSpeechStart" in this.sttProvider) {
      (this.sttProvider as unknown as { onSpeechStart: (cb: () => void) => void }).onSpeechStart(
        () => {
          if (this.ttsStatus === "PLAYING" || this.playbackQueue.hasPending()) {
            this.interruptPlayback();
          }
        }
      );
    }
  }

  public markStarted(): void {
    this.startedAt = new Date();
    this.state = "STREAMING";
    this.sttStatus = "CONNECTED";

    this.sttProvider.connect().catch((err) => {
      console.warn(`[CallSession ${this.callSid}] STT connect error:`, err);
      this.sttStatus = "ERROR";
    });

    this.emit("started", { streamSid: this.streamSid, callSid: this.callSid });

    if (this.autoPlayGreeting) {
      this.playInitialGreeting().catch(() => {});
    }
  }

  public get isStopped(): boolean {
    return (this.state as string) === "STOPPED";
  }

  public get isInterrupted(): boolean {
    return (this.ttsStatus as string) === "INTERRUPTED";
  }

  /**
   * Plays the initial Daya Hospital Malayalam welcome greeting to the caller.
   */
  public async playInitialGreeting(): Promise<void> {
    if (this.isStopped) return;

    const greeting = this.conversationEngine.getInitialGreeting();
    this.lastAiResponse = greeting;
    this.ttsStatus = "SYNTHESIZING";

    this.conversationTurns.push({
      speaker: "ai",
      text: greeting,
      timestampMs: Date.now(),
    });

    try {
      const pcm = await this.ttsProvider.synthesize(greeting, {
        language: "ml-IN",
        voiceId: "kavitha",
      });

      if (pcm && pcm.length > 0 && !this.isStopped) {
        await this.streamPcmAudio(pcm);
      } else {
        this.ttsStatus = "IDLE";
      }
    } catch (err) {
      console.warn(`[CallSession ${this.callSid}] Greeting synthesis error:`, err);
      this.ttsStatus = "IDLE";
    }
  }

  /**
   * Processes caller's transcribed utterance, queries Conversation Engine, and speaks response.
   */
  public async handleUserTurn(text: string): Promise<void> {
    if (this.isStopped) return;

    this.ttsStatus = "SYNTHESIZING";
    const result = await this.conversationEngine.processCallerUtterance(text);
    this.lastAiResponse = result.replyText;

    this.conversationTurns.push({
      speaker: "ai",
      text: result.replyText,
      timestampMs: Date.now(),
    });

    this.emit("aiResponse", {
      streamSid: this.streamSid,
      text: result.replyText,
      intent: result.intent,
      shouldTransfer: result.shouldTransfer,
      transferDestination: result.transferDestination,
    });

    try {
      const pcmAudio = await this.ttsProvider.synthesize(result.replyText, {
        language: "ml-IN",
        voiceId: "kavitha",
      });

      if (pcmAudio && pcmAudio.length > 0 && !this.isStopped) {
        await this.streamPcmAudio(pcmAudio);
      } else {
        this.ttsStatus = "IDLE";
      }
    } catch (err) {
      console.warn(`[CallSession ${this.callSid}] Response synthesis error:`, err);
      this.ttsStatus = "IDLE";
    }
  }

  /**
   * Streams a PCM audio buffer to Exotel in compliant chunks (3200 bytes, multiples of 320).
   */
  public async streamPcmAudio(pcmBuffer: Buffer): Promise<void> {
    this.ttsStatus = "PLAYING";
    this.playbackQueue.resetInterruption();

    const chunks = this.audioEngine.splitIntoExotelChunks(pcmBuffer, 3200);

    for (const chunk of chunks) {
      if (this.isStopped || this.isInterrupted) {
        break;
      }
      this.sendOutboundAudio(chunk);
      // Progressive pacing for 200ms audio chunks
      await new Promise((r) => setTimeout(r, 180));
    }

    if (this.ttsStatus === "PLAYING") {
      this.ttsStatus = "IDLE";
    }
  }

  /**
   * Processes incoming audio chunk from Exotel.
   * Decodes Base64 into PCM, checks VAD for barge-in, and streams to Sarvam STT.
   */
  public handleIncomingMedia(chunk: ExotelMediaChunk): Buffer {
    const pcm = this.audioEngine.decodeBase64Audio(chunk.payload);
    this.audioChunksReceived++;
    this.totalIncomingBytes += pcm.length;

    // Immediate caller barge-in detection: if caller speaks while bot is playing audio
    if (this.ttsStatus === "PLAYING" || this.playbackQueue.hasPending()) {
      const rms = this.calculateRms(pcm);
      if (rms > 400) {
        this.interruptPlayback();
      }
    }

    // Stream PCM to Sarvam STT
    if (this.sttProvider) {
      this.sttStatus = "STREAMING";
      this.sttProvider.sendAudio(pcm).catch(() => {});
    }

    this.emit("media", {
      streamSid: this.streamSid,
      pcm,
      timestamp: chunk.timestamp,
      sequence: this.audioChunksReceived,
    });

    return pcm;
  }

  /**
   * Sends synthesized PCM audio back to Exotel to be heard by the caller.
   */
  public sendOutboundAudio(pcmChunk: Buffer): boolean {
    if (this.state === "STOPPED" || this.socket.readyState !== 1) {
      return false;
    }

    // Align chunk to 320-byte boundary
    const alignedPcm = this.audioEngine.alignPcmToFrame(pcmChunk, 320);
    const base64Payload = this.audioEngine.encodeBase64Audio(alignedPcm);

    const msg: ExotelOutboundMediaMessage = {
      event: "media",
      streamSid: this.streamSid,
      media: {
        payload: base64Payload,
      },
    };

    try {
      this.socket.send(JSON.stringify(msg));
      this.totalOutgoingBytes += alignedPcm.length;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Sends a marker event to Exotel to track when a phrase finishes playing.
   */
  public sendMark(name: string): void {
    if (this.socket.readyState !== 1) return;

    const msg: ExotelOutboundMarkMessage = {
      event: "mark",
      streamSid: this.streamSid,
      mark: { name },
    };

    try {
      this.socket.send(JSON.stringify(msg));
    } catch {
      // Ignored if socket is closing
    }
  }

  /**
   * Immediately interrupts/flushes Exotel's playback buffer (caller barge-in).
   */
  public interruptPlayback(): void {
    this.playbackQueue.clear();
    this.ttsStatus = "INTERRUPTED";
    this.state = "INTERRUPTED";

    if (this.socket.readyState === 1) {
      const clearMsg: ExotelOutboundClearMessage = {
        event: "clear",
        streamSid: this.streamSid,
      };
      try {
        this.socket.send(JSON.stringify(clearMsg));
      } catch {
        // Ignored
      }
    }

    this.emit("interrupted", { streamSid: this.streamSid });
    this.state = "STREAMING";
  }

  public handleDtmf(digit: string): void {
    this.dtmfDigits.push(digit);
    this.emit("dtmf", { streamSid: this.streamSid, digit });
  }

  public handleMark(name: string): void {
    this.acknowledgedMarks.push(name);
    this.emit("mark", { streamSid: this.streamSid, name });
  }

  public close(): void {
    this.state = "STOPPED";
    this.stoppedAt = new Date();
    this.ttsStatus = "IDLE";
    this.sttStatus = "IDLE";
    this.playbackQueue.clear();

    if (this.sttProvider) {
      this.sttProvider.close().catch(() => {});
    }

    this.emit("stopped", {
      streamSid: this.streamSid,
      callSid: this.callSid,
      durationMs: this.startedAt ? Date.now() - this.startedAt.getTime() : 0,
      totalIncomingBytes: this.totalIncomingBytes,
      totalOutgoingBytes: this.totalOutgoingBytes,
    });
  }

  private calculateRms(buffer: Buffer): number {
    const sampleCount = Math.floor(buffer.length / 2);
    if (sampleCount === 0) return 0;
    let sumSquares = 0;
    for (let i = 0; i < sampleCount; i++) {
      const s = buffer.readInt16LE(i * 2);
      sumSquares += s * s;
    }
    return Math.sqrt(sumSquares / sampleCount);
  }

  public getSummary() {
    return {
      streamSid: this.streamSid,
      callSid: this.callSid,
      hospitalId: this.hospitalId,
      fromNumber: this.fromNumber,
      toNumber: this.toNumber,
      state: this.state,
      durationSeconds: this.startedAt
        ? Math.round((Date.now() - this.startedAt.getTime()) / 1000)
        : 0,
      incomingBytes: this.totalIncomingBytes,
      outgoingBytes: this.totalOutgoingBytes,
      chunksReceived: this.audioChunksReceived,
      dtmfCount: this.dtmfDigits.length,
      detectedLanguage: "ml-IN",
      sttStatus: this.sttStatus,
      ttsStatus: this.ttsStatus,
      lastCallerTranscript: this.lastCallerTranscript || null,
      lastAiResponse: this.lastAiResponse || null,
      turnCount: this.conversationTurns.length,
    };
  }
}

export class MediaSessionManager extends EventEmitter {
  private sessionsByStream: Map<string, CallMediaSession> = new Map();
  private sessionsByCall: Map<string, CallMediaSession> = new Map();

  public registerSession(session: CallMediaSession): void {
    this.sessionsByStream.set(session.streamSid, session);
    this.sessionsByCall.set(session.callSid, session);

    session.on("stopped", () => {
      this.sessionsByStream.delete(session.streamSid);
      this.sessionsByCall.delete(session.callSid);
      this.emit("sessionClosed", session);
    });

    this.emit("sessionCreated", session);
  }

  public getSessionByStream(streamSid: string): CallMediaSession | undefined {
    return this.sessionsByStream.get(streamSid);
  }

  public getSessionByCallSid(callSid: string): CallMediaSession | undefined {
    return this.sessionsByCall.get(callSid);
  }

  public getActiveSessionCount(): number {
    return this.sessionsByStream.size;
  }

  public getAllActiveSessions(): CallMediaSession[] {
    return Array.from(this.sessionsByStream.values());
  }

  public closeAll(): void {
    for (const session of this.sessionsByStream.values()) {
      session.close();
    }
    this.sessionsByStream.clear();
    this.sessionsByCall.clear();
  }
}

export const mediaSessionManager = new MediaSessionManager();
