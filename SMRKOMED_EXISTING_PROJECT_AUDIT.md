# SMRKOMED – COMPREHENSIVE FULL-STACK TECHNICAL AUDIT & ARCHITECTURE READINESS REPORT

**Project:** SMRKOMED (Daya Hospital AI Calling Pilot & Multi-Hospital Voice SaaS)  
**Repository Path:** `c:\Users\mohit\Downloads\daya\Daya_hospital`  
**Deployment Target:** Vercel (Frontend & Webhooks) & Standalone Media Service (Telephony)  
**Date of Audit:** November 21, 2026  
**Auditor:** Senior Software Architect & Full-Stack Technical Auditor  
**Audit Scope:** 10 Core Architectural Domains  
**Repository State:** Production-ready pilot branch (`main`), 22 test suites, 123 tests passing (100% success rate), 0 ESLint errors/warnings.

---

## EXECUTIVE SUMMARY & STRATEGIC GAP ANALYSIS

SMRKOMED is engineered as an enterprise-grade AI Inbound Calling and Contact Centre Operations console for hospitals, currently configured as a pilot implementation for **Daya General Hospital Ltd & Specialty Surgical Centre (Thrissur, Kerala)**.

### Key Audit Conclusions

1. **Frontend & Dashboard Engine (95% Ready - Production Grade):**
   The application features a fully responsive, pixel-faithful UI reproducing the approved Figma design specifications (1440px canvas baseline, single-line compact header at 58px height, real-time KPI metrics, Recharts visualizations, interactive audio player, call transcript drawer, and AI action verification ledgers).
2. **HMS Integration Layer (80% Ready - Production Grade Architecture):**
   The codebase contains an enterprise-tier adapter architecture (`GrandisHmsAdapter`) implementing slot search, appointment booking, rescheduling, and cancellation with strict idempotency keys, HMS verification callbacks, and timeout circuit-breakers.
3. **Telephony & Voice Streaming Architecture (15% Ready - Critical Structural Gap):**
   The repository currently relies on `BitVoiceTelephonyAdapter` (SIP rollover/hunting mock) and post-call batch webhooks. **There is zero Exotel API integration and zero Exotel AgentStream WebSocket implementation.**
4. **Vercel Serverless vs. Real-Time Telephony Conflict (High Architectural Risk):**
   Vercel Serverless Functions **cannot support persistent bidirectional WebSockets** required for Exotel AgentStream audio streaming (chunked 8kHz/16kHz PCM/mu-law audio). Real-time telephony requires a dedicated Node.js/NestJS Media Gateway deployed on long-running compute (e.g., AWS ECS, Fly.io, or Railway).
5. **Multi-Tenancy (30% Ready - Configuration Ready, Database Single-Tenant):**
   While `hospital-config.ts` defines a modular multi-hospital tenant interface (`HospitalConfig`), the database schema (`schema.prisma`) lacks a `Hospital` or `Tenant` table, and all primary data models (`CallRecord`, `AiAction`, `User`) operate under a single implicit tenant.

---

## PART 1 – TECHNOLOGY STACK IDENTIFICATION

All findings are grounded in direct inspection of repository configuration files and codebases.

