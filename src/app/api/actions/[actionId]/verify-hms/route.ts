import { NextRequest, NextResponse } from "next/server";
import { actionsService } from "@/lib/services/actions-service";

interface RouteContext {
  params: Promise<{ actionId: string }>;
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { actionId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const reviewerName = body.reviewerName || "Hospital Staff Reviewer";

    const result = await actionsService.verifyWithHms(actionId, reviewerName);

    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
