import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExotelTelephonyAdapter } from "./exotel-adapter";
import { InboundCallEvent } from "./standard-telephony-types";

describe("ExotelTelephonyAdapter", () => {
  let adapter: ExotelTelephonyAdapter;

  beforeEach(() => {
    adapter = new ExotelTelephonyAdapter({
      hospitalId: "hosp_daya_thrissur",
      accountSid: "test_account_sid_123",
      apiKey: "test_api_key_456",
      apiToken: "test_api_token_789",
      subdomain: "api",
      defaultAppId: "app_daya_voicebot_v1",
      defaultExoPhone: "+914872475000",
      webhookSecret: "test_webhook_secret_daya",
    });
  });

  describe("Health Check", () => {
    it("reports healthy in sandbox mode when API credentials are placeholders", async () => {
      const sandboxAdapter = new ExotelTelephonyAdapter({
        accountSid: "placeholder_sid",
        apiKey: "placeholder_key",
        apiToken: "placeholder_token",
      });
      const health = await sandboxAdapter.healthCheck();
      expect(health.status).toBe("HEALTHY");
      expect(health.mode).toBe("MOCK_SANDBOX");
      expect(health.details).toContain("Sandbox");
    });

    it("pings Exotel API when configured with production credentials", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ Account: { Sid: "test_account_sid_123", Status: "active" } }),
      });

      const health = await adapter.healthCheck();
      expect(health.status).toBe("HEALTHY");
      expect(health.mode).toBe("PRODUCTION");
      expect(health.details).toContain("test_account_sid_123");
    });

    it("handles Exotel API error gracefully", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const health = await adapter.healthCheck();
      expect(health.status).toBe("DEGRADED");
      expect(health.mode).toBe("PRODUCTION");
      expect(health.details).toContain("HTTP 401");
    });
  });

  describe("Outbound Call Initiation", () => {
    it("initiates an outbound call successfully via Exotel REST API", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          Call: {
            Sid: "call_exo_999888",
            AccountSid: "test_account_sid_123",
            Status: "in-progress",
            Direction: "outbound-api",
            From: "09846012345",
            To: "+914872475000",
            DateCreated: "2026-11-21T19:30:00Z",
          },
        }),
      });

      const res = await adapter.initiateOutboundCall({
        from: "09846012345",
        to: "+914872475000",
        callerId: "+914872475000",
        customField: "hosp_daya_thrissur:reminder",
      });

      expect(res.success).toBe(true);
      expect(res.callSid).toBe("call_exo_999888");
      expect(res.status).toBe("in-progress");
      expect(res.direction).toBe("outbound-api");
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("handles Exotel REST error response properly", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          RestException: {
            Status: 400,
            Message: "Cannot call unverified number in trial account",
          },
        }),
      });

      const res = await adapter.initiateOutboundCall({
        from: "09846000000",
        to: "+914872475000",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("unverified number");
    });
  });

  describe("Call Status Details Mapping", () => {
    it("maps Exotel statuses to internal standard call states", async () => {
      const testCases = [
        { raw: "completed", expected: "COMPLETED" },
        { raw: "busy", expected: "BUSY" },
        { raw: "no-answer", expected: "NO_ANSWER" },
        { raw: "failed", expected: "FAILED" },
        { raw: "ringing", expected: "RINGING" },
        { raw: "in-progress", expected: "AI_CONNECTED" },
      ];

      for (const tc of testCases) {
        global.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            Call: {
              Sid: "call_test",
              AccountSid: "test_account",
              Status: tc.raw,
              Duration: "120",
              Direction: "inbound",
              RecordingUrl: "https://audio.exotel.com/rec_123.mp3",
            },
          }),
        });

        const details = await adapter.getCallDetails("call_test");
        expect(details).not.toBeNull();
        expect(details?.status).toBe(tc.expected);
        expect(details?.durationSeconds).toBe(120);
        expect(details?.recordingUrl).toBe("https://audio.exotel.com/rec_123.mp3");
      }
    });
  });

  describe("Call Routing Decision Engine", () => {
    it("routes clinical emergencies immediately to 24/7 Casualty desk", () => {
      const event: InboundCallEvent = {
        event_id: "evt_1",
        call_id: "call_1",
        hospital_id: "hosp_daya_thrissur",
        called_number: "+914872475000",
        caller_number: "+919447100000",
        timestamp: new Date().toISOString(),
        initial_intent: "EMERGENCY_AMBULANCE",
        hop_count: 1,
      };

      const decision = adapter.evaluateCallRouting(event);
      expect(decision.action).toBe("ROUTE_TO_CASUALTY");
      expect(decision.destination_id).toBe("+914872475100");
    });

    it("routes appointment inquiries to Exotel Voicebot Applet", () => {
      const event: InboundCallEvent = {
        event_id: "evt_2",
        call_id: "call_2",
        hospital_id: "hosp_daya_thrissur",
        called_number: "+914872475000",
        caller_number: "+919447100000",
        timestamp: new Date().toISOString(),
        initial_intent: "DOCTOR_SLOT_BOOKING",
        hop_count: 1,
      };

      const decision = adapter.evaluateCallRouting(event);
      expect(decision.action).toBe("FORWARD_TO_AI");
      expect(decision.destination_id).toBe("app_daya_voicebot_v1");
    });

    it("rejects loops if hops exceed limit", () => {
      const event: InboundCallEvent = {
        event_id: "evt_3",
        call_id: "call_3",
        hospital_id: "hosp_daya_thrissur",
        called_number: "+914872475000",
        caller_number: "+919447100000",
        timestamp: new Date().toISOString(),
        initial_intent: "APPOINTMENT",
        hop_count: 4,
      };

      const decision = adapter.evaluateCallRouting(event);
      expect(decision.action).toBe("REJECT_LOOP");
      expect(decision.destination_id).toBe("EXT_100");
    });
  });

  describe("Webhook Signature & Parsing", () => {
    it("verifies static secret token query parameter", () => {
      const verified = adapter.verifyWebhookSignature("raw_body", "test_webhook_secret_daya");
      expect(verified).toBe(true);
    });

    it("rejects invalid signature token", () => {
      const verified = adapter.verifyWebhookSignature("raw_body", "wrong_token");
      expect(verified).toBe(false);
    });

    it("parses StatusCallback payload accurately", () => {
      const payload = {
        CallSid: "call_exo_888",
        From: "09447100000",
        To: "+914872475000",
        Status: "completed",
        Duration: "145",
        RecordingUrl: "https://audio.exotel.com/rec_888.mp3",
        Direction: "outbound-api",
      };

      const event = adapter.parseWebhookPayload(payload);
      expect(event).not.toBeNull();
      expect(event?.call_id).toBe("call_exo_888");
      if (event && "state" in event) {
        expect(event.state).toBe("COMPLETED");
        expect(event.duration_seconds).toBe(145);
        expect(event.recording_url).toBe("https://audio.exotel.com/rec_888.mp3");
        expect(event.direction).toBe("OUTBOUND");
      }
    });
  });
});

