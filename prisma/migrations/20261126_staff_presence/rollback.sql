-- Rollback migration: 20261126_staff_presence
DROP TABLE IF EXISTS "StaffPresenceAuditLog" CASCADE;
DROP TABLE IF EXISTS "StaffPresence" CASCADE;
DROP TYPE IF EXISTS "StaffPresenceStatus" CASCADE;
