/**
 * ============================================================================
 * SMRKOMED REAL-TIME MEDIA GATEWAY — EXOTEL AGENTSTREAM WEBSOCKET SERVER
 * ============================================================================
 *
 * Dedicated persistent Node.js service for terminating Exotel Voicebot /
 * AgentStream WebSocket connections, streaming raw PCM audio, and routing calls.
 *
 * Runs outside Vercel Serverless on persistent compute (AWS ECS, Fly.io, Railway).
 */

import * as http from "http";
import { WebSocketServer, WebSocket } from "ws";
import {
  ExotelMediaFormat,
  MediaGatewayConfig,
} from "./types";
import { CallMediaSession, mediaSessionManager } from "./session-manager";
import { AudioEngine } from "./audio-engine";
import { getSarvamConfigSummary } from "./sarvam-config";
import { SarvamTextToSpeechProvider } from "./sarvam-tts";

export class AgentStreamMediaGateway {
  private server: http.Server;
  private wss: WebSocketServer;
  private startTime: number = Date.now();
  private config: MediaGatewayConfig;
  private isShuttingDown = false;

  // Diagnostics and live event ring buffers (capped to prevent memory growth)
  private recentUpgrades: Array<{
    timestamp: string;
    clientIp: string;
    path: string;
    query: string;
    userAgent: string;
    upgraded: boolean;
    error?: string;
  }> = [];

  private recentEvents: Array<{
    timestamp: string;
    event: string;
    streamSid: string;
    callSid: string;
    byteCount?: number;
    details?: string;
  }> = [];

