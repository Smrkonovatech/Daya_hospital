import { describe, it, expect } from "vitest";
import {
  createSessionToken,
  verifySessionToken,
  revokeSessionToken,
} from "./session";

describe("Session Management & HMAC-SHA256 Tokens (Phase 6)", () => {
  const sampleUser = {
    userId: "usr_admin",
    name: "Dr. Anjali Menon",
    email: "admin@dayahospital.com",
    role: "HOSPITAL_ADMIN" as const,
    department: "Informatics & Medical Admin",
    canAccessRecordings: true,
  };

  it("creates and successfully verifies signed session token", async () => {
    const token = await createSessionToken(sampleUser, 8);
    expect(token).toBeDefined();
    expect(token).toContain(".");

    const session = await verifySessionToken(token);
    expect(session).not.toBeNull();
    expect(session?.userId).toBe("usr_admin");
    expect(session?.email).toBe("admin@dayahospital.com");
    expect(session?.role).toBe("HOSPITAL_ADMIN");
    expect(session?.canAccessRecordings).toBe(true);
    expect(session?.expiresAt).toBeGreaterThan(Date.now());
  });

  it("rejects tampered session tokens", async () => {
    const token = await createSessionToken(sampleUser, 8);
    const [, signature] = token.split(".");

    // Alter payload to escalate privileges
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ...sampleUser, role: "SUPER_ROOT" })
    ).toString("base64url");

    const tamperedToken = `${tamperedPayload}.${signature}`;
    const result = await verifySessionToken(tamperedToken);
    expect(result).toBeNull();
  });

  it("rejects expired session tokens", async () => {
    // Negative duration creates an already expired token
    const expiredToken = await createSessionToken(sampleUser, -1);
    const result = await verifySessionToken(expiredToken);
    expect(result).toBeNull();
  });

  it("revokes token on logout", async () => {
    const token = await createSessionToken(sampleUser, 8);

    // Initial check is valid
    const valid = await verifySessionToken(token);
    expect(valid).not.toBeNull();

    // Revoke token
    revokeSessionToken(token);

    // Subsequent verification must fail
    const revoked = await verifySessionToken(token);
    expect(revoked).toBeNull();
  });
});
