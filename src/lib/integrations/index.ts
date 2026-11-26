import { IDayaHmsAdapter, ISarvamVoiceAdapter, ITelephonyIvrAdapter } from "./types";
import { MockDayaHmsAdapter } from "./hms/mock-adapter";
import { DayaHmsClient } from "./hms/hms-client";
import { MockSarvamVoiceAdapter } from "./sarvam/mock-adapter";
import { SarvamVoiceClient } from "./sarvam/sarvam-client";
import { MockTelephonyIvrAdapter } from "./ivr/mock-adapter";
import { TelephonyIvrClient } from "./ivr/telephony-client";
import { ExotelTelephonyAdapter } from "./telephony/exotel-adapter";

export * from "./types";
export { MockDayaHmsAdapter } from "./hms/mock-adapter";
export { DayaHmsClient } from "./hms/hms-client";
export { GrandisHmsAdapter } from "./hms/grandis-adapter";
export * from "./hms/standard-hms-types";
export { MockSarvamVoiceAdapter } from "./sarvam/mock-adapter";
export { SarvamVoiceClient } from "./sarvam/sarvam-client";
export { MockTelephonyIvrAdapter } from "./ivr/mock-adapter";
export { TelephonyIvrClient } from "./ivr/telephony-client";
export { BitVoiceTelephonyAdapter } from "./telephony/bitvoice-adapter";
export { ExotelTelephonyAdapter } from "./telephony/exotel-adapter";
export {
  ExotelTelephonyService,
  exotelTelephonyService,
  type StandardOutboundCallParams,
  type StandardOutboundCallResult,
} from "@/lib/services/exotel-telephony-service";
export type {
  InboundCallEvent,
  CallStatusUpdateEvent,
  CallRoutingDecision,
  ITelephonyConnector,
  OutboundCallRequest,
  OutboundCallResponse,
  ExotelCallDetails,
} from "./telephony/standard-telephony-types";
export { SmrkoVoiceService, smrkoVoiceService } from "./voice/smrko-voice-service";
export * from "./voice/voice-ai-types";
export { ApiMappingEngine, GRANDIS_DEFAULT_MAPPING_SCHEMA } from "./mapping/api-mapping-engine";
export { DAYA_HOSPITAL_CONFIG, getHospitalConfig } from "@/lib/config/hospital-config";
export { callRoutingEngine } from "@/lib/routing/call-routing-engine";
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
  private exotelAdapter: ExotelTelephonyAdapter;

  constructor() {
    // When production credentials exist in environment variables, use the production clients;
    // Both production clients and mock adapters conform to the exact same typed interfaces.
    const isHmsProd = Boolean(process.env.DAYA_HMS_BASE_URL && process.env.DAYA_HMS_API_KEY);
    const isSarvamProd = Boolean(process.env.SARVAM_API_KEY && process.env.SARVAM_AGENT_ID);
    const isIvrProd = Boolean(process.env.TELEPHONY_SIP_GATEWAY && process.env.TELEPHONY_API_KEY);

    // Real client enforced by default: mock adapters accessible ONLY in explicit simulation mode
    this.hmsAdapter = new DayaHmsClient();
    this.sarvamAdapter = isSarvamProd ? new SarvamVoiceClient() : new MockSarvamVoiceAdapter();
    this.ivrAdapter = isIvrProd ? new TelephonyIvrClient() : new MockTelephonyIvrAdapter();
    this.exotelAdapter = new ExotelTelephonyAdapter();
  }

  getHmsAdapter(simulationMode?: boolean): IDayaHmsAdapter {
    if (simulationMode) {
      return new MockDayaHmsAdapter();
    }
    return this.hmsAdapter;
  }

  getSarvamAdapter(): ISarvamVoiceAdapter {
    return this.sarvamAdapter;
  }

  getIvrAdapter(): ITelephonyIvrAdapter {
    return this.ivrAdapter;
  }

  getExotelAdapter(): ExotelTelephonyAdapter {
    return this.exotelAdapter;
  }

  async getAllHealthStatuses() {
    const [hms, sarvam, ivr, exotel] = await Promise.all([
      this.hmsAdapter.healthCheck(),
      this.sarvamAdapter.healthCheck(),
      this.ivrAdapter.healthCheck(),
      this.exotelAdapter.healthCheck(),
    ]);

    return {
      hms,
      sarvam,
      ivr,
      exotel: {
        service: "exotel_telephony",
        status: exotel.status,
        latencyMs: exotel.latencyMs,
        mode: exotel.mode,
        lastChecked: new Date().toISOString(),
        details: exotel.details,
      },
      allHealthy:
        hms.status === "HEALTHY" &&
        sarvam.status === "HEALTHY" &&
        ivr.status === "HEALTHY",
    };
  }
}

export const integrations = new IntegrationRegistry();
export const exotelAdapter = new ExotelTelephonyAdapter();
