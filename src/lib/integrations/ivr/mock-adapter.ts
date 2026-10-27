import { ITelephonyIvrAdapter, IntegrationHealth } from "../types";

export class MockTelephonyIvrAdapter implements ITelephonyIvrAdapter {
  async healthCheck(): Promise<IntegrationHealth> {
    return {
      service: "telephony_ivr",
      status: "HEALTHY",
      latencyMs: 95,
      mode: "MOCK_MODE",
      lastChecked: new Date().toISOString(),
      details: "Mock Telephony IVR Adapter — 30 Trunk Rollover Simulator",
    };
  }

  async forwardToAiQueue(incomingCallId: string): Promise<{ sessionUrl: string }> {
    return {
      sessionUrl: `sip:sarvam-malayalam@daya-ivr.telephony.internal/call/${incomingCallId}`,
    };
  }

  async transferToHumanAgent(
    callId: string,
    departmentExt: string
  ): Promise<{ success: boolean; extension: string }> {
    return {
      success: true,
      extension: departmentExt,
    };
  }
}
