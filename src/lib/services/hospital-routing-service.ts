/**
 * ============================================================================
 * SMRKOMED MULTI-TENANT DYNAMIC TELEPHONY ROUTING ENGINE (PHASE 9.6)
 * ============================================================================
 *
 * Provides dynamic, tenant-isolated destination routing for Exotel telephony.
 * Completely eliminates static hospital numbers from carrier applets by resolving
 * destinations dynamically at call runtime based on:
 * 1. Hospital Tenant ID (Strict multi-tenant isolation)
 * 2. Escalation Reason (EMERGENCY, HUMAN_TRANSFER, DEPARTMENT, AFTER_HOURS, FALLBACK)
 * 3. Immutable Published Routing Configuration Versions
 * 4. Business Hours / On-duty schedule evaluation
 *
 * Carrier Contract:
 * - Exotel Connect Applet (Dynamic Application URL): GET /exotel/connect-destination
 * - Responds with HTTP 200 text/plain and E.164 destination number.
 */

import { prisma, checkDatabaseConnection } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { getHospitalConfig, normalizePhoneNumber } from "@/lib/config/hospital-config";

export type EscalationType =
  | "EMERGENCY"
  | "EMERGENCY_TRANSFER"
  | "HUMAN_TRANSFER"
  | "DEPARTMENT"
  | "AFTER_HOURS"
  | "FALLBACK"
  | "NONE";

export interface DepartmentDestination {
  id: string; // e.g. "dept_cardiology"
  name: string; // e.g. "Cardiology OPD"
  extension?: string; // e.g. "102"
  phoneNumber: string; // E.164 e.g. "+914872475102"
  priority?: number;
  activeHours?: { open: string; close: string; days?: number[] };
}

export interface AdditionalAgent {
  id: string;
  name: string;
  phoneNumber: string; // E.164
  extension?: string;
  priority?: number;
  status?: "AVAILABLE" | "BUSY" | "OFFLINE";
}

export interface BusinessHoursSchedule {
  enabled: boolean;
  timezone: string; // e.g. "Asia/Kolkata"
  openTime: string; // "08:00"
  closeTime: string; // "20:00"
  workingDays: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
}

export interface HospitalRoutingConfig {
  hospitalId: string;
  isVerified?: boolean; // strictly true for approved live deployments (Daya), false for demo tenants
  verificationStatus?: "VERIFIED_LIVE" | "UNVERIFIED_DEMO_SANDBOX";
  emergencyDestination: {
    primaryNumber: string; // E.164
    backupNumber?: string; // E.164
    departmentName: string;
    extension?: string;
    receiverClassification?: "TEMPORARY_DEV_TEST_RECEIVER" | "VERIFIED_CLINICAL_TRUNK";
    emergencyPstnTransferEnabled?: boolean;
    verificationNotes?: string;
  };
  receptionistDestination: {
    primaryNumber: string; // E.164
    backupNumber?: string; // E.164
    departmentName: string;
    extension?: string;
  };
  additionalReceptionists?: AdditionalAgent[];
  receptionistRingTimeoutSeconds?: number;
  aiOverflowEnabled?: boolean;
  noAnswerBehavior?: "AI_VOICEBOT" | "HUMAN_FALLBACK" | "VOICEMAIL";
  busyBehavior?: "AI_VOICEBOT" | "HUMAN_FALLBACK" | "BUSY_TONE";
  unavailableBehavior?: "AI_VOICEBOT" | "CASUALTY_TRANSFER" | "VOICEMAIL";
  businessHours?: BusinessHoursSchedule;
  departmentDestinations: DepartmentDestination[];
  afterHoursDestination: {
    primaryNumber: string; // E.164
    behavior: "EMERGENCY_TRANSFER" | "CASUALTY_TRANSFER" | "AI_VOICEBOT" | "VOICEMAIL";
    customMessage?: string;
  };
  humanFallbackDestination: {
    primaryNumber: string; // E.164
    maxRingsBeforeFallback?: number;
    supervisorName?: string;
  };
  versionNumber?: number;
  publishedAt?: string;
  publishedBy?: string;
  changelog?: string;
}

export interface RoutingValidationReport {
  isValid: boolean;
  errors: Array<{ field: string; message: string }>;
  warnings: Array<{ field: string; message: string }>;
}

export interface RoutingResolutionResult {
  success: boolean;
  hospitalId: string;
  escalationType: EscalationType;
  destinationNumber: string; // E.164
  departmentName: string;
  versionUsed: number;
  isAfterHours: boolean;
  routingRule: string;
  ringTimeoutSeconds?: number;
  aiOverflowEnabled?: boolean;
  receiverClassification?: "TEMPORARY_DEV_TEST_RECEIVER" | "VERIFIED_CLINICAL_TRUNK";
  emergencyPstnTransferEnabled?: boolean;
  error?: string;
}

export interface SimulationParams {
  hospitalId: string;
  escalationType: EscalationType;
  departmentId?: string;
  simulatedTimeIso?: string;
  versionNumber?: number;
}

// In-memory tenant routing stores (ensures resilience when DB is in standby or in unit test)
const inMemoryRoutingDrafts = new Map<string, HospitalRoutingConfig>();
const inMemoryRoutingVersions = new Map<
  string,
  Array<{
    versionNumber: number;
    isActive: boolean;
    config: HospitalRoutingConfig;
    publishedAt: string;
    publishedBy: string;
    changelog: string;
  }>
>();
const inMemoryRoutingAudit: Array<{
  id: string;
  hospitalId: string;
  action: string;
  performedBy: string;
  userId?: string;
  summary: string;
  timestamp: string;
}> = [];

/**
 * Strict E.164 validation regex: Must start with '+' followed by 8 to 15 digits.
 * Rejects raw extensions, national numbers without country code, or alpha characters.
 */
export const E164_REGEX = /^\+[1-9]\d{7,14}$/;

export function isValidE164(phone: string): boolean {
  if (!phone || typeof phone !== "string") return false;
  const trimmed = phone.trim().replace(/[\s\-()]/g, "");
  return E164_REGEX.test(trimmed);
}

