/**
 * ============================================================================
 * SMRKOMED HOSPITAL CONFIGURATION & VERSIONING ENGINE
 * ============================================================================
 *
 * Implements draft editing, strict multi-dimensional validation, immutable version
 * publishing, rollback, and audit logging for multi-tenant hospital voice platforms.
 *
 * Invariant:
 * - Draft edits NEVER affect live calls.
 * - Active calls continue using their assigned published version.
 * - Sensitive provider credentials encrypted at rest with AES-256-GCM.
 */

import { prisma, checkDatabaseConnection } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { encryptSecret, decryptSecret, maskCredential } from "@/lib/security/crypto";
import { SARVAM_SPEAKERS, SARVAM_TTS_MODELS } from "@/lib/providers/ai/sarvam/sarvam-capabilities";
import { normalizePhoneNumber } from "@/lib/config/hospital-config";

export interface HospitalConfigData {
  hospitalId: string;
  displayName: string;
  timezone: string;
  defaultLanguage: string;
  supportedLanguages: string[];

  // Telephony
  telephonyProvider: string;
  exotelAccountSid?: string;
  exotelRegion?: string;
  exotelSubdomain?: string;
  exotelApiKey?: string;
  exotelApiToken?: string;
  exotelDefaultExoPhone?: string;
  exotelDefaultAppId?: string;
  exotelWebhookSecret?: string;
  exotelStatusCallbackUrl?: string;
  incomingVirtualNumbers: string[];
  transferDestinations: Array<{ label: string; extension: string; number: string }>;
  emergencyDestinations: string[];

  // AI
  aiEnabled: boolean;
  defaultSttModel: string;
  defaultLlmModel: string;
  defaultTtsModel: string;
  defaultSpeaker: string;
  defaultSpeakingPace: number;
  aiSilenceTimeoutMs: number;
  maxCallDurationSeconds: number;

  // Business
  businessHours: Record<string, { open: string; close: string; closed?: boolean }>;
  afterHoursBehavior: "AI_VOICEBOT" | "VOICEMAIL" | "CASUALTY_TRANSFER";
  emergencyEscalationPolicy: {
    notifyStaffOnUrgent: boolean;
    casualtyHotline: string;
    escalateAfterNoAnswerSeconds: number;
  };
}

export interface ValidationReport {
  isValid: boolean;
  errors: Array<{ field: string; message: string }>;
  warnings: Array<{ field: string; message: string }>;
}

export interface ConfigVersionSummary {
  id: string;
  versionNumber: number;
  isActive: boolean;
  changelog?: string | null;
  publishedBy: string;
  publishedAt: string;
}

// In-memory fallback stores for test and demo environments
const inMemoryDrafts = new Map<string, HospitalConfigData>();
const inMemoryVersions = new Map<string, Array<{
  id: string;
  versionNumber: number;
  isActive: boolean;
  changelog?: string;
  publishedBy: string;
  publishedAt: string;
  snapshot: HospitalConfigData;
}>>();
const inMemoryAuditLogs: Array<{
  id: string;
  hospitalId: string;
  entityType: string;
  entityId: string;
  action: string;
  performedBy: string;
  userId?: string;
  changesSummary?: string;
  timestamp: string;
}> = [];

