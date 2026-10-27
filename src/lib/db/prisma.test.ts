import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getDatabaseConfig, checkDatabaseConnection } from "./prisma";

describe("Database Configuration & Demo Mode (Phase 7)", () => {
  const originalEnv = process.env.DATABASE_URL;

  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.DATABASE_URL = originalEnv;
    } else {
      delete process.env.DATABASE_URL;
    }
  });

  it("detects unconfigured DATABASE_URL and defaults to Development Demo Mode", () => {
    const config = getDatabaseConfig();
    expect(config.isConfigured).toBe(false);
    expect(config.isDemoMode).toBe(true);
    expect(config.databaseUrl).toBeUndefined();
  });

  it("flags dummy or placeholder URLs as Demo Mode", () => {
    process.env.DATABASE_URL = "postgresql://user:pass@example.com:5432/dummy";
    const config = getDatabaseConfig();
    expect(config.isConfigured).toBe(false);
    expect(config.isDemoMode).toBe(true);
  });

  it("recognizes valid PostgreSQL connection strings", () => {
    process.env.DATABASE_URL = "postgresql://daya_admin:secret@localhost:5432/daya_hospital";
    const config = getDatabaseConfig();
    expect(config.isConfigured).toBe(true);
    expect(config.isDemoMode).toBe(false);
    expect(config.databaseUrl).toBe("postgresql://daya_admin:secret@localhost:5432/daya_hospital");
  });

  it("returns demo mode status and informative message on connection check when unconfigured", async () => {
    const status = await checkDatabaseConnection();
    expect(status.connected).toBe(false);
    expect(status.isDemoMode).toBe(true);
    expect(status.message).toContain("Demo Mode");
  });
});