export function formatE164(phone: string): string {
  const trimmed = phone.trim().replace(/[\s\-()]/g, "");
  if (trimmed.startsWith("+")) return trimmed;
  // If 10 digits Indian mobile, prepend +91
  if (/^\d{10}$/.test(trimmed)) {
    return `+91${trimmed}`;
  }
  return trimmed;
}

/**
 * Checks whether a given timestamp falls within the tenant's business hours.
 */
export function isWithinBusinessHours(
  schedule?: BusinessHoursSchedule,
  referenceDate: Date = new Date()
): boolean {
  if (!schedule || !schedule.enabled) {
    return true; // Default to open if schedule is disabled or unset
  }

  try {
    const tz = schedule.timezone || "Asia/Kolkata";
    const dateStr = referenceDate.toLocaleString("en-US", { timeZone: tz });
    const localDate = new Date(dateStr);
    const day = localDate.getDay();
    const hour = localDate.getHours();
    const minute = localDate.getMinutes();

    if (schedule.workingDays && schedule.workingDays.length > 0) {
      if (!schedule.workingDays.includes(day)) {
        return false;
      }
    }

    const currentMinutes = hour * 60 + minute;
    const [openH, openM] = (schedule.openTime || "08:00").split(":").map(Number);
    const [closeH, closeM] = (schedule.closeTime || "20:00").split(":").map(Number);

    const openMinutes = (openH || 0) * 60 + (openM || 0);
    const closeMinutes = (closeH || 0) * 60 + (closeM || 0);

    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  } catch (err) {
    return true;
  }
}

export class HospitalRoutingService {
  /**
   * Resets in-memory caches and audit state for testing.
   */
  public resetInMemoryState(): void {
    inMemoryRoutingDrafts.clear();
    inMemoryRoutingVersions.clear();
    inMemoryRoutingAudit.length = 0;
  }

