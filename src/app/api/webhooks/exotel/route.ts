import { NextRequest, NextResponse } from "next/server";
import { exotelTelephonyService } from "@/lib/services/exotel-telephony-service";
import { exotelAdapter } from "@/lib/integrations";

export async function POST(request: NextRequest) {
  let rawBody = "";
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: "Failed to read request body" }, { status: 400 });
  }

  const correlationId =
    request.headers.get("x-correlation-id") ||
    request.headers.get("x-request-id") ||
    `corr_wh_${Date.now()}`;

  // Process through Unified ExotelTelephonyService
  const result = await exotelTelephonyService.processWebhookEvent(
    rawBody,
    request.headers,
    request.nextUrl.searchParams
  );

  if (!result.received && result.status === "INVALID_SIGNATURE") {
    return NextResponse.json(
      { error: result.message || "Invalid webhook authentication signature", status: "UNAUTHORIZED" },
      { status: 401, headers: { "x-correlation-id": correlationId } }
    );
  }

  if (!result.received && result.status === "ERROR") {
    return NextResponse.json(
      { error: result.message || "Bad Request", status: "BAD_REQUEST" },
      { status: 400, headers: { "x-correlation-id": correlationId } }
    );
  }

  return NextResponse.json(
    {
      received: true,
      status: result.rawState || result.status,
      callSid: result.callSid,
      eventId: result.eventId,
      message: result.message || "Exotel event processed successfully",
      timestamp: new Date().toISOString(),
    },
    { status: 200, headers: { "x-correlation-id": correlationId } }
  );
}

// Some Exotel flow applets ping GET on StatusCallback
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const payload: Record<string, unknown> = {};
  for (const [key, value] of searchParams.entries()) {
    payload[key] = value;
  }

  const normalized = exotelAdapter.parseWebhookPayload(payload);
  if (!normalized) {
    return NextResponse.json({ status: "OK", message: "Exotel webhook ping acknowledged" });
  }

  return NextResponse.json({
    received: true,
    callSid: normalized.call_id,
    hospitalId: normalized.hospital_id,
  });
}