  constructor(options?: Partial<MediaGatewayConfig>) {
    this.config = {
      port: options?.port || Number(process.env.PORT) || Number(process.env.VOICE_GATEWAY_PORT) || 8080,
      host: options?.host || process.env.VOICE_GATEWAY_HOST || "0.0.0.0",
      path: options?.path || "/exotel/voicebot",
      minChunkBytes: options?.minChunkBytes ?? 3200,
      maxChunkBytes: options?.maxChunkBytes ?? 100000,
      chunkMultipleBytes: options?.chunkMultipleBytes ?? 320,
      enforceMinimumChunk: options?.enforceMinimumChunk ?? false,
      sampleRate: options?.sampleRate || 8000,
      channels: options?.channels || 1,
      authSecret: options?.authSecret || process.env.VOICE_GATEWAY_AUTH_SECRET,
      enableDebugLogging: options?.enableDebugLogging ?? process.env.NODE_ENV !== "production",
      echoMode:
        options?.echoMode ??
        (process.env.MEDIA_GATEWAY_ECHO_MODE === "true" ||
          process.env.EXOTEL_ECHO_MODE === "true"),
      autoPlayGreeting:
        options?.autoPlayGreeting ?? process.env.GATEWAY_AUTO_PLAY_GREETING !== "false",
      silenceTimeoutMs:
        options?.silenceTimeoutMs ??
        (process.env.STT_SILENCE_TIMEOUT_MS ? Number(process.env.STT_SILENCE_TIMEOUT_MS) : 400),
      ttsPace:
        options?.ttsPace ??
        (process.env.SARVAM_TTS_PACE ? Number(process.env.SARVAM_TTS_PACE) : 1.15),
    };

    // 1. Create native HTTP server with /health and /status endpoints
    this.server = http.createServer((req, res) => {
      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

      if (url.pathname === "/health" || url.pathname === "/healthz") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            status: "ok",
            service: "smrkomed_exotel_media_gateway",
            activeCalls: mediaSessionManager.getActiveSessionCount(),
            uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
            port: this.config.port,
            timestamp: new Date().toISOString(),
          })
        );
        return;
      }

      if (url.pathname === "/" || url.pathname === "/status") {
        res.writeHead(200, { "Content-Type": "application/json" });
        const includeDetailedMetrics = url.searchParams.get("metrics") === "true";
        res.end(
          JSON.stringify({
            name: "Smrkomed Exotel Voicebot Media Gateway",
            version: "1.2.0",
            status: "ONLINE",
            streamingPath: this.config.path,
            echoMode: this.config.echoMode,
            autoPlayGreeting: this.config.autoPlayGreeting,
            silenceTimeoutMs: this.config.silenceTimeoutMs,
            ttsPace: this.config.ttsPace,
            sarvamAi: getSarvamConfigSummary(),
            latencyTelemetry: {
              aggregates: mediaSessionManager.getAggregateLatencyStats(),
              recentTurnMetrics: mediaSessionManager.getRecentTurnMetrics(
                includeDetailedMetrics ? 50 : 10
              ),
            },
            activeSessions: mediaSessionManager.getAllActiveSessions().map((s) => s.getSummary()),
            recentCompletedCalls: mediaSessionManager.getRecentCompletedSessions(),
            recentUpgrades: this.recentUpgrades.slice(-25),
            recentEvents: this.recentEvents.slice(-35),
          })
        );
        return;
      }

      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    });

    // 2. Initialize WebSocket server attached to HTTP server
    this.wss = new WebSocketServer({ noServer: true });

    // Handle HTTP upgrade requests with robust path normalization & logging
    this.server.on("upgrade", (request, socket, head) => {
      const clientIp =
        (request.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        request.socket.remoteAddress ||
        "unknown";
      const userAgent = (request.headers["user-agent"] as string) || "unknown";
      const host = request.headers.host || "localhost";
      const url = new URL(request.url || "/", `http://${host}`);
      const rawPath = url.pathname;
      const normalizedPath = rawPath.replace(/\/+$/, "") || "/";

      // Accept configured path or any of the standard Exotel streaming aliases
      const isMatchingPath =
        normalizedPath === this.config.path ||
        normalizedPath === "/exotel/voicebot" ||
        normalizedPath === "/exotel/agentstream" ||
        normalizedPath === "/voicebot" ||
        normalizedPath === "/agentstream" ||
        normalizedPath === "/stream" ||
        normalizedPath === "/" ||
        normalizedPath === "";

      const recordUpgrade = (upgraded: boolean, error?: string) => {
        const item = {
          timestamp: new Date().toISOString(),
          clientIp,
          path: rawPath,
          query: url.search,
          userAgent,
          upgraded,
          error,
        };
        this.recentUpgrades.push(item);
        if (this.recentUpgrades.length > 50) {
          this.recentUpgrades.shift();
        }
        console.log(
          `[SMRKOMED Gateway] WebSocket upgrade ${upgraded ? "ACCEPTED" : "REJECTED"} for path "${rawPath}" from ${clientIp} (${error || "OK"})`
        );
      };

      if (!isMatchingPath) {
        recordUpgrade(false, "Path not matched");
        socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
        socket.destroy();
        return;
      }

      // Optional secret token check if configured
      if (this.config.authSecret) {
        const authParam = url.searchParams.get("token") || request.headers["x-gateway-secret"];
        if (authParam && authParam !== this.config.authSecret) {
          recordUpgrade(false, "401 Unauthorized token");
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }
      }

      recordUpgrade(true);
      this.wss.handleUpgrade(request, socket, head, (ws) => {
        (ws as unknown as { _requestUrl?: URL })._requestUrl = url;
        this.wss.emit("connection", ws, request);
      });
    });

    this.setupWebSocketHandlers();
  }

  private setupWebSocketHandlers(): void {
    this.wss.on("connection", (ws: WebSocket) => {
      let activeSession: CallMediaSession | null = null;
      const audioEngine = new AudioEngine({
        minChunkBytes: this.config.minChunkBytes,
        maxChunkBytes: this.config.maxChunkBytes,
        chunkMultipleBytes: this.config.chunkMultipleBytes,
        enforceMinimum: this.config.enforceMinimumChunk,
      });

      const recordEvent = (
        event: string,
        streamSid: string,
        callSid: string,
        byteCount?: number,
        details?: string
      ) => {
        this.recentEvents.push({
          timestamp: new Date().toISOString(),
          event,
          streamSid,
          callSid,
          byteCount,
          details,
        });
        if (this.recentEvents.length > 100) {
          this.recentEvents.shift();
        }
      };

      ws.on("message", (data: Buffer | string) => {
        if (this.isShuttingDown) return;

        let rawObj: Record<string, unknown>;
        try {
          const text = typeof data === "string" ? data : data.toString("utf-8");
          rawObj = JSON.parse(text) as Record<string, unknown>;
        } catch {
          return;
        }

        const eventName = String(rawObj.event || "").toLowerCase();

        switch (eventName) {
          case "connected": {
            // Exotel initial connection event
            const proto = String(rawObj.protocol || "Call");
            const ver = String(rawObj.version || "1.0.0");
            recordEvent("connected", "", "", undefined, `protocol=${proto} version=${ver}`);
            break;
          }

          case "start": {
            const meta = (rawObj.start || {}) as Record<string, unknown>;

            // Support both snake_case (Exotel standard) and camelCase properties
            const streamSid = String(
              rawObj.stream_sid || rawObj.streamSid || meta.stream_sid || meta.streamSid || ""
            );
            const callSid = String(
              meta.call_sid || meta.callSid || rawObj.call_sid || rawObj.callSid || ""
            );
            const accountSid = String(
              meta.account_sid || meta.accountSid || rawObj.account_sid || rawObj.accountSid || ""
            );
            const from = String(meta.from || rawObj.from || "");
            const to = String(meta.to || rawObj.to || "");
            const customField = String(
              meta.custom_field ||
                meta.customField ||
                rawObj.custom_field ||
                rawObj.customField ||
                (meta.custom_parameters ? JSON.stringify(meta.custom_parameters) : "")
            );

            const rawFormat = (meta.media_format || meta.mediaFormat || {}) as Record<string, unknown>;
            const mediaFormat: ExotelMediaFormat = {
              encoding: (rawFormat.encoding as ExotelMediaFormat["encoding"]) || "audio/x-l16",
              sampleRate: Number(rawFormat.sample_rate || rawFormat.sampleRate || 8000),
              channels: Number(rawFormat.channels || 1),
            };

            const wsUrl = (ws as unknown as { _requestUrl?: URL })._requestUrl;
            const queryEcho = wsUrl?.searchParams.get("echo") === "true";
            const sessionEchoMode = queryEcho || Boolean(this.config.echoMode);
            const sessionAutoGreeting = sessionEchoMode
              ? false
              : (this.config.autoPlayGreeting ?? true);

            activeSession = new CallMediaSession({
              streamSid,
              callSid,
              accountSid,
              from,
              to,
              customField,
              mediaFormat,
              socket: ws,
              audioEngine,
              autoPlayGreeting: sessionAutoGreeting,
              echoMode: sessionEchoMode,
              silenceTimeoutMs: this.config.silenceTimeoutMs,
              ttsPace: this.config.ttsPace,
            });

            mediaSessionManager.registerSession(activeSession);
            activeSession.markStarted();
            recordEvent(
              "start",
              streamSid,
              callSid,
              undefined,
              `from=${from} to=${to} echo=${sessionEchoMode}`
            );
            break;
          }

          case "media": {
            const mediaData = (rawObj.media || {}) as Record<string, unknown>;
            const payload = String(mediaData.payload || mediaData.chunk || "");
            const streamSid = String(
              rawObj.stream_sid || rawObj.streamSid || activeSession?.streamSid || ""
            );

            if (activeSession && payload) {
              activeSession.handleIncomingMedia({
                payload,
                timestamp: String(mediaData.timestamp || Date.now()),
                chunk: String(mediaData.chunk || "0"),
                track: mediaData.track as "inbound" | "outbound" | undefined,
              });
              recordEvent("media", streamSid, activeSession.callSid, payload.length);
            }
            break;
          }

          case "dtmf": {
            const dtmfData = (rawObj.dtmf || {}) as Record<string, unknown>;
            const digit = String(dtmfData.digit || dtmfData.key || "");
            const streamSid = String(
              rawObj.stream_sid || rawObj.streamSid || activeSession?.streamSid || ""
            );

            if (activeSession && digit) {
              activeSession.handleDtmf(digit);
              recordEvent("dtmf", streamSid, activeSession.callSid, undefined, `digit=${digit}`);
            }
            break;
          }

          case "mark": {
            const markData = (rawObj.mark || {}) as Record<string, unknown>;
            const name = String(markData.name || "");
            const streamSid = String(
              rawObj.stream_sid || rawObj.streamSid || activeSession?.streamSid || ""
            );

            if (activeSession && name) {
              activeSession.handleMark(name);
              recordEvent("mark", streamSid, activeSession.callSid, undefined, `name=${name}`);
            }
            break;
          }

          case "stop": {
            const streamSid = String(
              rawObj.stream_sid || rawObj.streamSid || activeSession?.streamSid || ""
            );
            if (activeSession) {
              recordEvent("stop", streamSid, activeSession.callSid);
              activeSession.close();
              activeSession = null;
            }
            ws.close();
            break;
          }
        }
      });

      ws.on("close", () => {
        if (activeSession) {
          activeSession.close();
          activeSession = null;
        }
      });

      ws.on("error", () => {
        if (activeSession) {
          activeSession.close();
          activeSession = null;
        }
      });
    });
  }

  public async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.config.port, this.config.host, () => {
        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    this.isShuttingDown = true;
    mediaSessionManager.closeAll();

    return new Promise((resolve) => {
      this.wss.close(() => {
        this.server.close(() => {
          resolve();
        });
      });
    });
  }

  public getHttpServer(): http.Server {
    return this.server;
  }

  public getWebSocketServer(): WebSocketServer {
    return this.wss;
  }
}

