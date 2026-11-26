/**
 * ============================================================================
 * SMRKO VOICE TOOL API: CHECK OPD AVAILABILITY (PHASE 3 / SMRKOMED)
 * ============================================================================
 *
 * Invoked by SMRKO VOICE Engine (@check_availability tool) to check
 * doctor consulting hours and appointment slot availability in Daya HMS.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  validateVoiceAgentToolAuth,
  validateHospitalTenant,
  logVoiceAgentToolAudit,
} from "@/lib/integrations/sarvam/voice-agent-auth";
import { integrations } from "@/lib/integrations";

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

    const body = await request.json().catch(() => ({}));
    const {
      departmentId,
      department,
      doctorName,
      preferredDate,
      hospitalId = "hosp_daya_thrissur",
    } = body;

    // 2. Identify & validate tenant
    const tenantResult = validateHospitalTenant(hospitalId);
    if (!tenantResult.valid) {
      return NextResponse.json(
        { success: false, error: tenantResult.error },
        { status: 400 }
      );
    }

    const isSimulate =
      request.headers.get("x-hms-simulation") === "true" ||
      request.nextUrl.searchParams.get("simulate") === "true";

    const hmsAdapter = integrations.getHmsAdapter(isSimulate);
    const resolvedDeptQuery = department || departmentId || undefined;
    const targetDate = preferredDate || new Date().toISOString().split("T")[0];

    // Find doctors matching department or name
    let doctors: any[] = [];
    try {
      doctors = await hmsAdapter.getDoctors(resolvedDeptQuery);
    } catch (hmsErr: any) {
      if (!isSimulate) {
        return NextResponse.json(
          {
            success: false,
            available: false,
            error: "HMS_UNAVAILABLE",
            hmsStatus: "DISCONNECTED",
            hospitalId: tenantResult.hospitalConfig.hospitalId,
            verbalSummaryMalayalam:
              "ക്ഷമിക്കണം, ഹോസ്പിറ്റൽ ഒ.പി.ഡി വിവരങ്ങൾ ഇപ്പോൾ ലഭ്യമാക്കാൻ സാധിക്കുന്നില്ല. ഞങ്ങളുടെ റിസപ്ഷനുമായി ബന്ധിപ്പിക്കാം.",
            verbalSummaryEnglish:
              "Sorry, hospital appointment scheduling is temporarily unreachable. Let me connect you with our receptionist.",
            agentInstructions:
              "Hospital scheduling system is unreachable. Apologize to caller and execute @receptionist_transfer or offer phone number 0487 247 5000.",
          },
          { status: 503 }
        );
      }
    }

    if (doctorName && doctorName.trim()) {
      const docQuery = doctorName.toLowerCase().trim();
      const byName = doctors.filter((d) => d.doctorName.toLowerCase().includes(docQuery));
      if (byName.length > 0) {
        doctors = byName;
      }
    }

    if (doctors.length === 0) {
      return NextResponse.json({
        success: true,
        available: false,
        hospitalId: tenantResult.hospitalConfig.hospitalId,
        department: resolvedDeptQuery || null,
        doctor: doctorName || null,
        date: targetDate,
        availableSlots: [],
        verbalSummaryMalayalam: "ക്ഷമിക്കണം, നിർദ്ദേശിച്ച വിഭാഗത്തിൽ ഇപ്പോൾ ഡോക്ടർമാരുടെ സേവനം ലഭ്യമല്ല.",
        verbalSummaryEnglish: "Sorry, no doctors are currently available for this department.",
        agentInstructions: "No doctors match the caller query. Inquire if they wish to consult another department or speak with reception.",
      });
    }

    const selectedDoctor = doctors[0];

    // Query available slots
    let slots: any[] = [];
    try {
      slots = await hmsAdapter.checkDoctorSlots(selectedDoctor.doctorId, targetDate);
    } catch (slotErr) {
      if (!isSimulate) {
        return NextResponse.json(
          {
            success: false,
            available: false,
            error: "HMS_UNAVAILABLE",
            hmsStatus: "DISCONNECTED",
            hospitalId: tenantResult.hospitalConfig.hospitalId,
            verbalSummaryMalayalam:
              "ക്ഷമിക്കണം, ഡോക്ടറുടെ സ്ലോട്ട് വിവരങ്ങൾ ഇപ്പോൾ ലഭ്യമാക്കാൻ സാധിക്കുന്നില്ല. ഞങ്ങളുടെ റിസപ്ഷനുമായി ബന്ധിപ്പിക്കാം.",
            verbalSummaryEnglish:
              "Sorry, doctor slot schedule is temporarily unreachable. Let me connect you with our receptionist.",
            agentInstructions:
              "Doctor slot retrieval failed from HMS. Inform caller and transfer to human receptionist desk.",
          },
          { status: 503 }
        );
      }
    }

    const availableSlots = slots.filter((s) => s.isAvailable);
    const slotTimes = availableSlots.map((s) => s.time);

    // 3. Audit log
    logVoiceAgentToolAudit("CheckAvailability", tenantResult.hospitalConfig.hospitalId, {
      department: resolvedDeptQuery || "ALL",
      doctor: selectedDoctor.doctorName,
      date: targetDate,
      slotsFound: slotTimes.length,
      isSimulated: isSimulate,
    });

    if (slotTimes.length === 0) {
      return NextResponse.json({
        success: true,
        available: false,
        hospitalId: tenantResult.hospitalConfig.hospitalId,
        department: selectedDoctor.department,
        doctor: selectedDoctor.doctorName,
        doctorId: selectedDoctor.doctorId,
        date: targetDate,
        availableSlots: [],
        verbalSummaryMalayalam: `ക്ഷമിക്കണം, ${selectedDoctor.doctorName}-ന് ${targetDate} തീയതിയിൽ സ്ലോട്ടുകൾ ലഭ്യമല്ല. മറ്റൊരു തീയതി പരിശോധിക്കണോ?`,
        verbalSummaryEnglish: `Sorry, no consultation slots are available for ${selectedDoctor.doctorName} on ${targetDate}. Would you like to check another date?`,
        agentInstructions: "All slots for this doctor on the selected date are full. Offer to check the next available consultation day.",
      });
    }

    const displaySlots = slotTimes.slice(0, 3).join(", ");
    return NextResponse.json({
      success: true,
      available: true,
      hospitalId: tenantResult.hospitalConfig.hospitalId,
      department: selectedDoctor.department,
      doctor: selectedDoctor.doctorName,
      doctorId: selectedDoctor.doctorId,
      date: targetDate,
      consultingHours: selectedDoctor.opdDays.join(", "),
      consultationFee: selectedDoctor.consultationFee,
      availableSlots: slotTimes.slice(0, 4),
      verbalSummaryMalayalam: `${selectedDoctor.doctorName} ${targetDate} തീയതിയിൽ ലഭ്യമാണ്. ലഭ്യമായ സമയങ്ങൾ: ${displaySlots}. ഇതിൽ ഏത് സമയമാണ് താങ്കൾക്ക് വേണ്ടത്?`,
      verbalSummaryEnglish: `${selectedDoctor.doctorName} is available on ${targetDate}. Available slots are ${displaySlots}. Which time works best for you?`,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal error querying OPD availability";
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