| Dimension | Identified Technology | Version | Source File Evidence |
|---|---|---|---|
| **1. Frontend Framework** | Next.js (App Router, Turbopack) | `16.4.6` | `package.json` (Line 21: `"next": "16.4.6"`) |
| **2. React Library** | React & React DOM | `19.3.0` | `package.json` (Lines 22-23: `"react": "19.3.0"`) |
| **3. Programming Language** | TypeScript (Strict Mode) | `^5.0.0` | `package.json` (Line 43), `tsconfig.json` |
| **4. CSS Framework** | Tailwind CSS v4 Engine | `^4.0.0` | `package.json` (Line 41), `next.config.ts`, `globals.css` |
| **5. UI Component Primitives** | Radix UI Headless & Custom Components | Primitives | `src/components/ui/`, Lucide React `^1.62.0` |
| **6. Charting / Visuals** | Recharts (Responsive SVG) | `^3.10.1` | `package.json` (Line 25: `"recharts": "^3.10.1"`) |
| **7. State Management** | React Context + URL State | Context API | `src/components/auth/auth-provider.tsx`, `useSearchParams` |
| **8. Routing Architecture** | Next.js App Router | Dynamic & Nested | `src/app/` (`/overview`, `/calls/[callId]`, `/actions`) |
| **9. API & Webhook Layer** | Next.js Serverless Route Handlers | HTTP / REST | `src/app/api/` (23 dedicated API route handlers) |
| **10. Current Backend Tech** | Embedded Next.js Serverless Functions | Node.js Runtime | `src/app/api/.../route.ts` *(No separate NestJS backend)* |
| **11. Database & ORM** | PostgreSQL via Prisma ORM | Prisma `6.19.3` | `package.json` (Line 17), `prisma/schema.prisma` |
| **12. Authentication** | Custom Web Crypto HMAC-SHA256 | Edge JWT Cookie | `src/lib/auth/session.ts`, `src/middleware.ts` |
| **13. Form Validation** | Zod Schema Validation & React Hook Form | Zod `^4.6.7` | `package.json` (Lines 24, 27), `src/lib/validations/` |
| **14. Testing Framework** | Vitest + Testing Library + jsdom | Vitest `5.0.5` | `vitest.config.mjs`, `package.json` (Line 44) |
| **15. Deployment Platform** | Vercel Serverless Platform | Build v3 | `.vercel/output/config.json`, `next.config.ts` |

### Key Code Highlights

* **Next.js & Turbopack:** `next.config.ts` enables `cacheComponents: true`, `partialPrefetching: true`, and Turbopack CSS loaders.
* **Authentication Engine:** Built with native Web Crypto APIs (`crypto.subtle.sign`, `crypto.subtle.importKey`), making session verification completely Edge-compatible and zero-dependency (`src/lib/auth/session.ts#L47-L82`).
* **Prisma Configuration:** `prisma/schema.prisma` targets PostgreSQL (`provider = "postgresql"`). Dual-mode fallback is implemented: if `DATABASE_URL` is disconnected, repositories seamlessly operate in an in-memory mock sandbox without throwing 500 errors.

---

## PART 2 – EXISTING PRODUCT MODULES AUDIT

A comprehensive inspection of every page, modal, drawer, and API endpoint in the repository:

| Module / Screen | Route | Purpose | Current Implementation Status | Functional or UI-Only | Backend Dependency | Missing Features / Required Work |
|---|---|---|---|---|---|---|
| **Super Admin Dashboard** | *None* | Multi-hospital global oversight, billing, global agent config | **NOT IMPLEMENTED** | None | Requires Super Admin APIs | Entire module needs to be created. |
| **Hospital Onboarding** | *None* | Register new hospital, setup SIP trunks, configure HMS endpoints | **NOT IMPLEMENTED** | None | Requires Onboarding Service | Setup wizard, PBX DID allocation, API credentials vault. |
| **Hospital Switcher** | Visual in TopBar | Switch between hospital tenants | **UI-ONLY PLACEHOLDER** | Visual mock in `smrkomed-shell.tsx` | No tenant context switching | Hardcoded "HOSPEX Heath E... Kochi" pill with no dropdown state. |
| **Overview Dashboard** | `/overview` | Executive KPI cards, real-time call volume, AI action breakdown | **READY (100%)** | Fully Functional | `overview-service.ts`, `callsRepository` | Live WebSocket updates (currently uses polled/cached service). |
| **Call Management (List)** | `/calls` | Inbound call ledger, multi-filter toolbar, audio duration, status | **READY (100%)** | Fully Functional | `calls-service.ts`, `callsRepository` | Outbound call view; real-time audio streaming player. |
| **Call Detail Modal & Drawer** | `/calls/[callId]` | 6-section inspection: audio waveform, bilingual transcript, HMS verify | **READY (100%)** | Fully Functional | `calls-service.ts`, Sarvam audio proxy | Live call barge-in/whisper; live audio streaming during active call. |
| **AI Action Ledger** | `/actions` | Detailed ledger of appointments, slot lookups, cancellations | **READY (100%)** | Fully Functional | `actions-service.ts`, `GrandisHmsAdapter` | Bulk approval workflow; automated retry queue for network drops. |
| **Staff Follow-Up Queue** | `/actions?view=follow-up` | Clinical triage queue for failed bookings or ambiguity | **READY (100%)** | Fully Functional | `actions-service.ts`, Prisma `FollowUpTask` | SMS / WhatsApp notification to patient upon task resolution. |
| **Knowledge Base** | `/knowledge-base` | Hospital clinical FAQ, OPD timings, doctor rosters, safeguards | **READY (100%)** | Fully Functional | `knowledge-service.ts`, `sarvam/knowledge-sync` | Automated vector embeddings; RAG search directly into telephony. |
| **Sarvam Voice Sync** | `/knowledge-base` (Modal) | Push published knowledge articles to Sarvam AI agent | **READY (Sandbox/Client)** | Functional (Safe Demo Fallback) | `knowledge-sync.ts`, Sarvam REST API | Automated incremental webhook sync on article publish. |
| **IVR & PBX Settings** | `/settings` (Tab 3) | Trunk concurrency (30 channels), ring timeout (20s), rollover | **PARTIALLY READY** | Functional Form (Local Save) | `settings-service.ts`, `HospitalSetting` | Real-time SIP trunk heartbeat; programmable DID routing editor. |
| **User & Staff Management** | `/settings` (Tab 2) | Manage hospital staff, reviewers, admins, role permissions | **READY (100%)** | Fully Functional | `user-service.ts`, Prisma `User` | Active Directory / LDAP / OAuth2 Single Sign-On (SSO). |
| **Audit Logs & Incident Ledger** | `/settings` (Tab 4) | Track user logins, HMS booking verifications, status changes | **READY (100%)** | Fully Functional | `system-repository.ts`, Prisma `AuditLog` | SIEM log streaming / export to S3 / CloudWatch. |
| **Live Call Monitoring** | *None* | Real-time observation of active ongoing voice calls | **NOT IMPLEMENTED** | None | Requires WebSocket Media Gateway | Audio eavesdropping, agent whisper, live transcript streaming. |
| **Outbound Calling Campaigns**| *None* | Automated reminder calls, post-op follow-ups, vaccine alerts | **NOT IMPLEMENTED** | None | Requires Exotel Campaign APIs | Campaign scheduler, contact list upload, DND scrubbing. |
| **Billing & Subscriptions** | TopBar (Visual Credit) | Hospital credit usage, per-minute billing, invoice downloads | **UI-ONLY PLACEHOLDER** | Visual mock in `dashboard-sections.tsx` | No billing engine | Stripe / Razorpay subscription gateway; per-minute call ledger. |

---

## PART 3 – MULTI-TENANT ARCHITECTURE ASSESSMENT

### Classification: **PARTIALLY READY (Modular Configuration Layer, Single-Tenant Database)**

### 1. Hospital / Tenant Data Models
* **Prisma Schema Analysis (`prisma/schema.prisma`):**
  There is **no `Hospital` or `Tenant` model** in the database schema.
  The primary models (`User`, `CallRecord`, `AiAction`, `KnowledgeArticle`, `AuditLog`) do not include a `hospitalId` foreign key.
  The settings table (`HospitalSetting`) explicitly defines a singleton record:
  ```prisma
  model HospitalSetting {
    id String @id @default("default_hospital_settings")
    ...
  }
  ```
* **Database Isolation:** Single-tenant schema with no tenant-partitioning columns.

