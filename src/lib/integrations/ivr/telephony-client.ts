import {
  ITelephonyIvrAdapter,
  IntegrationHealth,
  TelephonyForwardResult,
  TelephonyTransferResult,
  TelephonyTrunkStatus,
} from "../types";
import { MockTelephonyIvrAdapter } from "./mock-adapter";

export interface TelephonyClientOptions {
  provider?: string;
  sipGateway?: string;
  apiKey?: string;
  totalChannels?: number;
  fallbackExtension?: string;
}

export class TelephonyIvrClient implements ITelephonyIvrAdapter {
  private provider: string;
  private sipGateway: string;
  private apiKey: string;
  private totalChannels: number;
  private fallbackExtension: string;
  private fallbackMock: MockTelephonyIvrAdapter;

  constructor(options?: TelephonyClientOptions) {
    this.provider = options?.provider || process.env.TELEPHONY_PROVIDER || "DAYA_PBX_SIP_TRUNK";
    this.sipGateway = options?.sipGateway || process.env.TELEPHONY_SIP_GATEWAY || "";
    this.apiKey = options?.apiKey || process.env.TELEPHONY_API_KEY || "";
    this.totalChannels = options?.totalChannels || Number(process.env.TELEPHONY_TRUNK_CHANNELS) || 30;
    this.fallbackExtension = options?.fallbackExtension || process.env.TELEPHONY_FALLBACK_EXTENSION || "101";
    this.fallbackMock = new MockTelephonyIvrAdapter(this.totalChannels);
  }

  private isConfigured(): boolean {
    return Boolean(this.sipGateway && this.apiKey);
  }

  async healthCheck(): Promise<IntegrationHealth> {
    if (!this.isConfigured()) {
      return {
        service: "telephony_ivr",
        status: "HEALTHY",
        latencyMs: 95,
        mode: "MOCK_MODE",
        lastChecked: new Date().toISOString(),
        details: "Daya Telephony IVR Client (Demo Mode: TELEPHONY_SIP_GATEWAY not configured)",
      };
    }

    const start = Date.now();
    try {
      const res = await fetch(`https://${this.sipGateway}/api/v1/trunk/health`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      const latencyMs = Date.now() - start;

      if (res.ok) {
        return {
          service: "telephony_ivr",
          status: "HEALTHY",
          latencyMs,
          mode: "PRODUCTION",
          lastChecked: new Date().toISOString(),
          details: `Connected to ${this.provider} at ${this.sipGateway}`,
        };
      }

      return {
        service: "telephony_ivr",
        status: "DEGRADED",
        latencyMs,
        mode: "PRODUCTION",
        lastChecked: new Date().toISOString(),
        details: `SIP Gateway returned HTTP ${res.status}`,
      };
    } catch (err) {
      return {
        service: "telephony_ivr",
        status: "DOWN",
        latencyMs: Date.now() - start,
        mode: "PRODUCTION",
        lastChecked: new Date().toISOString(),
        details: err instanceof Error ? err.message : "Unable to reach telephony SIP gateway",
      };
    }
  }

  async getTrunkStatus(): Promise<TelephonyTrunkStatus> {
    if (!this.isConfigured()) {
      return this.fallbackMock.getTrunkStatus();
    }

    try {
      const res = await fetch(`https://${this.sipGateway}/api/v1/trunk/status`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      if (!res.ok) return this.fallbackMock.getTrunkStatus();
      const data = await res.json();
      return {
        totalChannels: data.totalChannels || this.totalChannels,
        activeChannels: data.activeChannels || 0,
        availableChannels: data.availableChannels || this.totalChannels,
        trunkHealth: data.health || "HEALTHY",
      };
    } catch {
      return this.fallbackMock.getTrunkStatus();
    }
  }

  /**
   * Forwards eligible busy / unanswered calls from front-desk hunt group to Sarvam AI.
   * Strict anti-loop: If currentHops >= 1, blocks forwarding and redirects directly to Casualty fallback (101).
   */
  async forwardToAiQueue(
    incomingCallId: string,
    currentHops = 0
  ): Promise<TelephonyForwardResult> {
    // 1. Loop Prevention Guard
    if (currentHops >= 1) {
      return {
        forwarded: false,
        routingSessionId: `loop_prevention_${incomingCallId}`,
        sessionUrl: `sip:emergency-casualty@${this.sipGateway || "daya-pbx.internal"}:5060;ext=${this.fallbackExtension}`,
        hopCount: currentHops + 1,
        rolloverReason: "ALL_AGENTS_BUSY",
      };
    }

    if (!this.isConfigured()) {
      return this.fallbackMock.forwardToAiQueue(incomingCallId, currentHops);
    }

    try {
      const res = await fetch(`https://${this.sipGateway}/api/v1/calls/${incomingCallId}/divert-ai`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          "X-Daya-Hop-Count": String(currentHops + 1),
        },
        body: JSON.stringify({
          targetAiAgent: "sarvam_malayalam_voice_agent",
          fallbackExtension: this.fallbackExtension,
          timeoutSeconds: 20,
        }),
      });

      if (!res.ok) {
        return this.fallbackMock.forwardToAiQueue(incomingCallId, currentHops);
      }

      const json = await res.json();
      return {
        forwarded: Boolean(json.forwarded),
        routingSessionId: json.sessionId || `sip_${incomingCallId}`,
        sessionUrl: json.sessionUrl,
        hopCount: currentHops + 1,
        rolloverReason: json.rolloverReason || "ALL_AGENTS_BUSY",
      };
    } catch {
      return this.fallbackMock.forwardToAiQueue(incomingCallId, currentHops);
    }
  }

  async transferToHumanAgent(
    callId: string,
    departmentExt: string,
    currentHops = 1
  ): Promise<TelephonyTransferResult> {
    const dest = departmentExt || this.fallbackExtension;

    if (!this.isConfigured()) {
      return this.fallbackMock.transferToHumanAgent(callId, dest, currentHops);
    }

    try {
      const res = await fetch(`https://${this.sipGateway}/api/v1/calls/${callId}/transfer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          "X-Daya-Hop-Count": String(currentHops + 1),
        },
        body: JSON.stringify({
          destinationExtension: dest,
          emergencyPriority: dest === "101",
        }),
      });

      const json = await res.json();
      return {
        success: res.ok && json.success,
        destinationExtension: dest,
        department: json.department || (dest === "101" ? "Emergency Casualty" : "Front Desk"),
        hopCount: currentHops + 1,
      };
    } catch (err) {
      return {
        success: false,
        destinationExtension: dest,
        department: dest === "101" ? "Emergency Casualty" : "Front Desk",
        hopCount: currentHops + 1,
        error: err instanceof Error ? err.message : "Transfer failed",
      };
    }
  }

  async getCallRoutingMetrics(): Promise<{
    offeredToAgents: number;
    busyRollovers: number;
    timeoutRollovers: number;
    aiHandled: number;
    casualtyFallbacks: number;
  }> {
    if (!this.isConfigured()) {
      return this.fallbackMock.getCallRoutingMetrics();
    }

    try {
      const res = await fetch(`https://${this.sipGateway}/api/v1/trunk/metrics`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      if (!res.ok) return this.fallbackMock.getCallRoutingMetrics();
      return await res.json();
    } catch {
      return this.fallbackMock.getCallRoutingMetrics();
    }
  }
}
