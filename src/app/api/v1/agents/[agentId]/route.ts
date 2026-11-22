import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, AUTH_COOKIE_NAME } from "@/lib/auth/session";
import { agentService } from "@/lib/services/agent-service";

interface RouteParams {
  params: Promise<{ agentId: string }>;
}

export async function GET(request: NextRequest, props: RouteParams) {
  const { agentId } = await props.params;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : undefined;

  const session = await verifySessionToken(token || bearerToken);
  if (!session && process.env.NODE_ENV !== "test") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const hospitalId = request.nextUrl.searchParams.get("hospitalId") || "hosp_daya_thrissur";
  const agent = await agentService.getAgentById(agentId, hospitalId);

  if (!agent) {
    return NextResponse.json({ success: false, error: "Agent not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: agent });
}

export async function PUT(request: NextRequest, props: RouteParams) {
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
      { success: false, error: "Forbidden: Only Hospital Administrators can modify AI Voice Agents." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const hospitalId = body.hospitalId || "hosp_daya_thrissur";
    const userName = session?.name || "Hospital Administrator";

    const updated = await agentService.saveAgent(
      {
        ...body,
        id: agentId,
        hospitalId,
      },
      userName
    );

    return NextResponse.json({
      success: true,
      message: "Agent configuration updated successfully.",
      data: updated,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 }
    );
  }
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
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const action = body.action; // duplicate | toggle_status
    const hospitalId = body.hospitalId || "hosp_daya_thrissur";
    const userName = session?.name || "Hospital Administrator";

    if (action === "duplicate") {
      const duplicated = await agentService.duplicateAgent(agentId, hospitalId, userName);
      if (!duplicated) {
        return NextResponse.json({ success: false, error: "Agent not found" }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        message: "Agent duplicated successfully.",
        data: duplicated,
      });
    }

    if (action === "toggle_status") {
      const toggled = await agentService.toggleAgentStatus(agentId, hospitalId, userName);
      if (!toggled) {
        return NextResponse.json({ success: false, error: "Agent not found" }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        message: `Agent is now ${toggled.status}.`,
        data: toggled,
      });
    }

    return NextResponse.json({ success: false, error: `Unknown action '${action}'` }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Action failed" },
      { status: 500 }
    );
  }
}
