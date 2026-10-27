import { IDayaHmsAdapter, ISarvamVoiceAdapter, ITelephonyIvrAdapter } from "./types";
import { MockDayaHmsAdapter } from "./hms/mock-adapter";
import { DayaHmsClient } from "./hms/hms-client";
import { MockSarvamVoiceAdapter } from "./sarvam/mock-adapter";
import { SarvamVoiceClient } from "./sarvam/sarvam-client";
import { MockTelephonyIvrAdapter } from "./ivr/mock-adapter";
import { TelephonyIvrClient } from "./ivr/telephony-client";

export * from "./types";
export { MockDayaHmsAdapter } from "./hms/mock-adapter";
export { DayaHmsClient } from "./hms/hms-client";
export { MockSarvamVoiceAdapter } from "./sarvam/mock-adapter";
export { SarvamVoiceClient } from "./sarvam/sarvam-client";
export { MockTelephonyIvrAdapter } from "./ivr/mock-adapter";
export { TelephonyIvrClient } from "./ivr/telephony-client";
export {
  SarvamKnowledgeSyncAdapter,
  sarvamKnowledgeSync,
  type ISarvamKnowledgeSyncAdapter,
  type SarvamSyncResult,
} from "./sarvam/knowledge-sync";

class IntegrationRegistry {
  private hmsAdapter: IDayaHmsAdapter;
  private sarvamAdapter: ISarvamVoiceAdapter;
  private ivrAdapter: ITelephonyIvrAdapter;

  constructor() {
    // When production credentials exist in environment variables, use the production clients;
    // Both production clients and mock adapters conform to the exact same typed interfaces.
    const isHmsProd = Boolean(process.env.DAYA_HMS_BASE_URL && process.env.DAYA_HMS_API_KEY);
    const isSarvamProd = Boolean(process.env.SARVAM_API_KEY && process.env.SARVAM_AGENT_ID);
    const isIvrProd = Boolean(process.env.TELEPHONY_SIP_GATEWAY && process.env.TELEPHONY_API_KEY);

    this.hmsAdapter = isHmsProd ? new DayaHmsClient() : new MockDayaHmsAdapter();
    this.sarvamAdapter = isSarvamProd ? new SarvamVoiceClient() : new MockSarvamVoiceAdapter();
    this.ivrAdapter = isIvrProd ? new TelephonyIvrClient() : new MockTelephonyIvrAdapter();
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
