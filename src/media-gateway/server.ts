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
  ExotelIncomingMessage,
  ExotelStartEvent,
  ExotelMediaEvent,
  ExotelDtmfEvent,
  ExotelMarkEvent,
  MediaGatewayConfig,
} from "./types";
import { CallMediaSession, mediaSessionManager } from "./session-manager";
import { AudioEngine } from "./audio-engine";
import { getSarvamConfigSummary } from "./sarvam-config";

export class AgentStreamMediaGateway {
  private server: http.Server;
  private wss: WebSocketServer;
  private startTime: number = Date.now();
  private config: MediaGatewayConfig;
  private isShuttingDown = false;

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
    };

    // 1. Create native HTTP server with /health endpoint
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
        res.end(
          JSON.stringify({
            name: "Smrkomed Exotel Voicebot Media Gateway",
            version: "1.0.0",
            status: "ONLINE",
            streamingPath: this.config.path,
            sarvamAi: getSarvamConfigSummary(),
            activeSessions: mediaSessionManager.getAllActiveSessions().map((s) => s.getSummary()),
          })
        );
        return;
      }

      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    });

    // 2. Initialize WebSocket server attached to HTTP server
    this.wss = new WebSocketServer({ noServer: true });

    // Handle HTTP upgrade requests for WebSocket
    this.server.on("upgrade", (request, socket, head) => {
      const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

      // Accept connections on configured path or aliases (/exotel/voicebot, /exotel/agentstream)
      if (
        url.pathname === this.config.path ||
        url.pathname === "/exotel/voicebot" ||
        url.pathname === "/exotel/agentstream"
      ) {
        // Optional secret token check if configured
        if (this.config.authSecret) {
          const authParam = url.searchParams.get("token") || request.headers["x-gateway-secret"];
          if (authParam && authParam !== this.config.authSecret) {
            socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
            socket.destroy();
            return;
          }
        }

        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit("connection", ws, request);
        });
      } else {
        socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
        socket.destroy();
      }
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

      ws.on("message", (data: Buffer | string) => {
        if (this.isShuttingDown) return;

        let parsed: ExotelIncomingMessage;
        try {
          const text = typeof data === "string" ? data : data.toString("utf-8");
          parsed = JSON.parse(text);
        } catch {
          return;
        }

        switch (parsed.event) {
          case "connected": {
            // Exotel connected event received
            break;
          }

          case "start": {
            const startMsg = parsed as ExotelStartEvent;
            const meta = startMsg.start;

            activeSession = new CallMediaSession({
              streamSid: startMsg.streamSid || meta.streamSid,
              callSid: meta.callSid,
              accountSid: meta.accountSid,
              from: meta.from,
              to: meta.to,
              customField: meta.customField,
              mediaFormat: meta.mediaFormat,
              socket: ws,
              audioEngine,
              autoPlayGreeting: true,
            });

            mediaSessionManager.registerSession(activeSession);
            activeSession.markStarted();
            break;
          }

          case "media": {
            if (activeSession) {
              const mediaMsg = parsed as ExotelMediaEvent;
              activeSession.handleIncomingMedia(mediaMsg.media);
            }
            break;
          }

          case "dtmf": {
            if (activeSession) {
              const dtmfMsg = parsed as ExotelDtmfEvent;
              activeSession.handleDtmf(dtmfMsg.dtmf.digit);
            }
            break;
          }

          case "mark": {
            if (activeSession) {
              const markMsg = parsed as ExotelMarkEvent;
              activeSession.handleMark(markMsg.mark.name);
            }
            break;
          }

          case "stop": {
            if (activeSession) {
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
