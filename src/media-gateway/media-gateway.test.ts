import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WebSocket as WsClient } from "ws";
import { AudioEngine, AudioPlaybackQueue } from "./audio-engine";
import { TenantResolver } from "./tenant-resolver";
import { CallMediaSession, MediaSessionManager } from "./session-manager";
import { AgentStreamMediaGateway } from "./server";

describe("AudioEngine (Phase 4)", () => {
  let audioEngine: AudioEngine;

  beforeEach(() => {
    audioEngine = new AudioEngine({
      minChunkBytes: 3200,
      maxChunkBytes: 100000,
      chunkMultipleBytes: 320,
      enforceMinimum: true,
      sampleRate: 8000,
    });
  });

  it("decodes Base64 encoded audio into a raw PCM buffer", () => {
    const rawBuffer = Buffer.from([0x00, 0x10, 0x20, 0x30]);
    const base64 = rawBuffer.toString("base64");
    const decoded = audioEngine.decodeBase64Audio(base64);

    expect(decoded).toEqual(rawBuffer);
    expect(decoded.length).toBe(4);
  });

  it("encodes raw PCM buffer to Base64 string", () => {
    const rawBuffer = Buffer.from([0x01, 0x02, 0x03, 0x04]);
    const encoded = audioEngine.encodeBase64Audio(rawBuffer);

    expect(encoded).toBe(rawBuffer.toString("base64"));
  });

  it("validates 16-bit alignment (must be multiple of 2 bytes)", () => {
    const oddBuffer = Buffer.alloc(321); // Odd length
    const res = audioEngine.validatePcmChunk(oddBuffer);

    expect(res.valid).toBe(false);
    expect(res.error).toContain("PCM alignment error");
  });

  it("validates multiple of 320 bytes constraint (20ms frames at 8kHz 16-bit)", () => {
    const nonMultipleBuffer = Buffer.alloc(3202); // 3202 % 320 !== 0
    const res = audioEngine.validatePcmChunk(nonMultipleBuffer);

    expect(res.valid).toBe(false);
    expect(res.error).toContain("Frame multiple error");
  });

  it("enforces minimum chunk size of 3,200 bytes (3.2k) when enabled", () => {
    const smallChunk = Buffer.alloc(640); // 2 frames = 640 bytes < 3200
    const res = audioEngine.validatePcmChunk(smallChunk, { enforceMinimum: true });

    expect(res.valid).toBe(false);
    expect(res.error).toContain("Chunk too small");
  });

  it("accepts valid chunks (e.g. 3,200 bytes multiple of 320)", () => {
    const validChunk = Buffer.alloc(3200); // exactly 10 frames of 320 bytes
    const res = audioEngine.validatePcmChunk(validChunk);

    expect(res.valid).toBe(true);
    expect(res.byteLength).toBe(3200);
    expect(res.sampleCount).toBe(1600);
    expect(res.durationMs).toBe(200); // 200 ms
  });

  it("aligns any unaligned audio buffer to the nearest 320-byte boundary with silence padding", () => {
    const unaligned = Buffer.alloc(400); // 400 % 320 = 80 remainder, needs 240 padding
    const aligned = audioEngine.alignPcmToFrame(unaligned, 320);

    expect(aligned.length).toBe(640); // nearest 320-byte multiple
    expect(aligned.length % 320).toBe(0);
  });

  it("splits a large audio buffer into compliant 3,200-byte chunks", () => {
    const largeBuffer = Buffer.alloc(9600); // 3 chunks of 3200
    const chunks = audioEngine.splitIntoExotelChunks(largeBuffer, 3200);

    expect(chunks.length).toBe(3);
    for (const chunk of chunks) {
      expect(chunk.length).toBe(3200);
      expect(chunk.length % 320).toBe(0);
    }
  });

  it("generates silent PCM and sine tones of exact duration", () => {
    const silence = audioEngine.generateSilentPcm(200, 8000);
    expect(silence.length).toBe(3200);

    const tone = audioEngine.generateSineTonePcm(440, 200, 8000);
    expect(tone.length).toBe(3200);
  });
});

