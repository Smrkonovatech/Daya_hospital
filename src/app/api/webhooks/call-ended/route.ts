import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import { integrations } from "@/lib/integrations";
import { systemRepository } from "@/lib/repositories/system-repository";
import { maskPhoneNumber } from "@/lib/utils";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let rawBody = "";

  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: "Failed to read request body" }, { status: 400 });
  }

  const signature = request.headers.get("x-sarvam-signature") || "";
  const eventId =
    request.headers.get("x-daya-event-id") ||
    request.headers.get("idempotency-key") ||
    `call_ended_${Date.now()}`;

  // 1. Webhook Signature Verification
  const sarvamAdapter = integrations.getSarvamAdapter();
  if (signature) {
    const isValid = sarvamAdapter.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid webhook authentication signature", status: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
  } else if (process.env.SARVAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing webhook signature" }, { status: 401 });
  }

  // 2. Duplicate Detection
  const existing = await systemRepository.getWebhookByEventId(eventId);
  if (existing) {
    return NextResponse.json({
      received: true,
      status: "ALREADY_PROCESSED_IDEMPOTENT",
      eventId,
    });
  }

  // 3. Parse JSON safely
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON webhook payload" }, { status: 400 });
  }

  const callId = (payload.callId || payload.sessionId || payload.interactionId || "call_received") as string;
  const rawCaller = (payload.callerNumber || "") as string;
  const maskedCaller = rawCaller ? maskPhoneNumber(rawCaller) : undefined;

  // 4. Missing fields recovery: never assume transcript or recording is included
  let transcriptTurnCount = Array.isArray(payload.transcript) ? payload.transcript.length : 0;
  let recordingAvailable = Boolean(payload.recording);

  if (transcriptTurnCount === 0 && callId !== "call_received") {
    try {
      const fetched = await sarvamAdapter.getTranscript(callId);
      transcriptTurnCount = fetched.length;
    } catch {
      // Background failure safe
    }
  }

  if (!recordingAvailable && callId !== "call_received") {
    try {
      const fetchedRec = await sarvamAdapter.getRecordingUrl(callId);
      recordingAvailable = Boolean(fetchedRec?.url);
    } catch {
      // Safe
    }
  }

  // 5. Audit & Webhook record persistence
  const payloadHash = crypto.createHash("sha256").update(rawBody).digest("hex");
  await systemRepository.recordWebhook({
    provider: "sarvam_ai",
    eventType: "call_ended",
    externalEventId: eventId,
    payloadHash,
    status: "PROCESSED",
  });

  await systemRepository.recordAuditLog({
    entityType: "CALL_WEBHOOK",
    entityId: callId,
    action: "CALL_ENDED_PROCESSED",
    performedBy: "Sarvam Voice Service",
    details: `Call ended webhook processed for ${callId}. Caller: ${maskedCaller || "Hidden"}. Turns: ${transcriptTurnCount}. Rec: ${recordingAvailable}`,
  });

  return NextResponse.json({
    received: true,
    status: "EVENT_PROCESSED_SAFELY",
    timestamp: new Date().toISOString(),
    callId,
    supplementalDataFetched: {
      transcriptTurnCount,
      recordingAvailable,
    },
    latencyMs: Date.now() - startTime,
  });
}
