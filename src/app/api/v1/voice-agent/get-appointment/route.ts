/**
 * ============================================================================
 * SMRKO VOICE TOOL API: GET APPOINTMENT LOOKUP (PHASE 3 / SMRKOMED)
 * ============================================================================
 *
 * Invoked by SMRKO VOICE Engine (@get_appointment tool) to look up
 * appointment status, doctor name, token number, and schedule by booking reference
 * or caller phone number.
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

export async function GET(request: NextRequest) {
  return handleLookup(request, "GET");
}

export async function POST(request: NextRequest) {
  return handleLookup(request, "POST");
}

async function handleLookup(request: NextRequest, method: "GET" | "POST") {
  try {
    // 1. Authenticate request
    const auth = validateVoiceAgentToolAuth(request);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.statusCode || 401 }
      );
    }

    let bookingRef: string | null = null;
    let patientMobile: string | null = null;
    let hospitalId = "hosp_daya_thrissur";

    if (method === "GET") {
      const { searchParams } = new URL(request.url);
      bookingRef = searchParams.get("bookingRef") || searchParams.get("reference") || null;
      patientMobile = searchParams.get("patientMobile") || searchParams.get("phone") || null;
      hospitalId = searchParams.get("hospitalId") || hospitalId;
    } else {
      const body = await request.json().catch(() => ({}));
      bookingRef = body.bookingRef || body.reference || null;
      patientMobile = body.patientMobile || body.phone || null;
      hospitalId = body.hospitalId || hospitalId;
    }

    // 2. Identify & validate tenant
    const tenantResult = validateHospitalTenant(hospitalId);
    if (!tenantResult.valid) {
      return NextResponse.json(
        { success: false, error: tenantResult.error },
        { status: 400 }
      );
    }

    if (!bookingRef && !patientMobile) {
      return NextResponse.json(
        { success: false, error: "Either bookingRef or patientMobile is required for appointment lookup." },
        { status: 400 }
      );
    }

    const isSimulate =
      request.headers.get("x-hms-simulation") === "true" ||
      request.nextUrl.searchParams.get("simulate") === "true";

    const hmsAdapter = integrations.getHmsAdapter(isSimulate);

    // 3. Lookup by booking reference
    if (bookingRef && bookingRef.trim()) {
      const cleanRef = bookingRef.trim();
      const verification = await hmsAdapter.verifyBooking(cleanRef);

      logVoiceAgentToolAudit("GetAppointmentByRef", tenantResult.hospitalConfig.hospitalId, {
        bookingRef: cleanRef,
        verified: verification.verified,
        status: verification.status,
      });

      if (!verification.verified || verification.status === "NOT_FOUND") {
        return NextResponse.json(
          {
            success: false,
            found: false,
            bookingRef: cleanRef,
            verbalSummaryMalayalam: "ക്ഷമിക്കണം, ഈ റഫറൻസ് നമ്പറിൽ ഒരു അപ്പോയിന്റ്മെന്റും കണ്ടെത്താനായില്ല.",
            verbalSummaryEnglish: "Sorry, no appointment was found matching that reference number.",
          },
          { status: 404 }
        );
      }

      const doctorDisplay = verification.doctorName || "Hospital Consultant";
      const slotDisplay = verification.slot || "Scheduled OPD Slot";

      return NextResponse.json({
        success: true,
        found: true,
        bookingRef: verification.bookingRef,
        status: verification.status,
        doctorName: doctorDisplay,
        slot: slotDisplay,
        hospitalId: tenantResult.hospitalConfig.hospitalId,
        verbalSummaryMalayalam: `താങ്കളുടെ അപ്പോയിന്റ്മെന്റ് (${verification.bookingRef}) സ്ഥിരീകരിച്ചതാണ്. ഡോക്ടർ: ${doctorDisplay}, സമയം: ${slotDisplay}.`,
        verbalSummaryEnglish: `Your appointment (${verification.bookingRef}) is confirmed with ${doctorDisplay} at ${slotDisplay}.`,
      });
    }

    // 4. Lookup by patient phone number
    const cleanMobile = formatE164(patientMobile!);
    const actionsResult = await actionsService.getActions({
      searchQuery: cleanMobile,
      limit: 5,
    });

    const matchingActions = actionsResult.actions.filter(
      (a) =>
        (a.category === "APPOINTMENT_BOOKING" || a.category === "APPOINTMENT_RESCHEDULING") &&
        a.status === "CONFIRMED"
    );

    logVoiceAgentToolAudit("GetAppointmentByPhone", tenantResult.hospitalConfig.hospitalId, {
      patientMobile: cleanMobile,
      matches: matchingActions.length,
    });

    if (matchingActions.length === 0) {
      return NextResponse.json(
        {
          success: true,
          found: false,
          patientMobile: cleanMobile,
          appointments: [],
          verbalSummaryMalayalam: "ഈ ഫോൺ നമ്പറിൽ ഇപ്പോൾ ബുക്ക് ചെയ്ത അപ്പോയിന്റ്മെന്റുകൾ ഒന്നും നിലവിലില്ല.",
          verbalSummaryEnglish: "No upcoming appointments found for this phone number.",
        },
        { status: 200 }
      );
    }

    const latest = matchingActions[0];
    return NextResponse.json({
      success: true,
      found: true,
      patientMobile: cleanMobile,
      count: matchingActions.length,
      appointments: matchingActions.map((a) => ({
        bookingRef: a.hmsBookingRef || `DAYA-OPD-${a.id.slice(-5)}`,
        doctorName: a.doctorName || "Consultant Physician",
        department: a.department || "General OPD",
        slot: a.appointmentSlot || "Morning Slot",
        status: a.status,
      })),
      verbalSummaryMalayalam: `ഈ നമ്പറിൽ ${latest.doctorName || "ഡോക്ടറുമായി"} ഉള്ള അപ്പോയിന്റ്മെന്റ് നിലവിലുണ്ട്. സമയം: ${latest.appointmentSlot || "രാവിലെ"}. റഫറൻസ് നമ്പർ: ${latest.hmsBookingRef || "ലഭ്യമാണ്"}.`,
      verbalSummaryEnglish: `You have an active appointment with ${latest.doctorName || "doctor"} at ${latest.appointmentSlot || "morning"}. Reference: ${latest.hmsBookingRef || "available"}.`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal error retrieving appointment";
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
