import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifySessionToken, AUTH_COOKIE_NAME } from "@/lib/auth/session";
import { exotelTelephonyService } from "@/lib/services/exotel-telephony-service";
import { getHospitalConfig } from "@/lib/config/hospital-config";

const outboundCallSchema = z.object({
  toNumber: z
    .string()
    .min(10, "Phone number must have at least 10 digits")
    .regex(/^(\+91|0)?[6-9]\d{9}$/, "Invalid Indian mobile number format"),
  patientName: z.string().optional().default("Valued Patient"),
  hospitalId: z.string().optional(),
  purpose: z
    .enum([
      "APPOINTMENT_REMINDER",
      "DOCTOR_RESCHEDULE_NOTICE",
      "POST_OP_FOLLOW_UP",
      "LAB_REPORT_READY",
      "GENERAL_TELEPHONY_TEST",
    ])
    .optional()
    .default("APPOINTMENT_REMINDER"),
  doctorName: z.string().optional(),
  scheduledSlot: z.string().optional(),
  customField: z.string().optional(),
});

export async function POST(request: NextRequest) {
  // 1. Authenticate user session
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : undefined;

  const session = await verifySessionToken(token || bearerToken);
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Unauthorized: Active session required to initiate outbound calls" },
      { status: 401 }
    );
  }

  // 2. Validate request payload
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON request body" },
      { status: 400 }
    );
  }

  const parseResult = outboundCallSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Validation failed",
        details: parseResult.error.flatten().fieldErrors,
      },
      { status: 422 }
    );
  }

  const { toNumber, patientName, hospitalId, purpose, doctorName, scheduledSlot, customField } =
    parseResult.data;

  // 3. Resolve hospital tenant
  const hospital = getHospitalConfig(hospitalId);

  // 4. Delegate to Unified ExotelTelephonyService
  const idempotencyKey = `ui_out_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const callResult = await exotelTelephonyService.initiateCall({
    hospitalId: hospital.hospitalId,
    patientId: patientName,
    patientName,
    phoneNumber: toNumber,
    purpose,
    mode: "AI",
    language: "ml-IN",
    context: {
      doctorName,
      scheduledSlot,
      customField,
    },
    idempotencyKey,
  });

  if (!callResult.success) {
    const status = callResult.status === "RATE_LIMITED" ? 429 : 502;
    return NextResponse.json(
      {
        success: false,
        error: callResult.error || "Failed to initiate outbound call with Exotel",
      },
      { status }
    );
  }

  return NextResponse.json({
    success: true,
    message: `Outbound call to ${patientName} initiated successfully via Exotel`,
    callId: callResult.callId,
    callSid: callResult.callSid,
    direction: "OUTBOUND",
    provider: "EXOTEL",
    to: toNumber,
    from: hospital.telephony.exotel?.defaultExoPhone || "08047291658",
    timestamp: callResult.createdAt,
  });
}
