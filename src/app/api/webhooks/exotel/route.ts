import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import { exotelAdapter } from "@/lib/integrations";
import { callsService } from "@/lib/services/calls-service";
import { systemRepository } from "@/lib/repositories/system-repository";
import { CallStatus } from "@/types";

export async function POST(request: NextRequest) {
  let rawBody = "";
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: "Failed to read request body" }, { status: 400 });
  }

  // 1. Signature & Token Verification
  const signature =
    request.headers.get("x-exotel-signature") ||
    request.headers.get("x-signature") ||
    request.nextUrl.searchParams.get("token") ||
    "";

  if (signature) {
    const isVerified = exotelAdapter.verifyWebhookSignature(rawBody, signature);
    if (!isVerified) {
      return NextResponse.json(
        { error: "Invalid webhook authentication signature", status: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
  } else if (process.env.NODE_ENV === "production" && process.env.EXOTEL_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Missing required webhook authentication signature", status: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  // 2. Parse payload (supports both JSON and form-urlencoded format)
  let payload: Record<string, unknown> = {};
  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      payload = JSON.parse(rawBody);
    } else {
      const searchParams = new URLSearchParams(rawBody);
      for (const [key, value] of searchParams.entries()) {
        payload[key] = value;
      }
    }
  } catch {
    return NextResponse.json(
      { error: "Malformed payload in webhook request", status: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  // 3. Normalize payload via Exotel Telephony Adapter
  const normalized = exotelAdapter.parseWebhookPayload(payload);
  if (!normalized) {
    return NextResponse.json(
      { error: "Unrecognized Exotel webhook payload format", status: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  const callSid = normalized.call_id;
  const eventId =
    request.headers.get("x-exotel-event-id") ||
    (payload.EventId ? String(payload.EventId) : null) ||
    normalized.event_id ||
    `exo_webhook_${callSid}_${Date.now()}`;

  // 4. Duplicate Event Detection & Idempotency
  const payloadHash = crypto.createHash("sha256").update(rawBody).digest("hex");
  const existingRecord = await systemRepository.getWebhookByEventId(eventId);

  if (existingRecord) {
    return NextResponse.json({
      received: true,
      status: "ALREADY_PROCESSED_IDEMPOTENT",
      eventId,
      callSid,
      message: "Duplicate Exotel event acknowledged without re-execution.",
    });
  }

  // 5. Update Call Record in Ledger
  if ("state" in normalized) {
    let callStatus: CallStatus = "ANSWERED";
    if (normalized.state === "COMPLETED") callStatus = "ANSWERED";
    else if (normalized.state === "BUSY") callStatus = "BUSY";
    else if (normalized.state === "MISSED" || normalized.state === "NO_ANSWER") callStatus = "MISSED";
    else if (normalized.state === "FAILED") callStatus = "FAILED";
    else if (normalized.state === "TRANSFERRED_TO_STAFF") callStatus = "TRANSFERRED";

    await callsService.updateCallStatusByExternalId(callSid, {
      callStatus,
      durationSeconds: normalized.duration_seconds,
      recordingUrl: normalized.recording_url,
      recordingSid: normalized.recording_sid,
      failureReason: normalized.failure_reason,
      endTime: normalized.timestamp,
    });
  }

  // 6. Record Webhook and Audit Log
  await systemRepository.recordWebhook({
    provider: "exotel",
    eventType: "state" in normalized ? "call_status_update" : "inbound_call",
    externalEventId: eventId,
    idempotencyKey: callSid,
    payloadHash,
    status: "PROCESSED",
  });

  await systemRepository.recordAuditLog({
    entityType: "CALL",
    entityId: callSid,
    action: "EXOTEL_WEBHOOK_PROCESSED",
    performedBy: "Exotel Telephony Cloud",
    details: `Processed Exotel callback for Call SID ${callSid}. Event: ${"state" in normalized ? normalized.state : "INBOUND"}`,
  });

  return NextResponse.json({
    received: true,
    callSid,
    hospitalId: normalized.hospital_id,
    status: "state" in normalized ? normalized.state : "PROCESSED",
    timestamp: new Date().toISOString(),
  });
}

// Some Exotel flow applets ping GET on StatusCallback
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const payload: Record<string, unknown> = {};
  for (const [key, value] of searchParams.entries()) {
    payload[key] = value;
  }

  const normalized = exotelAdapter.parseWebhookPayload(payload);
  if (!normalized) {
    return NextResponse.json({ status: "OK", message: "Exotel webhook ping acknowledged" });
  }

  return NextResponse.json({
    received: true,
    callSid: normalized.call_id,
    hospitalId: normalized.hospital_id,
  });
}
