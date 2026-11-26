/**
 * ============================================================================
 * SMRKOMED TOOL API: GET HOSPITAL CONTEXT (PHASE 10)
 * ============================================================================
 *
 * Invoked by Sarvam Voice Agents (via On-Start API Hook or @get_hospital_context tool)
 * to retrieve dynamic, tenant-specific hospital metadata:
 * - Hospital name, location, and official branding
 * - Regular OPD consulting hours & visiting policies
 * - Active specialty departments & extensions
 * - 24/7 Casualty & emergency instructions
 *
 * Strictly tenant-isolated: reads from Neon DB or HospitalRoutingService.
 */

import { NextRequest, NextResponse } from "next/server";
import { hospitalRoutingService } from "@/lib/services/hospital-routing-service";
import {
  validateVoiceAgentToolAuth,
  validateHospitalTenant,
  logVoiceAgentToolAudit,
} from "@/lib/integrations/sarvam/voice-agent-auth";

export async function GET(request: NextRequest) {
  // 1. Authenticate request
  const auth = validateVoiceAgentToolAuth(request);
  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.statusCode || 401 }
    );
  }

  // 2. Identify & validate tenant
  const searchParams = request.nextUrl.searchParams;
  const rawHospitalId =
    searchParams.get("hospitalId") ||
    request.headers.get("x-hospital-id") ||
    request.headers.get("x-tenant-id") ||
    "hosp_daya_thrissur";

  const tenantResult = validateHospitalTenant(rawHospitalId);
  if (!tenantResult.valid) {
    return NextResponse.json(
      { success: false, error: tenantResult.error },
      { status: 400 }
    );
  }

  const hospitalConfig = tenantResult.hospitalConfig;
  const routingConfig = await hospitalRoutingService.getPublishedVersion(hospitalConfig.hospitalId);

  // 3. Audit log
  logVoiceAgentToolAudit("GetContext", hospitalConfig.hospitalId, {
    action: "READ_HOSPITAL_CONTEXT",
    version: routingConfig?.versionNumber || 1,
  });

  const contextData = {
    hospitalId: hospitalConfig.hospitalId,
    hospitalName: hospitalConfig.hospitalName,
    shortName: hospitalConfig.shortName,
    city: hospitalConfig.city,
    state: hospitalConfig.state,
    isVerifiedLive: hospitalConfig.isVerified === true,
    operatingHours: {
      opd: "08:00 - 17:00 (Monday to Saturday)",
      casualty: "24 Hours (7 Days a week)",
      pharmacy: "24 Hours",
      laboratory: "24 Hours",
    },
    visitingHours: "16:00 - 19:00 (Inpatient Wards)",
    departments: (routingConfig?.departmentDestinations || []).map((dept) => ({
      id: dept.id,
      name: dept.name,
      extension: dept.extension,
      priority: dept.priority || 1,
    })),
    emergencyNotice: "Casualty and Trauma Care unit is open 24/7. Chest pain and acute trauma patients receive immediate priority triage.",
    disclaimer: "Strict healthcare safeguard: Voice agent is not authorized to give medical prescriptions or diagnoses.",
    versionNumber: routingConfig?.versionNumber || 1,
  };

  return NextResponse.json(
    {
      success: true,
      data: contextData,
    },
    {
      headers: {
        "Content-Type": "application/json",
        "X-SMRKOMED-Tenant": hospitalConfig.hospitalId,
      },
    }
  );
}

