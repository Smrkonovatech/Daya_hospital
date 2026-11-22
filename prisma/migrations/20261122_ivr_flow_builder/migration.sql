-- CreateEnum
CREATE TYPE "IvrFlowStatus" AS ENUM ('DRAFT', 'VALIDATED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ExotelDeploymentStatus" AS ENUM ('SMRKOMED_DRAFT', 'VALIDATED', 'PUBLISHED_INTERNALLY', 'EXOTEL_MAPPING_REQUIRED', 'EXOTEL_MAPPING_VERIFIED', 'ACTIVE');

-- CreateTable
CREATE TABLE IF NOT EXISTS "IvrFlow" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "IvrFlowStatus" NOT NULL DEFAULT 'DRAFT',
    "deploymentStatus" "ExotelDeploymentStatus" NOT NULL DEFAULT 'SMRKOMED_DRAFT',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "nodesJson" JSONB NOT NULL,
    "edgesJson" JSONB NOT NULL,
    "variablesJson" JSONB,
    "exotelAppletId" TEXT,
    "exotelAppletName" TEXT,
    "exotelEndpointUrl" TEXT,
    "exotelVerifiedAt" TIMESTAMP(3),
    "lastUpdatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IvrFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "IvrFlowVersion" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "IvrFlowStatus" NOT NULL DEFAULT 'PUBLISHED',
    "deploymentStatus" "ExotelDeploymentStatus" NOT NULL DEFAULT 'PUBLISHED_INTERNALLY',
    "changelog" TEXT,
    "snapshotJson" JSONB NOT NULL,
    "publishedBy" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IvrFlowVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "IvrFlowExecutionSession" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "callSid" TEXT,
    "callerNumber" TEXT,
    "hospitalId" TEXT NOT NULL,
    "currentNodeId" TEXT NOT NULL,
    "variables" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "executionLog" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IvrFlowExecutionSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IvrFlow_hospitalId_status_idx" ON "IvrFlow"("hospitalId", "status");
CREATE INDEX IF NOT EXISTS "IvrFlow_hospitalId_isDefault_idx" ON "IvrFlow"("hospitalId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "IvrFlowVersion_flowId_versionNumber_key" ON "IvrFlowVersion"("flowId", "versionNumber");
CREATE INDEX IF NOT EXISTS "IvrFlowVersion_flowId_versionNumber_idx" ON "IvrFlowVersion"("flowId", "versionNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IvrFlowExecutionSession_flowId_versionNumber_idx" ON "IvrFlowExecutionSession"("flowId", "versionNumber");
CREATE INDEX IF NOT EXISTS "IvrFlowExecutionSession_callSid_idx" ON "IvrFlowExecutionSession"("callSid");
CREATE INDEX IF NOT EXISTS "IvrFlowExecutionSession_hospitalId_status_idx" ON "IvrFlowExecutionSession"("hospitalId", "status");

-- AddForeignKey
ALTER TABLE "IvrFlowVersion" ADD CONSTRAINT "IvrFlowVersion_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "IvrFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IvrFlowExecutionSession" ADD CONSTRAINT "IvrFlowExecutionSession_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "IvrFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
