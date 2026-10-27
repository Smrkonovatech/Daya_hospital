import { NextRequest, NextResponse } from "next/server";
import { callsService } from "@/lib/services/calls-service";
import { callReviewUpdateSchema } from "@/lib/validations/query-schema";
import { verifySessionToken, AUTH_COOKIE_NAME } from "@/lib/auth/session";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  try {
    const { callId } = await params;
    const call = await callsService.getCallById(callId);

    if (!call) {
      return NextResponse.json(
        { success: false, error: "Call record not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      call,
    });
  } catch (error) {
    console.error("GET /api/calls/[callId] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve call detail." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  const { callId } = await params;

  try {
    // Validate session if present
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    const session = token ? await verifySessionToken(token) : null;

    const body = await request.json();
    const parsed = callReviewUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid review update payload",
          details: parsed.error.format(),
        },
        { status: 400 }
      );
    }

    const reviewerName =
      session?.name || parsed.data.reviewerName || "Hospital Staff Reviewer";
    const reviewerId =
      session?.userId || parsed.data.reviewerId || "usr_daya_01";

    const updated = await callsService.updateCallReview(callId, {
      isReviewed: parsed.data.isReviewed,
      reviewerName,
      reviewerId,
      notes: parsed.data.notes,
      requiresFollowUp: parsed.data.requiresFollowUp,
      followUpStatus: parsed.data.followUpStatus,
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Call record not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      call: updated,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Invalid request payload",
      },
      { status: 400 }
    );
  }
}
