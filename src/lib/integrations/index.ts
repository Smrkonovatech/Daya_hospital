import { IDayaHmsAdapter, ISarvamVoiceAdapter, ITelephonyIvrAdapter } from "./types";
import { MockDayaHmsAdapter } from "./hms/mock-adapter";
import { MockSarvamVoiceAdapter } from "./sarvam/mock-adapter";
import { MockTelephonyIvrAdapter } from "./ivr/mock-adapter";

export * from "./types";
export { MockDayaHmsAdapter } from "./hms/mock-adapter";
export { MockSarvamVoiceAdapter } from "./sarvam/mock-adapter";
export { MockTelephonyIvrAdapter } from "./ivr/mock-adapter";

class IntegrationRegistry {
  private hmsAdapter: IDayaHmsAdapter;
  private sarvamAdapter: ISarvamVoiceAdapter;
  private ivrAdapter: ITelephonyIvrAdapter;

  constructor() {
    // Check if live production credentials exist in server environment variables
    const isHmsProdConfigured = Boolean(
      process.env.DAYA_HMS_API_URL && process.env.DAYA_HMS_API_KEY
    );
    const isSarvamProdConfigured = Boolean(
      process.env.SARVAM_API_KEY && process.env.SARVAM_VOICE_AGENT_ID
    );
    const isIvrProdConfigured = Boolean(
      process.env.IVR_SIP_TRUNK_URL && process.env.IVR_SIP_CREDENTIALS
    );

    // In this phase, we initialize typed mock adapters and log the sandbox status
    this.hmsAdapter = new MockDayaHmsAdapter();
    this.sarvamAdapter = new MockSarvamVoiceAdapter();
    this.ivrAdapter = new MockTelephonyIvrAdapter();

    if (!isHmsProdConfigured || !isSarvamProdConfigured || !isIvrProdConfigured) {
      // Intentionally operating in typed mock sandbox mode
    }
  }

  getHmsAdapter(): IDayaHmsAdapter {
    return this.hmsAdapter;
  }

  getSarvamAdapter(): ISarvamVoiceAdapter {
    return this.sarvamAdapter;
  }

  getIvrAdapter(): ITelephonyIvrAdapter {
    return this.ivrAdapter;
  }

  async getAllHealthStatuses() {
    const [hms, sarvam, ivr] = await Promise.all([
      this.hmsAdapter.healthCheck(),
      this.sarvamAdapter.healthCheck(),
      this.ivrAdapter.healthCheck(),
    ]);

    return {
      hms,
      sarvam,
      ivr,
      allHealthy:
        hms.status === "HEALTHY" &&
        sarvam.status === "HEALTHY" &&
        ivr.status === "HEALTHY",
    };
  }
}

export const integrations = new IntegrationRegistry();
