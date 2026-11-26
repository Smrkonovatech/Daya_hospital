/**
 * ============================================================================
 * SARVAM VOICE AGENTS CONFIGURATION MODULE (PHASE 10)
 * ============================================================================
 *
 * Reads server-side environment variables for Sarvam Voice Agents / Samvaad.
 * Strictly keeps Voice Agents credentials separate from the Core API key.
 * Never exposes API keys in client bundles, public responses, or logs.
 */

import { SarvamVoiceAgentConfig, ConversationEngineMode } from "./voice-agent-types";

// Default Workspace & Organization approved in Phase 10
export const DEFAULT_SARVAM_WORKSPACE_ID = "01a06777-00da-7f77-abe3-dc1fc871a5ab";
export const DEFAULT_SARVAM_ORG_ID = "01a06777-00d4-7317-835c-507054052514";
export const DEFAULT_SARVAM_AGENT_ID = "agent_daya_malayalam_reception_v1";

// Live Sarvam Platform Identifiers verified via API in Phase 10.1
export const ACTUAL_SARVAM_APP_ID = "smrkomed-8401f738-b749";
export const ACTUAL_SARVAM_DEPLOYMENT_ID = "Inbound-3b5df8df-f098";
export const ACTUAL_SARVAM_PHONE_NUMBER = "+918064265889";
export const ACTUAL_SARVAM_CARRIER = "vobiz";
export const SARVAM_EXOTEL_CHANNEL_RUNTIME_URL = "https://apps.sarvam.ai/api/app-runtime/channels/exotel";

export function getSarvamVoiceAgentConfig(): SarvamVoiceAgentConfig {
  const apiKey = process.env.SARVAM_VOICE_AGENT_API_KEY || "";
  const workspaceId =
    process.env.SARVAM_VOICE_AGENT_WORKSPACE_ID || DEFAULT_SARVAM_WORKSPACE_ID;
  const orgId =
    process.env.SARVAM_VOICE_AGENT_ORG_ID || DEFAULT_SARVAM_ORG_ID;
  const agentId =
    process.env.SARVAM_VOICE_AGENT_ID || DEFAULT_SARVAM_AGENT_ID;

  const rawEngineMode = process.env.CONVERSATION_ENGINE_MODE || "SARVAM_CORE_CUSTOM";
  const engineMode: ConversationEngineMode =
    rawEngineMode === "SARVAM_VOICE_AGENTS" ? "SARVAM_VOICE_AGENTS" : "SARVAM_CORE_CUSTOM";

  return {
    apiKey,
    workspaceId,
    orgId,
    agentId,
    engineMode,
    appAuthoringBaseUrl:
      process.env.SARVAM_VOICE_AGENT_APP_URL || "https://apps.sarvam.ai/api/app-authoring",
    analyticsBaseUrl:
      process.env.SARVAM_VOICE_AGENT_ANALYTICS_URL || "https://apps.sarvam.ai/api/analytics",
    schedulingBaseUrl:
      process.env.SARVAM_VOICE_AGENT_SCHEDULING_URL || "https://apps.sarvam.ai/api/scheduling",
    outboundsBaseUrl:
      process.env.SARVAM_VOICE_AGENT_OUTBOUNDS_URL || "https://apps.sarvam.ai/api/outbounds",
    webhookSecret:
      process.env.SARVAM_VOICE_AGENT_WEBHOOK_SECRET || process.env.SARVAM_WEBHOOK_SECRET || "",
  };
}

/**
 * Returns safe public status of the Voice Agents engine for Admin UI without exposing secrets.
 */
export function getVoiceAgentPublicStatus() {
  const config = getSarvamVoiceAgentConfig();
  return {
    engineMode: config.engineMode,
    workspaceId: config.workspaceId,
    orgId: config.orgId,
    agentId: config.agentId,
    isApiKeyConfigured: Boolean(config.apiKey && config.apiKey.length > 5),
    isWorkspaceConfigured: Boolean(config.workspaceId),
    exotelByotConfigured: true,
    exotelByotTransferSupport: "REQUIRES_SARVAM_SUPPORT_ENABLEMENT",
  };
}

export const DEFAULT_EXOTEL_BYOT_CONFIG = {
  accountSid: "smrkonova1",
  apiKey: process.env.EXOTEL_API_KEY || "",
  apiToken: process.env.EXOTEL_API_TOKEN || "",
  baseUrl: "api.exotel.com",
  allocatedExoPhone: "08047291658",
  voicebotAppletId: "1393239",
  supportsNativeTransfer: false,
  transferNotice: "Exotel BYOT call transfer requires Sarvam support enablement or downstream Connect Applet chaining",
};

