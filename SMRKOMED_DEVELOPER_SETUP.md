# SMRKOMED — NEW DEVELOPER ONBOARDING & LOCAL SETUP GUIDE

Welcome to the Smrkomed engineering team. This guide contains everything you need to set up your local development environment, run the media gateway, execute automated test suites, and safely test telephony and AI integrations without triggering unwanted charges or disrupting hospital operations.

---

## 1. Prerequisites & Required Software

Ensure you have the following installed on your development workstation:
- **Node.js:** `v20.x` or `v22.x` LTS (Recommended: Node 22.18+).
- **Package Manager:** `npm 10.x` or higher.
- **Git:** Latest version.
- **TypeScript:** `5.7+` (installed via devDependencies).
- **PostgreSQL Client (Optional):** psql or TablePlus for inspecting Neon DB.
- **Operating System:** Windows, macOS, or Linux. (On Windows PowerShell, remember to execute `npm.cmd` or `npx.cmd` to bypass script execution restrictions).

---

## 2. Repository Setup & Dependency Installation

1. **Clone the repository:**
   ```bash
   git clone <repository_url> smrkomed
   cd smrkomed/Daya_hospital
   ```
2. **Install Node.js dependencies:**
   ```bash
   npm install
   ```
3. **Generate Prisma Client:**
   ```bash
   npx prisma generate
   ```

---

## 3. Environment Variable Configuration

Create a local environment file `.env.local` inside `Daya_hospital/`:
```bash
cp .env.example .env.local
```

### Complete `.env.example` Variable-Name Inventory (Masked Placeholders)
Populate your `.env.local` using placeholder values. **Never commit `.env.local` to Git.**

```ini
# ==============================================================================
# SMRKOMED ENVIRONMENT CONFIGURATION TEMPLATE
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. DATABASE CONFIGURATION (Neon PostgreSQL)
# ------------------------------------------------------------------------------
# Pooled connection string (PgBouncer port 6543)
DATABASE_URL="postgresql://user:password@ep-sample-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true"
# Direct connection string for Prisma migrations (port 5432)
DIRECT_URL="postgresql://user:password@ep-sample.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

# ------------------------------------------------------------------------------
# 2. RUNTIME & HOSTING CONFIGURATION
# ------------------------------------------------------------------------------
NODE_ENV="development"
PORT="8080"
VOICE_GATEWAY_HOST="0.0.0.0"
VOICE_GATEWAY_PORT="8080"
VOICE_GATEWAY_PUBLIC_URL="http://localhost:8080"
VOICE_GATEWAY_AUTH_SECRET="dev-insecure-gateway-secret-key-32chars"

# ------------------------------------------------------------------------------
# 3. APPLICATION AUTHENTICATION
# ------------------------------------------------------------------------------
AUTH_SECRET="dev-auth-hmac-sha256-secret-key-minimum-32-chars"
NEXTAUTH_URL="http://localhost:3000"

# ------------------------------------------------------------------------------
# 4. EXOTEL CLOUD TELEPHONY (Singapore Account)
# ------------------------------------------------------------------------------
TELEPHONY_PROVIDER="exotel"
EXOTEL_ACCOUNT_SID="smrkomed1"
EXOTEL_API_KEY="placeholder_exotel_api_key"
EXOTEL_API_TOKEN="placeholder_exotel_api_token"
EXOTEL_SUBDOMAIN="api.exotel.com"
EXOTEL_BASE_URL="https://api.exotel.com/v1"
EXOTEL_DEFAULT_APP_ID="1393239"
EXOTEL_DEFAULT_EXOPHONE="08047291658"
EXOTEL_WEBHOOK_SECRET="placeholder_exotel_webhook_secret"
EXOTEL_STATUS_CALLBACK_URL="http://localhost:8080/api/webhooks/exotel"

# ------------------------------------------------------------------------------
# 5. SARVAM CORE CONVERSATION ENGINE (Custom Pipeline)
# ------------------------------------------------------------------------------
SARVAM_API_KEY="placeholder_sarvam_core_api_key"
SARVAM_BASE_URL="https://api.sarvam.ai"
SARVAM_STT_WS_URL="wss://api.sarvam.ai/streaming/speech-to-text/"
SARVAM_STT_MODEL="saaras:v4"
SARVAM_SAMPLE_RATE="8000"
SARVAM_TTS_MODEL="bulbul:v3"
SARVAM_TTS_SPEAKER="kavitha"
SARVAM_TTS_PACE="1.15"
SARVAM_CHAT_MODEL="sarvam-105b-conversations"
SARVAM_LANGUAGE_CODE="ml-IN"

# ------------------------------------------------------------------------------
# 6. SARVAM VOICE AGENTS / SAMVAAD PLATFORM
# ------------------------------------------------------------------------------
# Mode switch: "SARVAM_CORE_CUSTOM" (Default) or "SARVAM_VOICE_AGENTS"
CONVERSATION_ENGINE_MODE="SARVAM_CORE_CUSTOM"
SARVAM_VOICE_AGENT_API_KEY="placeholder_sk_samvaad_api_key"
SARVAM_VOICE_AGENT_WORKSPACE_ID="01a06777-00da-7f77-abe3-dc1fc871a5ab"
SARVAM_VOICE_AGENT_ORG_ID="01a06777-00d4-7317-835c-507054052514"
SARVAM_VOICE_AGENT_ID="agent_daya_malayalam_reception_v1"
SARVAM_VOICE_AGENT_WEBHOOK_SECRET="placeholder_voice_agent_webhook_secret"

# ------------------------------------------------------------------------------
# 7. HOSPITAL MANAGEMENT SYSTEM (HMS - Mock Fallback Active)
# ------------------------------------------------------------------------------
DAYA_HMS_BASE_URL="http://hospital-internal-vpn.dayahospital.com:8080/api"
DAYA_HMS_API_KEY="placeholder_hms_api_key"
DAYA_HMS_TIMEOUT_MS="3000"
```

