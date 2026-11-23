/**
 * ============================================================================
 * EXOTEL PASSTHRU WEBHOOK ROUTE (NEXT.JS MIRROR)
 * ============================================================================
 *
 * Fallback endpoint if Exotel hits the Next.js web application port instead of
 * the standalone Media Gateway port. Inspects database and memory for recent
 * call escalations (EMERGENCY or HUMAN_TRANSFER).
 */

import { NextRequest, NextResponse } from "next/server";
import { mediaSessionManager } from "@/media-gateway/session-manager";
import { prisma, checkDatabaseConnection } from "@/lib/db/prisma";

export async function GET(request: NextRequest) {
  return handlePassthru(request);
}

export async function POST(request: NextRequest) {
  return handlePassthru(request);
}

async function handlePassthru(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  let callSid =
    searchParams.get("CallSid") ||
    searchParams.get("call_sid") ||
    searchParams.get("callSid") ||
    searchParams.get("Sid") ||
    "";
  let callerNumber =
    searchParams.get("From") ||
    searchParams.get("CallFrom") ||
    searchParams.get("from") ||
    "";

  if (request.method === "POST") {
    try {
      const contentType = request.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const json = await request.json();
        callSid = json.CallSid || json.call_sid || json.callSid || callSid;
        callerNumber = json.From || json.CallFrom || json.from || callerNumber;
      } else if (contentType.includes("application/x-www-form-urlencoded")) {
        const formData = await request.formData();
        callSid = (formData.get("CallSid") as string) || (formData.get("call_sid") as string) || callSid;
        callerNumber = (formData.get("From") as string) || (formData.get("CallFrom") as string) || callerNumber;
      }
    } catch (err) {
      console.warn("[NextApi:Passthru] Failed to parse POST payload:", err);
    }
  }

  // 1. Durable mediaSessionManager lookup (checks local cache + Neon DB)
  const escalation = await mediaSessionManager.getEscalation(callSid, callerNumber);
  if (escalation && (escalation.escalationState === "EMERGENCY" || escalation.escalationState === "HUMAN_TRANSFER")) {
    return NextResponse.json(
      {
        status: "PASS",
        statusCode: 200,
        transfer: true,
        action: "CONNECT",
        escalationState: escalation.escalationState,
        destination: escalation.destination,
        reason: escalation.reason,
        callSid: escalation.callSid,
      },
      { status: 200 }
    );
  }

  // 2. Database lookup fallback
  try {
    const dbStatus = await checkDatabaseConnection();
    if (dbStatus.connected && callSid) {
      const action = await prisma.aiAction.findFirst({
        where: {
          OR: [{ externalReference: callSid }, { idempotencyKey: { contains: callSid } }],
          actionType: "TRANSFER_CALL_TO_STAFF",
        },
        orderBy: { createdAt: "desc" },
      });
      if (action) {
        return NextResponse.json(
          {
            status: "PASS",
            statusCode: 200,
            transfer: true,
            action: "CONNECT",
            escalationState: "HUMAN_TRANSFER",
            destination: "+919606654032",
            reason: action.staffNotes || "Staff transfer found in DB ledger",
            callSid,
          },
          { status: 200 }
        );
      }
    }
  } catch {}

  // 3. Normal hangup (HTTP 302 Choice B default / HTTP 410 triggers Exotel Passthru Choice B -> Hangup Applet)
  const failStatusCode = Number(searchParams.get("failCode")) || 302;
  return NextResponse.json(
    {
      status: "FAIL",
      statusCode: failStatusCode,
      transfer: false,
      action: "HANGUP",
      escalationState: "NONE",
      reason: "Normal call completion or no escalation requested",
      callSid: callSid || "unknown",
    },
    {
      status: failStatusCode,
      headers: {
        Location: "#",
      },
    }
  );
}

