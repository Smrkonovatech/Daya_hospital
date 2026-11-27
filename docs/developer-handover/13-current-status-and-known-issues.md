# 13 — Technical Audit, Current Status & Known Issues

This document is the engineering audit of **Smrkomed / Daya Hospital**, detailing what is verified, partially implemented, blocked by external dependencies, or classified as technical debt.

---

## 1. Executive Status Matrix

| Subsystem / Feature | Implementation State | Verification Status | Operational Reality |
|---|---|---|---|
| **Exotel Dynamic Connect Endpoint** | Complete | **LIVE VERIFIED** | Deployed on Railway. Resolves dynamic receptionist number, 20s ring timeout, and E.164 compliance via `/exotel/connect-destination`. |
| **Emergency Escalation Safety Guard** | Complete | **LIVE VERIFIED** | Fails closed (`HTTP 403 EMERGENCY_PSTN_TRANSFER_DISABLED_FAIL_CLOSED`) when `emergencyPstnTransferEnabled=false`. Prevents dialing unverified test numbers. |
| **SMRKO VOICE Tool Actions** | Complete | **AUTOMATED TESTED** | 7 clinical tools parse parameters, book appointments, generate tokens, and triage emergencies with full audit logging. |
| **HMS Real Data Enforcement** | Complete | **AUTOMATED TESTED** | Silent mock fallback eliminated (Phase 2.1). Fails closed (HTTP 503 `HMS_UNAVAILABLE`) when live HMS is down. |
| **Grandis HMS Live Production Sync** | Implemented | **BLOCKED** | Blocked awaiting Daya Hospital IPSec VPN gateway provisioning. |
| **Call Recording Streaming Engine** | Complete | **AUTOMATED TESTED** | Supports HTTP 200 binary audio streaming, HTTP 206 byte-range seeking (`Range: bytes=start-end`), and HTTP 401/403 RBAC gates. |
| **Carrier Recording Upstream Fetch** | Partially Implemented | **BLOCKED / UNREACHABLE** | 5 legacy database recording entries point to non-routable domains (`audio.exotel.com`). Requires real Exotel carrier audio links. |
| **Multi-Tenant Routing Isolation** | Complete | **LIVE VERIFIED** | Unauthenticated tenant probing and cross-tenant ExoPhone spoofing fail closed with HTTP 403 `SECURITY_UNTRUSTED_TENANT`. |
| **Multi-Hospital Onboarding UI** | Not Implemented | **CODE ONLY** | Schema and isolation rules exist, but self-service hospital registration UI is not yet built. Tenants configured via code. |
| **Outbound Patient Reminder Calls** | Partially Implemented | **DISABLED** | API routes and Exotel REST client exist; live PSTN dialing is disabled in `DEVELOPMENT_TESTING` mode. |

---

## 2. Deep Dive: Known Issues & Technical Debt

### Issue 1: Five Existing Database Recording Entries Point to Unroutable Carrier URLs
- **Severity:** `HIGH`
- **Location:** [src/app/api/calls/[callId]/recording/route.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/app/api/calls/[callId]/recording/route.ts) & `RecordingMetadata` table.
- **Description:** Five initial seed/test records in the database (`call_910`, `call_911`, etc.) contain carrier URLs pointing to `audio.exotel.com/recordings/...`. This hostname does not resolve on public DNS (`ENOTFOUND`).
- **Current Behavior:** The recording endpoint explicitly intercepts `audio.exotel.com` URLs and returns HTTP 502 with code `PROVIDER_RECORDING_FETCH_FAILED`, refusing to claim successful carrier playback.
- **Action Required for Incoming Developer:** When real test calls are placed, Exotel will post genuine recording URLs in the status callback (format: `https://api.exotel.com/v1/Accounts/smrkonova1/Recordings/{RecordingSid}`). Update the media retrieval logic to fetch from Exotel's authenticated API using `EXOTEL_API_KEY` and `EXOTEL_API_TOKEN`.

---

### Issue 2: Grandis HMS Live VPN Pending Provisioning
- **Severity:** `CRITICAL` (for production go-live)
- **Location:** [src/lib/integrations/hms/grandis-adapter.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/lib/integrations/hms/grandis-adapter.ts) & [hms-client.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/lib/integrations/hms/hms-client.ts).
- **Description:** Daya Hospital's Grandis HMS is hosted on an internal private network in Thrissur. The required IPSec Site-to-Site VPN tunnel connecting Railway/AWS to Daya Hospital has not yet been established by hospital IT.
- **Current Behavior:** The system strictly fails closed with HTTP 503 `HMS_UNAVAILABLE` when live calls arrive. For local unit testing, developers can enable `HMS_ENVIRONMENT=simulation` to run tests against `MockDayaHmsAdapter`.
- **Action Required for Incoming Developer:** Coordinate with Daya Hospital network administrators to establish the IPSec VPN tunnel, verify private DNS routing, configure production credentials, and validate live synchronization.

---

### Issue 3: Temporary Receptionist & Emergency Test Receivers
- **Severity:** `MEDIUM`
- **Location:** [src/lib/config/hospital-config.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/lib/config/hospital-config.ts) & Neon DB published routing version.
- **Description:** The current published routing configuration points to temporary development test receivers:
  - Receptionist Destination: `+919606654032`
  - Emergency Destination: `+919740662046` (`emergencyPstnTransferEnabled: false`)
- **Safety Status:** These numbers are classified as `TEMPORARY_DEV_TEST_RECEIVER`. The emergency destination is safely locked down with `emergencyPstnTransferEnabled=false` (fails closed on PSTN queries).
- **Action Required for Incoming Developer:** Before hospital deployment, replace these with verified Daya Hospital landline PBX extensions authorized by hospital management.

---

### Issue 4: Next.js 16 Route Segment Compatibility Resolved in Commit `ec40a9e`
- **Severity:** `RESOLVED`
- **Location:** [src/app/api/calls/[callId]/recording/route.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/app/api/calls/[callId]/recording/route.ts).
- **Description:** During previous deployment, Next.js 16 with `cacheComponents: true` threw a build error because the recording route exported `runtime = "nodejs"` and `dynamic = "force-dynamic"`.
- **Resolution:** Both incompatible exports were removed in commit `ec40a9e`. Node.js APIs (`fs`, `path`, binary streams) continue to work seamlessly under the default runtime, and the production build passes with exit code 0.

---

### Issue 5: Self-Service Multi-Hospital Onboarding UI Not Built
- **Severity:** `LOW`
- **Location:** [src/lib/config/hospital-config.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/lib/config/hospital-config.ts).
- **Description:** While database models, tenant isolation gates, and routing adapters support multiple hospitals (`hosp_daya_thrissur`, `hosp_aster_medcity`, `hosp_kims_trivandrum`), new hospital onboarding currently requires adding an entry to `hospital-config.ts` or database seeds.
- **Action Required for Incoming Developer:** Build a Super-Admin onboarding wizard allowing new hospitals to configure their ExoPhones, departments, and HMS credentials through a web interface.
