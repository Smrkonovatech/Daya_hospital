# 05 — Database Architecture & Data Model

This document details the database architecture, Prisma ORM schema, table relationships, migrations, and tenant isolation mechanisms of **Smrkomed / Daya Hospital**.

---

## 1. Database Infrastructure

- **Engine:** PostgreSQL 16 (Serverless).
- **Cloud Provider:** Neon Serverless PostgreSQL.
- **Geographic Region:** AWS `ap-southeast-1` (Singapore) — strategically co-located with Exotel's Singapore media servers and regional telecom links.
- **Connection Modes:**
  - **Pooled Connection (`DATABASE_URL`):** Utilizes Neon's built-in PgBouncer connection pooler on port `6543` with `sslmode=require&pgbouncer=true`. Used by the Next.js runtime and persistent media gateway.
  - **Direct Connection (`DIRECT_URL`):** Direct TCP connection to PostgreSQL on port `5432`. Required exclusively for running Prisma CLI migrations (`npx prisma migrate deploy`).
- **ORM:** Prisma `6.19.3` (`@prisma/client` and `prisma`).

---

## 2. Complete Entity-Relationship (ER) Diagram

```mermaid
erDiagram
    Hospital ||--o{ User : "employs"
    Hospital ||--o{ HospitalSetting : "configures"
    Hospital ||--o{ HospitalConfigVersion : "publishes"
    Hospital ||--o{ CallRecord : "records"
    Hospital ||--o{ AiAgent : "deploys"
    Hospital ||--o{ IvrFlow : "routes"
    Hospital ||--o{ StaffPresence : "tracks"
    Hospital ||--o{ AiOverflowLog : "logs"

    User ||--o{ RolePermission : "holds permissions"
    User ||--o{ StaffPresence : "sets presence"

    CallRecord ||--o{ TranscriptEntry : "contains dialog"
    CallRecord ||--o| RecordingMetadata : "links audio"
    CallRecord ||--o{ AiAction : "executes tools"
    CallRecord ||--o{ FollowUpTask : "triggers followups"

    AiAction ||--o{ ActionEvent : "logs execution"

    AiAgent ||--o{ AiAgentVersion : "version control"
    IvrFlow ||--o{ IvrFlowVersion : "version control"
    IvrFlow ||--o{ IvrFlowExecutionSession : "executes calls"

    KnowledgeArticle ||--o{ KnowledgeVersion : "version control"
    StaffPresence ||--o{ StaffPresenceAuditLog : "audits shifts"
```

---

## 3. Database Model Catalog (29 Models)

The models in [prisma/schema.prisma](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/prisma/schema.prisma) are organized into 8 functional domains:

### 3.1 Authentication & Staff Role Management
1. **`User`:** Hospital staff accounts, administrators, receptionists, and clinical auditors. Contains `email`, `passwordHash`, `role` (`SUPER_ADMIN`, `HOSPITAL_ADMIN`, `RECEPTIONIST`, `CLINICAL_AUDITOR`), `hospitalId`, and `canAccessRecordings`.
2. **`RolePermission`:** Granular feature permissions mapped to roles per hospital tenant.

### 3.2 Telephony, Call Records & Transcripts
3. **`CallRecord`:** Master record for every inbound and outbound telephone call. Stores `hospitalId`, `externalCallId` (Exotel `CallSid`), `callerNumber` (E.164), `dialedNumber`, `direction`, `callStatus` (`COMPLETED`, `BUSY`, `NO_ANSWER`, `FAILED`), `durationSeconds`, `language`, `intentCategory`, `aiSummary`, `triageLevel`, and `requiresFollowUp`.
4. **`TranscriptEntry`:** Turn-by-turn conversational exchanges between `CALLER` and `AI_AGENT` or `HUMAN_STAFF`. Stores `text`, `confidence`, `language`, `isEmergency`, and millisecond timestamps.
5. **`RecordingMetadata`:** Audio recording catalog. Stores `storageUrl` (carrier media URL), `durationSeconds`, `mimeType`, `fileSizeBytes`, `hasConsent`, and retention expiry dates.

### 3.3 Clinical Actions & Follow-Up Tasks
6. **`AiAction`:** Clinical tool invocations triggered during calls (`BOOK_APPOINTMENT`, `CHECK_AVAILABILITY`, `RESCHEDULE_APPOINTMENT`, `CANCEL_APPOINTMENT`, `EMERGENCY_ESCALATE`). Stores `inputPayload`, `outputPayload`, execution latency, and `isSimulated` boolean.
7. **`ActionEvent`:** Step-by-step lifecycle telemetry for each action (validation, HMS gateway dispatch, completion, retry).
8. **`FollowUpTask`:** Operational tasks created for front-desk staff when caller requests manual callback or HMS booking requires manual review.

### 3.4 Multi-Tenant Hospital Configuration & Versioning
9. **`Hospital`:** Core tenant directory storing hospital name, short name, city, state, verification status, and default telephony provider.
10. **`HospitalSetting`:** Tenant key-value settings store for telephony credentials, SIP gateways, and integration flags.
11. **`HospitalConfigDraft`:** Working draft configuration for hospital administrators before publishing.
12. **`HospitalConfigVersion`:** Immutable published configuration snapshots storing routing parameters, emergency flags, and changelogs.
13. **`ConfigAuditLog`:** Audit trail recording who published or rolled back hospital configuration versions.

