# 01 — Smrkomed Project Overview

## 1. What Smrkomed Is

**Smrkomed** is an enterprise hospital telephony automation and AI voice intelligence platform developed by **Smrkonova**. It bridges traditional Public Switched Telephone Networks (PSTN) and cloud telephony carriers (specifically **Exotel**) with conversational Artificial Intelligence (**SMRKO VOICE**, powered by **Sarvam AI**) and Hospital Information Systems (**Grandis HMS**).

The system serves as an intelligent front-desk telephony layer for healthcare institutions, capable of understanding regional Indian languages (primarily Malayalam, English, and conversational "Manglish"), automating appointment booking, resolving OPD enquiries, routing calls to human staff, and triaging emergencies with fail-closed safety.

The platform is multi-tenant by design. Its flagship pilot deployment is configured for **Daya General Hospital & Specialty Surgical Centre** (`hosp_daya_thrissur`), a major multi-specialty healthcare institution in Thrissur, Kerala.

---

## 2. Business Problem Solved

Hospital reception desks face severe operational strain:
- **High Call Abandonment:** Hospitals experience 30%–45% call drop rates during peak OPD booking hours (08:30–12:30), resulting in lost patient visits and patient frustration.
- **Repetitive Routine Queries:** Receptionists spend over 60% of their phone time answering basic questions: doctor consultation schedules, department locations, OPD timings, visiting hours, and consultation fees.
- **Language Barriers in Voice AI:** Standard western voice agents fail abruptly on Indian regional accents, colloquial phrasing, doctor names, and mixed language usage (e.g., Malayalam mixed with English medical terminology).
- **Emergency Bottlenecks:** When casualty lines are tied up with appointment calls, critical emergency cases face dangerous hold times.
- **After-Hours Coverage Gap:** Routine booking lines close after 18:00, preventing working patients from scheduling appointments during evening hours.

**Smrkomed resolves this by:**
1. Providing 24/7 instant conversational answering in native Malayalam and Indian English.
2. Handling end-to-end appointment scheduling, doctor schedule lookups, and cancellations via real-time HMS integration.
3. Automatically overflowing calls to AI only when human receptionists are busy or away.
4. Instantly isolating emergency callers and transferring them directly to casualty lines without AI delays.

---

## 3. Intended User Personas

| User Persona | Role & Objectives | Primary Interface |
|---|---|---|
| **Hospital Administrator** | Hospital executives, operations heads, and IT directors configuring hospital profile, department directories, routing rules, AI prompt guidelines, and viewing analytics. | Next.js Web Dashboard (`/settings`, `/overview`, `/ivr`) |
| **OPD Receptionist / Desk Staff** | Front-desk staff managing their live presence (Available, On Call, Break), receiving escalated warm transfers, and monitoring call overflow logs. | Web Presence Widget (`/settings/users`) & Physical Desk Phone |
| **Clinical Reviewer / Auditor** | Medical records staff and quality managers auditing call recordings, transcripts, triage accuracy, and AI summaries. | Calls Dashboard & Audio Player (`/calls`, `/calls/[callId]`) |
| **Patient / Caller** | Inbound hospital callers inquiring about doctors, booking appointments, following up on care, or seeking emergency trauma care. | PSTN / Mobile Phone Call |

---

## 4. What the Hospital Administrator Can Manage

Through the Smrkomed Web Portal, hospital administrators can:
1. **Hospital Tenant Profile:** Manage hospital name, contact numbers, ExoPhones, and localization settings ([src/app/settings/page.tsx](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/app/settings/page.tsx)).
2. **IVR & Routing Rules:** Create, edit, simulate, and publish version-controlled IVR trees and DTMF branch mappings ([src/app/ivr/page.tsx](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/app/ivr/page.tsx)).
3. **AI Voice Agent Configurations:** Select STT models (`saaras:v4`), LLM models (`sarvam-105b-conversations`), TTS speakers (`bulbul:v3`), speech pace, and clinical system prompts ([src/app/agents/page.tsx](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/app/agents/page.tsx)).
4. **Clinical Knowledge Base:** Author and publish hospital FAQs, doctor profiles, room tariffs, and facility policies synchronized to the AI agent ([src/app/knowledge/page.tsx](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/app/knowledge/page.tsx)).
5. **Staff Presence & Overflow Policies:** Configure receptionist ring timeouts (e.g., 20 seconds), casualty fallback numbers, and after-hours schedules ([src/app/api/v1/config/routing/route.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/app/api/v1/config/routing/route.ts)).
6. **Audit Logs & Version History:** Inspect immutable version snapshots and roll back routing or agent settings ([src/lib/services/hospital-routing-service.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/lib/services/hospital-routing-service.ts)).

