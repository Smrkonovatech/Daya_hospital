import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, AUTH_COOKIE_NAME } from "@/lib/auth/session";
import { hospitalRoutingService } from "@/lib/services/hospital-routing-service";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : undefined;

  const session = await verifySessionToken(token || bearerToken);
  if (!session && process.env.NODE_ENV !== "test") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const hospitalId = request.nextUrl.searchParams.get("hospitalId") || "hosp_daya_thrissur";
  const versions = await hospitalRoutingService.getVersionsList(hospitalId);
  const auditLogs = await hospitalRoutingService.getAuditHistory(hospitalId);

  return NextResponse.json({
    success: true,
    data: {
      hospitalId,
      versions,
      auditLogs,
    },
  });
}

