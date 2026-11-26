# SMRKOMED — INFRASTRUCTURE & DEPLOYMENT RUNBOOK

This document provides a comprehensive operational guide to the production hosting, cloud infrastructure, environment configuration, database topology, and health monitoring for the Smrkomed platform.

---

## 1. Cloud Infrastructure Overview

Smrkomed is hosted across three primary cloud providers:

```
[Inbound Traffic: HTTPS / WSS]
              │
              ▼
    [Railway Edge Proxy]
   (TLS 1.3 Termination)
              │
              ▼
 [Railway Linux Container: Daya_hospital]
   ├── Next.js 16.0.7 Web App (Port 8080 / $PORT)
   └── Standalone Media Gateway WebSocket Server
              │
      ┌───────┴───────────────────────┐
      │                               │
      ▼                               ▼
[Neon Serverless PostgreSQL]   [External Cloud Providers]
  Region: AWS ap-southeast-1    ├── Exotel Singapore (api.exotel.com)
  PgBouncer Pool: Port 6543     ├── Sarvam Core (api.sarvam.ai)
  Direct DB: Port 5432          └── Sarvam Voice Agents (apps.sarvam.ai)
```

---

## 2. Infrastructure Inventory & Status

### 2.1 Git Source Control
- **Repository:** GitHub (`Daya_hospital`).
- **Active Branch:** `main`.
- **Latest Remote Deployed Commit:** `44b1be6` (*"feat(routing): Phase 9.5.1 and 9.5.2 Exotel Passthru routing, durable Neon escalation storage, and dynamic audio drain"*).
- **Working Tree State:** Clean uncommitted modifications locally from Phases 9.6, 9.6.1, 10, 10.1, and 10.2 awaiting deployment approval.

### 2.2 Railway PaaS
- **Project:** `ravi-rebirth`.
- **Service Name:** `Daya_hospital`.
- **Production Domain:** `dayahospital-production-467a7d31.up.railway.app`.
- **Deployment Strategy:** Nixpacks Node.js builder.
- **Build Command:** `npm run build` (runs `prisma generate` via postinstall, then `next build`).
- **Start Command:** `npm start` (starts Next.js server and integrated WebSocket media gateway).
- **Current Deployed Version Status:**
  - Railway is currently executing commit `44b1be6` (Phase 9.5.3).
  - Health check (`GET /health`) returns HTTP 200 OK.
  - Phase 10 Voice Agent endpoints (`/api/v1/voice-agent/*`) return HTTP 404 on the deployed Railway URL because the working tree has not yet been pushed and deployed to Railway.

### 2.3 Neon Serverless PostgreSQL
- **Region:** AWS `ap-southeast-1` (Singapore) — strategically colocated with Exotel Singapore and close to Indian callers for low latency.
- **Engine:** PostgreSQL 16.
- **Connection Strings:**
  - `DATABASE_URL`: PgBouncer pooled connection URL (`sslmode=require&pgbouncer=true`).
  - `DIRECT_URL`: Non-pooled direct database connection URL used exclusively for running Prisma migrations (`npx prisma migrate deploy`).
- **Active Tables:** 29 tables across 5 migrations.

### 2.4 Vercel Frontend Status
- Next.js runs directly within the Railway container alongside the media gateway.
- A standalone Vercel deployment is not currently active; all HTTP and WebSocket traffic routes through the unified Railway deployment.

---

## 3. Environment Variables Catalog

All sensitive production credentials are encrypted or managed via Railway environment variables. Below is the complete catalog with current configuration status:

