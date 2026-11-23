/**
 * ============================================================================
 * EXOTEL AGENTSTREAM PROTOCOL TYPES & WEBSOCKET MESSAGE SPECIFICATIONS
 * ============================================================================
 *
 * Official Exotel AgentStream / Voicebot bidirectional WebSocket streaming
 * protocol specification for real-time PCM audio and call events.
 */

export interface ExotelMediaFormat {
  encoding: "audio/x-l16" | "audio/l16" | "audio/pcm";
  sampleRate: number; // 8000 Hz
  channels: number; // 1 (mono)
}

/**
 * Sent by Exotel immediately upon WebSocket connection establishment.
 */
export interface ExotelConnectedEvent {
  event: "connected";
  protocol: "Call" | string;
  version: string;
}

/**
 * Sent by Exotel when the call audio stream starts.
 */
export interface ExotelStartMetadata {
  streamSid: string;
  callSid: string;
  accountSid: string;
  from: string;
  to: string;
  customField?: string;
  mediaFormat: ExotelMediaFormat;
  tracks?: string[];
}

export interface ExotelStartEvent {
  event: "start";
  sequenceNumber: string;
  start: ExotelStartMetadata;
  streamSid: string;
}

/**
 * Sent by Exotel continuously with chunked Base64-encoded PCM audio from the caller.
 */
export interface ExotelMediaChunk {
  chunk: string;
  timestamp: string;
  payload: string; // Base64 encoded Raw PCM
  track?: "inbound" | "outbound";
}

export interface ExotelMediaEvent {
  event: "media";
  sequenceNumber: string;
  media: ExotelMediaChunk;
  streamSid: string;
}

/**
 * Sent by Exotel when the caller presses a DTMF digit.
 */
export interface ExotelDtmfPayload {
  digit: string;
}

export interface ExotelDtmfEvent {
  event: "dtmf";
  sequenceNumber: string;
  dtmf: ExotelDtmfPayload;
  streamSid: string;
}

/**
 * Sent by Exotel when a mark event sent by the media gateway completes playback.
 */
export interface ExotelMarkPayload {
  name: string;
}

export interface ExotelMarkEvent {
  event: "mark";
  sequenceNumber: string;
  mark: ExotelMarkPayload;
  streamSid: string;
}

/**
 * Sent by Exotel when the call terminates or the stream stops.
 */
export interface ExotelStopPayload {
  callSid: string;
  accountSid: string;
}

export interface ExotelStopEvent {
  event: "stop";
  sequenceNumber: string;
  stop: ExotelStopPayload;
  streamSid: string;
}

/**
 * Union of all incoming messages from Exotel over WebSocket
 */
export type ExotelIncomingMessage =
  | ExotelConnectedEvent
  | ExotelStartEvent
  | ExotelMediaEvent
  | ExotelDtmfEvent
  | ExotelMarkEvent
  | ExotelStopEvent;

// ----------------------------------------------------
// OUTBOUND MESSAGES (Media Gateway -> Exotel)
// ----------------------------------------------------

/**
 * Outbound audio message sent to Exotel to be synthesized/played to caller.
 * Includes both stream_sid (Exotel standard) and streamSid (camelCase compatibility).
 */
export interface ExotelOutboundMediaMessage {
  event: "media";
  streamSid: string;
  stream_sid?: string;
  media: {
    payload: string; // Base64 encoded PCM audio (multiple of 320 bytes, 3.2k - 100k)
  };
}

/**
 * Outbound marker message sent to Exotel for playback synchronization.
 */
export interface ExotelOutboundMarkMessage {
  event: "mark";
  streamSid: string;
  stream_sid?: string;
  mark: {
    name: string;
  };
}

/**
 * Outbound clear message sent to Exotel to immediately interrupt/flush its playback buffer (barge-in).
 */
export interface ExotelOutboundClearMessage {
  event: "clear";
  streamSid: string;
  stream_sid?: string;
}

export type ExotelOutboundMessage =
  | ExotelOutboundMediaMessage
  | ExotelOutboundMarkMessage
  | ExotelOutboundClearMessage;

// ----------------------------------------------------
// GATEWAY SESSION & CONFIGURATION TYPES
// ----------------------------------------------------

export type SessionState =
  | "INITIALIZING"
  | "CONNECTED"
  | "STREAMING"
  | "INTERRUPTED"
  | "STOPPED"
  | "ERROR";

export interface MediaGatewayConfig {
  port: number;
  host: string;
  path: string; // default: /exotel/voicebot
  minChunkBytes: number; // default: 3200 (3.2k)
  maxChunkBytes: number; // default: 100000 (100k)
  chunkMultipleBytes: number; // default: 320 (20ms at 8kHz 16-bit mono)
  enforceMinimumChunk: boolean; // configurable minimum enforcement
  sampleRate: number; // default: 8000 Hz
  channels: number; // default: 1 (mono)
  authSecret?: string;
  enableDebugLogging?: boolean;
  echoMode?: boolean; // Diagnostic echo mode: echo caller voice back immediately
  autoPlayGreeting?: boolean; // Auto-play Malayalam welcome greeting
  silenceTimeoutMs?: number; // STT VAD silence duration (default: 400ms)
  ttsPace?: number; // TTS speaking rate (default: 1.15)
}

// ----------------------------------------------------
// TURN LATENCY TELEMETRY & PROFILING TYPES
// ----------------------------------------------------

export interface TurnLatencyTimestamps {
  lastCallerAudioMs: number;
  speechEndVadMs: number;
  finalTranscriptMs: number;
  llmStartMs: number;
  llmFirstTokenMs?: number;
  llmFirstSentenceMs?: number;
  llmResponseReadyMs: number;
  ttsStartMs: number;
  ttsFirstAudioMs: number;
  firstAudioSentToExotelMs: number;
  lastAudioSentToExotelMs?: number;
}

export interface TurnLatencyDurations {
  speechEndToTranscriptMs: number;
  transcriptToLlmFirstTokenMs: number;
  llmFirstTokenToTtsAudioMs: number;
  ttsFirstAudioMs: number;
  totalSpeechEndToAudibleResponseMs: number;
  firstSentenceLatencyMs?: number;
}

export interface TurnLatencyMetrics {
  turnId: number;
  callSid: string;
  streamSid: string;
  callerTranscript: string;
  aiResponseText: string;
  timestamps: TurnLatencyTimestamps;
  latencies: TurnLatencyDurations;
  timestamp: string;
}

export interface AggregateLatencyStats {
  totalTurns: number;
  medianTotalLatencyMs: number;
  p95TotalLatencyMs: number;
  medianSttLatencyMs: number;
  medianLlmLatencyMs: number;
  medianTtsLatencyMs: number;
}

