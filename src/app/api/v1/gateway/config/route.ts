import { NextRequest, NextResponse } from "next/server";
import { configurationService } from "@/lib/services/configuration-service";
import { agentService } from "@/lib/services/agent-service";

export async function GET(request: NextRequest) {
  // 1. Authenticate Trusted Media Gateway Service
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : "";
  const apiKeyHeader = request.headers.get("x-gateway-secret");

  const expectedSecret =
    process.env.VOICE_GATEWAY_AUTH_SECRET ||
    process.env.SMRKOMED_API_KEY ||
    "daya-gateway-internal-auth-secret-2026";

  const isAuthorized =
    (token && token === expectedSecret) ||
    (apiKeyHeader && apiKeyHeader === expectedSecret) ||
    process.env.NODE_ENV === "test";

  if (!isAuthorized) {
    return NextResponse.json(
      { error: "Unauthorized: Valid gateway secret required to fetch runtime voice configuration." },
      { status: 401 }
    );
  }

  const hospitalId = request.nextUrl.searchParams.get("hospitalId") || "hosp_daya_thrissur";

  try {
    // 2. Retrieve Active Published Hospital Configuration
    const config = await configurationService.getActivePublishedConfig(hospitalId);

    // 3. Retrieve Active Published Agents for Hospital
    const agents = await agentService.getAgentsByHospital(hospitalId);
    const publishedAgents = agents.filter((a) => a.status === "PUBLISHED" || a.isDefault);

    const defaultAgent = publishedAgents.find((a) => a.isDefault) || publishedAgents[0];

    return NextResponse.json(
      {
        success: true,
        hospitalId,
        telephony: {
          provider: config.telephonyProvider,
          accountSid: config.exotelAccountSid,
          subdomain: config.exotelSubdomain,
          defaultExoPhone: config.exotelDefaultExoPhone,
          defaultAppId: config.exotelDefaultAppId,
          incomingVirtualNumbers: config.incomingVirtualNumbers,
          transferDestinations: config.transferDestinations,
          emergencyDestinations: config.emergencyDestinations,
          maxCallDurationSeconds: config.maxCallDurationSeconds,
        },
        ai: {
          enabled: config.aiEnabled,
          defaultAgentId: defaultAgent?.id,
          defaultSttModel: defaultAgent?.sttModel || config.defaultSttModel,
          defaultLlmModel: defaultAgent?.llmModel || config.defaultLlmModel,
          defaultTtsModel: defaultAgent?.ttsModel || config.defaultTtsModel,
          defaultSpeaker: defaultAgent?.speaker || config.defaultSpeaker,
          defaultSpeakingPace: defaultAgent?.speakingPace || config.defaultSpeakingPace,
          silenceTimeoutMs: defaultAgent?.silenceTimeoutMs || config.aiSilenceTimeoutMs,
          greetingMalayalam: defaultAgent?.greetingMalayalam,
          greetingEnglish: defaultAgent?.greetingEnglish,
          systemPrompt: defaultAgent?.systemPrompt,
        },
        business: {
          businessHours: config.businessHours,
          afterHoursBehavior: config.afterHoursBehavior,
          emergencyEscalationPolicy: config.emergencyEscalationPolicy,
        },
        activeAgents: publishedAgents.map((a) => ({
          id: a.id,
          name: a.name,
          purpose: a.purpose,
          sttModel: a.sttModel,
          llmModel: a.llmModel,
          ttsModel: a.ttsModel,
          speaker: a.speaker,
          speakingPace: a.speakingPace,
          version: a.currentVersion,
        })),
        retrievedAt: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, max-age=15, stale-while-revalidate=60",
        },
      }
    );
  } catch (err: unknown) {
    console.error("[GatewayConfig] Failed to fetch active configuration:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error retrieving runtime voice configuration" },
      { status: 500 }
    );
  }
}
