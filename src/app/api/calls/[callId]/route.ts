import { NextRequest, NextResponse } from "next/server";
import { callsService } from "@/lib/services/calls-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
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
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  const { callId } = await params;

  try {
    const body = await request.json();
    const reviewerName = body.reviewerName || "Staff Reviewer";
    const reviewerId = body.reviewerId || "usr_daya_01";

    const updated = await callsService.updateCallReview(callId, {
      isReviewed: body.isReviewed,
      reviewerName,
      reviewerId,
      notes: body.notes,
      requiresFollowUp: body.requiresFollowUp,
      followUpStatus: body.followUpStatus,
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