  /**
   * Completely purges a tenant's draft, published versions, and audit logs
   * from both in-memory caches and database. Used for test isolation and cleanup.
   */
  public async purgeTenantState(hospitalId: string): Promise<void> {
    inMemoryRoutingDrafts.delete(hospitalId);
    inMemoryRoutingVersions.delete(hospitalId);
    try {
      const dbStatus = await checkDatabaseConnection();
      if (dbStatus.connected) {
        await prisma.hospitalConfigDraft.deleteMany({ where: { hospitalId } });
        await prisma.hospitalConfigVersion.deleteMany({ where: { hospitalId } });
        await prisma.configAuditLog.deleteMany({ where: { hospitalId } });
      }
    } catch (err) {
      console.warn(`[RoutingService] DB purgeTenantState fallback for ${hospitalId}:`, err);
    }
  }
  /**
   * Baseline default routing configuration for Daya Hospital pilot.
   * Strictly keeps +919606654032 within hosp_daya_thrissur.
   */
  public getDefaultRoutingConfig(hospitalId: string): HospitalRoutingConfig {
    if (hospitalId === "hosp_daya_thrissur") {
      return {
        hospitalId: "hosp_daya_thrissur",
        isVerified: true,
        verificationStatus: "VERIFIED_LIVE",
        emergencyDestination: {
          primaryNumber: "+919740662046",
          backupNumber: "+914872475100",
          departmentName: "Casualty Emergency Desk (DEV TEST RECEIVER)",
          extension: "100",
          receiverClassification: "TEMPORARY_DEV_TEST_RECEIVER",
          emergencyPstnTransferEnabled: false,
          verificationNotes:
            "RECLASSIFIED PER PHASE 10.13: Strictly temporary development test receiver (+919740662046). Live carrier emergency PSTN transfer disabled pending Daya hospital clinical signoff.",
        },
        receptionistDestination: {
          primaryNumber: "+919606654032",
          backupNumber: "+914872475000",
          departmentName: "Main Inbound Reception",
          extension: "201",
        },
        departmentDestinations: [
          {
            id: "dept_cardiology",
            name: "Cardiology OPD",
            extension: "102",
            phoneNumber: "+914872475102",
            priority: 1,
          },
          {
            id: "dept_ortho",
            name: "Orthopedics OPD",
            extension: "103",
            phoneNumber: "+914872475103",
            priority: 1,
          },
          {
            id: "dept_pediatrics",
            name: "Pediatrics & Child Care",
            extension: "104",
            phoneNumber: "+914872475104",
            priority: 1,
          },
          {
            id: "dept_billing",
            name: "Billing & Insurance Desk",
            extension: "205",
            phoneNumber: "+914872475205",
            priority: 2,
          },
        ],
        afterHoursDestination: {
          primaryNumber: "+919606654032",
          behavior: "CASUALTY_TRANSFER",
          customMessage: "Hospital reception is currently closed. Transferring to 24/7 Casualty.",
        },
        humanFallbackDestination: {
          primaryNumber: "+919606654032",
          maxRingsBeforeFallback: 4,
          supervisorName: "Duty Operations Manager",
        },
        receptionistRingTimeoutSeconds: 20,
        aiOverflowEnabled: true,
        noAnswerBehavior: "AI_VOICEBOT",
        busyBehavior: "AI_VOICEBOT",
        unavailableBehavior: "AI_VOICEBOT",
        businessHours: {
          enabled: true,
          timezone: "Asia/Kolkata",
          openTime: "08:00",
          closeTime: "20:00",
          workingDays: [1, 2, 3, 4, 5, 6],
        },
        additionalReceptionists: [
          {
            id: "agent_rec_2",
            name: "OPD Receptionist Desk 2",
            extension: "202",
            phoneNumber: "+914872475202",
            priority: 2,
            status: "AVAILABLE",
          },
        ],
        versionNumber: 1,
        publishedAt: new Date().toISOString(),
        publishedBy: "System Administrator",
        changelog: "Baseline Daya Hospital verified routing configuration (Phase 9.6)",
      };
    }

    if (hospitalId === "hosp_aster_medcity") {
      return {
        hospitalId: "hosp_aster_medcity",
        isVerified: false,
        verificationStatus: "UNVERIFIED_DEMO_SANDBOX",
        emergencyDestination: {
          primaryNumber: "+914846699999",
          backupNumber: "+914846699998",
          departmentName: "Aster Emergency Trauma Care",
          extension: "100",
        },
        receptionistDestination: {
          primaryNumber: "+914846699000",
          backupNumber: "+914846699001",
          departmentName: "Aster Main Reception",
          extension: "201",
        },
        departmentDestinations: [
          {
            id: "dept_cardiology",
            name: "Cardiology OPD",
            extension: "101",
            phoneNumber: "+914846699101",
            priority: 1,
          },
          {
            id: "dept_neuro",
            name: "Neurology OPD",
            extension: "102",
            phoneNumber: "+914846699102",
            priority: 1,
          },
        ],
        afterHoursDestination: {
          primaryNumber: "+914846699999",
          behavior: "EMERGENCY_TRANSFER",
        },
        humanFallbackDestination: {
          primaryNumber: "+914846699000",
          maxRingsBeforeFallback: 3,
        },
        receptionistRingTimeoutSeconds: 20,
        aiOverflowEnabled: true,
        noAnswerBehavior: "AI_VOICEBOT",
        busyBehavior: "AI_VOICEBOT",
        unavailableBehavior: "AI_VOICEBOT",
        businessHours: {
          enabled: true,
          timezone: "Asia/Kolkata",
          openTime: "08:30",
          closeTime: "19:30",
          workingDays: [1, 2, 3, 4, 5, 6],
        },
        additionalReceptionists: [
          {
            id: "agent_aster_2",
            name: "Executive Front Desk 2",
            extension: "202",
            phoneNumber: "+914846699002",
            priority: 2,
            status: "AVAILABLE",
          },
        ],
        versionNumber: 1,
        publishedAt: new Date().toISOString(),
        publishedBy: "Aster Administrator",
        changelog: "Baseline Aster Medcity routing configuration",
      };
    }

    if (hospitalId === "hosp_kims_trivandrum") {
      return {
        hospitalId: "hosp_kims_trivandrum",
        isVerified: false,
        verificationStatus: "UNVERIFIED_DEMO_SANDBOX",
        emergencyDestination: {
          primaryNumber: "+914713041999",
          departmentName: "KIMS Critical Care Unit",
          extension: "100",
        },
        receptionistDestination: {
          primaryNumber: "+914713041234",
          departmentName: "KIMS Outpatient Reception",
          extension: "201",
        },
        departmentDestinations: [
          {
            id: "dept_pediatrics",
            name: "Pediatrics OPD",
            extension: "555",
            phoneNumber: "+914713041555",
            priority: 1,
          },
          {
            id: "dept_ortho",
            name: "Orthopedic Surgery",
            extension: "556",
            phoneNumber: "+914713041556",
            priority: 1,
          },
        ],
        afterHoursDestination: {
          primaryNumber: "+914713041999",
          behavior: "CASUALTY_TRANSFER",
        },
        humanFallbackDestination: {
          primaryNumber: "+914713041234",
          maxRingsBeforeFallback: 4,
        },
        receptionistRingTimeoutSeconds: 20,
        aiOverflowEnabled: true,
        noAnswerBehavior: "AI_VOICEBOT",
        busyBehavior: "AI_VOICEBOT",
        unavailableBehavior: "AI_VOICEBOT",
        businessHours: {
          enabled: true,
          timezone: "Asia/Kolkata",
          openTime: "08:00",
          closeTime: "20:00",
          workingDays: [0, 1, 2, 3, 4, 5, 6],
        },
        additionalReceptionists: [
          {
            id: "agent_kims_2",
            name: "Outpatient Desk 2",
            extension: "202",
            phoneNumber: "+914713041235",
            priority: 2,
            status: "AVAILABLE",
          },
        ],
        versionNumber: 1,
        publishedAt: new Date().toISOString(),
        publishedBy: "KIMS Administrator",
        changelog: "Baseline KIMSHEALTH routing configuration",
      };
    }

    // Default template for new hospital tenants - NEVER pre-fills Daya numbers or cross-tenant fallbacks
    return {
      hospitalId,
      isVerified: false,
      verificationStatus: "UNVERIFIED_DEMO_SANDBOX",
      emergencyDestination: {
        primaryNumber: "",
        departmentName: "Emergency Department",
        extension: "100",
      },
      receptionistDestination: {
        primaryNumber: "",
        departmentName: "Front Desk Reception",
        extension: "201",
      },
      additionalReceptionists: [],
      receptionistRingTimeoutSeconds: 20,
      aiOverflowEnabled: true,
      noAnswerBehavior: "AI_VOICEBOT",
      busyBehavior: "AI_VOICEBOT",
      unavailableBehavior: "AI_VOICEBOT",
      businessHours: {
        enabled: false,
        timezone: "Asia/Kolkata",
        openTime: "09:00",
        closeTime: "18:00",
        workingDays: [1, 2, 3, 4, 5],
      },
      departmentDestinations: [],
      afterHoursDestination: {
        primaryNumber: "",
        behavior: "AI_VOICEBOT",
      },
      humanFallbackDestination: {
        primaryNumber: "",
      },
      versionNumber: 0,
      changelog: "Unpublished Draft",
    };
  }

  /**
   * Retrieves active draft routing configuration.
   */
  public async getDraft(hospitalId: string): Promise<HospitalRoutingConfig> {
    // 1. Try Neon DB
    try {
      const dbStatus = await checkDatabaseConnection();
      if (dbStatus.connected) {
        const draftRecord = await prisma.hospitalConfigDraft.findUnique({
          where: { hospitalId },
        });

        if (draftRecord && draftRecord.transferDestinations) {
          const custom = (draftRecord as any).transferDestinations?.routingConfig as HospitalRoutingConfig;
          if (custom && custom.hospitalId === hospitalId) {
            return custom;
          }
        }
      }
    } catch (err) {
      console.warn(`[RoutingService] DB getDraft fallback for ${hospitalId}:`, err);
    }

    // 2. Fallback to memory or defaults
    if (inMemoryRoutingDrafts.has(hospitalId)) {
      return inMemoryRoutingDrafts.get(hospitalId)!;
    }

    const initial = this.getDefaultRoutingConfig(hospitalId);
    inMemoryRoutingDrafts.set(hospitalId, initial);
    return initial;
  }

