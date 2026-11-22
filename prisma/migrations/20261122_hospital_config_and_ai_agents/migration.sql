-- ==============================================================================
-- MIGRATION: 20261122_hospital_config_and_ai_agents
-- Purpose: Add models for HospitalConfigDraft, HospitalConfigVersion, 
--          ConfigAuditLog, DurableIdempotencyRecord, DurableRateLimitBucket,
--          AiAgent, and AiAgentVersion (Phases 2 & 3)
-- ==============================================================================

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED', 'DISABLED');

-- CreateTable HospitalConfigDraft
CREATE TABLE "HospitalConfigDraft" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "displayName" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "defaultLanguage" TEXT NOT NULL DEFAULT 'ml-IN',
    "supportedLanguages" TEXT[] DEFAULT ARRAY['ml-IN', 'en-IN']::TEXT[],
    "telephonyProvider" TEXT NOT NULL DEFAULT 'EXOTEL',
    "exotelAccountSid" TEXT,
    "exotelRegion" TEXT NOT NULL DEFAULT 'singapore',
    "exotelSubdomain" TEXT NOT NULL DEFAULT 'api.exotel.com',
    "exotelApiKeyEncrypted" TEXT,
    "exotelApiTokenEncrypted" TEXT,
    "exotelDefaultExoPhone" TEXT,
    "exotelDefaultAppId" TEXT,
    "exotelWebhookSecretEncrypted" TEXT,
    "exotelStatusCallbackUrl" TEXT,
    "incomingVirtualNumbers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "transferDestinations" JSONB,
    "emergencyDestinations" TEXT[] DEFAULT ARRAY['+919606654032']::TEXT[],
    "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "defaultSttModel" TEXT NOT NULL DEFAULT 'saaras:v4',
    "defaultLlmModel" TEXT NOT NULL DEFAULT 'sarvam-105b-conversations',
    "defaultTtsModel" TEXT NOT NULL DEFAULT 'bulbul:v3',
    "defaultSpeaker" TEXT NOT NULL DEFAULT 'kavitha',
    "defaultSpeakingPace" DOUBLE PRECISION NOT NULL DEFAULT 1.15,
    "aiSilenceTimeoutMs" INTEGER NOT NULL DEFAULT 400,
    "maxCallDurationSeconds" INTEGER NOT NULL DEFAULT 600,
    "businessHours" JSONB,
    "afterHoursBehavior" TEXT NOT NULL DEFAULT 'AI_VOICEBOT',
    "emergencyEscalationPolicy" JSONB,
    "lastUpdatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HospitalConfigDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable HospitalConfigVersion
CREATE TABLE "HospitalConfigVersion" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "changelog" TEXT,
    "publishedBy" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "configSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HospitalConfigVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable ConfigAuditLog
CREATE TABLE "ConfigAuditLog" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "performedBy" TEXT NOT NULL,
    "userId" TEXT,
    "changesSummary" TEXT,
    "oldValueJson" TEXT,
    "newValueJson" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfigAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable DurableIdempotencyRecord
CREATE TABLE "DurableIdempotencyRecord" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "callSid" TEXT,
    "callId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "responseJson" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DurableIdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable DurableRateLimitBucket
CREATE TABLE "DurableRateLimitBucket" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "bucketKey" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DurableRateLimitBucket_pkey" PRIMARY KEY ("id")
);

