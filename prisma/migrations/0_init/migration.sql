-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'CALL_REVIEWER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DEACTIVATED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('ANSWERED', 'BUSY', 'MISSED', 'TRANSFERRED', 'FAILED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "CallSource" AS ENUM ('IVR_ROLLOVER', 'DIRECT_HOTLINE', 'OFF_HOURS');

-- CreateEnum
CREATE TYPE "CallLanguage" AS ENUM ('MALAYALAM', 'MANGLISH', 'ENGLISH');

-- CreateEnum
CREATE TYPE "IntentCategory" AS ENUM ('APPOINTMENT_BOOKING', 'DOCTOR_AVAILABILITY', 'DEPARTMENT_ENQUIRY', 'CONSULTATION_FEES', 'HOSPITAL_TIMINGS', 'EMERGENCY_AMBULANCE', 'INSURANCE_TPA', 'GENERAL_QUERY');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'IN_PROGRESS', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('CHECK_DOCTOR_SLOT', 'BOOK_APPOINTMENT', 'RESCHEDULE_APPOINTMENT', 'CANCEL_APPOINTMENT', 'TRANSFER_CALL_TO_STAFF', 'FEE_ENQUIRY', 'DEPARTMENT_ROUTING', 'GENERAL_ASSISTANCE');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('REQUESTED', 'IN_PROGRESS', 'CONFIRMED', 'FAILED', 'PENDING_VERIFICATION', 'REQUIRES_STAFF_FOLLOW_UP', 'CANCELLED');

