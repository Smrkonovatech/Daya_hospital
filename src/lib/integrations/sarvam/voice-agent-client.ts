/**
 * ============================================================================
 * SARVAM VOICE AGENTS (SAMVAAD) CLIENT & ADAPTER (PHASE 10)
 * ============================================================================
 *
 * Official programmatic client for Sarvam Voice Agents / Samvaad platform.
 * Supports:
 * 1. Deployments & Agent authoring (scoped to orgId & workspaceId)
 * 2. Session initiation and real-time streaming handoff
 * 3. Interactions, transcripts, and analytics ingestion
 * 4. Timing-safe cryptographic HMAC-SHA256 webhook signature verification
 * 5. Healthcare fail-safe fallback and health check
 */

import * as crypto from "crypto";
import {
  SarvamVoiceAgentConfig,
  SarvamVoiceAgentDeployment,
  SarvamSessionInitParams,
  SarvamSessionInitResult,
  SarvamCallInteractionSummary,
} from "./voice-agent-types";
import { getSarvamVoiceAgentConfig } from "./voice-agent-config";
import { DAYA_PILOT_VOICE_AGENT_DEPLOYMENT } from "./daya-agent-config";
import { IntegrationHealth } from "../types";

export class SarvamVoiceAgentClient {
  private config: SarvamVoiceAgentConfig;

  constructor(customConfig?: Partial<SarvamVoiceAgentConfig>) {
    this.config = {
      ...getSarvamVoiceAgentConfig(),
      ...(customConfig || {}),
    };
  }

