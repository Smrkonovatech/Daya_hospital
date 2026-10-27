import { NextRequest, NextResponse } from "next/server";
import { userService } from "@/lib/services/user-service";
import { passwordResetSchema } from "@/lib/validations/auth-schema";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = passwordResetSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Please provide a valid hospital email address." },
        { status: 400 }
      );
    }

    const result = userService.requestPasswordReset(parsed.data.email);
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/auth/reset-password error:", error);
    return NextResponse.json(
      { success: false, error: "Password reset request failed." },
      { status: 500 }
    );
  }
}
