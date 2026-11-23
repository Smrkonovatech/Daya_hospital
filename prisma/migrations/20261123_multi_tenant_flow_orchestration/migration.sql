-- AlterTable IvrFlow
ALTER TABLE "IvrFlow" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'INBOUND_RECEPTION';
ALTER TABLE "IvrFlow" ADD COLUMN IF NOT EXISTS "direction" TEXT NOT NULL DEFAULT 'INBOUND';
ALTER TABLE "IvrFlow" ADD COLUMN IF NOT EXISTS "executionPriority" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "IvrFlow" ADD COLUMN IF NOT EXISTS "triggerConditions" JSONB;
ALTER TABLE "IvrFlow" ADD COLUMN IF NOT EXISTS "isEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "IvrFlow" ADD COLUMN IF NOT EXISTS "isTemplate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "IvrFlow" ADD COLUMN IF NOT EXISTS "templateCategory" TEXT;

-- CreateIndex for IvrFlow
CREATE INDEX IF NOT EXISTS "IvrFlow_hospitalId_category_idx" ON "IvrFlow"("hospitalId", "category");
CREATE INDEX IF NOT EXISTS "IvrFlow_isTemplate_idx" ON "IvrFlow"("isTemplate");

-- CreateTable EmergencyEvent
CREATE TABLE IF NOT EXISTS "EmergencyEvent" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "callSid" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "flowVersion" INTEGER NOT NULL,
    "triggerPhrase" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "detectedLanguage" TEXT NOT NULL DEFAULT 'ml-IN',
    "targetDestination" TEXT NOT NULL,
    "transferOutcome" TEXT NOT NULL DEFAULT 'INITIATED',
    "fallbackAction" TEXT,
    "callerNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "EmergencyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for EmergencyEvent
CREATE INDEX IF NOT EXISTS "EmergencyEvent_hospitalId_createdAt_idx" ON "EmergencyEvent"("hospitalId", "createdAt");
CREATE INDEX IF NOT EXISTS "EmergencyEvent_callSid_idx" ON "EmergencyEvent"("callSid");

-- CreateTable EmergencyRoutingConfig
CREATE TABLE IF NOT EXISTS "EmergencyRoutingConfig" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "casualtyNumber" TEXT NOT NULL DEFAULT '100',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "fallbackNumber" TEXT,
    "allowLiveTransfer" BOOLEAN NOT NULL DEFAULT false,
    "interruptionKeywordsMalayalam" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "interruptionKeywordsEnglish" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "interruptionKeywordsManglish" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confidenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyRoutingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for EmergencyRoutingConfig
CREATE UNIQUE INDEX IF NOT EXISTS "EmergencyRoutingConfig_hospitalId_key" ON "EmergencyRoutingConfig"("hospitalId");
CREATE INDEX IF NOT EXISTS "EmergencyRoutingConfig_hospitalId_idx" ON "EmergencyRoutingConfig"("hospitalId");

-- CreateTable FlowInvocation
CREATE TABLE IF NOT EXISTS "FlowInvocation" (
    "id" TEXT NOT NULL,
    "sessionCallSid" TEXT NOT NULL,
    "parentFlowId" TEXT NOT NULL,
    "childFlowId" TEXT NOT NULL,
    "childFlowVersion" INTEGER NOT NULL,
    "callDepth" INTEGER NOT NULL DEFAULT 1,
    "invokedFromNodeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "returnValue" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedAt" TIMESTAMP(3),

    CONSTRAINT "FlowInvocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for FlowInvocation
CREATE INDEX IF NOT EXISTS "FlowInvocation_sessionCallSid_idx" ON "FlowInvocation"("sessionCallSid");
CREATE INDEX IF NOT EXISTS "FlowInvocation_parentFlowId_idx" ON "FlowInvocation"("parentFlowId");
CREATE INDEX IF NOT EXISTS "FlowInvocation_childFlowId_idx" ON "FlowInvocation"("childFlowId");

-- CreateTable FlowAuditEvent
CREATE TABLE IF NOT EXISTS "FlowAuditEvent" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "flowVersion" INTEGER,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlowAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for FlowAuditEvent
CREATE INDEX IF NOT EXISTS "FlowAuditEvent_hospitalId_flowId_idx" ON "FlowAuditEvent"("hospitalId", "flowId");
CREATE INDEX IF NOT EXISTS "FlowAuditEvent_hospitalId_createdAt_idx" ON "FlowAuditEvent"("hospitalId", "createdAt");