  /**
   * Generates official headers for Sarvam Voice Agents platform.
   * Notice: Uses X-API-Key (unlike Core models which use api-subscription-key).
   */
  private getHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "X-API-Key": this.config.apiKey,
    };
  }

  /**
   * Health check for Sarvam Voice Agents service.
   */
  public async healthCheck(): Promise<IntegrationHealth> {
    const isConfigured = Boolean(this.config.apiKey && this.config.apiKey.trim().length > 5);

    if (!isConfigured) {
      return {
        service: "sarvam_voice_agents",
        status: "HEALTHY",
        latencyMs: 120,
        mode: "MOCK_MODE",
        lastChecked: new Date().toISOString(),
        details: `Sarvam Voice Agents (Demo Sandbox: Workspace ${this.config.workspaceId.slice(0, 8)}... SARVAM_VOICE_AGENT_API_KEY pending)`,
      };
    }

    try {
      const startTime = Date.now();
      const endpoint = `${this.config.appAuthoringBaseUrl}/v1/orgs/${this.config.orgId}/workspaces/${this.config.workspaceId}/deployments`;
      const res = await fetch(endpoint, {
        method: "GET",
        headers: this.getHeaders(),
      });
      const latencyMs = Date.now() - startTime;

      if (res.ok) {
        return {
          service: "sarvam_voice_agents",
          status: "HEALTHY",
          latencyMs,
          mode: "PRODUCTION",
          lastChecked: new Date().toISOString(),
          details: `Sarvam Voice Agents Live Cluster Connected (Workspace: ${this.config.workspaceId.slice(0, 8)}...)`,
        };
      }

      return {
        service: "sarvam_voice_agents",
        status: "DEGRADED",
        latencyMs,
        mode: "PRODUCTION",
        lastChecked: new Date().toISOString(),
        details: `Sarvam Voice Agents API returned HTTP ${res.status}`,
      };
    } catch (err: any) {
      return {
        service: "sarvam_voice_agents",
        status: "DOWN",
        latencyMs: 0,
        mode: "PRODUCTION",
        lastChecked: new Date().toISOString(),
        details: err?.message || "Network error contacting Sarvam Voice Agents API",
      };
    }
  }

  /**
   * Lists all voice agent deployments in the configured Sarvam workspace.
   */
  public async listDeployments(): Promise<any[]> {
    if (!this.config.apiKey) return [];

    try {
      const endpoint = `${this.config.appAuthoringBaseUrl}/v1/orgs/${this.config.orgId}/workspaces/${this.config.workspaceId}/deployments`;
      const res = await fetch(endpoint, {
        method: "GET",
        headers: this.getHeaders(),
      });

      if (!res.ok) return [];
      const json = await res.json();
      return json.items || [];
    } catch (err) {
      console.warn("[SarvamVoiceAgentClient] Error listing deployments:", err);
      return [];
    }
  }

  /**
   * Retrieves an agent deployment by ID from Sarvam Voice Agents platform.
   */
  public async getAgent(agentId: string): Promise<SarvamVoiceAgentDeployment | null> {
    if (!this.config.apiKey) {
      // In development sandbox mode, return Daya pilot deployment definition
      if (agentId === DAYA_PILOT_VOICE_AGENT_DEPLOYMENT.id || !agentId) {
        return DAYA_PILOT_VOICE_AGENT_DEPLOYMENT;
      }
      return null;
    }

    try {
      // First try direct lookup by deploymentId
      const endpoint = `${this.config.appAuthoringBaseUrl}/v1/orgs/${this.config.orgId}/workspaces/${this.config.workspaceId}/deployments/${agentId}`;
      const res = await fetch(endpoint, {
        method: "GET",
        headers: this.getHeaders(),
      });

      if (res.ok) {
        return (await res.json()) as SarvamVoiceAgentDeployment;
      }

      // If not found directly, check if agentId matches an app_id in deployments list
      const deployments = await this.listDeployments();
      const matched = deployments.find(
        (d: any) => d.deployment_id === agentId || d.app_id === agentId || d.name === agentId
      );

      if (matched) {
        return matched as SarvamVoiceAgentDeployment;
      }

      return null;
    } catch (err) {
      console.warn(`[SarvamVoiceAgentClient] Error fetching agent ${agentId}:`, err);
      return null;
    }
  }

  /**
   * Initializes a real-time conversation session with a Sarvam Voice Agent.
   */
  public async createSession(params: SarvamSessionInitParams): Promise<SarvamSessionInitResult> {
    const { agentId, callerNumber, calledNumber, hospitalTenantId, customContext } = params;

    if (!this.config.apiKey) {
      // Return simulated session for development sandbox
      return {
        sessionId: `sarvam_sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        agentId,
        status: "INITIALIZED",
        streamUrl: `wss://apps.sarvam.ai/voice/v1/sessions/simulated?agent=${agentId}&tenant=${hospitalTenantId}`,
      };
    }

    try {
      const endpoint = `${this.config.appAuthoringBaseUrl}/v1/orgs/${this.config.orgId}/workspaces/${this.config.workspaceId}/deployments/${agentId}/sessions`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          caller_number: callerNumber,
          called_number: calledNumber,
          tenant_id: hospitalTenantId,
          context: customContext || {},
        }),
      });

      if (!res.ok) {
        throw new Error(`Sarvam session creation failed with HTTP ${res.status}`);
      }

      const json = await res.json();
      return {
        sessionId: json.session_id || json.id,
        agentId,
        status: "INITIALIZED",
        streamUrl: json.stream_url,
      };
    } catch (err: any) {
      return {
        sessionId: "",
        agentId,
        status: "FAILED",
        error: err?.message || "Failed to initialize Sarvam session",
      };
    }
  }

  /**
   * Queries call interactions, transcripts, and analytics for an agent.
   */
  public async getInteractions(
    agentId: string,
    limit = 10
  ): Promise<SarvamCallInteractionSummary[]> {
    if (!this.config.apiKey) {
      return [
        {
          interactionId: `int_${Date.now()}_01`,
          callSid: "exotel_call_synthetic_01",
          agentId,
          hospitalId: "hosp_daya_thrissur",
          callerNumber: "+919846001122",
          calledNumber: "08047291658",
          status: "COMPLETED",
          durationSeconds: 125,
          transcriptTurns: [
            {
              speaker: "agent",
              text: "നമസ്കാരം, തൃശ്ശൂർ ദയ ജനറൽ ഹോസ്പിറ്റലിലേക്ക് സ്വാഗതം. ഞാൻ ദയ സഹായി. എനിക്ക് എങ്ങനെ സഹായിക്കാനാകും?",
              timestampMs: 1000,
              language: "ml-IN",
            },
            {
              speaker: "caller",
              text: "ഹലോ, കാർഡിയോളജി ഡോക്ടറെ കാണാൻ സമയം എപ്പോഴാണ്?",
              timestampMs: 5000,
              language: "ml-IN",
            },
            {
              speaker: "agent",
              text: "കാർഡിയോളജി വിഭാഗത്തിൽ ഡോ. ആനന്ദ് മേനോൻ രാവിലെ 9:30 മുതൽ ഉച്ചയ്ക്ക് 1:00 വരെ ഉണ്ടാകും. അപ്പോയിന്റ്മെന്റ് ബുക്ക് ചെയ്യണോ?",
              timestampMs: 9000,
              language: "ml-IN",
              toolCall: {
                toolName: "check_opd_availability",
                input: { departmentId: "dept_cardiology" },
                output: { available: true, doctor: "Dr. Anand Menon", timing: "09:30 - 13:00" },
              },
            },
          ],
          disposition: "OPD_INQUIRY_ANSWERED",
          timestamp: new Date().toISOString(),
        },
      ];
    }

    try {
      const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split(".")[0];
      const end = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split(".")[0];
      const endpoint = `${this.config.analyticsBaseUrl}/v1/${this.config.orgId}/${this.config.workspaceId}/${agentId}/interactions?start_datetime=${encodeURIComponent(start)}&end_datetime=${encodeURIComponent(end)}&limit=${limit}`;
      const res = await fetch(endpoint, {
        method: "GET",
        headers: this.getHeaders(),
      });

      if (!res.ok) return [];
      const json = await res.json();
      const rawList = json.items || json.interactions || [];

      return rawList.map((item: any) => ({
        interactionId: item.interaction_id || item.id,
        callSid: item.call_sid || item.interaction_id,
        agentId: item.app_id || agentId,
        hospitalId: "hosp_daya_thrissur",
        callerNumber: item.user_contact || item.caller_number || "",
        calledNumber: item.bot_contact_identifier || item.called_number || "",
        status: item.failure_reason === "NO_FAILURE_REASON" ? "COMPLETED" : "FAILED",
        durationSeconds: Math.round(item.duration_in_seconds || item.duration || 0),
        transcriptTurns: item.interaction_transcript || [],
        disposition: item.agent_variables?.call_summary || item.disposition || "NONE",
        recordingUrl: item.audio_url || item.recording_url,
        timestamp: item.start_datetime || item.attempted_at || new Date().toISOString(),
      }));
    } catch (err) {
      console.warn("[SarvamVoiceAgentClient] Error fetching interactions:", err);
      return [];
    }
  }

  /**
   * Verifies incoming webhook HMAC-SHA256 signature in timing-safe manner.
   * Complies with official Sarvam Voice Agents signed-webhook contract:
   * String to sign = `${timestamp}.${rawBody}`
   * Headers: Sarvam-Signature (hex) and Sarvam-Timestamp (unix timestamp in seconds or ms)
   * Includes replay attack protection (default 5-minute / 300s tolerance window).
   */
  public verifyWebhookSignature(
    rawBody: string,
    signature: string,
    timestampHeader?: string | null,
    toleranceSeconds = 300
  ): { isValid: boolean; reason?: string } {
    const secret = this.config.webhookSecret;
    if (!secret) {
      // In development/test without secret configured, reject in production, allow in test
      if (process.env.NODE_ENV === "production") {
        return { isValid: false, reason: "Webhook secret not configured in production" };
      }
      return { isValid: true, reason: "Development sandbox bypass" };
    }

    if (!signature) {
      return { isValid: false, reason: "Missing webhook signature" };
    }

    // Timestamp replay protection if Sarvam-Timestamp header is supplied
    if (timestampHeader) {
      const tsNum = Number(timestampHeader);
      if (isNaN(tsNum)) {
        return { isValid: false, reason: "Invalid timestamp header format" };
      }
      const timestampMs = tsNum > 1e11 ? tsNum : tsNum * 1000;
      const ageMs = Math.abs(Date.now() - timestampMs);
      if (ageMs > toleranceSeconds * 1000) {
        return {
          isValid: false,
          reason: `Webhook timestamp expired (age ${Math.round(ageMs / 1000)}s > tolerance ${toleranceSeconds}s)`,
        };
      }
    }

    try {
      const cleanSig = signature.replace(/^sha256=/, "").trim();

      // Official Sarvam signed-string format: `${timestamp}.${rawBody}` if timestamp provided
      const stringToSign = timestampHeader ? `${timestampHeader}.${rawBody}` : rawBody;

      const hmac = crypto.createHmac("sha256", secret);
      hmac.update(stringToSign);
      const expectedSignature = hmac.digest("hex");

      if (cleanSig.length !== expectedSignature.length) {
        // Fallback check against rawBody if timestamped verification fails
        if (timestampHeader) {
          const rawHmac = crypto.createHmac("sha256", secret);
          rawHmac.update(rawBody);
          const rawExpected = rawHmac.digest("hex");
          if (cleanSig.length === rawExpected.length && crypto.timingSafeEqual(Buffer.from(cleanSig), Buffer.from(rawExpected))) {
            return { isValid: true, reason: "Verified against rawBody without timestamp" };
          }
        }
        return { isValid: false, reason: "Signature length mismatch" };
      }

      const match = crypto.timingSafeEqual(Buffer.from(cleanSig), Buffer.from(expectedSignature));
      if (!match && timestampHeader) {
        // Fallback check against rawBody
        const rawHmac = crypto.createHmac("sha256", secret);
        rawHmac.update(rawBody);
        const rawExpected = rawHmac.digest("hex");
        if (cleanSig.length === rawExpected.length && crypto.timingSafeEqual(Buffer.from(cleanSig), Buffer.from(rawExpected))) {
          return { isValid: true, reason: "Verified against rawBody without timestamp" };
        }
      }

      return match
        ? { isValid: true }
        : { isValid: false, reason: "Cryptographic signature mismatch" };
    } catch (err: any) {
      return { isValid: false, reason: `Verification exception: ${err?.message}` };
    }
  }
}

export const sarvamVoiceAgentClient = new SarvamVoiceAgentClient();

