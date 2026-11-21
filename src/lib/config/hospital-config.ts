/**
 * ============================================================================
 * HOSPITAL CONFIGURATION & TENANT CONTEXT MODULE
 * ============================================================================
 *
 * Standalone configuration for Daya General Hospital pilot, designed to be
 * consumed by the AI Calling module and cleanly attachable to the parent
 * HMS platform (Smartcom Admin / Tenant Management) in future deployments.
 *
 * Supports multi-hospital SaaS tenant mapping for Exotel & BitVoice telephony.
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

export interface ExotelHospitalConfig {
  accountSid: string;
  apiKey: string;
  apiToken: string;
  subdomain?: string;
  baseUrl?: string;
  defaultAppId?: string; // Voicebot Applet ID
  defaultExoPhone?: string; // Virtual incoming/outbound number (+91...)
  mediaGatewayWsUrl?: string; // wss://voice.smrkomed.com/exotel/voicebot
  webhookSecret?: string;
  statusCallbackUrl?: string;
  statusCallbackEvents?: string[];
  maxCallDurationSeconds?: number;
  ringTimeoutSeconds?: number;
}

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
  exotel?: ExotelHospitalConfig;
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

const isExotelPrimary =
  process.env.TELEPHONY_PROVIDER === "EXOTEL" || Boolean(process.env.EXOTEL_ACCOUNT_SID);

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
    provider: isExotelPrimary ? "EXOTEL" : "BITVOICE",
    providerName: isExotelPrimary ? "Exotel Telephony Cloud" : "BitVoice Telephony",
    incomingHospitalNumber: process.env.EXOTEL_DEFAULT_EXOPHONE || "+914872475000",
    forwardingScope: "APPOINTMENT_ONLY",
    totalChannels: Number(process.env.TELEPHONY_TRUNK_CHANNELS) || 30,
    apiConfigured: Boolean(
      (process.env.EXOTEL_API_KEY && process.env.EXOTEL_API_TOKEN) ||
        (process.env.BITVOICE_API_KEY && process.env.BITVOICE_SIP_GATEWAY)
    ),
    webhookSecret:
      process.env.EXOTEL_WEBHOOK_SECRET || process.env.BITVOICE_WEBHOOK_SECRET || "smrko_telephony_secret_2026",
    sipGateway: process.env.BITVOICE_SIP_GATEWAY,
    apiKey: process.env.EXOTEL_API_KEY || process.env.BITVOICE_API_KEY,
    status:
      process.env.EXOTEL_API_KEY || process.env.BITVOICE_API_KEY
        ? "CONFIRMED"
        : "PENDING_CONFIRMATION",
    providerCoordinationNotes: isExotelPrimary
      ? "Exotel Cloud IVR with AgentStream bidirectional WebSocket audio streaming to Smrko Voice Media Gateway."
      : "BitVoice handles primary IVR trunk. External AI forwarding configured for appointment calls only.",
    exotel: {
      accountSid: process.env.EXOTEL_ACCOUNT_SID || "exotel_account_daya_pilot",
      apiKey: process.env.EXOTEL_API_KEY || "exotel_key_placeholder",
      apiToken: process.env.EXOTEL_API_TOKEN || "exotel_token_placeholder",
      subdomain: process.env.EXOTEL_SUBDOMAIN || "api",
      baseUrl:
        process.env.EXOTEL_BASE_URL ||
        `https://api.exotel.com/v1/Accounts/${process.env.EXOTEL_ACCOUNT_SID || "exotel_account_daya_pilot"}`,
      defaultAppId: process.env.EXOTEL_DEFAULT_APP_ID || "app_daya_voicebot_v1",
      defaultExoPhone: process.env.EXOTEL_DEFAULT_EXOPHONE || "+914872475000",
      mediaGatewayWsUrl: process.env.VOICE_GATEWAY_PUBLIC_URL || "wss://voice.smrkomed.com/exotel/voicebot",
      webhookSecret: process.env.EXOTEL_WEBHOOK_SECRET || "exotel_webhook_secret_daya_2026",
      statusCallbackUrl:
        process.env.EXOTEL_STATUS_CALLBACK_URL || "https://daya.smrkomed.com/api/webhooks/exotel",
      statusCallbackEvents: ["terminal", "answered", "in-progress"],
      maxCallDurationSeconds: 600,
      ringTimeoutSeconds: 20,
    },
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
 * Multi-Hospital Tenant Directory
 */
export const HOSPITAL_REGISTRY: Record<string, HospitalConfig> = {
  hosp_daya_thrissur: DAYA_HOSPITAL_CONFIG,
};

/**
 * Returns active hospital configuration.
 * Resolves to Daya Hospital in standalone pilot mode, or tenant context when integrated with Smartcom Admin.
 */
export function getHospitalConfig(hospitalId?: string): HospitalConfig {
  const activeId = hospitalId || process.env.HOSPITAL_ID || DAYA_HOSPITAL_CONFIG.hospitalId;

  if (HOSPITAL_REGISTRY[activeId]) {
    return HOSPITAL_REGISTRY[activeId];
  }

  // Fallback / default to Daya Hospital configuration
  return DAYA_HOSPITAL_CONFIG;
}

/**
 * Normalizes phone numbers for matching (+91, 0, or clean digits).
 */
export function normalizePhoneNumber(num: string): string {
  return num.replace(/\D/g, "").slice(-10);
}

/**
 * Resolves hospital tenant from incoming/dialed phone number.
 * Uses trusted server-side mapping, never relying on unverified client tenant IDs.
 */
export function resolveHospitalByPhoneNumber(phoneNumber: string): HospitalConfig | null {
  if (!phoneNumber) return null;
  const clean = normalizePhoneNumber(phoneNumber);

  for (const config of Object.values(HOSPITAL_REGISTRY)) {
    const mainClean = normalizePhoneNumber(config.telephony.incomingHospitalNumber);
    const exoClean = config.telephony.exotel?.defaultExoPhone
      ? normalizePhoneNumber(config.telephony.exotel.defaultExoPhone)
      : "";
    if (clean === mainClean || clean === exoClean) {
      return config;
    }
  }

  return null;
}

/**
 * Resolves hospital tenant by Exotel Account SID.
 * Supports multi-account / subaccount arrangements per hospital.
 */
export function resolveHospitalByAccountSid(accountSid: string): HospitalConfig | null {
  if (!accountSid) return null;

  for (const config of Object.values(HOSPITAL_REGISTRY)) {
    if (config.telephony.exotel?.accountSid === accountSid) {
      return config;
    }
  }

  return null;
}
