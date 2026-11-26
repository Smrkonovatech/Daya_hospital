/**
 * ============================================================================
 * SMRKOMED RECEPTIONIST PRESENCE API: GET & POST /api/v1/receptionist/presence
 * ============================================================================
 *
 * Provides tenant-isolated operational status query and toggle for hospital
 * front desk receptionists.
 */

import { NextRequest, NextResponse } from "next/server";
import { receptionistPresenceService } from "@/lib/services/receptionist-presence-service";
import { getHospitalConfig } from "@/lib/config/hospital-config";
import { z } from "zod";

const setPresenceSchema = z.object({
  hospitalId: z.string().min(1).optional(),
  userId: z.string().min(1, "userId is required"),
  newStatus: z.enum(["AVAILABLE", "RINGING", "ON_CALL", "WRAP_UP", "BREAK", "OFFLINE"]),
  reason: z.string().optional(),
  actor: z.string().optional(),
  staffName: z.string().optional(),
  extension: z.string().optional(),
  phoneNumber: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const headerHospitalId = request.headers.get("x-hospital-id");
    const queryHospitalId = searchParams.get("hospitalId");
    const userId = searchParams.get("userId");

    const hospitalConfig = getHospitalConfig(headerHospitalId || queryHospitalId || undefined);
    const hospitalId = hospitalConfig.hospitalId;

    if (userId) {
      const single = await receptionistPresenceService.getStaffPresence(hospitalId, userId);
      if (!single) {
        return NextResponse.json(
          { success: false, error: `Staff presence not found for userId '${userId}'.` },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, hospitalId, staff: single });
    }

    const staffList = await receptionistPresenceService.getHospitalStaffPresence(hospitalId);

    const summary = {
      total: staffList.length,
      available: staffList.filter((s) => s.status === "AVAILABLE").length,
      ringing: staffList.filter((s) => s.status === "RINGING").length,
      onCall: staffList.filter((s) => s.status === "ON_CALL").length,
      wrapUp: staffList.filter((s) => s.status === "WRAP_UP").length,
      break: staffList.filter((s) => s.status === "BREAK").length,
      offline: staffList.filter((s) => s.status === "OFFLINE").length,
    };

    return NextResponse.json({
      success: true,
      hospitalId,
      summary,
      staff: staffList,
    });
  } catch (error) {
    console.error("GET /api/v1/receptionist/presence error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve receptionist presence." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const headerHospitalId = request.headers.get("x-hospital-id");
    const body = await request.json();

    const parsed = setPresenceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid payload", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const hospitalConfig = getHospitalConfig(parsed.data.hospitalId || headerHospitalId || undefined);
    const hospitalId = hospitalConfig.hospitalId;
    const { userId, newStatus, reason, actor, staffName, extension, phoneNumber } = parsed.data;

    // Check if staff exists, or register if staffName is provided
    let existing = await receptionistPresenceService.getStaffPresence(hospitalId, userId);
    if (!existing && staffName) {
      existing = await receptionistPresenceService.registerStaffPresence({
        hospitalId,
        userId,
        staffName,
        extension,
        phoneNumber,
        initialStatus: newStatus,
      });
      return NextResponse.json({
        success: true,
        hospitalId,
        action: "REGISTERED",
        staff: existing,
      });
    }

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: `Receptionist '${userId}' does not exist in hospital '${hospitalId}'. Pass 'staffName' to register.`,
        },
        { status: 404 }
      );
    }

    const res = await receptionistPresenceService.setStaffPresenceStatus({
      hospitalId,
      userId,
      newStatus,
      reason: reason || "API_STATUS_UPDATE",
      actor: actor || "STAFF_API",
    });

    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      hospitalId,
      staff: res.record,
    });
  } catch (error) {
    console.error("POST /api/v1/receptionist/presence error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update receptionist presence status." },
      { status: 500 }
    );
  }
}
