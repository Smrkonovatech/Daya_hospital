/**
 * ============================================================================
 * PHASE 2.1 — CALL RECORDING AUDIO STREAMING & BYTE-RANGE VERIFICATION TEST SUITE
 * ============================================================================
 *
 * Verifies that GET /api/calls/[callId]/recording:
 * 1. Requires clinical reviewer authorization (fails 401 when unauthorized).
 * 2. Returns HTTP 404 when call session does not exist.
 * 3. Streams genuine binary audio bytes (HTTP 200) with Content-Type: audio/wav,
 *    Accept-Ranges: bytes, and valid Content-Length (not a JSON metadata ticket).
 * 4. Supports HTTP 206 Partial Content byte-range streaming (Range: bytes=start-end)
 *    with correct Content-Range and Content-Length headers for scrubbing and seeking.
 * 5. Returns HTTP 416 Range Not Satisfiable for out-of-bounds byte ranges.
 * 6. Supports ?download=true with Content-Disposition attachment header.
 * 7. Reports precise failure (HTTP 502 Bad Gateway) when carrier upstream (e.g. audio.exotel.com)
 *    is unreachable, without silently crashing or returning fake tickets.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { callsService } from "@/lib/services/calls-service";
import { prisma } from "@/lib/db/prisma";

describe("Phase 2.1 — Telephony Audio Recording Streaming & Byte-Range Contract", () => {
  const validCallId = "call_910";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // 1. Authorization Gate
  // --------------------------------------------------------------------------
  it("1. Fails with 401 UNAUTHORIZED_RECORDING_ACCESS when clinical session/credentials are missing", async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      (process.env as any).NODE_ENV = "production";

      const req = new NextRequest(`http://localhost:3000/api/calls/${validCallId}/recording`, {
        method: "GET",
      });

      const res = await GET(req, { params: Promise.resolve({ callId: validCallId }) });
      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe("UNAUTHORIZED_RECORDING_ACCESS");
    } finally {
      (process.env as any).NODE_ENV = originalEnv;
    }
  });

  // --------------------------------------------------------------------------
  // 2. Non-existent Session
  // --------------------------------------------------------------------------
  it("2. Fails with 404 CALL_NOT_FOUND when callId does not exist", async () => {
    vi.spyOn(callsService, "getCallById").mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost:3000/api/calls/non_existent_call_99999/recording", {
      method: "GET",
      headers: { Authorization: "Bearer authorized_reviewer_token" },
    });

    const res = await GET(req, { params: Promise.resolve({ callId: "non_existent_call_99999" }) });
    expect(res.status).toBe(404);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.code).toBe("CALL_NOT_FOUND");
  });

  // --------------------------------------------------------------------------
  // 3. Full Binary Audio Streaming (HTTP 200)
  // --------------------------------------------------------------------------
  it("3. Returns HTTP 200 with binary audio/wav stream, Accept-Ranges, and Content-Length", async () => {
    vi.spyOn(callsService, "getCallById").mockResolvedValueOnce({
      id: validCallId,
      callerNumber: "+91 98461 •••••",
      startTime: "2026-10-27T08:15:20+05:30",
      durationSeconds: 150,
      callStatus: "ANSWERED",
      callSource: "IVR_ROLLOVER",
      language: "MALAYALAM",
      intentCategory: "DOCTOR_AVAILABILITY",
      aiSummary: "Doctor availability query",
      aiConfidence: 0.97,
      requiresFollowUp: false,
      recordingUrl: `/api/calls/${validCallId}/recording`,
      transcript: [],
      actions: [],
    } as any);

    const req = new NextRequest(`http://localhost:3000/api/calls/${validCallId}/recording`, {
      method: "GET",
      headers: { Authorization: "Bearer authorized_reviewer_token" },
    });

    const res = await GET(req, { params: Promise.resolve({ callId: validCallId }) });
    expect(res.status).toBe(200);

    expect(res.headers.get("content-type")).toBe("audio/wav");
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    const contentLength = res.headers.get("content-length");
    expect(contentLength).toBeDefined();
    expect(Number(contentLength)).toBeGreaterThan(1000);

    const arrayBuffer = await res.arrayBuffer();
    expect(arrayBuffer.byteLength).toBe(Number(contentLength));

    // Verify RIFF WAV magic bytes at start of binary stream
    const headerBytes = new Uint8Array(arrayBuffer.slice(0, 4));
    const magic = String.fromCharCode(...headerBytes);
    expect(magic).toBe("RIFF");
  });

  // --------------------------------------------------------------------------
  // 4. HTTP 206 Partial Content Byte-Range Streaming
  // --------------------------------------------------------------------------
  it("4. Returns HTTP 206 Partial Content with Content-Range when Range: bytes=0-1023 is requested", async () => {
    vi.spyOn(callsService, "getCallById").mockResolvedValueOnce({
      id: validCallId,
      callerNumber: "+91 98461 •••••",
      startTime: "2026-10-27T08:15:20+05:30",
      durationSeconds: 150,
      callStatus: "ANSWERED",
      callSource: "IVR_ROLLOVER",
      language: "MALAYALAM",
      intentCategory: "DOCTOR_AVAILABILITY",
      aiSummary: "Doctor availability query",
      aiConfidence: 0.97,
      requiresFollowUp: false,
      recordingUrl: `/api/calls/${validCallId}/recording`,
      transcript: [],
      actions: [],
    } as any);

    const req = new NextRequest(`http://localhost:3000/api/calls/${validCallId}/recording`, {
      method: "GET",
      headers: {
        Authorization: "Bearer authorized_reviewer_token",
        Range: "bytes=0-1023",
      },
    });

    const res = await GET(req, { params: Promise.resolve({ callId: validCallId }) });
    expect(res.status).toBe(206);

    expect(res.headers.get("content-type")).toBe("audio/wav");
    expect(res.headers.get("content-length")).toBe("1024");
    expect(res.headers.get("content-range")).toMatch(/^bytes 0-1023\/\d+$/);

    const arrayBuffer = await res.arrayBuffer();
    expect(arrayBuffer.byteLength).toBe(1024);
  });

  // --------------------------------------------------------------------------
  // 5. HTTP 416 Range Not Satisfiable
  // --------------------------------------------------------------------------
  it("5. Returns HTTP 416 Range Not Satisfiable when range start exceeds file bounds", async () => {
    vi.spyOn(callsService, "getCallById").mockResolvedValueOnce({
      id: validCallId,
      callerNumber: "+91 98461 •••••",
      startTime: "2026-10-27T08:15:20+05:30",
      durationSeconds: 150,
      callStatus: "ANSWERED",
      callSource: "IVR_ROLLOVER",
      language: "MALAYALAM",
      intentCategory: "DOCTOR_AVAILABILITY",
      aiSummary: "Doctor availability query",
      aiConfidence: 0.97,
      requiresFollowUp: false,
      recordingUrl: `/api/calls/${validCallId}/recording`,
      transcript: [],
      actions: [],
    } as any);

    const req = new NextRequest(`http://localhost:3000/api/calls/${validCallId}/recording`, {
      method: "GET",
      headers: {
        Authorization: "Bearer authorized_reviewer_token",
        Range: "bytes=99999999-",
      },
    });

    const res = await GET(req, { params: Promise.resolve({ callId: validCallId }) });
    expect(res.status).toBe(416);
    expect(res.headers.get("content-range")).toMatch(/^bytes \*\/\d+$/);
  });

  // --------------------------------------------------------------------------
  // 6. Audio Download Header Support
  // --------------------------------------------------------------------------
  it("6. Sets Content-Disposition attachment header when ?download=true is requested", async () => {
    vi.spyOn(callsService, "getCallById").mockResolvedValueOnce({
      id: validCallId,
      callerNumber: "+91 98461 •••••",
      startTime: "2026-10-27T08:15:20+05:30",
      durationSeconds: 150,
      callStatus: "ANSWERED",
      callSource: "IVR_ROLLOVER",
      language: "MALAYALAM",
      intentCategory: "DOCTOR_AVAILABILITY",
      aiSummary: "Doctor availability query",
      aiConfidence: 0.97,
      requiresFollowUp: false,
      recordingUrl: `/api/calls/${validCallId}/recording`,
      transcript: [],
      actions: [],
    } as any);

    const req = new NextRequest(`http://localhost:3000/api/calls/${validCallId}/recording?download=true`, {
      method: "GET",
      headers: { Authorization: "Bearer authorized_reviewer_token" },
    });

    const res = await GET(req, { params: Promise.resolve({ callId: validCallId }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain(`attachment; filename="daya-call-${validCallId}.wav"`);
  });

  // --------------------------------------------------------------------------
  // 7. Precise Failure Reporting for Unreachable Carrier Recording
  // --------------------------------------------------------------------------
  it("7. Returns HTTP 502 Bad Gateway with PROVIDER_RECORDING_FETCH_FAILED when carrier URL is unreachable", async () => {
    const uncommittedCallId = "call_rec_unreachable_carrier";

    vi.spyOn(prisma.recordingMetadata, "findUnique").mockResolvedValueOnce({
      id: "rec_fake_001",
      callId: uncommittedCallId,
      externalSessionId: "exo_sess_uncommitted",
      storageKey: null,
      storageUrl: "https://audio.exotel.com/rec_exo_hook_9910.mp3",
      mimeType: "audio/mp3",
      durationSeconds: 90,
      fileSizeBytes: null,
      hasConsent: true,
      retentionExpiry: new Date(Date.now() + 86400000),
      isArchived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    vi.spyOn(callsService, "getCallById").mockResolvedValueOnce({
      id: uncommittedCallId,
      callerNumber: "+91 94471 •••••",
      startTime: new Date().toISOString(),
      durationSeconds: 90,
      callStatus: "ANSWERED",
      callSource: "IVR_ROLLOVER",
      language: "MALAYALAM",
      intentCategory: "GENERAL_QUERY",
      aiSummary: "Carrier audio test",
      aiConfidence: 0.95,
      requiresFollowUp: false,
      recordingUrl: "/api/calls/" + uncommittedCallId + "/recording",
      transcript: [],
      actions: [],
    } as any);

    const req = new NextRequest(`http://localhost:3000/api/calls/${uncommittedCallId}/recording`, {
      method: "GET",
      headers: { Authorization: "Bearer authorized_reviewer_token" },
    });

    const res = await GET(req, { params: Promise.resolve({ callId: uncommittedCallId }) });
    expect(res.status).toBe(502);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe("PROVIDER_RECORDING_FETCH_FAILED");
    expect(json.message).toContain("audio.exotel.com");
    expect(json.carrierUrl).toContain("audio.exotel.com");
  });
});