describe("AudioPlaybackQueue (Phase 4)", () => {
  it("enqueues and dequeues audio chunks in FIFO order", () => {
    const queue = new AudioPlaybackQueue("stream_test_1");
    const chunk1 = Buffer.alloc(3200, 1);
    const chunk2 = Buffer.alloc(3200, 2);

    queue.enqueue(chunk1);
    queue.enqueue(chunk2);

    expect(queue.hasPending()).toBe(true);
    expect(queue.getPendingCount()).toBe(2);

    const out1 = queue.dequeue();
    expect(out1).toEqual(chunk1);

    const out2 = queue.dequeue();
    expect(out2).toEqual(chunk2);

    expect(queue.hasPending()).toBe(false);
  });

  it("clears pending audio and stops playback immediately upon interruption (barge-in)", () => {
    const queue = new AudioPlaybackQueue("stream_test_1");
    queue.enqueue(Buffer.alloc(3200));
    queue.enqueue(Buffer.alloc(3200));

    expect(queue.getPendingCount()).toBe(2);

    queue.clear();

    expect(queue.getPendingCount()).toBe(0);
    expect(queue.hasPending()).toBe(false);
  });
});

describe("TenantResolver (Phase 5 - Multi-Hospital Compatibility)", () => {
  let resolver: TenantResolver;

  beforeEach(() => {
    resolver = new TenantResolver();
  });

  it("resolves Daya Hospital tenant from dialed ExoPhone (+91 487 2475000)", () => {
    const result = resolver.resolveTenant({
      streamSid: "stream_1",
      callSid: "call_1",
      accountSid: "acc_exotel_daya",
      to: "+914872475000",
      from: "+919447100000",
    });

    expect(result.verified).toBe(true);
    expect(result.hospitalId).toBe("hosp_daya_thrissur");
    expect(result.resolutionSource).toBe("PHONE_NUMBER");
  });

  it("resolves tenant from ExoPhone with leading zero (04872475000)", () => {
    const result = resolver.resolveTenant({
      streamSid: "stream_2",
      callSid: "call_2",
      accountSid: "acc_exotel_daya",
      to: "04872475000",
      from: "09447100000",
    });

    expect(result.verified).toBe(true);
    expect(result.hospitalId).toBe("hosp_daya_thrissur");
  });

  it("overrides mismatched untrusted client customField with trusted phone mapping", () => {
    const result = resolver.resolveTenant({
      streamSid: "stream_3",
      callSid: "call_3",
      accountSid: "acc_exotel_daya",
      to: "+914872475000",
      from: "+919447100000",
      customField: "untrusted_spoofed_hospital_999",
    });

    // Security invariant: Phone owner takes precedence over untrusted external customField
    expect(result.hospitalId).toBe("hosp_daya_thrissur");
    expect(result.warning).toContain("Mismatch");
  });

  it("falls back to default Daya Hospital pilot when called number is unknown", () => {
    const result = resolver.resolveTenant({
      streamSid: "stream_4",
      callSid: "call_4",
      accountSid: "unknown_account",
      to: "+919999999999",
      from: "+918888888888",
    });

    expect(result.hospitalId).toBe("hosp_daya_thrissur");
    expect(result.verified).toBe(false);
    expect(result.resolutionSource).toBe("DEFAULT_FALLBACK");
  });
});

