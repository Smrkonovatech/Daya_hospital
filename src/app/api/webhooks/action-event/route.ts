import { NextRequest, NextResponse } from "next/server";
import { actionsService } from "@/lib/services/actions-service";
import { ActionWebhookEvent } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const event: ActionWebhookEvent = await request.json();

    if (!event || typeof event !== "object") {
      return NextResponse.json(
        { success: false, error: "Malformed webhook payload." },
        { status: 400 }
      );
    }

    const result = await actionsService.consumeWebhookEvent(event);

    return NextResponse.json(result, {
      status: result.status === "DUPLICATE" ? 200 : 201,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
