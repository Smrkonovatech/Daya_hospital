import { NextRequest, NextResponse } from "next/server";
import { userService } from "@/lib/services/user-service";
import { verifySessionToken, AUTH_COOKIE_NAME } from "@/lib/auth/session";
import { createUserSchema } from "@/lib/validations/auth-schema";

export async function GET() {
  try {
    const users = userService.getAllUsers();
    return NextResponse.json({ success: true, data: users });
  } catch (error) {
    console.error("GET /api/settings/users error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch hospital users." },
      { status: 500 }
    );
  }
}

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

    if (session.role !== "HOSPITAL_ADMIN") {
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden: Only Hospital Administrators can create new hospital staff accounts.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);

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

    const user = userService.createUser(parsed.data, session.userId);

    return NextResponse.json(
      {
        success: true,
        message: `Staff account for ${user.name} created successfully.`,
        data: user,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to create user.";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
