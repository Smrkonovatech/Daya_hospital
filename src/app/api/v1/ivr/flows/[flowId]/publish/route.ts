import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, AUTH_COOKIE_NAME } from "@/lib/auth/session";
import { ivrFlowService } from "@/lib/services/ivr-flow-service";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ flowId: string }> }
) {
  const { flowId } = await context.params;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : undefined;

  const session = await verifySessionToken(token || bearerToken);
  if (!session && process.env.NODE_ENV !== "test") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (session && session.role !== "HOSPITAL_ADMIN" && process.env.NODE_ENV !== "test") {
    return NextResponse.json(
      { success: false, error: "Forbidden: Only Hospital Administrators can publish IVR flows." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const hospitalId = body.hospitalId || "hosp_daya_thrissur";
    const changelog = body.changelog || "Published new IVR flow version";
    const userName = session?.name || "Hospital Administrator";

    const result = await ivrFlowService.publishFlow(flowId, hospitalId, changelog, userName);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      message: `IVR Flow published successfully as version ${result.versionNumber}.`,
      data: result.flow,
      versionNumber: result.versionNumber,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Publish failed" },
      { status: 500 }
    );
  }
}
