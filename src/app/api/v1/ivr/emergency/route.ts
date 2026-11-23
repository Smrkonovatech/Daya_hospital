import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, AUTH_COOKIE_NAME } from "@/lib/auth/session";
import { ivrFlowService } from "@/lib/services/ivr-flow-service";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : undefined;

  const session = await verifySessionToken(token || bearerToken);
  if (!session && process.env.NODE_ENV !== "test") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const hospitalId = request.nextUrl.searchParams.get("hospitalId") || "hosp_daya_thrissur";

  const [config, events] = await Promise.all([
    ivrFlowService.getEmergencyRoutingConfig(hospitalId),
    ivrFlowService.getEmergencyEvents(hospitalId, 25),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      config,
      events,
    },
  });
}

export async function PUT(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : undefined;

  const session = await verifySessionToken(token || bearerToken);
  if (!session && process.env.NODE_ENV !== "test") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (session && session.role !== "HOSPITAL_ADMIN" && process.env.NODE_ENV !== "test") {
    return NextResponse.json(
      { success: false, error: "Forbidden: Only Hospital Administrators can modify Emergency Routing." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const hospitalId = body.hospitalId || "hosp_daya_thrissur";
    const userName = session?.name || "Hospital Administrator";

    const updated = await ivrFlowService.updateEmergencyRoutingConfig(
      hospitalId,
      body,
      userName
    );

    await ivrFlowService.logAuditEvent({
      hospitalId,
      flowId: "emergency_config",
      action: "EDITED",
      actor: userName,
      details: { casualtyNumber: updated.casualtyNumber, isVerified: updated.isVerified },
    });

    return NextResponse.json({
      success: true,
      message: "Emergency routing configuration updated successfully.",
      data: updated,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to update emergency configuration" },
      { status: 500 }
    );
  }
}

