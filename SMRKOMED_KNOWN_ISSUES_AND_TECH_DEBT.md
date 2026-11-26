# SMRKOMED — KNOWN ISSUES, SECURITY AUDIT & TECHNICAL DEBT

This document catalogs all identified security vulnerabilities, architectural technical debt, in-memory state dependencies, and code anomalies across the Smrkomed codebase, classified by severity level.

---

## Severity Classification Overview

| Severity | Count | Summary of Key Findings |
|---|:---:|---|
| **CRITICAL** | **2** | Hospital HMS blocked on on-premise VPN infrastructure; Frontend client-side service import forces mock data fallback |
| **HIGH** | **3** | Uncommitted & undeployed Phase 9.6–10.2 changes; In-memory session token revocation list; Sarvam Voice Agents Exotel BYOT missing |
| **MEDIUM** | **4** | Missing database models for clinical entities (`Doctor`, `Department`, `Appointment`); Application-layer only multi-tenancy (no PostgreSQL RLS); Lack of automated database retention for transcripts; Webhook retry DLQ absence |
| **LOW** | **3** | Password reset email simulated in console; Visual-only UI sliders; Redundant legacy outbound call route |

---

## 1. Critical Findings

### ISSUE-CRIT-01: Hospital HMS Integration Blocked on On-Premise Network Access
- **Category:** Infrastructure / External Dependency
- **Affected Files:** `src/lib/integrations/hms/grandis-adapter.ts`, `src/lib/integrations/hms/hms-client.ts`, `src/app/api/v1/voice-agent/check-availability/route.ts`, `src/app/api/v1/voice-agent/book-appointment/route.ts`
- **Description:** Daya General Hospital operates an on-premise Grandis Hospital Management System server located within their physical hospital local area network. There is currently no active site-to-site IPsec VPN tunnel connecting Railway cloud infrastructure to Daya Hospital's internal network.
- **Impact:** All doctor availability lookups and appointment bookings must remain in **SIMULATED MOCK MODE**. The system cannot read live doctor schedules or record confirmed patient appointments into the hospital's primary clinical database.
- **Remediation:** Coordinate with Daya Hospital IT department to provision an IPsec VPN tunnel or secure reverse-proxy gateway with mutual TLS (mTLS) to allow cloud access to the Grandis HMS REST/SOAP APIs.

### ISSUE-CRIT-02: Frontend Client-Side Service Import Forces In-Browser Mock Data
- **Category:** Architecture / Frontend Defect
- **Affected Files:** `src/app/calls/page.tsx`, `src/app/overview/page.tsx`
- **Description:** `src/app/calls/page.tsx` and `src/app/overview/page.tsx` are marked `"use client"` but import server-side service classes (`callsService` and `overviewService`) directly into the React component bundle instead of invoking `fetch('/api/calls')`.
- **Root Cause:** When `callsService` runs inside the browser, `process.env.DATABASE_URL` is undefined. Consequently, `checkDatabaseConnection()` reports that the database is disconnected, causing the repository to silently fall back to `getCallsFromMemory()`.
- **Impact:** Hospital administrators viewing the `/calls` page in a web browser will always see static, in-memory mock call records, even when real calls and transcripts have been successfully recorded in the Neon PostgreSQL database! The actual `/api/calls` REST API exists and connects to Neon DB, but the UI never calls it.
- **Remediation:** Refactor `src/app/calls/page.tsx` and `src/app/overview/page.tsx` to execute standard `fetch('/api/calls?' + params)` requests against the Next.js API route.

---

## 2. High Severity Findings

### ISSUE-HIGH-01: Working Tree Contains Uncommitted & Undeployed Telephony Changes
- **Category:** Deployment / Configuration Divergence
- **Affected Files:** 21 modified/untracked files across Phases 9.6, 9.6.1, 10, 10.1, and 10.2
- **Description:** The production Railway deployment (`dayahospital-production-467a7d31.up.railway.app`) is running commit `44b1be6` (Phase 9.5.3). The Programmable Connect dynamic routing contract (Phase 9.6.1) and Sarvam Voice Agents tool-calling webhooks (Phase 10.2) exist only in the local working tree.
- **Impact:** Public calls to `/api/v1/voice-agent/*` on Railway return HTTP 404 Not Found. If Exotel triggers `/exotel/connect-destination`, Railway falls back to Phase 9.5.3 logic.
- **Remediation:** Review, commit, push to `origin/main`, and deploy the working tree to Railway after audit sign-off.

### ISSUE-HIGH-02: In-Memory Session Token Revocation List
- **Category:** Security / Session Invalidation
- **Affected Files:** `src/lib/auth/session.ts` (`const revokedTokens = new Set<string>();`)
- **Description:** When a user logs out (`POST /api/auth/logout`), their session token signature is added to an in-memory JavaScript `Set`.
- **Impact:** If the Railway container restarts, or if multiple instances/replicas are deployed, the in-memory set is cleared or not shared. A revoked session cookie could remain valid until its 8-hour expiration period elapses.
- **Remediation:** Store revoked session token signatures in the Neon database (`DurableIdempotencyRecord` or a dedicated `RevokedToken` table) or an external Redis store.

