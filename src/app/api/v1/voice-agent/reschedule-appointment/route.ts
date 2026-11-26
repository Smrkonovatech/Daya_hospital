/**
 * ============================================================================
 * SMRKO VOICE TOOL API: RESCHEDULE APPOINTMENT (PHASE 3 / SMRKOMED)
 * ============================================================================
 *
 * Invoked by SMRKO VOICE Engine (@reschedule_appointment tool) to change
 * an existing booking date and time in Daya Hospital Management System (HMS).
 */

import { NextRequest, NextResponse } from "next/server";
import {
  validateVoiceAgentToolAuth,
  validateHospitalTenant,
  logVoiceAgentToolAudit,
} from "@/lib/integrations/sarvam/voice-agent-auth";
import { integrations } from "@/lib/integrations";
import { actionsService } from "@/lib/services/actions-service";
import { formatE164 } from "@/lib/services/hospital-routing-service";

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
    const {
      bookingRef,
      patientMobile,
      targetDate,
      targetSlotTime,
      targetDoctorId = "DOC-GEN-002",
      callSid = `call_resched_${Date.now()}`,
      hospitalId = "hosp_daya_thrissur",
      idempotencyKey,
    } = body;

    // 2. Identify & validate tenant
    const tenantResult = validateHospitalTenant(hospitalId);
    if (!tenantResult.valid) {
      return NextResponse.json(
        { success: false, error: tenantResult.error },
        { status: 400 }
      );
    }

    if (!bookingRef || !bookingRef.trim()) {
      return NextResponse.json(
        { success: false, error: "bookingRef is required (e.g. DAYA-HMS-OPD-78219)" },
        { status: 400 }
      );
    }

    if (!targetDate || !targetSlotTime) {
      return NextResponse.json(
        { success: false, error: "targetDate and targetSlotTime are required" },
        { status: 400 }
      );
    }

    const formattedMobile = patientMobile ? formatE164(patientMobile) : "+919846018392";
    const dedupeKey = idempotencyKey || `idem_resched_${bookingRef.trim()}_${targetDate}_${targetSlotTime}`;

    const isSimulate =
      request.headers.get("x-hms-simulation") === "true" ||
      request.nextUrl.searchParams.get("simulate") === "true";

    // 3. Invoke HMS Adapter
    const hmsAdapter = integrations.getHmsAdapter(isSimulate);
    const hmsResult = await hmsAdapter.rescheduleAppointment({
      bookingRef: bookingRef.trim(),
      patientMobile: formattedMobile,
      targetDoctorId,
      targetDate,
      targetSlotTime,
      idempotencyKey: dedupeKey,
    });

    const isConfirmed = hmsResult.success;
    const resolvedRef = hmsResult.bookingRef || bookingRef.trim();
    const allocatedSlot = hmsResult.allocatedSlot || `${targetDate} - ${targetSlotTime}`;

    // 4. Record action in audit log and actionsService ledger
    logVoiceAgentToolAudit("RescheduleAppointment", tenantResult.hospitalConfig.hospitalId, {
      bookingRef: resolvedRef,
      targetDate,
      targetSlotTime,
      success: isConfirmed,
      tokenNumber: hmsResult.tokenNumber,
    });

    try {
      await actionsService.consumeWebhookEvent({
        eventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        idempotencyKey: dedupeKey,
        callId: callSid,
        callerNumber: formattedMobile,
        actionType: "APPOINTMENT_RESCHEDULING",
        timestamp: new Date().toISOString(),
        payload: { hospitalId: tenantResult.hospitalConfig.hospitalId, targetSlot: allocatedSlot },
        hmsResult: {
          status: isConfirmed ? "SUCCESS" : "FAILED",
          bookingRef: resolvedRef,
          tokenNumber: hmsResult.tokenNumber || 8,
          transactionId: `TXN-RESCHED-${Date.now().toString().slice(-6)}`,
          errorMessage: isConfirmed ? undefined : (hmsResult.error || "HMS rejected rescheduling request"),
        },
      });
    } catch (e) {
      console.warn("[VoiceAgent:Reschedule] Non-blocking action logging error:", e);
    }

    if (!isConfirmed) {
      const isUnavailable =
        hmsResult.errorCode === "HMS_UNAVAILABLE" || hmsResult.errorCode === "HMS_DISCONNECTED";

      return NextResponse.json(
        {
          success: false,
          error: isUnavailable ? "HMS_UNAVAILABLE" : (hmsResult.error || "Unable to reschedule appointment in hospital system."),
          errorCode: hmsResult.errorCode || "SLOT_UNAVAILABLE",
          hmsStatus: isUnavailable ? "DISCONNECTED" : "CONNECTED",
          verbalNoticeMalayalam: isUnavailable
            ? "ക്ഷമിക്കണം, ഹോസ്പിറ്റൽ സിസ്റ്റം ഇപ്പോൾ ലഭ്യമല്ല. ഞങ്ങളുടെ റിസപ്ഷനുമായി ബന്ധിപ്പിക്കാം."
            : "ക്ഷമിക്കണം, താങ്കൾ ആവശ്യപ്പെട്ട സമയത്ത് അപ്പോയിന്റ്മെന്റ് മാറ്റിവെക്കാൻ സാധിച്ചില്ല. മറ്റൊരു സമയം തിരഞ്ഞെടുക്കാമോ?",
          verbalNoticeEnglish: isUnavailable
            ? "Sorry, hospital system is temporarily unreachable. Let me connect you with our receptionist."
            : "Sorry, could not reschedule to the requested slot. Would you like to check another time?",
        },
        { status: isUnavailable ? 503 : 409 }
      );
    }

    return NextResponse.json({
      success: true,
      bookingRef: resolvedRef,
      tokenNumber: hmsResult.tokenNumber || 8,
      allocatedSlot,
      targetDate,
      targetSlotTime,
      hospitalId: tenantResult.hospitalConfig.hospitalId,
      verbalConfirmationMalayalam: `താങ്കളുടെ അപ്പോയിന്റ്മെന്റ് വിജയകരമായി ${targetDate} തീയതിയിലേക്ക് മാറ്റിയിരിക്കുന്നു. പുതിയ ടോക്കൺ നമ്പർ ${hmsResult.tokenNumber || 8} ആണ്.`,
      verbalConfirmationEnglish: `Your appointment has been successfully rescheduled to ${targetDate} at ${targetSlotTime}. Your token number is ${hmsResult.tokenNumber || 8}.`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal error rescheduling appointment";
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
