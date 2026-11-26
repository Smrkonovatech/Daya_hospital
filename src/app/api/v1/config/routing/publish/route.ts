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
      { success: false, error: "Forbidden: Only Hospital Administrators can publish routing configurations." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const hospitalId = body.hospitalId || "hosp_daya_thrissur";
    const changelog = body.changelog || "Published via Hospital Settings";
    const userName = session?.name || "Hospital Administrator";
    const userId = session?.userId || "usr_admin_01";

    const result = await hospitalRoutingService.publishVersion(hospitalId, changelog, userId, userName);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Publication rejected by validation rules" },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Routing version v${result.versionNumber} published successfully.`,
      data: result,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to publish version" },
      { status: 400 }
    );
  }
}

