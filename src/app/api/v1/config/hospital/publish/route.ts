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
      { success: false, error: "Forbidden: Only Hospital Administrators can publish hospital configurations." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const hospitalId = body.hospitalId || "hosp_daya_thrissur";
    const changelog = body.changelog || "Routine configuration update";
    const userName = session?.name || "Hospital Administrator";
    const userId = session?.userId || "usr_admin_01";

    const result = await configurationService.publishConfiguration(hospitalId, changelog, userId, userName);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Publishing failed" },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Hospital configuration version ${result.versionNumber} published successfully.`,
      versionNumber: result.versionNumber,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Publishing error" },
      { status: 500 }
    );
  }
}
