import { NextRequest, NextResponse } from "next/server";
import { knowledgeService } from "@/lib/services/knowledge-service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    const authorName =
      body.authorName || "Dr. Anjali Menon (Authorized Medical Reviewer)";
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
