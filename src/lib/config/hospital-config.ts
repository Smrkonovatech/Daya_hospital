/**
 * ============================================================================
 * HOSPITAL CONFIGURATION & TENANT CONTEXT MODULE
 * ============================================================================
 *
 * Standalone configuration for Daya General Hospital pilot, designed to be
 * consumed by the AI Calling module and cleanly attachable to the parent
 * HMS platform (Smartcom Admin / Tenant Management) in future deployments.
 *
 * Prevents hardcoding hospital-specific parameters in core business logic.
 */

export type TelephonyProviderType =
  | "BITVOICE"
  | "EXOTEL"
  | "KNOWLARITY"
  | "MYOPERATOR"
  | "AIRTEL_IQ"
  | "SIP_GENERIC";

export type HmsProductType = "GRANDIS" | "CUSTOM_REST" | "MOCK";

export type ForwardingScope = "APPOINTMENT_ONLY" | "ALL_IVR" | "OFF_HOURS";

export interface TelephonyHospitalConfig {
  provider: TelephonyProviderType;
  providerName: string;
  incomingHospitalNumber: string;
  forwardingScope: ForwardingScope;
  totalChannels: number;
  apiConfigured: boolean;
  webhookSecret?: string;
  sipGateway?: string;
  apiKey?: string;
  status: "CONFIRMED" | "PENDING_CONFIRMATION" | "MOCK_SANDBOX";
  providerCoordinationNotes: string;
}

export interface HmsHospitalConfig {
  product: HmsProductType;
  productName: string;
  baseUrl?: string;
  apiKey?: string;
  vpnRequired: boolean;
  vpnStatus: "CONNECTED" | "DISCONNECTED" | "PENDING_SETUP";
  timeoutMs: number;
  idempotencyRequired: boolean;
  status: "CONNECTED" | "SANDBOX_MOCK" | "VPN_PENDING";
  technicalContact?: string;
}

export interface VoiceHospitalConfig {
  engine: "SMRKO_VOICE";
  primaryLanguage: "MALAYALAM";
  fallbackLanguage: "ENGLISH";
  agentId?: string;
  apiKey?: string;
  speechModelVersion: string;
}

export interface RoutingHospitalConfig {
  appointmentOnly: boolean;
  daytimeAgents: number;
  expectedDailyIncoming: number;
  expectedDailyAbandoned: number;
  peakPeriod: string;
  ringTimeoutSeconds: number;
  maxHops: number;
  casualtyExtension: string;
  casualtyDirectNumber: string;
}

export interface HospitalConfig {
  hospitalId: string;
  hospitalName: string;
  shortName: string;
  city: string;
  state: string;
  telephony: TelephonyHospitalConfig;
  hms: HmsHospitalConfig;
  voice: VoiceHospitalConfig;
  routing: RoutingHospitalConfig;
}

/**
 * Confirmed pilot configuration for Daya General Hospital Ltd & Specialty Surgical Centre.
 */
export const DAYA_HOSPITAL_CONFIG: HospitalConfig = {
  hospitalId: "hosp_daya_thrissur",
  hospitalName: "Daya General Hospital Ltd & Specialty Surgical Centre",
  shortName: "Daya Hospital",
  city: "Thrissur",
  state: "Kerala",
  telephony: {
    provider: "BITVOICE",
    providerName: "BitVoice Telephony",
    incomingHospitalNumber: "+914872475000",
    forwardingScope: "APPOINTMENT_ONLY",
    totalChannels: 30,
    apiConfigured: false, // Awaiting official API & webhook confirmation from BitVoice
    webhookSecret: process.env.BITVOICE_WEBHOOK_SECRET,
    sipGateway: process.env.BITVOICE_SIP_GATEWAY,
    apiKey: process.env.BITVOICE_API_KEY,
    status: "PENDING_CONFIRMATION",
    providerCoordinationNotes:
      "BitVoice handles primary IVR trunk. External AI forwarding configured for appointment calls only. APIs and webhooks pending confirmation.",
  },
  hms: {
    product: "GRANDIS",
    productName: "Grandis Hospital Management System",
    baseUrl: process.env.GRANDIS_HMS_BASE_URL || process.env.DAYA_HMS_BASE_URL,
    apiKey: process.env.GRANDIS_HMS_API_KEY || process.env.DAYA_HMS_API_KEY,
    vpnRequired: true,
    vpnStatus: process.env.GRANDIS_VPN_CONNECTED === "true" ? "CONNECTED" : "PENDING_SETUP",
    timeoutMs: Number(process.env.GRANDIS_HMS_TIMEOUT_MS) || 3000,
    idempotencyRequired: true,
    status: process.env.GRANDIS_HMS_BASE_URL ? "CONNECTED" : "SANDBOX_MOCK",
    technicalContact: "Grandis HMS Integration Team (Daya IT)",
  },
  voice: {
    engine: "SMRKO_VOICE",
    primaryLanguage: "MALAYALAM",
    fallbackLanguage: "ENGLISH",
    agentId: process.env.SMRKO_VOICE_AGENT_ID || process.env.SARVAM_AGENT_ID || "agent_daya_malayalam_v2",
    apiKey: process.env.SMRKO_VOICE_API_KEY || process.env.SARVAM_API_KEY,
    speechModelVersion: "Smrko Voice Saarathi v2.4",
  },
  routing: {
    appointmentOnly: true,
    daytimeAgents: 4,
    expectedDailyIncoming: 800,
    expectedDailyAbandoned: 150,
    peakPeriod: "09:00 - 12:00",
    ringTimeoutSeconds: 20,
    maxHops: 3,
    casualtyExtension: "100",
    casualtyDirectNumber: "+914872475100",
  },
};

/**
 * Returns active hospital configuration.
 * Resolves to Daya Hospital in standalone pilot mode, or tenant context when integrated with Smartcom Admin.
 */
export function getHospitalConfig(hospitalId?: string): HospitalConfig {
  const activeId = hospitalId || process.env.HOSPITAL_ID || DAYA_HOSPITAL_CONFIG.hospitalId;

  if (activeId === DAYA_HOSPITAL_CONFIG.hospitalId) {
    return DAYA_HOSPITAL_CONFIG;
  }

  // Fallback / default to Daya Hospital configuration
  return DAYA_HOSPITAL_CONFIG;
}

