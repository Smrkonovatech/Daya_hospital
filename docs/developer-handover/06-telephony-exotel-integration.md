# 06 — Telephony Carrier Integration (Exotel Cloud)

This document provides complete technical specifications for the cloud telephony integration between **Smrkomed** and **Exotel Cloud Telephony (Singapore Region)**.

---

## 1. Exotel Account & Infrastructure Configuration

| Configuration Parameter | Value in Development / Staging | Location / Notes |
|---|---|---|
| **Account SID** | `smrkonova1` | Exotel Singapore trunk account. Configured via `EXOTEL_ACCOUNT_SID`. |
| **API Domain** | `api.exotel.com` | Singapore API gateway (`EXOTEL_BASE_URL=https://api.exotel.com`). |
| **Virtual Number (ExoPhone)** | `08047291658` | Virtual number assigned to Daya Hospital (`hosp_daya_thrissur`). |
| **Inbound IVR Applet** | Applet ID: `1399357` (Name: *Sarvam*) | Canonical DTMF IVR applet routing Press 1/2/3. |
| **Staging Voicebot Applet** | Applet ID: `1393240` | AI voicebot overflow target for testing and busy receptionist rollover. |
| **Production Voicebot Applet** | Applet ID: `1393239` | Live production applet — **STRICTLY UNTOUCHED during testing**. |

---

## 2. Inbound Routing Architecture & Applet Design

Inbound calls to `08047291658` execute the canonical IVR flow configured in Exotel Applet `1399357`:

```
                       Inbound Call to 08047291658
                                    │
                                    ▼
                         [Exotel Greeting Menu]
              "Press 1 for Emergency, 2 for Appointments, 3 for Other"
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         │                          │                          │
         ▼                          ▼                          ▼
   [DTMF 1: Emergency]     [DTMF 2: Appointments]    [DTMF 3: General Enquiries]
         │                          │                          │
   [Connect Applet]           [Connect Applet]                 ▼
         │                          │                   [Voicebot Applet]
  Query Smrkomed:            Query Smrkomed:               (Applet 1393240)
  type=EMERGENCY             type=HUMAN_TRANSFER               │
         │                          │                    SMRKO VOICE
         ▼                          ▼                 Direct Conversation
  Dial Casualty              Dial Reception
  (+919740662046)            (+919606654032)
  (Fail-closed if disabled)  Timeout: 20s
                                    │
                             [On Busy/No-Answer]
                                    │
                                    ▼
                            [Voicebot Applet]
                             (Applet 1393240)
```

---

## 3. Programmable Connect Applet Contract

Exotel's **Connect Applet** invokes Smrkomed's dynamic destination endpoint to determine who to dial:

### 3.1 Primary Application URL
```http
GET https://dayahospital-production-467a7d31.up.railway.app/exotel/connect-destination
```

### 3.2 Carrier Query Parameters Appended by Exotel
Exotel automatically appends the following parameters when invoking the URL:
- `CallSid`: Unique alphanumeric call session identifier (e.g., `c1a2b3...`).
- `CallFrom`: Caller's E.164 phone number (e.g., `+919846001122`).
- `CallTo`: Dialed ExoPhone (e.g., `08047291658`).
- `Direction`: `inbound` or `outbound`.
- `hospitalId`: Tenant identifier passed in applet query string (`hosp_daya_thrissur`).
- `type`: Escalation type (`HUMAN_TRANSFER`, `EMERGENCY`, `AFTER_HOURS`).

### 3.3 Authoritative JSON Response Contract
The endpoint returns `HTTP 200 OK` with `Content-Type: application/json; charset=utf-8`:
```json
{
  "fetch_after_attempt": false,
  "destination": {
    "numbers": [
      "+919606654032"
    ]
  },
  "record": true,
  "outgoing_phone_number": "08047291658",
  "max_ringing_duration": 20
}
```

### 3.4 Key Contract Fields Explained
- `destination.numbers`: Array of E.164 phone numbers to dial. The receptionist number is dynamically fetched from Neon DB.
- `max_ringing_duration`: Timeout in seconds before Exotel triggers the "No Answer" branch (configured as 20s for Daya Hospital).
- `record`: Boolean instruction telling Exotel to record the leg.
- `outgoing_phone_number`: Caller ID presented to the dialed receiver (must match the verified ExoPhone).
- `fetch_after_attempt`: Set to `false` so Exotel branches to its configured applet rather than making another HTTP call.

