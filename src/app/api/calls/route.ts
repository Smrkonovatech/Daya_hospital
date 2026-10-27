import { NextRequest, NextResponse } from "next/server";
import { callsService, CallFilterParams } from "@/lib/services/calls-service";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const params: CallFilterParams = {
    searchQuery: searchParams.get("q") || searchParams.get("search") || undefined,
    dateRange: searchParams.get("dateRange") || undefined,
    status: searchParams.get("status") || undefined,
    intent: searchParams.get("intent") || undefined,
    language: searchParams.get("language") || undefined,
    actionType: searchParams.get("actionType") || undefined,
    followUp: searchParams.get("followUp") || undefined,
    durationRange: searchParams.get("durationRange") || undefined,
    sortBy: (searchParams.get("sortBy") as CallFilterParams["sortBy"]) || "startTime",
    sortOrder: (searchParams.get("sortOrder") as "asc" | "desc") || "desc",
    page: parseInt(searchParams.get("page") || "1", 10),
    limit: parseInt(searchParams.get("limit") || "8", 10),
  };

  const result = await callsService.getCalls(params);

  return NextResponse.json({
    success: true,
    ...result,
  });
}
