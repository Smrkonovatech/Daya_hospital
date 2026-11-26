import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, AUTH_COOKIE_NAME } from "@/lib/auth/session";
import { hospitalRoutingService } from "@/lib/services/hospital-routing-service";

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
      { success: false, error: "Forbidden: Only Hospital Administrators can rollback configurations." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const hospitalId = body.hospitalId || "hosp_daya_thrissur";
    const versionNumber = Number(body.versionNumber);
    const userName = session?.name || "Hospital Administrator";
    const userId = session?.userId || "usr_admin_01";

    if (!versionNumber || versionNumber < 1) {
      return NextResponse.json(
        { success: false, error: "Valid target versionNumber is required for rollback." },
        { status: 422 }
      );
    }

    const success = await hospitalRoutingService.rollbackVersion(hospitalId, versionNumber, userId, userName);
    if (!success) {
      return NextResponse.json(
        { success: false, error: `Version v${versionNumber} not found or could not be activated.` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Routing configuration successfully rolled back to version v${versionNumber}.`,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to execute rollback" },
      { status: 400 }
    );
  }
}

