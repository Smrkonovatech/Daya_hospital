/**
 * ============================================================================
 * SMRKOMED MEDIA SESSION MANAGER — CONCURRENT CALL STATE & AUDIO ORCHESTRATION
 * ============================================================================
 *
 * Manages active Exotel AgentStream sessions, buffers, DTMF, playback markers,
 * and audio queues across concurrent hospital telephone calls.
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

  public state: SessionState = "INITIALIZING";
  public readonly createdAt: Date = new Date();
  public startedAt?: Date;
  public stoppedAt?: Date;

  public audioChunksReceived = 0;
  public totalIncomingBytes = 0;
  public totalOutgoingBytes = 0;
  public dtmfDigits: string[] = [];
  public acknowledgedMarks: string[] = [];

  private socket: SocketSender;
  private audioEngine: AudioEngine;
  private playbackQueue: AudioPlaybackQueue;

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
    this.state = "CONNECTED";
  }

  public markStarted(): void {
    this.startedAt = new Date();
    this.state = "STREAMING";
    this.emit("started", { streamSid: this.streamSid, callSid: this.callSid });
  }

  /**
   * Processes incoming audio chunk from Exotel.
   * Decodes Base64 into PCM and emits decoded buffer.
   */
  public handleIncomingMedia(chunk: ExotelMediaChunk): Buffer {
    const pcm = this.audioEngine.decodeBase64Audio(chunk.payload);
    this.audioChunksReceived++;
    this.totalIncomingBytes += pcm.length;

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
    this.playbackQueue.clear();
    this.emit("stopped", {
      streamSid: this.streamSid,
      callSid: this.callSid,
      durationMs: this.startedAt ? Date.now() - this.startedAt.getTime() : 0,
      totalIncomingBytes: this.totalIncomingBytes,
      totalOutgoingBytes: this.totalOutgoingBytes,
    });
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

