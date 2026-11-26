/**
 * ============================================================================
 * SMRKOMED RECEPTIONIST ROUTING DECISION API
 * Route: GET & POST /api/v1/receptionist/routing-decision
 * ============================================================================
 *
 * Carrier / IVR Pre-flight Routing Gate:
 * Evaluates whether an incoming call (appointment / general enquiry) should be:
 * 1. DIALED to a human receptionist (if AVAILABLE), atomically locking them into RINGING.
 * 2. OVERFLOWED to Sarvam Core AI voicebot immediately (if receptionist is BUSY, OFFLINE, or on BREAK).
 *
 * Emergency calls are handled separately in Exotel and must NOT use this endpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import { receptionistPresenceService } from "@/lib/services/receptionist-presence-service";
import { aiOverflowService, AiOverflowReason } from "@/lib/services/ai-overflow-service";
import { getHospitalConfig } from "@/lib/config/hospital-config";
import { hospitalRoutingService } from "@/lib/services/hospital-routing-service";
import { dynamicExotelRoutingAdapter } from "@/lib/services/dynamic-exotel-routing-adapter";

export async function GET(request: NextRequest) {
  return handleRoutingDecision(request);
}

export async function POST(request: NextRequest) {
  return handleRoutingDecision(request);
}

async function handleRoutingDecision(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    let callSid =
      searchParams.get("CallSid") ||
      searchParams.get("call_sid") ||
      searchParams.get("callSid") ||
      searchParams.get("Sid") ||
      "";
    let callerNumber =
      searchParams.get("CallFrom") ||
      searchParams.get("From") ||
      searchParams.get("from") ||
      "";
    let dialedNumber =
      searchParams.get("CallTo") ||
      searchParams.get("To") ||
      searchParams.get("to") ||
      "";
    let hospitalId =
      searchParams.get("hospitalId") ||
      request.headers.get("x-hospital-id") ||
      "";
    let routingToken =
      searchParams.get("token") ||
      searchParams.get("routingToken") ||
      request.headers.get("x-smrko-routing-token") ||
      request.headers.get("x-routing-token") ||
      (request.headers.get("authorization")?.startsWith("Bearer ")
        ? request.headers.get("authorization")?.slice(7)
        : undefined) ||
      undefined;

    if (request.method === "POST") {
      try {
        const contentType = request.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const json = await request.json();
          callSid = json.CallSid || json.call_sid || json.callSid || callSid;
          callerNumber = json.CallFrom || json.From || callerNumber;
          dialedNumber = json.CallTo || json.To || dialedNumber;
          hospitalId = json.hospitalId || hospitalId;
          routingToken = json.token || json.routingToken || routingToken;
        } else if (contentType.includes("application/x-www-form-urlencoded")) {
          const formData = await request.formData();
          callSid = (formData.get("CallSid") as string) || callSid;
          callerNumber = (formData.get("CallFrom") as string) || (formData.get("From") as string) || callerNumber;
          dialedNumber = (formData.get("CallTo") as string) || (formData.get("To") as string) || dialedNumber;
          hospitalId = (formData.get("hospitalId") as string) || hospitalId;
          routingToken = (formData.get("token") as string) || (formData.get("routingToken") as string) || routingToken;
        }
      } catch {}
    }

    // Require CallSid for deterministic call-level tracking
    if (!callSid || !callSid.trim()) {
      return NextResponse.json(
        {
          decision: "AI_OVERFLOW",
          action: "CONNECT_VOICEBOT",
          error: "MISSING_CALL_SID",
          message: "CallSid is required for dynamic receptionist routing decision. Defaulting to AI overflow.",
        },
        { status: 400 }
      );
    }

    // Authoritative tenant context verification
    const tenantAuth = await dynamicExotelRoutingAdapter.verifyAndResolveTenantContext({
      callSid,
      callTo: dialedNumber,
      callFrom: callerNumber,
      hospitalId: hospitalId || undefined,
      routingToken,
    });

    if (!tenantAuth.verified) {
      return NextResponse.json(
        {
          decision: "FAIL_CLOSED",
          action: "HANGUP",
          error: "UNTRUSTED_TENANT",
          message: tenantAuth.error || "Tenant verification failed.",
        },
        { status: tenantAuth.statusCode || 403 }
      );
    }

    const resolvedHospitalId = tenantAuth.hospitalId;
    const hospitalConfig = getHospitalConfig(resolvedHospitalId);

    const publishedConfig = await hospitalRoutingService.getPublishedVersion(resolvedHospitalId);
    const ringTimeout =
      publishedConfig?.receptionistRingTimeoutSeconds ||
      hospitalConfig.routing.ringTimeoutSeconds ||
      20;
    const aiOverflowEnabled = publishedConfig?.aiOverflowEnabled !== false;

    // 1. Check receptionist availability and attempt atomic lock
    const assignment = await receptionistPresenceService.assignCallToAvailableReceptionist({
      hospitalId: resolvedHospitalId,
      callSid,
      ringTimeoutSeconds: ringTimeout,
    });

    if (assignment.assigned && assignment.staff) {
      // Human receptionist is AVAILABLE and now in RINGING state
      const destinationNumber =
        assignment.staff.phoneNumber ||
        publishedConfig?.receptionistDestination?.primaryNumber ||
        hospitalConfig.routing.receptionistNumber;

      if (!destinationNumber) {
        return NextResponse.json(
          {
            decision: "FAIL_CLOSED",
            action: "HANGUP",
            error: "NO_RECEPTIONIST_DESTINATION",
            message: `Tenant '${resolvedHospitalId}' has no published receptionist phone number configured.`,
            hospitalId: resolvedHospitalId,
          },
          { status: 422 }
        );
      }

      return NextResponse.json({
        decision: "HUMAN_RECEPTIONIST",
        action: "DIAL",
        fetch_after_attempt: false,
        destination: {
          numbers: [destinationNumber],
        },
        outgoing_phone_number: dialedNumber || "08047291658",
        max_ringing_duration: ringTimeout,
        staff: {
          userId: assignment.staff.userId,
          staffName: assignment.staff.staffName,
          extension: assignment.staff.extension,
          status: assignment.staff.status,
        },
        callSid,
        hospitalId: resolvedHospitalId,
      });
    }

    // 2. No receptionist is currently available -> Check if AI overflow is disabled
    if (!aiOverflowEnabled) {
      const fallbackNumber =
        publishedConfig?.humanFallbackDestination?.primaryNumber ||
        publishedConfig?.receptionistDestination?.primaryNumber ||
        hospitalConfig.routing.receptionistNumber;

      return NextResponse.json({
        decision: "HUMAN_FALLBACK",
        action: "DIAL",
        fetch_after_attempt: false,
        destination: {
          numbers: [fallbackNumber || ""],
        },
        outgoing_phone_number: dialedNumber || "08047291658",
        max_ringing_duration: ringTimeout,
        reason: "AI_OVERFLOW_DISABLED_ROUTING_TO_FALLBACK",
        callSid,
        hospitalId: resolvedHospitalId,
      });
    }

    // Map overflow reason
    let overflowReason: AiOverflowReason = "RECEPTIONIST_BUSY";
    if (assignment.reason === "ALL_OFFLINE") {
      overflowReason = "RECEPTIONIST_OFFLINE";
    } else if (assignment.reason === "ALL_ON_BREAK") {
      overflowReason = "RECEPTIONIST_BREAK";
    } else if (assignment.reason === "NO_STAFF_CONFIGURED") {
      overflowReason = "NO_STAFF_CONFIGURED";
    } else if (assignment.reason === "CONCURRENCY_CONFLICT") {
      overflowReason = "CONCURRENCY_CONFLICT";
    }

    // Determine explicit conversational engine mode
    const engineUsed =
      process.env.CONVERSATION_ENGINE_MODE === "SARVAM_VOICE_AGENTS"
        ? "SARVAM_VOICE_AGENTS"
        : "SARVAM_CORE_CUSTOM_FALLBACK";

    // Record the overflow event for analytics & contextual greeting
    await aiOverflowService.recordOverflow({
      hospitalId: resolvedHospitalId,
      callSid,
      callerNumber: callerNumber || "UNKNOWN",
      dialedNumber: dialedNumber || undefined,
      reason: overflowReason,
      handledByAi: true,
      engineUsed,
      context: {
        rawAssignmentReason: assignment.reason,
        engineSelected: engineUsed,
      },
    });

    const targetApplet = dynamicExotelRoutingAdapter.getTargetVoicebotApplet();
    const voicebotUrl = `wss://dayahospital-production-467a7d31.up.railway.app/exotel/voicebot?overflow=true&reason=${encodeURIComponent(
      overflowReason.toLowerCase()
    )}&target_applet=${targetApplet}`;

    return NextResponse.json({
      decision: "AI_OVERFLOW",
      action: "CONNECT_VOICEBOT",
      reason: overflowReason,
      engine: engineUsed,
      targetApplet,
      voicebotUrl,
      callSid,
      hospitalId: resolvedHospitalId,
    });
  } catch (error) {
    console.error("Routing decision error:", error);
    return NextResponse.json(
      {
        decision: "AI_OVERFLOW",
        action: "CONNECT_VOICEBOT",
        error: "INTERNAL_ERROR",
        message: "Unexpected error during routing decision; safe AI overflow active.",
      },
      { status: 500 }
    );
  }
}
