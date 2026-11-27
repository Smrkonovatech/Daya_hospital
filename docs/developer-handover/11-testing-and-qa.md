# 11 — Testing & Quality Assurance Framework

This document outlines the testing architecture, test suites, commands, and verified results across **Smrkomed / Daya Hospital**.

---

## 1. Test Categorization & Terminology Discipline

To maintain clinical and telecom safety, tests are strictly categorized into five tiers:

| Tier | Category | Description | Network / Cost Impact |
|---|---|---|---|
| **Tier 1** | **Automated Unit Tests** | Pure algorithmic tests running against in-memory mocks, Zod schemas, and isolated functions. | 100% offline; zero cost. |
| **Tier 2** | **Synthetic Integration Tests** | Probes targeting local or remote HTTP/WS endpoints passing synthetic `CallSid` values (e.g. `syn_live_test_123`). | Zero PSTN or telecom charges. |
| **Tier 3** | **Mock Sandbox Tests** | Tests evaluating HMS and voice behavior when simulation flags (`HMS_ENVIRONMENT=simulation`) are enabled. | Safe for offline development. |
| **Tier 4** | **Live API Contract Probes** | Probes querying live carrier REST APIs (Exotel metadata, Sarvam model inference) without initiating phone calls. | Negligible cloud API token usage. |
| **Tier 5** | **PSTN Telephony Tests** | Placing an actual audio call from a real mobile/landline telephone to an ExoPhone over the public telecom network. | **STRICTLY CONTROLLED; incurs telecom billing.** |

> [!WARNING]
> **Strict Rule:** Never describe Tier 2 (Synthetic Integration Tests) as "Live Call Testing". Synthetic tests verify HTTP and JSON contracts; only Tier 5 represents real PSTN audio verification.

---

## 2. Test Execution Commands

### 2.1 Run All Automated Tests
Executes the complete Vitest test suite:
```bash
# On Linux / macOS:
npm test

# On Windows PowerShell:
npx.cmd vitest run
```

### 2.2 Run Specific Functional Test Suites

#### A. Call Recording Streaming & Byte-Range Contract (7 Tests)
Verifies binary `audio/wav` streaming, HTTP 206 partial content range seeking, 401 unauthenticated check, and 502 bad gateway on unreachable carrier URLs:
```bash
npx.cmd vitest run src/app/api/calls/[callId]/recording/recording-stream.test.ts --reporter=verbose
```

#### B. HMS Fail-Closed & Real Data Enforcement (5 Tests)
Verifies that `get-doctors`, `check-availability`, `book-appointment`, `reschedule`, and `cancel` fail closed with HTTP 503 `HMS_UNAVAILABLE` when live hospital HMS VPN is offline:
```bash
npx.cmd vitest run src/app/api/v1/voice-agent/hms-disconnected.test.ts --reporter=verbose
```

#### C. SMRKO VOICE Intelligence Action Tools (7 Tests)
Verifies tool parameter parsing, consultation fee retrieval, slot booking confirmation, token generation, and emergency escalation:
```bash
npx.cmd vitest run src/app/api/v1/voice-agent/voice-agent-actions.test.ts --reporter=verbose
```

#### D. Dynamic Telephony Routing & Exotel Connect Contract
Verifies receptionist dynamic routing, emergency safety fail-closed behavior, and multi-tenant isolation:
```bash
npx.cmd vitest run src/lib/services/dynamic-telephony-routing.test.ts
```

#### E. AI Overflow & Staff Presence Tests
Verifies receptionist shift management, heartbeat tracking, and automated rollover to AI:
```bash
npx.cmd vitest run src/lib/services/receptionist-presence.test.ts src/lib/services/ai-overflow.test.ts
```

---

## 3. Synthetic Live Deployment Probes

These scripts probe the live Railway container (`https://dayahospital-production-467a7d31.up.railway.app`) to verify production readiness without placing telephone calls:

### 3.1 Exotel Connect Dynamic Destination Probe
```bash
npx.cmd tsx scripts/validation/verify_phase_10_12_contracts.ts
```
**What It Verifies:**
- Primary URL: `/exotel/connect-destination` returns HTTP 200 JSON with exact Exotel schema.
- Backup URL: `/api/webhooks/exotel/connect-destination` mirrors identical behavior.
- Untrusted tenant query parameters (`hospitalId=hosp_aster_medcity`) fail closed with HTTP 403 `SECURITY_UNTRUSTED_TENANT`.
- Cross-tenant spoofing with mismatched `CallTo` fails closed with HTTP 403 `TENANT_MISMATCH_FORBIDDEN`.

### 3.2 Complete Synthetic Telephony Suite (7 Checks)
```bash
npx.cmd tsx scripts/validation/verify_live_deployed_connect_destination.ts
```
**What It Verifies:**
1. Valid Daya Receptionist Request -> HTTP 200 JSON.
2. Dynamic Ring Timeout -> Integer 20s.
3. E.164 Destination Validation -> `+919606654032`.
4. Missing CallSid -> HTTP 404 `UNKNOWN_CALL_SID`.
5. Unauthenticated Probing -> HTTP 403 `SECURITY_UNTRUSTED_TENANT`.
6. Cross-Tenant Spoofing -> HTTP 403 `TENANT_MISMATCH_FORBIDDEN`.
7. Plain Text Fallback -> HTTP 200 `text/plain`.

---

## 4. Latest Verified Test Results (Reproduced on Commit `ec40a9e`)

| Test Suite File | Tests Run | Result | Duration | Key Assertions Verified |
|---|:---:|:---:|:---:|---|
| `recording-stream.test.ts` | 7 | **PASS** | 792ms | Full binary audio streaming (HTTP 200), byte-range scrubbing (HTTP 206), auth gate (HTTP 401), missing call (HTTP 404), out-of-bounds (HTTP 416), download header, carrier failure (HTTP 502). |
| `hms-disconnected.test.ts` | 5 | **PASS** | 229ms | All booking, slot availability, and cancellation paths fail closed with HTTP 503 `HMS_UNAVAILABLE` when HMS VPN is offline. Zero fake bookings or slots generated. |
| `voice-agent-actions.test.ts` | 7 | **PASS** | 740ms | All SMRKO VOICE action tools parse parameters, book appointments, generate tokens, and escalate emergencies with full audit logging. |
| `verify_phase_10_12_contracts.ts` | 4 | **PASS** | 1200ms | Live Railway service returns exact Exotel Programmable Connect schema, rejects spoofing, and enforces tenant isolation. |

**Total Regression Suite: 31 of 31 Automated Tests Passed (100%). Zero Regressions.**
