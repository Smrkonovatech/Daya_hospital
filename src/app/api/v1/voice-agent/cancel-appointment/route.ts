/**
 * ============================================================================
 * SMRKO VOICE TOOL API: CANCEL APPOINTMENT (PHASE 3 / SMRKOMED)
 * ============================================================================
 *
 * Invoked by SMRKO VOICE Engine (@cancel_appointment tool) to cancel
 * an active appointment and release the slot back to the hospital OPD pool.
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
      reason = "Patient requested cancellation via phone",
      callSid = `call_cancel_${Date.now()}`,
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

    const cleanRef = bookingRef.trim();
    const formattedMobile = patientMobile ? formatE164(patientMobile) : "+919846018392";
    const dedupeKey = idempotencyKey || `idem_cancel_${cleanRef}`;

    const isSimulate =
      request.headers.get("x-hms-simulation") === "true" ||
      request.nextUrl.searchParams.get("simulate") === "true";

    // 3. Invoke HMS Adapter
    const hmsAdapter = integrations.getHmsAdapter(isSimulate);
    const hmsResult = await hmsAdapter.cancelAppointment(cleanRef, dedupeKey);

    const isCancelled = hmsResult.success;

    // 4. Record action in audit log and actionsService ledger
    logVoiceAgentToolAudit("CancelAppointment", tenantResult.hospitalConfig.hospitalId, {
      bookingRef: cleanRef,
      reason,
      success: isCancelled,
    });

    try {
      await actionsService.consumeWebhookEvent({
        eventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        idempotencyKey: dedupeKey,
        callId: callSid,
        callerNumber: formattedMobile,
        actionType: "APPOINTMENT_CANCELLATION",
        timestamp: new Date().toISOString(),
        payload: { hospitalId: tenantResult.hospitalConfig.hospitalId, reason },
        hmsResult: {
          status: isCancelled ? "SUCCESS" : "FAILED",
          bookingRef: cleanRef,
          transactionId: `TXN-CANCEL-${Date.now().toString().slice(-6)}`,
          errorMessage: isCancelled ? undefined : (hmsResult.error || "HMS rejected cancellation"),
        },
      });
    } catch (e) {
      console.warn("[VoiceAgent:Cancel] Non-blocking action logging error:", e);
    }

    if (!isCancelled) {
      const isUnavailable = hmsResult.error?.includes("unreachable") || hmsResult.error?.includes("offline");

      return NextResponse.json(
        {
          success: false,
          error: isUnavailable ? "HMS_UNAVAILABLE" : (hmsResult.error || "Appointment reference not found or already cancelled."),
          hmsStatus: isUnavailable ? "DISCONNECTED" : "CONNECTED",
          verbalNoticeMalayalam: isUnavailable
            ? "ക്ഷമിക്കണം, ഹോസ്പിറ്റൽ സിസ്റ്റം ഇപ്പോൾ ലഭ്യമല്ല. റദ്ദാക്കലിനായി ഞങ്ങളുടെ റിസപ്ഷനുമായി ബന്ധിപ്പിക്കാം."
            : "ക്ഷമിക്കണം, ഈ റഫറൻസ് നമ്പറിലുള്ള അപ്പോയിന്റ്മെന്റ് കണ്ടെത്താനായില്ല.",
          verbalNoticeEnglish: isUnavailable
            ? "Sorry, hospital system is temporarily unreachable. Let me connect you with our receptionist."
            : "Sorry, could not find an active appointment with that reference number.",
        },
        { status: isUnavailable ? 503 : 404 }
      );
    }

    return NextResponse.json({
      success: true,
      cancelledRef: cleanRef,
      releasedSlot: hmsResult.releasedSlot || "Slot released back to OPD schedule",
      hospitalId: tenantResult.hospitalConfig.hospitalId,
      verbalConfirmationMalayalam: `താങ്കളുടെ അപ്പോയിന്റ്മെന്റ് (${cleanRef}) വിജയകരമായി റദ്ദാക്കിയിരിക്കുന്നു. ആവശ്യമെങ്കിൽ മറ്റൊരു ദിവസം ബുക്ക് ചെയ്യാം.`,
      verbalConfirmationEnglish: `Your appointment (${cleanRef}) has been successfully cancelled. Please call back anytime to book a new slot.`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal error cancelling appointment";
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