  /**
   * Saves updates to the hospital routing draft without publishing.
   */
  public async saveDraft(
    hospitalId: string,
    updates: Partial<HospitalRoutingConfig>,
    userId = "usr_admin",
    userName = "Hospital Administrator"
  ): Promise<HospitalRoutingConfig> {
    const current = await this.getDraft(hospitalId);
    const merged: HospitalRoutingConfig = {
      ...current,
      ...updates,
      hospitalId, // Prevent tenant ID tampering
      emergencyDestination: {
        ...current.emergencyDestination,
        ...(updates.emergencyDestination || {}),
        primaryNumber: updates.emergencyDestination?.primaryNumber
          ? formatE164(updates.emergencyDestination.primaryNumber)
          : current.emergencyDestination.primaryNumber,
        backupNumber: updates.emergencyDestination?.backupNumber
          ? formatE164(updates.emergencyDestination.backupNumber)
          : current.emergencyDestination.backupNumber,
      },
      receptionistDestination: {
        ...current.receptionistDestination,
        ...(updates.receptionistDestination || {}),
        primaryNumber: updates.receptionistDestination?.primaryNumber
          ? formatE164(updates.receptionistDestination.primaryNumber)
          : current.receptionistDestination.primaryNumber,
        backupNumber: updates.receptionistDestination?.backupNumber
          ? formatE164(updates.receptionistDestination.backupNumber)
          : current.receptionistDestination.backupNumber,
      },
      departmentDestinations: (updates.departmentDestinations || current.departmentDestinations).map((d) => ({
        ...d,
        phoneNumber: formatE164(d.phoneNumber),
      })),
      afterHoursDestination: {
        ...current.afterHoursDestination,
        ...(updates.afterHoursDestination || {}),
        primaryNumber: updates.afterHoursDestination?.primaryNumber
          ? formatE164(updates.afterHoursDestination.primaryNumber)
          : current.afterHoursDestination.primaryNumber,
      },
      humanFallbackDestination: {
        ...current.humanFallbackDestination,
        ...(updates.humanFallbackDestination || {}),
        primaryNumber: updates.humanFallbackDestination?.primaryNumber
          ? formatE164(updates.humanFallbackDestination.primaryNumber)
          : current.humanFallbackDestination.primaryNumber,
      },
      additionalReceptionists: updates.additionalReceptionists !== undefined
        ? updates.additionalReceptionists.map((a) => ({ ...a, phoneNumber: formatE164(a.phoneNumber) }))
        : current.additionalReceptionists || [],
      receptionistRingTimeoutSeconds:
        updates.receptionistRingTimeoutSeconds !== undefined
          ? updates.receptionistRingTimeoutSeconds
          : current.receptionistRingTimeoutSeconds || 20,
      aiOverflowEnabled:
        updates.aiOverflowEnabled !== undefined
          ? updates.aiOverflowEnabled
          : current.aiOverflowEnabled !== false,
      noAnswerBehavior: updates.noAnswerBehavior || current.noAnswerBehavior || "AI_VOICEBOT",
      busyBehavior: updates.busyBehavior || current.busyBehavior || "AI_VOICEBOT",
      unavailableBehavior: updates.unavailableBehavior || current.unavailableBehavior || "AI_VOICEBOT",
      businessHours: updates.businessHours !== undefined ? updates.businessHours : current.businessHours,
    };

    inMemoryRoutingDrafts.set(hospitalId, merged);

    // Persist to Neon DB
    try {
      const dbStatus = await checkDatabaseConnection();
      if (dbStatus.connected) {
        await prisma.hospitalConfigDraft.upsert({
          where: { hospitalId },
          create: {
            hospitalId,
            lastUpdatedBy: userName,
            transferDestinations: { routingConfig: merged } as unknown as Prisma.InputJsonValue,
            emergencyDestinations: [merged.emergencyDestination.primaryNumber].filter(Boolean),
          },
          update: {
            lastUpdatedBy: userName,
            transferDestinations: { routingConfig: merged } as unknown as Prisma.InputJsonValue,
            emergencyDestinations: [merged.emergencyDestination.primaryNumber].filter(Boolean),
          },
        });

        await prisma.configAuditLog.create({
          data: {
            hospitalId,
            entityType: "TELEPHONY_ROUTING",
            entityId: hospitalId,
            action: "ROUTING_DRAFT_SAVED",
            performedBy: userName,
            userId,
            changesSummary: `Updated draft telephony destinations for ${hospitalId}`,
          },
        });
      }
    } catch (dbErr) {
      console.warn(`[RoutingService] DB saveDraft error:`, dbErr);
    }

    inMemoryRoutingAudit.unshift({
      id: `audit_draft_${Date.now()}`,
      hospitalId,
      action: "ROUTING_DRAFT_SAVED",
      performedBy: userName,
      userId,
      summary: `Updated draft telephony destinations`,
      timestamp: new Date().toISOString(),
    });

    return merged;
  }

