import { NextRequest, NextResponse } from "next/server";
import { userService } from "@/lib/services/user-service";
import { checkAuthRateLimit, recordFailedAttempt, resetRateLimit } from "@/lib/auth/rate-limit";
import { createSessionToken, AUTH_COOKIE_NAME, SESSION_DURATION_HOURS } from "@/lib/auth/session";
import { loginSchema } from "@/lib/validations/auth-schema";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
    const body = await request.json();

    // 1. Zod input validation
    const parsed = loginSchema.safeParse(body);
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

    const { email, password } = parsed.data;
    const rateLimitKey = `${ip}:${email.toLowerCase().trim()}`;

    // 2. Rate limiting check
    const rateLimit = checkAuthRateLimit(rateLimitKey);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many failed login attempts. Please wait ${rateLimit.retryAfterSecs} seconds before trying again.`,
          retryAfterSecs: rateLimit.retryAfterSecs,
        },
        { status: 429 }
      );
    }

    // 3. Authenticate with salted scrypt hash verification
    const user = await userService.authenticate(email, password, ip);
    if (!user) {
      const failStatus = recordFailedAttempt(rateLimitKey);
      return NextResponse.json(
        {
          success: false,
          error: "Invalid hospital email or password.",
          remainingAttempts: Math.max(0, 5 - (failStatus.blocked ? 5 : 1)),
        },
        { status: 401 }
      );
    }

    // 4. Reset rate limiter on successful auth
    resetRateLimit(rateLimitKey);

    // 5. Generate secure HMAC-SHA256 session token
    const sessionToken = await createSessionToken({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      canAccessRecordings: user.canAccessRecordings,
    });

    // 6. Set HTTP-only secure cookie
    const response = NextResponse.json({
      success: true,
      message: `Welcome back, ${user.name}.`,
      user,
    });

    const isProduction = process.env.NODE_ENV === "production";
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: sessionToken,
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_HOURS * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error("POST /api/auth/login error:", error);
    return NextResponse.json(
      { success: false, error: "Authentication system error. Please contact Medical Admin." },
      { status: 500 }
    );
  }
}