| Variable Name | Required By | Configured in Railway? | Purpose |
|---|---|:---:|---|
| `DATABASE_URL` | Prisma / Neon DB | **YES** | Pooled PostgreSQL connection string |
| `DIRECT_URL` | Prisma Migrations | **YES** | Direct PostgreSQL connection string |
| `NODE_ENV` | Next.js / Runtime | **YES** | Set to `production` |
| `PORT` | Media Gateway & Next | **YES** | Dynamically assigned container port |
| `EXOTEL_ACCOUNT_SID` | Telephony / Adapter | **YES** | Exotel Singapore account identifier (`smrkomed1`) |
| `EXOTEL_API_KEY` | Telephony / Adapter | **YES** | Exotel API authorization key |
| `EXOTEL_API_TOKEN` | Telephony / Adapter | **YES** | Exotel API token secret |
| `EXOTEL_SUBDOMAIN` | Telephony / Adapter | **YES** | `api.exotel.com` |
| `EXOTEL_DEFAULT_APP_ID` | Telephony / Adapter | **YES** | Inbound Applet ID (`1393239`) |
| `EXOTEL_DEFAULT_EXOPHONE` | Telephony / Adapter | **YES** | Assigned virtual number (`08047291658`) |
| `EXOTEL_WEBHOOK_SECRET` | Webhook Verification | **YES** | Secret for verifying carrier status callbacks |
| `SARVAM_API_KEY` | Sarvam Core Engine | **YES** | Authorization key for STT, LLM, and Bulbul TTS |
| `SARVAM_BASE_URL` | Sarvam Core Engine | **YES** | `https://api.sarvam.ai` |
| `SARVAM_VOICE_AGENT_API_KEY` | Sarvam Voice Agents | **YES** | Voice agent key (`sk_samvaad_...`) |
| `SARVAM_VOICE_AGENT_WORKSPACE_ID` | Sarvam Voice Agents | **YES** | `01a06777-00da-7f77-abe3-dc1fc871a5ab` |
| `SARVAM_VOICE_AGENT_ORG_ID` | Sarvam Voice Agents | **YES** | `01a06777-00d4-7317-835c-507054052514` |
| `SARVAM_VOICE_AGENT_ID` | Sarvam Voice Agents | **YES** | `agent_daya_malayalam_reception_v1` |
| `SARVAM_VOICE_AGENT_WEBHOOK_SECRET` | Voice Agent Webhook | **YES** | Secret for HMAC signature verification |
| `CONVERSATION_ENGINE_MODE` | Gateway Engine Toggle | **YES** | Set to `SARVAM_CORE_CUSTOM` |
| `DAYA_HMS_BASE_URL` | HMS Adapter | OPTIONAL | Daya Grandis HMS base URL (unconfigured; mock mode active) |
| `DAYA_HMS_API_KEY` | HMS Adapter | OPTIONAL | Daya Grandis HMS API key |
| `AUTH_SECRET` | NextAuth / Session | **YES** | Secret for signing session cookies |

> [!CAUTION]
> Never print, log, or commit actual raw secret values to version control.

---

## 4. Health Checks & Probing Endpoints

Smrkomed provides standardized health check endpoints:

### 1. Gateway Health Probe
- **URL:** `GET https://dayahospital-production-467a7d31.up.railway.app/health`
- **Expected Response (HTTP 200 OK):**
  ```json
  {
    "status": "healthy",
    "service": "smrkomed-media-gateway",
    "timestamp": "2026-11-25T11:50:30.000Z",
    "uptimeSeconds": 14205,
    "activeSessions": 0,
    "memoryUsageMb": 128
  }
  ```

### 2. Database Connectivity Probe
- **URL:** Handled internally via `checkDatabaseConnection()` in `src/lib/db/prisma.ts`.
- Executes `SELECT 1` with a 2000ms timeout.
- Caches status for 15 seconds to prevent query flooding.

### 3. Integrations Status API
- **URL:** `GET /api/integrations/status` (requires authenticated session cookie).
- Probes real-time connectivity to Exotel REST API, Sarvam STT WebSocket endpoint, and Neon DB.

---

## 5. Build, Deployment & Local Development Commands

### 5.1 Local Development Commands
```bash
# 1. Install dependencies
npm install

# 2. Generate Prisma Client
npx prisma generate

# 3. Run type check
npx tsc --noEmit

# 4. Run automated unit & integration test suites
npm test

# 5. Start Next.js development server
npm run dev

# 6. Start media gateway server locally
npm run gateway:start
```

### 5.2 Production Build & Deployment Commands
```bash
# Production Next.js build
npm run build

# Deploy migrations to Neon PostgreSQL (uses DIRECT_URL)
npx prisma migrate deploy

# Start production server
npm start
```

---

## 6. Known Deployment Failures & Troubleshooting

1. **PowerShell Script Execution Policy Error:**
   - *Symptom:* `npm : File ... npm.ps1 cannot be loaded because running scripts is disabled on this system.`
   - *Fix:* Always invoke `npm.cmd` or `npx.cmd` in Windows PowerShell sessions.
2. **Missing `DATABASE_URL` during Next.js Prerendering:**
   - *Symptom:* `PrismaClientInitializationError: Environment variable not found: DATABASE_URL`.
   - *Fix:* `src/lib/db/prisma.ts` wraps client initialization in `getDatabaseConfig()`. In demo/sandbox environments without a database, it automatically falls back to in-memory mode without breaking `next build`.
3. **Sarvam Core Key Rejected on App Authoring API:**
   - *Symptom:* `HTTP 401: Invalid API key format` when calling `https://apps.sarvam.ai/api/app-authoring`.
   - *Fix:* Do not use `SARVAM_API_KEY` (`sk_live_...`) for Voice Agent App Authoring. Use the dedicated workspace key `SARVAM_VOICE_AGENT_API_KEY` (`sk_samvaad_...`).
4. **WebSocket Port Conflicts on Local Windows Machines:**
   - *Symptom:* `EADDRINUSE: address already in use :::8080`.
   - *Fix:* Kill orphaned node processes: `Get-Process node | Stop-Process -Force`.