-- CreateTable AiAgent
CREATE TABLE "AiAgent" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "purpose" TEXT NOT NULL,
    "status" "AgentStatus" NOT NULL DEFAULT 'DRAFT',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "sttModel" TEXT NOT NULL DEFAULT 'saaras:v4',
    "llmModel" TEXT NOT NULL DEFAULT 'sarvam-105b-conversations',
    "ttsModel" TEXT NOT NULL DEFAULT 'bulbul:v3',
    "speaker" TEXT NOT NULL DEFAULT 'kavitha',
    "speakingPace" DOUBLE PRECISION NOT NULL DEFAULT 1.15,
    "defaultLanguage" TEXT NOT NULL DEFAULT 'ml-IN',
    "supportedLanguages" TEXT[] DEFAULT ARRAY['ml-IN', 'en-IN']::TEXT[],
    "greetingMalayalam" TEXT NOT NULL DEFAULT 'നമസ്കാരം, ദയ ഹോസ്പിറ്റലിലേക്ക് സ്വാഗതം. ഞാൻ ദയ എഐ അസിസ്റ്റന്റാണ്. എനിക്ക് എങ്ങനെ സഹായിക്കാനാകും?',
    "greetingEnglish" TEXT NOT NULL DEFAULT 'Hello, welcome to Daya Hospital. I am the AI assistant. How may I help you today?',
    "systemPrompt" TEXT NOT NULL,
    "promptSections" JSONB,
    "personalityTone" TEXT NOT NULL DEFAULT 'EMPATHETIC_PROFESSIONAL',
    "responseLength" TEXT NOT NULL DEFAULT 'CONCISE',
    "languageSwitchMode" TEXT NOT NULL DEFAULT 'AUTO_DETECT',
    "humanHandoffInstruction" TEXT,
    "maxDurationSeconds" INTEGER NOT NULL DEFAULT 600,
    "silenceTimeoutMs" INTEGER NOT NULL DEFAULT 400,
    "noInputBehavior" TEXT NOT NULL DEFAULT 'PROMPT_AGAIN',
    "fallbackBehavior" TEXT NOT NULL DEFAULT 'TRANSFER_CASUALTY',
    "lastUpdatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable AiAgentVersion
CREATE TABLE "AiAgentVersion" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "AgentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "changelog" TEXT,
    "snapshotJson" JSONB NOT NULL,
    "publishedBy" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiAgentVersion_pkey" PRIMARY KEY ("id")
);

-- Indices and Constraints
CREATE UNIQUE INDEX "HospitalConfigDraft_hospitalId_key" ON "HospitalConfigDraft"("hospitalId");
CREATE INDEX "HospitalConfigDraft_hospitalId_idx" ON "HospitalConfigDraft"("hospitalId");

CREATE UNIQUE INDEX "HospitalConfigVersion_hospitalId_versionNumber_key" ON "HospitalConfigVersion"("hospitalId", "versionNumber");
CREATE INDEX "HospitalConfigVersion_hospitalId_isActive_idx" ON "HospitalConfigVersion"("hospitalId", "isActive");

CREATE INDEX "ConfigAuditLog_hospitalId_timestamp_idx" ON "ConfigAuditLog"("hospitalId", "timestamp");
CREATE INDEX "ConfigAuditLog_entityType_entityId_idx" ON "ConfigAuditLog"("entityType", "entityId");

CREATE UNIQUE INDEX "DurableIdempotencyRecord_hospitalId_idempotencyKey_key" ON "DurableIdempotencyRecord"("hospitalId", "idempotencyKey");
CREATE INDEX "DurableIdempotencyRecord_hospitalId_resourceType_idx" ON "DurableIdempotencyRecord"("hospitalId", "resourceType");
CREATE INDEX "DurableIdempotencyRecord_expiresAt_idx" ON "DurableIdempotencyRecord"("expiresAt");

CREATE UNIQUE INDEX "DurableRateLimitBucket_hospitalId_bucketKey_key" ON "DurableRateLimitBucket"("hospitalId", "bucketKey");
CREATE INDEX "DurableRateLimitBucket_hospitalId_windowEnd_idx" ON "DurableRateLimitBucket"("hospitalId", "windowEnd");

CREATE INDEX "AiAgent_hospitalId_status_idx" ON "AiAgent"("hospitalId", "status");
CREATE INDEX "AiAgent_hospitalId_purpose_idx" ON "AiAgent"("hospitalId", "purpose");

CREATE UNIQUE INDEX "AiAgentVersion_agentId_versionNumber_key" ON "AiAgentVersion"("agentId", "versionNumber");
CREATE INDEX "AiAgentVersion_agentId_versionNumber_idx" ON "AiAgentVersion"("agentId", "versionNumber");

-- AddForeignKey
ALTER TABLE "AiAgentVersion" ADD CONSTRAINT "AiAgentVersion_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AiAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
