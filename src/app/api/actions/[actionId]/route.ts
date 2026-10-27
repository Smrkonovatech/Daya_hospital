import { NextRequest, NextResponse } from "next/server";
import { actionsService } from "@/lib/services/actions-service";

interface RouteContext {
  params: Promise<{ actionId: string }>;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { actionId } = await context.params;
    const action = await actionsService.getActionById(actionId);

    if (!action) {
      return NextResponse.json(
        { success: false, error: "Action not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      action,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { actionId } = await context.params;
    const body = await request.json();

    const updated = await actionsService.updateStaffReview(actionId, {
      reviewerName: body.reviewerName || "Hospital Staff Reviewer",
      reviewerId: body.reviewerId || "staff_admin",
      notes: body.notes,
      assignedStaff: body.assignedStaff,
      markReviewed: body.markReviewed,
      markResolved: body.markResolved,
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Action not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      action: updated,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
