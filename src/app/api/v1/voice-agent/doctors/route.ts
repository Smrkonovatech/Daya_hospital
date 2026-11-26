/**
 * ============================================================================
 * SMRKO VOICE TOOL API: DOCTORS DIRECTORY (PHASE 3 / SMRKOMED)
 * ============================================================================
 *
 * Invoked by SMRKO VOICE Engine (@get_doctors / @search_doctors tool) to query
 * available hospital consultants, specialties, qualifications, and consultation fees.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  validateVoiceAgentToolAuth,
  validateHospitalTenant,
  logVoiceAgentToolAudit,
} from "@/lib/integrations/sarvam/voice-agent-auth";
import { integrations } from "@/lib/integrations";

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate request
    const auth = validateVoiceAgentToolAuth(request);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: auth.statusCode || 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const department = searchParams.get("department") || searchParams.get("departmentId") || undefined;
    const query = searchParams.get("query") || searchParams.get("q") || undefined;
    const hospitalId = searchParams.get("hospitalId") || "hosp_daya_thrissur";

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
    let doctors: any[] = [];
    try {
      doctors = await hmsAdapter.getDoctors(department);
    } catch (hmsErr: any) {
      if (!isSimulate) {
        return NextResponse.json(
          {
            success: false,
            error: "HMS_UNAVAILABLE",
            hmsStatus: "DISCONNECTED",
            message: "Grandis HMS API is temporarily unreachable (site-to-site VPN pending).",
            hospitalId: tenantResult.hospitalConfig.hospitalId,
            doctors: [],
            count: 0,
            verbalSummaryMalayalam: "ക്ഷമിക്കണം, ഹോസ്പിറ്റൽ ഡോക്ടർമാരുടെ വിവരങ്ങൾ ഇപ്പോൾ ലഭ്യമാക്കാൻ സാധിക്കുന്നില്ല. ഞങ്ങളുടെ റിസപ്ഷനുമായി ബന്ധിപ്പിക്കാം.",
            verbalSummaryEnglish: "Sorry, doctor directory is temporarily unreachable. Let me connect you with our receptionist.",
          },
          { status: 503 }
        );
      }
    }

    if (query && query.trim()) {
      const q = query.toLowerCase().trim();
      doctors = doctors.filter(
        (d) =>
          d.doctorName.toLowerCase().includes(q) ||
          d.department.toLowerCase().includes(q) ||
          d.qualifications.toLowerCase().includes(q)
      );
    }

    // 3. Audit log
    logVoiceAgentToolAudit("GetDoctors", tenantResult.hospitalConfig.hospitalId, {
      department: department || "ALL",
      query: query || "NONE",
      resultCount: doctors.length,
    });

    return NextResponse.json({
      success: true,
      hospitalId: tenantResult.hospitalConfig.hospitalId,
      department: department || null,
      query: query || null,
      count: doctors.length,
      doctors: doctors.map((d) => ({
        doctorId: d.doctorId,
        doctorName: d.doctorName,
        department: d.department,
        qualifications: d.qualifications,
        opdDays: d.opdDays,
        consultationFee: d.consultationFee,
      })),
      verbalSummaryMalayalam: doctors.length > 0
        ? `${doctors.map((d) => d.doctorName).join(", ")} എന്നിവരാണ് ഈ വിഭാഗത്തിൽ ലഭ്യമായ ഡോക്ടർമാർ.`
        : "ക്ഷമിക്കണം, ഈ വിഭാഗത്തിൽ ഇപ്പോൾ ഡോക്ടർമാരുടെ വിവരങ്ങൾ ലഭ്യമല്ല.",
      verbalSummaryEnglish: doctors.length > 0
        ? `Available consultants are ${doctors.map((d) => d.doctorName).join(", ")}.`
        : "Sorry, no doctors found for this query.",
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal error retrieving doctors";
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 500 }
    );
  }
}
