/**
 * ============================================================================
 * SMRKO VOICE TOOL API: BOOK OPD APPOINTMENT (PHASE 3 / SMRKOMED)
 * ============================================================================
 *
 * Invoked by SMRKO VOICE Engine (@book_appointment tool) to book
 * a confirmed appointment in Daya Hospital Management System (HMS).
 */

import { NextRequest, NextResponse } from "next/server";
import { isValidE164, formatE164 } from "@/lib/services/hospital-routing-service";
import {
  validateVoiceAgentToolAuth,
  validateHospitalTenant,
  logVoiceAgentToolAudit,
} from "@/lib/integrations/sarvam/voice-agent-auth";
import { integrations } from "@/lib/integrations";
import { actionsService } from "@/lib/services/actions-service";

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
      patientName,
      patientPhone,
      departmentId,
      department,
      doctorName,
      doctorId,
      appointmentDate,
      date,
      appointmentTime,
      slotTime,
      callSid = `call_book_${Date.now()}`,
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

    if (!patientName || !patientName.trim()) {
      return NextResponse.json(
        { success: false, error: "patientName is required" },
        { status: 400 }
      );
    }

    if (!patientPhone || !patientPhone.trim()) {
      return NextResponse.json(
        { success: false, error: "patientPhone is required" },
        { status: 400 }
      );
    }

    const formattedPhone = formatE164(patientPhone);
    if (!isValidE164(formattedPhone)) {
      return NextResponse.json(
        {
          success: false,
          error: "patientPhone must be a valid phone number (e.g. +919846001122)",
        },
        { status: 400 }
      );
    }

    const isSimulate =
      request.headers.get("x-hms-simulation") === "true" ||
      request.nextUrl.searchParams.get("simulate") === "true";

    const targetDate = appointmentDate || date || new Date().toISOString().split("T")[0];
    const targetSlot = appointmentTime || slotTime || "10:30 AM";
    const resolvedDept = department || departmentId || "General Medicine";

    let resolvedDoctorId = doctorId || "";
    let resolvedDoctorName = doctorName || "";

    if (!doctorId && !doctorName) {
      if (isSimulate) {
        resolvedDoctorId = "DOC_ORTHO_04";
        resolvedDoctorName = "Dr. Suresh Kumar";
      } else {
        return NextResponse.json(
          { success: false, error: "Either doctorName or doctorId is required to book an appointment." },
          { status: 400 }
        );
      }
    }

    // Resolve doctor from HMS
    const hmsAdapter = integrations.getHmsAdapter(isSimulate);

    if (!resolvedDoctorId && resolvedDoctorName) {
      try {
        const docs = await hmsAdapter.getDoctors(resolvedDept);
        const match = docs.find((d) => d.doctorName.toLowerCase().includes(resolvedDoctorName.toLowerCase()));
        if (match) {
          resolvedDoctorId = match.doctorId;
          resolvedDoctorName = match.doctorName;
        } else {
          resolvedDoctorId = `DOC-REQ-${Date.now().toString().slice(-4)}`;
        }
      } catch (docErr) {
        if (!isSimulate) {
          return NextResponse.json(
            {
              success: false,
              confirmed: false,
              bookingReference: null,
              tokenNumber: null,
              error: "HMS_UNAVAILABLE",
              hmsStatus: "DISCONNECTED",
              agentInstructions:
                "Hospital management system is offline. Do NOT claim the appointment is booked. Inform the caller and transfer them to the human receptionist desk.",
              verbalNoticeMalayalam:
                "ക്ഷമിക്കണം, ഹോസ്പിറ്റൽ ബുക്കിംഗ് സിസ്റ്റം ഇപ്പോൾ ലഭ്യമല്ല. അപ്പോയിന്റ്മെന്റ് സ്ഥിരീകരിക്കാൻ ഞങ്ങളുടെ റിസപ്ഷനിലേക്ക് കൈമാറാം.",
              verbalNoticeEnglish:
                "Sorry, the hospital booking system is temporarily unreachable. Let me connect you with our receptionist.",
            },
            { status: 503 }
          );
        }
        resolvedDoctorId = "DOC-GEN-002";
        resolvedDoctorName = "Dr. Anjali Menon";
      }
    }

    // 3. Idempotency key
    const dedupeKey =
      idempotencyKey ||
      `idem_book_${tenantResult.hospitalConfig.hospitalId}_${formattedPhone}_${resolvedDoctorId}_${targetDate}_${targetSlot}`;

    // 4. Book via HMS Adapter
    const hmsResult = await hmsAdapter.bookAppointment({
      doctorId: resolvedDoctorId,
      doctorName: resolvedDoctorName,
      department: resolvedDept,
      date: targetDate,
      slotTime: targetSlot,
      patientMobile: formattedPhone,
      patientName: patientName.trim(),
      idempotencyKey: dedupeKey,
    });

    const isConfirmed = hmsResult.success;
    const bookingRef = hmsResult.bookingRef || null;
    const tokenNumber = hmsResult.tokenNumber || null;
    const consultationFee = hmsResult.consultationFee || 250;

    // 5. Audit log
    logVoiceAgentToolAudit("BookAppointment", tenantResult.hospitalConfig.hospitalId, {
      bookingReference: bookingRef,
      tokenNumber,
      patientName: patientName.trim(),
      patientPhone: formattedPhone.slice(0, 5) + "...",
      doctor: resolvedDoctorName,
      slot: `${targetDate} - ${targetSlot}`,
      success: isConfirmed,
      isSimulated: hmsResult.isSimulated || isSimulate,
    });

    // 6. Record action in actionsService ledger
    try {
      await actionsService.consumeWebhookEvent({
        eventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        idempotencyKey: dedupeKey,
        callId: callSid,
        callerNumber: formattedPhone,
        callerName: patientName.trim(),
        actionType: "APPOINTMENT_BOOKING",
        timestamp: new Date().toISOString(),
        doctorName: resolvedDoctorName,
        department: resolvedDept,
        payload: { hospitalId: tenantResult.hospitalConfig.hospitalId },
        hmsResult: {
          status: isConfirmed ? "SUCCESS" : "FAILED",
          bookingRef: bookingRef || undefined,
          tokenNumber: tokenNumber || undefined,
          transactionId: isConfirmed ? `TXN-BOOK-${Date.now().toString().slice(-6)}` : undefined,
          errorMessage: isConfirmed ? undefined : (hmsResult.error || "HMS rejected booking"),
        },
      });
    } catch (e) {
      console.warn("[VoiceAgent:Book] Non-blocking action logging error:", e);
    }

    if (!isConfirmed) {
      const isUnavailable =
        hmsResult.errorCode === "HMS_UNAVAILABLE" || hmsResult.errorCode === "HMS_DISCONNECTED";

      return NextResponse.json(
        {
          success: false,
          confirmed: false,
          bookingReference: null,
          tokenNumber: null,
          error: isUnavailable ? "HMS_UNAVAILABLE" : (hmsResult.error || "Selected slot is no longer available."),
          errorCode: hmsResult.errorCode || "SLOT_UNAVAILABLE",
          hmsStatus: isUnavailable ? "DISCONNECTED" : "CONNECTED",
          verbalNoticeMalayalam: isUnavailable
            ? "ക്ഷമിക്കണം, ഹോസ്പിറ്റൽ ബുക്കിംഗ് സിസ്റ്റം ഇപ്പോൾ ലഭ്യമല്ല. ഞങ്ങളുടെ റിസപ്ഷനിലേക്ക് കൈമാറാം."
            : "ക്ഷമിക്കണം, ഈ സ്ലോട്ട് ഇപ്പോൾ ലഭ്യമല്ല. മറ്റൊരു സമയം തിരഞ്ഞെടുക്കാമോ?",
          verbalNoticeEnglish: isUnavailable
            ? "Sorry, the hospital booking system is temporarily unreachable. Let me connect you with our receptionist."
            : "Sorry, this slot is no longer available. Would you like to select another time?",
          agentInstructions: isUnavailable
            ? "Booking failed because hospital management system is offline. Do NOT claim the appointment is confirmed. Inform caller and transfer to human receptionist."
            : "Slot unavailable. Prompt caller to pick an alternative OPD time.",
        },
        { status: isUnavailable ? 503 : 409 }
      );
    }

    return NextResponse.json({
      success: true,
      confirmed: true,
      bookingReference: bookingRef,
      tokenNumber,
      hospitalId: tenantResult.hospitalConfig.hospitalId,
      patientName: patientName.trim(),
      patientPhone: formattedPhone,
      doctorName: resolvedDoctorName,
      department: resolvedDept,
      appointmentDate: targetDate,
      appointmentTime: targetSlot,
      consultationFee,
      isSimulated: hmsResult.isSimulated || false,
      source: hmsResult.source || "LIVE_HMS",
      simulationNotice: hmsResult.simulationNotice,
      instructions: "Please report to Daya Hospital OPD Reception 15 minutes before the appointment time.",
      verbalConfirmationMalayalam: `താങ്കളുടെ അപ്പോയിന്റ്മെന്റ് ${resolvedDoctorName}യുമായി ${targetDate} തീയതിയിൽ ${targetSlot} സമയത്ത് വിജയകരമായി ബുക്ക് ചെയ്തിരിക്കുന്നു. ടോക്കൺ നമ്പർ ${tokenNumber} ആണ്. റഫറൻസ് നമ്പർ: ${bookingRef}.`,
      verbalConfirmationEnglish: `Your appointment with ${resolvedDoctorName} is confirmed for ${targetDate} at ${targetSlot}. Your token number is ${tokenNumber}, and booking reference is ${bookingRef}.`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to book appointment";
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