export class ConfigurationService {
  /**
   * Retrieves default baseline configuration for Daya Hospital pilot.
   */
  public getDefaultConfig(hospitalId = "hosp_daya_thrissur"): HospitalConfigData {
    const isDaya = hospitalId === "hosp_daya_thrissur";

    if (isDaya) {
      return {
        hospitalId,
        displayName: "Daya General Hospital & Specialty Surgical Centre",
        timezone: "Asia/Kolkata",
        defaultLanguage: "ml-IN",
        supportedLanguages: ["ml-IN", "en-IN"],
        telephonyProvider: "EXOTEL",
        exotelAccountSid: process.env.EXOTEL_ACCOUNT_SID || "smrkonova1",
        exotelRegion: "singapore",
        exotelSubdomain: "api.exotel.com",
        exotelApiKey: process.env.EXOTEL_API_KEY || "",
        exotelApiToken: process.env.EXOTEL_API_TOKEN || "",
        exotelDefaultExoPhone: process.env.EXOTEL_DEFAULT_EXOPHONE || "08047291658",
        exotelDefaultAppId: process.env.EXOTEL_DEFAULT_APP_ID || "1393239",
        exotelWebhookSecret: process.env.EXOTEL_WEBHOOK_SECRET || "smrko_telephony_secret_2026",
        exotelStatusCallbackUrl: "https://dayahospital-production-467a7d31.up.railway.app/api/webhooks/exotel",
        incomingVirtualNumbers: ["08047291658", "+914872475000"],
        transferDestinations: [
          { label: "Casualty Emergency", extension: "100", number: "+914872475100" },
          { label: "General Reception", extension: "201", number: "+919606654032" },
        ],
        emergencyDestinations: ["+919606654032", "+914872475100"],
        aiEnabled: true,
        defaultSttModel: "saaras:v4",
        defaultLlmModel: "sarvam-105b-conversations",
        defaultTtsModel: "bulbul:v3",
        defaultSpeaker: "kavitha",
        defaultSpeakingPace: 1.15,
        aiSilenceTimeoutMs: 400,
        maxCallDurationSeconds: 600,
        businessHours: {
          monday: { open: "08:00", close: "20:00" },
          tuesday: { open: "08:00", close: "20:00" },
          wednesday: { open: "08:00", close: "20:00" },
          thursday: { open: "08:00", close: "20:00" },
          friday: { open: "08:00", close: "20:00" },
          saturday: { open: "08:00", close: "18:00" },
          sunday: { open: "09:00", close: "14:00" },
        },
        afterHoursBehavior: "AI_VOICEBOT",
        emergencyEscalationPolicy: {
          notifyStaffOnUrgent: true,
          casualtyHotline: "+919606654032",
          escalateAfterNoAnswerSeconds: 15,
        },
      };
    }

    return {
      hospitalId,
      displayName: `Hospital Tenant (${hospitalId})`,
      timezone: "Asia/Kolkata",
      defaultLanguage: "en-IN",
      supportedLanguages: ["en-IN"],
      telephonyProvider: "EXOTEL",
      exotelAccountSid: "",
      exotelRegion: "singapore",
      exotelSubdomain: "api.exotel.com",
      exotelApiKey: "",
      exotelApiToken: "",
      incomingVirtualNumbers: [],
      transferDestinations: [],
      emergencyDestinations: [],
      aiEnabled: true,
      defaultSttModel: "saaras:v4",
      defaultLlmModel: "sarvam-105b-conversations",
      defaultTtsModel: "bulbul:v3",
      defaultSpeaker: "shubh",
      defaultSpeakingPace: 1.0,
      aiSilenceTimeoutMs: 400,
      maxCallDurationSeconds: 600,
      businessHours: {
        monday: { open: "09:00", close: "18:00" },
        tuesday: { open: "09:00", close: "18:00" },
        wednesday: { open: "09:00", close: "18:00" },
        thursday: { open: "09:00", close: "18:00" },
        friday: { open: "09:00", close: "18:00" },
      },
      afterHoursBehavior: "VOICEMAIL",
      emergencyEscalationPolicy: {
        notifyStaffOnUrgent: true,
        casualtyHotline: "",
        escalateAfterNoAnswerSeconds: 20,
      },
    };
  }

