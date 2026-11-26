/**
 * ============================================================================
 * SMRKOMED ON-END WEBHOOK: SARVAM VOICE AGENT CALL COMPLETION (PHASE 10)
 * ============================================================================
 *
 * Webhook triggered by Sarvam Voice Agents at the conclusion of every call session.
 * Ingests:
 * - Call SID & Interaction ID
 * - Duration & disposition
 * - Full transcript turns & tool executions
 * - Recording URL (if audio recording enabled)
 *
 * Verifies HMAC-SHA256 signature and records to Smrkomed Call Ledger.
 */

import { NextRequest, NextResponse } from "next/server";
import { sarvamVoiceAgentClient } from "@/lib/integrations/sarvam/voice-agent-client";
import { prisma, checkDatabaseConnection } from "@/lib/db/prisma";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature =
      request.headers.get("sarvam-signature") ||
      request.headers.get("x-sarvam-signature") ||
      "";
    const timestampHeader =
      request.headers.get("sarvam-timestamp") ||
      request.headers.get("x-sarvam-timestamp") ||
      null;

    // Verify HMAC-SHA256 signature with official Sarvam signed contract & timestamp replay check
    const verification = sarvamVoiceAgentClient.verifyWebhookSignature(
      rawBody,
      signature,
      timestampHeader
    );

    if (!verification.isValid && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { success: false, error: "Invalid webhook signature", reason: verification.reason },
        { status: 401 }
      );
    }

    const payload = JSON.parse(rawBody);
    const {
      interaction_id,
      call_sid,
      agent_id,
      hospital_id = "hosp_daya_thrissur",
      caller_number,
      called_number,
      status,
      duration_seconds,
      duration,
      start_datetime,
      end_datetime,
      final_agent_variables,
      interaction_transcript,
      transcript_turns,
      disposition,
      recording_url,
    } = payload;

    const resolvedDuration = duration_seconds ?? duration ?? 0;
    const resolvedInteractionId = interaction_id || `int_${Date.now()}`;
    const resolvedCallSid = call_sid || resolvedInteractionId;

    console.log(
      `[SarvamWebhook:CallEnded] Call completed: InteractionId='${resolvedInteractionId}', ` +
      `CallSid='${resolvedCallSid}', Agent='${agent_id || "N/A"}', Status=${status}, ` +
      `Duration=${resolvedDuration}s, Disposition="${disposition || "NONE"}"`
    );

    // Idempotent persistence to Neon DB
    const dbStatus = await checkDatabaseConnection();
    const idempotencyKey = `sarvam_call_${resolvedInteractionId}`;

    if (dbStatus.connected) {
      try {
        const resolvedHospitalId = hospital_id || "hosp_daya_thrissur";

        // Check for duplicate webhook submission using compound unique key
        const existingRecord = await prisma.durableIdempotencyRecord.findUnique({
          where: {
            hospitalId_idempotencyKey: {
              hospitalId: resolvedHospitalId,
              idempotencyKey,
            },
          },
        });

        if (existingRecord) {
          console.log(`[SarvamWebhook:CallEnded] Duplicate event detected for key='${idempotencyKey}' — returning idempotent 200 OK`);
          return NextResponse.json({
            success: true,
            received: true,
            duplicate: true,
            callSid: resolvedCallSid,
            interactionId: resolvedInteractionId,
            message: "Duplicate webhook processed idempotently",
          });
        }

        await prisma.durableIdempotencyRecord.create({
          data: {
            idempotencyKey,
            resourceType: "SARVAM_VOICE_AGENT_CALL",
            callSid: resolvedCallSid,
            hospitalId: hospital_id || "hosp_daya_thrissur",
            responseJson: JSON.stringify({
              callSid: resolvedCallSid,
              interactionId: resolvedInteractionId,
              agentId: agent_id,
              hospitalId: hospital_id,
              callerNumber: caller_number,
              calledNumber: called_number,
              status,
              durationSeconds: resolvedDuration,
              startDatetime: start_datetime,
              endDatetime: end_datetime,
              finalAgentVariables: final_agent_variables,
              transcriptTurns: transcript_turns || interaction_transcript,
              disposition,
              recordingUrl: recording_url,
              receivedAt: new Date().toISOString(),
            }),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days retention
          },
        });
      } catch (dbErr) {
        console.warn("[SarvamWebhook:CallEnded] DB persistence error:", dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      received: true,
      callSid: resolvedCallSid,
      interactionId: resolvedInteractionId,
      disposition: disposition || "COMPLETED",
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to process call-ended webhook" },
      { status: 500 }
    );
  }
}
