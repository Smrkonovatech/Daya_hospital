/**
 * ============================================================================
 * SMRKOMED CANONICAL DYNAMIC TELEPHONY PRE-FLIGHT DECISION ENDPOINT
 * Route: GET & POST /api/v1/telephony/routing/decision
 * ============================================================================
 *
 * Configured in Exotel Passthru Applet before connecting:
 * Evaluates business hours, receptionist presence, and AI overflow.
 * Returns instruction to either dial human receptionist or connect to Sarvam AI.
 */

import { NextRequest, NextResponse } from "next/server";
import { dynamicExotelRoutingAdapter } from "@/lib/services/dynamic-exotel-routing-adapter";

export async function GET(request: NextRequest) {
  return handlePreFlightDecision(request);
}

export async function POST(request: NextRequest) {
  return handlePreFlightDecision(request);
}

async function handlePreFlightDecision(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  let callSid =
    searchParams.get("CallSid") ||
    searchParams.get("call_sid") ||
    searchParams.get("callSid") ||
    searchParams.get("Sid") ||
    "";
  let callerNumber =
    searchParams.get("CallFrom") ||
    searchParams.get("From") ||
    searchParams.get("from") ||
    "";
  let dialedNumber =
    searchParams.get("CallTo") ||
    searchParams.get("To") ||
    searchParams.get("to") ||
    "";
  let menuChoice = (searchParams.get("Digits") ||
    searchParams.get("digits") ||
    searchParams.get("choice") ||
    searchParams.get("menuChoice") ||
    "2") as any;
  let hospitalId = searchParams.get("hospitalId") || request.headers.get("x-hospital-id") || undefined;
  let routingToken =
    searchParams.get("token") ||
    searchParams.get("routingToken") ||
    request.headers.get("x-smrko-routing-token") ||
    request.headers.get("x-routing-token") ||
    (request.headers.get("authorization")?.startsWith("Bearer ")
      ? request.headers.get("authorization")?.slice(7)
      : undefined) ||
    undefined;

  if (request.method === "POST") {
    try {
      const contentType = request.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const json = await request.json();
        callSid = json.CallSid || json.call_sid || callSid;
        callerNumber = json.CallFrom || json.From || callerNumber;
        dialedNumber = json.CallTo || json.To || dialedNumber;
        menuChoice = json.Digits || json.digits || json.choice || json.menuChoice || menuChoice;
        hospitalId = json.hospitalId || hospitalId;
        routingToken = json.token || json.routingToken || routingToken;
      } else if (contentType.includes("application/x-www-form-urlencoded")) {
        const formData = await request.formData();
        callSid = (formData.get("CallSid") as string) || callSid;
        callerNumber = (formData.get("CallFrom") as string) || (formData.get("From") as string) || callerNumber;
        dialedNumber = (formData.get("CallTo") as string) || (formData.get("To") as string) || dialedNumber;
        menuChoice = (formData.get("Digits") as any) || (formData.get("digits") as any) || (formData.get("choice") as any) || menuChoice;
        hospitalId = (formData.get("hospitalId") as string) || hospitalId;
        routingToken = (formData.get("token") as string) || (formData.get("routingToken") as string) || routingToken;
      }
    } catch {}
  }

  if (!callSid || !callSid.trim()) {
    return NextResponse.json(
      {
        decision: "FAIL_CLOSED",
        action: "HANGUP",
        error: "MISSING_CALL_SID",
        message: "CallSid is required for dynamic telephony routing decisions.",
      },
      { status: 400 }
    );
  }

  const result = await dynamicExotelRoutingAdapter.evaluatePreFlightDecision({
    callSid,
    callFrom: callerNumber,
    callTo: dialedNumber,
    hospitalId,
    menuChoice,
    routingToken,
  });

  return NextResponse.json({
    success: result.decision !== "FAIL_CLOSED",
    data: result,
  });
}
