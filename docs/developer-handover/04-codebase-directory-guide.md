# 04 — Source Code Directory Guide

This guide provides an exhaustive directory and file map of the **Smrkomed / Daya Hospital** codebase, detailing the purpose, primary responsibilities, key exports, and calling relationships across all modules.

---

## 1. Top-Level Directory Structure

```
Daya_hospital/
├── .github/                  # CI/CD workflows (if present)
├── .next/                    # Next.js build output (gitignored)
├── docs/                     # Project documentation & runbooks
│   └── developer-handover/   # Authoritative handover documentation (this package)
├── prisma/                   # Database schema, seed data, and SQL migrations
├── public/                   # Static browser assets (logos, icons)
├── scripts/                  # Synthetic validation scripts, audio test benches
├── src/                      # Application source code
│   ├── app/                  # Next.js 16 App Router (UI routes & REST API handlers)
│   ├── components/           # Reusable React 19 UI components
│   ├── lib/                  # Core business logic, services, adapters, & utilities
│   ├── media-gateway/        # Persistent Node.js WebSocket & telephony audio gateway
│   └── types/                # Global TypeScript definitions
├── .env.example              # Template environment configuration
├── Dockerfile                # Root build manifest
├── next.config.ts            # Next.js 16 compiler & caching configuration
├── package.json              # Dependencies and lifecycle scripts
├── railway.json              # Railway deployment and healthcheck specification
├── tsconfig.json             # TypeScript project compiler rules
└── vitest.config.mjs         # Vitest test runner configuration
```

---

## 2. Directory: `src/app` (Next.js App Router)

The `src/app` directory hosts server-rendered UI pages, client components, and API route handlers.

### 2.1 UI Dashboard Pages (`src/app/*`)

| File Path | Classification | Purpose & Key Responsibilities |
|---|---|---|
| [src/app/page.tsx](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/app/page.tsx) | Production UI | Landing redirect routing authenticated users to `/overview` or guests to `/login`. |
| [src/app/overview/page.tsx](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/app/overview/page.tsx) | Production UI | Primary operations dashboard: real-time call volume, active calls, abandonment rate, and recent SMRKO VOICE escalations. |
| [src/app/calls/page.tsx](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/app/calls/page.tsx) | Production UI | Telephony audit log: tabular view of inbound/outbound calls, caller numbers, durations, triage tags, and audio player triggers. |
| [src/app/calls/[callId]/page.tsx](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/app/calls/[callId]/page.tsx) | Production UI | Call detail view: full turn-by-turn Malayalam/English transcripts, AI summaries, clinical action cards, and waveform audio player. |
| [src/app/agents/page.tsx](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/app/agents/page.tsx) | Production UI | AI Agent management: configure STT/LLM/TTS models, voice personas, language settings, and clinical instructions. |
| [src/app/ivr/page.tsx](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/app/ivr/page.tsx) | Production UI | Visual IVR tree management: DTMF routing node builder, emergency department mapping, and version publisher. |
| [src/app/knowledge/page.tsx](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/app/knowledge/page.tsx) | Production UI | Hospital clinical knowledge base editor: doctor schedules, room tariffs, and facility FAQs. |
| [src/app/settings/page.tsx](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/app/settings/page.tsx) | Production UI | Multi-tenant hospital configuration, telephony provider settings, receptionist ring timeouts, and user management. |
| [src/app/login/page.tsx](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/app/login/page.tsx) | Production UI | Staff and administrator authentication portal. |

---

### 2.2 Telephony & Call API Routes (`src/app/api/calls/*`)

| File Path | Route | Purpose & Key Implementation |
|---|---|---|
| [src/app/api/calls/route.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/app/api/calls/route.ts) | `GET /api/calls` | Returns paginated call records filtered by tenant `hospitalId`, status, and date range. |
| [src/app/api/calls/[callId]/route.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/app/api/calls/[callId]/route.ts) | `GET /api/calls/[callId]` | Fetches single call session, complete transcripts, actions taken, and recording metadata. |
| [src/app/api/calls/[callId]/recording/route.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/app/api/calls/[callId]/recording/route.ts) | `GET /api/calls/[callId]/recording` | **Call Audio Streaming Endpoint:** Implements binary audio streaming (`audio/wav`), HTTP 206 Partial Content byte-range scrubbing (`Range: bytes=start-end`), and HTTP 401/403 RBAC checks. (Fixed in commit `ec40a9e` for Next.js 16 `cacheComponents` compatibility). |
| [src/app/api/calls/outbound/route.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/app/api/calls/outbound/route.ts) | `POST /api/calls/outbound` | Initiates automated outbound reminder calls via Exotel REST API. |