### ISSUE-HIGH-03: Sarvam Voice Agents Exotel BYOT Telephony Gap
- **Category:** Telephony / Provider Configuration
- **Affected Files:** `src/lib/integrations/sarvam/voice-agent-config.ts`
- **Description:** Sarvam Voice Agents deployment `Inbound-3b5df8df-f098` is connected to a Vobiz carrier virtual number (`+918064265889`). Exotel Bring-Your-Own-Telephony (BYOT) is NOT connected to this Sarvam deployment. Furthermore, Sarvam Voice Agents does not currently support in-flight call transfers (`exotelByotTransferSupport: "REQUIRES_SARVAM_SUPPORT_ENABLEMENT"`).
- **Impact:** Live patient calls arriving on Daya's Exotel number `08047291658` cannot currently be handed over to Sarvam Voice Agents without custom SIP trunking or Sarvam enterprise support. Mode A (`SARVAM_CORE_CUSTOM`) must remain the active telephony engine.
- **Remediation:** Maintain `CONVERSATION_ENGINE_MODE=SARVAM_CORE_CUSTOM` for Exotel calls until Sarvam enables SIP trunking with transfer capabilities.

---

## 3. Medium Severity Findings

### ISSUE-MED-01: Missing Database Models for Clinical Entities
- **Category:** Data Model / Schema Incompleteness
- **Affected Files:** `prisma/schema.prisma`
- **Description:** The database schema has 29 models, but lacks dedicated tables for `Doctor`, `Department`, and `Appointment`.
- **Impact:** Doctor rosters cannot be edited dynamically via database admin; appointment bookings are saved as generic `AiAction` audit logs rather than relational appointment records with doctor/patient foreign keys.
- **Remediation:** Add `Doctor`, `Department`, and `Appointment` models to `prisma/schema.prisma` and create a migration.

### ISSUE-MED-02: Multi-Tenancy Enforced in Application Layer Only
- **Category:** Security / Multi-Tenant Isolation
- **Affected Files:** `prisma/schema.prisma`, all repository files
- **Description:** Tenant data isolation is enforced exclusively through Prisma `where: { hospitalId }` clauses. PostgreSQL Row-Level Security (RLS) is not configured at the database engine level.
- **Impact:** Any developer oversight omitting `hospitalId` in a query could result in accidental cross-tenant data leakage.
- **Remediation:** Enable PostgreSQL Row-Level Security on all tenant tables and set tenant session context in database transactions.

### ISSUE-MED-03: Lack of Automated Data Retention & Archival
- **Category:** Database Maintenance / Storage Growth
- **Affected Files:** `prisma/schema.prisma` (`CallRecord`, `TranscriptEntry`)
- **Description:** Transcripts, call recordings metadata, and webhook audit records are retained indefinitely without an automated TTL or partition cleanup job.
- **Impact:** High call volume will lead to database storage bloat and slower indexed queries over time.
- **Remediation:** Implement a scheduled cron job or Neon database partition table strategy to archive records older than 1 year.

### ISSUE-MED-04: Webhook Processing Lacks Dead-Letter-Queue (DLQ)
- **Category:** Reliability / Resilience
- **Affected Files:** `src/app/api/webhooks/exotel/route.ts`, `src/app/api/v1/voice-agent/call-ended/route.ts`
- **Description:** If the Neon database encounters a temporary network timeout during webhook ingestion, the route returns HTTP 500 without writing the payload to local disk or a dead-letter queue.
- **Impact:** Relies entirely on the external carrier (Exotel/Sarvam) retrying the webhook. If the carrier exceeds maximum retries, the call transcript may be lost.
- **Remediation:** Write unprocessable webhook payloads to an asynchronous retry table or durable disk queue.

---

## 4. Low Severity Findings

### ISSUE-LOW-01: Password Reset Email Simulated in Console
- **Category:** User Management
- **Affected Files:** `src/app/api/auth/reset-password/route.ts`
- **Description:** The reset password endpoint generates a secure token and logs it to `console.log()` rather than sending an email.
- **Remediation:** Integrate a transactional email service (e.g. Resend, AWS SES) when public self-serve reset is required.

### ISSUE-LOW-02: Visual-Only Telephony Sliders in Settings UI
- **Category:** UI / Polish
- **Affected Files:** `src/app/settings/page.tsx`
- **Description:** Advanced SIP trunk concurrency sliders in the Settings UI update local state but have no backend impact because carrier concurrency is enforced at the Exotel account level.
- **Remediation:** Add helper tooltips explaining that carrier concurrency is managed via Exotel account settings.

### ISSUE-LOW-03: Redundant Outbound Call Routes
- **Category:** Code Maintainability
- **Affected Files:** `src/app/api/calls/outbound/route.ts` vs `src/app/api/v1/calls/outbound/route.ts`
- **Description:** Two duplicate route handlers exist for initiating outbound calls.
- **Remediation:** Deprecate `/api/calls/outbound` and redirect all clients to `/api/v1/calls/outbound`.
