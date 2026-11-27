# 09 — Environment Variables & Configuration Reference

This document provides the authoritative environment variable catalog for **Smrkomed / Daya Hospital**.

> [!WARNING]
> **SECURITY DIRECTIVE: ZERO SECRETS POLICY**
> In compliance with strict engineering security guidelines, this document lists variable names, usage, and acquisition instructions only. **No actual passwords, API keys, tokens, webhook secrets, or credential-bearing connection strings are printed.**

---

## 1. Master Environment Variable Reference Table

| Variable Name | Purpose & Function | Required? | Consuming Subsystems | Where / How to Obtain |
|---|---|:---:|---|---|
| `DATABASE_URL` | PostgreSQL connection string (pooled via PgBouncer, port 6543, SSL mode required). | **YES** | Prisma Client, Media Gateway, API routes | Neon Console (`ep-project-pooler`) or Railway service variables |
| `DIRECT_URL` | Direct unpooled PostgreSQL connection string (port 5432, SSL mode required). | **YES** (for migrations) | Prisma CLI (`prisma migrate`) | Neon Console (non-pooler branch URL) |
| `PORT` | Dynamic TCP listening port assigned by container host. Defaults to 8080. | Optional (Auto in Railway) | Standalone Media Gateway, Next.js server | Automatically injected by Railway PaaS |
| `NODE_ENV` | Environment mode (`development`, `test`, `production`). | **YES** | Next.js, Media Gateway, Security gates | Injected by hosting provider or local `.env` |
| `RAILWAY_ENVIRONMENT` | Indicates Railway deployment tier (`production`, `staging`). | Optional | Media Gateway readiness evaluation | Injected automatically by Railway |
| `TELEPHONY_PROVIDER` | Identifies active telephony carrier (`EXOTEL` or `BITVOICE`). | **YES** | Telephony service factory | Default to `"EXOTEL"` in `.env.local` |
| `EXOTEL_ACCOUNT_SID` | Exotel Singapore trunk account identifier. | **YES** | Exotel REST adapter, Call webhooks | Exotel API Console under Account Settings |
| `EXOTEL_API_KEY` | HTTP Basic Auth username for Exotel REST API. | **YES** | Outbound calls, Applet management | Exotel API Console -> API Credentials |
| `EXOTEL_API_TOKEN` | HTTP Basic Auth password for Exotel REST API. | **YES** | Outbound calls, Applet management | Exotel API Console -> API Credentials |
| `EXOTEL_BASE_URL` | Base API domain (`https://api.exotel.com`). | Optional | Exotel client | Defaults to `https://api.exotel.com` |
| `EXOTEL_SUBDOMAIN` | Exotel regional routing subdomain (`api`). | Optional | Dynamic routing adapter | Defaults to `"api"` for Singapore |
| `EXOTEL_DEFAULT_EXOPHONE` | Primary virtual number for Daya Hospital (`08047291658`). | **YES** | Exotel adapter, Routing service | Exotel Phone Numbers dashboard |
| `EXOTEL_DEFAULT_APP_ID` | Inbound Voicebot / IVR Applet ID (`1399357`). | **YES** | Call routing, Outbound triggers | Exotel Applet Flow Builder |
| `EXOTEL_WEBHOOK_SECRET` | Secret key used to verify incoming Exotel callbacks. | **YES** (Prod) | `/api/webhooks/exotel` | Defined in Exotel Webhook settings |
| `VOICE_GATEWAY_PORT` | Local port for persistent WebSocket media server (8080). | Optional | `src/media-gateway/server.ts` | Set in local `.env` (defaults to 8080) |
| `VOICE_GATEWAY_HOST` | Host interface for media server (`0.0.0.0`). | Optional | `src/media-gateway/server.ts` | Defaults to `"0.0.0.0"` |
| `VOICE_GATEWAY_AUTH_SECRET` | Token for authenticating WebSocket connections from Exotel. | Optional | WebSocket handshake gate | Custom shared secret configured in Exotel applet |
| `SARVAM_API_KEY` | Primary API key for Sarvam Core speech APIs (STT / TTS). | **YES** | `saaras:v4` STT, `bulbul:v3` TTS | Sarvam AI Developer Dashboard (`api.sarvam.ai`) |
| `SARVAM_BASE_URL` | Base URL for Sarvam Core APIs (`https://api.sarvam.ai`). | Optional | Sarvam client | Defaults to `https://api.sarvam.ai` |
| `SARVAM_WEBHOOK_SECRET` | Secret key for timing-safe HMAC-SHA256 webhook validation. | **YES** (Prod) | `/api/webhooks/sarvam` | Sarvam Samvaad Webhook Settings |
| `SARVAM_VOICE_AGENT_API_KEY` | API key for Sarvam Voice Agents (Samvaad platform). | **YES** (for Voice Agents) | `SarvamVoiceAgentClient` | Sarvam Samvaad Platform Console |
| `SARVAM_VOICE_AGENT_WORKSPACE_ID` | Workspace identifier in Sarvam Samvaad. | **YES** (for Voice Agents) | `daya-agent-config.ts` | Sarvam Samvaad Organization dashboard |
| `SARVAM_VOICE_AGENT_ORG_ID` | Organization identifier in Sarvam Samvaad. | **YES** (for Voice Agents) | `daya-agent-config.ts` | Sarvam Samvaad Organization dashboard |
| `SARVAM_VOICE_AGENT_ID` | Deployment agent ID for Daya Hospital assistant. | **YES** (for Voice Agents) | `daya-agent-config.ts` | Sarvam Samvaad Deployments panel |
| `CONVERSATION_ENGINE_MODE` | Active speech mode (`SARVAM_CORE_CUSTOM` or `SARVAM_VOICE_AGENTS`). | Optional | Media Gateway, Voice router | Defaults to `"SARVAM_CORE_CUSTOM"` |
| `DAYA_HMS_BASE_URL` | Base URL of Daya Hospital's Grandis HMS API. | **YES** (Prod) | `GrandisHmsAdapter`, `DayaHmsClient` | Daya Hospital IT Network Administration |
| `DAYA_HMS_API_KEY` | Authentication bearer/header key for Grandis HMS. | **YES** (Prod) | `GrandisHmsAdapter` | Daya Hospital IT Administration |
| `DAYA_HMS_TIMEOUT_MS` | Timeout threshold for HMS HTTP requests in ms (3000). | Optional | `DayaHmsClient` | Defaults to `3000` |
| `HMS_ENVIRONMENT` | Set to `"simulation"` to enable offline mock sandbox for tests. | Development Only | HMS Client factory | Manually configured for offline testing |
| `DAYA_HMS_SIMULATION` | Boolean alternative flag for simulation mode (`true`/`false`). | Development Only | HMS Client factory | Manually configured for offline testing |
| `NEXTAUTH_SECRET` | Cryptographic secret for signing session tokens. | **YES** | `src/lib/auth/session.ts` | Generate via `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Canonical URL of web dashboard (e.g., `http://localhost:3000`). | **YES** | Next.js server actions, Auth cookies | Set to localhost in dev, Railway URL in prod |

