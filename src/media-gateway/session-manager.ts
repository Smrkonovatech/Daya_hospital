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
  AggregateLatencyStats,
  ExotelMediaChunk,
  ExotelMediaFormat,
  ExotelOutboundClearMessage,
  ExotelOutboundMarkMessage,
  ExotelOutboundMediaMessage,
  SessionState,
  TurnLatencyMetrics,
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
  echoMode?: boolean;
  silenceTimeoutMs?: number;
  ttsPace?: number;
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
  public readonly echoMode: boolean;

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
  public turnLatencyMetrics: TurnLatencyMetrics[] = [];
  private turnCounter = 0;
  private lastCallerAudioReceivedMs = 0;
  private callerSpeechStartMs?: number;

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
    this.echoMode =
      options.echoMode ??
      (process.env.MEDIA_GATEWAY_ECHO_MODE === "true" ||
        process.env.EXOTEL_ECHO_MODE === "true");

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

    // AI Components Initialization with low-latency VAD (400ms) & brisk Malayalam TTS pace (1.15)
    this.conversationEngine =
      options.conversationEngine || new HospitalConversationEngine(this.hospitalConfig);
    this.sttProvider =
      options.sttProvider ||
      new SarvamSpeechToTextProvider({
        sampleRate: 8000,
        languageCode: "ml-IN",
        silenceTimeoutMs: options.silenceTimeoutMs ?? 400,
      });
    this.ttsProvider =
      options.ttsProvider ||
      new SarvamTextToSpeechProvider(
        options.ttsPace ? { ttsPace: options.ttsPace } : undefined
      );

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

        await this.handleUserTurn(turn.text.trim(), turn);
      }
    });

    if ("onSpeechStart" in this.sttProvider) {
      (this.sttProvider as unknown as { onSpeechStart: (cb: () => void) => void }).onSpeechStart(
        () => {
          this.callerSpeechStartMs = Date.now();
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
   * Records precise turn-by-turn latency metrics across STT VAD, LLM generation, and TTS synthesis.
   */
  public async handleUserTurn(text: string, turnInfo?: TranscriptTurnResult): Promise<void> {
    if (this.isStopped) return;

    this.turnCounter++;
    const turnId = this.turnCounter;
    const finalTranscriptMs = turnInfo?.timestampMs || Date.now();
    const lastCallerAudioMs =
      turnInfo?.lastCallerAudioMs || this.lastCallerAudioReceivedMs || finalTranscriptMs - 400;
    const speechEndVadMs =
      turnInfo?.speechEndVadMs || (this.lastCallerAudioReceivedMs ? this.lastCallerAudioReceivedMs + 400 : finalTranscriptMs);

    this.ttsStatus = "SYNTHESIZING";
    const llmStartMs = Date.now();
    let llmFirstTokenMs: number | undefined;

    const result = await this.conversationEngine.processCallerUtterance(text, () => {
      if (!llmFirstTokenMs) {
        llmFirstTokenMs = Date.now();
      }
    });

    llmFirstTokenMs = result.llmTimestamps?.llmFirstTokenMs || llmFirstTokenMs || Date.now();
    const llmResponseReadyMs = result.llmTimestamps?.llmResponseReadyMs || Date.now();

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

    const ttsStartMs = Date.now();
    let ttsFirstAudioMs = 0;
    let firstAudioSentToExotelMs = 0;
    let lastAudioSentToExotelMs = 0;

    try {
      const pcmAudio = await this.ttsProvider.synthesize(result.replyText, {
        language: "ml-IN",
        voiceId: "kavitha",
      });

      ttsFirstAudioMs = Date.now();

      if (pcmAudio && pcmAudio.length > 0 && !this.isStopped) {
        await this.streamPcmAudio(pcmAudio, () => {
          if (!firstAudioSentToExotelMs) {
            firstAudioSentToExotelMs = Date.now();
          }
        });
        lastAudioSentToExotelMs = Date.now();
      } else {
        this.ttsStatus = "IDLE";
      }
    } catch (err) {
      console.warn(`[CallSession ${this.callSid}] Response synthesis error:`, err);
      this.ttsStatus = "IDLE";
    }

    const speechEndToTranscriptMs = Math.max(0, finalTranscriptMs - speechEndVadMs);
    const transcriptToLlmFirstTokenMs = Math.max(0, (llmFirstTokenMs || llmResponseReadyMs) - finalTranscriptMs);
    const llmFirstTokenToTtsAudioMs = Math.max(0, (ttsFirstAudioMs || Date.now()) - (llmFirstTokenMs || llmStartMs));
    const ttsFirstAudioDurationMs = Math.max(0, (ttsFirstAudioMs || Date.now()) - ttsStartMs);
    const totalSpeechEndToAudibleResponseMs = firstAudioSentToExotelMs > 0
      ? Math.max(0, firstAudioSentToExotelMs - speechEndVadMs)
      : Math.max(0, (ttsFirstAudioMs || Date.now()) - speechEndVadMs);

    const turnMetrics: TurnLatencyMetrics = {
      turnId,
      callSid: this.callSid,
      streamSid: this.streamSid,
      callerTranscript: text,
      aiResponseText: result.replyText,
      timestamps: {
        lastCallerAudioMs,
        speechEndVadMs,
        finalTranscriptMs,
        llmStartMs,
        llmFirstTokenMs,
        llmResponseReadyMs,
        ttsStartMs,
        ttsFirstAudioMs: ttsFirstAudioMs || ttsStartMs,
        firstAudioSentToExotelMs: firstAudioSentToExotelMs || ttsFirstAudioMs || ttsStartMs,
        lastAudioSentToExotelMs: lastAudioSentToExotelMs || firstAudioSentToExotelMs || ttsFirstAudioMs,
      },
      latencies: {
        speechEndToTranscriptMs,
        transcriptToLlmFirstTokenMs,
        llmFirstTokenToTtsAudioMs,
        ttsFirstAudioMs: ttsFirstAudioDurationMs,
        totalSpeechEndToAudibleResponseMs,
      },
      timestamp: new Date().toISOString(),
    };

    this.turnLatencyMetrics.push(turnMetrics);
    mediaSessionManager.recordTurnMetrics(turnMetrics);

    console.log(
      `[CallSession ${this.callSid}] Turn ${turnId} Latency Breakdown: Total=${totalSpeechEndToAudibleResponseMs}ms ` +
      `(VAD->STT: ${speechEndToTranscriptMs}ms, STT->LLM: ${transcriptToLlmFirstTokenMs}ms, ` +
      `LLM->TTS: ${llmFirstTokenToTtsAudioMs}ms, TTS: ${ttsFirstAudioDurationMs}ms) | ` +
      `Caller: "${text}" -> AI: "${result.replyText.substring(0, 40)}..."`
    );
  }

  /**
   * Streams a PCM audio buffer to Exotel in compliant chunks (3200 bytes, multiples of 320).
   */
  public async streamPcmAudio(pcmBuffer: Buffer, onFirstChunkSent?: () => void): Promise<void> {
    this.ttsStatus = "PLAYING";
    this.playbackQueue.resetInterruption();

    const chunks = this.audioEngine.splitIntoExotelChunks(pcmBuffer, 3200);

    for (let i = 0; i < chunks.length; i++) {
      if (this.isStopped || this.isInterrupted) {
        break;
      }
      this.sendOutboundAudio(chunks[i]);
      if (i === 0 && onFirstChunkSent) {
        onFirstChunkSent();
      }
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
    this.lastCallerAudioReceivedMs = Date.now();

    // Diagnostic Echo Mode: if enabled, immediately reflect audio back to caller
    if (this.echoMode) {
      this.sendOutboundAudio(pcm);
    }

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
   * Includes both stream_sid (Exotel standard) and streamSid for maximum compatibility.
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
      stream_sid: this.streamSid,
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
      stream_sid: this.streamSid,
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
        stream_sid: this.streamSid,
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
      echoMode: this.echoMode,
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
      recentTurnMetrics: this.turnLatencyMetrics.slice(-5),
      lastTurnLatencyMs:
        this.turnLatencyMetrics[this.turnLatencyMetrics.length - 1]?.latencies
          .totalSpeechEndToAudibleResponseMs ?? null,
    };
  }
}

export interface CompletedSessionSummary {
  streamSid: string;
  callSid: string;
  hospitalId: string;
  fromNumber: string;
  toNumber: string;
  state: string;
  echoMode: boolean;
  durationSeconds: number;
  incomingBytes: number;
  outgoingBytes: number;
  chunksReceived: number;
  turnCount: number;
  lastCallerTranscript: string | null;
  lastAiResponse: string | null;
  startedAt: string;
  stoppedAt: string;
  timestamp: string;
  averageTurnLatencyMs?: number | null;
  turnLatencyMetrics?: TurnLatencyMetrics[];
}

export class MediaSessionManager extends EventEmitter {
  private sessionsByStream: Map<string, CallMediaSession> = new Map();
  private sessionsByCall: Map<string, CallMediaSession> = new Map();
  private completedSessions: CompletedSessionSummary[] = [];
  private recentTurnMetrics: TurnLatencyMetrics[] = [];

  public recordTurnMetrics(metrics: TurnLatencyMetrics): void {
    this.recentTurnMetrics.push(metrics);
    if (this.recentTurnMetrics.length > 50) {
      this.recentTurnMetrics.shift();
    }
  }

  public getRecentTurnMetrics(limit = 20): TurnLatencyMetrics[] {
    return this.recentTurnMetrics.slice(-limit);
  }

  public getAggregateLatencyStats(): AggregateLatencyStats {
    const turns = this.recentTurnMetrics;
    if (turns.length === 0) {
      return {
        totalTurns: 0,
        medianTotalLatencyMs: 0,
        p95TotalLatencyMs: 0,
        medianSttLatencyMs: 0,
        medianLlmLatencyMs: 0,
        medianTtsLatencyMs: 0,
      };
    }

    const totals = turns
      .map((t) => t.latencies.totalSpeechEndToAudibleResponseMs)
      .sort((a, b) => a - b);
    const stts = turns
      .map((t) => t.latencies.speechEndToTranscriptMs)
      .sort((a, b) => a - b);
    const llms = turns
      .map((t) => t.latencies.transcriptToLlmFirstTokenMs)
      .sort((a, b) => a - b);
    const ttss = turns
      .map((t) => t.latencies.ttsFirstAudioMs)
      .sort((a, b) => a - b);

    const median = (arr: number[]) => arr[Math.floor(arr.length / 2)] || 0;
    const p95 = (arr: number[]) =>
      arr[Math.floor(arr.length * 0.95)] || arr[arr.length - 1] || 0;

    return {
      totalTurns: turns.length,
      medianTotalLatencyMs: median(totals),
      p95TotalLatencyMs: p95(totals),
      medianSttLatencyMs: median(stts),
      medianLlmLatencyMs: median(llms),
      medianTtsLatencyMs: median(ttss),
    };
  }

  public registerSession(session: CallMediaSession): void {
    this.sessionsByStream.set(session.streamSid, session);
    this.sessionsByCall.set(session.callSid, session);

    session.on("stopped", () => {
      this.sessionsByStream.delete(session.streamSid);
      this.sessionsByCall.delete(session.callSid);

      const summary = session.getSummary();
      const turnMetrics = session.turnLatencyMetrics;
      const averageTurnLatencyMs =
        turnMetrics.length > 0
          ? Math.round(
              turnMetrics.reduce(
                (acc, t) => acc + t.latencies.totalSpeechEndToAudibleResponseMs,
                0
              ) / turnMetrics.length
            )
          : null;

      this.completedSessions.push({
        ...summary,
        startedAt: session.startedAt?.toISOString() || new Date().toISOString(),
        stoppedAt: session.stoppedAt?.toISOString() || new Date().toISOString(),
        timestamp: new Date().toISOString(),
        averageTurnLatencyMs,
        turnLatencyMetrics: session.turnLatencyMetrics,
      });
      if (this.completedSessions.length > 30) {
        this.completedSessions.shift();
      }

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

  public getRecentCompletedSessions(): CompletedSessionSummary[] {
    return [...this.completedSessions];
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
