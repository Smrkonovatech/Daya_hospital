import {
  ITelephonyIvrAdapter,
  IntegrationHealth,
  TelephonyForwardResult,
  TelephonyTransferResult,
  TelephonyTrunkStatus,
} from "../types";

export class MockTelephonyIvrAdapter implements ITelephonyIvrAdapter {
  private totalChannels: number;
  private activeChannels: number;
  private routingMetrics: {
    offeredToAgents: number;
    busyRollovers: number;
    timeoutRollovers: number;
    aiHandled: number;
    casualtyFallbacks: number;
  };

  constructor(totalChannels = 30) {
    this.totalChannels = totalChannels;
    this.activeChannels = 12;
    this.routingMetrics = {
      offeredToAgents: 1240,
      busyRollovers: 184,
      timeoutRollovers: 42,
      aiHandled: 216,
      casualtyFallbacks: 10,
    };
  }

  async healthCheck(): Promise<IntegrationHealth> {
    return {
      service: "telephony_ivr",
      status: "HEALTHY",
      latencyMs: 95,
      mode: "MOCK_MODE",
      lastChecked: new Date().toISOString(),
      details: "Mock Telephony IVR Adapter — 30-Channel PRI Trunk & Hunt Group Simulator",
    };
  }

  async getTrunkStatus(): Promise<TelephonyTrunkStatus> {
    return {
      totalChannels: this.totalChannels,
      activeChannels: this.activeChannels,
      availableChannels: Math.max(0, this.totalChannels - this.activeChannels),
      trunkHealth: "HEALTHY",
    };
  }

  /**
   * Forwards an incoming busy/no-answer call to the Sarvam AI queue.
   * Enforces loop prevention: if hopCount >= 1, blocks forwarding and redirects to Casualty.
   */
  async forwardToAiQueue(
    incomingCallId: string,
    currentHops = 0
  ): Promise<TelephonyForwardResult> {
    // Anti-loop check: prevent circular forwarding between IVR, AI and front desk
    if (currentHops >= 1) {
      this.routingMetrics.casualtyFallbacks += 1;
      return {
        forwarded: false,
        routingSessionId: `loop_prevent_${incomingCallId}`,
        sessionUrl: "sip:casualty-ext101@daya-pbx.internal:5060",
        hopCount: currentHops + 1,
        rolloverReason: "ALL_AGENTS_BUSY",
      };
    }

    this.routingMetrics.aiHandled += 1;
    this.activeChannels = Math.min(this.totalChannels, this.activeChannels + 1);

    return {
      forwarded: true,
      routingSessionId: `sip_sess_${incomingCallId}_${Date.now()}`,
      sessionUrl: `sip:sarvam-malayalam@daya-ivr.telephony.internal/call/${incomingCallId}`,
      hopCount: currentHops + 1,
      rolloverReason: "ALL_AGENTS_BUSY",
    };
  }

  /**
   * Transfers a call from AI to a specific hospital extension or Casualty.
   */
  async transferToHumanAgent(
    callId: string,
    departmentExt: string,
    currentHops = 1
  ): Promise<TelephonyTransferResult> {
    void callId;
    const dest = departmentExt || "101";

    let dept = "Front Desk & Outpatient Reception";
    if (dest === "101") dept = "Emergency Casualty & Trauma (24/7)";
    else if (dest === "204") dept = "TPA & Cashless Insurance Desk";
    else if (dest === "301") dept = "OPD Registration Counter #1";

    return {
      success: true,
      destinationExtension: dest,
      department: dept,
      hopCount: currentHops + 1,
    };
  }

  async getCallRoutingMetrics(): Promise<{
    offeredToAgents: number;
    busyRollovers: number;
    timeoutRollovers: number;
    aiHandled: number;
    casualtyFallbacks: number;
  }> {
    return { ...this.routingMetrics };
  }
}