-- CreateEnum
CREATE TYPE "KnowledgeStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "IntegrationHealth" AS ENUM ('HEALTHY', 'DEGRADED', 'DOWN');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "PriorityLevel" AS ENUM ('URGENT', 'HIGH', 'NORMAL', 'LOW');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CALL_REVIEWER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "department" TEXT NOT NULL,
    "employeeId" TEXT,
    "phone" TEXT,
    "canAccessRecordings" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "isAllowed" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallRecord" (
    "id" TEXT NOT NULL,
    "externalCallId" TEXT,
    "telephonySessionId" TEXT,
    "callerNumber" TEXT NOT NULL,
    "callerName" TEXT,
    "patientUhid" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "callStatus" "CallStatus" NOT NULL DEFAULT 'ANSWERED',
    "callSource" "CallSource" NOT NULL DEFAULT 'IVR_ROLLOVER',
    "language" "CallLanguage" NOT NULL DEFAULT 'MALAYALAM',
    "intentCategory" "IntentCategory" NOT NULL DEFAULT 'GENERAL_QUERY',
    "aiSummary" TEXT NOT NULL,
    "aiConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0.95,
    "requiresFollowUp" BOOLEAN NOT NULL DEFAULT false,
    "followUpStatus" "FollowUpStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "followUpNotes" TEXT,
    "assignedStaff" TEXT,
    "hmsTransactionRef" TEXT,
    "isReviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranscriptEntry" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "speaker" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "textMalayalam" TEXT,
    "timestampMs" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION,
    "sentiment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TranscriptEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordingMetadata" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "externalSessionId" TEXT,
    "storageKey" TEXT,
    "storageUrl" TEXT,
    "mimeType" TEXT NOT NULL DEFAULT 'audio/webm;codecs=opus',
    "durationSeconds" INTEGER NOT NULL,
    "fileSizeBytes" INTEGER,
    "hasConsent" BOOLEAN NOT NULL DEFAULT true,
    "retentionExpiry" TIMESTAMP(3) NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecordingMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAction" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "actionType" "ActionType" NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'REQUESTED',
    "idempotencyKey" TEXT NOT NULL,
    "externalReference" TEXT,
    "doctorName" TEXT,
    "department" TEXT,
    "appointmentSlot" TEXT,
    "patientUhid" TEXT,
    "patientName" TEXT,
    "failureReason" TEXT,
    "staffNotes" TEXT,
    "payloadJson" TEXT,
    "responseJson" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionEvent" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "hmsResponseCode" TEXT,
    "details" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUpTask" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "callerNumber" TEXT NOT NULL,
    "callerName" TEXT,
    "reason" TEXT NOT NULL,
    "priority" "PriorityLevel" NOT NULL DEFAULT 'NORMAL',
    "status" "FollowUpStatus" NOT NULL DEFAULT 'PENDING',
    "assignedTo" TEXT,
    "notes" TEXT,
    "dueAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowUpTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeArticle" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleMalayalam" TEXT,
    "category" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentMalayalam" TEXT,
    "sourceReference" TEXT,
    "internalNotes" TEXT,
    "status" "KnowledgeStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "lastUpdatedBy" TEXT NOT NULL,
    "lastPublishedAt" TIMESTAMP(3),
    "lastPublishedBy" TEXT,
    "publishedContent" TEXT,
    "publishedContentMalayalam" TEXT,
    "hasUnpublishedChanges" BOOLEAN NOT NULL DEFAULT false,
    "syncedToSarvam" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncedAt" TIMESTAMP(3),
    "isDemoData" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeVersion" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summaryOfChanges" TEXT NOT NULL,
    "previousStatus" TEXT NOT NULL,
    "newStatus" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationHealthSnapshot" (
    "id" TEXT NOT NULL,
    "integration" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "health" "IntegrationHealth" NOT NULL DEFAULT 'HEALTHY',
    "latencyMs" INTEGER NOT NULL,
    "lastEventReceived" TIMESTAMP(3),
    "metadataJson" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationHealthSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "performedBy" TEXT NOT NULL,
    "userId" TEXT,
    "ipAddress" TEXT,
    "details" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookProcessingRecord" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "externalEventId" TEXT,
    "idempotencyKey" TEXT,
    "payloadHash" TEXT NOT NULL,
    "status" "WebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookProcessingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalSetting" (
    "id" TEXT NOT NULL DEFAULT 'default_hospital_settings',
    "retentionDays" TEXT NOT NULL DEFAULT '30',
    "enableMalayalamConsent" BOOLEAN NOT NULL DEFAULT true,
    "strictMasking" BOOLEAN NOT NULL DEFAULT true,
    "defaultStaffRecordingAccess" BOOLEAN NOT NULL DEFAULT false,
    "missedCallThreshold" INTEGER NOT NULL DEFAULT 30,
    "urgentFollowUpAlerts" BOOLEAN NOT NULL DEFAULT true,
    "emergencyCasualtyAlerts" BOOLEAN NOT NULL DEFAULT true,
    "dailyDigestEmail" BOOLEAN NOT NULL DEFAULT true,
    "hmsTimeoutThresholdMs" INTEGER NOT NULL DEFAULT 3000,
    "lastUpdatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "RolePermission_role_idx" ON "RolePermission"("role");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_role_resource_action_key" ON "RolePermission"("role", "resource", "action");

-- CreateIndex
CREATE UNIQUE INDEX "CallRecord_externalCallId_key" ON "CallRecord"("externalCallId");

-- CreateIndex
CREATE UNIQUE INDEX "CallRecord_telephonySessionId_key" ON "CallRecord"("telephonySessionId");

-- CreateIndex
CREATE INDEX "CallRecord_callerNumber_idx" ON "CallRecord"("callerNumber");

-- CreateIndex
CREATE INDEX "CallRecord_callStatus_idx" ON "CallRecord"("callStatus");

-- CreateIndex
CREATE INDEX "CallRecord_intentCategory_idx" ON "CallRecord"("intentCategory");

-- CreateIndex
CREATE INDEX "CallRecord_language_idx" ON "CallRecord"("language");

-- CreateIndex
CREATE INDEX "CallRecord_startTime_idx" ON "CallRecord"("startTime");

-- CreateIndex
CREATE INDEX "CallRecord_requiresFollowUp_idx" ON "CallRecord"("requiresFollowUp");

-- CreateIndex
CREATE INDEX "TranscriptEntry_callId_idx" ON "TranscriptEntry"("callId");

-- CreateIndex
CREATE INDEX "TranscriptEntry_timestampMs_idx" ON "TranscriptEntry"("timestampMs");

-- CreateIndex
CREATE UNIQUE INDEX "RecordingMetadata_callId_key" ON "RecordingMetadata"("callId");

-- CreateIndex
CREATE INDEX "RecordingMetadata_callId_idx" ON "RecordingMetadata"("callId");

-- CreateIndex
CREATE INDEX "RecordingMetadata_retentionExpiry_idx" ON "RecordingMetadata"("retentionExpiry");

-- CreateIndex
CREATE UNIQUE INDEX "AiAction_idempotencyKey_key" ON "AiAction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AiAction_callId_idx" ON "AiAction"("callId");

-- CreateIndex
CREATE INDEX "AiAction_status_idx" ON "AiAction"("status");

-- CreateIndex
CREATE INDEX "AiAction_actionType_idx" ON "AiAction"("actionType");

-- CreateIndex
CREATE INDEX "AiAction_idempotencyKey_idx" ON "AiAction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AiAction_requestedAt_idx" ON "AiAction"("requestedAt");

-- CreateIndex
CREATE INDEX "ActionEvent_actionId_idx" ON "ActionEvent"("actionId");

-- CreateIndex
CREATE INDEX "ActionEvent_timestamp_idx" ON "ActionEvent"("timestamp");

-- CreateIndex
CREATE INDEX "FollowUpTask_callId_idx" ON "FollowUpTask"("callId");

-- CreateIndex
CREATE INDEX "FollowUpTask_status_idx" ON "FollowUpTask"("status");

-- CreateIndex
CREATE INDEX "FollowUpTask_priority_idx" ON "FollowUpTask"("priority");

-- CreateIndex
CREATE INDEX "KnowledgeArticle_category_idx" ON "KnowledgeArticle"("category");

-- CreateIndex
CREATE INDEX "KnowledgeArticle_status_idx" ON "KnowledgeArticle"("status");

-- CreateIndex
CREATE INDEX "KnowledgeArticle_updatedAt_idx" ON "KnowledgeArticle"("updatedAt");

-- CreateIndex
CREATE INDEX "KnowledgeVersion_articleId_idx" ON "KnowledgeVersion"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeVersion_articleId_versionNumber_key" ON "KnowledgeVersion"("articleId", "versionNumber");

-- CreateIndex
CREATE INDEX "IntegrationHealthSnapshot_integration_recordedAt_idx" ON "IntegrationHealthSnapshot"("integration", "recordedAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookProcessingRecord_externalEventId_key" ON "WebhookProcessingRecord"("externalEventId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookProcessingRecord_idempotencyKey_key" ON "WebhookProcessingRecord"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WebhookProcessingRecord_provider_eventType_idx" ON "WebhookProcessingRecord"("provider", "eventType");

-- CreateIndex
CREATE INDEX "WebhookProcessingRecord_status_idx" ON "WebhookProcessingRecord"("status");

-- CreateIndex
CREATE INDEX "WebhookProcessingRecord_createdAt_idx" ON "WebhookProcessingRecord"("createdAt");

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptEntry" ADD CONSTRAINT "TranscriptEntry_callId_fkey" FOREIGN KEY ("callId") REFERENCES "CallRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordingMetadata" ADD CONSTRAINT "RecordingMetadata_callId_fkey" FOREIGN KEY ("callId") REFERENCES "CallRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAction" ADD CONSTRAINT "AiAction_callId_fkey" FOREIGN KEY ("callId") REFERENCES "CallRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionEvent" ADD CONSTRAINT "ActionEvent_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "AiAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpTask" ADD CONSTRAINT "FollowUpTask_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpTask" ADD CONSTRAINT "FollowUpTask_callId_fkey" FOREIGN KEY ("callId") REFERENCES "CallRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeVersion" ADD CONSTRAINT "KnowledgeVersion_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "KnowledgeArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

