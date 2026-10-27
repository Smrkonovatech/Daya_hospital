import crypto from "crypto";
import { UserProfile, UserRole } from "@/types";

export interface AuthAuditEntry {
  id: string;
  timestamp: string;
  actorId: string;
  actorEmail?: string;
  action:
    | "LOGIN_SUCCESS"
    | "LOGIN_FAILED"
    | "LOGOUT"
    | "PASSWORD_CHANGED"
    | "PASSWORD_RESET_REQUESTED"
    | "USER_CREATED"
    | "USER_UPDATED"
    | "USER_DEACTIVATED";
  ipAddress?: string;
  details: string;
}

interface StoredUser extends UserProfile {
  passwordHash: string;
}

// Secure password hashing using PBKDF2/scrypt
export function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(plain, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(plain: string, storedHashWithSalt: string): boolean {
  try {
    const [salt, originalHash] = storedHashWithSalt.split(":");
    if (!salt || !originalHash) return false;
    const computedHash = crypto.scryptSync(plain, salt, 64).toString("hex");
    return crypto.timingSafeEqual(
      Buffer.from(computedHash, "hex"),
      Buffer.from(originalHash, "hex")
    );
  } catch {
    return false;
  }
}

const INITIAL_USERS: StoredUser[] = [
  {
    id: "usr_admin",
    name: "Dr. Anjali Menon",
    email: "admin@dayahospital.com",
    role: "HOSPITAL_ADMIN",
    department: "Informatics & Medical Admin",
    employeeId: "DGH-ADM-001",
    phone: "+91 94470 11001",
    canAccessRecordings: true,
    status: "ACTIVE",
    passwordHash: hashPassword("DayaAdmin@2026"),
    lastLoginAt: "2026-10-27T08:00:00+05:30",
    createdAt: "2026-01-01T00:00:00+05:30",
  },
  {
    id: "usr_staff",
    name: "Sister Mary",
    email: "staff@dayahospital.com",
    role: "HOSPITAL_STAFF",
    department: "OPD Triage Lead",
    employeeId: "DGH-NUR-104",
    phone: "+91 94470 22002",
    canAccessRecordings: false, // Call recording restricted by default for Staff
    status: "ACTIVE",
    passwordHash: hashPassword("DayaStaff@2026"),
    lastLoginAt: "2026-10-26T16:30:00+05:30",
    createdAt: "2026-02-15T00:00:00+05:30",
  },
  {
    id: "usr_tpa",
    name: "Prakash Nair",
    email: "prakash.tpa@dayahospital.com",
    role: "HOSPITAL_STAFF",
    department: "TPA & Cashless Insurance Desk",
    employeeId: "DGH-ADM-042",
    phone: "+91 94470 33003",
    canAccessRecordings: false,
    status: "ACTIVE",
    passwordHash: hashPassword("DayaTpa@2026"),
    lastLoginAt: "2026-10-25T14:15:00+05:30",
    createdAt: "2026-03-01T00:00:00+05:30",
  },
  {
    id: "usr_ortho",
    name: "Dr. Suresh Kumar",
    email: "suresh.ortho@dayahospital.com",
    role: "HOSPITAL_STAFF",
    department: "Orthopaedics Lead",
    employeeId: "DGH-DOC-018",
    phone: "+91 94470 44004",
    canAccessRecordings: true, // Explicitly granted recording access
    status: "ACTIVE",
    passwordHash: hashPassword("DayaDoc@2026"),
    lastLoginAt: "2026-10-24T11:00:00+05:30",
    createdAt: "2026-03-10T00:00:00+05:30",
  },
];

class UserService {
  private users: StoredUser[] = [];
  private auditLogs: AuthAuditEntry[] = [];

  constructor() {
    this.resetStore();
  }

  resetStore(): void {
    this.users = JSON.parse(JSON.stringify(INITIAL_USERS));
    this.auditLogs = [];
  }

  private sanitizeUser(user: StoredUser): UserProfile {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      employeeId: user.employeeId,
      phone: user.phone,
      canAccessRecordings: user.canAccessRecordings,
      status: user.status,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }

  async authenticate(
    emailOrUsername: string,
    plainPassword: string,
    ipAddress = "127.0.0.1"
  ): Promise<UserProfile | null> {
    const normalized = emailOrUsername.trim().toLowerCase();
    const user = this.users.find(
      (u) => u.email.toLowerCase() === normalized || u.employeeId?.toLowerCase() === normalized
    );

    if (!user || user.status !== "ACTIVE") {
      this.logAudit({
        actorId: user?.id || "unknown",
        actorEmail: normalized,
        action: "LOGIN_FAILED",
        ipAddress,
        details: user
          ? user.status !== "ACTIVE"
            ? "Account deactivated."
            : "Invalid password attempt."
          : "User not found.",
      });
      return null;
    }

    const isMatch = verifyPassword(plainPassword, user.passwordHash);
    if (!isMatch) {
      this.logAudit({
        actorId: user.id,
        actorEmail: user.email,
        action: "LOGIN_FAILED",
        ipAddress,
        details: "Invalid password credentials.",
      });
      return null;
    }

    user.lastLoginAt = new Date().toISOString();

    this.logAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: "LOGIN_SUCCESS",
      ipAddress,
      details: `Successful login as ${user.role} (${user.department}).`,
    });

    return this.sanitizeUser(user);
  }

  getUserById(id: string): UserProfile | undefined {
    const user = this.users.find((u) => u.id === id);
    return user ? this.sanitizeUser(user) : undefined;
  }

  getUserByEmail(email: string): UserProfile | undefined {
    const user = this.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    return user ? this.sanitizeUser(user) : undefined;
  }

  getAllUsers(): UserProfile[] {
    return this.users.map((u) => this.sanitizeUser(u));
  }

  createUser(
    input: {
      name: string;
      email: string;
      role: UserRole;
      department: string;
      phone?: string;
      canAccessRecordings?: boolean;
      initialPassword?: string;
    },
    actorId: string
  ): UserProfile {
    const emailLower = input.email.trim().toLowerCase();
    if (this.users.some((u) => u.email.toLowerCase() === emailLower)) {
      throw new Error(`User with email "${input.email}" already exists.`);
    }

    const id = `usr_${Date.now().toString().slice(-6)}`;
    const employeeId = `DGH-EMP-${Date.now().toString().slice(-3)}`;
    const plainPwd = input.initialPassword || "DayaStaff@2026";

    const newUser: StoredUser = {
      id,
      name: input.name,
      email: emailLower,
      role: input.role,
      department: input.department,
      employeeId,
      phone: input.phone || "+91 94470 00000",
      canAccessRecordings: Boolean(input.canAccessRecordings),
      status: "ACTIVE",
      passwordHash: hashPassword(plainPwd),
      createdAt: new Date().toISOString(),
    };

    this.users.push(newUser);

    this.logAudit({
      actorId,
      action: "USER_CREATED",
      details: `Created new staff account for ${newUser.name} (${newUser.email}) with role ${newUser.role}.`,
    });

    return this.sanitizeUser(newUser);
  }

  updateUser(
    id: string,
    updates: Partial<{
      name: string;
      department: string;
      role: UserRole;
      canAccessRecordings: boolean;
      phone: string;
      status: "ACTIVE" | "INACTIVE";
    }>,
    actorId: string
  ): UserProfile {
    const index = this.users.findIndex((u) => u.id === id);
    if (index === -1) {
      throw new Error(`User with ID ${id} not found.`);
    }

    const current = this.users[index];
    const updated: StoredUser = {
      ...current,
      ...updates,
    };

    this.users[index] = updated;

    this.logAudit({
      actorId,
      action: "USER_UPDATED",
      details: `Updated user profile for ${current.name} (${current.email}).`,
    });

    return this.sanitizeUser(updated);
  }

  deactivateUser(id: string, actorId: string): UserProfile {
    return this.updateUser(id, { status: "INACTIVE" }, actorId);
  }

  changePassword(userId: string, oldPlain: string, newPlain: string): boolean {
    const user = this.users.find((u) => u.id === userId);
    if (!user) return false;

    if (!verifyPassword(oldPlain, user.passwordHash)) {
      return false;
    }

    user.passwordHash = hashPassword(newPlain);

    this.logAudit({
      actorId: userId,
      actorEmail: user.email,
      action: "PASSWORD_CHANGED",
      details: "Staff password changed successfully.",
    });

    return true;
  }

  requestPasswordReset(email: string): { success: boolean; message: string } {
    const user = this.getUserByEmail(email);

    this.logAudit({
      actorId: user?.id || "guest",
      actorEmail: email,
      action: "PASSWORD_RESET_REQUESTED",
      details: user
        ? `Password reset link simulated for ${user.email}.`
        : `Password reset requested for non-existent email: ${email}.`,
    });

    return {
      success: true,
      message:
        "If a matching hospital employee account exists, password reset instructions have been sent to your registered address.",
    };
  }

  getAuditLogs(): AuthAuditEntry[] {
    return [...this.auditLogs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  private logAudit(entry: Omit<AuthAuditEntry, "id" | "timestamp">): void {
    this.auditLogs.unshift({
      id: `audit_${Date.now().toString().slice(-6)}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    });
  }
}

export const userService = new UserService();
