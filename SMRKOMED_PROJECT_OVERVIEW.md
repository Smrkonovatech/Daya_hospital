# SMRKOMED — PROJECT OVERVIEW & CONCEPTUAL FOUNDATION

## 1. Executive Summary

**Smrkomed** (formerly referenced during initial prototyping as Daya Hospital AI Assistant) is an enterprise-grade, multi-tenant cloud telephony and conversational AI platform engineered specifically for Indian hospitals and healthcare networks.

Its primary mission is to automate high-volume hospital inbound phone communications—such as outpatient (OPD) doctor enquiries, consulting schedule queries, department routing, appointment scheduling, and 24/7 casualty emergency triage—using low-latency, bilingual conversational AI (Malayalam and Indian English).

The platform is designed around a multi-hospital architecture. **Daya General Hospital, Thrissur** (Kerala, India) serves as the primary launch and pilot tenant (`hosp_daya_thrissur`). However, the entire codebase, database schema, media gateway, and orchestration services are strictly multi-tenant and reusable across any hospital group (e.g. Aster Medcity, KIMS Trivandrum).

---

## 2. The Problem Smrkomed Solves

Hospitals across India, particularly tertiary care centers like Daya General Hospital, face severe operational challenges with telephony communications:

1. **High Inbound Call Volume & Peak Congestion:**
   Between 8:00 AM and 12:00 PM, hospital receptionists face hundreds of simultaneous calls from patients asking routine questions: *"Which doctor is sitting in ENT today?"*, *"What are the visiting hours?"*, *"Can I get an appointment with Dr. Anand Menon?"*. This causes long hold times, high call abandonment rates, and immense receptionist burnout.

2. **Regional Language Barrier:**
   In Kerala, over 85% of callers communicate in spoken Malayalam or informal colloquial Malayalam mixed with English ("Manglish"). Off-the-shelf voice bots built on Western speech models fail to transcribe Malayalam accents, regional dialects, and local medical terms.

3. **Casualty & Emergency Safety Risks:**
   When callers experience acute life-threatening medical emergencies (e.g. sudden severe chest pain, acute breathlessness, stroke symptoms, pediatric trauma), standard automated IVR phone trees can delay care. Smrkomed solves this with a **zero-delay emergency fast-track protocol**: acute medical keywords immediately trigger an emergency override, routing the call instantly to the hospital's 24/7 Casualty Desk.

4. **Hospital HMS Disconnection:**
   Traditional cloud telephony systems are completely disconnected from the hospital's on-premise Hospital Management System (HMS). Receptionists must manually toggle between phone systems and HMS booking screens. Smrkomed bridges this gap by providing real-time AI tool-calling integrations into hospital HMS databases.

---

## 3. Product Architecture Overview

Smrkomed is organized into four distinct architectural tiers:

```
[Inbound Patient Caller (PSTN / Mobile)]
                   │
                   ▼
[Cloud Telephony Carrier (Exotel Singapore / Vobiz)]
                   │
         Bidirectional Streaming
                   │
                   ▼
[Smrkomed Media Gateway & Orchestration Server (Railway)]
   ├── Inbound Audio Engine (8000 Hz Linear PCM)
   ├── Dynamic Tenant Resolver & Routing Engine
   ├── Deterministic Healthcare IVR Engine
   └── Dual AI Conversational Pipeline:
         ├── Engine A: Sarvam Core Custom (STT Saaras:v4 + LLM 105B + TTS Bulbul:v3)
         └── Engine B: Sarvam Voice Agents / Samvaad Platform (Deployment Inbound-3b5df8df-f098)
                   │
         Tool Calling & Webhooks
                   │
                   ▼
[Hospital Systems & Human Staff Handover]
   ├── Hospital HMS Gateway (Grandis HMS / Mock Fallback)
   ├── Neon Serverless PostgreSQL Database (AWS ap-southeast-1)
   └── Human Receptionist & Casualty Desk PSTN Handover (+919606654032)
```

