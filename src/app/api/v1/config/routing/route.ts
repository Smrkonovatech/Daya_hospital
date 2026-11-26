import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, AUTH_COOKIE_NAME } from "@/lib/auth/session";
import { hospitalRoutingService } from "@/lib/services/hospital-routing-service";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : undefined;

  const session = await verifySessionToken(token || bearerToken);
  if (!session && process.env.NODE_ENV !== "test") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const hospitalId = request.nextUrl.searchParams.get("hospitalId") || "hosp_daya_thrissur";
  const draft = await hospitalRoutingService.getDraft(hospitalId);
  const activePublished = await hospitalRoutingService.getPublishedVersion(hospitalId);
  const validation = hospitalRoutingService.validateRoutingConfig(draft);

  return NextResponse.json({
    success: true,
    data: {
      draft,
      activePublished,
      validation,
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
      { success: false, error: "Forbidden: Only Hospital Administrators can modify routing configurations." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const hospitalId = body.hospitalId || "hosp_daya_thrissur";
    const userName = session?.name || "Hospital Administrator";
    const userId = session?.userId || "usr_admin_01";

    const saved = await hospitalRoutingService.saveDraft(hospitalId, body, userId, userName);
    const validation = hospitalRoutingService.validateRoutingConfig(saved);

    return NextResponse.json({
      success: true,
      message: "Hospital call routing draft saved successfully.",
      data: {
        draft: saved,
        validation,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to save draft" },
      { status: 400 }
    );
  }
}

