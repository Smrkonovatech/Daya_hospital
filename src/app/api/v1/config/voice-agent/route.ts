/**
 * ============================================================================
 * SARVAM VOICE AGENTS CONFIGURATION REST API (PHASE 10)
 * ============================================================================
 *
 * Provides GET and PUT endpoints for managing the Sarvam Voice Agents engine,
 * toggling between SARVAM_CORE_CUSTOM and SARVAM_VOICE_AGENTS, and managing
 * workspace/agent identifiers without leaking credentials.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSarvamVoiceAgentConfig, getVoiceAgentPublicStatus } from "@/lib/integrations/sarvam/voice-agent-config";
import { sarvamVoiceAgentClient } from "@/lib/integrations/sarvam/voice-agent-client";
import { DAYA_PILOT_VOICE_AGENT_DEPLOYMENT } from "@/lib/integrations/sarvam/daya-agent-config";

// In-memory runtime override for instant rollback/mode switching
let runtimeEngineMode = getSarvamVoiceAgentConfig().engineMode;

export async function GET() {
  const publicStatus = getVoiceAgentPublicStatus();
  const health = await sarvamVoiceAgentClient.healthCheck();

  return NextResponse.json({
    success: true,
    data: {
      ...publicStatus,
      engineMode: runtimeEngineMode,
      health,
      pilotDeployment: {
        id: DAYA_PILOT_VOICE_AGENT_DEPLOYMENT.id,
        name: DAYA_PILOT_VOICE_AGENT_DEPLOYMENT.name,
        primaryLanguage: DAYA_PILOT_VOICE_AGENT_DEPLOYMENT.primaryLanguage,
        secondaryLanguages: DAYA_PILOT_VOICE_AGENT_DEPLOYMENT.secondaryLanguages,
        voiceId: DAYA_PILOT_VOICE_AGENT_DEPLOYMENT.voiceId,
        toolsCount: DAYA_PILOT_VOICE_AGENT_DEPLOYMENT.tools.length,
        status: DAYA_PILOT_VOICE_AGENT_DEPLOYMENT.status,
      },
    },
  });
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { engineMode } = body;

    if (engineMode && ["SARVAM_CORE_CUSTOM", "SARVAM_VOICE_AGENTS"].includes(engineMode)) {
      runtimeEngineMode = engineMode;
      console.log(`[Config:VoiceAgent] Switched conversational engine mode to '${engineMode}'`);
    }

    return NextResponse.json({
      success: true,
      message: `Conversation engine mode successfully updated to ${runtimeEngineMode}`,
      engineMode: runtimeEngineMode,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to update engine configuration" },
      { status: 500 }
    );
  }
}

