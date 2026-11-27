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
  defaultAppId?: string; // Voicebot Applet ID (Live Production: 1393239)
  stagingAppId?: string; // Isolated Staging Voicebot Applet ID: 1393240
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
  aliasPhoneNumbers?: string[];
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
  receptionistNumber?: string;
  receiverClassification?: "TEMPORARY_DEV_TEST_RECEIVER" | "VERIFIED_CLINICAL_TRUNK";
  emergencyLivePstnTransferEnabled?: boolean;
}

export interface HospitalConfig {
  hospitalId: string;
  hospitalName: string;
  shortName: string;
  city: string;
  state: string;
  isVerified?: boolean;
  verificationStatus?: "VERIFIED_LIVE" | "UNVERIFIED_DEMO_SANDBOX";
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
  isVerified: true,
  verificationStatus: "VERIFIED_LIVE",
  telephony: {
    provider: isExotelPrimary ? "EXOTEL" : "BITVOICE",
    providerName: isExotelPrimary ? "Exotel Telephony Cloud" : "BitVoice Telephony",
    incomingHospitalNumber: process.env.EXOTEL_DEFAULT_EXOPHONE || "+914872475000",
    aliasPhoneNumbers: [
      "08047291658",
      "+918047291658",
      "+914872475000",
      "04872475000",
      "+918064265889",
      "08064265889",
    ],
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
      accountSid: process.env.EXOTEL_ACCOUNT_SID || "smrkonova1",
      apiKey: process.env.EXOTEL_API_KEY || "exotel_key_placeholder",
      apiToken: process.env.EXOTEL_API_TOKEN || "exotel_token_placeholder",
      subdomain: process.env.EXOTEL_SUBDOMAIN || "api",
      baseUrl: process.env.EXOTEL_BASE_URL || "https://api.exotel.com",
      defaultAppId: process.env.EXOTEL_DEFAULT_APP_ID || "1393239",
      stagingAppId: process.env.EXOTEL_STAGING_APP_ID || "1393240",
      defaultExoPhone: process.env.EXOTEL_DEFAULT_EXOPHONE || "08047291658",
      mediaGatewayWsUrl:
        process.env.VOICE_GATEWAY_PUBLIC_URL ||
        "wss://dayahospital-production-467a7d31.up.railway.app/exotel/voicebot",
      webhookSecret: process.env.EXOTEL_WEBHOOK_SECRET || "exotel_webhook_secret_daya_2026",
      statusCallbackUrl:
        process.env.EXOTEL_STATUS_CALLBACK_URL ||
        "https://aicalling.smrkomed.com/api/webhooks/exotel",
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
    // RECLASSIFIED PER PHASE 10.13: Strictly temporary development test receiver (+919740662046).
    // Live carrier emergency PSTN transfer is disabled until hospital-approved clinical casualty trunk is confirmed.
    casualtyDirectNumber: process.env.DAYA_CASUALTY_NUMBER || "+919740662046",
    receptionistNumber: process.env.DAYA_RECEPTION_NUMBER || "+919606654032",
    receiverClassification: "TEMPORARY_DEV_TEST_RECEIVER",
    emergencyLivePstnTransferEnabled: false,
  },
};

export const ASTER_MEDCITY_CONFIG: HospitalConfig = {
  hospitalId: "hosp_aster_medcity",
  hospitalName: "Aster Medcity Kochi",
  shortName: "Aster Medcity",
  city: "Kochi",
  state: "Kerala",
  isVerified: false,
  verificationStatus: "UNVERIFIED_DEMO_SANDBOX",
  telephony: {
    provider: "EXOTEL",
    providerName: "Exotel Telephony Cloud",
    incomingHospitalNumber: "+914846699000",
    aliasPhoneNumbers: ["08047291999", "+914846699000"],
    forwardingScope: "APPOINTMENT_ONLY",
    totalChannels: 30,
    apiConfigured: true,
    webhookSecret: "exotel_webhook_secret_aster_2026",
    status: "MOCK_SANDBOX",
    providerCoordinationNotes: "Aster Medcity demo sandbox trunk (UNVERIFIED DEMO DATA - live calls fail closed).",
    exotel: {
      accountSid: "smrkonova_aster",
      apiKey: "exotel_key_aster",
      apiToken: "exotel_token_aster",
      subdomain: "api",
      baseUrl: "https://api.exotel.com",
      defaultAppId: "1393240",
      defaultExoPhone: "08047291999",
      mediaGatewayWsUrl: "wss://dayahospital-production-467a7d31.up.railway.app/exotel/voicebot",
      ringTimeoutSeconds: 20,
    },
  },
  hms: {
    product: "MOCK",
    productName: "Aster HMS",
    vpnRequired: false,
    vpnStatus: "CONNECTED",
    timeoutMs: 3000,
    idempotencyRequired: true,
    status: "CONNECTED",
  },
  voice: {
    engine: "SMRKO_VOICE",
    primaryLanguage: "MALAYALAM",
    fallbackLanguage: "ENGLISH",
    speechModelVersion: "Smrko Voice Saarathi v2.4",
  },
  routing: {
    appointmentOnly: true,
    daytimeAgents: 5,
    expectedDailyIncoming: 1200,
    expectedDailyAbandoned: 100,
    peakPeriod: "09:00 - 13:00",
    ringTimeoutSeconds: 20,
    maxHops: 3,
    casualtyExtension: "100",
    casualtyDirectNumber: "+914846699999",
    receptionistNumber: "+914846699000",
  },
};

