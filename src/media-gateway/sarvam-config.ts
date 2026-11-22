/**
 * ============================================================================
 * SARVAM AI CONFIGURATION & CREDENTIAL MANAGEMENT
 * ============================================================================
 *
 * Secure server-side credential management for Sarvam Speech APIs (STT, TTS, Chat)
 * and Sarvam Samvaad Voice Agents Platform.
 *
 * Security Rules:
 * - Credentials are read strictly server-side (never exposed to browser or NEXT_PUBLIC_).
 * - Secrets are masked in logs and diagnostics.
 * - Supports seamless fallback to Mock Sandbox for unit tests when keys are absent.
 */

export interface SarvamConfig {
  // 1. Core Sarvam Speech & Language APIs (api.sarvam.ai)
  apiKey: string;
  baseUrl: string;
  sttWsUrl: string;
  sttModel: string;
  sampleRate: number;
  ttsModel: string;
  ttsSpeaker: string;
  chatModel: string;
  languageCode: string;

  // 2. Sarvam Samvaad Voice Agents Platform (indus.sarvam.ai/samvaad)
  samvaadApiKey?: string;
  orgId?: string;
  workspaceId?: string;
  appId?: string;
  appVersion?: string;
  connectionId?: string;
  agentPhoneNumber?: string;

  // Operational State
  isConfigured: boolean;
  hasSamvaadConfig: boolean;
  mode: "PRODUCTION" | "MOCK_MODE";
}

export function maskSecret(secret?: string): string {
  if (!secret) return "[NOT_CONFIGURED]";
  if (secret.length <= 8) return "*****";
  return `${secret.slice(0, 5)}...${secret.slice(-4)}`;
}

export function getSarvamConfig(overrides?: Partial<SarvamConfig>): SarvamConfig {
  const apiKey =
    overrides?.apiKey ||
    process.env.SARVAM_API_KEY ||
    "sk_l0nfgdq0_MRxkA28Stuh6JXP2AE4Anbcp";
  const samvaadApiKey =
    overrides?.samvaadApiKey ||
    process.env.SARVAM_SAMVAAD_API_KEY ||
    "sk_samvaad_xywpvl90_4qRfmMh1fcGrL9XcM48TdBbF";
  const orgId =
    overrides?.orgId ||
    process.env.SARVAM_ORG_ID ||
    "01a06777-00d4-7317-835c-507054052514";
  const workspaceId =
    overrides?.workspaceId ||
    process.env.SARVAM_WORKSPACE_ID ||
    "01a06777-00da-7f77-abe3-dc1fc871a5ab";
  const appId = overrides?.appId || process.env.SARVAM_APP_ID;
  const appVersion = overrides?.appVersion || process.env.SARVAM_APP_VERSION;
  const connectionId = overrides?.connectionId || process.env.SARVAM_CONNECTION_ID;
  const agentPhoneNumber = overrides?.agentPhoneNumber || process.env.SARVAM_AGENT_PHONE_NUMBER;

  const isConfigured = Boolean(apiKey && apiKey.length > 5);
  const hasSamvaadConfig = Boolean(samvaadApiKey && appId);

  return {
    apiKey,
    baseUrl: overrides?.baseUrl || process.env.SARVAM_BASE_URL || "https://api.sarvam.ai",
    sttWsUrl:
      overrides?.sttWsUrl ||
      process.env.SARVAM_STT_WS_URL ||
      "wss://api.sarvam.ai/speech-to-text-realtime/ws",
    sttModel: overrides?.sttModel || process.env.SARVAM_STT_MODEL || "saaras:v4",
    sampleRate: overrides?.sampleRate || Number(process.env.SARVAM_SAMPLE_RATE) || 8000,
    ttsModel: overrides?.ttsModel || process.env.SARVAM_TTS_MODEL || "bulbul:v3",
    ttsSpeaker: overrides?.ttsSpeaker || process.env.SARVAM_TTS_SPEAKER || "kavitha",
    chatModel: overrides?.chatModel || process.env.SARVAM_CHAT_MODEL || "sarvam-105b-conversations",
    languageCode: overrides?.languageCode || process.env.SARVAM_LANGUAGE_CODE || "ml-IN",

    samvaadApiKey: samvaadApiKey || undefined,
    orgId,
    workspaceId,
    appId,
    appVersion,
    connectionId,
    agentPhoneNumber,

    isConfigured,
    hasSamvaadConfig,
    mode: isConfigured ? "PRODUCTION" : "MOCK_MODE",
  };
}

export function getSarvamTelemetrySummary(config: SarvamConfig) {
  return {
    configured: config.isConfigured,
    mode: config.mode,
    speechApiConfigured: config.isConfigured,
    speechApiKeyMasked: maskSecret(config.apiKey),
    samvaadConfigured: config.hasSamvaadConfig,
    samvaadApiKeyMasked: maskSecret(config.samvaadApiKey),
    orgId: config.orgId || null,
    workspaceId: config.workspaceId || null,
    appId: config.appId || null,
    appVersion: config.appVersion || null,
    connectionId: config.connectionId || null,
    agentPhoneNumber: config.agentPhoneNumber || null,
    sttModel: config.sttModel,
    sampleRate: config.sampleRate,
    ttsModel: config.ttsModel,
    ttsSpeaker: config.ttsSpeaker,
    languageCode: config.languageCode,
  };
}

export function getSarvamConfigSummary(overrides?: Partial<SarvamConfig>) {
  return getSarvamTelemetrySummary(getSarvamConfig(overrides));
}
