# Daya General Hospital — IVR & Telephony Integration Architecture

## 1. Executive Summary & Infrastructure

Daya General Hospital operates a 30-channel primary rate interface (PRI) / SIP Trunk connected to the hospital on-premise PBX exchange. The hospital receives approximately **1,200 incoming calls per day**, of which approximately **200 calls were previously missed** during peak morning and evening OPD registration hours.

Six (6) dedicated front-desk agent stations cover telephone enquiries across shifts. This integration transparently offloads eligible busy or unanswered calls to the Malayalam AI Voice Assistant powered by Sarvam AI, without disrupting normal agent answering workflows.

---

## 2. Number Routing & PBX Hunt Group Configuration

### Incoming Hunt Group (`HUNT_GRP_OPD_MAIN`)
- **Pilot DID / Virtual Number:** `+91 487 2475000` (Main Daya Hospital Helpline)
- **Primary Agent Lines:**
  - Agent Station 1: Extension `201`
  - Agent Station 2: Extension `202`
  - Agent Station 3: Extension `203`
  - Agent Station 4: Extension `204` (Insurance & TPA Helpdesk)
  - Agent Station 5: Extension `205`
  - Agent Station 6: Extension `206`
- **Distribution Algorithm:** Linear Hunt / Circular Round-Robin across available active agent lines.

---

## 3. Rollover Triggers & Timeout Values

Calls are conditionally diverted to the Sarvam AI Voice Queue under strictly documented criteria:

| Trigger Condition | PBX Detection Threshold | Routing Action |
|---|---|---|
| **All Agents Busy (User Busy / 486)** | Immediate (< 500 ms) | SIP Diversion to AI SIP URI |
| **No-Answer Ring Timeout** | **20 Seconds** (4 full rings) | SIP Diversion to AI SIP URI |
| **Out-of-Hours (Night Window)** | 08:30 PM to 06:30 AM IST | Direct Night IVR with AI assistance |
| **Concurrency Ceiling** | 30 active trunk channels reached | Overflow to Casualty PRI Line (`+91 487 2475101`) |

### AI SIP Endpoint Details
- **AI SIP URI:** `sip:sarvam-malayalam@daya-ivr.telephony.internal:5060`
- **Audio Codec:** G.711 A-law (PCMA) / Opus (48kHz, 20ms frame size)
- **Signaling:** SIP over TLS (Port 5061) or SIP UDP/TCP (Port 5060 internal)

---

## 4. Loop Prevention & Hop Count Enforcement

To prevent infinite routing loops between PBX hunt groups, AI queues, and human front desk transfers, the system enforces a strict **Hop Count Protocol**:

1. **Hop Header:** All diverted SIP INVITE requests inject the custom header:
   ```http
   X-Daya-Hop-Count: 1
   ```
2. **Hop Guard Rule:**
   - If `X-Daya-Hop-Count == 0`: Call is eligible for AI diversion.
   - If `X-Daya-Hop-Count >= 1`: Call has already passed through the AI assistant once. The IVR **prohibits** re-forwarding to the AI queue under any circumstances.
3. **Loop Mitigation:** Any call exceeding `hopCount >= 1` that fails agent connection is immediately diverted to the **Emergency Casualty / Trauma Desk (Ext 101)**.

---

## 5. Escalation & Fallback Plan

When the AI Voice Assistant identifies an emergency, unresolvable enquiry, or caller distress, warm transfer is executed:

| Priority | Target Department | Extension | Dial Plan URI |
|---|---|---|---|
| **P1 - Emergency / Casualty** | Casualty & Trauma Care (24/7) | `101` | `sip:casualty-ext101@daya-pbx.internal:5060` |
| **P2 - Human Agent Desk** | OPD Outpatient Registration | `201` / `202` | `sip:frontdesk@daya-pbx.internal:5060` |
| **P3 - TPA / Cashless Desk** | Insurance Pre-Authorization | `204` | `sip:insurance-ext204@daya-pbx.internal:5060` |

If the target extension does not answer within **15 seconds**, the PBX automatically invokes the **Casualty Night Operator** and dispatches an urgent staff follow-up ticket in the AI Calling Dashboard.

---

## 6. Provider-Side Configuration Summary

| Setting | Required Value | Notes |
|---|---|---|
| `TELEPHONY_PROVIDER` | `DAYA_PBX_SIP_TRUNK` | Provider identifier |
| `TELEPHONY_SIP_GATEWAY` | `sip.dayahospital.internal:5060` | Hospital PBX gateway |
| `TELEPHONY_TRUNK_CHANNELS` | `30` | Maximum simultaneous channels |
| `TELEPHONY_FALLBACK_EXTENSION` | `101` | 24/7 Casualty & Trauma line |
| `RING_TIMEOUT_SECONDS` | `20` | Front desk ring duration before rollover |
| `HOP_LIMIT` | `1` | Maximum roundtrips allowed |