export const KIMS_HOSPITAL_CONFIG: HospitalConfig = {
  hospitalId: "hosp_kims_trivandrum",
  hospitalName: "KIMSHEALTH Trivandrum",
  shortName: "KIMSHEALTH",
  city: "Trivandrum",
  state: "Kerala",
  isVerified: false,
  verificationStatus: "UNVERIFIED_DEMO_SANDBOX",
  telephony: {
    provider: "EXOTEL",
    providerName: "Exotel Telephony Cloud",
    incomingHospitalNumber: "+914713041000",
    aliasPhoneNumbers: ["08047291888", "+914713041000"],
    forwardingScope: "APPOINTMENT_ONLY",
    totalChannels: 30,
    apiConfigured: true,
    webhookSecret: "exotel_webhook_secret_kims_2026",
    status: "MOCK_SANDBOX",
    providerCoordinationNotes: "KIMSHEALTH demo sandbox trunk (UNVERIFIED DEMO DATA - live calls fail closed).",
    exotel: {
      accountSid: "smrkonova_kims",
      apiKey: "exotel_key_kims",
      apiToken: "exotel_token_kims",
      subdomain: "api",
      baseUrl: "https://api.exotel.com",
      defaultAppId: "1393241",
      defaultExoPhone: "08047291888",
      mediaGatewayWsUrl: "wss://dayahospital-production-467a7d31.up.railway.app/exotel/voicebot",
      ringTimeoutSeconds: 20,
    },
  },
  hms: {
    product: "MOCK",
    productName: "KIMS HMS",
    vpnRequired: false,
    vpnStatus: "CONNECTED",
    timeoutMs: 3000,
    idempotencyRequired: true,
    status: "CONNECTED",
  },
  voice: {
    engine: "SMRKO_VOICE",
    primaryLanguage: "MALAYALAM",
    fallbackLanguage: "ENGLISH",
    speechModelVersion: "Smrko Voice Saarathi v2.4",
  },
  routing: {
    appointmentOnly: true,
    daytimeAgents: 6,
    expectedDailyIncoming: 1500,
    expectedDailyAbandoned: 120,
    peakPeriod: "08:30 - 12:30",
    ringTimeoutSeconds: 20,
    maxHops: 3,
    casualtyExtension: "100",
    casualtyDirectNumber: "+914713041999",
    receptionistNumber: "+914713041234",
  },
};

/**
 * Multi-Hospital Tenant Directory
 */
export const HOSPITAL_REGISTRY: Record<string, HospitalConfig> = {
  hosp_daya_thrissur: DAYA_HOSPITAL_CONFIG,
  "daya-hospital": DAYA_HOSPITAL_CONFIG,
  hosp_aster_medcity: ASTER_MEDCITY_CONFIG,
  hosp_kims_trivandrum: KIMS_HOSPITAL_CONFIG,
};

export const GENERIC_HOSPITAL_CONFIG: HospitalConfig = {
  hospitalId: "hosp_generic_template",
  hospitalName: "Hospital Partner Template",
  shortName: "Hospital",
  city: "City",
  state: "State",
  telephony: {
    provider: "EXOTEL",
    providerName: "Exotel Telephony Cloud",
    incomingHospitalNumber: "",
    forwardingScope: "APPOINTMENT_ONLY",
    totalChannels: 10,
    apiConfigured: false,
    status: "MOCK_SANDBOX",
    providerCoordinationNotes: "Tenant pending setup",
  },
  hms: {
    product: "MOCK",
    productName: "Generic HMS Integration",
    vpnRequired: false,
    vpnStatus: "DISCONNECTED",
    timeoutMs: 3000,
    idempotencyRequired: true,
    status: "SANDBOX_MOCK",
  },
  voice: {
    engine: "SMRKO_VOICE",
    primaryLanguage: "MALAYALAM",
    fallbackLanguage: "ENGLISH",
    speechModelVersion: "Smrko Voice Saarathi v2.4",
  },
  routing: {
    appointmentOnly: true,
    daytimeAgents: 2,
    expectedDailyIncoming: 100,
    expectedDailyAbandoned: 20,
    peakPeriod: "09:00 - 12:00",
    ringTimeoutSeconds: 20,
    maxHops: 3,
    casualtyExtension: "100",
    casualtyDirectNumber: "",
    receptionistNumber: "",
  },
};

/**
 * Returns active hospital configuration.
 * Resolves to Daya Hospital in standalone pilot mode, or tenant context when integrated with Smartcom Admin.
 * Strictly prevents leaking Daya Hospital specific routing (+919606654032) to generic or other tenants.
 */
export function getHospitalConfig(hospitalId?: string): HospitalConfig {
  const activeId = hospitalId || process.env.HOSPITAL_ID || DAYA_HOSPITAL_CONFIG.hospitalId;

  if (activeId === "hosp_daya_thrissur") {
    return DAYA_HOSPITAL_CONFIG;
  }

  if (HOSPITAL_REGISTRY[activeId]) {
    return HOSPITAL_REGISTRY[activeId];
  }

  // Safe isolated generic fallback - never leaks Daya specific routing (+919606654032)
  return {
    ...GENERIC_HOSPITAL_CONFIG,
    hospitalId: activeId,
  };
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
    const aliases = (config.telephony.aliasPhoneNumbers || []).map((num) =>
      normalizePhoneNumber(num)
    );

    if (clean === mainClean || clean === exoClean || aliases.includes(clean)) {
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
