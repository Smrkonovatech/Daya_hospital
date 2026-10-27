import { NextResponse } from "next/server";
import { settingsService } from "@/lib/services/settings-service";

export async function GET() {
  try {
    const status = settingsService.getSystemStatusOverview();
    return NextResponse.json({ success: true, data: status });
  } catch (error) {
    console.error("GET /api/settings/status error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve system status." },
      { status: 500 }
    );
  }
}
