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
    const text = body.text?.trim();
    const model = body.model || "bulbul:v3";
    const speaker = body.speaker || "kavitha";
    const languageCode = body.languageCode || "ml-IN";
    const pace = Number(body.pace) || 1.15;

    if (!text) {
      return NextResponse.json({ success: false, error: "Preview text is required." }, { status: 422 });
    }

    const res = await agentService.generateVoicePreview({
      hospitalId,
      text,
      model,
      speaker,
      languageCode,
      pace,
    });

    if (!res.success) {
      const status = res.error?.includes("rate limit") ? 429 : 502;
      return NextResponse.json({ success: false, error: res.error }, { status });
    }

    return NextResponse.json({
      success: true,
      audioBase64: res.audioBase64,
      mimeType: "audio/wav",
      latencyMs: res.latencyMs,
      model,
      speaker,
      languageCode,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Voice preview generation error" },
      { status: 500 }
    );
  }
}