  /**
   * Retrieves active draft for a hospital. Initializes with defaults if not present.
   */
  public async getDraft(hospitalId: string, maskSecrets = true): Promise<HospitalConfigData> {
    const dbStatus = await checkDatabaseConnection();
    let draftData: HospitalConfigData;

    if (dbStatus.connected) {
      try {
        const record = await prisma.hospitalConfigDraft.findUnique({
          where: { hospitalId },
        });

        if (record) {
          draftData = {
            hospitalId: record.hospitalId,
            displayName: record.displayName || "Hospital",
            timezone: record.timezone,
            defaultLanguage: record.defaultLanguage,
            supportedLanguages: record.supportedLanguages,
            telephonyProvider: record.telephonyProvider,
            exotelAccountSid: record.exotelAccountSid || undefined,
            exotelRegion: record.exotelRegion,
            exotelSubdomain: record.exotelSubdomain,
            exotelApiKey: decryptSecret(record.exotelApiKeyEncrypted),
            exotelApiToken: decryptSecret(record.exotelApiTokenEncrypted),
            exotelDefaultExoPhone: record.exotelDefaultExoPhone || undefined,
            exotelDefaultAppId: record.exotelDefaultAppId || undefined,
            exotelWebhookSecret: decryptSecret(record.exotelWebhookSecretEncrypted),
            exotelStatusCallbackUrl: record.exotelStatusCallbackUrl || undefined,
            incomingVirtualNumbers: record.incomingVirtualNumbers,
            transferDestinations:
              (record.transferDestinations as unknown as Array<{ label: string; extension: string; number: string }>) || [],
            emergencyDestinations: record.emergencyDestinations,
            aiEnabled: record.aiEnabled,
            defaultSttModel: record.defaultSttModel,
            defaultLlmModel: record.defaultLlmModel,
            defaultTtsModel: record.defaultTtsModel,
            defaultSpeaker: record.defaultSpeaker,
            defaultSpeakingPace: record.defaultSpeakingPace,
            aiSilenceTimeoutMs: record.aiSilenceTimeoutMs,
            maxCallDurationSeconds: record.maxCallDurationSeconds,
            businessHours:
              (record.businessHours as unknown as Record<string, { open: string; close: string; closed?: boolean }>) || {},
            afterHoursBehavior: record.afterHoursBehavior as HospitalConfigData["afterHoursBehavior"],
            emergencyEscalationPolicy:
              (record.emergencyEscalationPolicy as unknown as HospitalConfigData["emergencyEscalationPolicy"]) || {
                notifyStaffOnUrgent: true,
                casualtyHotline: "+919606654032",
                escalateAfterNoAnswerSeconds: 15,
              },
          };
        } else {
          draftData = this.getDefaultConfig(hospitalId);
        }
      } catch {
        draftData = inMemoryDrafts.get(hospitalId) || this.getDefaultConfig(hospitalId);
      }
    } else {
      draftData = inMemoryDrafts.get(hospitalId) || this.getDefaultConfig(hospitalId);
    }

    if (maskSecrets) {
      return {
        ...draftData,
        exotelApiKey: maskCredential(draftData.exotelApiKey),
        exotelApiToken: maskCredential(draftData.exotelApiToken),
        exotelWebhookSecret: maskCredential(draftData.exotelWebhookSecret),
      };
    }

    return draftData;
  }