// Standalone entrypoint when executed directly via Node/tsx
if (require.main === module) {
  const gateway = new AgentStreamMediaGateway();
  gateway
    .start()
    .then(() => {
      const activePort = process.env.PORT || process.env.VOICE_GATEWAY_PORT || 8080;
      console.log(
        `[SMRKOMED] Exotel AgentStream Media Gateway running on http://0.0.0.0:${activePort}`
      );
      console.log(`[SMRKOMED] Streaming WebSocket endpoint: ws://0.0.0.0:${activePort}/exotel/voicebot`);

      // Pre-warm initial welcome greeting in TTS cache for instantaneous 0ms audio streaming
      const initialGreeting =
        "നമസ്കാരം! ദയ ഹോസ്പിറ്റലിലേക്ക് സ്വാഗതം. ഞാൻ സ്മാർക്കോമെഡ് AI അസിസ്റ്റന്റാണ്. എങ്ങനെ സഹായിക്കാം?";
      SarvamTextToSpeechProvider.prewarmCache([initialGreeting])
        .then(() => {
          console.log("[SMRKOMED] Initial Malayalam greeting pre-warmed in TTS audio cache.");
        })
        .catch(() => {});
    })
    .catch((err) => {
      console.error("[SMRKOMED] Failed to start gateway:", err);
      process.exit(1);
    });

  const shutdown = async () => {
    console.log("[SMRKOMED] Gracefully shutting down Media Gateway...");
    await gateway.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
