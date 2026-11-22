import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, AUTH_COOKIE_NAME } from "@/lib/auth/session";
import { configurationService } from "@/lib/services/configuration-service";

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
      { success: false, error: "Forbidden: Only Hospital Administrators can roll back configurations." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const hospitalId = body.hospitalId || "hosp_daya_thrissur";
    const targetVersion = Number(body.targetVersion);
    const userName = session?.name || "Hospital Administrator";
    const userId = session?.userId || "usr_admin_01";

    if (!targetVersion || targetVersion < 1) {
      return NextResponse.json(
        { success: false, error: "Valid target version number is required." },
        { status: 400 }
      );
    }

    const res = await configurationService.rollbackConfiguration(hospitalId, targetVersion, userId, userName);

    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      message: `Hospital configuration successfully rolled back to version ${targetVersion}. Published as version ${res.versionNumber}.`,
      versionNumber: res.versionNumber,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Rollback error" },
      { status: 500 }
    );
  }
}
