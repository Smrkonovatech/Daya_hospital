import { NextRequest, NextResponse } from "next/server";
import { actionsService, ActionFilterParams } from "@/lib/services/actions-service";
import { ActionWebhookEvent } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const params: ActionFilterParams = {
      searchQuery: searchParams.get("q") || searchParams.get("search") || undefined,
      dateRange: searchParams.get("dateRange") || undefined,
      status: searchParams.get("status") || undefined,
      actionType: searchParams.get("actionType") || searchParams.get("type") || undefined,
      onlyFollowUp: searchParams.get("onlyFollowUp") === "true",
      sortBy: (searchParams.get("sortBy") as ActionFilterParams["sortBy"]) || "requestedAt",
      sortOrder: (searchParams.get("sortOrder") as "asc" | "desc") || "desc",
      page: parseInt(searchParams.get("page") || "1", 10),
      limit: parseInt(searchParams.get("limit") || "8", 10),
    };

    const result = await actionsService.getActions(params);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ActionWebhookEvent = await request.json();

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, error: "Invalid JSON payload." },
        { status: 400 }
      );
    }

    const result = await actionsService.consumeWebhookEvent(body);

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
