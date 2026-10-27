import { NextRequest, NextResponse } from "next/server";
import { knowledgeService } from "@/lib/services/knowledge-service";
import { knowledgeFormSchema } from "@/lib/validations/knowledge-schema";
import { KnowledgeCategory } from "@/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const article = knowledgeService.getArticleById(id);

    if (!article) {
      return NextResponse.json(
        { success: false, error: `Article with ID ${id} not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: article });
  } catch (error) {
    console.error("GET /api/knowledge/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const parseResult = knowledgeFormSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: parseResult.error.format(),
        },
        { status: 400 }
      );
    }

    const data = parseResult.data;
    const authorName = body.authorName || "Hospital Content Editor";

    const updated = knowledgeService.updateDraft(
      id,
      {
        title: data.title,
        titleMalayalam: data.titleMalayalam,
        category: data.category as KnowledgeCategory,
        summary: data.summary,
        content: data.content,
        contentMalayalam: data.contentMalayalam,
        sourceReference: data.sourceReference,
        internalNotes: data.internalNotes,
      },
      authorName
    );

    return NextResponse.json({
      success: true,
      message: updated.hasUnpublishedChanges
        ? "Draft revision saved. Approved live version remains active until publication."
        : "Article updated successfully.",
      data: updated,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const authorName = body.authorName || "Hospital Admin";
    const reason = body.reason || "Archived by authorized hospital staff.";

    const archived = knowledgeService.archiveArticle(id, authorName, reason);

    return NextResponse.json({
      success: true,
      message: "Article successfully archived from active voice grounding.",
      data: archived,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