---

## 5. What Receptionists Can Do

Receptionists interact with the telephony system via both their physical phone extensions and the Smrkomed portal:
1. **Live Presence Management:** Toggle presence between `AVAILABLE`, `ON_CALL`, `BREAK`, and `OFFLINE` ([src/app/api/v1/receptionist/presence/route.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/app/api/v1/receptionist/presence/route.ts)).
2. **Direct Reception Answering:** When available, inbound appointment calls ring the receptionist's desk phone for a configured timeout (20s).
3. **Overflow Monitoring:** Review calls that rolled over to SMRKO VOICE while receptionists were busy, with AI transcripts, caller intents, and follow-up flags ([src/app/api/v1/receptionist/overflow-logs/route.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/app/api/v1/receptionist/overflow-logs/route.ts)).
4. **Warm Transfer Handover:** Receive live transfers from the AI agent when caller requests human assistance or expresses high distress.

---

## 6. What the SMRKO VOICE AI Agent Does

When an inbound call connects to the AI voice engine, **SMRKO VOICE**:
1. **Speaks and Understands Malayalam & English:** Greets the caller in natural Malayalam, effortlessly recognizing code-mixed "Manglish" (e.g., *"Cardiology doctor Dr. Suresh Kumar availability check cheyyamo?"*).
2. **Executes Real-Time Hospital Tools (Tool Calling):**
   - `get-doctors`: Inquires available doctors by medical department or name.
   - `check-availability`: Inspects real-time OPD time slots for a chosen doctor.
   - `book-appointment`: Books the slot, confirms the patient's name, generates an appointment reference, and allocates an OPD token number.
   - `reschedule-appointment` & `cancel-appointment`: Modifies existing bookings.
   - `get-appointment`: Verifies existing booking details using the caller's mobile number.
3. **Clinical Emergency Escalation:** Detects acute, life-threatening symptoms (chest pain, stroke, breathing difficulty) and triggers immediate transfer to the Casualty Department.

---

## 7. How Inbound Calls Are Handled

```
Inbound PSTN Call -> Dialed Virtual Number (ExoPhone: 08047291658)
  │
  ▼
Exotel Carrier Applet (Applet 1399357)
  ├── Press 1: Emergency -> Bypasses AI -> Direct Transfer to Casualty (+919740662046)
  ├── Press 2: OPD Appointments -> Rings Receptionist (20s) -> On Busy/No-Answer -> SMRKO VOICE
  └── Press 3: General Enquiries -> Direct to SMRKO VOICE
```

The system dynamically resolves destinations by querying the Smrkomed gateway (`/exotel/connect-destination`), ensuring changes made in the dashboard update call routing in real-time without modifying Exotel applets.

---

## 8. How Outbound Calls Are Intended to Work

*Design Architecture:*
1. **Automated Reminders:** Triggered 24 hours prior to scheduled OPD appointments via cron or webhook from HMS.
2. **API Trigger:** `/api/calls/outbound` and `/api/v1/calls/outbound` trigger Exotel Call REST API (`POST https://api.exotel.com/v1/Accounts/{AccountSid}/Calls/connect.json`).
3. **Interactive Confirmation:** SMRKO VOICE asks the patient to confirm attendance (Press 1 or Say Yes), reschedule (Press 2), or cancel.
4. *Implementation Status:* The outbound API routes exist in the codebase ([src/app/api/calls/outbound/route.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/app/api/calls/outbound/route.ts)), but live PSTN outbound triggering is currently disabled in `DEVELOPMENT_TESTING` mode.

---

## 9. How Human Receptionist Handoff Works

1. **Detection:** Caller explicitly says *"Enikku receptionistodu samsarikkanam"* (I want to speak with a receptionist), presses '0', or the AI confidence score drops below 0.65 across consecutive turns.
2. **Action Trigger:** The voice agent invokes `emergency-escalate` or sets escalation state to `HUMAN_TRANSFER`.
3. **Destination Resolution:** Smrkomed queries [src/lib/services/hospital-routing-service.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/lib/services/hospital-routing-service.ts), inspecting the active published routing version.
4. **Presence Check:** If receptionist is `AVAILABLE`, the call transfers to the configured primary desk extension (+919606654032 in development).
5. **Fail-Safe Retention:** If the transfer fails or reception line is busy, the call is gracefully retained by the AI agent with an apology and a high-priority follow-up task logged in the dashboard.

---

## 10. How Emergency Escalation Works

