# SMRKOMED — MASTER DEVELOPER HANDOVER & CODEBASE MANUAL

Welcome to the Smrkomed project. This document is the **master technical handover guide** designed to give you a complete, unvarnished, and verified understanding of the entire codebase, its current operational state, its architectural foundations, and its immediate engineering priorities.

---

## 1. Handover Documentation Index

This handover suite consists of 10 comprehensive documents. You should read them in the following recommended sequence:

1. [SMRKOMED_PROJECT_OVERVIEW.md](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/SMRKOMED_PROJECT_OVERVIEW.md)
   - What Smrkomed is, the problems it solves for Indian hospitals, conceptual architecture, and pilot tenant context.
2. [SMRKOMED_TECHNICAL_ARCHITECTURE.md](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/SMRKOMED_TECHNICAL_ARCHITECTURE.md)
   - Deep architectural breakdown, technology stack versions, and full Mermaid diagram of the live caller $\rightarrow$ telephony $\rightarrow$ AI $\rightarrow$ receptionist pipeline.
3. [SMRKOMED_FEATURE_READINESS_MATRIX.md](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/SMRKOMED_FEATURE_READINESS_MATRIX.md)
   - Detailed, evidence-based readiness audit of all 32 feature areas (classified into READY, PARTIALLY READY, MOCK/SIMULATED, BLOCKED).
4. [SMRKOMED_API_INVENTORY.md](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/SMRKOMED_API_INVENTORY.md)
   - Exhaustive inventory table of all 62 Next.js App Router API endpoints and Media Gateway routes, identifying real vs. mock handlers and authentication requirements.
5. [SMRKOMED_DATABASE_DOCUMENTATION.md](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/SMRKOMED_DATABASE_DOCUMENTATION.md)
   - Complete data model reference for the 29 Prisma models, 5 migrations, schema drift analysis, and tenant isolation policies.
6. [SMRKOMED_INFRASTRUCTURE_GUIDE.md](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/SMRKOMED_INFRASTRUCTURE_GUIDE.md)
   - Hosting topology across Railway, Neon PostgreSQL, and Exotel, with environment variable inventories and health check runbooks.
7. [SMRKOMED_DEVELOPER_SETUP.md](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/SMRKOMED_DEVELOPER_SETUP.md)
   - Practical step-by-step onboarding guide: prerequisites, dependency installation, running tests, local media gateway startup, and non-negotiable safety rules.
8. [SMRKOMED_KNOWN_ISSUES_AND_TECH_DEBT.md](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/SMRKOMED_KNOWN_ISSUES_AND_TECH_DEBT.md)
   - Full catalog of security findings, architectural technical debt, in-memory state dependencies, and severity rankings (Critical to Low).
9. [SMRKOMED_NEXT_DEVELOPMENT_ROADMAP.md](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/SMRKOMED_NEXT_DEVELOPMENT_ROADMAP.md)
   - Prioritized development roadmap (Phases 11 through 16) with clear dependencies, affected files, acceptance criteria, and complexity estimates.
10. **`SMRKOMED_NEW_DEVELOPER_HANDOVER.md`** (This Document)
    - Master executive summary and foundational operational rules.

---

## 2. Fast-Track System Summary

### What is Smrkomed?
Smrkomed is a multi-tenant healthcare cloud telephony and conversational AI platform engineered to handle inbound hospital calls in Malayalam and Indian English. It automates doctor consulting hours inquiries, outpatient department (OPD) queries, and appointment booking, while providing zero-delay casualty emergency triage and dynamic forwarding to human receptionists.

### What is Genuinely Working (Proven Operational)?
- **Inbound Telephony Handshake:** Calling Daya's Exotel ExoPhone `08047291658` answers via Applet `1393239`, opens an 8000 Hz linear PCM WebSocket to the Railway Media Gateway, and streams audio bidirectionally.
- **Custom Conversational AI (Mode A - `SARVAM_CORE_CUSTOM`):** Streams caller audio to Sarvam's `saaras:v4` STT model, generates response sentences via `sarvam-105b-conversations`, and synthesizes Malayalam voice via `bulbul:v3` (Kavitha voice) with sub-second latency and local energy VAD barge-in.
- **Sarvam Voice Agents (Mode B - `SARVAM_VOICE_AGENTS`):** Validated live on Sarvam Samvaad platform (App ID `smrkomed-8401f738-b749`, Deployment `Inbound-3b5df8df-f098`) on Vobiz number `+918064265889`. 5 tool webhooks verified with HMAC-SHA256 signature contracts.
- **Human Receptionist & Emergency Transfer:** Media Gateway records escalation decisions in Neon DB, flushes audio, and closes the WebSocket. Exotel queries `/exotel/connect-destination` and dynamically receives the compliant Programmable Connect JSON schema with destination number `+919606654032`.
- **Database & Code Quality Baseline:** 87 automated tests passing across 7 suites; 0 TypeScript compilation errors (`tsc --noEmit`); Next.js production build succeeds with 103 compiled routes.

