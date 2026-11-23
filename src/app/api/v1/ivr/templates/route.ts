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

  const templates = ivrFlowService.getFlowTemplates();

  return NextResponse.json({
    success: true,
    data: templates,
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

  try {
    const body = await request.json();
    const templateId = body.templateId;
    const hospitalId = body.hospitalId || "hosp_daya_thrissur";
    const hospitalName = body.hospitalName || "Daya Hospital Thrissur";
    const userName = session?.name || "Hospital Administrator";

    if (!templateId) {
      return NextResponse.json(
        { success: false, error: "templateId is required." },
        { status: 422 }
      );
    }

    const cloned = await ivrFlowService.cloneFromTemplate(
      templateId,
      hospitalId,
      hospitalName,
      body.overrides,
      userName
    );

    return NextResponse.json(
      {
        success: true,
        message: `Cloned template '${templateId}' successfully.`,
        data: cloned,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to clone template" },
      { status: 500 }
    );
  }
}

