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

    if (request.method === "POST") {
      try {
        const contentType = request.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const json = await request.json();
          callSid = json.CallSid || json.call_sid || json.callSid || callSid;
          callerNumber = json.CallFrom || json.From || callerNumber;
          dialedNumber = json.CallTo || json.To || dialedNumber;
          hospitalId = json.hospitalId || hospitalId;
        } else if (contentType.includes("application/x-www-form-urlencoded")) {
          const formData = await request.formData();
          callSid = (formData.get("CallSid") as string) || callSid;
          callerNumber = (formData.get("CallFrom") as string) || (formData.get("From") as string) || callerNumber;
          dialedNumber = (formData.get("CallTo") as string) || (formData.get("To") as string) || dialedNumber;
          hospitalId = (formData.get("hospitalId") as string) || hospitalId;
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

    const hospitalConfig = getHospitalConfig(hospitalId || undefined);
    const resolvedHospitalId = hospitalConfig.hospitalId;

    // 1. Check receptionist availability and attempt atomic lock
    const assignment = await receptionistPresenceService.assignCallToAvailableReceptionist({
      hospitalId: resolvedHospitalId,
      callSid,
      ringTimeoutSeconds: 20,
    });

    if (assignment.assigned && assignment.staff) {
      // Human receptionist is AVAILABLE and now in RINGING state
      const destinationNumber =
        assignment.staff.phoneNumber ||
        hospitalConfig.routing.receptionistNumber ||
        "+919606654032";

      return NextResponse.json({
        decision: "HUMAN_RECEPTIONIST",
        action: "DIAL",
        fetch_after_attempt: false,
        destination: {
          numbers: [destinationNumber],
        },
        outgoing_phone_number: "08047291658",
        max_ringing_duration: 20,
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

    // 2. No receptionist is currently available -> Map reason and overflow to AI
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

    // Record the overflow event for analytics & contextual greeting
    await aiOverflowService.recordOverflow({
      hospitalId: resolvedHospitalId,
      callSid,
      callerNumber: callerNumber || "UNKNOWN",
      dialedNumber: dialedNumber || undefined,
      reason: overflowReason,
      handledByAi: true,
      context: {
        rawAssignmentReason: assignment.reason,
      },
    });

    const voicebotUrl = `wss://dayahospital-production-467a7d31.up.railway.app/exotel/voicebot?overflow=true&reason=${encodeURIComponent(
      overflowReason.toLowerCase()
    )}`;

    return NextResponse.json({
      decision: "AI_OVERFLOW",
      action: "CONNECT_VOICEBOT",
      reason: overflowReason,
      targetApplet: "1393239",
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
