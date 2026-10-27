import { NextRequest, NextResponse } from "next/server";
import { settingsService } from "@/lib/services/settings-service";
import { verifySessionToken, AUTH_COOKIE_NAME } from "@/lib/auth/session";
import { hospitalSettingsSchema } from "@/lib/validations/auth-schema";

export async function GET() {
  try {
    const settings = settingsService.getSettings();
    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error("GET /api/settings error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch settings." },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    const session = await verifySessionToken(token);

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please log in first." },
        { status: 401 }
      );
    }

    // Role-based access control enforcement on the server
    if (session.role !== "HOSPITAL_ADMIN") {
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden: Only Hospital Administrators can modify hospital privacy and calling settings.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = hospitalSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: parsed.error.format(),
        },
        { status: 400 }
      );
    }

    const updated = settingsService.updateSettings(
      parsed.data,
      session.role,
      session.name
    );

    return NextResponse.json({
      success: true,
      message: "Hospital privacy and calling settings saved successfully.",
      data: updated,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
