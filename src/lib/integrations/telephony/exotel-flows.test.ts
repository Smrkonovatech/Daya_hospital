import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as outboundCallHandler } from "@/app/api/calls/outbound/route";
import { POST as exotelWebhookHandler } from "@/app/api/webhooks/exotel/route";
import { createSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth/session";
import { systemRepository } from "@/lib/repositories/system-repository";
import { callsService } from "@/lib/services/calls-service";

describe("Exotel End-to-End API Flows (Phase 6 & 7)", () => {
  let authCookieValue: string;

  beforeEach(async () => {
    systemRepository.clearInMemoryWebhooks();

    // Create valid test auth session
    authCookieValue = await createSessionToken({
      userId: "usr_admin_01",
      name: "Dr. Anjali Menon",
      email: "admin@dayahospital.com",
      role: "HOSPITAL_ADMIN",
      department: "Medical Admin",
      canAccessRecordings: true,
    });
  });

  describe("Outbound Call API (/api/calls/outbound)", () => {
    it("rejects unauthenticated requests with 401 Unauthorized", async () => {
      const req = new NextRequest("http://localhost:3000/api/calls/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toNumber: "+919447100000",
        }),
      });

      const res = await outboundCallHandler(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain("Unauthorized");
    });

    it("validates phone number and rejects malformed numbers with 422", async () => {
      const req = new NextRequest("http://localhost:3000/api/calls/outbound", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${authCookieValue}`,
        },
        body: JSON.stringify({
          toNumber: "12345", // invalid format
        }),
      });

      const res = await outboundCallHandler(req);
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.error).toBe("Validation failed");
    });

    it("successfully initiates outbound call and records it in the call ledger", async () => {
      const req = new NextRequest("http://localhost:3000/api/calls/outbound", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${authCookieValue}`,
        },
        body: JSON.stringify({
          toNumber: "+919846018392",
          patientName: "Valsala Kumari",
          purpose: "APPOINTMENT_REMINDER",
          doctorName: "Dr. Suresh Kumar",
          scheduledSlot: "10:30 AM",
        }),
      });

      const res = await outboundCallHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.direction).toBe("OUTBOUND");
      expect(json.callSid).toBeDefined();

      // Verify the new call is in the ledger
      const recorded = await callsService.getCallById(json.callId);
      expect(recorded).not.toBeNull();
      expect(recorded?.direction).toBe("OUTBOUND");
      expect(recorded?.callerName).toBe("Valsala Kumari");
      expect(recorded?.provider).toBe("EXOTEL");
    });
  });

  describe("Exotel Webhook Receiver (/api/webhooks/exotel)", () => {
    it("rejects unauthorized webhook if signature verification fails", async () => {
      const req = new NextRequest("http://localhost:3000/api/webhooks/exotel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-exotel-signature": "invalid_wrong_token",
        },
        body: JSON.stringify({
          CallSid: "exo_call_123",
          Status: "completed",
        }),
      });

      const res = await exotelWebhookHandler(req);
      expect(res.status).toBe(401);
    });

    it("processes valid Exotel StatusCallback webhook and updates call status", async () => {
      const callSid = `exo_hook_${Date.now()}`;

      // First create a call in the ledger
      await callsService.createCallRecord({
        id: `call_${Date.now()}`,
        externalCallId: callSid,
        callerNumber: "+919447100000",
        callerName: "Ramesh Babu",
        startTime: new Date().toISOString(),
        callStatus: "ANSWERED",
        direction: "OUTBOUND",
        provider: "EXOTEL",
      });

      // Send Exotel StatusCallback
      const req = new NextRequest("http://localhost:3000/api/webhooks/exotel", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          CallSid: callSid,
          From: "+919447100000",
          To: "+914872475000",
          Status: "completed",
          Duration: "185",
          RecordingUrl: `https://audio.exotel.com/rec_${callSid}.mp3`,
          Direction: "outbound-api",
        }).toString(),
      });

      const res = await exotelWebhookHandler(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.received).toBe(true);
      expect(json.status).toBe("COMPLETED");

      // Verify call record in repository was updated
      const updated = await callsService.getCallById(callSid);
      expect(updated).not.toBeNull();
      expect(updated?.durationSeconds).toBe(185);
      expect(updated?.recordingUrl).toBe(`https://audio.exotel.com/rec_${callSid}.mp3`);
    });

    it("detects and prevents duplicate webhook events idempotently", async () => {
      const callSid = `exo_dup_${Date.now()}`;
      const payload = JSON.stringify({
        CallSid: callSid,
        Status: "completed",
        Duration: "120",
      });

      const req1 = new NextRequest("http://localhost:3000/api/webhooks/exotel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-exotel-event-id": `evt_unique_${callSid}`,
        },
        body: payload,
      });

      const res1 = await exotelWebhookHandler(req1);
      expect(res1.status).toBe(200);

      // Repeat same request
      const req2 = new NextRequest("http://localhost:3000/api/webhooks/exotel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-exotel-event-id": `evt_unique_${callSid}`,
        },
        body: payload,
      });

      const res2 = await exotelWebhookHandler(req2);
      expect(res2.status).toBe(200);
      const json2 = await res2.json();
      expect(json2.status).toBe("ALREADY_PROCESSED_IDEMPOTENT");
    });
  });
});

