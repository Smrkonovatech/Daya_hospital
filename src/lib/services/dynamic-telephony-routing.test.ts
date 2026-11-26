/**
 * ============================================================================
 * SMRKOMED DYNAMIC HOSPITAL TELEPHONY ROUTING & MULTI-TENANT TEST SUITE
 * ============================================================================
 *
 * Validates the tenant-aware, dashboard-managed telephony routing engine:
 * 1. Multi-tenant destination resolution across multiple distinct hospital tenants.
 * 2. Changing a tenant's number via dashboard/service and publishing a new version:
 *    Exotel Connect Applet endpoint immediately resolves the new number WITHOUT changing the Exotel applet.
 * 3. In-flight call version pinning: Active call on v1 retains v1 number; new call on v2 gets v2 number.
 * 4. Rollback to previous version immediately restores v1 number for new calls.
 * 5. Receptionist ring timeout is dynamically reflected in Exotel's max_ringing_duration.
 * 6. AI overflow toggle:
 *    - Enabled: Busy/unanswered receptionist calls overflow to Sarvam Voice Agent.
 *    - Disabled: Busy/unanswered calls route to human fallback.
 * 7. Business hours schedule: In-hours route to reception; after-hours route to casualty/after-hours destination.
 * 8. Additional receptionist numbers (multi-agent hunt group support).
 * 9. Strict anti-leakage: No tenant can ever access another tenant's numbers or fall back to Daya's numbers.
 * 10. Fail closed: Unconfigured or unverified tenants fail closed cleanly.
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import {
  hospitalRoutingService,
  HospitalRoutingConfig,
  formatE164,
  isValidE164,
  isWithinBusinessHours,
} from "./hospital-routing-service";
import { dynamicExotelRoutingAdapter } from "./dynamic-exotel-routing-adapter";
import { mediaSessionManager, EscalationDecisionRecord } from "@/media-gateway/session-manager";
import { GET as handleConnectDestination } from "@/app/api/webhooks/exotel/connect-destination/route";
import { GET as handleCanonicalDestination } from "@/app/api/v1/telephony/routing/destination/route";
import { GET as handleCanonicalDecision } from "@/app/api/v1/telephony/routing/decision/route";

describe("Dynamic Hospital Telephony Routing & Multi-Tenant Engine", () => {
  const TEST_TENANT = "hosp_city_clinic";
  const INITIAL_EMERGENCY = "+919800000001";
  const INITIAL_RECEPTION = "+919800000002";
  const UPDATED_EMERGENCY = "+919800000011";
  const UPDATED_RECEPTION = "+919800000022";

  beforeAll(async () => {
    await hospitalRoutingService.purgeTenantState(TEST_TENANT);
    await hospitalRoutingService.purgeTenantState("hosp_invalid_phone_test");
    await hospitalRoutingService.purgeTenantState("hosp_daya_thrissur");
    hospitalRoutingService.resetInMemoryState();
  });

  afterAll(async () => {
    await hospitalRoutingService.purgeTenantState(TEST_TENANT);
    await hospitalRoutingService.purgeTenantState("hosp_invalid_phone_test");
    await hospitalRoutingService.purgeTenantState("hosp_daya_thrissur");
    hospitalRoutingService.resetInMemoryState();
  });

  beforeEach(() => {
    (mediaSessionManager as any).escalationRecords.clear();
    (mediaSessionManager as any).escalationsByCaller.clear();
  });

  // --------------------------------------------------------------------------
  // 1. Multi-Tenant Destination Resolution Across Distinct Tenants
  // --------------------------------------------------------------------------
  it("1. Multi-Tenant Resolution: Resolves distinct isolated destinations for Daya, Aster, and KIMS", async () => {
    // Daya Hospital (Live Verified Receptionist)
    const dayaRes = await hospitalRoutingService.resolveLiveDestination({
      hospitalId: "hosp_daya_thrissur",
      escalationType: "HUMAN_TRANSFER",
      isLiveCall: false,
    });
    expect(dayaRes.success).toBe(true);
    expect(dayaRes.destinationNumber).toBe("+919606654032");

    // Daya Hospital Emergency Transfer (Fails closed while disabled per Phase 10.14)
    const dayaEmRes = await hospitalRoutingService.resolveLiveDestination({
      hospitalId: "hosp_daya_thrissur",
      escalationType: "EMERGENCY",
      isLiveCall: false,
    });
    expect(dayaEmRes.success).toBe(false);
    expect(dayaEmRes.destinationNumber).toBe("");
    expect(dayaEmRes.routingRule).toBe("EMERGENCY_PSTN_TRANSFER_DISABLED_FAIL_CLOSED");

    // Aster Medcity
    const asterRes = await hospitalRoutingService.resolveLiveDestination({
      hospitalId: "hosp_aster_medcity",
      escalationType: "HUMAN_TRANSFER",
      isLiveCall: false,
    });
    expect(asterRes.success).toBe(true);
    expect(asterRes.destinationNumber).toBe("+914846699000");
    expect(asterRes.destinationNumber).not.toBe(dayaRes.destinationNumber);

    // KIMSHEALTH Trivandrum
    const kimsRes = await hospitalRoutingService.resolveLiveDestination({
      hospitalId: "hosp_kims_trivandrum",
      escalationType: "HUMAN_TRANSFER",
      isLiveCall: false,
    });
    expect(kimsRes.success).toBe(true);
    expect(kimsRes.destinationNumber).toBe("+914713041234");
    expect(kimsRes.destinationNumber).not.toBe(dayaRes.destinationNumber);
    expect(kimsRes.destinationNumber).not.toBe(asterRes.destinationNumber);
  });

  // --------------------------------------------------------------------------
  // 2. Demonstration: Changing Tenant Numbers Without Modifying Exotel Applet
  // --------------------------------------------------------------------------
  it("2. Zero-Applet-Change Workflow: Updating numbers via dashboard immediately updates Exotel Connect output", async () => {
    // Step A: Initialize tenant with Version 1 numbers
    await hospitalRoutingService.saveDraft(TEST_TENANT, {
      hospitalId: TEST_TENANT,
      isVerified: true,
      emergencyDestination: {
        primaryNumber: INITIAL_EMERGENCY,
        departmentName: "City Emergency Triage",
        extension: "100",
      },
      receptionistDestination: {
        primaryNumber: INITIAL_RECEPTION,
        departmentName: "City Main Reception",
        extension: "201",
      },
      receptionistRingTimeoutSeconds: 20,
      aiOverflowEnabled: true,
      additionalReceptionists: [],
      departmentDestinations: [],
      afterHoursDestination: {
        primaryNumber: INITIAL_EMERGENCY,
        behavior: "CASUALTY_TRANSFER",
      },
      humanFallbackDestination: {
        primaryNumber: INITIAL_RECEPTION,
      },
    });

    const pubV1 = await hospitalRoutingService.publishVersion(TEST_TENANT, "Initial Version 1 deployment");
    if (!pubV1.success) {
      console.log("pubV1 failed:", pubV1);
    }
    expect(pubV1.success).toBe(true);
    expect(pubV1.versionNumber).toBe(1);

    // Exotel Connect Applet queries the static Application URL for Call 101
    const call101Req = new NextRequest(
      `https://gateway.smrkomed.com/api/webhooks/exotel/connect-destination?CallSid=call_101&hospitalId=${TEST_TENANT}&type=HUMAN_TRANSFER&token=smrko_test_routing_token_2026`
    );
    const call101Res = await handleConnectDestination(call101Req);
    expect(call101Res.status).toBe(200);
    const call101Json = await call101Res.json();
    expect(call101Json.destination.numbers).toEqual([INITIAL_RECEPTION]);
    expect(call101Json.max_ringing_duration).toBe(20);

    // Step B: Hospital Admin changes reception number to UPDATED_RECEPTION in Dashboard
    await hospitalRoutingService.saveDraft(TEST_TENANT, {
      receptionistDestination: {
        primaryNumber: UPDATED_RECEPTION,
        departmentName: "City Main Reception - Line 2",
        extension: "201",
      },
      receptionistRingTimeoutSeconds: 15, // Also updated ring timeout
    });

    const pubV2 = await hospitalRoutingService.publishVersion(
      TEST_TENANT,
      "Switched reception desk to new number and 15s timeout"
    );
    expect(pubV2.success).toBe(true);
    expect(pubV2.versionNumber).toBe(2);

    // Step C: The EXACT SAME Exotel Applet URL (no applet edit) now returns the new number!
    const call102Req = new NextRequest(
      `https://gateway.smrkomed.com/api/webhooks/exotel/connect-destination?CallSid=call_102&hospitalId=${TEST_TENANT}&type=HUMAN_TRANSFER&token=smrko_test_routing_token_2026`
    );
    const call102Res = await handleConnectDestination(call102Req);
    expect(call102Res.status).toBe(200);
    const call102Json = await call102Res.json();
    expect(call102Json.destination.numbers).toEqual([UPDATED_RECEPTION]);
    expect(call102Json.max_ringing_duration).toBe(15); // Ring timeout updated dynamically!
  });

  // --------------------------------------------------------------------------
  // 3. In-Flight Call Version Pinning
  // --------------------------------------------------------------------------
  it("3. Version Pinning: In-flight calls retain their locked version even when a new version is published", async () => {
    // In-flight Call A begins on Version 1
    const callSidA = "call_inflight_session_A";
    const recordA: EscalationDecisionRecord = {
      callSid: callSidA,
      streamSid: "stream_A",
      hospitalId: TEST_TENANT,
      callerNumber: "+919846001111",
      escalationState: "HUMAN_TRANSFER",
      destination: INITIAL_RECEPTION,
      reason: "In-flight transfer on v1",
      timestamp: Date.now(),
      routingVersion: 1, // Pinned to Version 1
    };
    await mediaSessionManager.recordEscalation(recordA);

    // Admin publishes Version 2 with new number
    await hospitalRoutingService.saveDraft(TEST_TENANT, {
      receptionistDestination: {
        primaryNumber: UPDATED_RECEPTION,
        departmentName: "Reception V2",
      },
    });
    await hospitalRoutingService.publishVersion(TEST_TENANT, "Published v2 mid-call");

    // Call A requests destination -> MUST still receive Version 1 destination!
    const reqA = new NextRequest(
      `https://gateway.smrkomed.com/api/webhooks/exotel/connect-destination?CallSid=${callSidA}`
    );
    const resA = await handleConnectDestination(reqA);
    expect(resA.status).toBe(200);
    const jsonA = await resA.json();
    expect(jsonA.destination.numbers).toEqual([INITIAL_RECEPTION]);

    // New Call B arrives -> MUST receive Version 2 destination!
    const callSidB = "call_new_call_B";
    const reqB = new NextRequest(
      `https://gateway.smrkomed.com/api/webhooks/exotel/connect-destination?CallSid=${callSidB}&hospitalId=${TEST_TENANT}&type=HUMAN_TRANSFER&token=smrko_test_routing_token_2026`
    );
    const resB = await handleConnectDestination(reqB);
    expect(resB.status).toBe(200);
    const jsonB = await resB.json();
    expect(jsonB.destination.numbers).toEqual([UPDATED_RECEPTION]);
  });

  // --------------------------------------------------------------------------
  // 4. Version Rollback
  // --------------------------------------------------------------------------
  it("4. Rollback: Rolling back restores previous destination snapshot for new calls", async () => {
    // Rollback to Version 1
    const rollbackSuccess = await hospitalRoutingService.rollbackVersion(TEST_TENANT, 1);
    expect(rollbackSuccess).toBe(true);

    const callReq = new NextRequest(
      `https://gateway.smrkomed.com/api/webhooks/exotel/connect-destination?CallSid=call_after_rollback&hospitalId=${TEST_TENANT}&type=HUMAN_TRANSFER&token=smrko_test_routing_token_2026`
    );
    const callRes = await handleConnectDestination(callReq);
    expect(callRes.status).toBe(200);
    const callJson = await callRes.json();
    expect(callJson.destination.numbers).toEqual([INITIAL_RECEPTION]);
  });

  // --------------------------------------------------------------------------
  // 5. Receptionist Ring Timeout Configuration
  // --------------------------------------------------------------------------
  it("5. Ring Timeout: Configurable from 5 to 60s and reflected in Exotel max_ringing_duration", async () => {
    await hospitalRoutingService.saveDraft(TEST_TENANT, {
      receptionistRingTimeoutSeconds: 30, // 30 seconds
    });
    await hospitalRoutingService.publishVersion(TEST_TENANT, "Set ring timeout to 30s");

    const req = new NextRequest(
      `https://gateway.smrkomed.com/api/v1/telephony/routing/destination?CallSid=call_timeout_test&hospitalId=${TEST_TENANT}&type=HUMAN_TRANSFER&token=smrko_test_routing_token_2026`
    );
    const res = await handleCanonicalDestination(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.max_ringing_duration).toBe(30);

    // Validation rejects out-of-range timeouts
    const invalidDraft = await hospitalRoutingService.saveDraft(TEST_TENANT, {
      receptionistRingTimeoutSeconds: 120, // > 60s is invalid
    });
    const validation = hospitalRoutingService.validateRoutingConfig(invalidDraft);
    expect(validation.isValid).toBe(false);
    expect(validation.errors.some((e) => e.field === "receptionistRingTimeoutSeconds")).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 6. AI Overflow Toggle Control
  // --------------------------------------------------------------------------
  it("6. AI Overflow Toggle: Decides between Voicebot and Fallback when receptionist is unavailable", async () => {
    // Case A: AI Overflow ENABLED (default)
    await hospitalRoutingService.saveDraft(TEST_TENANT, {
      aiOverflowEnabled: true,
      receptionistRingTimeoutSeconds: 20,
    });
    await hospitalRoutingService.publishVersion(TEST_TENANT, "AI Overflow Enabled");

    const preFlightEnabled = await dynamicExotelRoutingAdapter.evaluatePreFlightDecision({
      callSid: "call_overflow_enabled_test",
      hospitalId: TEST_TENANT,
      menuChoice: "appointments",
      isInternalAuthorized: true,
    });
    // With no receptionist logged in, overflows to Sarvam Voicebot on staging applet 1393240
    expect(preFlightEnabled.decision).toBe("CONNECT_VOICEBOT");
    expect(preFlightEnabled.targetApplet).toBe("1393240");

    // Case B: AI Overflow DISABLED
    await hospitalRoutingService.saveDraft(TEST_TENANT, {
      aiOverflowEnabled: false,
    });
    await hospitalRoutingService.publishVersion(TEST_TENANT, "AI Overflow Disabled");

    const preFlightDisabled = await dynamicExotelRoutingAdapter.evaluatePreFlightDecision({
      callSid: "call_overflow_disabled_test",
      hospitalId: TEST_TENANT,
      menuChoice: "appointments",
      isInternalAuthorized: true,
    });
    // Routes to human fallback rather than Voicebot!
    expect(preFlightDisabled.decision).toBe("CONNECT_HUMAN");
    expect(preFlightDisabled.action).toBe("DIAL");
  });

  // --------------------------------------------------------------------------
  // 7. Business Hours & After-Hours Schedule Evaluation
  // --------------------------------------------------------------------------
  it("7. Business Hours: In-hours route to reception; after-hours route to casualty destination", async () => {
    await hospitalRoutingService.saveDraft(TEST_TENANT, {
      receptionistDestination: {
        primaryNumber: INITIAL_RECEPTION,
        departmentName: "City Main Reception",
      },
      businessHours: {
        enabled: true,
        timezone: "Asia/Kolkata",
        openTime: "08:00",
        closeTime: "20:00",
        workingDays: [1, 2, 3, 4, 5, 6], // Mon-Sat
      },
      afterHoursDestination: {
        primaryNumber: "+919800000099",
        behavior: "CASUALTY_TRANSFER",
      },
    });
    await hospitalRoutingService.publishVersion(TEST_TENANT, "Configured business hours schedule");

    // Daytime call (Wednesday at 11:30 AM IST = 06:00 UTC)
    const dayIso = "2026-11-25T06:00:00.000Z";
    const dayResolution = await hospitalRoutingService.simulateRouting({
      hospitalId: TEST_TENANT,
      escalationType: "HUMAN_TRANSFER",
      simulatedTimeIso: dayIso,
    });
    expect(dayResolution.isAfterHours).toBe(false);
    expect(dayResolution.destinationNumber).toBe(INITIAL_RECEPTION);

    // Nighttime call (Wednesday at 11:30 PM IST = 18:00 UTC)
    const nightIso = "2026-11-25T18:00:00.000Z";
    const nightResolution = await hospitalRoutingService.simulateRouting({
      hospitalId: TEST_TENANT,
      escalationType: "HUMAN_TRANSFER",
      simulatedTimeIso: nightIso,
    });
    expect(nightResolution.isAfterHours).toBe(true);
    expect(nightResolution.destinationNumber).toBe("+919800000099");
  });

  // --------------------------------------------------------------------------
  // 8. Additional Receptionists (Multi-Agent Support)
  // --------------------------------------------------------------------------
  it("8. Multi-Agent Support: Supports multiple receptionist numbers and validates E.164 formats", async () => {
    const draft = await hospitalRoutingService.saveDraft(TEST_TENANT, {
      additionalReceptionists: [
        {
          id: "agent_2",
          name: "Reception Counter 2",
          extension: "202",
          phoneNumber: "+919800000003",
          priority: 2,
          status: "AVAILABLE",
        },
        {
          id: "agent_3",
          name: "Reception Counter 3",
          extension: "203",
          phoneNumber: "+919800000004",
          priority: 3,
          status: "AVAILABLE",
        },
      ],
    });

    const validation = hospitalRoutingService.validateRoutingConfig(draft);
    expect(validation.isValid).toBe(true);
    expect(draft.additionalReceptionists?.length).toBe(2);

    // Rejects invalid agent phone number
    const invalidAgentDraft = await hospitalRoutingService.saveDraft("hosp_invalid_phone_test", {
      additionalReceptionists: [
        {
          id: "agent_invalid",
          name: "Invalid Agent",
          phoneNumber: "invalid_phone",
        },
      ],
    });
    const invalidValidation = hospitalRoutingService.validateRoutingConfig(invalidAgentDraft);
    expect(invalidValidation.isValid).toBe(false);
    expect(invalidValidation.errors.some((e) => e.field.includes("additionalReceptionists"))).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 9. Strict Anti-Leakage Across Tenants
  // --------------------------------------------------------------------------
  it("9. Strict Anti-Leakage: No tenant can ever access Daya Hospital numbers or cross-tenant fallbacks", async () => {
    const DAYA_HOTLINE = "+919606654032";

    // Aster Medcity emergency must never be Daya's hotline
    const asterEmergency = await hospitalRoutingService.resolveLiveDestination({
      hospitalId: "hosp_aster_medcity",
      escalationType: "EMERGENCY",
      isLiveCall: false,
    });
    expect(asterEmergency.destinationNumber).not.toBe(DAYA_HOTLINE);

    // City clinic emergency must never be Daya's hotline
    const cityEmergency = await hospitalRoutingService.resolveLiveDestination({
      hospitalId: TEST_TENANT,
      escalationType: "EMERGENCY",
      isLiveCall: false,
    });
    expect(cityEmergency.destinationNumber).not.toBe(DAYA_HOTLINE);
  });

  // --------------------------------------------------------------------------
  // 10. Fail Closed Behavior
  // --------------------------------------------------------------------------
  it("10. Fail Closed: Unconfigured or missing tenant fails closed cleanly with HTTP 404/403", async () => {
    // Missing CallSid
    const noSidReq = new NextRequest(
      "https://gateway.smrkomed.com/api/v1/telephony/routing/destination"
    );
    const noSidRes = await handleCanonicalDestination(noSidReq);
    expect(noSidRes.status).toBe(404);

    // Non-existent tenant with internal auth
    const badTenantReq = new NextRequest(
      "https://gateway.smrkomed.com/api/v1/telephony/routing/destination?CallSid=call_non_existent&hospitalId=hosp_unknown_xyz&type=EMERGENCY&token=smrko_test_routing_token_2026"
    );
    const badTenantRes = await handleCanonicalDestination(badTenantReq);
    expect(badTenantRes.status).toBe(404);
  });

  // --------------------------------------------------------------------------
  // 11. Security Audit: Unauthenticated Query Parameter hospitalId Rejected (403)
  // --------------------------------------------------------------------------
  it("11. Security: Unauthenticated query parameter hospitalId cannot be used to probe destinations", async () => {
    // Attacker probes Daya's emergency number without active session or token
    const probeReq = new NextRequest(
      "https://gateway.smrkomed.com/api/v1/telephony/routing/destination?CallSid=call_unauth_probe_999&hospitalId=hosp_daya_thrissur&type=EMERGENCY"
    );
    const probeRes = await handleCanonicalDestination(probeReq);
    expect(probeRes.status).toBe(403);
    const probeJson = await probeRes.json();
    expect(probeJson.error).toBe("SECURITY_UNTRUSTED_TENANT");
    expect(probeJson.destination).toBeNull();
    expect(probeJson.message).toContain("UNTRUSTED_TENANT_CONTEXT");
  });

  // --------------------------------------------------------------------------
  // 12. Security Audit: Cross-Tenant Spoofing on Dialed ExoPhone Blocked (403)
  // --------------------------------------------------------------------------
  it("12. Security: Cross-tenant spoofing against dialed ExoPhone is blocked", async () => {
    // Call arrived on Daya's ExoPhone (08047291658), but query specifies Aster Medcity
    const spoofExoReq = new NextRequest(
      "https://gateway.smrkomed.com/api/v1/telephony/routing/destination?CallSid=call_spoof_exo_101&CallTo=08047291658&hospitalId=hosp_aster_medcity&type=EMERGENCY"
    );
    const spoofExoRes = await handleCanonicalDestination(spoofExoReq);
    expect(spoofExoRes.status).toBe(403);
    const spoofExoJson = await spoofExoRes.json();
    expect(spoofExoJson.message).toContain("TENANT_MISMATCH_FORBIDDEN");
  });

  // --------------------------------------------------------------------------
  // 13. Security Audit: Cross-Tenant Spoofing on Active Session Blocked (403)
  // --------------------------------------------------------------------------
  it("13. Security: Cross-tenant spoofing against active in-flight session is blocked", async () => {
    const callSidSession = "call_active_session_daya";
    await mediaSessionManager.recordEscalation({
      callSid: callSidSession,
      hospitalId: "hosp_daya_thrissur",
      callerNumber: "+919846002222",
      escalationState: "EMERGENCY",
      destination: "+919606654032",
      reason: "Active Daya emergency triage",
      timestamp: Date.now(),
      routingVersion: 1,
    });

    // Attacker attempts to query Aster Medcity using Daya's active CallSid
    const spoofSessionReq = new NextRequest(
      `https://gateway.smrkomed.com/api/v1/telephony/routing/destination?CallSid=${callSidSession}&hospitalId=hosp_aster_medcity`
    );
    const spoofSessionRes = await handleCanonicalDestination(spoofSessionReq);
    expect(spoofSessionRes.status).toBe(403);
    const spoofSessionJson = await spoofSessionRes.json();
    expect(spoofSessionJson.message).toContain("TENANT_MISMATCH_FORBIDDEN");
  });

  // --------------------------------------------------------------------------
  // 14. Dedicated EMERGENCY_TRANSFER Resolution Contract & Safety Guard
  // --------------------------------------------------------------------------
  it("14. Emergency Contract: Dedicated EMERGENCY_TRANSFER contract fails closed when transfer is disabled, and resolves when authorized", async () => {
    // State A: Emergency Transfer disabled (Default Safety State per Phase 10.14)
    const dayaEmergencyDisabled = await hospitalRoutingService.resolveLiveDestination({
      hospitalId: "hosp_daya_thrissur",
      escalationType: "EMERGENCY_TRANSFER",
      isLiveCall: false,
    });
    expect(dayaEmergencyDisabled.success).toBe(false);
    expect(dayaEmergencyDisabled.destinationNumber).toBe("");
    expect(dayaEmergencyDisabled.routingRule).toBe("EMERGENCY_PSTN_TRANSFER_DISABLED_FAIL_CLOSED");
    expect(dayaEmergencyDisabled.aiOverflowEnabled).toBe(false);

    // Exotel Connect Applet receives HTTP 403 and destination: null (Never dials PSTN while disabled)
    const emergencyReq = new NextRequest(
      "https://gateway.smrkomed.com/api/v1/telephony/routing/destination?CallSid=call_emergency_contract_test&hospitalId=hosp_daya_thrissur&type=EMERGENCY_TRANSFER&token=smrko_test_routing_token_2026"
    );
    const emergencyRes = await handleCanonicalDestination(emergencyReq);
    expect(emergencyRes.status).toBe(403);
    const emergencyJson = await emergencyRes.json();
    expect(emergencyJson.destination).toBeNull();
    expect(emergencyJson.error).toBe("EMERGENCY_PSTN_TRANSFER_DISABLED_FAIL_CLOSED");
    expect(emergencyRes.headers.get("X-SMRKOMED-Emergency-PSTN-Transfer")).toBe("DISABLED_FAIL_CLOSED");

    // State B: When explicitly authorized by clinical admin (emergencyPstnTransferEnabled: true)
    await hospitalRoutingService.saveDraft("hosp_daya_thrissur", {
      emergencyDestination: {
        primaryNumber: "+919740662046",
        departmentName: "Casualty Emergency Desk",
        emergencyPstnTransferEnabled: true,
      },
    });
    await hospitalRoutingService.publishVersion("hosp_daya_thrissur", "Authorized clinical emergency trunk");

    const dayaEmergencyEnabled = await hospitalRoutingService.resolveLiveDestination({
      hospitalId: "hosp_daya_thrissur",
      escalationType: "EMERGENCY_TRANSFER",
      isLiveCall: false,
    });
    expect(dayaEmergencyEnabled.success).toBe(true);
    expect(dayaEmergencyEnabled.destinationNumber).toBe("+919740662046");
    expect(dayaEmergencyEnabled.routingRule).toBe("EMERGENCY_TRANSFER_DIRECT_ROUTING");

    const authReq = new NextRequest(
      "https://gateway.smrkomed.com/api/v1/telephony/routing/destination?CallSid=call_emergency_auth_test&hospitalId=hosp_daya_thrissur&type=EMERGENCY_TRANSFER&token=smrko_test_routing_token_2026"
    );
    const authRes = await handleCanonicalDestination(authReq);
    expect(authRes.status).toBe(200);
    const authJson = await authRes.json();
    expect(authJson.destination.numbers).toEqual(["+919740662046"]);

    // Restore disabled safety baseline
    await hospitalRoutingService.saveDraft("hosp_daya_thrissur", {
      emergencyDestination: {
        primaryNumber: "+919740662046",
        departmentName: "Casualty Emergency Desk (DEV TEST RECEIVER)",
        emergencyPstnTransferEnabled: false,
      },
    });
    await hospitalRoutingService.publishVersion("hosp_daya_thrissur", "Restore emergency transfer disabled safety baseline");
  });

  // --------------------------------------------------------------------------
  // 15. Appointment Overflow 5-State Matrix Verification
  // --------------------------------------------------------------------------
  it("15. Appointment Overflow: Complete 5-state matrix verification", async () => {
    // Ensure AI overflow is enabled for initial states
    await hospitalRoutingService.saveDraft(TEST_TENANT, {
      aiOverflowEnabled: true,
      receptionistRingTimeoutSeconds: 20,
    });
    await hospitalRoutingService.publishVersion(TEST_TENANT, "Ensure AI overflow enabled for State 1-4");

    // State 1: Receptionist Available -> CONNECT_HUMAN
    const callSidAvail = "call_state1_available";
    // Mock available receptionist in memory
    const presenceService = (await import("./receptionist-presence-service")).receptionistPresenceService;
    await presenceService.registerStaffPresence({
      hospitalId: TEST_TENANT,
      userId: "staff_reception_1",
      staffName: "Anita Joseph",
      phoneNumber: "+919800000002",
      initialStatus: "AVAILABLE",
    });

    const availDecision = await dynamicExotelRoutingAdapter.evaluatePreFlightDecision({
      callSid: callSidAvail,
      hospitalId: TEST_TENANT,
      menuChoice: "appointments",
      isInternalAuthorized: true,
    });
    expect(availDecision.decision).toBe("CONNECT_HUMAN");
    expect(availDecision.destinationNumber).toBe("+919800000002");

    // State 2: Receptionist Busy -> CONNECT_VOICEBOT
    await presenceService.setStaffPresenceStatus({
      hospitalId: TEST_TENANT,
      userId: "staff_reception_1",
      status: "ON_CALL",
      reason: "Active patient call",
    });

    const busyDecision = await dynamicExotelRoutingAdapter.evaluatePreFlightDecision({
      callSid: "call_state2_busy",
      hospitalId: TEST_TENANT,
      menuChoice: "appointments",
      isInternalAuthorized: true,
    });
    expect(busyDecision.decision).toBe("CONNECT_VOICEBOT");
    expect(busyDecision.targetApplet).toBe("1393240");

    // State 3: Receptionist Offline -> CONNECT_VOICEBOT
    await presenceService.setStaffPresenceStatus({
      hospitalId: TEST_TENANT,
      userId: "staff_reception_1",
      status: "OFFLINE",
      reason: "Shift ended",
    });

    const offlineDecision = await dynamicExotelRoutingAdapter.evaluatePreFlightDecision({
      callSid: "call_state3_offline",
      hospitalId: TEST_TENANT,
      menuChoice: "appointments",
      isInternalAuthorized: true,
    });
    expect(offlineDecision.decision).toBe("CONNECT_VOICEBOT");
    expect(offlineDecision.targetApplet).toBe("1393240");

    // State 4: Ring Timeout Configured
    const published = await hospitalRoutingService.getPublishedVersion(TEST_TENANT);
    expect(published?.receptionistRingTimeoutSeconds).toBeDefined();

    // State 5: AI Disabled -> Fallback to Human
    await hospitalRoutingService.saveDraft(TEST_TENANT, { aiOverflowEnabled: false });
    await hospitalRoutingService.publishVersion(TEST_TENANT, "AI overflow disabled for test");

    const disabledDecision = await dynamicExotelRoutingAdapter.evaluatePreFlightDecision({
      callSid: "call_state5_ai_disabled",
      hospitalId: TEST_TENANT,
      menuChoice: "appointments",
      isInternalAuthorized: true,
    });
    expect(disabledDecision.decision).toBe("CONNECT_HUMAN");
  });

  // --------------------------------------------------------------------------
  // 16. Actual Sarvam Voice Agent Staging Route Generation
  // --------------------------------------------------------------------------
  it("16. Actual Sarvam Integration: Voice Agents mode routes to Sarvam Exotel channel endpoint", async () => {
    const origEngine = process.env.CONVERSATION_ENGINE_MODE;
    try {
      process.env.CONVERSATION_ENGINE_MODE = "SARVAM_VOICE_AGENTS";

      // Re-enable AI overflow for Daya Hospital
      await hospitalRoutingService.saveDraft("hosp_daya_thrissur", { aiOverflowEnabled: true });
      await hospitalRoutingService.publishVersion("hosp_daya_thrissur", "AI overflow re-enabled for Daya");

      const sarvamDecision = await dynamicExotelRoutingAdapter.evaluatePreFlightDecision({
        callSid: "call_sarvam_staging_test",
        callFrom: "+919846001111",
        callTo: "08047291658",
        hospitalId: "hosp_daya_thrissur",
        menuChoice: "appointments",
        isInternalAuthorized: true,
      });

      expect(sarvamDecision.decision).toBe("CONNECT_VOICEBOT");
      expect(sarvamDecision.targetApplet).toBe("1393240");
      // Verified real Sarvam Channel Runtime Endpoint with staging deployment & staging applet ID
      expect(sarvamDecision.voicebotUrl).toContain("https://apps.sarvam.ai/api/app-runtime/channels/exotel");
      expect(sarvamDecision.voicebotUrl).toContain("app_id=smrkomed-8401f738-b749");
      expect(sarvamDecision.voicebotUrl).toContain("CallSid=call_sarvam_staging_test");
      expect(sarvamDecision.voicebotUrl).toContain("deployment=Inbound-Daya-Exotel-Sandbox");
      expect(sarvamDecision.voicebotUrl).toContain("applet_id=1393240");
    } finally {
      process.env.CONVERSATION_ENGINE_MODE = origEngine;
    }
  });

  // --------------------------------------------------------------------------
  // 17. Canonical Daya Hospital Staging DTMF Menu Mapping
  // --------------------------------------------------------------------------
  it("17. Canonical DTMF Mapping: Validates 1=Emergency, 2=Appointment, 3=Other enquiries", async () => {
    // Re-enable AI overflow for Daya
    await hospitalRoutingService.saveDraft("hosp_daya_thrissur", { aiOverflowEnabled: true });
    await hospitalRoutingService.publishVersion("hosp_daya_thrissur", "Published Daya DTMF baseline");

    // Option 1: Press 1 (Emergency) -> When transfer disabled, fails closed immediately (bypasses receptionist and AI)
    const dtmf1 = await dynamicExotelRoutingAdapter.evaluatePreFlightDecision({
      callSid: "call_dtmf1_emergency",
      hospitalId: "hosp_daya_thrissur",
      menuChoice: "1",
      isInternalAuthorized: true,
    });
    expect(dtmf1.decision).toBe("FAIL_CLOSED");
    expect(dtmf1.action).toBe("REJECT");
    expect(dtmf1.reason).toContain("Emergency live PSTN transfer is disabled");

    // Option 2: Press 2 (Appointment) -> Human receptionist first -> Sarvam AI on busy/offline
    const dtmf2 = await dynamicExotelRoutingAdapter.evaluatePreFlightDecision({
      callSid: "call_dtmf2_appointment",
      hospitalId: "hosp_daya_thrissur",
      menuChoice: "2",
      isInternalAuthorized: true,
    });
    // With no receptionist logged in, overflows to Sarvam Voicebot on staging applet
    expect(dtmf2.decision).toBe("CONNECT_VOICEBOT");
    expect(dtmf2.targetApplet).toBe("1393240");

    // Option 3: Press 3 (Other enquiries) -> Direct to Sarvam Voice Agent with Daya knowledge base
    const dtmf3 = await dynamicExotelRoutingAdapter.evaluatePreFlightDecision({
      callSid: "call_dtmf3_enquiry",
      hospitalId: "hosp_daya_thrissur",
      menuChoice: "3",
      isInternalAuthorized: true,
    });
    expect(dtmf3.decision).toBe("CONNECT_VOICEBOT");
    expect(dtmf3.targetApplet).toBe("1393240");
    expect(dtmf3.reason).toContain("Canonical DTMF 3: General enquiry");
  });

  // --------------------------------------------------------------------------
  // 18. Emergency Destination Safety & Dev Test Receiver Classification
  // --------------------------------------------------------------------------
  it("18. Emergency Destination Safety: +919740662046 is classified as TEMPORARY_DEV_TEST_RECEIVER and fails closed while disabled", async () => {
    const dayaConfig = hospitalRoutingService.getDefaultRoutingConfig("hosp_daya_thrissur");
    expect(dayaConfig.emergencyDestination.primaryNumber).toBe("+919740662046");
    expect(dayaConfig.emergencyDestination.receiverClassification).toBe("TEMPORARY_DEV_TEST_RECEIVER");
    expect(dayaConfig.emergencyDestination.emergencyPstnTransferEnabled).toBe(false);

    // Dynamic resolution returns HTTP 403 fail-closed with safety classification headers
    const req = new NextRequest(
      "https://gateway.smrkomed.com/api/webhooks/exotel/connect-destination?CallSid=call_safety_test&hospitalId=hosp_daya_thrissur&type=EMERGENCY&token=smrko_test_routing_token_2026"
    );
    const res = await handleConnectDestination(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.destination).toBeNull();
    expect(json.error).toBe("EMERGENCY_PSTN_TRANSFER_DISABLED_FAIL_CLOSED");
    expect(res.headers.get("X-SMRKOMED-Receiver-Classification")).toBe("TEMPORARY_DEV_TEST_RECEIVER");
    expect(res.headers.get("X-SMRKOMED-Emergency-PSTN-Transfer")).toBe("DISABLED_FAIL_CLOSED");
  });

  // --------------------------------------------------------------------------
  // 19. Staging Applet Isolation (Preserves Production Applet 1393239)
  // --------------------------------------------------------------------------
  it("19. Staging Applet Isolation: Staging calls route to 1393240, never live Applet 1393239", () => {
    // Default environment is staging
    const stagingApplet = dynamicExotelRoutingAdapter.getTargetVoicebotApplet(false);
    expect(stagingApplet).toBe("1393240");
    expect(stagingApplet).not.toBe("1393239");

    // Production environment explicitly requested
    const prodApplet = dynamicExotelRoutingAdapter.getTargetVoicebotApplet(true);
    expect(prodApplet).toBe("1393239");
  });

  // --------------------------------------------------------------------------
  // 20. Daya Receptionist Dynamic Dashboard Workflow & Independence
  // --------------------------------------------------------------------------
  it("20. Daya Receptionist Dynamic Dashboard Workflow: Setting authorized test destination immediately updates endpoint without Exotel applet change", async () => {
    const DAYA_TENANT = "hosp_daya_thrissur";
    const ROUTING_TOKEN = "smrko_test_routing_token_2026";
    const AUTHORIZED_TEST_RECEPTION = "+914872475000"; // Authorized Daya front desk test number

    // Step 1: Initial baseline check — resolves default development receiver
    const initialResolution = await dynamicExotelRoutingAdapter.resolveConnectDestination({
      callSid: "call_daya_initial_test",
      hospitalId: DAYA_TENANT,
      escalationType: "HUMAN_TRANSFER",
      routingToken: ROUTING_TOKEN,
    });
    expect(initialResolution.statusCode).toBe(200);
    expect(initialResolution.jsonPayload?.destination?.numbers).toContain("+919606654032");

    // Step 2: Dashboard Admin Workflow — Save draft with authorized receptionist destination & custom ring timeout
    await hospitalRoutingService.saveDraft(
      DAYA_TENANT,
      {
        receptionistDestination: {
          primaryNumber: AUTHORIZED_TEST_RECEPTION,
          departmentName: "Authorized Test Reception Desk",
          extension: "201",
        },
        receptionistRingTimeoutSeconds: 25,
      },
      "usr_admin_daya",
      "Daya Telephony Admin"
    );

    // Step 3: Publish version with immutable audit changelog
    const publishResult = await hospitalRoutingService.publishVersion(
      DAYA_TENANT,
      "Phase 10.11: Explicitly authorized receptionist test destination configured",
      "usr_admin_daya",
      "Daya Telephony Admin"
    );
    expect(publishResult.success).toBe(true);

    // Step 4: Endpoint dynamic resolution immediately reflects the new destination WITHOUT Exotel applet modification
    const updatedResolution = await dynamicExotelRoutingAdapter.resolveConnectDestination({
      callSid: "call_daya_updated_test",
      hospitalId: DAYA_TENANT,
      escalationType: "HUMAN_TRANSFER",
      routingToken: ROUTING_TOKEN,
    });
    expect(updatedResolution.statusCode).toBe(200);
    expect(updatedResolution.jsonPayload?.destination?.numbers).toEqual([AUTHORIZED_TEST_RECEPTION]);
    expect(updatedResolution.jsonPayload?.max_ringing_duration).toBe(25);
    expect(updatedResolution.jsonPayload?.destination?.numbers).not.toContain("+919606654032");

    // Step 5: Independence Check — Emergency destination remains completely independent and fails closed while transfer is disabled
    const emergencyResolution = await dynamicExotelRoutingAdapter.resolveConnectDestination({
      callSid: "call_daya_emergency_test",
      hospitalId: DAYA_TENANT,
      escalationType: "EMERGENCY_TRANSFER",
      routingToken: ROUTING_TOKEN,
    });
    expect(emergencyResolution.statusCode).toBe(403);
    expect(emergencyResolution.jsonPayload?.destination).toBeNull();
    expect(emergencyResolution.jsonPayload?.error).toBe("EMERGENCY_PSTN_TRANSFER_DISABLED_FAIL_CLOSED");
    expect(emergencyResolution.headers?.["X-SMRKOMED-Receiver-Classification"]).toBe("TEMPORARY_DEV_TEST_RECEIVER");
    expect(emergencyResolution.headers?.["X-SMRKOMED-Emergency-PSTN-Transfer"]).toBe("DISABLED_FAIL_CLOSED");

    // Step 6: Anti-Leakage Check — Unauthenticated or invalid requests FAIL CLOSED and never return test destinations
    const unauthenticatedResolution = await dynamicExotelRoutingAdapter.resolveConnectDestination({
      callSid: "call_unauth_probe",
      hospitalId: DAYA_TENANT,
      escalationType: "HUMAN_TRANSFER",
      routingToken: "invalid_secret_token",
    });
    expect([401, 403]).toContain(unauthenticatedResolution.statusCode);
    expect(unauthenticatedResolution.jsonPayload?.destination).toBeNull();
    expect(unauthenticatedResolution.jsonPayload?.error).toContain("SECURITY_UNTRUSTED_TENANT");

    // Step 7: Cleanup — Restore Daya baseline configuration
    await hospitalRoutingService.saveDraft(
      DAYA_TENANT,
      {
        receptionistDestination: {
          primaryNumber: "+919606654032",
          departmentName: "Front Desk Reception",
          extension: "201",
        },
        emergencyDestination: {
          primaryNumber: "+919740662046",
          departmentName: "Casualty Emergency Desk (DEV TEST RECEIVER)",
          extension: "100",
          receiverClassification: "TEMPORARY_DEV_TEST_RECEIVER",
          emergencyPstnTransferEnabled: false,
        },
        receptionistRingTimeoutSeconds: 20,
      },
      "usr_admin_daya",
      "Daya Telephony Admin"
    );
    await hospitalRoutingService.publishVersion(
      DAYA_TENANT,
      "Restore baseline Daya routing configuration post-test",
      "usr_admin_daya",
      "Daya Telephony Admin"
    );
  });

  // --------------------------------------------------------------------------
  // 21. Phase 10.14: Final Staging Connect Safety Audit
  // --------------------------------------------------------------------------
  it("21. Phase 10.14 Safety Audit: Receptionist resolves +919606654032, and Emergency transfer fails closed while disabled", async () => {
    const DAYA_TENANT = "hosp_daya_thrissur";
    const ROUTING_TOKEN = "smrko_test_routing_token_2026";
    const EXPECTED_RECEPTIONIST = "+919606654032";
    const EXPECTED_EMERGENCY = "+919740662046";

    // 1. HUMAN_TRANSFER contract verification (DTMF 2 - Appointment)
    const humanResolution = await dynamicExotelRoutingAdapter.resolveConnectDestination({
      callSid: "call_phase10_14_human",
      hospitalId: DAYA_TENANT,
      callTo: "08047291658",
      escalationType: "HUMAN_TRANSFER",
      routingToken: ROUTING_TOKEN,
    });
    expect(humanResolution.statusCode).toBe(200);
    expect(humanResolution.jsonPayload?.destination?.numbers).toEqual([EXPECTED_RECEPTIONIST]);
    expect(humanResolution.jsonPayload?.max_ringing_duration).toBe(20);
    expect(humanResolution.jsonPayload?.record).toBe(true);
    expect(humanResolution.jsonPayload?.outgoing_phone_number).toBe("08047291658");
    expect(humanResolution.jsonPayload?.fetch_after_attempt).toBe(false);
    expect(humanResolution.headers?.["X-SMRKOMED-Escalation"]).toBe("HUMAN_TRANSFER");

    // 2. Verified without hospitalId in query string (resolves cleanly via CallTo=08047291658)
    const noHospitalIdResolution = await dynamicExotelRoutingAdapter.resolveConnectDestination({
      callSid: "call_phase10_14_no_hospital_id",
      callTo: "08047291658",
      escalationType: "HUMAN_TRANSFER",
      routingToken: ROUTING_TOKEN,
    });
    expect(noHospitalIdResolution.statusCode).toBe(200);
    expect(noHospitalIdResolution.jsonPayload?.destination?.numbers).toEqual([EXPECTED_RECEPTIONIST]);

    // 3. EMERGENCY_TRANSFER contract verification: FAILS CLOSED when emergencyPstnTransferEnabled=false
    // Critical safety requirement: Never return a dialable emergency destination over PSTN while disabled.
    const emergencyResolution = await dynamicExotelRoutingAdapter.resolveConnectDestination({
      callSid: "call_phase10_14_emergency_disabled",
      hospitalId: DAYA_TENANT,
      callTo: "08047291658",
      escalationType: "EMERGENCY_TRANSFER",
      routingToken: ROUTING_TOKEN,
    });
    expect(emergencyResolution.statusCode).toBe(403);
    expect(emergencyResolution.jsonPayload?.destination).toBeNull();
    expect(emergencyResolution.jsonPayload?.error).toBe("EMERGENCY_PSTN_TRANSFER_DISABLED_FAIL_CLOSED");
    expect(emergencyResolution.headers?.["X-SMRKOMED-Escalation"]).toBe("EMERGENCY");
    expect(emergencyResolution.headers?.["X-SMRKOMED-Receiver-Classification"]).toBe("TEMPORARY_DEV_TEST_RECEIVER");
    expect(emergencyResolution.headers?.["X-SMRKOMED-Emergency-PSTN-Transfer"]).toBe("DISABLED_FAIL_CLOSED");

    // 4. Strict Safety: Callers are NOT silently redirected to AI Voicebot
    expect(emergencyResolution.jsonPayload?.destination).toBeNull();

    // 5. Authorized State: Only when explicitly authorized by clinical admin (emergencyPstnTransferEnabled: true)
    await hospitalRoutingService.saveDraft(
      DAYA_TENANT,
      {
        emergencyDestination: {
          primaryNumber: EXPECTED_EMERGENCY,
          departmentName: "Casualty Emergency Desk",
          emergencyPstnTransferEnabled: true,
        },
      },
      "usr_admin_daya",
      "Daya Admin"
    );
    await hospitalRoutingService.publishVersion(DAYA_TENANT, "Authorized emergency clinical trunk for testing");

    const authorizedEmergency = await dynamicExotelRoutingAdapter.resolveConnectDestination({
      callSid: "call_phase10_14_emergency_authorized",
      hospitalId: DAYA_TENANT,
      callTo: "08047291658",
      escalationType: "EMERGENCY_TRANSFER",
      routingToken: ROUTING_TOKEN,
    });
    expect(authorizedEmergency.statusCode).toBe(200);
    expect(authorizedEmergency.jsonPayload?.destination?.numbers).toEqual([EXPECTED_EMERGENCY]);
    expect(authorizedEmergency.jsonPayload?.max_ringing_duration).toBe(25);

    // 6. Restore disabled safety baseline
    await hospitalRoutingService.saveDraft(
      DAYA_TENANT,
      {
        emergencyDestination: {
          primaryNumber: EXPECTED_EMERGENCY,
          departmentName: "Casualty Emergency Desk (DEV TEST RECEIVER)",
          extension: "100",
          receiverClassification: "TEMPORARY_DEV_TEST_RECEIVER",
          emergencyPstnTransferEnabled: false,
        },
        receptionistDestination: {
          primaryNumber: EXPECTED_RECEPTIONIST,
          departmentName: "Main Inbound Reception (DEV TEST RECEIVER)",
          extension: "201",
        },
        receptionistRingTimeoutSeconds: 20,
      },
      "usr_admin_daya",
      "Daya Admin"
    );
    await hospitalRoutingService.publishVersion(DAYA_TENANT, "Restored disabled safety baseline");
  });
});
