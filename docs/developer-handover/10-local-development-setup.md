# 10 — Local Development & Developer Onboarding Guide

This document is an actionable, step-by-step onboarding guide for an incoming software engineer setting up **Smrkomed / Daya Hospital** on a local development workstation.

---

## 1. System Prerequisites

Before starting, ensure your workstation meets the following requirements:
- **Operating System:** macOS, Ubuntu/Debian Linux, or Windows 11 (PowerShell / WSL2).
- **Node.js:** `v22.x` (LTS recommended, minimum `v20.x`). Verify with `node -v`.
- **npm:** `v10.x` or higher. Verify with `npm -v`.
- **Git:** Installed and configured with your GitHub SSH/HTTPS credentials.
- **Docker (Optional):** Required only if you wish to run a local PostgreSQL instance.

---

## 2. Step-by-Step Workspace Setup

### Step 1: Clone the Repository
```bash
git clone https://github.com/Smrkonovatech/Daya_hospital.git
cd Daya_hospital
```

### Step 2: Verify Active Branch & Status
```bash
git status
git branch -a
# Confirm you are on branch 'main' and working tree is clean
```

### Step 3: Install Node.js Dependencies
```bash
npm install
```
*Note:* During `postinstall`, Prisma will automatically generate the TypeScript client (`prisma generate`).

### Step 4: Configure Local Environment Variables
Copy the template configuration file:
```bash
# On Linux / macOS:
cp .env.example .env.local

# On Windows PowerShell:
Copy-Item .env.example .env.local
```

Open `.env.local` in your editor and configure the essential variables:
```env
# 1. Database (Use your Neon development URL or local PostgreSQL)
DATABASE_URL="postgresql://user:password@ep-project-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true"
DIRECT_URL="postgresql://user:password@ep-project.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"

# 2. Local App Server
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="dev_session_secret_at_least_32_chars_long_12345"

# 3. Controlled Simulation Mode (Allows running without live HMS VPN)
HMS_ENVIRONMENT="simulation"
DAYA_HMS_SIMULATION="true"

# 4. Telephony & Media Gateway
TELEPHONY_PROVIDER="EXOTEL"
EXOTEL_DEFAULT_EXOPHONE="08047291658"
EXOTEL_DEFAULT_APP_ID="1399357"
VOICE_GATEWAY_PORT="8080"
```

### Step 5: Initialize Prisma Database Client
```bash
npx prisma generate
```

If connecting to a fresh development database, apply existing migrations:
```bash
npx prisma migrate deploy
```

*(Optional)* Seed the database with baseline Daya Hospital data, departments, and doctors:
```bash
npm run db:seed
```

---

## 3. Running the Development Environments

### Option A: Running the Web Application (Next.js 16)
Starts the Next.js development server with Turbopack compiler:
```bash
npm run dev
```
Open your browser to:
- **Application Portal:** `http://localhost:3000`
- **Calls & Recordings Log:** `http://localhost:3000/calls`
- **Hospital IVR Builder:** `http://localhost:3000/ivr`
- **Clinical Knowledge Base:** `http://localhost:3000/knowledge`

### Option B: Running the Real-Time Media Gateway (Standalone WebSocket Server)
Starts the persistent Node.js WebSocket media server on port `8080`:
```bash
npm run gateway:start
```
Verify the gateway is operational:
```bash
# Health check probe
curl http://localhost:8080/health

# Gateway status probe
curl http://localhost:8080/status
```

---

## 4. Verification & Validation Commands

Always run these checks before committing code:

```bash
# 1. TypeScript Static Type Check (0 errors expected)
npx tsc --noEmit

# 2. Automated Test Suite (Vitest)
npm test

# 3. Production Build Validation (Turbopack)
npm run build
```

---

## 5. Offline Development (No Live Carrier or AI Credentials)

You **do not need** active Exotel or Sarvam subscriptions to build features:
1. **HMS Offline Mode:** With `HMS_ENVIRONMENT=simulation` in `.env.local`, all appointment bookings, availability queries, and doctor lists resolve through [src/lib/integrations/hms/mock-adapter.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/lib/integrations/hms/mock-adapter.ts).
2. **Telephony Stubs:** Test dynamic routing logic using synthetic scripts (`scripts/validation/verify_live_deployed_connect_destination.ts`) which pass mock `CallSid` values without placing carrier phone calls.
3. **Local Audio Files:** The recording player serves high-fidelity local WAV files located in [scripts/validation/audio_output/](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/scripts/validation/audio_output/) when remote carrier audio is unconfigured.

---

## 6. Troubleshooting Common Errors

### Error: `Route segment config "runtime" is not compatible with nextConfig.cacheComponents`
- **Cause:** Next.js 16 with `cacheComponents: true` prohibits `export const runtime = "nodejs"` or `export const dynamic = "force-dynamic"` in Route Handlers.
- **Fix:** Remove explicit segment configs. Next.js Route Handlers run on Node.js by default and infer dynamicity automatically when reading `request.headers` or search params.

### Error: `P1001: Can't reach database server at ...`
- **Cause:** Network firewall, expired Neon credentials, or missing `?sslmode=require` query parameter.
- **Fix:** Check your internet connection, verify the database credentials in Neon console, and ensure `sslmode=require` is present in `DATABASE_URL`.

### Error: `UnauthorizedAccess` running PowerShell scripts on Windows
- **Cause:** Windows PowerShell script execution policy restricts `npx.ps1`.
- **Fix:** Use `npx.cmd <command>` instead of `npx <command>` on Windows PowerShell.
