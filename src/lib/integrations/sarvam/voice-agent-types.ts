/**
 * ============================================================================
 * SARVAM VOICE AGENTS (SAMVAAD) TYPES & CONTRACT DEFINITIONS (PHASE 10)
 * ============================================================================
 *
 * Official TypeScript interfaces matching Sarvam Voice Agents / Samvaad platform:
 * - Microservice API endpoints (App Authoring, Analytics, Outbounds, Scheduling)
 * - Agent configurations (Prompt, Languages, Voice, Tools, Hooks)
 * - Tool definitions & parameter schemas
 * - On-Start & On-End Lifecycle hooks
 * - Post-call transcripts, interactions, and analytics
 * - Exotel BYOT connection metadata & transfer constraints
 */

export type ConversationEngineMode = "SARVAM_CORE_CUSTOM" | "SARVAM_VOICE_AGENTS";

export interface SarvamVoiceAgentConfig {
  apiKey: string;
  workspaceId: string;
  orgId: string;
  agentId?: string;
  engineMode: ConversationEngineMode;
  appAuthoringBaseUrl: string;
  analyticsBaseUrl: string;
  schedulingBaseUrl: string;
  outboundsBaseUrl: string;
  webhookSecret?: string;
}

export type SarvamAgentLanguage =
  | "ml-IN" // Malayalam
  | "en-IN" // English (Indian)
  | "hi-IN" // Hindi
  | "ta-IN" // Tamil
  | "te-IN" // Telugu
  | "kn-IN"; // Kannada

export interface SarvamToolParameterProperty {
  type: "string" | "number" | "boolean" | "object" | "array";
  description: string;
  enum?: string[];
  items?: { type: string };
}

export interface SarvamToolParameterSchema {
  type: "object";
  properties: Record<string, SarvamToolParameterProperty>;
  required?: string[];
}

export interface SarvamAgentTool {
  name: string;
  description: string;
  type: "API_TOOL" | "CORE_TOOL" | "CODE_TOOL";
  parameters: SarvamToolParameterSchema;
  endpoint?: {
    url: string;
    method: "GET" | "POST";
    headers?: Record<string, string>;
    timeoutMs?: number;
  };
}

export interface SarvamHookConfig {
  url: string;
  method: "GET" | "POST";
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export interface SarvamVoiceAgentDeployment {
  id: string;
  name: string;
  description?: string;
  orgId: string;
  workspaceId: string;
  systemPrompt: string;
  primaryLanguage: SarvamAgentLanguage;
  secondaryLanguages?: SarvamAgentLanguage[];
  voiceId: string;
  tools: SarvamAgentTool[];
  onStartHook?: SarvamHookConfig;
  onEndHook?: SarvamHookConfig;
  telephonyProvider?: "EXOTEL" | "TWILIO" | "PLIVO" | "VOBIZ";
  telephonyConnectionId?: string;
  channelRuntimeUrl?: string;
  version: number;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
}

export interface ExotelChannelParams {
  CallSid: string;
  CallFrom: string;
  CallTo: string;
  Direction?: string;
  CustomField?: string;
  Digits?: string;
}

export interface CallCorrelationRecord {
  id: string;
  exotelCallSid: string;
  sarvamInteractionId?: string;
  smrkomedSessionId: string;
  hospitalId: string;
  callerNumber: string;
  dialedNumber: string;
  direction: "INBOUND" | "OUTBOUND";
  isOverflow: boolean;
  overflowReason?: string;
  channelRuntimeUrl: string;
  engineUsed: "SARVAM_VOICE_AGENTS" | "SARVAM_CORE_CUSTOM_FALLBACK";
  status: "INITIATED" | "IN_PROGRESS" | "TRANSFERRED" | "COMPLETED" | "FAILED";
  transferTarget?: string;
  transferredAt?: string;
  completedAt?: string;
  timestamp: string;
}

export interface ExotelHandoffDecision {
  action: "CONNECT_RECEPTIONIST" | "CONNECT_CASUALTY" | "OVERFLOW_TO_SARVAM" | "FALLBACK_HELPLINE";
  targetNumber?: string;
  channelUrl?: string;
  callSid: string;
  hospitalId: string;
  reason: string;
  isSimulated: boolean;
  carrierConfirmationPending: boolean;
}

export interface SarvamSessionInitParams {
  agentId: string;
  callerNumber?: string;
  calledNumber?: string;
  hospitalTenantId: string;
  customContext?: Record<string, any>;
}

export interface SarvamSessionInitResult {
  sessionId: string;
  agentId: string;
  status: "INITIALIZED" | "CONNECTING" | "FAILED";
  streamUrl?: string;
  error?: string;
}

export interface SarvamTranscriptTurn {
  speaker: "caller" | "agent" | "system";
  text: string;
  timestampMs: number;
  language?: string;
  toolCall?: {
    toolName: string;
    input: Record<string, any>;
    output?: Record<string, any>;
  };
}

export interface SarvamCallInteractionSummary {
  interactionId: string;
  callSid: string;
  agentId: string;
  hospitalId: string;
  callerNumber: string;
  calledNumber: string;
  status: "COMPLETED" | "TRANSFERRED" | "ABANDONED" | "FAILED";
  durationSeconds: number;
  transcriptTurns: SarvamTranscriptTurn[];
  disposition: string;
  recordingUrl?: string;
  timestamp: string;
}

export interface ExotelByotConnectionConfig {
  accountSid: string;
  apiKey: string;
  apiToken: string;
  baseUrl: string; // "api.exotel.com" for Singapore
  allocatedExoPhone: string;
  voicebotAppletId: string;
  supportsNativeTransfer: boolean;
  transferNotice: string;
}

