import { NextRequest, NextResponse } from "next/server";
import { knowledgeService } from "@/lib/services/knowledge-service";
import { knowledgeFormSchema } from "@/lib/validations/knowledge-schema";
import { KnowledgeCategory, KnowledgeStatus } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || undefined;
    const category = searchParams.get("category") || undefined;
    const status = searchParams.get("status") || undefined;
    const syncStatus = searchParams.get("syncStatus") || undefined;

    const articles = knowledgeService.getArticles({
      query,
      category,
      status,
      syncStatus,
    });

    return NextResponse.json({
      success: true,
      total: articles.length,
      data: articles,
    });
  } catch (error) {
    console.error("GET /api/knowledge error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve knowledge base articles." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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

    const article = knowledgeService.createArticle(
      {
        title: data.title,
        titleMalayalam: data.titleMalayalam,
        category: data.category as KnowledgeCategory,
        summary: data.summary,
        content: data.content,
        contentMalayalam: data.contentMalayalam,
        sourceReference: data.sourceReference,
        internalNotes: data.internalNotes,
        status: data.status as KnowledgeStatus,
      },
      authorName
    );

    return NextResponse.json(
      {
        success: true,
        message: "Article successfully created.",
        data: article,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/knowledge error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create knowledge base article." },
      { status: 500 }
    );
  }
}