---

## 4. Database Setup & Migrations

If connecting to Neon PostgreSQL, verify your connection and apply existing migrations:
```bash
# Verify schema syntax
npx prisma validate

# Deploy migrations to the database
npx prisma migrate deploy

# Seed baseline hospital tenant and admin account (optional)
npm run db:seed
```

> [!NOTE]
> If running completely offline without a PostgreSQL database, Smrkomed automatically detects that `DATABASE_URL` is unconfigured and switches to **Development Demo Mode** with in-memory relational stores.

---

## 5. Starting the Local Application

### Step 1: Start the Media Gateway
In Terminal 1, launch the WebSocket streaming media gateway:
```bash
npm run gateway:start
```
You will see output indicating the gateway is listening on `ws://0.0.0.0:8080/exotel/voicebot` with HTTP health probes active on `http://0.0.0.0:8080/health`.

### Step 2: Start the Next.js Web App
In Terminal 2, launch the Next.js development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 6. Running Tests & Quality Verification

Smrkomed uses Vitest for lightning-fast test execution. All test suites can run without external phone calls.

### Run All Unit and Contract Tests
```bash
npm test
```

### Run Key Telephony & Voice Agent Test Suites
```bash
# Run Programmable Connect dynamic routing contract tests
npx vitest run src/media-gateway/programmable-connect-contract.test.ts

# Run Sarvam Voice Agent controlled voice & webhook tests
npx vitest run src/lib/integrations/sarvam/phase-10-2-controlled-voice.test.ts

# Run Multi-Tenant Hospital Routing tests
npx vitest run src/lib/services/hospital-routing.test.ts

# Run IVR Gateway Integration tests
npx vitest run src/media-gateway/ivr-gateway-integration.test.ts
```

### Type Checking
```bash
npx tsc --noEmit
```

---

## 7. Safe Testing Guidelines (NON-NEGOTIABLE SAFETY RULES)

To protect patient safety, avoid telephone carrier toll fraud, and preserve cloud credits:

1. **NO REAL PSTN OUTBOUND DIALING:**
   Never trigger outbound phone calls to real patient phone numbers. Keep outbound calling in simulation mode.
2. **DO NOT MODIFY EXOTEL APPLET `1393239`:**
   Exotel Applet `1393239` is actively linked to the live pilot ExoPhone. Do not delete, unpublish, or alter its configuration in the Exotel Web Portal without explicit authorization.
3. **DO NOT CREATE DUPLICATE SARVAM DEPLOYMENTS:**
   Sarvam Voice Agents workspace already has deployment `Inbound-3b5df8df-f098` on Vobiz number `+918064265889`. Do not create additional deployments or publish unnecessary agent versions.
4. **USE SYNTHETIC CALLSIDS FOR WEBHOOK TESTING:**
   When testing `/exotel/connect-destination`, `/exotel/passthru`, or `/api/v1/voice-agent/call-ended`, always use synthetic CallSids (e.g. `call_dev_test_001`).
5. **KEEP HMS IN SIMULATION TESTING MODE:**
   Verify that all booking and availability tool responses return `dataSource: "SIMULATED_MOCK_HMS"` and `mode: "SIMULATION_TESTING"` until the official hospital VPN tunnel is active.
