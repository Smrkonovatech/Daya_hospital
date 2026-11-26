/**
 * ============================================================================
 * SMRKOMED AI OVERFLOW LOGS & TELEMETRY API
 * Route: GET /api/v1/receptionist/overflow-logs
 * ============================================================================
 *
 * Provides hospital administrators and front desk supervisors with:
 * 1. Log of all calls that overflowed to AI (reasons, timestamps, callers).
 * 2. Operational breakdown of overflow causes (Busy vs Timeout vs Offline).
 * 3. Average ring duration before overflow.
 */

import { NextRequest, NextResponse } from "next/server";
import { aiOverflowService } from "@/lib/services/ai-overflow-service";
import { getHospitalConfig } from "@/lib/config/hospital-config";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const headerHospitalId = request.headers.get("x-hospital-id");
    const queryHospitalId = searchParams.get("hospitalId");
    const limit = Number(searchParams.get("limit")) || 50;

    const hospitalConfig = getHospitalConfig(headerHospitalId || queryHospitalId || undefined);
    const hospitalId = hospitalConfig.hospitalId;

    const recentLogs = await aiOverflowService.getRecentOverflows(hospitalId, limit);
    const analytics = await aiOverflowService.getOverflowAnalytics(hospitalId);

    return NextResponse.json({
      success: true,
      hospitalId,
      analytics: {
        totalOverflows: analytics.totalOverflows,
        byReason: analytics.byReason,
        averageRingDurationSeconds: analytics.averageRingDurationSeconds,
      },
      logs: recentLogs,
    });
  } catch (error) {
    console.error("GET /api/v1/receptionist/overflow-logs error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve AI overflow logs." },
      { status: 500 }
    );
  }
}
