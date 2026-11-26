# SMRKOMED — DATABASE SCHEMA & DATA MODEL DOCUMENTATION

This document provides a comprehensive technical reference for the PostgreSQL relational database powering Smrkomed, managed via Prisma ORM and hosted on Neon Serverless PostgreSQL (`ap-southeast-1`).

---

## 1. Database Architecture & Engine

- **Database Engine:** PostgreSQL 16 on Neon Serverless.
- **ORM:** Prisma Client `6.0.0` (`@prisma/client 6.0.0`).
- **Connection Strategy:** Two connection strings:
  1. `DATABASE_URL`: Connection pooler URL (PgBouncer port `6543`) for application requests.
  2. `DIRECT_URL`: Direct PostgreSQL connection URL (port `5432`) for running schema migrations.
- **Total Relational Models:** 29 models.
- **Total Custom Enums:** 17 PostgreSQL enum types.
- **Migration History:** 5 sequential migrations under `prisma/migrations/`:
  1. `0_init`: Initial baseline (users, call records, transcripts, actions, knowledge).
  2. `20261121_exotel_telephony`: Exotel telephony models and carrier metadata.
  3. `20261122_hospital_config_and_ai_agents`: Hospital config drafts, versions, and AI agents.
  4. `20261122_ivr_flow_builder`: Visual IVR canvas flows, versions, and executions.
  5. `20261123_multi_tenant_flow_orchestration`: Multi-tenant routing, emergency casualty configs, and durable idempotency.

---

## 2. Core Relational Models & Schema Catalog

### 2.1 Identity, Staff & Tenant Core
1. **`Hospital`**
   - **Purpose:** Represents a hospital tenant entity (e.g. Daya General Hospital).
   - **Fields:** `id` (e.g. `hosp_daya_thrissur`), `name`, `code`, `timezone`, `createdAt`, `updatedAt`.
   - **Relations:** 1-to-many with `User`, `CallRecord`, `HospitalSetting`, `HospitalConfigDraft`, `HospitalConfigVersion`, `AiAgent`, `IvrFlow`, `EmergencyEvent`.
2. **`User`**
   - **Purpose:** Hospital administrative and clinical staff accounts.
   - **Fields:** `id`, `hospitalId`, `email`, `passwordHash`, `salt`, `name`, `role` (`UserRole`), `status` (`UserStatus`), `department`, `phoneNumber`.
   - **Indexes:** Unique on `email`, index on `[hospitalId, status]`.
3. **`RolePermission`**
   - **Purpose:** Fine-grained role permission assignments for access control.
   - **Fields:** `id`, `role`, `permission`, `resource`, `action`.

### 2.2 Telephony, Call Sessions & Transcripts
4. **`CallRecord`**
   - **Purpose:** Authoritative clinical record of every inbound and outbound telephone call.
   - **Fields:** `id`, `hospitalId`, `externalCallId` (Exotel/Sarvam CallSid), `callerNumber` (masked), `callerName`, `direction`, `callStatus`, `callSource`, `language`, `intentCategory`, `durationSeconds`, `startTime`, `endTime`, `aiSummary`, `aiConfidence`, `requiresFollowUp`, `followUpStatus`, `isReviewed`, `reviewedBy`, `reviewedAt`.
   - **Indexes:** Compound indexes on `[hospitalId, startTime]`, `[hospitalId, callStatus]`, `[hospitalId, intentCategory]`, unique on `externalCallId`.
5. **`TranscriptEntry`**
   - **Purpose:** Turn-by-turn conversational dialogue for a call.
   - **Fields:** `id`, `callRecordId`, `speaker` (`AI_AGENT` or `CALLER`), `speakerName`, `text`, `timestampMs`, `timestamp`, `confidence`, `language`.
   - **Indexes:** Index on `[callRecordId, timestampMs]`.
6. **`RecordingMetadata`**
   - **Purpose:** Storage pointers and metadata for call audio recordings.
   - **Fields:** `id`, `callRecordId`, `storageUrl`, `durationSeconds`, `format`, `sampleRate`, `channels`, `fileSizeBytes`.

