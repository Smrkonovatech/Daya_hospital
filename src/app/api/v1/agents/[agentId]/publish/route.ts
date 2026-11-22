import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, AUTH_COOKIE_NAME } from "@/lib/auth/session";
import { agentService } from "@/lib/services/agent-service";

interface RouteParams {
  params: Promise<{ agentId: string }>;
}

export async function POST(request: NextRequest, props: RouteParams) {
  const { agentId } = await props.params;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : undefined;

  const session = await verifySessionToken(token || bearerToken);
  if (!session && process.env.NODE_ENV !== "test") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (session && session.role !== "HOSPITAL_ADMIN" && process.env.NODE_ENV !== "test") {
    return NextResponse.json(
      { success: false, error: "Forbidden: Only Hospital Administrators can publish AI Voice Agents." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const hospitalId = body.hospitalId || "hosp_daya_thrissur";
    const changelog = body.changelog || "Published updated agent configuration";
    const userName = session?.name || "Hospital Administrator";

    const res = await agentService.publishAgent(agentId, hospitalId, changelog, userName);

    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      message: `Agent version ${res.versionNumber} published successfully.`,
      versionNumber: res.versionNumber,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Publishing error" },
      { status: 500 }
    );
  }
}