describe("CallMediaSession & MediaSessionManager (Phase 3 & 4)", () => {
  let sessionManager: MediaSessionManager;
  let mockSocket: {
    send: ReturnType<typeof vi.fn>;
    readyState: number;
  };

  beforeEach(() => {
    sessionManager = new MediaSessionManager();
    mockSocket = {
      send: vi.fn(),
      readyState: 1, // WebSocket.OPEN
    };
  });

  it("manages session lifecycle: connect, media, dtmf, mark, interrupt, stop", () => {
    const session = new CallMediaSession({
      streamSid: "stream_sess_01",
      callSid: "call_sess_01",
      accountSid: "acc_test",
      from: "+919447100000",
      to: "+914872475000",
      socket: mockSocket,
    });

    sessionManager.registerSession(session);
    expect(sessionManager.getActiveSessionCount()).toBe(1);
    expect(session.state).toBe("CONNECTED");

    // Start stream
    session.markStarted();
    expect(session.state).toBe("STREAMING");

    // Incoming media chunk
    const testPcm = Buffer.alloc(3200, 0x55);
    const mediaChunk = {
      chunk: "1",
      timestamp: "1000",
      payload: testPcm.toString("base64"),
    };

    const decoded = session.handleIncomingMedia(mediaChunk);
    expect(decoded).toEqual(testPcm);
    expect(session.audioChunksReceived).toBe(1);
    expect(session.totalIncomingBytes).toBe(3200);

    // Send outbound audio
    const outboundPcm = Buffer.alloc(3200, 0x12);
    const sent = session.sendOutboundAudio(outboundPcm);
    expect(sent).toBe(true);
    expect(mockSocket.send).toHaveBeenCalledTimes(1);

    const sentPayload = JSON.parse(mockSocket.send.mock.calls[0][0]);
    expect(sentPayload.event).toBe("media");
    expect(sentPayload.streamSid).toBe("stream_sess_01");
    expect(sentPayload.media.payload).toBe(outboundPcm.toString("base64"));

    // DTMF handling
    session.handleDtmf("2");
    expect(session.dtmfDigits).toContain("2");

    // Send playback marker
    session.sendMark("greeting_played");
    const markMsg = JSON.parse(mockSocket.send.mock.calls[1][0]);
    expect(markMsg.event).toBe("mark");
    expect(markMsg.mark.name).toBe("greeting_played");

    // Interruption (caller barge-in)
    session.interruptPlayback();
    const clearMsg = JSON.parse(mockSocket.send.mock.calls[2][0]);
    expect(clearMsg.event).toBe("clear");
    expect(clearMsg.streamSid).toBe("stream_sess_01");

    // Session close
    session.close();
    expect(session.state).toBe("STOPPED");
    expect(sessionManager.getActiveSessionCount()).toBe(0);
  });

  it("supports multiple concurrent call sessions without collision", () => {
    const socket1 = { send: vi.fn(), readyState: 1 };
    const socket2 = { send: vi.fn(), readyState: 1 };

    const session1 = new CallMediaSession({
      streamSid: "stream_multi_1",
      callSid: "call_multi_1",
      accountSid: "acc_test",
      from: "+919447100001",
      to: "+914872475000",
      socket: socket1,
    });

    const session2 = new CallMediaSession({
      streamSid: "stream_multi_2",
      callSid: "call_multi_2",
      accountSid: "acc_test",
      from: "+919447100002",
      to: "+914872475000",
      socket: socket2,
    });

    sessionManager.registerSession(session1);
    sessionManager.registerSession(session2);

    expect(sessionManager.getActiveSessionCount()).toBe(2);

    expect(sessionManager.getSessionByStream("stream_multi_1")).toBe(session1);
    expect(sessionManager.getSessionByStream("stream_multi_2")).toBe(session2);

    session1.close();
    expect(sessionManager.getActiveSessionCount()).toBe(1);
    expect(sessionManager.getSessionByStream("stream_multi_2")).toBe(session2);

    session2.close();
    expect(sessionManager.getActiveSessionCount()).toBe(0);
  });
});

