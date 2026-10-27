import { NextRequest, NextResponse } from "next/server";
import { actionsService, ActionFilterParams } from "@/lib/services/actions-service";
import { actionsQuerySchema } from "@/lib/validations/query-schema";
import { ActionWebhookEvent } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const queryObj: Record<string, string | undefined> = {};
    searchParams.forEach((val, key) => {
      queryObj[key] = val;
    });

    const parsed = actionsQuerySchema.safeParse(queryObj);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid query parameters",
          details: parsed.error.format(),
        },
        { status: 400 }
      );
    }

    const params: ActionFilterParams = {
      searchQuery: parsed.data.search,
      status: parsed.data.status,
      actionType: parsed.data.actionType,
      page: parsed.data.page,
      limit: parsed.data.limit,
    };

    const result = await actionsService.getActions(params);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
    if ((error as { digest?: string })?.digest === "NEXT_PRERENDER_INTERRUPTED") {
      throw error;
    }
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
