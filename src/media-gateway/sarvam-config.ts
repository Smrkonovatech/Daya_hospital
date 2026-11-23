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
  ttsPace: number;
  chatModel: string;
  languageCode: string;
  sttSilenceTimeoutMs: number;

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

export function maskSecret(secret?: string, redactCompletely = true): string {
  if (!secret) return "[NOT_CONFIGURED]";
  if (redactCompletely) return "[CONFIGURED]";
  if (secret.length <= 8) return "*****";
  return `${secret.slice(0, 5)}...${secret.slice(-4)}`;
}

export function getSarvamConfig(overrides?: Partial<SarvamConfig>): SarvamConfig {
  const apiKey =
    overrides?.apiKey !== undefined
      ? overrides.apiKey
      : process.env.SARVAM_API_KEY || "";
  const samvaadApiKey =
    overrides?.samvaadApiKey !== undefined
      ? overrides.samvaadApiKey
      : process.env.SARVAM_SAMVAAD_API_KEY || "";
  const orgId =
    overrides?.orgId ||
    process.env.SARVAM_ORG_ID ||
    "";
  const workspaceId =
    overrides?.workspaceId ||
    process.env.SARVAM_WORKSPACE_ID ||
    "";
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
    ttsPace: overrides?.ttsPace || Number(process.env.SARVAM_TTS_PACE) || 1.15,
    chatModel: overrides?.chatModel || process.env.SARVAM_CHAT_MODEL || "sarvam-105b-conversations",
    languageCode: overrides?.languageCode || process.env.SARVAM_LANGUAGE_CODE || "ml-IN",
    sttSilenceTimeoutMs:
      overrides?.sttSilenceTimeoutMs ||
      Number(process.env.SARVAM_STT_SILENCE_TIMEOUT_MS) ||
      400,

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

export type GatewayReadinessState = "READY" | "DEGRADED" | "NOT_READY";

export interface GatewayReadinessInfo {
  state: GatewayReadinessState;
  reason: string;
  environmentMode: "DEVELOPMENT_TESTING" | "PRODUCTION";
  sarvamConfigured: boolean;
  sarvamMode: "PRODUCTION" | "MOCK_MODE";
  persistenceStatus: "HEALTHY" | "DEGRADED";
  databaseConfigured: boolean;
  databaseConnected: boolean;
  unpersistedSessionCount: number;
}

/**
 * Evaluates the full production readiness of the media gateway runtime.
 * Strict rules:
 * - NOT_READY: Sarvam AI is not configured. Live patient calls cannot proceed in MOCK_MODE.
 * - DEGRADED: Sarvam AI is configured, but PostgreSQL database is missing, disconnected, or degraded.
 *             Calls can proceed with non-durable in-memory fallback persistence buffering.
 * - READY: Both Sarvam AI and PostgreSQL persistence are fully configured and connected.
 */
export function evaluateGatewayReadiness(
  sarvamConfig: SarvamConfig,
  persistenceHealth: { status: "HEALTHY" | "DEGRADED"; unpersistedSessionCount: number },
  databaseConnected = Boolean(process.env.DATABASE_URL)
): GatewayReadinessInfo {
  const isDevelopmentMode = process.env.DEVELOPMENT_MODE !== "false";
  const environmentMode = isDevelopmentMode ? "DEVELOPMENT_TESTING" : "PRODUCTION";
  const isDatabaseConfigured = Boolean(process.env.DATABASE_URL);

  if (!sarvamConfig.isConfigured) {
    return {
      state: "NOT_READY",
      reason: isDevelopmentMode
        ? "Sarvam AI credentials not configured in development environment. Voice synthesis & STT disabled."
        : "CRITICAL_BLOCKED: Sarvam AI credentials not configured in production environment. Live telephony calls in MOCK_MODE are strictly prohibited.",
      environmentMode,
      sarvamConfigured: false,
      sarvamMode: "MOCK_MODE",
      persistenceStatus: persistenceHealth.status,
      databaseConfigured: isDatabaseConfigured,
      databaseConnected,
      unpersistedSessionCount: persistenceHealth.unpersistedSessionCount,
    };
  }

  if (persistenceHealth.status === "DEGRADED" || !databaseConnected) {
    return {
      state: "DEGRADED",
      reason:
        "Sarvam AI operational (live speech STT & TTS ready). PostgreSQL database disconnected or degraded; execution logs buffered in non-durable in-memory fallback queue. In-memory buffering is volatile and will not survive process restarts.",
      environmentMode,
      sarvamConfigured: true,
      sarvamMode: "PRODUCTION",
      persistenceStatus: "DEGRADED",
      databaseConfigured: isDatabaseConfigured,
      databaseConnected,
      unpersistedSessionCount: persistenceHealth.unpersistedSessionCount,
    };
  }

  return {
    state: "READY",
    reason: isDevelopmentMode
      ? "Development testing gateway operational. Real Sarvam AI voice and Neon PostgreSQL persistence active. Operating in development sandbox mode (demo appointments; no real patient calls)."
      : "Production media gateway fully operational. Sarvam AI real-time voice and PostgreSQL persistence are active.",
    environmentMode,
    sarvamConfigured: true,
    sarvamMode: "PRODUCTION",
    persistenceStatus: "HEALTHY",
    databaseConfigured: true,
    databaseConnected: true,
    unpersistedSessionCount: persistenceHealth.unpersistedSessionCount,
  };
}

export function getSarvamTelemetrySummary(config: SarvamConfig) {
  return {
    configured: config.isConfigured,
    mode: config.mode,
    speechApiConfigured: config.isConfigured,
    speechApiKeyMasked: maskSecret(config.apiKey, true),
    samvaadConfigured: config.hasSamvaadConfig,
    samvaadApiKeyMasked: maskSecret(config.samvaadApiKey, true),
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
    ttsPace: config.ttsPace,
    languageCode: config.languageCode,
    sttSilenceTimeoutMs: config.sttSilenceTimeoutMs,
  };
}

export function getSarvamConfigSummary(overrides?: Partial<SarvamConfig>) {
  return getSarvamTelemetrySummary(getSarvamConfig(overrides));
}