---

## 4. Exotel AgentStream (WebSocket Voicebot Streaming)

For real-time bidirectional AI voice conversations, Exotel connects to Smrkomed's persistent media gateway:

### 4.1 WebSocket Connection Target
```
wss://dayahospital-production-467a7d31.up.railway.app/exotel/voicebot
```

### 4.2 Audio Specifications
- **Format:** Linear PCM (Uncompressed raw audio).
- **Encoding:** `audio/x-l16`.
- **Sample Rate:** `8000 Hz` (8 kHz narrowband telephony).
- **Bit Depth:** 16-bit little-endian.
- **Channels:** 1 (Mono).
- **Packet Size:** 320 bytes per 20ms frame.

### 4.3 WebSocket Protocol Lifecycle
1. **`connected`:** Connection established.
2. **`start`:** Informs gateway of `callSid`, `streamSid`, and audio metadata.
3. **`media`:** Bidirectional transmission of Base64-encoded PCM audio.
4. **`clear`:** Dispatched by Smrkomed when caller barge-in is detected to immediately flush speaker buffer on the telecom bridge.
5. **`stop`:** Stream terminated by carrier.

---

## 5. Webhooks & Event Ingestion

Exotel delivers status updates and recording completion callbacks to:
```http
POST https://dayahospital-production-467a7d31.up.railway.app/api/webhooks/exotel
```

### 5.1 Call Status Updates
Payload contains `CallSid`, `From`, `To`, `Status` (`completed`, `busy`, `no-answer`, `failed`), and `Duration`. Handled by [src/lib/integrations/telephony/exotel-adapter.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/lib/integrations/telephony/exotel-adapter.ts).

### 5.2 Recording Callbacks
When recording concludes, Exotel sends `RecordingUrl` (e.g., `https://api.exotel.com/v1/Accounts/smrkonova1/Recordings/{RecordingSid}`). The webhook handler updates `CallRecord.recordingUrl` and creates a `RecordingMetadata` record in Neon DB.

---

## 6. What Requires Manual Configuration in the Exotel Dashboard

A software developer cannot automate these items via Git; they require logging into `https://my.exotel.com`:

1. **ExoPhone Mapping:** Virtual number `08047291658` must be pointed to Inbound Applet `1399357`.
2. **Connect Applet Primary URL:** Under Applet 1399357 (or the relevant Connect applet), configure:
   ```
   https://dayahospital-production-467a7d31.up.railway.app/exotel/connect-destination?hospitalId=hosp_daya_thrissur&type=HUMAN_TRANSFER
   ```
   - HTTP Method: `GET`
   - Format: `JSON`
   - Fallback URL: Leave **BLANK** (prevents unintended failover to unverified default receivers).
3. **Connect Applet Branches:**
   - **Busy Branch:** Route to Staging Voicebot Applet `1393240`.
   - **No-Answer Branch:** Route to Staging Voicebot Applet `1393240`.
   - **Failed Branch:** Route to Staging Voicebot Applet `1393240` (or emergency fallback message).
4. **AgentStream WebSocket URL:** Under Voicebot Applet `1393240`, configure:
   ```
   wss://dayahospital-production-467a7d31.up.railway.app/exotel/voicebot
   ```

---

## 7. Carrier Testing Procedures (Without PSTN Charges)

Do **NOT** place live PSTN calls to test routing. Use the synthetic test scripts in `scripts/validation/`:

```bash
# 1. Test live Railway dynamic destination contracts
npx tsx scripts/validation/verify_phase_10_12_contracts.ts

# 2. Test complete synthetic connect destination suite (7 probes)
npx tsx scripts/validation/verify_live_deployed_connect_destination.ts
```

Both scripts probe the live Railway gateway using synthetic `CallSid` values, verifying JSON schema adherence, E.164 compliance, emergency safety guards, and tenant isolation without triggering telecom billing.
