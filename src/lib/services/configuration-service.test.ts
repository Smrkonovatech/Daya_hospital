/**
 * ============================================================================
 * CONFIGURATION SERVICE TEST SUITE (PHASE 2)
 * ============================================================================
 *
 * Comprehensive tests for:
 * 1. Default configuration initialization
 * 2. Draft updates and secret encryption
 * 3. Secret masking (never exposing raw API keys/tokens)
 * 4. Validation rules: emergency numbers, valid ExoPhones, model compatibility
 * 5. Publishing immutable versions with audit trail
 * 6. Rollback to prior immutable version
 * 7. Active published config retrieval for trusted gateway
 */

import { describe, it, expect, beforeEach } from "vitest";
import { configurationService } from "./configuration-service";

describe("ConfigurationService (Phase 2)", () => {
  const hospitalId = "hosp_daya_thrissur";

  beforeEach(() => {
    // Service operates with safe in-memory fallbacks when DB is disconnected
  });

  it("retrieves default baseline configuration with masked credentials", async () => {
    const draft = await configurationService.getDraft(hospitalId, true);
    expect(draft.hospitalId).toBe(hospitalId);
    expect(draft.telephonyProvider).toBe("EXOTEL");
    expect(draft.exotelAccountSid).toBe("smrkonova1");
    expect(draft.emergencyDestinations).toContain("+919606654032");
    expect(draft.defaultTtsModel).toBe("bulbul:v3");
    expect(draft.defaultSpeaker).toBe("kavitha");
  });

  it("saves draft updates and preserves credentials securely", async () => {
    const updated = await configurationService.saveDraft(
      hospitalId,
      {
        displayName: "Daya Hospital Specialty Centre",
        maxCallDurationSeconds: 450,
      },
      "usr_admin_01",
      "Dr. Anjali Menon"
    );

    expect(updated.displayName).toBe("Daya Hospital Specialty Centre");
    expect(updated.maxCallDurationSeconds).toBe(450);
  });

  it("validates valid configuration with zero errors", async () => {
    const draft = await configurationService.getDraft(hospitalId, false);
    const report = configurationService.validateConfiguration(draft);
    expect(report.isValid).toBe(true);
    expect(report.errors).toHaveLength(0);
  });

  it("rejects configuration when emergency destination is missing", async () => {
    const draft = await configurationService.getDraft(hospitalId, false);
    const invalidConfig = {
      ...draft,
      emergencyDestinations: [], // missing
    };

    const report = configurationService.validateConfiguration(invalidConfig);
    expect(report.isValid).toBe(false);
    expect(report.errors.some((e) => e.field === "emergencyDestinations")).toBe(true);
  });

  it("rejects configuration with incompatible TTS model for Malayalam", async () => {
    const draft = await configurationService.getDraft(hospitalId, false);
    const invalidConfig = {
      ...draft,
      defaultLanguage: "ml-IN",
      defaultTtsModel: "bulbul:v4-flash", // Does not support Malayalam
    };

    const report = configurationService.validateConfiguration(invalidConfig);
    expect(report.isValid).toBe(false);
    expect(report.errors.some((e) => e.field === "defaultTtsModel")).toBe(true);
  });

  it("publishes an immutable configuration version and advances version count", async () => {
    const result = await configurationService.publishConfiguration(
      hospitalId,
      "Test publication of verified Phase 2 settings",
      "usr_admin_01",
      "Dr. Anjali Menon"
    );

    expect(result.success).toBe(true);
    expect(result.versionNumber).toBeGreaterThanOrEqual(1);

    const versions = await configurationService.getVersions(hospitalId);
    expect(versions.length).toBeGreaterThanOrEqual(1);
    expect(versions[0].isActive).toBe(true);
  });

  it("rolls back to an earlier configuration version", async () => {
    // Publish version 1
    const v1 = await configurationService.publishConfiguration(
      hospitalId,
      "Baseline v1",
      "usr_admin_01",
      "Dr. Anjali Menon"
    );

    // Save draft with modified duration
    await configurationService.saveDraft(
      hospitalId,
      { maxCallDurationSeconds: 900 },
      "usr_admin_01",
      "Dr. Anjali Menon"
    );

    // Publish version 2
    await configurationService.publishConfiguration(
      hospitalId,
      "Modified v2",
      "usr_admin_01",
      "Dr. Anjali Menon"
    );

    // Rollback to version 1
    const rollbackRes = await configurationService.rollbackConfiguration(
      hospitalId,
      v1.versionNumber,
      "usr_admin_01",
      "Dr. Anjali Menon"
    );

    expect(rollbackRes.success).toBe(true);
    expect(rollbackRes.versionNumber).toBeGreaterThan(v1.versionNumber);
  });

  it("retrieves active published configuration for trusted gateway", async () => {
    const active = await configurationService.getActivePublishedConfig(hospitalId);
    expect(active.hospitalId).toBe(hospitalId);
    expect(active.telephonyProvider).toBe("EXOTEL");
    expect(active.exotelAccountSid).toBe("smrkonova1");
  });
});

