# 16 — Developer Implementation & Handover Roadmap

This document provides a prioritized implementation roadmap for the incoming software engineering lead or development team taking over **Smrkomed / Daya Hospital**.

---

## 1. Immediate Phase: First 1–2 Days (Orientation & Verification)

### Task 1.1: Environment Setup & Local Build Verification
- **Priority:** `CRITICAL`
- **Description:** Clone repository, configure `.env.local`, install dependencies, run Prisma generation, and verify local build and test execution.
- **Relevant Files:** [package.json](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/package.json), [next.config.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/next.config.ts), `.env.example`.
- **Acceptance Criteria:**
  - `npm run build` exits with code `0`.
  - `npx vitest run` passes all 31 automated tests.
  - `npx tsc --noEmit` reports 0 TypeScript errors.
- **Testing Requirements:** Execute local test suites.
- **Risks:** Node.js version mismatch (ensure Node 22.x is used).

### Task 1.2: Synthetic Live Gateway Audit
- **Priority:** `HIGH`
- **Description:** Run synthetic probes against the live Railway gateway to verify that the deployed service matches the repository state.
- **Relevant Files:** [scripts/validation/verify_phase_10_12_contracts.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/scripts/validation/verify_phase_10_12_contracts.ts), [scripts/validation/verify_live_deployed_connect_destination.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/scripts/validation/verify_live_deployed_connect_destination.ts).
- **Acceptance Criteria:** 7/7 probes pass. Primary and backup connect URLs return HTTP 200 with dynamic receptionist numbers.
- **Testing Requirements:** `npx tsx scripts/validation/verify_phase_10_12_contracts.ts`.
- **Risks:** Zero telecom charges incurred.

---

## 2. Short-Term Phase: First Week (Core Fixes & Infrastructure Verification)

### Task 2.1: Implement Authenticated Exotel Recording Retrieval
- **Priority:** `HIGH`
- **Description:** Upgrade [src/app/api/calls/[callId]/recording/route.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/app/api/calls/[callId]/recording/route.ts) to retrieve genuine carrier audio from Exotel's authenticated API (`https://api.exotel.com/v1/Accounts/smrkonova1/Recordings/...`) using Basic Auth credentials.
- **Dependencies:** Exotel API credentials (`EXOTEL_API_KEY`, `EXOTEL_API_TOKEN`).
- **Relevant Files:** `src/app/api/calls/[callId]/recording/route.ts`, `src/lib/services/calls-service.ts`.
- **Acceptance Criteria:**
  - When an Exotel recording URL is stored, the endpoint proxies the audio stream with HTTP 200/206 byte-range seeking.
  - Legacy `audio.exotel.com` URLs gracefully fail with clear actionable 502 messages without crashing.
- **Testing Requirements:** Unit test in `recording-stream.test.ts`.
- **Risks:** Upstream Exotel audio retention expiration (carrier recordings expire after 30-90 days unless archived).

### Task 2.2: Grandis HMS VPN Connectivity Audit & Test Script
- **Priority:** `CRITICAL`
- **Description:** Build an automated diagnostic probe script (`scripts/validation/check_grandis_vpn.ts`) that verifies network ping, TCP port 443 handshake, and API authentication against Daya Hospital's Grandis HMS gateway.
- **Dependencies:** Coordination with Daya Hospital IT team.
- **Relevant Files:** [src/lib/integrations/hms/grandis-adapter.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/lib/integrations/hms/grandis-adapter.ts), [src/lib/integrations/hms/hms-client.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/lib/integrations/hms/hms-client.ts).
- **Acceptance Criteria:** Script outputs clear status: `VPN_CONNECTED`, `DNS_RESOLVED`, `HTTP_HEALTH_OK`, or specific failure diagnostics.
- **Testing Requirements:** Execute diagnostic script from Railway container and local machine.
- **Risks:** Hospital IT network delay.

---

## 3. Medium-Term Phase: Weeks 2–4 (Live Integration & Pilot Readiness)

### Task 3.1: Live Grandis HMS Integration & End-to-End Booking Validation
- **Priority:** `CRITICAL`
- **Description:** Connect Smrkomed to the live Daya Grandis HMS once VPN is established. Verify real doctor availability queries and execute test appointment bookings.
- **Dependencies:** Successful Task 2.2.
- **Relevant Files:** `src/lib/integrations/hms/grandis-adapter.ts`, `src/app/api/v1/voice-agent/book-appointment/route.ts`.
- **Acceptance Criteria:**
  - `getDoctors()` returns genuine Daya Hospital consultants.
  - `bookAppointment()` creates a real appointment in Grandis HMS with verified token number.
  - When VPN disconnects, system strictly fails closed with HTTP 503 `HMS_UNAVAILABLE`.
- **Testing Requirements:** Live test with hospital test patient record.
- **Risks:** Data discrepancy between hospital database and voice agent catalog.

### Task 3.2: Production Receptionist & Emergency Phone Verification
- **Priority:** `HIGH`
- **Description:** Replace development test numbers (`+919606654032`, `+919740662046`) with verified Daya Hospital landline PBX extensions authorized by hospital management.
- **Dependencies:** Hospital executive sign-off.
- **Relevant Files:** [src/lib/config/hospital-config.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/lib/config/hospital-config.ts), database routing versions.
- **Acceptance Criteria:**
  - Reception calls dial Daya Hospital OPD reception.
  - Emergency calls dial Daya Hospital Casualty Trauma room.
  - `emergencyPstnTransferEnabled` set to `true` only after hospital verification.
- **Testing Requirements:** Controlled live PSTN test with hospital reception desk.
- **Risks:** Hospital staff must be trained to receive warm AI transfers.

---

## 4. Later Phases: Production Hardening & Multi-Hospital Scaling

### Task 4.1: Multi-Hospital Self-Service Onboarding Wizard
- **Priority:** `MEDIUM`
- **Description:** Build a web-based onboarding wizard allowing new hospital clients (e.g., Aster Medcity, KIMS) to configure their profile, virtual numbers, and HMS credentials.
- **Relevant Files:** `src/app/settings/hospitals/new/page.tsx`, `src/lib/services/configuration-service.ts`.
- **Acceptance Criteria:** New hospital tenant can be provisioned through UI with isolated database tables and verified routing.

### Task 4.2: Automated Outbound Patient Reminder Campaigns
- **Priority:** `MEDIUM`
- **Description:** Implement cron/worker-driven automated reminder calls 24 hours prior to scheduled OPD appointments, allowing patients to confirm, cancel, or reschedule via voice.
- **Relevant Files:** [src/app/api/calls/outbound/route.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/app/api/calls/outbound/route.ts), [src/lib/integrations/telephony/exotel-adapter.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/lib/integrations/telephony/exotel-adapter.ts).
- **Acceptance Criteria:** Scheduled calls place successfully; patient responses update appointment status in HMS.