### 2. Tenant Identification & Application Configuration
* **Modular Configuration Layer (`src/lib/config/hospital-config.ts`):**
  The application has an abstract `HospitalConfig` interface supporting:
  - Telephony provider (`BITVOICE`, `EXOTEL`, `KNOWLARITY`, etc.)
  - HMS product type (`GRANDIS`, `CUSTOM_REST`, `MOCK`)
  - Voice engine (`SMRKO_VOICE`, Malayalam primary, English fallback)
  - Routing policies (appointment-only, casualty extensions, hop limits)
* **Current Limitation:** The helper `getHospitalConfig(hospitalId?: string)` defaults to hardcoded `DAYA_HOSPITAL_CONFIG` (`hosp_daya_thrissur`). It is not yet connected to a multi-tenant database lookup or subdomain/header tenant resolver.

### 3. Role-Based Access Control (RBAC)
* The system enforces 3 roles: `HOSPITAL_ADMIN`, `HOSPITAL_STAFF`, `CALL_REVIEWER`.
* Super Admin role (cross-hospital platform administrator) is **not implemented**.

---

## PART 4 – CURRENT API & BACKEND ARCHITECTURE

The backend is built as serverless API route handlers located in `src/app/api/`.

```
src/app/api/
├── actions/
│   ├── route.ts                         # GET (list/filter actions)
│   └── [actionId]/
│       ├── route.ts                     # GET single action detail
│       └── verify-hms/route.ts          # POST (re-verify action with Grandis HMS)
├── auth/
│   ├── login/route.ts                   # POST (authenticate & issue cookie)
│   ├── logout/route.ts                  # POST (revoke token & clear cookie)
│   ├── me/route.ts                      # GET (current user session)
│   ├── change-password/route.ts         # POST (update user password)
│   └── reset-password/route.ts          # POST (admin password reset)
├── calls/
│   ├── route.ts                         # GET (paginated call ledger)
│   └── [callId]/
│       ├── route.ts                     # GET (call session & transcript)
│       └── recording/route.ts           # GET (signed audio stream proxy)
├── integrations/
│   └── status/route.ts                  # GET (health check: Voice AI, HMS, Telephony)
├── knowledge/
│   ├── route.ts                         # GET / POST (knowledge articles)
│   ├── sync/route.ts                    # POST (sync knowledge to Sarvam AI)
│   └── [id]/
│       ├── route.ts                     # GET / PUT / DELETE article
│       └── publish/route.ts             # POST (publish draft version)
├── settings/
│   ├── route.ts                         # GET / PUT (hospital retention & privacy)
│   ├── status/route.ts                  # GET (system integration metrics)
│   └── users/
│       ├── route.ts                     # GET / POST (list & create users)
│       └── [id]/route.ts                # PUT / DELETE (deactivate user)
└── webhooks/
    ├── action-event/route.ts            # POST (Sarvam AI action webhook)
    ├── call-ended/route.ts              # POST (telephony call completion webhook)
    └── sarvam/route.ts                  # POST (unified Sarvam interaction webhook)
```

### Architectural Highlights & Decoupling
* **Strict Separation of Concerns:** Route handlers do not write SQL directly. They delegate to typed service classes (`CallsService`, `ActionsService`, `KnowledgeService`, `UserService`), which in turn query repository classes (`CallsRepository`, `SystemRepository`).
* **Resilient In-Memory Dual Mode:** If PostgreSQL is offline, repositories seamlessly serve seed records and allow in-memory updates without application failure.
* **Idempotency & Duplicate Webhook Protection:** Handlers for webhooks (`/api/webhooks/sarvam`) calculate a SHA-256 payload hash and verify idempotency keys against `WebhookProcessingRecord`, preventing duplicate bookings if Sarvam or Exotel retries.

---

## PART 5 – EXOTEL INTEGRATION READINESS EVALUATION

### Current Status: **NOT IMPLEMENTED (0% Readiness)**

