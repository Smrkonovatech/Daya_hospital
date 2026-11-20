/**
 * ============================================================================
 * STANDARD REUSABLE VOICE AI SERVICE INTERFACE
 * ============================================================================
 *
 * Provider-independent contract for Smrko Voice conversational runtime.
 * Keeps the underlying voice provider completely decoupled from dashboard and logic.
 */

export interface VoiceDialogueTurn {
  id: string;
  speaker: "agent" | "caller" | "system";
  speakerName: string;
  text: string;
  textMalayalam?: string;
  timestampMs: number;
  confidence?: number;
}

export interface VoiceCallSummary {
  summaryMalayalam: string;
  summaryEnglish: string;
  primaryIntent: string;
  intentConfidence: number;
  detectedLanguage: "malayalam" | "manglish" | "english";
  actionIdentified?: string;
  requiresFollowUp: boolean;
  followUpReason?: string;
}

export interface VoiceSessionMetadata {
  sessionId: string;
  agentId: string;
  startTime: string;
  endTime?: string;
  durationSeconds: number;
  status: "COMPLETED" | "FAILED" | "IN_PROGRESS" | "TRANSFERRED";
  callerNumber: string;
  recordingAvailable: boolean;
  recordingUrl?: string;
  language: string;
}

export interface VoiceToolExecutionInput {
  toolName: "CHECK_DOCTOR_SLOT" | "BOOK_APPOINTMENT" | "RESCHEDULE_APPOINTMENT" | "CANCEL_APPOINTMENT" | "TRANSFER_CALL";
  parameters: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface VoiceToolExecutionResult {
  success: boolean;
  toolName: string;
  result: unknown;
  error?: string;
}

export interface IVoiceAiService {
  healthCheck(): Promise<{
    status: "HEALTHY" | "DEGRADED" | "DOWN";
    latencyMs: number;
    engine: string;
    mode: "PRODUCTION" | "MOCK_SANDBOX";
    details: string;
  }>;
  getSessionMetadata(sessionId: string): Promise<VoiceSessionMetadata | null>;
  getTranscript(sessionId: string): Promise<VoiceDialogueTurn[]>;
  getSummary(sessionId: string): Promise<VoiceCallSummary | null>;
  getRecordingUrl(sessionId: string): Promise<{ url: string; mimeType: string } | null>;
  executeTool(input: VoiceToolExecutionInput): Promise<VoiceToolExecutionResult>;
}

