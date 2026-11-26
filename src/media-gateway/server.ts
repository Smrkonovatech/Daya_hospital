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
import { CallMediaSession, mediaSessionManager, SocketSender } from "./session-manager";
import { AudioEngine } from "./audio-engine";
import {
  getSarvamConfig,
  getSarvamConfigSummary,
  evaluateGatewayReadiness,
} from "./sarvam-config";
import { SarvamTextToSpeechProvider } from "./sarvam-tts";
import { ivrFlowService } from "@/lib/services/ivr-flow-service";
import { checkDatabaseConnection } from "@/lib/db/prisma";
import { hospitalRoutingService } from "@/lib/services/hospital-routing-service";
import { resolveHospitalByPhoneNumber } from "@/lib/config/hospital-config";
import { aiOverflowService } from "@/lib/services/ai-overflow-service";

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
    this.server = http.createServer(async (req, res) => {
      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

      if (url.pathname === "/health" || url.pathname === "/healthz") {
        const sarvam = getSarvamConfig();
        const persistence = ivrFlowService.getPersistenceHealth();
        let isDbConnected = false;
        let dbDetails = { connected: false, message: "" };
        try {
          const dbStatus = await checkDatabaseConnection();
          isDbConnected = dbStatus.connected && persistence.status !== "DEGRADED";
          dbDetails = { connected: dbStatus.connected, message: dbStatus.message };
        } catch {
          isDbConnected = false;
        }
        const readiness = evaluateGatewayReadiness(sarvam, persistence, isDbConnected);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            status: "ok",
            service: "smrkomed_exotel_media_gateway",
            readiness: readiness.state,
            environmentMode: readiness.environmentMode,
            readinessReason: readiness.reason,
            sarvamConfigured: sarvam.isConfigured,
            mode: sarvam.mode,
            database: {
              configured: Boolean(process.env.DATABASE_URL),
              connected: isDbConnected,
              provider: "neon_postgresql",
            },
            persistenceStatus: persistence.status,
            activeCalls: mediaSessionManager.getActiveSessionCount(),
            uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
            port: this.config.port,
            timestamp: new Date().toISOString(),
          })
        );
        return;
      }

      if (url.pathname === "/" || url.pathname === "/status") {
        const sarvam = getSarvamConfig();
        const persistence = ivrFlowService.getPersistenceHealth();
        let isDbConnected = false;
        let dbDetails = { connected: false, message: "" };
        try {
          const dbStatus = await checkDatabaseConnection();
          isDbConnected = dbStatus.connected && persistence.status !== "DEGRADED";
          dbDetails = { connected: dbStatus.connected, message: dbStatus.message };
        } catch {
          isDbConnected = false;
        }
        const readiness = evaluateGatewayReadiness(sarvam, persistence, isDbConnected);

        res.writeHead(200, { "Content-Type": "application/json" });
        const includeDetailedMetrics = url.searchParams.get("metrics") === "true";
        res.end(
          JSON.stringify({
            name: "Smrkomed Exotel Voicebot Media Gateway",
            version: "1.3.2",
            status: "ONLINE",
            environmentMode: readiness.environmentMode,
            readiness: readiness.state,
            readinessReason: readiness.reason,
            database: {
              configured: Boolean(process.env.DATABASE_URL),
              connected: isDbConnected,
              provider: "neon_postgresql",
              message: dbDetails.message,
            },
            mockModeBlocked:
              process.env.NODE_ENV === "production" ||
              process.env.RAILWAY_ENVIRONMENT === "production",
            streamingPath: this.config.path,
            echoMode: this.config.echoMode,
            autoPlayGreeting: this.config.autoPlayGreeting,
            silenceTimeoutMs: this.config.silenceTimeoutMs,
            ttsPace: this.config.ttsPace,
            sarvamAi: getSarvamConfigSummary(),
            ivrRuntime: {
              activeIvrSessions: mediaSessionManager
                .getAllActiveSessions()
                .filter((s) => s.isExecutingIvrFlow).length,
              activeDirectAiFallbackSessions: mediaSessionManager
                .getAllActiveSessions()
                .filter((s) => !s.isExecutingIvrFlow).length,
            },
            persistence: persistence,
            latencyTelemetry: {
              aggregates: mediaSessionManager.getAggregateLatencyStats(),
              recentTurnMetrics: mediaSessionManager.getRecentTurnMetrics(
                includeDetailedMetrics ? 50 : 10
              ),
            },
            activeSessions: mediaSessionManager.getAllActiveSessions().map((s) => s.getSummary()),
            recentCompletedCalls: mediaSessionManager.getRecentCompletedSessions(),
            recentEscalations: mediaSessionManager.getRecentEscalations(15),
            recentUpgrades: this.recentUpgrades.slice(-25),
            recentEvents: this.recentEvents.slice(-35),
          })
        );
        return;
      }

      // 3. Exotel Connect Applet Dynamic Destination endpoint (GET & POST)
      // Carrier contract: Exotel Connect Applet "Dial Whom" Application URL
      // Makes an HTTP GET request with CallSid, CallFrom, CallTo, Direction.
      // Responds with HTTP 200 text/plain and the E.164 destination number.
      const isConnectDestinationPath =
        url.pathname === "/exotel/connect-destination" ||
        url.pathname === "/api/telephony/connect-destination" ||
        url.pathname === "/connect-destination";

      if (isConnectDestinationPath) {
        let callSid =
          url.searchParams.get("CallSid") ||
          url.searchParams.get("call_sid") ||
          url.searchParams.get("callSid") ||
          url.searchParams.get("Sid") ||
          "";
        let callerNumber =
          url.searchParams.get("CallFrom") ||
          url.searchParams.get("From") ||
          url.searchParams.get("from") ||
          "";
        let dialedNumber =
          url.searchParams.get("CallTo") ||
          url.searchParams.get("To") ||
          url.searchParams.get("to") ||
          "";

        if (req.method === "POST") {
          try {
            const bodyChunks: Buffer[] = [];
            for await (const chunk of req) {
              bodyChunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
            }
            const bodyStr = Buffer.concat(bodyChunks).toString("utf8");
            if (bodyStr) {
              try {
                const jsonBody = JSON.parse(bodyStr);
                callSid = jsonBody.CallSid || jsonBody.call_sid || jsonBody.callSid || callSid;
                callerNumber = jsonBody.CallFrom || jsonBody.From || callerNumber;
                dialedNumber = jsonBody.CallTo || jsonBody.To || dialedNumber;
              } catch {
                const formParams = new URLSearchParams(bodyStr);
                callSid = formParams.get("CallSid") || formParams.get("call_sid") || formParams.get("callSid") || callSid;
                callerNumber = formParams.get("CallFrom") || formParams.get("From") || callerNumber;
                dialedNumber = formParams.get("CallTo") || formParams.get("To") || dialedNumber;
              }
            }
          } catch (err) {
            console.warn("[MediaGateway:ConnectDestination] Error parsing POST body:", err);
          }
        }

        // 1. Authoritative resolution: Require CallSid (never guess tenant by From alone)
        if (!callSid || !callSid.trim()) {
          console.warn("[MediaGateway:ConnectDestination] Missing CallSid in request. Failing closed.");
          res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
          res.end(
            JSON.stringify({
              error: "UNKNOWN_CALL_SID",
              message: "CallSid is missing or invalid. Authoritative session resolution requires a valid Exotel CallSid.",
              destination: null,
            })
          );
          return;
        }

        // 2. Lookup escalation decision strictly by CallSid
        const escalation = await mediaSessionManager.getEscalation(callSid);
        if (!escalation) {
          const raw = (mediaSessionManager as any).escalationRecords?.get(callSid);
          if (raw && Date.now() - raw.timestamp >= 600000) {
            console.warn(`[MediaGateway:ConnectDestination] Escalation record for CallSid='${callSid}' has expired (>10m). Failing closed.`);
            res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
            res.end(
              JSON.stringify({
                error: "EXPIRED_ESCALATION",
                message: `The escalation decision for CallSid '${callSid}' has expired (exceeded 10-minute TTL).`,
                destination: null,
              })
            );
            return;
          }
          console.warn(`[MediaGateway:ConnectDestination] No escalation record found for CallSid='${callSid}'. Failing closed.`);
          res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
          res.end(
            JSON.stringify({
              error: "NO_ESCALATION_RECORD",
              message: `No transfer escalation (EMERGENCY or HUMAN_TRANSFER) was recorded for CallSid '${callSid}'.`,
              destination: null,
            })
          );
          return;
        }

        // 3. TTL Expiry Check (10 minutes)
        const isExpired = Date.now() - escalation.timestamp > 600000;
        if (isExpired) {
          console.warn(`[MediaGateway:ConnectDestination] Escalation record for CallSid='${callSid}' has expired (>10m). Failing closed.`);
          res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
          res.end(
            JSON.stringify({
              error: "EXPIRED_ESCALATION",
              message: `The escalation decision for CallSid '${callSid}' has expired (exceeded 10-minute TTL).`,
              destination: null,
            })
          );
          return;
        }

        // 4. Authoritative Tenant Check
        const hospitalId = escalation.hospitalId;
        if (!hospitalId) {
          console.warn(`[MediaGateway:ConnectDestination] Tenant unknown for CallSid='${callSid}'. Failing closed.`);
          res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
          res.end(
            JSON.stringify({
              error: "UNKNOWN_TENANT",
              message: "Hospital tenant could not be resolved from authoritative session.",
              destination: null,
            })
          );
          return;
        }

        // 5. Dynamic live destination resolution (isLiveCall: true enforces verified destinations)
        const escalationType = escalation.escalationState || "HUMAN_TRANSFER";
        const resolution = await hospitalRoutingService.resolveLiveDestination({
          hospitalId,
          callSid,
          escalationType: escalationType as any,
          versionNumber: escalation.routingVersion,
          isLiveCall: true,
        });

        if (!resolution.success || !resolution.destinationNumber) {
          console.warn(
            `[MediaGateway:ConnectDestination] Resolution failed closed for CallSid='${callSid}' ` +
            `(${hospitalId} / ${escalationType}): ${resolution.routingRule} - ${resolution.error}`
          );
          const statusCode = resolution.routingRule === "UNVERIFIED_TENANT_FAIL_CLOSED" ? 403 : 404;
          res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
          res.end(
            JSON.stringify({
              error: resolution.routingRule || "UNVERIFIED_DESTINATION",
              message: resolution.error || "Destination could not be verified or is unapproved demo data.",
              destination: null,
            })
          );
          return;
        }

        // 6. Format Negotiation: Exotel Programmable Connect JSON by default, text/plain on request
        const acceptHeader = (req.headers["accept"] as string) || "";
        const formatParam = url.searchParams.get("format") || "";
        const wantsText = formatParam === "text" || acceptHeader === "text/plain";

        const commonHeaders = {
          "X-SMRKOMED-Tenant": resolution.hospitalId,
          "X-SMRKOMED-Escalation": resolution.escalationType,
          "X-SMRKOMED-Version": String(resolution.versionUsed),
          "X-SMRKOMED-Routing-Rule": resolution.routingRule,
        };

        console.log(
          `[MediaGateway:ConnectDestination] Resolved destination for CallSid='${callSid}' ` +
          `(${hospitalId} / ${escalationType} / v${resolution.versionUsed}): ${resolution.destinationNumber} [${resolution.departmentName}] ` +
          `(Format: ${wantsText ? "text/plain" : "application/json"})`
        );

        if (wantsText) {
          res.writeHead(200, {
            ...commonHeaders,
            "Content-Type": "text/plain; charset=utf-8",
          });
          res.end(resolution.destinationNumber);
          return;
        }

        // Standard Exotel Programmable Connect JSON contract response
        const payload = {
          fetch_after_attempt: false,
          destination: {
            numbers: [resolution.destinationNumber],
          },
          record: true,
          outgoing_phone_number: "08047291658",
          max_ringing_duration: 25,
        };

        res.writeHead(200, {
          ...commonHeaders,
          "Content-Type": "application/json; charset=utf-8",
        });
        res.end(JSON.stringify(payload, null, 2));
        return;
      }

      // 4. Exotel Passthru Applet decision endpoint (GET & POST)
      const isPassthruPath =
        url.pathname === "/exotel/passthru" ||
        url.pathname === "/api/telephony/passthru-routing" ||
        url.pathname === "/passthru";

      if (isPassthruPath) {
        let callSid =
          url.searchParams.get("CallSid") ||
          url.searchParams.get("call_sid") ||
          url.searchParams.get("callSid") ||
          url.searchParams.get("Sid") ||
          "";
        let callerNumber =
          url.searchParams.get("From") ||
          url.searchParams.get("CallFrom") ||
          url.searchParams.get("from") ||
          "";

        if (req.method === "POST") {
          try {
            const bodyChunks: Buffer[] = [];
            for await (const chunk of req) {
              bodyChunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
            }
            const bodyStr = Buffer.concat(bodyChunks).toString("utf8");
            if (bodyStr) {
              try {
                const jsonBody = JSON.parse(bodyStr);
                callSid = jsonBody.CallSid || jsonBody.call_sid || jsonBody.callSid || callSid;
                callerNumber = jsonBody.From || jsonBody.CallFrom || jsonBody.from || callerNumber;
              } catch {
                const formParams = new URLSearchParams(bodyStr);
                callSid =
                  formParams.get("CallSid") ||
                  formParams.get("call_sid") ||
                  formParams.get("callSid") ||
                  formParams.get("Sid") ||
                  callSid;
                callerNumber =
                  formParams.get("From") ||
                  formParams.get("CallFrom") ||
                  formParams.get("from") ||
                  callerNumber;
              }
            }
          } catch (bodyErr) {
            console.warn("[MediaGateway:Passthru] Error parsing POST body:", bodyErr);
          }
        }

        const escalation = await mediaSessionManager.getEscalation(callSid, callerNumber);
        const shouldTransfer = Boolean(
          escalation &&
          (escalation.escalationState === "EMERGENCY" || escalation.escalationState === "HUMAN_TRANSFER")
        );

        console.log(
          `[MediaGateway:Passthru] Routing Decision for CallSid='${callSid || "N/A"}', From='${callerNumber || "N/A"}': ` +
          `${shouldTransfer ? "PASS (HTTP 200 -> Connect Applet)" : "FAIL (HTTP 302/410 -> Hangup Applet)"} ` +
          `[state=${escalation?.escalationState || "NONE"}, destination=${escalation?.destination || "NONE"}, reason="${escalation?.reason || "Normal call completion"}"]`
        );

        if (shouldTransfer && escalation) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              status: "PASS",
              statusCode: 200,
              transfer: true,
              action: "CONNECT",
              escalationState: escalation.escalationState,
              destination: escalation.destination,
              reason: escalation.reason,
              callSid: escalation.callSid,
              timestamp: new Date(escalation.timestamp).toISOString(),
            })
          );
          return;
        }

        // Return HTTP 302 (Exotel Choice B default) or HTTP 410 (custom fail code) -> Hangup Applet
        const failStatusCode = Number(url.searchParams.get("failCode")) || 302;
        res.writeHead(failStatusCode, {
          "Content-Type": "application/json",
          "Location": "#",
        });
        res.end(
          JSON.stringify({
            status: "FAIL",
            statusCode: failStatusCode,
            transfer: false,
            action: "HANGUP",
            escalationState: "NONE",
            reason: "Normal call completion or no escalation requested",
            callSid: callSid || "unknown",
            timestamp: new Date().toISOString(),
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

            // Idempotency & Reconnection check: guard against duplicate start events for the same stream or call
            const existingSession =
              mediaSessionManager.getSessionByStream(streamSid) ||
              (callSid ? mediaSessionManager.getSessionByCallSid(callSid) : undefined);

            if (existingSession) {
              if (existingSession.isStopped) {
                console.log(
                  `[SMRKOMED Gateway] Cleaning up stopped session for stream "${streamSid}" / call "${callSid}"`
                );
                mediaSessionManager.unregisterSession(existingSession);
              } else if (existingSession.socket !== (ws as unknown as SocketSender)) {
                console.log(
                  `[SMRKOMED Gateway] Re-binding existing active session for call "${callSid}" to new WebSocket.`
                );
                existingSession.updateSocket(ws);
                activeSession = existingSession;
                break;
              } else {
                console.log(
                  `[SMRKOMED Gateway] Idempotent ignore: active session already exists for stream "${streamSid}" / call "${callSid}" on same socket`
                );
                break;
              }
            }
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

            // Phase B: Detect AI Overflow from Exotel IVR / carrier parameters or recorded events
            const isOverflowQuery = wsUrl?.searchParams.get("overflow") === "true";
            let overflowReason = wsUrl?.searchParams.get("reason") || undefined;
            let isOverflow = isOverflowQuery;

            if (!isOverflow && customField) {
              try {
                const parsedCustom = JSON.parse(customField);
                if (parsedCustom.overflow === true || parsedCustom.isOverflow === true) {
                  isOverflow = true;
                  overflowReason = parsedCustom.reason || overflowReason;
                }
              } catch {}
            }

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
              enableIvrFlow: !sessionEchoMode && !isOverflow,
              silenceTimeoutMs: this.config.silenceTimeoutMs,
              ttsPace: this.config.ttsPace,
              isOverflow,
              overflowReason,
              callSource: isOverflow ? "IVR_ROLLOVER" : "DIRECT",
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
        .catch(() => { });
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