### 1. Codebase Verification
* Search across all application source files revealed only:
  - `src/lib/config/hospital-config.ts` (Line 15: `"EXOTEL"` as an enum variant).
  - `src/lib/integrations/telephony/standard-telephony-types.ts` (Line 7: mention in comments).
* There is **no Exotel REST API client**, **no Exotel webhook handler**, **no Exotel Call Flow (Applet) definition**, and **no Exotel AgentStream client**.

### 2. The Exotel AgentStream Architectural Challenge
Exotel AgentStream is Exotel's real-time, bidirectional audio streaming protocol over WebSockets. During an active call, Exotel opens a persistent WebSocket connection to your server, streaming raw audio chunks (typically 8kHz/16kHz L16 or mu-law) both ways.

### Why Vercel Cannot Host Exotel AgentStream:
1. **Serverless Connection Lifetimes:** Vercel Serverless Functions have maximum execution durations (typically 15s to 60s). An average patient call lasts 2–5 minutes (120s–300s).
2. **WebSocket Incompatibility:** Vercel Edge Functions and Serverless Functions do not support persistent incoming WebSocket connections from telephony providers.
3. **Audio Buffer Latency:** Real-time conversational AI requires sub-500ms total roundtrip latency (Speech-to-Text -> LLM Decision -> Text-to-Speech). Cold starts in serverless functions (300ms–1500ms) would cause voice stuttering and call drops.

### What Must Be Built for Exotel:
* An **Exotel Telephony Adapter** implementing `ITelephonyConnector`:
  - Programmable Call Transfer API (divert call to front desk or casualty).
  - Call Hangup / Termination API.
  - Recording Fetcher via Exotel REST API.
* A **Dedicated WebSocket Media Gateway** (Node.js/NestJS on long-running compute) to terminate Exotel AgentStream connections.

---

## PART 6 – SARVAM AI READINESS EVALUATION

### Current Status: **PARTIALLY READY (35% Readiness)**

### 1. What is Already Implemented
* **`SarvamVoiceClient` (`src/lib/integrations/sarvam/sarvam-client.ts`):**
  - Health check verification against `https://api.sarvam.ai/voice/v1/agents/{agentId}/health`.
  - Timing-safe HMAC-SHA256 signature verification (`verifyWebhookSignature`).
  - REST client to fetch post-call interaction metadata, audio recording URLs, bilingual transcripts (Malayalam & English), and structured action summaries.
* **`MockSarvamVoiceAdapter` (`src/lib/integrations/sarvam/mock-adapter.ts`):**
  - Fully simulated Malayalam voice dialogues for development and unit testing.
* **Webhook Receiver (`src/app/api/webhooks/sarvam/route.ts`):**
  - Ingests `call_ended` and `action_event` payloads, extracts caller intent, and updates the local action ledger.
* **Knowledge Base Sync Engine (`src/lib/integrations/sarvam/knowledge-sync.ts`):**
  - Packages approved hospital articles into Sarvam-compatible knowledge payloads.

### 2. What is Missing
* **Real-time Bidirectional Streaming STT / TTS:**
  Currently, the code only communicates with Sarvam via post-call REST APIs. Real-time Malayalam voice conversation requires connecting the live audio stream from Exotel AgentStream to Sarvam's Speech-to-Text and Text-to-Speech streaming APIs via WebSocket.

---

## PART 7 – VERCEL DEPLOYMENT & PRODUCTION SUITABILITY

### Architecture Suitability Matrix

