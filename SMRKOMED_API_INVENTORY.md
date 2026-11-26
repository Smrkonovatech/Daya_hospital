# SMRKOMED — COMPLETE API & ENDPOINT INVENTORY

This document provides a comprehensive inventory of all 62 Next.js App Router API endpoints and standalone Media Gateway HTTP/WebSocket endpoints across the Smrkomed platform.

---

## 1. Complete API Endpoint Inventory Table

| Method | Endpoint | Purpose | Authentication | Status | Real/Mock |
|---|---|---|---|---|---|
| **GET** | `/health` | Media Gateway health check probe | Public | READY | **REAL** (Returns live gateway uptime & memory) |
| **GET** | `/status` | Media Gateway extended telemetry | Public | READY | **REAL** (Returns active calls & Sarvam status) |
| **WSS** | `/exotel/voicebot` | Bidirectional audio streaming WebSocket | Exotel Carrier Token | READY | **REAL** (Exotel AgentStream live 8kHz PCM) |
| **GET** | `/exotel/connect-destination` | Exotel Programmable Connect App URL | Query Param / CallSid | READY | **REAL** (Returns dynamic routing JSON schema) |
| **POST** | `/exotel/passthru` | Exotel Passthru routing callback | Exotel Webhook Secret | READY | **REAL** (Records disposition & returns Connect) |
| **POST** | `/api/auth/login` | Hospital staff email/password login | Public | READY | **REAL** (PBKDF2/Bcrypt hash verification) |
| **POST** | `/api/auth/logout` | Hospital staff session logout | Session Cookie | PARTIALLY READY | **REAL** (Sets expired cookie; in-memory revocation) |
| **GET** | `/api/auth/me` | Current authenticated user profile | Session Cookie | READY | **REAL** (Reads user and roles from Neon DB) |
| **POST** | `/api/auth/change-password` | Update authenticated user password | Session Cookie | READY | **REAL** (Hashes new password in Neon DB) |
| **POST** | `/api/auth/reset-password` | Request password reset token | Public | PARTIALLY READY | **MOCK** (Generates token, logs to console; no SMTP) |
| **GET** | `/api/calls` | Paginated call history list with filters | Session Cookie | READY | **REAL** (Queries Neon DB `CallRecord` with joins) |
| **GET** | `/api/calls/[callId]` | Single call detail with transcripts & actions | Session Cookie | READY | **REAL** (Queries Neon DB `CallRecord`) |
| **PATCH** | `/api/calls/[callId]` | Update call clinical review notes | Session Cookie | READY | **REAL** (Updates review state in Neon DB) |
| **GET** | `/api/calls/[callId]/recording` | Secure audio streaming proxy | Session Cookie | PARTIALLY READY | **REAL** (Proxies audio from Exotel/Sarvam storage) |
| **POST** | `/api/calls/outbound` | Outbound call initiation (legacy route) | Session Cookie | PARTIALLY READY | **MOCK / SIMULATED** (Wrapper exists; PSTN dial disabled) |
| **POST** | `/api/v1/calls/outbound` | Outbound call initiation (v1 route) | Session / API Key | PARTIALLY READY | **MOCK / SIMULATED** (Validates rate limits; PSTN dial disabled) |
| **GET** | `/api/actions` | Clinical actions list (appointments/tasks) | Session Cookie | READY | **REAL** (Queries Neon DB `AiAction` table) |
| **POST** | `/api/actions` | Create a clinical action / task | Session Cookie | READY | **REAL** (Inserts into Neon DB `AiAction`) |
| **GET** | `/api/actions/[actionId]` | Single clinical action detail | Session Cookie | READY | **REAL** (Queries Neon DB `AiAction`) |
| **PATCH** | `/api/actions/[actionId]` | Update clinical action status | Session Cookie | READY | **REAL** (Updates status in Neon DB) |
| **POST** | `/api/actions/[actionId]/verify-hms` | Verify appointment status against HMS | Session Cookie | PARTIALLY READY | **MOCK** (Queries mock HMS adapter) |
| **GET** | `/api/v1/ivr/flows` | List all IVR flows for tenant | Session Cookie | READY | **REAL** (Queries Neon DB `IvrFlow`) |
| **POST** | `/api/v1/ivr/flows` | Create a new IVR flow draft | Session Cookie | READY | **REAL** (Creates draft in Neon DB) |
| **GET** | `/api/v1/ivr/flows/[flowId]` | Get IVR flow with full node canvas graph | Session Cookie | READY | **REAL** (Reads node/edge graph from Neon DB) |
| **PUT** | `/api/v1/ivr/flows/[flowId]` | Update IVR flow draft canvas graph | Session Cookie | READY | **REAL** (Updates flow definition in Neon DB) |
| **DELETE** | `/api/v1/ivr/flows/[flowId]` | Archive / delete IVR flow draft | Session Cookie | READY | **REAL** (Soft deletes in Neon DB) |
| **POST** | `/api/v1/ivr/flows/[flowId]/validate` | Validate flow for loops, dead ends, traps | Session Cookie | READY | **REAL** (Executes graph validation algorithms) |
| **POST** | `/api/v1/ivr/flows/[flowId]/publish` | Publish flow to immutable version snapshot | Session Cookie | READY | **REAL** (Creates `IvrFlowVersion` snapshot in DB) |
| **POST** | `/api/v1/ivr/flows/[flowId]/rollback` | Rollback flow to prior published version | Session Cookie | READY | **REAL** (Reverts active version in Neon DB) |
| **GET** | `/api/v1/ivr/flows/[flowId]/versions` | List version history of an IVR flow | Session Cookie | READY | **REAL** (Queries `IvrFlowVersion` in Neon DB) |
| **POST** | `/api/v1/ivr/flows/[flowId]/simulate` | Run headless interactive flow simulation | Session Cookie | READY | **REAL** (Executes `IvrFlowEngine` simulation) |
| **GET** | `/api/v1/ivr/flows/[flowId]/mapping` | Get telephony number mapping for flow | Session Cookie | READY | **REAL** (Queries virtual number routing) |
| **GET** | `/api/v1/ivr/templates` | Healthcare IVR flow starter templates | Session Cookie | READY | **REAL** (Returns predefined clinical templates) |
| **GET** | `/api/v1/ivr/emergency` | Get active casualty emergency routing | Session Cookie | READY | **REAL** (Queries `EmergencyRoutingConfig` in DB) |
| **POST** | `/api/v1/ivr/emergency` | Update casualty emergency routing policy | Session Cookie | READY | **REAL** (Updates casualty config in Neon DB) |
| **GET** | `/api/v1/agents` | List AI conversational agents | Session Cookie | READY | **REAL** (Queries Neon DB `AiAgent`) |
| **POST** | `/api/v1/agents` | Create a new AI agent profile | Session Cookie | READY | **REAL** (Creates agent draft in Neon DB) |
| **GET** | `/api/v1/agents/[agentId]` | Get AI agent profile and prompt config | Session Cookie | READY | **REAL** (Reads agent config from Neon DB) |
| **PUT** | `/api/v1/agents/[agentId]` | Update AI agent configuration draft | Session Cookie | READY | **REAL** (Updates draft in Neon DB) |
| **DELETE** | `/api/v1/agents/[agentId]` | Archive AI agent profile | Session Cookie | READY | **REAL** (Soft deletes in Neon DB) |
| **POST** | `/api/v1/agents/[agentId]/publish` | Publish agent to immutable version | Session Cookie | READY | **REAL** (Creates `AiAgentVersion` snapshot in DB) |
| **GET** | `/api/v1/agents/[agentId]/versions` | List version history for an AI agent | Session Cookie | READY | **REAL** (Queries `AiAgentVersion` in Neon DB) |
| **POST** | `/api/v1/agents/voice-preview` | Synthesize live audio preview of prompt | Session Cookie | READY | **REAL** (Calls Sarvam Bulbul TTS API) |
| **POST** | `/api/v1/agents/test` | Interactive text chat test with agent | Session Cookie | READY | **REAL** (Calls Sarvam 105b LLM completions) |
| **GET** | `/api/v1/config/hospital` | Get hospital configuration draft/live | Session Cookie | READY | **REAL** (Queries `HospitalSetting` in Neon DB) |
| **POST** | `/api/v1/config/hospital/validate` | Validate hospital configuration draft | Session Cookie | READY | **REAL** (Validates phone numbers, providers, keys) |
| **POST** | `/api/v1/config/hospital/publish` | Publish hospital config to immutable version | Session Cookie | READY | **REAL** (Creates `HospitalConfigVersion` in DB) |
| **POST** | `/api/v1/config/hospital/rollback` | Rollback hospital config to prior version | Session Cookie | READY | **REAL** (Reverts active version in Neon DB) |
| **GET** | `/api/v1/config/hospital/versions` | List hospital configuration versions | Session Cookie | READY | **REAL** (Queries `HospitalConfigVersion` in DB) |
| **GET** | `/api/v1/config/routing` | Get multi-tenant routing destination config | Session Cookie | READY | **REAL** (Reads routing config from Neon DB) |
| **PUT** | `/api/v1/config/routing` | Update routing destinations draft | Session Cookie | READY | **REAL** (Updates routing draft in Neon DB) |
| **POST** | `/api/v1/config/routing/validate` | Validate routing destinations schema | Session Cookie | READY | **REAL** (Validates E.164 phone formats) |
| **POST** | `/api/v1/config/routing/publish` | Publish routing configuration | Session Cookie | READY | **REAL** (Creates published version in Neon DB) |
| **POST** | `/api/v1/config/routing/rollback` | Rollback routing configuration | Session Cookie | READY | **REAL** (Rolls back version in Neon DB) |
| **GET** | `/api/v1/config/routing/versions` | List routing configuration versions | Session Cookie | READY | **REAL** (Queries versions in Neon DB) |
| **POST** | `/api/v1/config/routing/simulate` | Test routing destination resolution | Session Cookie | READY | **REAL** (Simulates routing logic against rules) |
| **GET** | `/api/v1/config/voice-agent` | Get Sarvam Voice Agent mode & IDs | Session Cookie | READY | **REAL** (Returns active engine mode & IDs) |
| **POST** | `/api/v1/config/voice-agent` | Update Sarvam Voice Agent credentials | Session Cookie | READY | **REAL** (Updates encrypted keys in DB) |
| **GET** | `/api/v1/voice-agent/context` | Sarvam tool: Hospital hours & departments | Sarvam Header / Token | READY | **REAL** (Returns structured hospital context) |
| **GET** | `/api/v1/voice-agent/check-availability` | Sarvam tool: Doctor OPD slots | Sarvam Header / Token | PARTIALLY READY | **MOCK** (Explicitly flags `SIMULATED_MOCK_HMS`) |
| **POST** | `/api/v1/voice-agent/book-appointment` | Sarvam tool: Book OPD appointment | Sarvam Header / Token | PARTIALLY READY | **MOCK** (Explicitly flags `SIMULATION_TESTING`) |
| **POST** | `/api/v1/voice-agent/emergency-escalate` | Sarvam tool: Triage casualty emergency | Sarvam Header / Token | READY | **REAL** (Persists `EmergencyEvent` to Neon DB) |
| **POST** | `/api/v1/voice-agent/call-ended` | Sarvam tool: Post-call transcript webhook | HMAC Signature | READY | **REAL** (Verifies HMAC, saves to Neon DB) |
| **POST** | `/api/webhooks/exotel` | Exotel call status callback webhook | Exotel Webhook Secret | READY | **REAL** (Idempotent call record updates) |
| **POST** | `/api/webhooks/call-ended` | Generic post-call analytics ingestion | HMAC Signature | READY | **REAL** (Persists call duration & transcripts) |
| **POST** | `/api/webhooks/sarvam` | Sarvam Core streaming event webhook | Sarvam Secret | READY | **REAL** (Processes transcription callbacks) |
| **POST** | `/api/webhooks/action-event` | Async clinical action callback | Webhook Secret | READY | **REAL** (Logs `ActionEvent` in Neon DB) |
| **GET** | `/api/knowledge` | List hospital knowledge base articles | Session Cookie | READY | **REAL** (Queries `KnowledgeArticle` in DB) |
| **POST** | `/api/knowledge` | Create a new knowledge base article draft | Session Cookie | READY | **REAL** (Creates draft article in DB) |
| **GET** | `/api/knowledge/[id]` | Get single knowledge base article | Session Cookie | READY | **REAL** (Queries article by ID in DB) |
| **PUT** | `/api/knowledge/[id]` | Update knowledge base article | Session Cookie | READY | **REAL** (Updates article in Neon DB) |
| **DELETE** | `/api/knowledge/[id]` | Delete knowledge base article | Session Cookie | READY | **REAL** (Deletes article in Neon DB) |
| **POST** | `/api/knowledge/[id]/publish` | Publish knowledge base article | Session Cookie | READY | **REAL** (Creates `KnowledgeVersion` in DB) |
| **POST** | `/api/knowledge/sync` | Sync knowledge base articles to AI agent | Session Cookie | READY | **REAL** (Generates structured prompt bundle) |
| **GET** | `/api/integrations/status` | Real-time health status of Exotel/Sarvam | Session Cookie | READY | **REAL** (Performs live network pings) |
| **GET** | `/api/settings` | General hospital settings metadata | Session Cookie | READY | **REAL** (Queries `HospitalSetting` in DB) |
| **PUT** | `/api/settings` | Update general hospital settings | Session Cookie | READY | **REAL** (Updates hospital settings in DB) |
| **GET** | `/api/settings/status` | System health summary for settings tab | Session Cookie | READY | **REAL** (Summarizes database & carrier health) |
| **GET** | `/api/settings/users` | List hospital users & roles | Session Cookie | READY | **REAL** (Queries `User` table in Neon DB) |
| **POST** | `/api/settings/users` | Create a hospital staff user | Session Cookie | READY | **REAL** (Inserts user into Neon DB) |
| **PATCH** | `/api/settings/users/[id]` | Update hospital staff user details | Session Cookie | READY | **REAL** (Updates user in Neon DB) |
| **DELETE** | `/api/settings/users/[id]` | Deactivate / remove hospital staff user | Session Cookie | READY | **REAL** (Deactivates user in Neon DB) |
| **GET** | `/api/v1/gateway/config` | Internal media gateway configuration | Internal API Secret | READY | **REAL** (Returns active ports and routes) |
| **GET** | `/api/v1/providers/capabilities`| Telephony & AI provider capability matrix | Session Cookie | READY | **REAL** (Returns supported features per provider)|

