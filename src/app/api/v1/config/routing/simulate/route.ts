import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, AUTH_COOKIE_NAME } from "@/lib/auth/session";
import { hospitalRoutingService } from "@/lib/services/hospital-routing-service";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : undefined;

  const session = await verifySessionToken(token || bearerToken);
  if (!session && process.env.NODE_ENV !== "test") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const hospitalId = body.hospitalId || "hosp_daya_thrissur";
    const escalationType = body.escalationType || "HUMAN_TRANSFER";
    const departmentId = body.departmentId;
    const simulatedTimeIso = body.simulatedTimeIso;
    const versionNumber = body.versionNumber ? Number(body.versionNumber) : undefined;

    const simulation = await hospitalRoutingService.simulateRouting({
      hospitalId,
      escalationType,
      departmentId,
      simulatedTimeIso,
      versionNumber,
    });

    return NextResponse.json({
      success: true,
      data: simulation,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Simulation failed" },
      { status: 400 }
    );
  }
}