  /**
   * Strictly validates a routing configuration.
   * Enforces E.164 formats, non-empty primary destinations, and tenant boundaries.
   */
  public validateRoutingConfig(config: HospitalRoutingConfig): RoutingValidationReport {
    const errors: Array<{ field: string; message: string }> = [];
    const warnings: Array<{ field: string; message: string }> = [];

    if (!config.hospitalId || !config.hospitalId.trim()) {
      errors.push({ field: "hospitalId", message: "Hospital Tenant ID is required." });
    }

    // 1. Emergency Destination Validation
    if (!config.emergencyDestination?.primaryNumber) {
      errors.push({
        field: "emergencyDestination.primaryNumber",
        message: "Emergency primary destination is mandatory.",
      });
    } else if (!isValidE164(config.emergencyDestination.primaryNumber)) {
      errors.push({
        field: "emergencyDestination.primaryNumber",
        message: `Emergency number '${config.emergencyDestination.primaryNumber}' is invalid. Must be E.164 format (e.g. +919606654032).`,
      });
    }

    if (config.emergencyDestination?.backupNumber && !isValidE164(config.emergencyDestination.backupNumber)) {
      errors.push({
        field: "emergencyDestination.backupNumber",
        message: `Emergency backup number '${config.emergencyDestination.backupNumber}' is invalid. Must be E.164 format.`,
      });
    }

    // 2. Receptionist Destination Validation
    if (!config.receptionistDestination?.primaryNumber) {
      errors.push({
        field: "receptionistDestination.primaryNumber",
        message: "Receptionist primary destination is mandatory.",
      });
    } else if (!isValidE164(config.receptionistDestination.primaryNumber)) {
      errors.push({
        field: "receptionistDestination.primaryNumber",
        message: `Receptionist number '${config.receptionistDestination.primaryNumber}' is invalid. Must be E.164 format.`,
      });
    }

    // 3. Department Destinations Validation
    for (const [idx, dept] of (config.departmentDestinations || []).entries()) {
      if (!dept.name?.trim()) {
        errors.push({
          field: `departmentDestinations[${idx}].name`,
          message: "Department name is required.",
        });
      }
      if (!dept.phoneNumber?.trim()) {
        errors.push({
          field: `departmentDestinations[${idx}].phoneNumber`,
          message: `Phone number for department '${dept.name || idx}' is required.`,
        });
      } else if (!isValidE164(dept.phoneNumber)) {
        errors.push({
          field: `departmentDestinations[${idx}].phoneNumber`,
          message: `Department '${dept.name}' number '${dept.phoneNumber}' is invalid. Must be E.164 format.`,
        });
      }
    }

    // 4. After-Hours Destination Validation
    if (config.afterHoursDestination?.primaryNumber && !isValidE164(config.afterHoursDestination.primaryNumber)) {
      errors.push({
        field: "afterHoursDestination.primaryNumber",
        message: `After-hours number '${config.afterHoursDestination.primaryNumber}' is invalid. Must be E.164 format.`,
      });
    }

    // 5. Human Fallback Destination Validation
    if (config.humanFallbackDestination?.primaryNumber && !isValidE164(config.humanFallbackDestination.primaryNumber)) {
      errors.push({
        field: "humanFallbackDestination.primaryNumber",
        message: `Fallback number '${config.humanFallbackDestination.primaryNumber}' is invalid. Must be E.164 format.`,
      });
    }

    // 6. Receptionist Ring Timeout Validation
    if (config.receptionistRingTimeoutSeconds !== undefined) {
      if (
        typeof config.receptionistRingTimeoutSeconds !== "number" ||
        config.receptionistRingTimeoutSeconds < 5 ||
        config.receptionistRingTimeoutSeconds > 60
      ) {
        errors.push({
          field: "receptionistRingTimeoutSeconds",
          message: "Receptionist ring timeout must be between 5 and 60 seconds.",
        });
      }
    }

    // 7. Additional Receptionists (Multi-Agent) Validation
    if (config.additionalReceptionists && Array.isArray(config.additionalReceptionists)) {
      for (const [idx, agent] of config.additionalReceptionists.entries()) {
        if (!agent.name?.trim()) {
          errors.push({
            field: `additionalReceptionists[${idx}].name`,
            message: `Additional receptionist #${idx + 1} name is required.`,
          });
        }
        if (!agent.phoneNumber || !isValidE164(agent.phoneNumber)) {
          errors.push({
            field: `additionalReceptionists[${idx}].phoneNumber`,
            message: `Additional receptionist '${agent.name || idx}' phone number '${agent.phoneNumber}' is invalid. Must be E.164 format.`,
          });
        }
      }
    }

    // 8. Business Hours Schedule Validation
    if (config.businessHours?.enabled) {
      const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
      if (!config.businessHours.openTime || !timeRegex.test(config.businessHours.openTime)) {
        errors.push({
          field: "businessHours.openTime",
          message: "Business hours open time must be in HH:mm 24-hour format (e.g. 08:00).",
        });
      }
      if (!config.businessHours.closeTime || !timeRegex.test(config.businessHours.closeTime)) {
        errors.push({
          field: "businessHours.closeTime",
          message: "Business hours close time must be in HH:mm 24-hour format (e.g. 20:00).",
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Publishes the current draft as an immutable version snapshot.
   */
  public async publishVersion(
    hospitalId: string,
    changelog: string,
    userId = "usr_admin",
    userName = "Hospital Administrator"
  ): Promise<{ success: boolean; versionNumber: number; error?: string }> {
    const draft = await this.getDraft(hospitalId);
    const validation = this.validateRoutingConfig(draft);

    if (!validation.isValid) {
      return {
        success: false,
        versionNumber: 0,
        error: `Validation failed: ${validation.errors.map((e) => e.message).join("; ")}`,
      };
    }

    let nextVersion = 1;
    const dbStatus = await checkDatabaseConnection();

    if (dbStatus.connected) {
      try {
        const latest = await prisma.hospitalConfigVersion.findFirst({
          where: { hospitalId },
          orderBy: { versionNumber: "desc" },
        });
        if (latest) {
          nextVersion = latest.versionNumber + 1;
        }

        // Deactivate older versions
        await prisma.hospitalConfigVersion.updateMany({
          where: { hospitalId, isActive: true },
          data: { isActive: false },
        });

        const publishedConfig: HospitalRoutingConfig = {
          ...draft,
          versionNumber: nextVersion,
          publishedAt: new Date().toISOString(),
          publishedBy: userName,
          changelog,
        };

        await prisma.hospitalConfigVersion.create({
          data: {
            hospitalId,
            versionNumber: nextVersion,
            isActive: true,
            changelog,
            publishedBy: userName,
            configSnapshot: { routingConfig: publishedConfig } as unknown as Prisma.InputJsonValue,
          },
        });

        await prisma.configAuditLog.create({
          data: {
            hospitalId,
            entityType: "TELEPHONY_ROUTING",
            entityId: hospitalId,
            action: "ROUTING_VERSION_PUBLISHED",
            performedBy: userName,
            userId,
            changesSummary: `Published immutable routing version v${nextVersion}: ${changelog}`,
          },
        });
      } catch (err) {
        console.warn("[RoutingService] DB publishVersion error:", err);
      }
    }

    // Update in-memory versions
    const existingVersions = inMemoryRoutingVersions.get(hospitalId) || [];
    existingVersions.forEach((v) => (v.isActive = false));
    if (existingVersions.length > 0) {
      nextVersion = Math.max(...existingVersions.map((v) => v.versionNumber)) + 1;
    }

    const publishedSnapshot: HospitalRoutingConfig = {
      ...draft,
      versionNumber: nextVersion,
      publishedAt: new Date().toISOString(),
      publishedBy: userName,
      changelog,
    };

    existingVersions.unshift({
      versionNumber: nextVersion,
      isActive: true,
      config: publishedSnapshot,
      publishedAt: new Date().toISOString(),
      publishedBy: userName,
      changelog,
    });
    inMemoryRoutingVersions.set(hospitalId, existingVersions);
    inMemoryRoutingDrafts.set(hospitalId, publishedSnapshot);

    inMemoryRoutingAudit.unshift({
      id: `audit_pub_${Date.now()}`,
      hospitalId,
      action: "ROUTING_VERSION_PUBLISHED",
      performedBy: userName,
      userId,
      summary: `Published immutable routing version v${nextVersion}: ${changelog}`,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      versionNumber: nextVersion,
    };
  }

  /**
   * Retrieves active published version (or specific historical version).
   * Invariant: Call sessions can query by versionNumber to guarantee active call immutability.
   */
  public async getPublishedVersion(
    hospitalId: string,
    versionNumber?: number
  ): Promise<HospitalRoutingConfig | null> {
    const dbStatus = await checkDatabaseConnection();

    if (dbStatus.connected) {
      try {
        const whereClause: any = { hospitalId };
        if (versionNumber) {
          whereClause.versionNumber = versionNumber;
        } else {
          whereClause.isActive = true;
        }

        const record = await prisma.hospitalConfigVersion.findFirst({
          where: whereClause,
          orderBy: { versionNumber: "desc" },
        });

        if (record && record.configSnapshot) {
          const snapshot = (record.configSnapshot as any)?.routingConfig as HospitalRoutingConfig;
          if (snapshot && snapshot.hospitalId === hospitalId) {
            return snapshot;
          }
        }
      } catch (err) {
        console.warn(`[RoutingService] DB getPublishedVersion fallback for ${hospitalId}:`, err);
      }
    }

    // In-memory fallback
    const versions = inMemoryRoutingVersions.get(hospitalId) || [];
    if (versionNumber) {
      const match = versions.find((v) => v.versionNumber === versionNumber);
      if (match) return match.config;
      // Default baseline v1 fallback for known hospital tenants
      if (versionNumber === 1 && ["hosp_daya_thrissur", "hosp_aster_medcity", "hosp_kims_trivandrum"].includes(hospitalId)) {
        return this.getDefaultRoutingConfig(hospitalId);
      }
      return null;
    }

    const active = versions.find((v) => v.isActive);
    if (active) return active.config;

    // Default baseline for known hospital tenants
    if (["hosp_daya_thrissur", "hosp_aster_medcity", "hosp_kims_trivandrum"].includes(hospitalId)) {
      return this.getDefaultRoutingConfig(hospitalId);
    }

    return null;
  }

  /**
   * Rolls back hospital routing configuration to a previous immutable version.
   */
  public async rollbackVersion(
    hospitalId: string,
    targetVersionNumber: number,
    userId = "usr_admin",
    userName = "Hospital Administrator"
  ): Promise<boolean> {
    const targetConfig = await this.getPublishedVersion(hospitalId, targetVersionNumber);
    if (!targetConfig) {
      return false;
    }

    const dbStatus = await checkDatabaseConnection();
    if (dbStatus.connected) {
      try {
        await prisma.hospitalConfigVersion.updateMany({
          where: { hospitalId, isActive: true },
          data: { isActive: false },
        });

        await prisma.hospitalConfigVersion.updateMany({
          where: { hospitalId, versionNumber: targetVersionNumber },
          data: { isActive: true },
        });

        await prisma.configAuditLog.create({
          data: {
            hospitalId,
            entityType: "TELEPHONY_ROUTING",
            entityId: hospitalId,
            action: "ROUTING_ROLLED_BACK",
            performedBy: userName,
            userId,
            changesSummary: `Rolled back routing configuration to version v${targetVersionNumber}`,
          },
        });
      } catch (err) {
        console.warn("[RoutingService] DB rollback error:", err);
      }
    }

    // In-memory update
    const versions = inMemoryRoutingVersions.get(hospitalId) || [];
    versions.forEach((v) => {
      v.isActive = v.versionNumber === targetVersionNumber;
    });
    inMemoryRoutingDrafts.set(hospitalId, { ...targetConfig });

    inMemoryRoutingAudit.unshift({
      id: `audit_rb_${Date.now()}`,
      hospitalId,
      action: "ROUTING_ROLLED_BACK",
      performedBy: userName,
      userId,
      summary: `Rolled back to v${targetVersionNumber}`,
      timestamp: new Date().toISOString(),
    });

    return true;
  }

  /**
   * Retrieves all published versions for a hospital.
   */
  public async getVersionsList(hospitalId: string): Promise<
    Array<{
      versionNumber: number;
      isActive: boolean;
      publishedAt: string;
      publishedBy: string;
      changelog: string;
    }>
  > {
    const dbStatus = await checkDatabaseConnection();
    if (dbStatus.connected) {
      try {
        const records = await prisma.hospitalConfigVersion.findMany({
          where: { hospitalId },
          orderBy: { versionNumber: "desc" },
          select: {
            versionNumber: true,
            isActive: true,
            publishedAt: true,
            publishedBy: true,
            changelog: true,
          },
        });
        if (records.length > 0) {
          return records.map((r) => ({
            versionNumber: r.versionNumber,
            isActive: r.isActive,
            publishedAt: r.publishedAt.toISOString(),
            publishedBy: r.publishedBy,
            changelog: r.changelog || "",
          }));
        }
      } catch {}
    }

    return (inMemoryRoutingVersions.get(hospitalId) || []).map((v) => ({
      versionNumber: v.versionNumber,
      isActive: v.isActive,
      publishedAt: v.publishedAt,
      publishedBy: v.publishedBy,
      changelog: v.changelog,
    }));
  }

  /**
   * Retrieves audit logs for a hospital's routing configuration.
   */
  public async getAuditHistory(hospitalId: string) {
    const dbStatus = await checkDatabaseConnection();
    if (dbStatus.connected) {
      try {
        const logs = await prisma.configAuditLog.findMany({
          where: { hospitalId, entityType: "TELEPHONY_ROUTING" },
          orderBy: { timestamp: "desc" },
          take: 30,
        });
        if (logs.length > 0) {
          return logs.map((l) => ({
            id: l.id,
            action: l.action,
            performedBy: l.performedBy,
            summary: l.changesSummary,
            timestamp: l.timestamp.toISOString(),
          }));
        }
      } catch {}
    }

    return inMemoryRoutingAudit.filter((a) => a.hospitalId === hospitalId);
  }

  /**
   * Simulates dynamic routing resolution for testing purposes without placing real calls.
   */
  public async simulateRouting(params: SimulationParams): Promise<RoutingResolutionResult> {
    const { hospitalId, escalationType, departmentId, simulatedTimeIso, versionNumber } = params;
    const config = await this.getPublishedVersion(hospitalId, versionNumber);

    if (!config) {
      return {
        success: false,
        hospitalId,
        escalationType,
        destinationNumber: "",
        departmentName: "Unknown",
        versionUsed: 0,
        isAfterHours: false,
        routingRule: "TENANT_NOT_FOUND",
        error: `Hospital tenant '${hospitalId}' does not have a published routing configuration.`,
      };
    }

    return this.resolveDestinationFromConfig(config, escalationType, departmentId, simulatedTimeIso);
  }

  /**
   * Authoritative live destination resolution for Exotel Connect Applet.
   * Resolves destination based on authenticated tenant, CallSid, and escalation state.
   */
  public async resolveLiveDestination(params: {
    hospitalId: string;
    callSid?: string;
    escalationType: EscalationType;
    departmentId?: string;
    versionNumber?: number;
    isLiveCall?: boolean;
  }): Promise<RoutingResolutionResult> {
    const { hospitalId, escalationType, departmentId, versionNumber, isLiveCall } = params;

    // Fail closed if tenant is empty or invalid
    if (!hospitalId || !hospitalId.trim()) {
      return {
        success: false,
        hospitalId: "UNKNOWN",
        escalationType,
        destinationNumber: "",
        departmentName: "Unknown",
        versionUsed: 0,
        isAfterHours: false,
        routingRule: "TENANT_INVALID_FAIL_CLOSED",
        error: "Tenant ID missing or unauthenticated. Routing failed closed.",
      };
    }

    const config = await this.getPublishedVersion(hospitalId, versionNumber);
    if (!config) {
      return {
        success: false,
        hospitalId,
        escalationType,
        destinationNumber: "",
        departmentName: "Unknown",
        versionUsed: 0,
        isAfterHours: false,
        routingRule: "TENANT_UNCONFIGURED_FAIL_CLOSED",
        error: `Hospital tenant '${hospitalId}' does not have an active published routing configuration.`,
      };
    }

    // Fail closed if live carrier call queries an unverified demo tenant
    if (isLiveCall && config.isVerified !== true) {
      return {
        success: false,
        hospitalId,
        escalationType,
        destinationNumber: "",
        departmentName: "Unverified Tenant Destination",
        versionUsed: config.versionNumber || 1,
        isAfterHours: false,
        routingRule: "UNVERIFIED_TENANT_FAIL_CLOSED",
        error: `Hospital tenant '${hospitalId}' destination numbers are unverified demo data. Live carrier routing failed closed.`,
      };
    }

    const resolved = this.resolveDestinationFromConfig(config, escalationType, departmentId);

    // Fail closed if resolved destination is not a valid E.164 phone number
    if (resolved.success && !isValidE164(resolved.destinationNumber)) {
      return {
        success: false,
        hospitalId,
        escalationType,
        destinationNumber: resolved.destinationNumber,
        departmentName: resolved.departmentName,
        versionUsed: resolved.versionUsed,
        isAfterHours: resolved.isAfterHours,
        ringTimeoutSeconds: resolved.ringTimeoutSeconds,
        aiOverflowEnabled: resolved.aiOverflowEnabled,
        routingRule: "INVALID_PHONE_NUMBER_FAIL_CLOSED",
        error: `Destination '${resolved.destinationNumber}' is not a valid E.164 phone number. Routing failed closed.`,
      };
    }

    return resolved;
  }

  private resolveDestinationFromConfig(
    config: HospitalRoutingConfig,
    escalationType: EscalationType,
    departmentId?: string,
    simulatedTimeIso?: string
  ): RoutingResolutionResult {
    const now = simulatedTimeIso ? new Date(simulatedTimeIso) : new Date();
    const versionUsed = config.versionNumber || 1;
    const ringTimeoutSeconds = config.receptionistRingTimeoutSeconds || 20;
    const aiOverflowEnabled = config.aiOverflowEnabled !== false;
    const isAfterHours = !isWithinBusinessHours(config.businessHours, now);

    // 1. EMERGENCY Escalation (Bypasses business hours and AI overflow)
    if (escalationType === "EMERGENCY" || escalationType === "EMERGENCY_TRANSFER") {
      const emergencyPstnEnabled = config.emergencyDestination.emergencyPstnTransferEnabled === true;
      const destNumber = config.emergencyDestination.primaryNumber;

      // CRITICAL SAFETY GUARD (Phase 10.14):
      // When emergencyPstnTransferEnabled=false, do NOT return a dialable emergency destination over PSTN.
      // Fail closed immediately so Exotel takes the documented Failed branch.
      // Do NOT silently redirect emergency callers to AI.
      if (!emergencyPstnEnabled) {
        return {
          success: false,
          hospitalId: config.hospitalId,
          escalationType: "EMERGENCY",
          destinationNumber: "",
          departmentName: config.emergencyDestination.departmentName || "Casualty Department",
          versionUsed,
          isAfterHours: false, // Emergency always bypasses after-hours
          routingRule: "EMERGENCY_PSTN_TRANSFER_DISABLED_FAIL_CLOSED",
          ringTimeoutSeconds: 0,
          aiOverflowEnabled: false, // Strict: Never redirect emergency callers to AI
          receiverClassification:
            config.emergencyDestination.receiverClassification || "TEMPORARY_DEV_TEST_RECEIVER",
          emergencyPstnTransferEnabled: false,
          error:
            "EMERGENCY_PSTN_TRANSFER_DISABLED: Live carrier emergency PSTN transfer is disabled for this tenant. Development test receiver cannot be dialed over live PSTN.",
        };
      }

      return {
        success: Boolean(destNumber && isValidE164(destNumber)),
        hospitalId: config.hospitalId,
        escalationType: "EMERGENCY",
        destinationNumber: destNumber,
        departmentName: config.emergencyDestination.departmentName || "Casualty Department",
        versionUsed,
        isAfterHours: false, // Emergency always bypasses after-hours
        routingRule:
          escalationType === "EMERGENCY_TRANSFER"
            ? "EMERGENCY_TRANSFER_DIRECT_ROUTING"
            : "EMERGENCY_DIRECT_ROUTING",
        ringTimeoutSeconds: 25,
        aiOverflowEnabled: false,
        receiverClassification:
          config.emergencyDestination.receiverClassification || "TEMPORARY_DEV_TEST_RECEIVER",
        emergencyPstnTransferEnabled: true,
      };
    }

    // 2. AFTER_HOURS Escalation or Automatic Schedule Evaluation for General/Reception Calls
    if (escalationType === "AFTER_HOURS" || (isAfterHours && escalationType === "HUMAN_TRANSFER")) {
      const destNumber =
        config.afterHoursDestination.primaryNumber || config.emergencyDestination.primaryNumber;
      const ruleName =
        isAfterHours && escalationType === "HUMAN_TRANSFER"
          ? "AFTER_HOURS_AUTOMATIC_SCHEDULE_OVERRIDE"
          : "AFTER_HOURS_ESCALATION";

      return {
        success: Boolean(destNumber && isValidE164(destNumber)),
        hospitalId: config.hospitalId,
        escalationType: "AFTER_HOURS",
        destinationNumber: destNumber,
        departmentName: "After-Hours On-Duty Desk",
        versionUsed,
        isAfterHours: true,
        routingRule: ruleName,
        ringTimeoutSeconds,
        aiOverflowEnabled,
      };
    }

    // 3. SPECIFIC DEPARTMENT Escalation
    if (escalationType === "DEPARTMENT" && departmentId) {
      const match = config.departmentDestinations.find((d) => d.id === departmentId);
      if (match && match.phoneNumber && isValidE164(match.phoneNumber)) {
        return {
          success: true,
          hospitalId: config.hospitalId,
          escalationType: "DEPARTMENT",
          destinationNumber: match.phoneNumber,
          departmentName: match.name,
          versionUsed,
          isAfterHours,
          routingRule: `DEPARTMENT_DIRECT_ROUTING:${match.id}`,
          ringTimeoutSeconds,
          aiOverflowEnabled,
        };
      }
    }

    // 4. HUMAN_TRANSFER (Front desk reception)
    if (escalationType === "HUMAN_TRANSFER") {
      const destNumber = config.receptionistDestination.primaryNumber;
      return {
        success: Boolean(destNumber && isValidE164(destNumber)),
        hospitalId: config.hospitalId,
        escalationType: "HUMAN_TRANSFER",
        destinationNumber: destNumber,
        departmentName: config.receptionistDestination.departmentName || "General Reception",
        versionUsed,
        isAfterHours: false,
        routingRule: "RECEPTIONIST_STANDARD_ROUTING",
        ringTimeoutSeconds,
        aiOverflowEnabled,
      };
    }

    // 5. HUMAN FALLBACK
    if (escalationType === "FALLBACK") {
      const destNumber =
        config.humanFallbackDestination.primaryNumber || config.receptionistDestination.primaryNumber;
      return {
        success: Boolean(destNumber && isValidE164(destNumber)),
        hospitalId: config.hospitalId,
        escalationType: "FALLBACK",
        destinationNumber: destNumber,
        departmentName: "Supervisor Fallback Desk",
        versionUsed,
        isAfterHours: false,
        routingRule: "HUMAN_FALLBACK_ROUTING",
        ringTimeoutSeconds,
        aiOverflowEnabled: false,
      };
    }

    // Normal or unspecified completion
    return {
      success: false,
      hospitalId: config.hospitalId,
      escalationType: "NONE",
      destinationNumber: "",
      departmentName: "None",
      versionUsed,
      isAfterHours: false,
      routingRule: "NO_ESCALATION_NORMAL_COMPLETION",
      ringTimeoutSeconds,
      aiOverflowEnabled,
      error: "No escalation was requested. Call completed normally.",
    };
  }
}

export const hospitalRoutingService = new HospitalRoutingService();
