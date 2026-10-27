# Daya General Hospital — AI Calling Operations Dashboard

A dedicated, hospital-branded AI calling management dashboard for **Daya General Hospital Ltd & Speciality Surgical Centre**, Thrissur.

Designed to oversee and audit incoming phone calls routed to a Malayalam-speaking voice assistant powered by **Sarvam AI**, with live bidirectional integration to Daya Hospital's **Hospital Management System (HMS)** and telephony IVR provider.

---

## 🏥 Hospital Operational Context

- **Daily Inbound Volume:** ~1,200 calls/day.
- **Human Agent Coverage:** 6 call center staff across 24/7 hospital operations.
- **Target Resolution:** Route busy and unanswered calls to the Sarvam Malayalam AI Voice Assistant to eliminate ~200 daily missed calls.
- **AI Scope:**
  - Answer hospital enquiries using approved knowledge base (OPD timings, consultation fees, registration policies, IP admission, visiting hours).
  - Check doctor availability & live appointment slots using Daya authorised HMS APIs.
  - Book, reschedule, or cancel appointments only when verified by the HMS.
  - Seamlessly transfer trauma/casualty calls to 24/7 emergency dispatch and TPA desks.
  - Record call outcomes, idempotency keys, and verified HMS transaction references.

---

## 🎨 Brand & Design System

- **Primary Hospital Blue:** `#0C5DB8`
- **Hospital Teal Accent:** `#18A99D`
- **Amber Warning / Notice:** `#E5A000` / `#F59E0B`
- **Workspace Canvas:** `#F5F8FC`
- **Typography & Iconography:** Clean system sans-serif hierarchy, Lucide icons.
- **Authentic Brand Logo:** Sourced directly from Daya Hospital's official brand assets (`public/logo.png`, 330×60px).

---

## 📂 Core Navigation & Modules

| Route | Module | Purpose |
| :--- | :--- | :--- |
| `/` | **Overview** | Executive KPI cards (Calls Offered, AI Answered, Handled %, Transferred to Staff, Appointments Booked, Follow-ups Required), 24/7 call trend area chart, Malayalam intent distribution, live recent calls stream, and staff triage queue. |
| `/calls` | **Call History** | Searchable and filterable call audit ledger (by status, intent, language, follow-up state), privacy phone number masking (`+91 98460 •••••`) with audit reveal toggle, duration, and CSV export. |
| `/actions` | **AI Actions** | Execution status ledger for every doctor availability check, slot booking, reschedule, and staff handoff. Features HMS reference tracking, raw payload inspection, and idempotency key audit. |
| `/knowledge` | **Knowledge Base** | Authorized clinical timetables, doctor fees, visiting regulations, and Malayalam pronunciation guides. Features version history, audit change log, and 1-click **Sync to AI Voice Agent**. |
| `/settings` | **Settings** | Role-Based Access Control (`HOSPITAL_ADMIN` vs `CALL_REVIEWER`), recording retention policies (e.g. 30 days auto-purge), Malayalam consent disclaimer toggle, and integration status (without exposing secrets). |

---

## 🛠️ Architecture & Tech Stack

- **Framework:** Next.js (App Router, Turbopack)
- **UI:** React 19, TypeScript (strict mode), Tailwind CSS, Lucide icons
- **Charts:** Recharts (Responsive area charts and distribution breakdowns)
- **Database:** PostgreSQL with Prisma ORM (`prisma/schema.prisma`)
- **Integration Layer:** Typed integration interfaces (`IDayaHmsAdapter`, `ISarvamVoiceAdapter`, `ITelephonyIvrAdapter`) with pluggable mock sandbox adapters and production client registry.
- **Idempotency Protection:** Prevents duplicate bookings caused by webhook retries or telephony network drops.
- **Unit & Component Testing:** Vitest and React Testing Library (18 passing tests).

---

## 🚀 Running the Project

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Local Development Server
```bash
npm run dev
```
Navigate to [http://localhost:3000](http://localhost:3000) (or `http://localhost:3001` if port 3000 is occupied).

### 3. Run Unit & Component Tests
```bash
npm run test
```

### 4. Run Linter
```bash
npm run lint
```

### 5. Production Build
```bash
npm run build
npm run start
```

---

## 🔌 Connecting Real Daya Hospital APIs

To switch from Mock Sandbox mode to live Daya Hospital endpoints, configure the following environment variables in `.env.local` (server-side only, never bundled to client):

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/daya_ai_calling?schema=public"

# Sarvam AI Voice Gateway
SARVAM_API_KEY="sk_live_sarvam_..."
SARVAM_VOICE_AGENT_ID="agent_malayalam_daya_..."
SARVAM_WEBHOOK_SECRET="whsec_..."

# Daya Hospital Management System (HMS)
DAYA_HMS_API_URL="https://hms.dayahospital.com/api/v1"
DAYA_HMS_API_KEY="daya_hms_token_..."
DAYA_HMS_TIMEOUT_MS=5000

# Hospital Telephony / IVR Trunk
IVR_SIP_TRUNK_URL="sip:trunk.dayahospital.telephony.provider"
IVR_SIP_CREDENTIALS="trunk_auth_secret_..."
```

---

## 🔒 Privacy & Compliance (NABH / DISHA Ready)

1. **No Caller PII Exposure:** Caller numbers are masked by default (`+91 98460 •••••`).
2. **Never Confirm Spoken Only:** AI bookings are only marked `CONFIRMED` upon receiving a valid HTTP 200 and booking reference from Daya's authorized HMS.
3. **Idempotency Deduplication:** Webhooks and booking requests include idempotency keys to prevent accidental double-booking.
4. **Credential Isolation:** Hospital dashboard users never see technical API keys, system prompts, or internal provider secrets.
