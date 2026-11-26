# SMRKOMED — NEXT DEVELOPMENT ROADMAP & ENGINEERING PHASES

This document outlines the prioritized implementation roadmap for the incoming development team. Phases are sequenced to eliminate technical debt first, connect live frontend interfaces, expand clinical data models, and ultimately establish the hospital HMS network integration.

---

## Roadmap Overview

```
Phase 11 (Immediate: Deploy & Verify Working Tree)
       │
       ▼
Phase 12 (Frontend Live API Refactoring: Calls & Overview)
       │
       ▼
Phase 13 (Clinical Data Modeling: Doctor, Dept & Appointment Tables)
       │
       ▼
Phase 14 (Hospital Network Infrastructure & Grandis HMS Integration)
       │
       ▼
Phase 15 (Security & Tenancy Hardening: Persistent Revocation & PostgreSQL RLS)
       │
       ▼
Phase 16 (Reliability & Lifecycle: Webhook DLQ & Long-Term Audio Archiving)
```

---

## Phase 11: Production Git Commit, Railway Deployment & Live Verification
- **Priority:** `P0 (Immediate)`
- **Objective:** Commit the verified uncommitted changes from Phases 9.6 through 10.2, push to `origin/main`, deploy to Railway, and verify that the deployed endpoints match the local baseline.
- **Features Involved:** Exotel Programmable Connect dynamic routing, Sarvam Voice Agents tool webhooks, settings UI.
- **Dependencies:** User authorization to commit and trigger Railway deployment.
- **Expected Files Affected:**
  - 7 modified files (`.env.example`, `src/app/settings/page.tsx`, `src/lib/config/hospital-config.ts`, `src/lib/integrations/types.ts`, `src/media-gateway/passthru-routing.test.ts`, `src/media-gateway/server.ts`, `src/media-gateway/session-manager.ts`).
  - 14 untracked files (`src/app/api/v1/config/routing/*`, `src/app/api/v1/voice-agent/*`, `src/lib/services/hospital-routing-service.ts`, `src/lib/integrations/sarvam/voice-agent-*`).
- **Acceptance Criteria:**
  1. Clean `git status` on `main`.
  2. Railway deployment succeeds with 0 build errors.
  3. Railway `GET /health` returns HTTP 200.
  4. Railway `GET /exotel/connect-destination` and `GET /api/v1/voice-agent/context` return HTTP 200 with valid JSON.
- **Risks:** Railway environment variable drift; mitigated by verifying all variables beforehand.
- **Estimated Complexity:** `Small`

---

## Phase 12: Frontend Calls & Overview Page Live API Refactoring
- **Priority:** `P1 (High)`
- **Objective:** Eliminate the technical debt where `/calls` and `/overview` import `callsService` directly into client bundles, forcing in-browser fallback to mock data. Wire both pages to execute real HTTP `fetch` requests against backend REST APIs.
- **Features Involved:** Dashboard and Analytics, Call History and Analytics.
- **Dependencies:** Phase 11.
- **Expected Files Affected:**
  - `src/app/calls/page.tsx`: Replace `callsService.getCalls(...)` with `fetch('/api/calls?' + queryParams)`.
  - `src/app/overview/page.tsx`: Replace client `overviewService` with `fetch('/api/overview')`.
  - `src/app/api/overview/route.ts`: Create new server-side route handler to compute metrics directly from Neon DB.
- **Acceptance Criteria:**
  1. Hospital administrators viewing `/calls` see actual live calls recorded in Neon PostgreSQL.
  2. Client bundle size decreases (Prisma client code removed from browser bundle).
  3. Pagination, filtering, and searching on `/calls` reflect database state.
- **Risks:** Minimal; straightforward React refactoring.
- **Estimated Complexity:** `Small`

---

## Phase 13: Clinical Data Modeling (Doctor, Department & Appointment Models)
- **Priority:** `P2 (High)`
- **Objective:** Promote doctors, specialty departments, and appointments from in-memory mock objects into authoritative PostgreSQL database models with admin management screens.
- **Features Involved:** Doctor and Department Information, Appointment Booking, AI Agent Context.
- **Dependencies:** Phase 12.
- **Expected Files Affected:**
  - `prisma/schema.prisma`: Add `Department`, `Doctor`, and `Appointment` models.
  - `prisma/migrations/`: Generate migration `20261126_clinical_entities`.
  - `src/app/api/v1/doctors/*`: CRUD endpoints for hospital doctors and consulting hours.
  - `src/app/api/v1/departments/*`: CRUD endpoints for hospital departments and extensions.
  - `src/app/api/v1/voice-agent/context/route.ts`: Update to query Neon DB instead of static objects.
