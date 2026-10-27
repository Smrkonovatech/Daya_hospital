import { NextResponse } from "next/server";
import { integrations } from "@/lib/integrations";
import { checkDatabaseConnection } from "@/lib/db/prisma";

export async function GET() {
  try {
    const [health, dbStatus] = await Promise.all([
      integrations.getAllHealthStatuses(),
      checkDatabaseConnection(),
    ]);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      database: {
        connected: dbStatus.connected,
        isDemoMode: dbStatus.isDemoMode,
        message: dbStatus.message,
      },
      health,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Health check failed",
      },
      { status: 500 }
    );
  }
}
