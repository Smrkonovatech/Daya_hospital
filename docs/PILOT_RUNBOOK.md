# Daya General Hospital AI Calling Dashboard — Controlled Pilot Runbook & Operational Guide

## 1. Executive Summary & Purpose

This document provides operational instructions, deployment procedures, safety controls, integration incident playbooks, and rollback plans for launching the controlled pilot of the **Daya General Hospital AI Calling Operations Dashboard**.

The system connects hospital telephony overflow (busy lines / 20-second ring timeouts across 6 front-desk agent stations) to a Malayalam-speaking AI voice assistant powered by Sarvam AI. It verifies appointment transactions against the Daya Hospital Management System (HMS), records audit trails, and flags ambiguous or complex clinical queries for human follow-up.

---

## 2. Environment Variable Checklist

All variables are server-side only. **Never commit actual production values to Git or prefix them with `NEXT_PUBLIC_`.**

| Variable Name | Required For | Format / Example | Notes |
|---|---|---|---|
| `DATABASE_URL` | PostgreSQL Prisma | `postgresql://user:pass@host:5432/daya_ai_calling?schema=public` | Required in production; runs in-memory sandbox if omitted. |
| `NEXTAUTH_SECRET` | Auth Token Encryption | `base64-32-byte-string` | Generated with `openssl rand -base64 32`. |
| `NEXTAUTH_URL` | NextAuth Root URL | `https://calling-console.dayahospital.com` | Base domain of operations dashboard. |
| `SARVAM_API_KEY` | Sarvam AI API Gateway | `sk_sarvam_live_...` | Production subscription key from Sarvam developer console. |
| `SARVAM_BASE_URL` | Sarvam API Base | `https://api.sarvam.ai` | Default official REST endpoint. |
| `SARVAM_AGENT_ID` | Voice Deployment ID | `agent_sarvam_malayalam_dgh_v1` | Published Malayalam voice agent ID. |
| `SARVAM_WEBHOOK_SECRET` | HMAC Signature Key | `whsec_sarvam_...` | Key used for timing-safe HMAC-SHA256 verification. |
| `DAYA_HMS_BASE_URL` | Core Hospital HMS API | `https://hms-api.dayahospital.internal` | Internal hospital network gateway URL. |
| `DAYA_HMS_API_KEY` | HMS Auth Token | `Bearer token or API key` | Service account token provisioned by hospital IT. |
| `DAYA_HMS_TIMEOUT_MS` | HMS Circuit Breaker | `3000` | Timeout threshold before status verification fallback. |
| `TELEPHONY_PROVIDER` | PBX / PRI Identifier | `DAYA_PBX_SIP_TRUNK` | Telephony system name. |
| `TELEPHONY_SIP_GATEWAY` | PBX SIP Host | `sip.dayahospital.internal:5060` | On-premise PBX SIP IP/FQDN. |
| `TELEPHONY_API_KEY` | PBX API Token | `telephony_secret_token` | Token for call divert / warm transfer requests. |
| `TELEPHONY_TRUNK_CHANNELS` | Concurrency Limit | `30` | Maximum simultaneous channels on PRI trunk. |
| `TELEPHONY_FALLBACK_EXTENSION` | Casualty Hotline | `101` | 24/7 Emergency & Casualty trauma desk. |

---

## 3. Database Migration & Initialization

### Prerequisites
- PostgreSQL 15+ installed and running.
- Network access from dashboard host to PostgreSQL port 5432.

### Step-by-Step Migration
1. Set the target connection string:
   ```bash
   export DATABASE_URL="postgresql://postgres:secure_password@localhost:5432/daya_ai_calling?schema=public"
   ```
2. Run database migrations:
   ```bash
   npx prisma migrate deploy
   ```
   *Note: For fresh installations, execute `prisma/migrations/0_init/migration.sql` directly or apply via Prisma.*
3. Seed default roles, system permissions, and initial admin accounts:
   ```bash
   npm run db:seed
   ```
4. Verify schema health:
   ```bash
   npx prisma db pull --print
   ```

---

## 4. Production Deployment Instructions

### Node.js / Container Deployment
1. Build production bundle with strict TypeScript verification:
   ```bash
   npm run build
   ```
2. Verify all unit and integration tests pass:
   ```bash
   npm test
   ```
3. Start the production HTTP service:
   ```bash
   npm start
   ```
   *(Or launch via PM2 / systemd / Docker container listening on port 3000)*.
4. Configure reverse proxy (Nginx or Caddy) with TLS 1.3:
   - Proxy pass to `http://127.0.0.1:3000`.
   - Forward headers: `X-Forwarded-For`, `X-Forwarded-Proto`, `Host`.
   - Enforce HTTPS and HSTS headers.

---

## 5. Backup, Retention and Recovery Considerations

1. **Database Automated Backups**:
   - Schedule daily automated `pg_dump` snapshots at 02:00 AM IST.
   - Retain daily backups for 30 days in encrypted cloud/cold storage.