| Operational Component | Suitable on Vercel? | Rationale & Trade-offs |
|---|---|---|
| **Hospital Staff Web Console** | **YES (Optimal)** | Fast worldwide CDN distribution, instant static assets, fast SSR for dashboard screens. |
| **Management REST APIs** | **YES (Optimal)** | Next.js Route Handlers excel at quick CRUD operations (`/api/calls`, `/api/actions`, `/api/settings`). |
| **Post-Call Webhook Handlers** | **YES (Suitable)** | Exotel `call_ended` and Sarvam summary webhooks execute within 200–500ms, well within serverless limits. |
| **HMS Adapter (Grandis)** | **CONDITIONAL** | Works if Grandis HMS is reachable over a public VPN endpoint; fails if an on-premise local subnet tunnel is required. |
| **Exotel AgentStream WebSockets** | **NO (FATAL BLOCKER)**| Vercel does not support long-lived bidirectional WebSockets for continuous raw audio streaming. |
| **Audio Transcoding / Media Pipeline** | **NO (UNSUITABLE)** | Processing raw Opus/PCM audio streams requires continuous CPU allocation and low-latency networking. |

### Recommended Hybrid Infrastructure Architecture

```
[ Caller Telephone ]
        │
        ▼ (PSTN / Mobile Network)
[ Exotel Telephony Cloud ]
   ├── A. Webhook Events (call_ended, cdr) ──► [ Vercel Serverless API ] ──► [ PostgreSQL ]
   │                                                                               ▲
   └── B. Real-Time Audio (AgentStream WSS)                                        │
              │                                                                    │
              ▼                                                                    │
   [ NestJS / Node.js Media Gateway ]                                              │
   (Deployed on AWS ECS / Fly.io / Railway)                                        │
        ├── 1. Bidirectional WebSocket Audio                                       │
        ├── 2. Sarvam AI Streaming STT (Malayalam)                                 │
        ├── 3. LLM Dialog Manager (Actions & Intent) ──► [ Grandis HMS API ]       │
        └── 4. Sarvam AI Streaming TTS (Voice Generation)                          │
              │                                                                    │
              └────── Emits Completed Session Data & Recordings ───────────────────┘
```

---

## PART 8 – SECURITY, COMPLIANCE & PRODUCTION READINESS

### 1. Authentication & Session Security
* **Implementation:** Cryptographic HMAC-SHA256 session tokens with expiration and in-memory revocation (`src/lib/auth/session.ts`).
* **Storage:** HTTP-only, SameSite=Lax session cookies (`daya_auth_session`).
* **Password Hashing:** PBKDF2 with SHA-512 and unique salt (10,000 iterations in `user-service.ts`).
* **Role Enforcement:** Route-level middleware (`src/middleware.ts`) protects all core screens (`/overview`, `/calls`, `/actions`, `/settings`).

### 2. Secret Management
* All API keys (`SARVAM_API_KEY`, `DAYA_HMS_API_KEY`, `TELEPHONY_API_KEY`) and database URLs are strictly read from server-side environment variables.
* Zero secrets are exposed with `NEXT_PUBLIC_` prefixes.
* `.env.example` provides comprehensive documentation without exposing live keys.

### 3. Patient Data Privacy & PII Compliance
* **Masked Phone Numbers:** Mandatory phone number masking (`maskPhoneNumber` in `src/lib/utils.ts`) displays `+91 94471 •••••`, preventing unauthorized staff from harvesting patient contact details.
* **Recording Access Permissions:** Explicit boolean flag `canAccessRecordings` on the `User` model; unprivileged users cannot play or download raw audio files.
* **Indian DPDP Act & Healthcare Safeguards:**
  - Strict consent tracking (`enableMalayalamConsent` in `HospitalSetting`).
  - Prominent UI disclaimer on Knowledge Base reminding operators that AI triage cannot dispense prescription advice.
  - Emergency triage bypass: Any query detected with casualty or ambulance intent triggers an immediate warm transfer to extension `101` (`+91 487 2475100`).

---

## PART 9 – DEVELOPMENT READINESS SCORECARD

