import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import { actionsService } from "@/lib/services/actions-service";
import { systemRepository } from "@/lib/repositories/system-repository";
import { integrations } from "@/lib/integrations";
import { ActionWebhookEvent } from "@/types";

export async function POST(request: NextRequest) {
  let rawBody = "";
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ success: false, error: "Failed to read request body" }, { status: 400 });
  }

  const signature = request.headers.get("x-sarvam-signature") || "";

  // Verify HMAC signature if signature provided or secret configured
  if (signature) {
    const isValid = integrations.getSarvamAdapter().verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: "Invalid webhook authentication signature" },
        { status: 401 }
      );
    }
  } else if (process.env.SARVAM_WEBHOOK_SECRET) {
    return NextResponse.json(
      { success: false, error: "Missing required webhook signature" },
      { status: 401 }
    );
  }

  let event: ActionWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { success: false, error: "Malformed JSON in webhook payload." },
      { status: 400 }
    );
  }

  if (!event || typeof event !== "object") {
    return NextResponse.json(
      { success: false, error: "Malformed webhook payload." },
      { status: 400 }
    );
  }

  try {
    const result = await actionsService.consumeWebhookEvent(event);

    // Record webhook and audit entry
    const payloadHash = crypto.createHash("sha256").update(rawBody).digest("hex");
    await systemRepository.recordWebhook({
      provider: "sarvam_ai",
      eventType: "action_event",
      externalEventId: event.eventId,
      idempotencyKey: event.idempotencyKey,
      payloadHash,
      status: result.status === "DUPLICATE" ? "DUPLICATE" : "PROCESSED",
    });

    await systemRepository.recordAuditLog({
      entityType: "ACTION_WEBHOOK",
      entityId: result.action?.id || event.eventId || "act_unknown",
      action: `ACTION_EVENT_${result.status}`,
      performedBy: "Sarvam Voice Service",
      details: `Action ${result.action?.id || "N/A"} (${event.actionType}) status: ${result.action?.status}. Result: ${result.status}`,
    });

    return NextResponse.json(result, {
      status: result.status === "DUPLICATE" ? 200 : 201,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