---

## 2. Granular Endpoint Analysis & Defect Identification

### Endpoints Implemented but Unused by Frontend
- `GET /api/v1/providers/capabilities`: Implemented in backend with full capability test coverage, but no frontend settings tab currently consumes this endpoint.
- `GET /api/v1/gateway/config`: Used by standalone media gateway process during initialization; not exposed in frontend UI.
- `POST /api/webhooks/action-event`: Implemented for async hospital HMS callback events, but currently unused because HMS operates in mock mode.

### Endpoints that Return Mock Data
- `GET /api/v1/voice-agent/check-availability`: Returns mock doctor consulting hours and slots (`dataSource: "SIMULATED_MOCK_HMS"`).
- `POST /api/v1/voice-agent/book-appointment`: Returns simulated booking reference (`mode: "SIMULATION_TESTING"`).
- `POST /api/actions/[actionId]/verify-hms`: Verifies appointments against `MockDayaHmsAdapter`.
- `POST /api/calls/outbound` and `POST /api/v1/calls/outbound`: Validates parameters and records mock call without triggering real Exotel PSTN dial.

### Endpoints Lacking Frontend Integration (Direct Client-Side Service Bypasses)
- `GET /api/calls`: Fully working REST API connected to Neon DB. However, `src/app/calls/page.tsx` bypasses this endpoint by importing `callsService` directly into the client bundle, causing in-browser fallback to mock data!
- `GET /api/overview` (Missing Endpoint): `src/app/overview/page.tsx` imports `overviewService` directly into the client bundle; no dedicated `/api/overview` endpoint exists.

### Endpoints with Public / Carrier Authentication (No Session Cookie)
- `/health` & `/status`: Publicly accessible health probes.
- `/exotel/connect-destination`: Authenticated via query parameters (`CallSid`) and carrier IP range.
- `POST /exotel/passthru`: Authenticated via Exotel webhook shared secret.
- `POST /api/webhooks/exotel`: Authenticated via Exotel webhook signature.
- `POST /api/v1/voice-agent/call-ended`: Authenticated via Sarvam HMAC-SHA256 signature (`x-sarvam-signature`) and timestamp (`x-sarvam-timestamp`).
- `GET/POST /api/v1/voice-agent/*`: Authenticated via bearer token or Sarvam header secret.
- `POST /api/auth/login` & `POST /api/auth/reset-password`: Public authentication endpoints.

### Endpoints with Incomplete Error Handling / Gaps
- `POST /api/auth/logout`: Revokes token by adding to an in-memory `Set<string>`. If the Node.js process restarts, revoked tokens become usable again until expiry.
- `POST /api/v1/voice-agent/call-ended`: If the Neon database times out during transcript insertion, returns HTTP 500 without writing to a local disk dead-letter-queue (DLQ).
