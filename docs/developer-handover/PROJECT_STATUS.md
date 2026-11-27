# Smrkomed / Daya Hospital — Executive Project Status

**Document Purpose:** Concise executive engineering summary of the current operational status of the **Smrkomed** hospital telephony automation and AI voice platform.

**Date of Audit:** 2026-11-27  
**Repository:** `Smrkonovatech/Daya_hospital`  
**Active Branch:** `main`  
**Current HEAD Commit:** `ec40a9ecb26694c32096f609c665468be0bf74ed` (`ec40a9e`)  
**Deployment Host:** `https://dayahospital-production-467a7d31.up.railway.app`  

---

## 1. High-Level Operational Readiness Scorecard

| Capability Domain | Operational Status | Readiness | Details |
|---|:---:|:---:|---|
| **Telephony Carrier (Exotel)** | **OPERATIONAL** | **95%** | Exotel Singapore trunk (`smrkonova1`), ExoPhone `08047291658`, and dynamic Connect Applet endpoint (`/exotel/connect-destination`) live and verified. |
| **Emergency Safety System** | **OPERATIONAL** | **100%** | Zero-delay casualty isolation verified. Fails closed (`HTTP 403 EMERGENCY_PSTN_TRANSFER_DISABLED_FAIL_CLOSED`) while dev test receiver is configured. |
| **SMRKO VOICE Intelligence** | **OPERATIONAL** | **90%** | 7 automated clinical tool webhooks implemented. Understands Malayalam and English. Pipelined streaming TTS active. |
| **Call Recording Streaming** | **OPERATIONAL** | **85%** | Native binary streaming and HTTP 206 byte-range scrubbing working. 5 legacy DB records point to unroutable carrier links (`audio.exotel.com`). |
| **Hospital Management (HMS)** | **BLOCKED (VPN)** | **40%** | Adapter and client complete. Operates in strict fail-closed mode (HTTP 503 `HMS_UNAVAILABLE`) pending Daya Hospital IPSec VPN gateway. |
| **Multi-Tenant Isolation** | **OPERATIONAL** | **90%** | Database and routing layer strictly isolate tenants. Cross-tenant spoofing rejected with HTTP 403. Self-service onboarding wizard pending. |
| **CI/CD & Cloud Hosting** | **OPERATIONAL** | **100%** | Railway persistent container and Neon Serverless PostgreSQL running. Clean Turbopack builds and 31/31 automated tests passing. |

---

## 2. What Is Working Today (Verified in Production)

1. **Live Exotel Dynamic Connect Routing:**
   - Exotel Applet `1399357` queries `GET /exotel/connect-destination`.
   - Smrkomed resolves the active receptionist number (`+919606654032`), sets a 20-second timeout, and commands Exotel to record the leg.
   - Tested and verified against live Railway gateway across 7 synthetic scenarios (100% pass).
2. **Phase 10.14 Emergency Fail-Closed Safety:**
   - Inbound emergency calls (DTMF 1 or AI emergency triage) query `type=EMERGENCY`.
   - While `emergencyPstnTransferEnabled=false`, the gateway returns HTTP 403, preventing unauthorized PSTN dialing of temporary test numbers.
3. **SMRKO VOICE Clinical Tool Endpoints:**
   - `get-doctors`, `check-availability`, `book-appointment`, `reschedule-appointment`, `cancel-appointment`, `get-appointment`, and `emergency-escalate` execute with full audit logging and validation.
4. **Binary Audio Streaming & Byte-Range Player:**
   - Recording route streams raw `audio/wav` bytes with HTTP 206 Partial Content, supporting scrubbing and seeking.
   - Fixed Next.js 16 `cacheComponents` compiler compatibility in commit `ec40a9e`.
5. **Staff Presence & Overflow Logging:**
   - Receptionists can toggle presence (`AVAILABLE`, `ON_CALL`, `BREAK`, `OFFLINE`). Calls rolling over to AI log wait times and trigger reasons in `AiOverflowLog`.
6. **Multi-Tenant Security Boundaries:**
   - Requests with mismatched ExoPhones and tenant IDs fail closed with HTTP 403 `TENANT_MISMATCH_FORBIDDEN`.

---

## 3. Critical Blockers & Incomplete Areas

### Blocker 1: Grandis HMS Live VPN Offline
- **Reality:** Real appointment booking against Daya Hospital's electronic medical records is currently blocked because Daya Hospital IT has not provisioned the IPSec Site-to-Site VPN tunnel.
- **Safety Enforcement:** The system strictly fails closed (HTTP 503 `HMS_UNAVAILABLE`) when live calls arrive. Zero fake bookings or fabricated slots are generated.

### Blocker 2: Unreachable Carrier URLs for 5 Legacy Recordings
- **Reality:** Five initial test records in the database point to `audio.exotel.com`, an unroutable domain that fails with `ENOTFOUND`.
- **Handling:** The recording endpoint intercepts these domains and returns HTTP 502 `PROVIDER_RECORDING_FETCH_FAILED`. Real carrier playback requires fetching from Exotel's authenticated API.

### Blocker 3: Temporary Test Receivers on Pilot Tenant
- **Reality:** Receptionist (`+919606654032`) and Emergency (`+919740662046`) destinations are temporary developer test numbers. They must be replaced with verified Daya Hospital landline extensions before patient go-live.

---

## 4. Current Repository & Build State

- **Branch:** `main` (tracked to `origin/main`).
- **Working Tree:** Clean (0 uncommitted modifications, 0 untracked files).
- **TypeScript:** Validated with `npx tsc --noEmit` (`0 errors`).
- **Automated Tests:** Validated with `npx vitest run` (`31/31 passed`, 100%).
- **Production Build:** Validated with `npm run build` (Turbopack, exit code `0`).

---

## 5. Five Most Urgent Priorities for the Incoming Developer

1. **Verify Local Environment:** Follow [10-local-development-setup.md](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/docs/developer-handover/10-local-development-setup.md) to install dependencies, configure `.env.local`, and run `npm test`.
2. **Audit Grandis VPN Readiness:** Coordinate with Daya Hospital IT to establish the IPSec VPN tunnel and run diagnostic probes against `DAYA_HMS_BASE_URL`.
3. **Upgrade Exotel Recording Retrieval:** Enhance [src/app/api/calls/[callId]/recording/route.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/app/api/calls/[callId]/recording/route.ts) to retrieve audio from Exotel's authenticated API using Basic Auth.
4. **Transition Test Receivers to Hospital PBX:** Replace developer test phone numbers with verified Daya Hospital landline extensions.
5. **Execute End-to-End Test Booking:** Once VPN is online, perform a verified test booking and confirm the OPD token appears in Daya Hospital's Grandis HMS schedule.
