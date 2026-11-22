import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifySessionToken, AUTH_COOKIE_NAME } from "@/lib/auth/session";
import { exotelTelephonyService } from "@/lib/services/exotel-telephony-service";
import { getHospitalConfig } from "@/lib/config/hospital-config";

// Standardized Outbound Call Request Schema per SMRKOMED Phase 1 Specification
const standardOutboundCallSchema = z.object({
  hospitalId: z.string().min(1, "hospitalId is required"),
  patientId: z.string().min(1, "patientId is required"),
  phoneNumber: z.string().min(10, "phoneNumber must have at least 10 digits"),
  purpose: z.string().min(1, "purpose is required").default("APPOINTMENT_CONFIRMATION"),
  mode: z.enum(["AI", "HUMAN"]).optional().default("AI"),
  language: z.string().optional().default("ml-IN"),
  context: z.record(z.string(), z.unknown()).optional(),
  idempotencyKey: z.string().min(1, "idempotencyKey is required"),
});

export async function POST(request: NextRequest) {
  const correlationId =
    request.headers.get("x-correlation-id") ||
    request.headers.get("x-request-id") ||
    `corr_out_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // 1. Authentication & Permission Checks
  const cookieToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : undefined;
  const apiKeyHeader = request.headers.get("x-api-key");

  let isAuthenticated = false;

  // Session token auth (dashboard UI or browser client)
  if (cookieToken || bearerToken) {
    const session = await verifySessionToken(cookieToken || bearerToken);
    if (session) {
      isAuthenticated = true;
    }
  }

  // Server-to-server API Key Auth (HMS / External integration)
  const masterApiKey = process.env.SMRKOMED_API_KEY || process.env.VOICE_GATEWAY_AUTH_SECRET;
  if (!isAuthenticated && apiKeyHeader && masterApiKey && apiKeyHeader === masterApiKey) {
    isAuthenticated = true;
  }

  // Allow development/test bypass if environment explicitly configured
  if (!isAuthenticated && process.env.NODE_ENV === "test") {
    // Check if test header is present or authorization was attempted
    if (request.headers.get("x-bypass-auth") === "true") {
      isAuthenticated = true;
    }
  }

  if (!isAuthenticated) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized: Valid session token (Bearer or cookie) or X-API-Key required",
        correlationId,
      },
      { status: 401, headers: { "x-correlation-id": correlationId } }
    );
  }

  // 2. Validate Request Body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON request body", correlationId },
      { status: 400, headers: { "x-correlation-id": correlationId } }
    );
  }

  const parseResult = standardOutboundCallSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Validation failed",
        details: parseResult.error.flatten().fieldErrors,
        correlationId,
      },
      { status: 422, headers: { "x-correlation-id": correlationId } }
    );
  }

  const { hospitalId, patientId, phoneNumber, purpose, mode, language, context, idempotencyKey } =
    parseResult.data;

  // 3. Resolve & Verify Hospital Tenant
  const hospital = getHospitalConfig(hospitalId);
  if (!hospital) {
    return NextResponse.json(
      { success: false, error: `Hospital tenant "${hospitalId}" not found`, correlationId },
      { status: 404, headers: { "x-correlation-id": correlationId } }
    );
  }

  // 4. Validate Phone Number & Emergency Safety Guard
  const phoneNorm = exotelTelephonyService.normalizePhoneNumber(phoneNumber);
  if (!phoneNorm.isValid) {
    return NextResponse.json(
      { success: false, error: phoneNorm.error || "Invalid phone number", correlationId },
      { status: 422, headers: { "x-correlation-id": correlationId } }
    );
  }

  if (exotelTelephonyService.isProtectedEmergencyDestination(phoneNorm.e164, hospital)) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Emergency destination number (+91 96066 54032) cannot be used as an outbound patient destination.",
        correlationId,
      },
      { status: 422, headers: { "x-correlation-id": correlationId } }
    );
  }

  // 5. Dispatch Call via Unified ExotelTelephonyService
  const result = await exotelTelephonyService.initiateCall({
    hospitalId: hospital.hospitalId,
    patientId,
    phoneNumber: phoneNorm.e164,
    purpose,
    mode,
    language,
    context,
    idempotencyKey,
    correlationId,
  });

  if (!result.success) {
    if (result.status === "RATE_LIMITED") {
      return NextResponse.json(
        { success: false, error: result.error, correlationId },
        { status: 429, headers: { "x-correlation-id": correlationId, "Retry-After": "60" } }
      );
    }

    return NextResponse.json(
      { success: false, error: result.error || "Failed to initiate outbound call", correlationId },
      { status: 502, headers: { "x-correlation-id": correlationId } }
    );
  }

  const responseStatus = result.isDuplicateReplay ? 200 : 201;
  return NextResponse.json(result, {
    status: responseStatus,
    headers: { "x-correlation-id": correlationId },
  });
}