---

## 4. How the Hospital Telephony System Works

Smrkomed integrates with cloud telephony carriers via carrier-grade virtual numbers (ExoPhones):

1. **Virtual Number Assignment:**
   Daya General Hospital is assigned the dedicated ExoPhone `08047291658`. This number is connected to Exotel Applet `1393239` (titled *"Daya Hospital Voicebot"*).
2. **Audio Streaming Handshake:**
   When a caller dials `08047291658`, Exotel initiates an audio streaming session over a secure WebSocket (`wss://dayahospital-production-467a7d31.up.railway.app/exotel/voicebot`). Raw linear PCM audio (8000 Hz, 16-bit, mono) is streamed bidirectionally between the caller's mobile handset and the Smrkomed Media Gateway.
3. **Session Lifecycle & Call Termination:**
   The Media Gateway tracks the session through `MediaSessionManager`. When the conversation naturally concludes, or when an escalation is triggered, the Media Gateway terminates the WebSocket connection and emits audio flush events.
4. **Call Records & Audio Archival:**
   Upon call completion, telephony webhooks ingest call duration, disposition codes, recording URLs, and turn-by-turn transcripts, persisting them into Neon PostgreSQL.

---

## 5. How AI Voice Agents Work

Smrkomed provides a **Dual Conversational Engine Architecture**, controlled dynamically via the environment variable `CONVERSATION_ENGINE_MODE`:

### Mode A: `SARVAM_CORE_CUSTOM` (Active Production Engine)
- **Speech-to-Text (STT):** Streams caller audio chunks directly to Sarvam's `saaras:v4` model over WebSockets. Employs local root-mean-square (RMS) energy-based Voice Activity Detection (VAD) with a 400-energy threshold to support instant caller barge-in.
- **Conversational LLM:** Utilizes `sarvam-105b-conversations` via streaming REST completions. Implements pipelined first-sentence streaming: as soon as the first complete sentence is synthesized by the LLM, it is dispatched to TTS before the remaining paragraph completes generation.
- **Text-to-Speech (TTS):** Synthesizes dialogue responses using Sarvam's `bulbul:v3` model with the native Malayalam speaker `kavitha` at a 1.15 pace factor. Converts output audio directly into signed 16-bit 8000 Hz linear PCM formatted for Exotel. Commonly repeated phrases (e.g. hospital greetings) are cached in memory for sub-10ms delivery.

### Mode B: `SARVAM_VOICE_AGENTS` (Samvaad Managed Cloud Agent)
- Connects Smrkomed to Sarvam's high-level voice agent platform (Workspace `01a06777-00da-7f77-abe3-dc1fc871a5ab`, Organization `01a06777-00d4-7317-835c-507054052514`).
- Uses the live published Daya pilot agent (App ID `smrkomed-8401f738-b749`, Version `8`, Deployment `Inbound-3b5df8df-f098`).
- Sarvam handles STT, LLM reasoning, interruption handling, and TTS internally on its cloud infrastructure, calling Smrkomed back via serverless tool-calling webhooks for data retrieval and actions.

---

## 6. How Exotel Telephony is Integrated

Exotel integration is decoupled and multi-layered:
- **Account Configuration:** Hosted on Exotel's Singapore cluster (`api.exotel.com/v1/Accounts/smrkomed1`).
- **Inbound Streaming:** Handled by `src/media-gateway/server.ts` through WebSocket endpoint `/exotel/voicebot`.
- **Programmable Connect Destination:** Handled via `GET /exotel/connect-destination`. Exotel queries this endpoint to dynamically resolve where to route a forwarded call. The endpoint returns the compliant Programmable Connect JSON contract:
  ```json
  {
    "fetch_after_attempt": false,
    "destination": {
      "numbers": ["+919606654032"]
    },
    "record": true
  }
  ```
