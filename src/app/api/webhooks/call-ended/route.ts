import { NextRequest, NextResponse } from "next/server";

// Track processed webhook event IDs to prevent duplicate actions on retries
const processedEvents = new Set<string>();

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const eventId = request.headers.get("x-daya-event-id") || request.headers.get("idempotency-key");
    const signature = request.headers.get("x-sarvam-signature");

    // Scaffolding for webhook signature verification when secret is configured
    if (process.env.SARVAM_WEBHOOK_SECRET && !signature) {
      return NextResponse.json({ error: "Missing webhook signature" }, { status: 401 });
    }

    if (eventId && processedEvents.has(eventId)) {
      return NextResponse.json({
        received: true,
        status: "ALREADY_PROCESSED_IDEMPOTENT",
        eventId,
      });
    }

    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON webhook payload" },
        { status: 400 }
      );
    }

    if (eventId) {
      processedEvents.add(eventId);
    }

    return NextResponse.json({
      received: true,
      status: "EVENT_PROCESSED_SAFELY",
      timestamp: new Date().toISOString(),
      callId: payload.callId || payload.sessionId || "call_received",
    });
  } catch (error) {
    return NextResponse.json(
      {
        received: false,
        error: error instanceof Error ? error.message : "Webhook processing error",
      },
      { status: 500 }
    );
  }
}
