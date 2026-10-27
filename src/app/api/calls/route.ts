import { NextRequest, NextResponse } from "next/server";
import { callsService } from "@/lib/services/calls-service";
import { callsQuerySchema } from "@/lib/validations/query-schema";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const queryObj: Record<string, string | undefined> = {};
    searchParams.forEach((val, key) => {
      queryObj[key] = val;
    });

    const parsed = callsQuerySchema.safeParse(queryObj);
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

    const result = await callsService.getCalls(parsed.data);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    if ((error as { digest?: string })?.digest === "NEXT_PRERENDER_INTERRUPTED") {
      throw error;
    }
    console.error("GET /api/calls error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve call records." },
      { status: 500 }
    );
  }
}
