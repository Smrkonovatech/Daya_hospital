import { NextRequest, NextResponse } from "next/server";
import { MOCK_CALL_RECORDS } from "@/lib/mock-data";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const query = searchParams.get("q")?.toLowerCase();

  let results = [...MOCK_CALL_RECORDS];

  if (status && status !== "ALL") {
    results = results.filter((c) => c.callStatus === status);
  }

  if (query) {
    results = results.filter(
      (c) =>
        c.callerNumber.toLowerCase().includes(query) ||
        c.callerName?.toLowerCase().includes(query) ||
        c.aiSummary.toLowerCase().includes(query)
    );
  }

  return NextResponse.json({
    success: true,
    total: results.length,
    calls: results,
  });
}
