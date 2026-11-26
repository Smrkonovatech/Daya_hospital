/**
 * ============================================================================
 * SMRKOMED TOOL API: CHECK OPD AVAILABILITY (PHASE 10)
 * ============================================================================
 *
 * Invoked by Sarvam Voice Agents (@check_opd_availability tool) to check
 * doctor consulting hours and appointment slot availability in HMS.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  validateVoiceAgentToolAuth,
  validateHospitalTenant,
  logVoiceAgentToolAudit,
} from "@/lib/integrations/sarvam/voice-agent-auth";

const MOCK_OPD_DOCTORS: Record<string, { doctor: string; specialization: string; timing: string; slotsAvailable: number }> = {
  dept_cardiology: {
    doctor: "Dr. Anand Menon, MD, DM (Cardiology)",
    specialization: "Chief Interventional Cardiologist",
    timing: "09:30 AM - 01:00 PM (Mon-Sat)",
    slotsAvailable: 8,
  },
  dept_ortho: {
    doctor: "Dr. Rajesh Varma, MS (Ortho), MCh",
    specialization: "Senior Orthopedic & Joint Replacement Surgeon",
    timing: "10:00 AM - 02:00 PM (Mon-Sat)",
    slotsAvailable: 12,
  },
  dept_pediatrics: {
    doctor: "Dr. Susan George, MD (Pediatrics)",
    specialization: "Senior Consultant Pediatrician",
    timing: "09:00 AM - 01:30 PM (Mon-Sat)",
    slotsAvailable: 15,
  },
  dept_general_medicine: {
    doctor: "Dr. Harikrishnan, MD (General Medicine)",
    specialization: "Consultant Physician",
    timing: "08:30 AM - 03:00 PM (Mon-Sat)",
    slotsAvailable: 20,
  },
};

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
    const { departmentId, preferredDate, hospitalId = "hosp_daya_thrissur" } = body;

    // 2. Identify & validate tenant
    const tenantResult = validateHospitalTenant(hospitalId);
    if (!tenantResult.valid) {
      return NextResponse.json(
        { success: false, error: tenantResult.error },
        { status: 400 }
      );
    }

    if (!departmentId) {
      return NextResponse.json(
        {
          success: false,
          error: "departmentId is required (e.g. dept_cardiology, dept_ortho, dept_pediatrics)",
        },
        { status: 400 }
      );
    }

    const doctorInfo = MOCK_OPD_DOCTORS[departmentId] || {
      doctor: "Duty Consultant Physician",
      specialization: "General OPD",
      timing: "09:00 AM - 01:00 PM",
      slotsAvailable: 5,
    };

    // 3. Audit log
    logVoiceAgentToolAudit("CheckAvailability", tenantResult.hospitalConfig.hospitalId, {
      departmentId,
      date: preferredDate || "today",
      doctor: doctorInfo.doctor,
      slotsAvailable: doctorInfo.slotsAvailable,
    });

    return NextResponse.json({
      success: true,
      available: doctorInfo.slotsAvailable > 0,
      departmentId,
      hospitalId: tenantResult.hospitalConfig.hospitalId,
      date: preferredDate || new Date().toISOString().split("T")[0],
      doctor: doctorInfo.doctor,
      specialization: doctorInfo.specialization,
      consultingHours: doctorInfo.timing,
      slotsRemaining: doctorInfo.slotsAvailable,
      suggestedSlots: ["10:00 AM", "10:30 AM", "11:15 AM", "12:00 PM"],
      isSimulated: true,
      dataSource: "SIMULATED_MOCK_HMS",
      agentInstructions:
        "CRITICAL CLINICAL SAFEGUARD: Real HMS integration is currently in simulated testing. Inform the caller of doctor consulting timings, but state clearly that real-time live appointment booking cannot yet be confirmed through the automated phone system.",
      disclaimerMalayalam:
        "ദയ ഹോസ്പിറ്റലിലെ ഒ.പി. പരിശോധനാ സമയം ലഭ്യമാണ്. എന്നാൽ ആശുപത്രിയിലെ സിസ്റ്റം പരിശോധന നടക്കുന്നതിനാൽ നേരിട്ടുള്ള ഫൈനൽ ബുക്കിംഗ് ആശുപത്രി റിസപ്ഷൻ വഴി ഉറപ്പുവരുത്തേണ്ടതാണ്.",
      disclaimerEnglish:
        "Doctor consulting hours are available. Since real HMS integration is in testing mode, real-time live appointment booking cannot yet be confirmed over this call.",
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Internal error querying OPD availability",
      },
      { status: 500 }
    );
  }
}