### What is Partially Working?
- **Frontend Overview & Calls Pages:** Backend REST API `/api/calls` works and connects to Neon DB. However, the client-side React pages import `callsService` directly into the browser bundle, causing the browser to fall back to in-memory mock call records because `DATABASE_URL` is undefined on the client.
- **Session Logout:** Session tokens are revoked in an in-memory `Set<string>`. Revocations do not survive container restarts or multi-instance scaling.

### What is Mocked or Blocked?
- **Hospital Management System (HMS):** Daya Hospital's on-premise Grandis HMS server is located behind their local network without an active IPsec VPN tunnel. Therefore, doctor availability lookups and appointment bookings operate against **SIMULATED MOCK HMS** data (`MockDayaHmsAdapter`).
- **Database Models for Clinical Entities:** There are currently no tables for `Doctor`, `Department`, or `Appointment` in `prisma/schema.prisma`. Appointments are stored as generic `AiAction` entries.
- **Exotel BYOT on Sarvam Voice Agents:** Sarvam Voice Agents does not currently have Exotel SIP trunking attached, nor does it support in-flight transfers. Live Exotel calls must remain on Mode A (`SARVAM_CORE_CUSTOM`).

---

## 3. What You Must Work on First

Follow this exact sequence from the [Next Development Roadmap](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/SMRKOMED_NEXT_DEVELOPMENT_ROADMAP.md):

1. **Phase 11 (Immediate):** Commit the 21 uncommitted files from Phases 9.6 through 10.2, push to `origin/main`, deploy to Railway, and verify that the live Railway service returns HTTP 200 on `/exotel/connect-destination` and `/api/v1/voice-agent/context`.
2. **Phase 12:** Refactor `src/app/calls/page.tsx` and `src/app/overview/page.tsx` to execute standard `fetch('/api/calls')` and `fetch('/api/overview')` calls, enabling hospital administrators to see live database records in their browser.
3. **Phase 13:** Add `Doctor`, `Department`, and `Appointment` models to `prisma/schema.prisma` and create database migrations to replace in-memory clinical mocks.

---

## 4. What You Must AVOID Changing (Non-Negotiable Guardrails)

As the incoming developer, you must respect the following boundaries:

1. **DO NOT MODIFY EXOTEL APPLET `1393239`:**
   Applet `1393239` in the Exotel Singapore portal is configured for the live pilot ExoPhone `08047291658`. Editing this applet will immediately break inbound phone calls for Daya General Hospital.
2. **DO NOT SWITCH `CONVERSATION_ENGINE_MODE` TO `SARVAM_VOICE_AGENTS` FOR EXOTEL CALLS:**
   Exotel is not connected via BYOT to Sarvam Voice Agents. Setting `CONVERSATION_ENGINE_MODE=SARVAM_VOICE_AGENTS` on Railway will break human transfers and emergency escalations for Exotel callers. Keep `SARVAM_CORE_CUSTOM` active for live telephony.
3. **DO NOT INITIATE REAL PSTN OUTBOUND CALLS:**
   Keep outbound dialing in simulation testing mode. Never place automated calls to real patient phone numbers.
4. **DO NOT REMOVE THE SIMULATED MOCK HMS FLAGS UNTIL VPN IS ACTIVE:**
   Keep `isSimulated: true`, `dataSource: "SIMULATED_MOCK_HMS"`, and `mode: "SIMULATION_TESTING"` on availability and booking tool endpoints until Daya Hospital IT provides confirmed VPN access.
5. **NEVER COMMIT OR HARDCODE RAW API KEYS:**
   All credentials for Exotel, Sarvam, and Neon must remain strictly in environment variables or AES-256-GCM encrypted database columns.