1. **Zero-Delay Isolation:** Emergency routing strictly bypasses standard AI queuing and business-hour restrictions.
2. **Dual Trigger Paths:**
   - **DTMF Level:** Inbound IVR Press 1 maps to `EMERGENCY_TRANSFER`.
   - **Voice Level:** SMRKO VOICE NLP detector detects emergency keywords (Malayalam: *nenjuvedhana*, *swasam muttal*, *accident*; English: *heart attack*, *unconscious*).
3. **Safety Guard (Phase 10.14 Contract):** If `emergencyPstnTransferEnabled` is set to `false` (as is the case during development with temporary test receivers), the endpoint **fails closed** (`HTTP 403 EMERGENCY_PSTN_TRANSFER_DISABLED_FAIL_CLOSED`), preventing unverified numbers from being dialed over PSTN.

---

## 11. Multi-Tenant Hospital Architecture

While Daya Hospital is the pilot tenant, the platform supports arbitrary hospitals through:
1. **Tenant Identifiers:** Every configuration, call record, agent, and IVR version is scoped by `hospitalId` (e.g., `hosp_daya_thrissur`, `hosp_aster_medcity`, `hosp_kims_trivandrum`).
2. **ExoPhone Mapping:** Dialed DID numbers (`CallTo`) map strictly to tenant configurations via [src/lib/config/hospital-config.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/lib/config/hospital-config.ts).
3. **Fail-Closed Isolation:** If a caller or webhook queries `hospitalId=hosp_aster_medcity` against Daya's ExoPhone, the gateway returns HTTP 403 `TENANT_MISMATCH_FORBIDDEN`. Demo tenants without verified trunks fail closed on live carrier calls.

---

## 12. Complete Caller Journeys (With Concrete Examples)

### Scenario A: Successful Appointment Booking (Malayalam / Manglish)
```
Caller: "Namaskaram, Cardiologist Dr. Suresh Kumar-ine kaanan slot undo naale?"
SMRKO VOICE: "Namaskaram! Daya Hospital-ilekku swagatham. Dr. Suresh Kumar naale (Friday) morning OPD-il labhyamanu. 10:30 AM matrum 11:15 AM-nu slots ozhivundu. Ethaanu thaalparyam?"
Caller: "10:30 AM slot mathi. Name Gopalan Nair."
SMRKO VOICE: "Sheri, Mr. Gopalan Nair. Naale raavile 10:30 AM-nu Dr. Suresh Kumar-umaayi ningalude appointment book cheythittundu. Booking reference: DAYA-OPD-42294, Token number 14. Details SMS aayi ayakkunnathaannu. Vere enthenkilum sahayam veno?"
Caller: "Illa, nanni."
SMRKO VOICE: "Nanni, Daya Hospital-il ninnum nalla oru divasam aashamsikkunnu!"
```

### Scenario B: Acute Emergency Triage (Instant Handoff)
```
Caller: "Ente achannu bayankara nenju vedhana edukyunnu, swasam kittunnilla!"
SMRKO VOICE: [Detects Critical Emergency Trigger: 'nenju vedhana' (chest pain)]
SMRKO VOICE: "Ithu emergency aayi kanakkakkunnu. Njan ippol thanne ningale Daya Casualty Emergency Department-ilekku transfer cheyyukayanu. Dayavayi hold cheyyu!"
Gateway Action: Escalates call immediately to Casualty Direct Line.
```

---

## 13. Implemented vs. Planned Product Reality

| Feature Area | Documented Design Vision | Actual Codebase Implementation State |
|---|---|---|
| **IVR Dynamic Routing** | Real-time routing from dashboard to carrier | **FULLY IMPLEMENTED & DEPLOYED** on Railway (`/exotel/connect-destination`). |
| **SMRKO VOICE Action Tools** | 7 automated clinical tools with fail-closed logic | **FULLY IMPLEMENTED** (`/api/v1/voice-agent/*`). Passed 31/31 unit tests. |
| **HMS Live Connectivity** | Direct VPN integration with Daya Grandis HMS | **PENDING VPN ACCESS**. Adapter operates in fail-closed mode (HTTP 503) when live VPN is unreachable; simulation sandbox available for unit testing. |
| **Call Recording Playback** | Seamless player streaming carrier WAV files | **STREAMING ENGINE READY**. Byte-range HTTP 206 streaming is implemented; 5 legacy DB recordings currently point to unreachable carrier URLs (`audio.exotel.com`). |
| **Outbound Campaigns** | Automated patient reminder calls | **PARTIALLY IMPLEMENTED**. Routes exist; live PSTN dialing disabled in development. |
| **Multi-Hospital Onboarding** | Self-service hospital admin registration | **MANUAL / CODE CONFIGURED**. Multi-tenant schema and isolation rules exist, but self-service onboarding UI is not yet built. |
