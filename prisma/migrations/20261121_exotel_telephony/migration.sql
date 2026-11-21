-- ==============================================================================
-- MIGRATION: 20261121_exotel_telephony
-- Purpose: Add CallDirection enum, Exotel fields to CallRecord, and Hospital model
-- ==============================================================================

-- CreateEnum
CREATE TYPE "CallDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- AlterTable
ALTER TABLE "CallRecord"
ADD COLUMN "hospitalId" TEXT NOT NULL DEFAULT 'hosp_daya_thrissur',
ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'EXOTEL',
ADD COLUMN "direction" "CallDirection" NOT NULL DEFAULT 'INBOUND',
ADD COLUMN "telephonyAccountSid" TEXT,
ADD COLUMN "streamSid" TEXT,
ADD COLUMN "fromNumber" TEXT,
ADD COLUMN "toNumber" TEXT,
ADD COLUMN "failureReason" TEXT,
ADD COLUMN "recordingSid" TEXT;

-- CreateIndex
CREATE INDEX "CallRecord_hospitalId_idx" ON "CallRecord"("hospitalId");
CREATE INDEX "CallRecord_direction_idx" ON "CallRecord"("direction");
CREATE INDEX "CallRecord_streamSid_idx" ON "CallRecord"("streamSid");

-- CreateTable
CREATE TABLE "Hospital" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "telephonyProvider" TEXT NOT NULL DEFAULT 'EXOTEL',
    "exotelAccountSid" TEXT,
    "exotelApiKey" TEXT,
    "exotelAppId" TEXT,
    "exotelVirtualNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hospital_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Hospital_status_idx" ON "Hospital"("status");

-- Seed initial Daya General Hospital record
INSERT INTO "Hospital" ("id", "name", "shortName", "city", "state", "status", "telephonyProvider", "exotelVirtualNumber", "createdAt", "updatedAt")
VALUES ('hosp_daya_thrissur', 'Daya General Hospital Ltd & Specialty Surgical Centre', 'Daya Hospital', 'Thrissur', 'Kerala', 'ACTIVE', 'EXOTEL', '+914872475000', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

