/**
 * ============================================================================
 * SMRKOMED TOOL API: BOOK OPD APPOINTMENT (PHASE 10)
 * ============================================================================
 *
 * Invoked by Sarvam Voice Agents (@book_opd_appointment tool) to book
 * an appointment in Daya Hospital Management System (HMS).
 */

import { NextRequest, NextResponse } from "next/server";
import { isValidE164, formatE164 } from "@/lib/services/hospital-routing-service";
import {
  validateVoiceAgentToolAuth,
  validateHospitalTenant,
  logVoiceAgentToolAudit,
} from "@/lib/integrations/sarvam/voice-agent-auth";

// In-memory idempotency cache for development / test appointments
const APPOINTMENT_IDEMPOTENCY_CACHE = new Map<string, any>();

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
      slotTime,
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

    const appointmentDate = new Date().toISOString().split("T")[0];
    const resolvedSlot = slotTime || "10:30 AM";
    const resolvedDept = departmentId || "dept_general_medicine";

    // 3. Idempotency check: prevent duplicate bookings for same caller/dept/date/slot
    const dedupeKey =
      idempotencyKey ||
      `${tenantResult.hospitalConfig.hospitalId}_${formattedPhone}_${resolvedDept}_${appointmentDate}_${resolvedSlot}`;

    if (APPOINTMENT_IDEMPOTENCY_CACHE.has(dedupeKey)) {
      const existing = APPOINTMENT_IDEMPOTENCY_CACHE.get(dedupeKey);
      logVoiceAgentToolAudit("BookAppointment", tenantResult.hospitalConfig.hospitalId, {
        action: "IDEMPOTENT_DUPLICATE_RETURNED",
        bookingReference: existing.bookingReference,
      });
      return NextResponse.json({
        ...existing,
        idempotent: true,
      });
    }

    const bookingRef = `DAYA-OPD-${Date.now().toString().slice(-6)}`;
    const resultPayload = {
      success: true,
      bookingReference: bookingRef,
      hospitalId: tenantResult.hospitalConfig.hospitalId,
      patientName: patientName.trim(),
      patientPhone: formattedPhone,
      departmentId: resolvedDept,
      appointmentDate,
      appointmentTime: resolvedSlot,
      tokenNumber: Math.floor(10 + Math.random() * 40),
      instructions: "Please report to Daya Hospital OPD Reception 15 minutes before the appointment time.",
      isSimulated: true,
      mode: "SIMULATION_TESTING",
      isLiveHmsConfirmed: false,
      agentInstructions:
        "CRITICAL CLINICAL SAFEGUARD: Hospital Management System (HMS) is in simulated testing. You MUST explicitly state to the caller that this is a PROVISIONAL reference, and a real confirmed appointment cannot yet be issued until confirmed at the hospital reception.",
      verbalNoticeMalayalam:
        "താങ്കളുടെ താൽക്കാലിക അപ്പോയിന്റ്മെന്റ് റഫറൻസ് നമ്പർ ഇതാണ്. ആശുപത്രിയിലെ സിസ്റ്റം പരിശോധന നടക്കുന്നതിനാൽ ഇതൊരു താൽക്കാലിക ബുക്കിംഗ് മാത്രമാണ്, ആശുപത്രിയിൽ നേരിട്ടെത്തുമ്പോൾ ഫ്രണ്ട് ഡെസ്കിൽ ഈ നമ്പർ കാണിച്ച് അപ്പോയിന്റ്മെന്റ് സ്ഥിരീകരിക്കുക.",
      verbalNoticeEnglish:
        "Your provisional appointment reference is recorded. Since live HMS confirmation is in test mode, a real appointment cannot yet be confirmed over the phone. Please present this provisional reference at the hospital reception desk.",
    };

    APPOINTMENT_IDEMPOTENCY_CACHE.set(dedupeKey, resultPayload);

    // 4. Audit log
    logVoiceAgentToolAudit("BookAppointment", tenantResult.hospitalConfig.hospitalId, {
      bookingReference: bookingRef,
      patientPhone: formattedPhone.slice(0, 5) + "...",
      departmentId: resolvedDept,
      slot: resolvedSlot,
    });

    return NextResponse.json(resultPayload);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to book appointment" },
      { status: 500 }
    );
  }
}

