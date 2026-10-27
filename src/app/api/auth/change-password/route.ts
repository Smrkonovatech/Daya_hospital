import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, AUTH_COOKIE_NAME } from "@/lib/auth/session";
import { userService } from "@/lib/services/user-service";
import { changePasswordSchema } from "@/lib/validations/auth-schema";

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    const session = await verifySessionToken(token);

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please log in first." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = changePasswordSchema.safeParse(body);

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

    const { currentPassword, newPassword } = parsed.data;
    const success = userService.changePassword(
      session.userId,
      currentPassword,
      newPassword
    );

    if (!success) {
      return NextResponse.json(
        { success: false, error: "Current password does not match our records." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Password changed successfully.",
    });
  } catch (error) {
    console.error("POST /api/auth/change-password error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update password." },
      { status: 500 }
    );
  }
}
