import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, AUTH_COOKIE_NAME } from "@/lib/auth/session";
import { ivrFlowService } from "@/lib/services/ivr-flow-service";
import { IvrFlowExecutionEngine, StepInputEvent } from "@/lib/services/ivr-flow-engine";
import { FlowExecutionContext } from "@/lib/types/ivr-flow";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ flowId: string }> }
) {
  const { flowId } = await context.params;
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
    const flow = await ivrFlowService.getFlowById(flowId, hospitalId);

    if (!flow) {
      return NextResponse.json({ success: false, error: `Flow '${flowId}' not found.` }, { status: 404 });
    }

    const callerNumber = body.callerNumber || "+919447199999";
    const callSid = body.callSid || `sim_call_${Date.now()}`;
    const initialLanguage = body.language || "ml-IN";
    const inputEvent: StepInputEvent = body.input || { type: "START_CALL" };

    let currentContext: FlowExecutionContext = body.context;
    if (!currentContext) {
      currentContext = IvrFlowExecutionEngine.initializeContext(
        flow,
        callSid,
        callerNumber,
        hospitalId,
        initialLanguage
      );
    }

    const simulatedDate = body.simulationTimestamp ? new Date(body.simulationTimestamp) : new Date();

    const stepResult = IvrFlowExecutionEngine.executeStep(
      flow,
      currentContext,
      inputEvent,
      simulatedDate
    );

    return NextResponse.json({
      success: true,
      data: stepResult,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Simulation step failed" },
      { status: 500 }
    );
  }
}