- **Passthru Webhook:** Handled via `POST /exotel/passthru` to report call status events, recording links, and transfer resolutions.

---

## 7. How Sarvam APIs are Integrated

Sarvam provides the speech intelligence layer through two distinct integration paths:
1. **Sarvam Core API (`api.sarvam.ai`):**
   - Authenticated using `SARVAM_API_KEY`.
   - Used by the custom media gateway for low-level STT (`saaras:v4`), text generation (`sarvam-105b-conversations`), and TTS (`bulbul:v3`).
2. **Sarvam Voice Agents API (`apps.sarvam.ai`):**
   - Authenticated using `SARVAM_VOICE_AGENT_API_KEY` (`sk_samvaad_...`) passed in the `X-API-Key` HTTP header.
   - Provides App Authoring, Analytics, and Telephony deployment inspection APIs.
   - 5 dedicated tool-calling webhook endpoints are hosted on Smrkomed:
     1. `GET /api/v1/voice-agent/context`
     2. `GET /api/v1/voice-agent/check-availability`
     3. `POST /api/v1/voice-agent/book-appointment`
     4. `POST /api/v1/voice-agent/emergency-escalate`
     5. `POST /api/v1/voice-agent/call-ended`

---

## 8. How Smrkomed Communicates with the Hospital HMS

Connecting cloud telephony to hospital management systems requires navigating private hospital networks:
- **Daya Hospital Grandis HMS:** Daya General Hospital utilizes an on-premise HMS known as **Grandis HMS**. Grandis runs on an internal hospital server that is not exposed to the public internet and requires an encrypted IPsec VPN gateway for access.
- **Architectural Adapter:** Smrkomed implements `GrandisHmsAdapter` (`src/lib/integrations/hms/grandis-adapter.ts`) adhering to the standardized `IHmsConnector` interface.
- **Current Operational Reality:** Because a production VPN tunnel between Railway's cloud infrastructure and Daya Hospital's on-premise server has not yet been established by hospital IT, the system operates in **SIMULATED MOCK MODE** (`MockDayaHmsAdapter`). All appointment availability queries and booking transactions return structured mock responses explicitly tagged with `dataSource: "SIMULATED_MOCK_HMS"` and `isSimulated: true`. No actual patient records are created or altered in Grandis HMS at this stage.

---

## 9. How Multi-Hospital Tenancy Works

Smrkomed is fundamentally multi-tenant:
- **Data Isolation:** Every table in the Neon PostgreSQL database (with the exception of global system logs) is partitioned by `hospitalId` (e.g. `hosp_daya_thrissur`, `hosp_aster_medcity`, `hosp_kims_trivandrum`).
- **Dynamic Tenant Resolution:** Inbound calls arriving at the gateway are resolved to a tenant using:
  1. The dialed virtual phone number (e.g. `08047291658` maps to Daya Hospital).
  2. The carrier Account SID.
  3. The `X-Hospital-Id` HTTP header for internal API calls.
- **Immutable Version Snapshots:** Each hospital maintains independent IVR flows, AI agent configurations, and routing policies. Active calls are locked to the specific configuration version active when the call was answered (`IvrFlowExecutionSession`). If an administrator publishes a new configuration draft while 20 calls are in progress, those 20 calls continue executing on their existing version snapshot without disruption.

---

## 10. Clear Project Boundaries

To maintain focus and system integrity:
- **IN SCOPE:** Hospital telephony, Exotel PSTN integration, Sarvam Core & Sarvam Voice Agents AI engines, Malayalam/English speech processing, hospital IVR orchestration, casualty emergency escalation, human receptionist transfer, and HMS tool-calling interfaces.
- **OUT OF SCOPE:** WhatsApp messaging, SMS marketing campaigns, billing payment gateways, or patient portal mobile apps. Smrkomed is strictly an enterprise voice telephony and clinical reception assistant platform.