---

### 2.3 SMRKO VOICE Intelligence Action Routes (`src/app/api/v1/voice-agent/*`)

These endpoints are invoked as webhook tool actions by Sarvam AI:

| File Path | Route | Purpose & Execution Logic |
|---|---|---|
| [src/app/api/v1/voice-agent/doctors/route.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/app/api/v1/voice-agent/doctors/route.ts) | `GET /api/v1/voice-agent/doctors` | Returns available consultants filtered by specialty department. Fails closed (503) when live HMS is down. |
| [src/app/api/v1/voice-agent/check-availability/route.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/app/api/v1/voice-agent/check-availability/route.ts) | `POST /api/v1/voice-agent/check-availability` | Queries doctor OPD time slots for a given date. Fails closed (503) with zero fake slots if HMS offline. |
| [src/app/api/v1/voice-agent/book-appointment/route.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/app/api/v1/voice-agent/book-appointment/route.ts) | `POST /api/v1/voice-agent/book-appointment` | Books slot in HMS, generates booking reference and OPD token number. |
| [src/app/api/v1/voice-agent/reschedule-appointment/route.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/app/api/v1/voice-agent/reschedule-appointment/route.ts) | `POST /api/v1/voice-agent/reschedule-appointment` | Modifies existing appointment date/slot. Fails closed (503) if HMS is unreachable. |
| [src/app/api/v1/voice-agent/cancel-appointment/route.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/app/api/v1/voice-agent/cancel-appointment/route.ts) | `POST /api/v1/voice-agent/cancel-appointment` | Cancels scheduled booking in HMS and releases slot. |
| [src/app/api/v1/voice-agent/get-appointment/route.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/app/api/v1/voice-agent/get-appointment/route.ts) | `GET /api/v1/voice-agent/get-appointment` | Retrieves existing booking status by booking reference or caller phone number. |
| [src/app/api/v1/voice-agent/emergency-escalate/route.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/app/api/v1/voice-agent/emergency-escalate/route.ts) | `POST /api/v1/voice-agent/emergency-escalate` | Triage escalation: records urgent escalation decision and dispatches transfer instruction. |

---

### 2.4 Carrier Webhooks (`src/app/api/webhooks/*`)

| File Path | Route | Purpose |
|---|---|---|
| [src/app/api/webhooks/exotel/route.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/app/api/webhooks/exotel/route.ts) | `POST /api/webhooks/exotel` | Ingests Exotel call status events (`terminal`, `answered`, `busy`, `failed`) and recording callbacks. |
| [src/app/api/webhooks/exotel/connect-destination/route.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/app/api/webhooks/exotel/connect-destination/route.ts) | `GET /api/webhooks/exotel/connect-destination` | Next.js mirror of the Exotel Connect Applet destination resolver. |
| [src/app/api/webhooks/exotel/passthru/route.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/app/api/webhooks/exotel/passthru/route.ts) | `GET /api/webhooks/exotel/passthru` | Exotel Passthru applet webhook for dynamic DTMF evaluation. |
| [src/app/api/webhooks/sarvam/route.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/app/api/webhooks/sarvam/route.ts) | `POST /api/webhooks/sarvam` | Ingests Sarvam Samvaad voicebot session lifecycle events with HMAC-SHA256 signature verification. |

---

## 3. Directory: `src/lib` (Core Business Logic)

The `src/lib` directory is the architectural heart of Smrkomed, housing provider integrations, database access, security gates, and multi-tenant domain services.

### 3.1 Services Layer (`src/lib/services/*`)

- [hospital-routing-service.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/lib/services/hospital-routing-service.ts): Authoritative dynamic destination resolution engine for Exotel Connect and Passthru applets. Enforces business hours, emergency bypass, receptionist timeouts, and fail-closed isolation.
- [dynamic-exotel-routing-adapter.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/lib/services/dynamic-exotel-routing-adapter.ts): Translates internal routing decisions into exact Exotel Programmable Connect JSON contracts (`destination.numbers`, `max_ringing_duration`, `record`).
- [receptionist-presence-service.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/lib/services/receptionist-presence-service.ts): Manages real-time staff presence states (`AVAILABLE`, `ON_CALL`, `BREAK`, `OFFLINE`) and logs shift audits.
- [ai-overflow-service.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/lib/services/ai-overflow-service.ts): Controls the rollover of calls from busy receptionists to SMRKO VOICE and manages overflow records.
- [actions-service.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/lib/services/actions-service.ts): Central dispatcher executing SMRKO VOICE clinical tools, enforcing tenant authorization, and recording audit logs.
- [calls-service.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/lib/services/calls-service.ts): Queries and updates call sessions, transcripts, and recording references.
- [ivr-flow-service.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/lib/services/ivr-flow-service.ts): CRUD and version publishing engine for visual IVR trees with in-memory fallback persistence.
- [emergency-detector.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/lib/services/emergency-detector.ts): NLP keyword and pattern triage scanner analyzing transcripts for acute clinical emergencies.

