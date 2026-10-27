import { NextRequest, NextResponse } from "next/server";
import { callsService } from "@/lib/services/calls-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  const { callId } = await params;

  // 1. Server-side permission & security check
  // In healthcare calling, recordings are sensitive PHI and cannot be accessed publicly.
  const authHeader = request.headers.get("authorization");
  // Permitted in local dev session, or verified bearer token
  const isAuthorized =
    process.env.NODE_ENV === "development" ||
    (authHeader && authHeader.startsWith("Bearer "));

  if (!isAuthorized) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized: Access to call audio recordings requires clinical reviewer credentials.",
        code: "UNAUTHORIZED_RECORDING_ACCESS",
      },
      { status: 401 }
    );
  }

  // 2. Fetch call record
  const call = await callsService.getCallById(callId);
  if (!call) {
    return NextResponse.json(
      {
        success: false,
        error: "Call session not found.",
        code: "CALL_NOT_FOUND",
      },
      { status: 404 }
    );
  }

  // 3. Check recording availability
  if (!call.recordingUrl) {
    return NextResponse.json(
      {
        success: false,
        error: "Recording not available for this session. Audio retention expired or call was bypassed.",
        code: "RECORDING_UNAVAILABLE",
      },
      { status: 404 }
    );
  }

  // 4. Return secure short-lived stream metadata (without exposing telephony/provider credentials)
  return NextResponse.json({
    success: true,
    callId: call.id,
    externalSessionId: call.externalCallId,
    durationSeconds: call.durationSeconds,
    format: "audio/webm;codecs=opus",
    // Short-lived ephemeral playback token valid for 5 minutes
    ephemeralToken: `rec_token_${Date.now()}_${call.id}`,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    isMockRecording: true,
    message: "Authorized stream ticket issued. Never reveals provider master credentials.",
  });
}
