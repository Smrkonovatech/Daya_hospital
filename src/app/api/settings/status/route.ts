import { NextResponse } from "next/server";
import { settingsService } from "@/lib/services/settings-service";
import { checkDatabaseConnection } from "@/lib/db/prisma";

export async function GET() {
  try {
    const [status, dbStatus] = await Promise.all([
      settingsService.getSystemStatusOverview(),
      checkDatabaseConnection(),
    ]);

    const enriched = {
      ...status,
      database: {
        connected: dbStatus.connected,
        provider: "Neon PostgreSQL (Development Free Tier)",
        message: dbStatus.message,
      },
      environmentMode: "DEVELOPMENT_TESTING",
    };

    return NextResponse.json({ success: true, data: enriched });
  } catch (error) {
    console.error("GET /api/settings/status error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve system status." },
      { status: 500 }
    );
  }
}
