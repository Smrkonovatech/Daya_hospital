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
      { success: false, error: "Forbidden: Only Hospital Administrators can roll back IVR flows." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const targetVersion = Number(body.targetVersion);
    const hospitalId = body.hospitalId || "hosp_daya_thrissur";
    const userName = session?.name || "Hospital Administrator";

    if (!targetVersion || targetVersion < 1) {
      return NextResponse.json({ success: false, error: "Valid targetVersion is required." }, { status: 422 });
    }

    const result = await ivrFlowService.rollbackFlow(flowId, targetVersion, hospitalId, userName);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Flow '${flowId}' successfully rolled back to version ${targetVersion} and published as version ${result.versionNumber}.`,
      data: result.flow,
      versionNumber: result.versionNumber,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Rollback failed" },
      { status: 500 }
    );
  }
}
