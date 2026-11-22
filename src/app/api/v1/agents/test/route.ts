import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, AUTH_COOKIE_NAME } from "@/lib/auth/session";
import { agentService } from "@/lib/services/agent-service";

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
    const hospitalId = body.hospitalId || "hosp_daya_thrissur";
    const agentId = body.agentId || "default";
    const userInput = body.userInput?.trim();
    const language = body.language || "ml-IN";

    if (!userInput) {
      return NextResponse.json({ success: false, error: "User input text is required." }, { status: 422 });
    }

    const result = await agentService.simulateAgentTurn({
      hospitalId,
      agentId,
      userInput,
      language,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Agent test turn failed" },
      { status: 500 }
    );
  }
}