### 3.5 AI Agent & Prompt Management
14. **`AiAgent`:** Configuration profiles for AI voicebots. Stores STT model (`saaras:v4`), LLM model (`sarvam-105b-conversations`), TTS model (`bulbul:v3`), speech pace (`1.15x`), clinical system prompts, and tool access flags.
15. **`AiAgentVersion`:** Immutable version snapshots for AI agent configurations.

### 3.6 IVR Flow Builder & Session Execution
16. **`IvrFlow`:** Visual IVR tree definitions storing node structures, DTMF branch mappings, and fallback rules in `flowJson`.
17. **`IvrFlowVersion`:** Immutable version snapshots of IVR flows.
18. **`IvrFlowExecutionSession`:** In-flight IVR call state tracking the active node, user DTMF inputs, and hop count.
19. **`EmergencyEvent`:** High-priority clinical incident record created when acute emergency triage triggers.
20. **`EmergencyRoutingConfig`:** Dedicated configuration for emergency casualty numbers, bypass rules, and fail-closed flags.
21. **`FlowInvocation`:** Call analytics tracking IVR tree entry, exit, and drop-off nodes.
22. **`FlowAuditEvent`:** Audit history of IVR tree modifications.

### 3.7 Staff Presence & AI Overflow
23. **`StaffPresence`:** Real-time state of hospital receptionists (`AVAILABLE`, `ON_CALL`, `BREAK`, `OFFLINE`) with heartbeat tracking.
24. **`StaffPresenceAuditLog`:** Audit history of receptionist presence changes and shift intervals.
25. **`AiOverflowLog`:** Telephony overflow ledger tracking calls that rolled over to AI when receptionists were busy, recording wait times and trigger reasons.

### 3.8 Observability & Distributed Concurrency
26. **`IntegrationHealthSnapshot`:** Periodic health check snapshots for Exotel, Sarvam, and Grandis HMS.
27. **`AuditLog`:** System-wide security audit trail tracking administrative actions and IP addresses.
28. **`WebhookProcessingRecord`:** Idempotency ledger preventing duplicate processing of carrier webhooks (`CallSid` deduplication).
29. **`DurableIdempotencyRecord`** & **`DurableRateLimitBucket`:** Distributed concurrency locks preventing double-booking in HMS.

---

## 4. Migration History & Database Management

### 4.1 Migration Inventory
The repository contains 7 chronological SQL migrations in `prisma/migrations/`:

| Migration Folder | Date | Scope & Changes |
|---|---|---|
| `0_init` | Baseline | Initial schema: User, RolePermission, CallRecord, Transcript, RecordingMetadata, KnowledgeArticle, AuditLog. |
| `20261121_exotel_telephony` | 2026-11-21 | Added Exotel webhook processing, telephony provider settings, and recording metadata fields. |
| `20261122_hospital_config_and_ai_agents` | 2026-11-22 | Multi-tenant Hospital models, AiAgent configurations, and version snapshot tables. |
| `20261122_ivr_flow_builder` | 2026-11-22 | Visual IVR flow models, execution sessions, and node definitions. |
| `20261123_multi_tenant_flow_orchestration` | 2026-11-23 | Emergency routing configs, flow invocations, and subflow support. |
| `20261126_staff_presence` | 2026-11-26 | StaffPresence and StaffPresenceAuditLog tables for receptionist tracking. |
| `20261126_ai_overflow` | 2026-11-26 | AiOverflowLog table for tracking reception overflow to SMRKO VOICE. |

---

## 5. Developer Guide: Database Operations

### 5.1 Connecting to the Database
Obtain the Neon credentials from Railway or the team lead. Set both URLs in your local `.env`:
```env
# Pooled connection for queries
DATABASE_URL="postgresql://user:password@ep-project-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true"

# Direct connection for migrations
DIRECT_URL="postgresql://user:password@ep-project.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
```

### 5.2 Safe Migration Workflow
1. Make declarative changes in [prisma/schema.prisma](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/prisma/schema.prisma).
2. Validate syntax and format:
   ```bash
   npx prisma format
   ```
3. Generate a new migration in development:
   ```bash
   npx prisma migrate dev --name describe_your_change
   ```
4. Deploy migrations to staging or production:
   ```bash
   npx prisma migrate deploy
   ```
5. Regenerate Prisma Client:
   ```bash
   npx prisma generate
   ```

### 5.3 Inspecting Database State
Run Prisma Studio for a visual browser interface:
```bash
npx prisma studio
```
Access at `http://localhost:5555`.

---

## 6. Tenant Isolation Guarantees

Every query in Smrkomed enforces multi-tenant boundaries:
1. **Mandatory Foreign Key:** Every call, agent, setting, and log record contains a mandatory `hospitalId` column.
2. **Database Queries:** Services in `src/lib/services/` strictly include `where: { hospitalId }` on all reads and writes.
3. **Telephony Ingress Gate:** Telephony webhooks resolve the tenant via the dialed ExoPhone (`CallTo`) or verified session token. If an unauthenticated request provides a mismatched `hospitalId`, the gateway rejects it with HTTP 403 `TENANT_MISMATCH_FORBIDDEN`.