2. **Audio Recording Retention**:
   - Default retention policy: 30 days (configurable in Dashboard Settings between 15 and 90 days).
   - Audio files must be stored in private, signed-access storage (e.g. AWS S3 with KMS or local encrypted NFS).
   - Direct public access to raw audio URLs is forbidden.
3. **Restoration Runbook**:
   - In case of database failure, restore latest snapshot:
     ```bash
     psql -U postgres -d daya_ai_calling < /backup/daya_ai_calling_20261027.sql
     ```
   - Re-run `npx prisma migrate deploy` to ensure schema consistency.

---

## 6. Logging and Monitoring Configuration

1. **Structured Health Check**:
   - Monitor `GET /api/integrations/status` via Prometheus / Uptime Kuma every 60 seconds.
   - Alerts trigger if `allHealthy === false` or latency exceeds 2,500 ms.
2. **Audit Trails**:
   - Every administrative action (login, logout, user creation, password change, knowledge article publish, HMS verification) is recorded in the `AuditLog` table with IP address, performer, and timestamp.
3. **Privacy Redaction**:
   - Phone numbers are masked in all application logs (`+91 94471 •••••`).
   - Passwords, webhook HMAC secrets, and HMS bearer tokens are never output to standard log streams.

---

## 7. Integration Incident Procedures

### A. Sarvam Voice Agent Failure / Degraded Service
- **Symptom:** AI calls disconnect, response latency > 3,000 ms, or webhook errors.
- **Immediate Action:**
  1. PBX automatically detects failure and halts rollover routing.
  2. All incoming calls remain on the front-desk ring group (`201-206`).
  3. If all front-desk lines are busy, overflow routes directly to **Casualty (Ext 101)**.
  4. Hospital IT switches Sarvam Voice adapter to maintenance mode in Settings.

### B. Daya HMS Gateway Outage
- **Symptom:** Appointment lookups or bookings return `HMS_TIMEOUT` or 504.
- **Safety Policy:**
  - The AI assistant **declines** speculative appointment confirmations.
  - The AI informs the patient in Malayalam: *"ബുക്കിംഗ് സിസ്റ്റം ഇപ്പോൾ താല്ക്കാലികമായി അപ്ഡേറ്റ് ചെയ്തുകൊണ്ടിരിക്കുകയാണ്. അല്പസമയത്തിനകം ഞങ്ങളുടെ സ്റ്റാഫ് താങ്കളെ വിളിക്കുന്നതായിരിക്കും."* (The booking system is currently updating. Our staff will call you shortly.)
  - A high-priority follow-up ticket is dispatched to the staff queue.

### C. Telephony Forwarding Loop Detection
- **Symptom:** Call bounces between agent line and AI repeatedly.
- **Safety Policy:**
  - Telephony adapter enforces `X-Daya-Hop-Count >= 1`.
  - Re-forwarding to AI is immediately blocked; call is forced directly to **Extension 101 (Casualty)**.

---

## 8. Rollback Plan

If unexpected failures occur during the controlled pilot:
1. **PBX Telephony Cutoff (< 2 minutes)**:
   - On the PBX console, disable the hunt group rollover rule to `sip:sarvam-malayalam@...`.
   - Calls revert 100% to traditional 6-agent answering lines.
2. **Application Rollback**:
   - Revert deployment to previous stable Git tag:
     ```bash
     git checkout tags/v0.8.0-pre-pilot
     npm install
     npm run build
     pm2 restart daya-dashboard
     ```
3. **Data Preservation**:
   - Database entries created during the pilot remain preserved for audit and post-mortem analysis.

---

## 9. Controlled Pilot Checklist

- [ ] PostgreSQL production database online and reachable.
- [ ] Database schema deployed via `prisma migrate deploy`.
- [ ] Initial hospital administrator account activated.
- [ ] Production `.env.local` configured with authorized credentials.
- [ ] PBX ring timeout set to 20 seconds.
- [ ] Casualty fallback extension `101` verified with PBX dial test.
- [ ] Sarvam Malayalam voice agent tested with test phone calls.
- [ ] HMS doctor OPD schedules and token quotas loaded.
- [ ] Front-desk staff trained on the Follow-Up Queue and Action Drawer.
- [ ] Privacy consent announcement verified in Malayalam.

---

## 10. Required Production Credentials and Approvals

| Integration | Required Item | Current Status |
|---|---|---|
| **Sarvam AI** | Live Subscription Key & Agent ID | Sandbox Mock active; awaiting production API key from Sarvam console. |
| **Daya HMS** | Core API Gateway Base URL & Token | Mock adapter active; awaiting hospital IT endpoint authorization. |
| **PBX Telephony** | SIP Trunk trunking credentials & IP route | Verified in mock/architecture; awaiting physical PBX route mapping. |
| **Medical Administration**| Formal sign-off on Malayalam clinical FAQ | Initial approved articles loaded; pending medical director pilot approval. |