### 2.3 Clinical Actions & Follow-ups
7. **`AiAction`**
   - **Purpose:** Clinical or administrative action extracted or triggered during a call.
   - **Fields:** `id`, `callRecordId`, `type` (`ActionType`: `BOOK_APPOINTMENT`, `CHECK_DOCTOR_SLOT`, `TRANSFER_CALL_TO_STAFF`, etc.), `status` (`ActionStatus`: `PENDING`, `CONFIRMED`, `FAILED`), `description`, `result`, `payload` (JSON), `timestamp`.
8. **`ActionEvent`**
   - **Purpose:** Audit log of lifecycle transitions on an AI action.
   - **Fields:** `id`, `actionId`, `eventType`, `previousStatus`, `newStatus`, `timestamp`, `actorId`.
9. **`FollowUpTask`**
   - **Purpose:** Clinical follow-up assignments generated for hospital nurses or front desk staff.
   - **Fields:** `id`, `callRecordId`, `hospitalId`, `title`, `description`, `priority` (`PriorityLevel`), `status` (`FollowUpStatus`), `assignedToUserId`, `dueDate`.

### 2.4 Hospital Configuration & Versioning
10. **`HospitalSetting`**
    - **Purpose:** Key-value runtime settings for hospital tenants.
    - **Fields:** `id`, `hospitalId`, `settingKey`, `settingValue`, `isSecret`, `encryptedValue`.
    - **Indexes:** Unique compound index on `[hospitalId, settingKey]`.
11. **`HospitalConfigDraft`**
    - **Purpose:** Working uncommitted configuration draft edited in the settings UI.
    - **Fields:** `id`, `hospitalId`, `draftData` (JSON), `updatedByUserId`, `updatedAt`.
    - **Indexes:** Unique on `hospitalId`.
12. **`HospitalConfigVersion`**
    - **Purpose:** Published immutable configuration snapshot with full rollback support.
    - **Fields:** `id`, `hospitalId`, `versionNumber`, `configData` (JSON), `publishedByUserId`, `publishedAt`, `changelog`, `isActive`.
    - **Indexes:** Unique on `[hospitalId, versionNumber]`, index on `[hospitalId, isActive]`.
13. **`ConfigAuditLog`**
    - **Purpose:** Audit trail of all configuration draft edits, validations, and publishes.
    - **Fields:** `id`, `hospitalId`, `action`, `actorUserId`, `details` (JSON), `timestamp`.

### 2.5 IVR Flow Builder & Execution
14. **`IvrFlow`**
    - **Purpose:** Inbound IVR call flow entity.
    - **Fields:** `id`, `hospitalId`, `name`, `description`, `status` (`IvrFlowStatus`), `isDefault`, `activeVersionNumber`.
    - **Indexes:** Index on `[hospitalId, status]`.
15. **`IvrFlowVersion`**
    - **Purpose:** Immutable snapshot of an IVR node/edge canvas graph.
    - **Fields:** `id`, `flowId`, `versionNumber`, `nodesJson` (JSON), `edgesJson` (JSON), `publishedByUserId`, `publishedAt`.
    - **Indexes:** Unique on `[flowId, versionNumber]`.
16. **`IvrFlowExecutionSession`**
    - **Purpose:** Runtime state for an in-flight call executing an IVR flow.
    - **Fields:** `id`, `callSid`, `flowId`, `flowVersionId`, `currentNodeId`, `sessionData` (JSON), `startedAt`, `endedAt`.
    - **Indexes:** Unique on `callSid`.
17. **`FlowInvocation`** & 18. **`FlowAuditEvent`**
    - **Purpose:** Step-by-step node transition history and error auditing during flow execution.

### 2.6 AI Agent Studio
19. **`AiAgent`**
    - **Purpose:** AI conversational persona entity.
    - **Fields:** `id`, `hospitalId`, `name`, `status` (`AgentStatus`), `activeVersionNumber`.
20. **`AiAgentVersion`**
    - **Purpose:** Immutable snapshot of prompt instructions, voice models, and guardrails.
    - **Fields:** `id`, `agentId`, `versionNumber`, `promptInstructions`, `voiceModel`, `languageCode`, `temperature`, `guardrails` (JSON), `publishedAt`.
    - **Indexes:** Unique on `[agentId, versionNumber]`.

