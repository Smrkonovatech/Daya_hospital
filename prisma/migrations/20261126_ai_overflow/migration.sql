-- CreateEnum
CREATE TYPE "AiOverflowReason" AS ENUM ('RECEPTIONIST_BUSY', 'RING_TIMEOUT', 'RECEPTIONIST_OFFLINE', 'RECEPTIONIST_BREAK', 'NO_STAFF_CONFIGURED', 'CONCURRENCY_CONFLICT', 'MANUAL_OVERFLOW');

-- CreateTable
CREATE TABLE "AiOverflowLog" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "callSid" TEXT NOT NULL,
    "callerNumber" TEXT NOT NULL,
    "dialedNumber" TEXT,
    "reason" "AiOverflowReason" NOT NULL,
    "targetStaffUserId" TEXT,
    "targetStaffName" TEXT,
    "ringDurationSeconds" INTEGER,
    "handledByAi" BOOLEAN NOT NULL DEFAULT true,
    "context" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiOverflowLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiOverflowLog_hospitalId_timestamp_idx" ON "AiOverflowLog"("hospitalId", "timestamp");

-- CreateIndex
CREATE INDEX "AiOverflowLog_callSid_idx" ON "AiOverflowLog"("callSid");

-- CreateIndex
CREATE INDEX "AiOverflowLog_reason_idx" ON "AiOverflowLog"("reason");
