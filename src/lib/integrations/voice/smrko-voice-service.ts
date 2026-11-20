import {
  IVoiceAiService,
  VoiceSessionMetadata,
  VoiceDialogueTurn,
  VoiceCallSummary,
  VoiceToolExecutionInput,
  VoiceToolExecutionResult,
} from "./voice-ai-types";
import { MockSarvamVoiceAdapter } from "../sarvam/mock-adapter";
import { SarvamVoiceClient } from "../sarvam/sarvam-client";
import { getHospitalConfig } from "@/lib/config/hospital-config";

/**
 * Smrko Voice Service Adapter
 *
 * Implements IVoiceAiService for the Daya Hospital platform.
 * Hospital-facing branding is strictly "Smrko Voice".
 * Encapsulates underlying speech-to-text, natural Malayalam synthesis, and tool execution.
 */
export class SmrkoVoiceService implements IVoiceAiService {
  private underlyingAdapter: MockSarvamVoiceAdapter | SarvamVoiceClient;

  constructor() {
    const config = getHospitalConfig();
    const hasProdKeys = Boolean(config.voice.apiKey && config.voice.agentId);

    if (hasProdKeys) {
      this.underlyingAdapter = new SarvamVoiceClient({
        apiKey: config.voice.apiKey,
        agentId: config.voice.agentId,
        webhookSecret: config.telephony.webhookSecret,
      });
    } else {
      this.underlyingAdapter = new MockSarvamVoiceAdapter(
        config.telephony.webhookSecret || "smrko_daya_voice_mock_key"
      );
    }
  }

  public async healthCheck() {
    const baseHealth = await this.underlyingAdapter.healthCheck();
    return {
      status: baseHealth.status,
      latencyMs: baseHealth.latencyMs,
      engine: "Smrko Voice Saarathi v2.4 (Malayalam)",
      mode: baseHealth.mode === "PRODUCTION" ? ("PRODUCTION" as const) : ("MOCK_SANDBOX" as const),
      details: "Smrko Voice Conversational Malayalam Speech Engine Operational",
    };
  }

  public async getSessionMetadata(sessionId: string): Promise<VoiceSessionMetadata | null> {
    const meta = await this.underlyingAdapter.getInteractionMetadata(sessionId);
    if (!meta) return null;
    return {
      sessionId: meta.interactionId,
      agentId: meta.agentId,
      startTime: meta.startTime,
      endTime: meta.endTime,
      durationSeconds: meta.durationSeconds,
      status: meta.status,
      callerNumber: meta.callerNumber,
      recordingAvailable: meta.audioRecordingAvailable,
      recordingUrl: meta.recordingUrl,
      language: "MALAYALAM",
    };
  }

  public async getTranscript(sessionId: string): Promise<VoiceDialogueTurn[]> {
    const rawTurns = await this.underlyingAdapter.getTranscript(sessionId);
    return rawTurns.map((turn) => ({
      id: turn.id,
      speaker: turn.speaker,
      speakerName: turn.speaker === "agent" ? "Daya AI (Smrko Voice)" : "Caller / Patient",
      text: turn.text,
      textMalayalam: turn.textMalayalam,
      timestampMs: turn.timestampMs,
      confidence: turn.confidence,
    }));
  }

  public async getSummary(sessionId: string): Promise<VoiceCallSummary | null> {
    const s = await this.underlyingAdapter.getSummary(sessionId);
    if (!s) return null;
    return {
      summaryMalayalam: s.summaryMalayalam,
      summaryEnglish: s.summaryEnglish,
      primaryIntent: s.primaryIntent,
      intentConfidence: s.intentConfidence,
      detectedLanguage: s.detectedLanguage,
      actionIdentified: s.actionIdentified,
      requiresFollowUp: s.requiresFollowUp,
      followUpReason: s.followUpReason,
    };
  }

  public async getRecordingUrl(sessionId: string): Promise<{ url: string; mimeType: string } | null> {
    return this.underlyingAdapter.getRecordingUrl(sessionId);
  }

  public async executeTool(input: VoiceToolExecutionInput): Promise<VoiceToolExecutionResult> {
    const res = await this.underlyingAdapter.executeTool(input.toolName, input.parameters);
    return {
      success: res.success,
      toolName: input.toolName,
      result: res.result,
      error: res.error,
    };
  }
}

export const smrkoVoiceService = new SmrkoVoiceService();