---

## 2. Environment Matrix: Local vs. Production

| Subsystem | Local Development (`.env.local`) | Railway Production (Container Secrets) |
|---|---|---|
| **Database** | Local Postgres or shared Neon development branch | Production Neon PgBouncer pooled connection |
| **HMS Connectivity** | `HMS_ENVIRONMENT="simulation"` (Offline unit tests) | Real Grandis Base URL & API Key via Hospital IPSec VPN |
| **Media Gateway** | `localhost:8080` (or integrated mock mode) | Port `8080` mapped to public TLS edge proxy |
| **Telephony Calls** | Synthetic test scripts (`scripts/validation/`) | Live Exotel virtual DID trunk (`08047291658`) |
| **Sarvam Voice** | Real Sarvam API key or mock sandbox | Real Sarvam production subscription credentials |

---

## 3. Configuration Security Checklist

1. **Never commit `.env` or `.env.local`:** Check `.gitignore` before every commit.
2. **Never prefix secrets with `NEXT_PUBLIC_`:** In Next.js, variables prefixed with `NEXT_PUBLIC_` are baked into client-side JavaScript bundles and visible to callers. All Smrkomed secrets are strictly server-side.
3. **Secret Rotation Protocol:** If any API key is accidentally logged or exposed, follow the rotation procedures documented in [15-security-and-access-handover.md](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/docs/developer-handover/15-security-and-access-handover.md).
