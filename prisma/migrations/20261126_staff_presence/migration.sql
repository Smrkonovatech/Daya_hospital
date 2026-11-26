-- CreateEnum StaffPresenceStatus
DO $$ BEGIN
  CREATE TYPE "StaffPresenceStatus" AS ENUM ('AVAILABLE', 'RINGING', 'ON_CALL', 'WRAP_UP', 'BREAK', 'OFFLINE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable StaffPresence
CREATE TABLE IF NOT EXISTS "StaffPresence" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "staffName" TEXT NOT NULL,
    "extension" TEXT,
    "phoneNumber" TEXT,
    "status" "StaffPresenceStatus" NOT NULL DEFAULT 'OFFLINE',
    "currentCallSid" TEXT,
    "assignedAt" TIMESTAMP(3),
    "ringStartedAt" TIMESTAMP(3),
    "callAnsweredAt" TIMESTAMP(3),
    "lastStatusChangeAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "callsHandledToday" INTEGER NOT NULL DEFAULT 0,
    "missedCallsToday" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffPresence_pkey" PRIMARY KEY ("id")
);

-- CreateTable StaffPresenceAuditLog
CREATE TABLE IF NOT EXISTS "StaffPresenceAuditLog" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "staffPresenceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "previousStatus" "StaffPresenceStatus" NOT NULL,
    "newStatus" "StaffPresenceStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "callSid" TEXT,
    "actor" TEXT NOT NULL DEFAULT 'SYSTEM',
    "details" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffPresenceAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "StaffPresence_hospitalId_userId_key" ON "StaffPresence"("hospitalId", "userId");
CREATE INDEX IF NOT EXISTS "StaffPresence_hospitalId_status_idx" ON "StaffPresence"("hospitalId", "status");
CREATE INDEX IF NOT EXISTS "StaffPresence_hospitalId_currentCallSid_idx" ON "StaffPresence"("hospitalId", "currentCallSid");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "StaffPresenceAuditLog_hospitalId_staffPresenceId_idx" ON "StaffPresenceAuditLog"("hospitalId", "staffPresenceId");
CREATE INDEX IF NOT EXISTS "StaffPresenceAuditLog_hospitalId_timestamp_idx" ON "StaffPresenceAuditLog"("hospitalId", "timestamp");
CREATE INDEX IF NOT EXISTS "StaffPresenceAuditLog_callSid_idx" ON "StaffPresenceAuditLog"("callSid");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "StaffPresenceAuditLog" ADD CONSTRAINT "StaffPresenceAuditLog_staffPresenceId_fkey" FOREIGN KEY ("staffPresenceId") REFERENCES "StaffPresence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
