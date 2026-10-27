import { describe, it, expect, beforeEach } from "vitest";
import {
  userService,
  hashPassword,
  verifyPassword,
} from "./user-service";
import {
  checkAuthRateLimit,
  recordFailedAttempt,
  resetRateLimit,
  clearRateLimitStore,
} from "@/lib/auth/rate-limit";

describe("UserService & Authentication (Phase 6)", () => {
  beforeEach(() => {
    userService.resetStore();
    clearRateLimitStore();
  });

  it("hashes passwords securely with unique salt and verifies correctly", () => {
    const plain = "DayaAdmin@2026";
    const hash1 = hashPassword(plain);
    const hash2 = hashPassword(plain);

    // Unique salts ensure different hashes for the same plain password
    expect(hash1).not.toBe(hash2);
    expect(hash1).toContain(":");

    expect(verifyPassword(plain, hash1)).toBe(true);
    expect(verifyPassword(plain, hash2)).toBe(true);
    expect(verifyPassword("WrongPassword", hash1)).toBe(false);
  });

  it("authenticates Hospital Administrator with valid credentials", async () => {
    const user = await userService.authenticate(
      "admin@dayahospital.com",
      "DayaAdmin@2026"
    );

    expect(user).not.toBeNull();
    expect(user?.role).toBe("HOSPITAL_ADMIN");
    expect(user?.canAccessRecordings).toBe(true);
    expect("passwordHash" in (user ?? {})).toBe(false); // Sensitive hash never exposed
  });

  it("authenticates Hospital Staff Reviewer with restricted recording permission", async () => {
    const user = await userService.authenticate(
      "staff@dayahospital.com",
      "DayaStaff@2026"
    );

    expect(user).not.toBeNull();
    expect(user?.role).toBe("HOSPITAL_STAFF");
    expect(user?.canAccessRecordings).toBe(false); // Restricted by default
  });

  it("rejects invalid password and logs audit failure", async () => {
    const user = await userService.authenticate(
      "admin@dayahospital.com",
      "WrongPass123"
    );

    expect(user).toBeNull();

    const auditLogs = userService.getAuditLogs();
    expect(auditLogs.length).toBeGreaterThan(0);
    expect(auditLogs[0].action).toBe("LOGIN_FAILED");
  });

  it("enforces rate limiting after 5 failed login attempts", () => {
    const key = "127.0.0.1:test@dayahospital.com";

    // 4 failed attempts should still be allowed
    for (let i = 0; i < 4; i++) {
      recordFailedAttempt(key);
      const status = checkAuthRateLimit(key);
      expect(status.allowed).toBe(true);
    }

    // 5th attempt locks out
    const fail5 = recordFailedAttempt(key);
    expect(fail5.blocked).toBe(true);
    expect(fail5.retryAfterSecs).toBeGreaterThan(0);

    const lockedStatus = checkAuthRateLimit(key);
    expect(lockedStatus.allowed).toBe(false);
    expect(lockedStatus.remaining).toBe(0);

    // Reset clears lockout
    resetRateLimit(key);
    const afterReset = checkAuthRateLimit(key);
    expect(afterReset.allowed).toBe(true);
  });

  it("creates a new staff user and prevents duplicate emails", () => {
    const newUser = userService.createUser(
      {
        name: "Nurse Mini Varghese",
        email: "mini.varghese@dayahospital.com",
        role: "HOSPITAL_STAFF",
        department: "Casualty Triage",
        canAccessRecordings: false,
      },
      "usr_admin"
    );

    expect(newUser.id).toBeDefined();
    expect(newUser.name).toBe("Nurse Mini Varghese");
    expect(newUser.status).toBe("ACTIVE");

    // Attempting duplicate email should throw
    expect(() =>
      userService.createUser(
        {
          name: "Another Mini",
          email: "mini.varghese@dayahospital.com",
          role: "HOSPITAL_STAFF",
          department: "Casualty",
        },
        "usr_admin"
      )
    ).toThrow(/already exists/i);
  });

  it("deactivates user and prevents deactivated account login", async () => {
    userService.deactivateUser("usr_staff", "usr_admin");

    const user = userService.getUserById("usr_staff");
    expect(user?.status).toBe("INACTIVE");

    // Login must fail for inactive account
    const authResult = await userService.authenticate(
      "staff@dayahospital.com",
      "DayaStaff@2026"
    );
    expect(authResult).toBeNull();
  });

  it("changes user password successfully", async () => {
    const changeSuccess = userService.changePassword(
      "usr_staff",
      "DayaStaff@2026",
      "NewDayaStaff@2026"
    );
    expect(changeSuccess).toBe(true);

    // Old password should now fail
    const oldLogin = await userService.authenticate(
      "staff@dayahospital.com",
      "DayaStaff@2026"
    );
    expect(oldLogin).toBeNull();

    // New password should succeed
    const newLogin = await userService.authenticate(
      "staff@dayahospital.com",
      "NewDayaStaff@2026"
    );
    expect(newLogin).not.toBeNull();
  });
});
