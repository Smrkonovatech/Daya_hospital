/**
 * ============================================================================
 * SMRKOMED RECEPTIONIST CALL EVENT API: POST /api/v1/receptionist/call-event
 * ============================================================================
 *
 * Telephony webhook endpoint that reconciles carrier call lifecycle events
 * (RINGING, ANSWERED, COMPLETED, MISSED, TIMEOUT, FAILED) with the receptionist
 * presence state machine.
 */

import { NextRequest, NextResponse } from "next/server";
import { receptionistPresenceService, TelephonyCallEventType } from "@/lib/services/receptionist-presence-service";
import { aiOverflowService } from "@/lib/services/ai-overflow-service";
import { getHospitalConfig } from "@/lib/config/hospital-config";
import { z } from "zod";

const callEventSchema = z.object({
  hospitalId: z.string().min(1).optional(),
  callSid: z.string().min(1, "callSid is required"),
  eventType: z.enum([
    "CALL_RINGING",
    "CALL_ANSWERED",
    "CALL_COMPLETED",
    "CALL_MISSED",
    "RING_TIMEOUT",
    "CALL_FAILED",
  ]),
  userId: z.string().optional(),
  reason: z.string().optional(),
  timestamp: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const headerHospitalId = request.headers.get("x-hospital-id");
    const body = await request.json();

    const parsed = callEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid call event payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const hospitalConfig = getHospitalConfig(parsed.data.hospitalId || headerHospitalId || undefined);
    const hospitalId = hospitalConfig.hospitalId;
    const { callSid, eventType, userId, reason, timestamp, metadata } = parsed.data;

    const eventDate = timestamp ? new Date(timestamp) : new Date();

    const res = await receptionistPresenceService.reconcileTelephonyEvent({
      hospitalId,
      callSid,
      eventType: eventType as TelephonyCallEventType,
      userId,
      reason,
      timestamp: eventDate,
      metadata,
    });

    if (!res.reconciled) {
      return NextResponse.json(
        { success: false, error: res.error },
        { status: 404 }
      );
    }

    // When a call times out or is missed while ringing staff, record the AI overflow
    if (eventType === "RING_TIMEOUT" || eventType === "CALL_MISSED") {
      await aiOverflowService.recordOverflow({
        hospitalId,
        callSid,
        callerNumber: (metadata?.callerNumber as string) || "UNKNOWN",
        dialedNumber: (metadata?.dialedNumber as string) || undefined,
        reason: eventType === "RING_TIMEOUT" ? "RING_TIMEOUT" : "RECEPTIONIST_BUSY",
        targetStaffUserId: res.staff?.userId,
        targetStaffName: res.staff?.staffName,
        ringDurationSeconds: (metadata?.ringDurationSeconds as number) || 20,
        handledByAi: true,
        context: {
          originalEventType: eventType,
          reconciledAt: eventDate.toISOString(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      hospitalId,
      callSid,
      eventType,
      staff: res.staff,
    });
  } catch (error) {
    console.error("POST /api/v1/receptionist/call-event error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to reconcile telephony call event." },
      { status: 500 }
    );
  }
}
