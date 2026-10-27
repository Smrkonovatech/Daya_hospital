import { NextRequest, NextResponse } from "next/server";
import { userService } from "@/lib/services/user-service";
import { verifySessionToken, AUTH_COOKIE_NAME } from "@/lib/auth/session";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
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
          error: "Forbidden: Only Hospital Administrators can update staff permissions.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const updated = userService.updateUser(id, body, session.userId);

    return NextResponse.json({
      success: true,
      message: "Staff permissions updated successfully.",
      data: updated,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Update failed";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
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
          error: "Forbidden: Only Hospital Administrators can deactivate staff accounts.",
        },
        { status: 403 }
      );
    }

    const deactivated = userService.deactivateUser(id, session.userId);

    return NextResponse.json({
      success: true,
      message: `Account for ${deactivated.name} has been deactivated.`,
      data: deactivated,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Deactivation failed";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
