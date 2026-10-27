import * as crypto from "crypto";
import {
  ISarvamVoiceAdapter,
  IntegrationHealth,
  SarvamInteractionMetadata,
  SarvamTranscriptTurn,
  SarvamSummary,
} from "../types";

export class SarvamVoiceClient implements ISarvamVoiceAdapter {
  private apiKey: string;
  private baseUrl: string;
  private agentId: string;
  private webhookSecret: string;

  constructor(options?: {
    apiKey?: string;
    baseUrl?: string;
    agentId?: string;
    webhookSecret?: string;
  }) {
    this.apiKey = options?.apiKey || process.env.SARVAM_API_KEY || "";
    this.baseUrl = options?.baseUrl || process.env.SARVAM_BASE_URL || "https://api.sarvam.ai";
    this.agentId = options?.agentId || process.env.SARVAM_AGENT_ID || "";
    this.webhookSecret = options?.webhookSecret || process.env.SARVAM_WEBHOOK_SECRET || "";
  }

  async healthCheck(): Promise<IntegrationHealth> {
    const isProdConfigured = Boolean(this.apiKey && this.agentId);

    if (!isProdConfigured) {
      return {
        service: "sarvam_ai",
        status: "HEALTHY",
        latencyMs: 240,
        mode: "MOCK_MODE",
        lastChecked: new Date().toISOString(),
        details: "Sarvam Voice Client (Demo Mode: SARVAM_API_KEY not configured)",
      };
    }

    try {
      const startTime = Date.now();
      const res = await fetch(`${this.baseUrl}/voice/v1/agents/${this.agentId}/health`, {
        headers: {
          "api-subscription-key": this.apiKey,
        },
      });
      const latencyMs = Date.now() - startTime;

      if (res.ok) {
        return {
          service: "sarvam_ai",
          status: "HEALTHY",
          latencyMs,
          mode: "PRODUCTION",
          lastChecked: new Date().toISOString(),
          details: "Sarvam Voice Agent Live Cluster Verified",
        };
      }

      return {
        service: "sarvam_ai",
        status: "DEGRADED",
        latencyMs,
        mode: "PRODUCTION",
        lastChecked: new Date().toISOString(),
        details: `Sarvam API returned HTTP ${res.status}`,
      };
    } catch (err) {
      return {
        service: "sarvam_ai",
        status: "DOWN",
        latencyMs: 0,
        mode: "PRODUCTION",
        lastChecked: new Date().toISOString(),
        details: err instanceof Error ? err.message : "Network error contacting Sarvam API",
      };
    }
  }

  /**
   * Verifies incoming webhook HMAC-SHA256 signature against raw body.
   */
  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!this.webhookSecret) {
      // If secret is not configured, deny unverified webhooks in production
      return process.env.NODE_ENV !== "production";
    }

    if (!signature) return false;

    try {
      const hmac = crypto.createHmac("sha256", this.webhookSecret);
      hmac.update(rawBody);
      const expectedSignature = hmac.digest("hex");

      const sigBuffer = Buffer.from(signature.replace(/^sha256=/, ""));
      const expectedBuffer = Buffer.from(expectedSignature);

      if (sigBuffer.length !== expectedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Retrieves interaction metadata from Sarvam API.
   */
  async getInteractionMetadata(
    interactionId: string
  ): Promise<SarvamInteractionMetadata | null> {
    if (!this.apiKey) return null;

    try {
      const res = await fetch(`${this.baseUrl}/voice/v1/interactions/${interactionId}`, {
        headers: { "api-subscription-key": this.apiKey },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return {
        interactionId: data.interaction_id || interactionId,
        agentId: data.agent_id || this.agentId,
        startTime: data.start_time || new Date().toISOString(),
        endTime: data.end_time,
        durationSeconds: data.duration_seconds || 0,
        status: data.status || "COMPLETED",
        callerNumber: data.caller_number || "",
        audioRecordingAvailable: Boolean(data.recording_available),
        recordingUrl: data.recording_url,
        language: data.language || "malayalam",
      };
    } catch {
      return null;
    }
  }

  /**
   * Fetches call transcript turns from Sarvam API when omitted in webhook.
   */
  async getTranscript(
    interactionId: string
  ): Promise<SarvamTranscriptTurn[]> {
    if (!this.apiKey) return [];

    try {
      const res = await fetch(`${this.baseUrl}/voice/v1/interactions/${interactionId}/transcript`, {
        headers: { "api-subscription-key": this.apiKey },
      });
      if (!res.ok) return [];
      const data = await res.json();
      const turns = Array.isArray(data.turns) ? data.turns : [];

      return turns.map((t: Record<string, unknown>, idx: number) => ({
        id: (t.id as string) || `turn_${interactionId}_${idx}`,
        speaker: (t.speaker as "agent" | "caller" | "system") || "caller",
        text: (t.text as string) || "",
        textMalayalam: (t.text_malayalam as string) || undefined,
        timestampMs: (t.timestamp_ms as number) || idx * 3000,
        confidence: (t.confidence as number) || 0.95,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Fetches call summary and detected intents from Sarvam API.
   */
  async getSummary(
    interactionId: string
  ): Promise<SarvamSummary | null> {
    if (!this.apiKey) return null;

    try {
      const res = await fetch(`${this.baseUrl}/voice/v1/interactions/${interactionId}/summary`, {
        headers: { "api-subscription-key": this.apiKey },
      });
      if (!res.ok) return null;
      const data = await res.json();

      return {
        summaryMalayalam: data.summary_malayalam || "",
        summaryEnglish: data.summary_english || "",
        primaryIntent: data.primary_intent || "GENERAL_QUERY",
        intentConfidence: data.intent_confidence || 0.95,
        detectedLanguage: data.detected_language || "malayalam",
        actionIdentified: data.action_identified,
        requiresFollowUp: Boolean(data.requires_follow_up),
        followUpReason: data.follow_up_reason,
      };
    } catch {
      return null;
    }
  }

  /**
   * Retrieves signed recording stream URL.
   */
  async getRecordingUrl(
    interactionId: string
  ): Promise<{ url: string; mimeType: string } | null> {
    if (!this.apiKey) return null;

    try {
      const res = await fetch(`${this.baseUrl}/voice/v1/interactions/${interactionId}/recording`, {
        headers: { "api-subscription-key": this.apiKey },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return {
        url: data.recording_url,
        mimeType: data.mime_type || "audio/webm;codecs=opus",
      };
    } catch {
      return null;
    }
  }

  /**
   * Executes an authorized API tool on behalf of the voice agent.
   */
  async executeTool(
    toolName: string,
    parameters: Record<string, unknown>
  ): Promise<{ success: boolean; result: unknown; error?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/voice/v1/tools/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-subscription-key": this.apiKey,
        },
        body: JSON.stringify({
          tool_name: toolName,
          parameters,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        return { success: true, result: json.result };
      }
      return { success: false, result: null, error: json.error || "Tool execution failed" };
    } catch (err) {
      return {
        success: false,
        result: null,
        error: err instanceof Error ? err.message : "Network error executing tool",
      };
    }
  }
}
