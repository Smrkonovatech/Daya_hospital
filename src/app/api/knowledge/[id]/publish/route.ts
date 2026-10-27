import { NextRequest, NextResponse } from "next/server";
import { knowledgeService } from "@/lib/services/knowledge-service";

import { verifySessionToken, AUTH_COOKIE_NAME } from "@/lib/auth/session";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    const session = await verifySessionToken(token);

    // If an active session is present and user is Staff, reject with 403 Forbidden
    if (session && session.role !== "HOSPITAL_ADMIN") {
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden: Only Hospital Administrators are authorised to publish knowledge articles to live AI grounding.",
        },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));

    const authorName =
      session?.name || body.authorName || "Dr. Anjali Menon (Authorized Medical Reviewer)";
    const changeNote =
      body.changeNote || "Authorized clinical publication to AI voice grounding context.";

    const published = knowledgeService.publishArticle(id, authorName, changeNote);

    return NextResponse.json({
      success: true,
      message: `Version ${published.version} published to live voice grounding context.`,
      data: published,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