- **Acceptance Criteria:**
  1. Hospital administrators can add, update, and deactivate doctors in the UI.
  2. Appointments created via the voice agent insert structured records into the `Appointment` table with foreign keys.
  3. Migration applies cleanly to Neon DB without breaking existing tables.
- **Risks:** Schema migration rollback risk; mitigated by testing on a Neon database branch first.
- **Estimated Complexity:** `Medium`

---

## Phase 14: Hospital Network Infrastructure & Grandis HMS Integration
- **Priority:** `P3 (High - Blocked on Hospital IT)`
- **Objective:** Establish an encrypted site-to-site IPsec VPN tunnel between Railway and Daya General Hospital's on-premise server, connecting `GrandisHmsAdapter` to the live hospital HMS.
- **Features Involved:** HMS Integration, Appointment Availability, Appointment Booking.
- **Dependencies:** Daya General Hospital IT department configuring VPN endpoint and sharing Grandis API contracts.
- **Expected Files Affected:**
  - `src/lib/integrations/hms/grandis-adapter.ts`: Implement live HTTP/SOAP API calls to Grandis server.
  - `src/app/api/v1/voice-agent/check-availability/route.ts`: Remove simulated mock flag; route live queries to Grandis.
  - `src/app/api/v1/voice-agent/book-appointment/route.ts`: Remove simulated testing flag; execute live booking in Grandis.
- **Acceptance Criteria:**
  1. VPN tunnel maintains sub-100ms roundtrip latency between Railway and Daya Hospital.
  2. Doctor slot availability queries return live, real-time booking slots from Grandis.
  3. Voice agent appointment bookings generate verified, real appointment tokens visible to hospital receptionists in Grandis HMS.
- **Risks:** Unstable hospital internet connection; mitigated by keeping the automatic fallback to `MockDayaHmsAdapter` when Grandis times out.
- **Estimated Complexity:** `Large`

---

## Phase 15: Security & Tenancy Hardening (Persistent Revocation & PostgreSQL RLS)
- **Priority:** `P4 (Medium)`
- **Objective:** Eliminate in-memory token revocation vulnerability and enforce native PostgreSQL Row-Level Security (RLS) policies across all multi-tenant tables.
- **Features Involved:** Authentication and User Management, Multi-Tenant Data Isolation, Security and Audit Logging.
- **Dependencies:** Phase 13.
- **Expected Files Affected:**
  - `src/lib/auth/session.ts`: Persist logged-out token signatures in Neon DB `DurableIdempotencyRecord` with TTL.
  - `prisma/migrations/`: Add PostgreSQL RLS policies (`CREATE POLICY tenant_isolation_policy ON ... USING (hospital_id = current_setting('app.current_hospital_id'))`).
  - `src/lib/db/prisma.ts`: Wrap Prisma queries with tenant context setting.
- **Acceptance Criteria:**
  1. Logged-out session tokens remain invalid even after server restarts and container rebuilds.
  2. Accidental omission of `where: { hospitalId }` in application code cannot leak cross-tenant records.
- **Risks:** Database permission configuration errors; mitigated by thorough integration test validation.
- **Estimated Complexity:** `Medium`

---

## Phase 16: Reliability & Lifecycle (Webhook DLQ & S3 Audio Archival)
- **Priority:** `P5 (Medium)`
- **Objective:** Ensure zero data loss for carrier webhooks and establish long-term call recording archival outside ephemeral carrier storage.
- **Features Involved:** Webhook Handling, Call Recordings and Transcripts, Monitoring and Error Handling.
- **Dependencies:** Phase 14.
- **Expected Files Affected:**
  - `src/app/api/webhooks/*`: Add fallback disk buffer / database dead-letter-queue for unprocessable webhooks.
  - `src/lib/services/audio-archival-service.ts`: Scheduled background worker that downloads audio from Exotel/Sarvam URLs and uploads to AWS S3 / Cloudflare R2 bucket.
- **Acceptance Criteria:**
  1. Failed webhooks are retried automatically from the DLQ upon database reconnection.
  2. Audio recordings remain permanently playable even after Exotel/Sarvam 30-day retention policies expire.
- **Risks:** S3 bandwidth and storage costs; mitigated by configuring lifecycle transition rules (e.g. S3 Glacier after 90 days).
- **Estimated Complexity:** `Medium`