---

### 3.2 External Integrations (`src/lib/integrations/*`)

- **HMS Integration (`src/lib/integrations/hms/`):**
  - [standard-hms-types.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/lib/integrations/hms/standard-hms-types.ts): Interface contract (`IHmsConnector`) for hospital management systems.
  - [grandis-adapter.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/lib/integrations/hms/grandis-adapter.ts): Adapter for Daya Hospital's Grandis HMS over hospital VPN gateway.
  - [hms-client.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/lib/integrations/hms/hms-client.ts): Core HTTP client enforcing fail-closed exceptions when HMS VPN is down.
  - [mock-adapter.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/lib/integrations/hms/mock-adapter.ts): In-memory mock fixture used strictly for unit testing.
- **Telephony Integration (`src/lib/integrations/telephony/`):**
  - [exotel-adapter.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/lib/integrations/telephony/exotel-adapter.ts): Handles Exotel REST API calls, webhook payload parsing, and call status normalization.
  - [bitvoice-adapter.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/lib/integrations/telephony/bitvoice-adapter.ts): Alternative SIP PBX adapter stub for on-premise hospital gateways.
- **Sarvam AI Integration (`src/lib/integrations/sarvam/`):**
  - [voice-agent-client.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/lib/integrations/sarvam/voice-agent-client.ts): Client for Sarvam Voice Agents (Samvaad) platform (`apps.sarvam.ai`).
  - [sarvam-client.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/lib/integrations/sarvam/sarvam-client.ts): Client for Sarvam Core STT/TTS REST APIs.
  - [daya-agent-config.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/lib/integrations/sarvam/daya-agent-config.ts): Authoritative prompt specifications, doctor catalogs, and tool definitions for Daya Hospital.

---

### 3.3 Configuration & Database Access (`src/lib/config/*`, `src/lib/db/*`, `src/lib/auth/*`)

- [src/lib/config/hospital-config.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/lib/config/hospital-config.ts): Multi-tenant hospital registry defining tenant IDs, ExoPhones, default routing numbers, and emergency safety flags.
- [src/lib/db/prisma.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/lib/db/prisma.ts): Singleton PrismaClient instance with connection pool diagnostics and health check probe (`checkDatabaseConnection`).
- [src/lib/auth/session.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/lib/auth/session.ts): Server-side cryptographic session token signer and verifier (`daya_auth_session`).

---

## 4. Directory: `src/media-gateway` (Real-Time Media Gateway)

The `src/media-gateway` directory contains the persistent Node.js service that runs continuously on persistent compute:

| File Path | Role & Responsibilities |
|---|---|
| [server.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/media-gateway/server.ts) | Main entrypoint (`AgentStreamMediaGateway`). Creates HTTP server on port 8080 serving `/health`, `/status`, and `/exotel/connect-destination`, and runs `WebSocketServer` for `/exotel/voicebot`. |
| [session-manager.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/media-gateway/session-manager.ts) | Manages active call media sessions (`CallMediaSession`), durable escalation storage in Neon DB, audio queues, and turn metrics. |
| [audio-engine.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/media-gateway/audio-engine.ts) | Linear PCM audio buffer management (8kHz, 16-bit mono), silence detection, chunk framing, and audio drain. |
| [conversation-engine.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/media-gateway/conversation-engine.ts) | Conversation state machine coordinating speech-to-text transcripts, LLM prompt execution, and text-to-speech synthesis. |
| [sarvam-stt.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/media-gateway/sarvam-stt.ts) | WebSocket client streaming live PCM audio to Sarvam STT (`saaras:v4`) and emitting real-time transcripts. |
| [sarvam-tts.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/media-gateway/sarvam-tts.ts) | Pipelined text-to-speech client streaming synthesized PCM audio chunks from Sarvam TTS (`bulbul:v3`). |
| [sarvam-config.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/media-gateway/sarvam-config.ts) | Server-side credential management for Sarvam APIs with automatic secret masking in logs. |
| [tenant-resolver.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/media-gateway/tenant-resolver.ts) | Resolves hospital tenant from dialed ExoPhone or custom session parameters with fail-closed security. |
| [Dockerfile](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/media-gateway/Dockerfile) | Multi-stage Docker manifest packaging Node 22, Prisma client, and the media gateway runner. |
