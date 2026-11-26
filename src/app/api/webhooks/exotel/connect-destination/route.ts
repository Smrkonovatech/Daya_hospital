/**
 * ============================================================================
 * EXOTEL CONNECT APPLET DYNAMIC DESTINATION ENDPOINT (NEXT.JS ROUTE)
 * ============================================================================
 *
 * Carrier Contract:
 * When Exotel Connect Applet is configured with an Application URL under "Dial Whom",
 * it sends an HTTP GET request with query parameters:
 *   CallSid, CallFrom, CallTo, Direction
 *
 * Expected Programmable Connect JSON response structure:
 * {
 *   "fetch_after_attempt": false,
 *   "destination": {
 *     "numbers": ["+919606654032"]
 *   },
 *   "record": true,
 *   "outgoing_phone_number": "08047291658",
 *   "max_ringing_duration": 25
 * }
 *
 * Strict Error Handling (Fails Closed):
 * - Unknown CallSid -> 404 with error JSON
 * - Missing escalation record -> 404 with error JSON
 * - Expired escalation (> 10 mins) -> 404 with error JSON
 * - Unknown tenant -> 404 with error JSON
 * - Unverified tenant (e.g. Aster/KIMS demo sandbox) -> 403 with UNVERIFIED_TENANT_FAIL_CLOSED
 * - Invalid phone number -> 404 with INVALID_PHONE_NUMBER_FAIL_CLOSED
 *
 * Never returns an arbitrary fallback number.
 */

import { NextRequest, NextResponse } from "next/server";
import { dynamicExotelRoutingAdapter } from "@/lib/services/dynamic-exotel-routing-adapter";

export async function GET(request: NextRequest) {
  return handleConnectDestination(request);
}

export async function POST(request: NextRequest) {
  return handleConnectDestination(request);
}

async function handleConnectDestination(request: NextRequest) {
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

  if (request.method === "POST") {
    try {
      const contentType = request.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const json = await request.json();
        callSid = json.CallSid || json.call_sid || callSid;
        callerNumber = json.CallFrom || json.From || callerNumber;
        dialedNumber = json.CallTo || json.To || dialedNumber;
      } else if (contentType.includes("application/x-www-form-urlencoded")) {
        const formData = await request.formData();
        callSid = (formData.get("CallSid") as string) || callSid;
        callerNumber = (formData.get("CallFrom") as string) || (formData.get("From") as string) || callerNumber;
        dialedNumber = (formData.get("CallTo") as string) || (formData.get("To") as string) || dialedNumber;
      }
    } catch {}
  }

  const formatParam = searchParams.get("format") || "";
  const acceptHeader = request.headers.get("accept") || "";
  const format = formatParam === "text" || acceptHeader === "text/plain" ? "text" : "json";
  const hospitalId = searchParams.get("hospitalId") || request.headers.get("x-hospital-id") || undefined;
  const escalationType = (searchParams.get("type") || searchParams.get("escalationType") || undefined) as any;
  const departmentId = searchParams.get("departmentId") || undefined;
  const routingToken =
    searchParams.get("token") ||
    searchParams.get("routingToken") ||
    request.headers.get("x-smrko-routing-token") ||
    request.headers.get("x-routing-token") ||
    (request.headers.get("authorization")?.startsWith("Bearer ")
      ? request.headers.get("authorization")?.slice(7)
      : undefined) ||
    undefined;

  const result = await dynamicExotelRoutingAdapter.resolveConnectDestination({
    callSid,
    callFrom: callerNumber,
    callTo: dialedNumber,
    hospitalId,
    escalationType,
    departmentId,
    format,
    routingToken,
  });

  if (result.textPayload !== undefined) {
    return new NextResponse(result.textPayload, {
      status: result.statusCode,
      headers: result.headers,
    });
  }

  return NextResponse.json(result.jsonPayload, {
    status: result.statusCode,
    headers: result.headers,
  });
}
