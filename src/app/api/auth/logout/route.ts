import { NextRequest, NextResponse } from "next/server";
import { revokeSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (token) {
      revokeSessionToken(token);
    }

    const response = NextResponse.json({
      success: true,
      message: "Session ended safely.",
    });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: "",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error("POST /api/auth/logout error:", error);
    return NextResponse.json(
      { success: false, error: "Logout error" },
      { status: 500 }
    );
  }
}
