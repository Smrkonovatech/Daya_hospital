# 12 — Cloud Infrastructure & Deployment Architecture

This document details the production hosting infrastructure, PaaS configuration, database clustering, domain topology, and continuous deployment pipeline for **Smrkomed / Daya Hospital**.

---

## 1. Cloud Infrastructure Inventory

```
                         [Global Ingress / TLS 1.3]
                                     │
                                     ▼
                      [Railway Edge Proxy (Singapore)]
                                     │
                                     ▼
                [Railway Persistent Linux Container: Daya_hospital]
                   ├── Persistent Media Gateway (Node.js Port 8080)
                   └── Next.js 16 Web Application (Port 8080)
                                     │
            ┌────────────────────────┼────────────────────────┐
            │                        │                        │
            ▼                        ▼                        ▼
 [Neon Serverless PostgreSQL]   [Exotel Singapore]     [Sarvam AI Platform]
   AWS ap-southeast-1             api.exotel.com         api.sarvam.ai
   PgBouncer Pool (Port 6543)     Trunk: smrkonova1      apps.sarvam.ai
   Direct Port (Port 5432)        DID: 08047291658
```

| Infrastructure Tier | Provider | Location / Cluster | Host / Reference |
|---|---|---|---|
| **Source Control** | GitHub | `github.com` | `Smrkonovatech/Daya_hospital` (Branch `main`) |
| **Compute & Hosting** | Railway PaaS | AWS `ap-southeast-1` (Singapore) | Service Domain: `dayahospital-production-467a7d31.up.railway.app` |
| **Serverless Database** | Neon PostgreSQL | AWS `ap-southeast-1` (Singapore) | Project: `ep-project-pooler` (PostgreSQL 16) |
| **Cloud Telephony** | Exotel Cloud | Singapore Edge Gateway | Account SID: `smrkonova1` |
| **AI Speech Services** | Sarvam AI | Central India / Singapore | Core APIs & Samvaad Voice Agents Platform |

---

## 2. Railway Container & Build Configuration

The production service runs on Railway under a unified container architecture:

### 2.1 Deployment Manifest (`railway.json`)
```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "src/media-gateway/Dockerfile"
  },
  "deploy": {
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### 2.2 Dockerfile Specifications ([src/media-gateway/Dockerfile](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/media-gateway/Dockerfile))
- **Base Image:** `node:22-alpine` (lightweight, minimal attack surface).
- **Installed Tools:** `curl` (used for container healthcheck probe).
- **Execution Command:** `npx tsx src/media-gateway/server.ts`.
- **Exposed Port:** `8080` (or dynamic `$PORT`).
- **Internal Healthcheck:**
  ```dockerfile
  HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8080}/health || exit 1
  ```

---

## 3. Live Health & Observability Endpoints

The persistent media gateway exposes native HTTP health and diagnostics endpoints:

### 3.1 Health Endpoint (`GET /health`)
- **URL:** `https://dayahospital-production-467a7d31.up.railway.app/health`
- **HTTP Status:** `200 OK`
- **Payload Response:**
  ```json
  {
    "status": "ok",
    "service": "smrkomed_exotel_media_gateway",
    "readiness": "READY",
    "environmentMode": "DEVELOPMENT_TESTING",
    "readinessReason": "Development testing gateway operational. Real Sarvam AI voice and Neon PostgreSQL persistence active. Operating in development sandbox mode (demo appointments; no real patient calls).",
    "sarvamConfigured": true,
    "mode": "PRODUCTION",
    "database": {
      "configured": true,
      "connected": true,
      "provider": "neon_postgresql"
    },
    "persistenceStatus": "HEALTHY",
    "activeCalls": 0,
    "uptimeSeconds": 350,
    "port": 8080,
    "timestamp": "2026-11-26T14:11:32.834Z"
  }
  ```

### 3.2 Gateway Status & Telemetry (`GET /status`)
- **URL:** `https://dayahospital-production-467a7d31.up.railway.app/status`
- **HTTP Status:** `200 OK`
- **Includes:** Active sessions, turn latency percentiles, recent completed calls, receptionist escalations, and database persistence status (`bufferingMode: "DATABASE_DURABLE"`).

---

## 4. Continuous Deployment Pipeline

### 4.1 Automated Git Deployment Workflow
1. A developer pushes commits to `origin/main` on GitHub:
   ```bash
   git push origin main
   ```
2. Railway's GitHub webhook detects the commit.
3. Railway launches a build container, executes `src/media-gateway/Dockerfile`, generates Prisma Client, copies TypeScript source, and launches the runtime.
4. Railway edge proxy evaluates the container health probe at `/health`.
5. Once `/health` returns HTTP 200, traffic switches seamlessly with zero downtime.

### 4.2 Emergency Rollback Procedure
If a breaking deployment occurs:
1. **Option A (Via Git - Recommended):**
   ```bash
   git revert HEAD
   git push origin main
   ```
2. **Option B (Via Railway Console):**
   Navigate to the Railway project dashboard -> Select `Daya_hospital` service -> View *Deployments* tab -> Click the previous successful deployment -> Select *Rollback*.

---

## 5. Database Connection Management

Neon provides autoscaling serverless PostgreSQL:
- **Connection Limits:** Managed via PgBouncer pooling on port `6543`.
- **Idle Behavior:** Computes automatically suspend after 5 minutes of zero traffic to minimize cloud spend, waking up in < 500ms on incoming queries.
- **Resilience:** The media gateway includes an in-memory ring-buffer fallback queue ([src/media-gateway/session-manager.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/media-gateway/session-manager.ts)) that captures call records if the database experiences a brief cold-start reconnection delay, subsequently flushing buffered records once the pool reconnects.