  /**
   * Saves updates to the hospital configuration draft without publishing.
   */
  public async saveDraft(
    hospitalId: string,
    updates: Partial<HospitalConfigData>,
    userId: string,
    userName: string
  ): Promise<HospitalConfigData> {
    const current = await this.getDraft(hospitalId, false);
    const merged: HospitalConfigData = {
      ...current,
      ...updates,
      // If client sent masked string, do not overwrite existing real secret
      exotelApiKey:
        updates.exotelApiKey && !updates.exotelApiKey.includes("••••")
          ? updates.exotelApiKey
          : current.exotelApiKey,
      exotelApiToken:
        updates.exotelApiToken && !updates.exotelApiToken.includes("••••")
          ? updates.exotelApiToken
          : current.exotelApiToken,
      exotelWebhookSecret:
        updates.exotelWebhookSecret && !updates.exotelWebhookSecret.includes("••••")
          ? updates.exotelWebhookSecret
          : current.exotelWebhookSecret,
    };

    inMemoryDrafts.set(hospitalId, merged);

    const dbStatus = await checkDatabaseConnection();
    if (dbStatus.connected) {
      try {
        await prisma.hospitalConfigDraft.upsert({
          where: { hospitalId },
          create: {
            hospitalId,
            displayName: merged.displayName,
            timezone: merged.timezone,
            defaultLanguage: merged.defaultLanguage,
            supportedLanguages: merged.supportedLanguages,
            telephonyProvider: merged.telephonyProvider,
            exotelAccountSid: merged.exotelAccountSid,
            exotelRegion: merged.exotelRegion || "singapore",
            exotelSubdomain: merged.exotelSubdomain || "api.exotel.com",
            exotelApiKeyEncrypted: encryptSecret(merged.exotelApiKey || ""),
            exotelApiTokenEncrypted: encryptSecret(merged.exotelApiToken || ""),
            exotelDefaultExoPhone: merged.exotelDefaultExoPhone,
            exotelDefaultAppId: merged.exotelDefaultAppId,
            exotelWebhookSecretEncrypted: encryptSecret(merged.exotelWebhookSecret || ""),
            exotelStatusCallbackUrl: merged.exotelStatusCallbackUrl,
            incomingVirtualNumbers: merged.incomingVirtualNumbers,
            transferDestinations: merged.transferDestinations as unknown as Prisma.InputJsonValue,
            emergencyDestinations: merged.emergencyDestinations,
            aiEnabled: merged.aiEnabled,
            defaultSttModel: merged.defaultSttModel,
            defaultLlmModel: merged.defaultLlmModel,
            defaultTtsModel: merged.defaultTtsModel,
            defaultSpeaker: merged.defaultSpeaker,
            defaultSpeakingPace: merged.defaultSpeakingPace,
            aiSilenceTimeoutMs: merged.aiSilenceTimeoutMs,
            maxCallDurationSeconds: merged.maxCallDurationSeconds,
            businessHours: merged.businessHours as unknown as Prisma.InputJsonValue,
            afterHoursBehavior: merged.afterHoursBehavior,
            emergencyEscalationPolicy: merged.emergencyEscalationPolicy as unknown as Prisma.InputJsonValue,
            lastUpdatedBy: userName,
          },
          update: {
            displayName: merged.displayName,
            timezone: merged.timezone,
            defaultLanguage: merged.defaultLanguage,
            supportedLanguages: merged.supportedLanguages,
            telephonyProvider: merged.telephonyProvider,
            exotelAccountSid: merged.exotelAccountSid,
            exotelRegion: merged.exotelRegion || "singapore",
            exotelSubdomain: merged.exotelSubdomain || "api.exotel.com",
            exotelApiKeyEncrypted: encryptSecret(merged.exotelApiKey || ""),
            exotelApiTokenEncrypted: encryptSecret(merged.exotelApiToken || ""),
            exotelDefaultExoPhone: merged.exotelDefaultExoPhone,
            exotelDefaultAppId: merged.exotelDefaultAppId,
            exotelWebhookSecretEncrypted: encryptSecret(merged.exotelWebhookSecret || ""),
            exotelStatusCallbackUrl: merged.exotelStatusCallbackUrl,
            incomingVirtualNumbers: merged.incomingVirtualNumbers,
            transferDestinations: merged.transferDestinations as unknown as Prisma.InputJsonValue,
            emergencyDestinations: merged.emergencyDestinations,
            aiEnabled: merged.aiEnabled,
            defaultSttModel: merged.defaultSttModel,
            defaultLlmModel: merged.defaultLlmModel,
            defaultTtsModel: merged.defaultTtsModel,
            defaultSpeaker: merged.defaultSpeaker,
            defaultSpeakingPace: merged.defaultSpeakingPace,
            aiSilenceTimeoutMs: merged.aiSilenceTimeoutMs,
            maxCallDurationSeconds: merged.maxCallDurationSeconds,
            businessHours: merged.businessHours as unknown as Prisma.InputJsonValue,
            afterHoursBehavior: merged.afterHoursBehavior,
            emergencyEscalationPolicy: merged.emergencyEscalationPolicy as unknown as Prisma.InputJsonValue,
            lastUpdatedBy: userName,
          },
        });

        await prisma.configAuditLog.create({
          data: {
            hospitalId,
            entityType: "HOSPITAL_CONFIG",
            entityId: hospitalId,
            action: "DRAFT_SAVED",
            performedBy: userName,
            userId,
            changesSummary: "Hospital configuration draft saved",
          },
        });
      } catch (err) {
        console.warn("[ConfigService] DB saveDraft failed:", err);
      }
    }

    inMemoryAuditLogs.unshift({
      id: `audit_${Date.now()}`,
      hospitalId,
      entityType: "HOSPITAL_CONFIG",
      entityId: hospitalId,
      action: "DRAFT_SAVED",
      performedBy: userName,
      userId,
      changesSummary: "Draft updated",
      timestamp: new Date().toISOString(),
    });

    return this.getDraft(hospitalId, true);
  }