### 2.7 Emergency Casualty Triage
21. **`EmergencyEvent`**
    - **Purpose:** Records acute medical emergency overrides and casualty transfers.
    - **Fields:** `id`, `hospitalId`, `callSid`, `callerPhone`, `symptomDescription`, `triageLevel` (`CRITICAL_CODE_RED`), `escalatedDestination`, `status`, `createdAt`.
    - **Indexes:** Index on `[hospitalId, createdAt]`, index on `callSid`.
22. **`EmergencyRoutingConfig`**
    - **Purpose:** Dedicated routing policies for casualty emergency desks.
    - **Fields:** `id`, `hospitalId`, `primaryCasualtyNumber`, `backupCasualtyNumber`, `triggerKeywords` (JSON).

### 2.8 Distributed Concurrency & Idempotency
23. **`DurableIdempotencyRecord`**
    - **Purpose:** Prevents duplicate carrier webhook deliveries, replayed bookings, and duplicate calls.
    - **Fields:** `id`, `hospitalId`, `idempotencyKey`, `resourceType`, `status`, `responseBody` (JSON), `expiresAt`, `createdAt`.
    - **Indexes:** Unique compound index on `[hospitalId, idempotencyKey]`, index on `expiresAt` for TTL purging.
24. **`DurableRateLimitBucket`**
    - **Purpose:** Distributed token-bucket rate limiter for outbound calling and SMS.
    - **Fields:** `id`, `hospitalId`, `bucketKey`, `tokensRemaining`, `lastRefillTime`, `maxTokens`, `refillRatePerSec`.
    - **Indexes:** Unique compound index on `[hospitalId, bucketKey]`.

### 2.9 Knowledge Base & System Health
25. **`KnowledgeArticle`** & 26. **`KnowledgeVersion`**
    - **Purpose:** Categorized hospital knowledge base articles with draft/publish workflows.
27. **`IntegrationHealthSnapshot`**
    - **Purpose:** Periodic network and API health telemetry for Exotel, Sarvam, and Neon.
28. **`WebhookProcessingRecord`**
    - **Purpose:** Inbound carrier webhook delivery auditing.
29. **`AuditLog`**
    - **Purpose:** General security and compliance audit event trail.

---

## 3. Database Schema Analysis & Findings

### Missing Models (Clinical Entities Not in Schema)
A critical discovery from the code audit is that **there are NO database models for clinical hospital entities**:
1. **`Doctor`:** Does NOT exist in schema. Currently represented as hardcoded objects in `src/lib/mock-data.ts` and `src/lib/integrations/hms/mock-adapter.ts`.
2. **`Department`:** Does NOT exist in schema. Currently hardcoded in mock adapters.
3. **`Appointment`:** Does NOT exist in schema. When an appointment is booked via `/api/v1/voice-agent/book-appointment`, it is stored only as a generic `AiAction` entry (`type: "BOOK_APPOINTMENT"`). No dedicated `Appointment` table with doctor, patient, slot, and status foreign keys exists.

### Schema Drift & Migration Health
- All 5 migrations in `prisma/migrations/` match the models in `schema.prisma`.
- Running `prisma validate` shows the schema is syntactically valid with zero drift between definitions.
- All migrations have been successfully applied to the remote Neon PostgreSQL Singapore instance.

### Potential Cross-Tenant Leakage Risks
- **Application-Layer Enforcement:** Multi-tenancy is enforced strictly in application Prisma queries (e.g. `where: { hospitalId }`).
- **Absence of PostgreSQL RLS:** PostgreSQL native Row-Level Security (RLS) policies are NOT enabled. If a developer accidentally writes a Prisma query without `where: { hospitalId }`, records from other hospitals could be returned.
- **Recommendation:** Implement PostgreSQL Row-Level Security policies tied to `SET LOCAL app.current_hospital_id` for defense-in-depth.

### Data Retention & Archival
- Currently, `CallRecord`, `TranscriptEntry`, and `WebhookProcessingRecord` have no automated TTL or archiving job. Over time with hundreds of daily hospital calls, transcript tables will grow rapidly in Neon DB.
- A scheduled cron cleanup job should be introduced to purge or archive transcripts older than the hospital's compliance retention period (e.g. 1 year).
