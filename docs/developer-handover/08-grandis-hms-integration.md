# 08 — Hospital Information System Integration (Grandis HMS)

This document details the architecture, client contracts, network prerequisites, and fail-closed safety behaviors of the **Grandis HMS** (Hospital Management System) integration for **Daya Hospital**.

---

## 1. Grandis HMS Adapter Architecture

Smrkomed connects to Daya Hospital's electronic medical records and OPD scheduling software through a standardized adapter architecture:

```
[SMRKO VOICE Tool / Webhook API]
              │
              ▼
    [ActionsService]
(src/lib/services/actions-service.ts)
              │
              ▼
     [DayaHmsClient]
(src/lib/integrations/hms/hms-client.ts)
              │
              ▼
   [GrandisHmsAdapter]
(src/lib/integrations/hms/grandis-adapter.ts)
              │
    ┌─────────┴─────────┐
    │                   │
    ▼ (Production)      ▼ (Unit Testing Only)
[Real Grandis HMS]   [MockDayaHmsAdapter]
(via Hospital VPN)   (In-Memory Fixture)
```

### 1.1 Interface Contracts
- **`IHmsConnector` ([src/lib/integrations/hms/standard-hms-types.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/lib/integrations/hms/standard-hms-types.ts)):** Standard interface implemented by hospital adapters, defining `getDoctors()`, `getDoctorSlots()`, `bookAppointment()`, `rescheduleAppointment()`, `cancelAppointment()`, and `healthCheck()`.
- **`GrandisHmsAdapter` ([src/lib/integrations/hms/grandis-adapter.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/lib/integrations/hms/grandis-adapter.ts)):** Production adapter implementing `IHmsConnector` for Daya Hospital's Grandis HMS platform.
- **`DayaHmsClient` ([src/lib/integrations/hms/hms-client.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/lib/integrations/hms/hms-client.ts)):** Resilient HTTP client enforcing timeouts, audit logging, and fail-closed exceptions.

---

## 2. Network Prerequisites & The Hospital VPN Dependency

> [!CRITICAL]
> **Production Block Status:** Real-time synchronization with Daya Hospital's live OPD schedules requires an active **Site-to-Site IPSec VPN** connecting Smrkomed's cloud infrastructure (Railway / AWS) to Daya Hospital's on-premise datacenter in Thrissur.
>
> In the current `DEVELOPMENT_TESTING` environment, **the hospital VPN gateway has not yet been provisioned**.

### 2.1 Network Specifications
- **HMS Gateway Host:** Internal hospital FQDN / IP (e.g., `https://hms-api.dayahospital.internal` or dedicated private IP).
- **Authentication Header:** `X-Grandis-Key` (configured via `DAYA_HMS_API_KEY`).
- **Tenant Scope Header:** `X-Hospital-Id: hosp_daya_thrissur`.
- **Request Timeout:** 3000ms (`DAYA_HMS_TIMEOUT_MS=3000`).
- **Required Ports:** TCP 443 / 8443 through the IPSec VPN tunnel.

---

## 3. Real Data Enforcement & Removal of Silent Mock Fallback (Phase 2.1)

Prior to Phase 2.1, the application silently fell back to simulated mock data whenever the HMS network connection failed. **This dangerous behavior has been completely eliminated.**

### 3.1 Strict Fail-Closed Rule
When the real HMS is unreachable or VPN is disconnected:
1. **Zero Fake Appointments:** The system strictly refuses to generate synthetic booking references (e.g., `MOCK-BOOK-1234`).
2. **Zero Fabricated Availability:** The system does not return simulated doctor slots.
3. **HTTP 503 Response:** The tool endpoint immediately returns:
   ```json
   {
     "success": false,
     "error": "HMS_UNAVAILABLE",
     "message": "Daya Hospital Information System is currently unreachable. Real appointment booking is unavailable. Caller must be transferred to receptionist.",
     "isSimulated": false
   }
   ```
4. **Voice Agent Behavior:** The voice assistant explicitly informs the caller that the hospital scheduling system is temporarily unreachable and offers to connect them to a human receptionist.

### 3.2 Automated Regression Proof
This fail-closed behavior is verified by automated test suite [src/app/api/v1/voice-agent/hms-disconnected.test.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/app/api/v1/voice-agent/hms-disconnected.test.ts) (5/5 passed):
- `get-doctors` fails closed with 503 `HMS_UNAVAILABLE`.
- `check-availability` fails closed with 503 `HMS_UNAVAILABLE` and zero fabricated slots.
- `book-appointment` fails closed with 503 and strictly generates zero fake bookings.
- `reschedule-appointment` fails closed with 503 `HMS_UNAVAILABLE`.
- `cancel-appointment` fails closed with 503 `HMS_UNAVAILABLE`.

---

## 4. Controlled Simulation Sandbox (For Local Testing Only)

For offline development and unit tests where live hospital systems cannot be reached, a controlled simulation mode is supported:
- **How to Activate:** Set `HMS_ENVIRONMENT=simulation` or `DAYA_HMS_SIMULATION=true` in `.env.local`.
- **Auditing Requirement:** Every action executed in simulation mode sets `isSimulated: true` in the database record and outputs `[VoiceAgentAudit:...] isSimulated: true` in console logs.
- **Safety Guard:** Simulation mode is **STRICTLY BLOCKED** in production (`NODE_ENV === "production"`).

---

## 5. Doctor & Department Catalog (Daya Hospital Pilot)

The Grandis adapter and baseline fixtures model the following clinical departments for Daya Hospital:
- **Cardiology:** Interventional cardiology, ECG, Echo, TMT.
- **Orthopaedics:** Joint replacement, trauma surgery, arthroscopy.
- **Neurology:** Stroke care, EEG, neurology OPD.
- **General Medicine:** Routine adult illness, diabetes, hypertension.
- **Paediatrics:** Child health, immunizations.
- **ENT & Ophthalmology:** Routine and surgical OPD.

---

## 6. Actions Required to Achieve Live HMS Production Sign-Off

The incoming developer must complete the following steps to take HMS integration live:
1. Coordinate with Daya Hospital IT to configure the IPSec VPN tunnel to Railway / AWS.
2. Verify bidirectional DNS and TCP handshake against `DAYA_HMS_BASE_URL`.
3. Obtain production API keys and configure them securely in Railway environment variables.
4. Execute `scripts/validation/inspect_live_hms.ts` to verify real doctor and slot synchronization.
5. Perform an end-to-end test booking with a test patient ID and confirm the token appears in Daya Hospital's Grandis OPD queue.
