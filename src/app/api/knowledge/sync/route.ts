import { NextResponse } from "next/server";
import { knowledgeService } from "@/lib/services/knowledge-service";
import { sarvamKnowledgeSync } from "@/lib/integrations/sarvam/knowledge-sync";

export async function GET() {
  try {
    const status = await sarvamKnowledgeSync.getSyncStatus();
    return NextResponse.json({
      success: true,
      syncStatus: status,
      isConfigured: sarvamKnowledgeSync.isConfigured(),
    });
  } catch (error) {
    console.error("GET /api/knowledge/sync error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to inspect Sarvam sync status." },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const syncResult = await knowledgeService.syncWithSarvam();

    return NextResponse.json({
      success: true,
      syncResult,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Sync error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