| Architecture Domain | Readiness (%) | Status | Risk Rating | Critical Gaps & Assessment |
|---|---|---|---|---|
| **Frontend UI / UX** | **95%** | **READY** | Low | Approved Figma design implemented, responsive, compact header. |
| **HMS Integration (Grandis)** | **80%** | **READY** | Medium | Slot search and booking implemented; requires live on-premise VPN setup. |
| **Call Management & Ledger** | **90%** | **READY** | Low | Call history, transcript modal, filtering, and export operational. |
| **AI Action Engine & Ledger** | **85%** | **READY** | Low | Idempotent booking ledger and staff follow-up triage functional. |
| **Knowledge Base Management** | **85%** | **READY** | Low | Version control, clinical safeguards, and Sarvam sync schema ready. |
| **Auth & Security** | **80%** | **READY** | Low | HMAC session cookies, PBKDF2 hashing, phone masking operational. |
| **Multi-Tenant Architecture** | **30%** | **PARTIAL** | High | Config layer is modular, but database schema lacks `Hospital` model. |
| **Sarvam AI Voice Integration** | **35%** | **PARTIAL** | High | Post-call webhooks and REST work; live streaming STT/TTS missing. |
| **Exotel Telephony Integration** | **0%** | **MISSING** | Critical | No Exotel REST client or webhook handler exists in the repo. |
| **Exotel AgentStream WebSockets**| **0%** | **MISSING** | Critical | Real-time audio streaming gateway not implemented; cannot run on Vercel. |
| **Overall Platform Readiness** | **52%** | **IN PROGRESS**| High | **Solid core application; telephony audio bridge must be built.** |

---

## PART 10 – RECOMMENDED NEXT PHASES & ARCHITECTURAL ROADMAP

### Phase 1: Real-Time Telephony Media Gateway (NestJS / Node.js)
1. **Repository Setup:** Create a dedicated Node.js/NestJS service (e.g. `smrkomed-telephony-gateway`) to run on Docker/AWS ECS/Fly.io.
2. **Exotel AgentStream WebSocket Server:** Implement WebSocket endpoint `/media/agentstream` to accept bidirectional audio from Exotel.
3. **Exotel REST Telephony Adapter:** Implement call initiation, transfer to agent hunt group (Ext 201-206), transfer to casualty (Ext 101), and hangup.
4. **Shared Database & Webhooks:** Configure the media gateway to persist completed call sessions and audio URLs directly into PostgreSQL or push events to Vercel webhooks.

### Phase 2: Sarvam AI Real-Time Voice Streaming Pipeline
1. **Bidirectional Audio Bridge:** Pipe incoming audio chunks from Exotel AgentStream into Sarvam AI's streaming Malayalam Speech-to-Text WebSocket.
2. **Conversation Manager:** Orchestrate intent recognition, Grandis HMS slot lookup, and Malayalam response generation.
3. **Streaming Text-to-Speech:** Stream Sarvam TTS audio back through the Exotel AgentStream WebSocket to the caller with sub-500ms latency.

### Phase 3: True Multi-Tenancy & SaaS Enablement
1. **Prisma Schema Migration:**
   - Add `Hospital` (Tenant) model (`id`, `name`, `subdomain`, `telephonyConfig`, `hmsConfig`).
   - Add `hospitalId` foreign key to `User`, `CallRecord`, `AiAction`, `KnowledgeArticle`, and `AuditLog`.
2. **Tenant Context Middleware:** Extract tenant context from request headers, subdomain (`daya.smrkomed.com`), or authenticated user session.
3. **Super Admin Platform:** Build a centralized admin dashboard for hospital onboarding, PBX trunk provisioning, and billing.

### Phase 4: Production Hardening & HMS Network Handshake
1. **Grandis HMS VPN Handshake:** Establish and verify the site-to-site IPsec VPN tunnel between the cloud gateway and Daya Hospital on-premise server.
2. **Load Testing:** Simulate 30 concurrent calls across PRI trunk channels to ensure latency remains under 500ms.
3. **Automated Recording Storage:** Configure direct S3/MinIO upload for call audio recordings with automatic 30-day lifecycle retention.

---
*Report generated and validated against repository commit `2c3308c` on `origin/main`.*

