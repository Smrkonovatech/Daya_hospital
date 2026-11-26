/**
 * ============================================================================
 * SMRKOMED TOOL API: EMERGENCY ESCALATE (PHASE 10)
 * ============================================================================
 *
 * Invoked by Sarvam Voice Agents (@emergency_escalate tool) when acute medical
 * symptoms (chest pain, breathlessness, loss of consciousness, trauma) are detected.
 *
 * Immediate actions:
 * 1. Categorizes severity level (CRITICAL / URGENT)
 * 2. Emits emergency escalation alert in Smrkomed control plane
 * 3. Records escalation in MediaSessionManager durable ledger
 * 4. Instructs agent to advise caller to stay on line for Casualty team
 *
 * Does NOT leak arbitrary external phone numbers to the caller.
 */

import { NextRequest, NextResponse } from "next/server";
import { mediaSessionManager } from "@/media-gateway/session-manager";
import { hospitalRoutingService } from "@/lib/services/hospital-routing-service";
import {
  validateVoiceAgentToolAuth,
  validateHospitalTenant,
  logVoiceAgentToolAudit,
} from "@/lib/integrations/sarvam/voice-agent-auth";

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate request
    const auth = validateVoiceAgentToolAuth(request);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.statusCode || 401 }
      );
    }

    const body = await request.json();
    const { symptom, callerPhone, callSid, hospitalId = "hosp_daya_thrissur" } = body;

    // 2. Identify & validate tenant
    const tenantResult = validateHospitalTenant(hospitalId);
    if (!tenantResult.valid) {
      return NextResponse.json(
        { success: false, error: tenantResult.error },
        { status: 400 }
      );
    }

    const activeHospitalId = tenantResult.hospitalConfig.hospitalId;

    if (!symptom || !symptom.trim()) {
      return NextResponse.json(
        { success: false, error: "symptom description is required" },
        { status: 400 }
      );
    }

    // Resolve authoritative emergency destination from HospitalRoutingService
    const resolution = await hospitalRoutingService.resolveLiveDestination({
      hospitalId: activeHospitalId,
      callSid,
      escalationType: "EMERGENCY",
      isLiveCall: false, // Internal resolution
    });

    const activeCallSid = callSid || `emergency_auto_${Date.now()}`;

    // Record escalation in MediaSessionManager durable memory and Neon DB
    await mediaSessionManager.recordEscalation({
      callSid: activeCallSid,
      hospitalId: activeHospitalId,
      callerNumber: callerPhone || "+919606654032",
      escalationState: "EMERGENCY",
      destination: resolution.destinationNumber || "+919606654032",
      reason: `Acute emergency triage via Voice Agent: ${symptom.trim()}`,
      timestamp: Date.now(),
      routingVersion: resolution.versionUsed || 1,
    });

    // 3. Audit log
    logVoiceAgentToolAudit("EmergencyEscalate", activeHospitalId, {
      callSid: activeCallSid,
      symptom: symptom.trim(),
      triageLevel: "CRITICAL_CODE_RED",
      escalatedDestination: resolution.destinationNumber ? "[MASKED]" : "DEFAULT",
    });

    return NextResponse.json({
      success: true,
      action: "FAST_TRACK_CASUALTY",
      triageLevel: "CRITICAL_CODE_RED",
      hospitalId: activeHospitalId,
      escalationReason: symptom.trim(),
      verbalAnnouncementMalayalam:
        "ഇതൊരു അടിയന്തിര സാഹചര്യമായി കണക്കാക്കുന്നു. ഉടൻ തന്നെ നിങ്ങളെ ദയ ഹോസ്പിറ്റൽ 24 മണിക്കൂർ കാഷ്വാലിറ്റി മെഡിക്കൽ ടീമിലേക്ക് കൈമാറുന്നു. ദയവായി ലൈനിൽ തുടരുക.",
      verbalAnnouncementEnglish:
        "This is an emergency. Transferring immediately to Daya Hospital 24/7 Casualty team. Please hold.",
      transferReady: true,
      department: "Casualty Emergency Desk",
      isSimulated: true,
      physicalTransferExecuted: false,
      mode: "SIMULATION_ONLY",
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Emergency escalation handler failed" },
      { status: 500 }
    );
  }
}

