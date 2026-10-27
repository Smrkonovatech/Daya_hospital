import { NextResponse } from "next/server";
import { integrations } from "@/lib/integrations";

export async function GET() {
  try {
    const health = await integrations.getAllHealthStatuses();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
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
