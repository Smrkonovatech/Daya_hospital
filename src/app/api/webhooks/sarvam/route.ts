import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import { integrations } from "@/lib/integrations";
import { systemRepository } from "@/lib/repositories/system-repository";
import { actionsService } from "@/lib/services/actions-service";
import { maskPhoneNumber } from "@/lib/utils";
import { SarvamWebhookPayload } from "@/lib/integrations/types";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let rawBody = "";

  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: "Failed to read request body" }, { status: 400 });
  }

  const signature =
    request.headers.get("x-sarvam-signature") ||
    request.headers.get("x-signature") ||
    "";
  const eventIdHeader =
    request.headers.get("x-daya-event-id") ||
    request.headers.get("x-event-id") ||
    "";

  // 1. Authenticate webhook signature via Sarvam adapter
  const sarvamAdapter = integrations.getSarvamAdapter();
  const isValidSignature = sarvamAdapter.verifyWebhookSignature(rawBody, signature);

  if (!isValidSignature) {
    return NextResponse.json(
      { error: "Invalid webhook authentication signature", status: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  // 2. Parse and validate JSON schema safely
  let payload: Partial<SarvamWebhookPayload> = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "Malformed JSON payload in webhook request", status: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  const eventId = payload.eventId || eventIdHeader || `evt_${Date.now()}`;
  const interactionId = payload.interactionId || (payload as Record<string, unknown>).callId as string || "unknown_interaction";
  const eventType = payload.eventType || "call_ended";

  // 3. Duplicate event detection
  const payloadHash = crypto.createHash("sha256").update(rawBody).digest("hex");
  const existingRecord = await systemRepository.getWebhookByEventId(eventId);

  if (existingRecord) {
    return NextResponse.json({
      received: true,
      status: "ALREADY_PROCESSED_IDEMPOTENT",
      eventId,
      interactionId,
      message: "Duplicate event acknowledged without re-execution.",
    });
  }

  // 4. Safe Handling of Missing or Partial Fields (Never assume transcript/summary/recording are present)
  let transcript = payload.transcript;
  let summary = payload.summary;
  let recording = payload.recording;

  // Background fetch for missing fields if this is a completed call
  if (eventType === "call_ended") {
    try {
      if (!transcript || transcript.length === 0) {
        transcript = await sarvamAdapter.getTranscript(interactionId);
      }
      if (!summary) {
        const fetchedSummary = await sarvamAdapter.getSummary(interactionId);
        if (fetchedSummary) summary = fetchedSummary;
      }
      if (!recording || !recording.recordingUrl) {
        const fetchedRecording = await sarvamAdapter.getRecordingUrl(interactionId);
        if (fetchedRecording) {
          recording = {
            recordingUrl: fetchedRecording.url,
            mimeType: fetchedRecording.mimeType,
          };
        }
      }
    } catch (err) {
      console.warn("Async fetch of supplemental Sarvam assets deferred:", err);
    }
  }

  // Redact caller phone numbers for patient privacy
  const rawCallerNumber = payload.metadata?.callerNumber || "";
  const maskedCaller = rawCallerNumber ? maskPhoneNumber(rawCallerNumber) : "Unknown Caller";

  // 5. Process any linked hospital actions
  if (payload.actions && Array.isArray(payload.actions)) {
    for (const act of payload.actions) {
      await actionsService.consumeWebhookEvent({
        eventId: `${eventId}_${act.actionId}`,
        actionType: act.actionType,
        callId: interactionId,
        callerNumber: maskedCaller,
        timestamp: new Date().toISOString(),
        callerRequest: `Caller requested ${act.actionType} during Malayalam AI conversation`,
        aiAttempt: `Sarvam Voice Agent executed ${act.actionType}`,
        payload: act.parameters,
        idempotencyKey: (act.parameters?.idempotencyKey as string) || `idem_${act.actionId}`,
        hmsResult: {
          status: act.status === "CONFIRMED" ? "SUCCESS" : act.status === "FAILED" ? "FAILED" : "PENDING",
          bookingRef: act.parameters?.bookingRef as string,
          tokenNumber: act.parameters?.tokenNumber as number,
        },
      });
    }
  }

  // 6. Record webhook processing and audit entry
  await systemRepository.recordWebhook({
    provider: "sarvam_ai",
    eventType,
    externalEventId: eventId,
    idempotencyKey: (payload as Record<string, unknown>).idempotencyKey as string || eventId,
    payloadHash,
    status: "PROCESSED",
  });

  await systemRepository.recordAuditLog({
    entityType: "SARVAM_WEBHOOK",
    entityId: interactionId,
    action: `WEBHOOK_RECEIVED_${eventType.toUpperCase()}`,
    performedBy: "Sarvam Voice Service",
    details: `Processed ${eventType} for interaction ${interactionId}. Caller: ${maskedCaller}. Latency: ${Date.now() - startTime}ms`,
  });

  return NextResponse.json({
    received: true,
    status: "PROCESSED",
    eventId,
    interactionId,
    eventType,
    supplementalDataFetched: {
      transcriptTurnCount: transcript?.length || 0,
      summaryAvailable: Boolean(summary),
      recordingAvailable: Boolean(recording?.recordingUrl),
    },
    latencyMs: Date.now() - startTime,
  });
}