describe("AgentStreamMediaGateway HTTP Server (Phase 3 & 12)", () => {
  let gateway: AgentStreamMediaGateway;
  const testPort = 8765;

  beforeEach(async () => {
    gateway = new AgentStreamMediaGateway({
      port: testPort,
      host: "127.0.0.1",
      path: "/exotel/voicebot",
    });
    await gateway.start();
  });

  afterEach(async () => {
    await gateway.stop();
  });

  it("serves health check endpoint at /health", async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/health`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.service).toBe("smrkomed_exotel_media_gateway");
    expect(typeof body.uptimeSeconds).toBe("number");
  });

  it("serves status metadata at / and /status", async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("ONLINE");
    expect(body.streamingPath).toBe("/exotel/voicebot");

    const resStatus = await fetch(`http://127.0.0.1:${testPort}/status`);
    expect(resStatus.status).toBe(200);
    const bodyStatus = await resStatus.json();
    expect(bodyStatus.status).toBe("ONLINE");
    expect(Array.isArray(bodyStatus.activeSessions)).toBe(true);
  });

  it("accepts a live WebSocket handshake on /exotel/voicebot", async () => {
    const ws = new WsClient(`ws://127.0.0.1:${testPort}/exotel/voicebot`);
    const openPromise = new Promise<void>((resolve, reject) => {
      ws.on("open", () => resolve());
      ws.on("error", (err) => reject(err));
    });

    await expect(openPromise).resolves.toBeUndefined();
    ws.close();
  });

  it("handles real Exotel AgentStream message lifecycle (connected -> start -> media -> dtmf -> mark -> stop) over WebSocket", async () => {
    const ws = new WsClient(`ws://127.0.0.1:${testPort}/exotel/voicebot`);
    await new Promise<void>((resolve) => ws.on("open", () => resolve()));

    // 1. Send Exotel 'connected' event
    ws.send(
      JSON.stringify({
        event: "connected",
        protocol: "Call",
        version: "1.0.0",
      })
    );

    // 2. Send Exotel 'start' event
    ws.send(
      JSON.stringify({
        event: "start",
        sequenceNumber: "1",
        streamSid: "stream_live_wire_01",
        start: {
          streamSid: "stream_live_wire_01",
          callSid: "call_live_wire_01",
          accountSid: "acc_exotel_live",
          from: "+919447100000",
          to: "+914872475000",
          mediaFormat: {
            encoding: "audio/x-l16",
            sampleRate: 8000,
            channels: 1,
          },
        },
      })
    );

    // Allow event loop to process start
    await new Promise((r) => setTimeout(r, 50));

    // Verify status reflects active call
    const resStatus = await fetch(`http://127.0.0.1:${testPort}/status`);
    const statusData = await resStatus.json();
    expect(statusData.activeSessions.length).toBe(1);
    expect(statusData.activeSessions[0].callSid).toBe("call_live_wire_01");
    expect(statusData.activeSessions[0].hospitalId).toBe("hosp_daya_thrissur");

    // 3. Send Exotel 'media' event with valid PCM chunk
    const testAudio = Buffer.alloc(3200, 0x42);
    ws.send(
      JSON.stringify({
        event: "media",
        sequenceNumber: "2",
        streamSid: "stream_live_wire_01",
        media: {
          chunk: "1",
          timestamp: "1000",
          payload: testAudio.toString("base64"),
        },
      })
    );

    // 4. Send Exotel 'dtmf' event
    ws.send(
      JSON.stringify({
        event: "dtmf",
        sequenceNumber: "3",
        streamSid: "stream_live_wire_01",
        dtmf: { digit: "1" },
      })
    );

    // 5. Send Exotel 'mark' event
    ws.send(
      JSON.stringify({
        event: "mark",
        sequenceNumber: "4",
        streamSid: "stream_live_wire_01",
        mark: { name: "prompt_done" },
      })
    );

    // Allow event loop to process media & dtmf
    await new Promise((r) => setTimeout(r, 50));

    const updatedStatus = await (await fetch(`http://127.0.0.1:${testPort}/status`)).json();
    expect(updatedStatus.activeSessions[0].chunksReceived).toBe(1);
    expect(updatedStatus.activeSessions[0].dtmfCount).toBe(1);

    // 6. Send Exotel 'stop' event
    ws.send(
      JSON.stringify({
        event: "stop",
        sequenceNumber: "5",
        streamSid: "stream_live_wire_01",
        stop: {
          callSid: "call_live_wire_01",
          accountSid: "acc_exotel_live",
        },
      })
    );

    await new Promise((r) => setTimeout(r, 50));

    // Session should be closed and removed
    const postStopStatus = await (await fetch(`http://127.0.0.1:${testPort}/status`)).json();
    expect(postStopStatus.activeSessions.length).toBe(0);

    ws.close();
  });

  it("handles multiple concurrent real WebSocket connections and cleans up on disconnect", async () => {
    const ws1 = new WsClient(`ws://127.0.0.1:${testPort}/exotel/voicebot`);
    const ws2 = new WsClient(`ws://127.0.0.1:${testPort}/exotel/voicebot`);

    await Promise.all([
      new Promise<void>((r) => ws1.on("open", () => r())),
      new Promise<void>((r) => ws2.on("open", () => r())),
    ]);

    ws1.send(
      JSON.stringify({
        event: "start",
        sequenceNumber: "1",
        streamSid: "stream_conc_01",
        start: {
          streamSid: "stream_conc_01",
          callSid: "call_conc_01",
          accountSid: "acc_01",
          from: "+919447100001",
          to: "+914872475000",
          mediaFormat: { encoding: "audio/x-l16", sampleRate: 8000, channels: 1 },
        },
      })
    );

    ws2.send(
      JSON.stringify({
        event: "start",
        sequenceNumber: "1",
        streamSid: "stream_conc_02",
        start: {
          streamSid: "stream_conc_02",
          callSid: "call_conc_02",
          accountSid: "acc_02",
          from: "+919447100002",
          to: "+914872475000",
          mediaFormat: { encoding: "audio/x-l16", sampleRate: 8000, channels: 1 },
        },
      })
    );

    await new Promise((r) => setTimeout(r, 50));

    const statusRes = await (await fetch(`http://127.0.0.1:${testPort}/status`)).json();
    expect(statusRes.activeSessions.length).toBe(2);

    // Disconnect ws1
    ws1.close();
    await new Promise((r) => setTimeout(r, 50));

    const statusAfterOne = await (await fetch(`http://127.0.0.1:${testPort}/status`)).json();
    expect(statusAfterOne.activeSessions.length).toBe(1);
    expect(statusAfterOne.activeSessions[0].callSid).toBe("call_conc_02");

    // Disconnect ws2
    ws2.close();
    await new Promise((r) => setTimeout(r, 50));

    const finalStatus = await (await fetch(`http://127.0.0.1:${testPort}/status`)).json();
    expect(finalStatus.activeSessions.length).toBe(0);
  });
});