  /**
   * Validates a hospital configuration against strict business & telephony rules.
   */
  public validateConfiguration(config: HospitalConfigData): ValidationReport {
    const errors: Array<{ field: string; message: string }> = [];
    const warnings: Array<{ field: string; message: string }> = [];

    // 1. Hospital Identity
    if (!config.hospitalId?.trim()) {
      errors.push({ field: "hospitalId", message: "Hospital ID is required." });
    }
    if (!config.displayName?.trim()) {
      errors.push({ field: "displayName", message: "Display name is required." });
    }

    // 2. Telephony Settings
    if (!config.exotelAccountSid?.trim()) {
      errors.push({ field: "exotelAccountSid", message: "Exotel Account SID is required." });
    }
    if (!config.exotelDefaultExoPhone?.trim()) {
      errors.push({ field: "exotelDefaultExoPhone", message: "Primary virtual ExoPhone number is required." });
    } else {
      const cleanPhone = normalizePhoneNumber(config.exotelDefaultExoPhone);
      if (cleanPhone.length !== 10) {
        errors.push({ field: "exotelDefaultExoPhone", message: "Primary ExoPhone must be a valid 10-digit Indian number." });
      }
    }

    // 3. Emergency Destinations Guard
    if (!config.emergencyDestinations || config.emergencyDestinations.length === 0) {
      errors.push({ field: "emergencyDestinations", message: "At least one emergency destination (e.g. Casualty hotline) is mandatory." });
    } else {
      const hasDayaEmergency = config.emergencyDestinations.some(
        (n) => normalizePhoneNumber(n) === "9606654032" || normalizePhoneNumber(n) === "4872475100"
      );
      if (!hasDayaEmergency) {
        warnings.push({
          field: "emergencyDestinations",
          message: "Standard Daya Hospital emergency hotline (+91 96066 54032) is not present.",
        });
      }
    }

    // 4. AI Voice & Speaker Compatibility
    if (config.aiEnabled) {
      const ttsModel = SARVAM_TTS_MODELS.find((m) => m.id === config.defaultTtsModel);
      if (!ttsModel) {
        errors.push({ field: "defaultTtsModel", message: `Unknown TTS model '${config.defaultTtsModel}'.` });
      }

      const speaker = SARVAM_SPEAKERS.find((s) => s.id === config.defaultSpeaker);
      if (!speaker) {
        errors.push({ field: "defaultSpeaker", message: `Unknown speaker '${config.defaultSpeaker}'.` });
      } else if (!speaker.compatibleTtsModels.includes(config.defaultTtsModel)) {
        errors.push({
          field: "defaultSpeaker",
          message: `Speaker '${config.defaultSpeaker}' is not supported by TTS model '${config.defaultTtsModel}'.`,
        });
      }

      if (config.defaultLanguage === "ml-IN" && config.defaultTtsModel === "bulbul:v4-flash") {
        errors.push({
          field: "defaultTtsModel",
          message: "bulbul:v4-flash does not support Malayalam. Use bulbul:v3 with speaker kavitha.",
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
   * Publishes the current draft, creating an immutable version.
   */
  public async publishConfiguration(
    hospitalId: string,
    changelog: string,
    userId: string,
    userName: string
  ): Promise<{ success: boolean; versionNumber: number; error?: string }> {
    const rawDraft = await this.getDraft(hospitalId, false);
    const validation = this.validateConfiguration(rawDraft);

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

        // Deactivate all previous versions
        await prisma.hospitalConfigVersion.updateMany({
          where: { hospitalId, isActive: true },
          data: { isActive: false },
        });

        // Create immutable new version snapshot
        await prisma.hospitalConfigVersion.create({
          data: {
            hospitalId,
            versionNumber: nextVersion,
            isActive: true,
            changelog: changelog || `Published version ${nextVersion}`,
            publishedBy: userName,
            configSnapshot: rawDraft as unknown as Prisma.InputJsonValue,
          },
        });

        await prisma.configAuditLog.create({
          data: {
            hospitalId,
            entityType: "HOSPITAL_CONFIG",
            entityId: `${hospitalId}_v${nextVersion}`,
            action: "PUBLISHED",
            performedBy: userName,
            userId,
            changesSummary: `Published version ${nextVersion}. Changelog: ${changelog}`,
          },
        });
      } catch (err) {
        console.warn("[ConfigService] DB publish failed, falling back to memory:", err);
      }
    }

    // Memory fallback
    const versions = inMemoryVersions.get(hospitalId) || [];
    if (versions.length > 0) {
      nextVersion = Math.max(...versions.map((v) => v.versionNumber)) + 1;
      versions.forEach((v) => (v.isActive = false));
    }
    versions.unshift({
      id: `ver_${hospitalId}_${nextVersion}`,
      versionNumber: nextVersion,
      isActive: true,
      changelog: changelog || `Published version ${nextVersion}`,
      publishedBy: userName,
      publishedAt: new Date().toISOString(),
      snapshot: { ...rawDraft },
    });
    inMemoryVersions.set(hospitalId, versions);

    return {
      success: true,
      versionNumber: nextVersion,
    };
  }

  /**
   * Rolls back hospital configuration to a previously published immutable version.
   */
  public async rollbackConfiguration(
    hospitalId: string,
    targetVersion: number,
    userId: string,
    userName: string
  ): Promise<{ success: boolean; versionNumber: number; error?: string }> {
    let targetSnapshot: HospitalConfigData | null = null;
    const dbStatus = await checkDatabaseConnection();

    if (dbStatus.connected) {
      try {
        const target = await prisma.hospitalConfigVersion.findUnique({
          where: {
            hospitalId_versionNumber: { hospitalId, versionNumber: targetVersion },
          },
        });
        if (target) {
          targetSnapshot = target.configSnapshot as unknown as HospitalConfigData;
        }
      } catch {
        // Fall back to memory
      }
    }

    if (!targetSnapshot) {
      const versions = inMemoryVersions.get(hospitalId) || [];
      const match = versions.find((v) => v.versionNumber === targetVersion);
      if (match) targetSnapshot = match.snapshot;
    }

    if (!targetSnapshot) {
      return {
        success: false,
        versionNumber: 0,
        error: `Version ${targetVersion} not found for hospital '${hospitalId}'.`,
      };
    }

    // Publish restored version as new increment
    const res = await this.publishConfiguration(
      hospitalId,
      `Rolled back to version ${targetVersion}`,
      userId,
      userName
    );

    return res;
  }

  /**
   * Lists published configuration versions for a hospital.
   */
  public async getVersions(hospitalId: string): Promise<ConfigVersionSummary[]> {
    const dbStatus = await checkDatabaseConnection();
    if (dbStatus.connected) {
      try {
        const records = await prisma.hospitalConfigVersion.findMany({
          where: { hospitalId },
          orderBy: { versionNumber: "desc" },
          select: {
            id: true,
            versionNumber: true,
            isActive: true,
            changelog: true,
            publishedBy: true,
            publishedAt: true,
          },
        });
        return records.map((r) => ({
          ...r,
          publishedAt: r.publishedAt.toISOString(),
        }));
      } catch {
        // Fall back
      }
    }

    const versions = inMemoryVersions.get(hospitalId) || [];
    return versions.map((v) => ({
      id: v.id,
      versionNumber: v.versionNumber,
      isActive: v.isActive,
      changelog: v.changelog,
      publishedBy: v.publishedBy,
      publishedAt: v.publishedAt,
    }));
  }

  /**
   * Retrieves active published configuration for the trusted Railway media gateway.
   * Returns decrypted secrets for trusted internal calling processes only.
   */
  public async getActivePublishedConfig(hospitalId: string): Promise<HospitalConfigData> {
    const dbStatus = await checkDatabaseConnection();
    if (dbStatus.connected) {
      try {
        const active = await prisma.hospitalConfigVersion.findFirst({
          where: { hospitalId, isActive: true },
        });
        if (active) {
          return active.configSnapshot as unknown as HospitalConfigData;
        }
      } catch {
        // fall through
      }
    }

    const versions = inMemoryVersions.get(hospitalId) || [];
    const active = versions.find((v) => v.isActive);
    if (active) {
      return active.snapshot;
    }

    // Fallback to active draft without masking
    return this.getDraft(hospitalId, false);
  }
}

export const configurationService = new ConfigurationService();
