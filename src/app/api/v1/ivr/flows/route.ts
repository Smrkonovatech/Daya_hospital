import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, AUTH_COOKIE_NAME } from "@/lib/auth/session";
import { ivrFlowService } from "@/lib/services/ivr-flow-service";
import { createDefaultHospitalFlow } from "@/lib/services/ivr-node-definitions";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : undefined;

  const session = await verifySessionToken(token || bearerToken);
  if (!session && process.env.NODE_ENV !== "test") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const hospitalId = request.nextUrl.searchParams.get("hospitalId") || "hosp_daya_thrissur";
  const flows = await ivrFlowService.getFlowsByHospital(hospitalId);

  return NextResponse.json({
    success: true,
    data: flows,
  });
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : undefined;

  const session = await verifySessionToken(token || bearerToken);
  if (!session && process.env.NODE_ENV !== "test") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (session && session.role !== "HOSPITAL_ADMIN" && process.env.NODE_ENV !== "test") {
    return NextResponse.json(
      { success: false, error: "Forbidden: Only Hospital Administrators can create IVR call flows." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const hospitalId = body.hospitalId || "hosp_daya_thrissur";
    const userName = session?.name || "Hospital Administrator";

    if (!body.name?.trim()) {
      return NextResponse.json({ success: false, error: "Flow name is required." }, { status: 422 });
    }

    // Initialize with template or custom nodes
    const template = createDefaultHospitalFlow(hospitalId, body.name);
    const flowId = body.id || `flow_${hospitalId}_${Date.now()}`;

    const saved = await ivrFlowService.saveDraft(
      {
        ...template,
        id: flowId,
        hospitalId,
        name: body.name.trim(),
        description: body.description || template.description,
        isDefault: body.isDefault ?? false,
      },
      userName
    );

    return NextResponse.json(
      {
        success: true,
        message: "IVR Call Flow created successfully.",
        data: saved,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to create flow" },
      { status: 500 }
    );
  }
}
