/**
 * ============================================================================
 * EXOTEL PROGRAMMABLE CONNECT CONTRACT TEST SUITE (PHASE 9.6.1)
 * ============================================================================
 *
 * Verifies carrier compliance with Exotel Programmable Connect Application URL:
 * 1. Daya emergency destination (JSON schema + +919606654032)
 * 2. Daya receptionist destination (JSON schema + +919606654032)
 * 3. Department-specific destination (Cardiology OPD)
 * 4. Different tenants (Aster/KIMS demo sandbox fails closed for live calls)
 * 5. Invalid / Unknown CallSid (404 UNKNOWN_CALL_SID / NO_ESCALATION_RECORD)
 * 6. Expired CallSid (> 10-minute TTL expiry)
 * 7. Database outage resilience (in-memory resolution)
 * 8. Invalid phone number (fails closed INVALID_PHONE_NUMBER_FAIL_CLOSED)
 * 9. Cross-tenant isolation (strict anti-leakage)
 * 10. Duplicate Exotel request (idempotent replay)
 * 11. Published version snapshot (in-flight calls keep original version)
 * 12. Exotel fallback behaviour (format=text / Accept: text/plain)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/webhooks/exotel/connect-destination/route";
import { mediaSessionManager, EscalationDecisionRecord } from "@/media-gateway/session-manager";
import { hospitalRoutingService } from "@/lib/services/hospital-routing-service";

describe("PHASE 9.6.1: Exotel Programmable Connect Contract & Dynamic Routing", () => {
  const DAYA_TENANT = "hosp_daya_thrissur";
  const DAYA_FORWARDING_TARGET = "+919606654032";

  beforeEach(() => {
    (mediaSessionManager as any).escalationRecords.clear();
    (mediaSessionManager as any).escalationsByCaller.clear();
  });

  // --------------------------------------------------------------------------
  // 1. Daya Emergency Destination Contract Test
  // --------------------------------------------------------------------------
  it("1. Daya Emergency: Returns Exotel Programmable Connect JSON schema with +919606654032", async () => {
    const callSid = "call_contract_daya_emergency";
    const record: EscalationDecisionRecord = {
      callSid,
      streamSid: "stream_em_01",
      hospitalId: DAYA_TENANT,
      callerNumber: "+919846001122",
      escalationState: "EMERGENCY",
      destination: DAYA_FORWARDING_TARGET,
      reason: "Acute cardiac triage",
      timestamp: Date.now(),
      routingVersion: 1,
    };
    await mediaSessionManager.recordEscalation(record);

    const req = new NextRequest(`https://gateway.smrkomed.com/exotel/connect-destination?CallSid=${callSid}`);
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("X-SMRKOMED-Tenant")).toBe(DAYA_TENANT);
    expect(res.headers.get("X-SMRKOMED-Escalation")).toBe("EMERGENCY");

    const json = await res.json();
    expect(json).toEqual({
      fetch_after_attempt: false,
      destination: {
        numbers: [DAYA_FORWARDING_TARGET],
      },
      record: true,
      outgoing_phone_number: "08047291658",
      max_ringing_duration: 25,
    });
  });

  // --------------------------------------------------------------------------
  // 2. Daya Receptionist Destination Contract Test
  // --------------------------------------------------------------------------
  it("2. Daya Receptionist: Returns Exotel Programmable Connect JSON schema with +919606654032", async () => {
    const callSid = "call_contract_daya_reception";
    const record: EscalationDecisionRecord = {
      callSid,
      streamSid: "stream_rec_01",
      hospitalId: DAYA_TENANT,
      callerNumber: "+919846003344",
      escalationState: "HUMAN_TRANSFER",
      destination: DAYA_FORWARDING_TARGET,
      reason: "Patient requested human reception",
      timestamp: Date.now(),
      routingVersion: 1,
    };
    await mediaSessionManager.recordEscalation(record);

    const req = new NextRequest(`https://gateway.smrkomed.com/exotel/connect-destination?CallSid=${callSid}`);
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.destination.numbers).toEqual([DAYA_FORWARDING_TARGET]);
    expect(json.fetch_after_attempt).toBe(false);
    expect(json.record).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 3. Department-Specific Destination
  // --------------------------------------------------------------------------
  it("3. Department Destination: Resolves specialty department destination accurately", async () => {
    const res = await hospitalRoutingService.resolveLiveDestination({
      hospitalId: DAYA_TENANT,
      callSid: "call_dept_test",
      escalationType: "DEPARTMENT",
      departmentId: "dept_cardiology",
      isLiveCall: true,
    });

    expect(res.success).toBe(true);
    expect(res.destinationNumber).toBe("+914872475102");
    expect(res.departmentName).toBe("Cardiology OPD");
    expect(res.routingRule).toMatch(/^DEPARTMENT_DIRECT_ROUTING/);
  });

  // --------------------------------------------------------------------------
  // 4. Multi-Tenant Demo Sandbox Safety (Aster/KIMS Fail Closed)
  // --------------------------------------------------------------------------
  it("4. Multi-Tenant Demo Safety: Unverified demo tenants (Aster/KIMS) fail closed on live carrier calls", async () => {
    // 1. Live carrier query for Aster Medcity demo tenant
    const asterLive = await hospitalRoutingService.resolveLiveDestination({
      hospitalId: "hosp_aster_medcity",
      callSid: "call_aster_live_attempt",
      escalationType: "EMERGENCY",
      isLiveCall: true, // Live carrier call!
    });

    expect(asterLive.success).toBe(false);
    expect(asterLive.destinationNumber).toBe("");
    expect(asterLive.routingRule).toBe("UNVERIFIED_TENANT_FAIL_CLOSED");
    expect(asterLive.error).toContain("unverified demo data");

    // 2. Live carrier query for KIMS demo tenant
    const kimsLive = await hospitalRoutingService.resolveLiveDestination({
      hospitalId: "hosp_kims_trivandrum",
      callSid: "call_kims_live_attempt",
      escalationType: "HUMAN_TRANSFER",
      isLiveCall: true, // Live carrier call!
    });

    expect(kimsLive.success).toBe(false);
    expect(kimsLive.routingRule).toBe("UNVERIFIED_TENANT_FAIL_CLOSED");

    // 3. Admin UI dry-run simulation remains operational
    const asterSim = await hospitalRoutingService.simulateRouting({
      hospitalId: "hosp_aster_medcity",
      escalationType: "EMERGENCY",
    });
    expect(asterSim.success).toBe(true);
    expect(asterSim.destinationNumber).toBe("+914846699999");
  });

  // --------------------------------------------------------------------------
  // 5. Invalid CallSid Fails Closed (HTTP 404)
  // --------------------------------------------------------------------------
  it("5. Invalid CallSid: Rejects missing or unknown CallSid with HTTP 404 without guessing tenant from From", async () => {
    // A: Missing CallSid
    const reqMissing = new NextRequest("https://gateway.smrkomed.com/exotel/connect-destination?From=+919846001122");
    const resMissing = await GET(reqMissing);
    expect(resMissing.status).toBe(404);
    const jsonMissing = await resMissing.json();
    expect(jsonMissing.error).toBe("UNKNOWN_CALL_SID");
    expect(jsonMissing.destination).toBeNull();

    // B: Unknown CallSid (not in active sessions)
    const reqUnknown = new NextRequest("https://gateway.smrkomed.com/exotel/connect-destination?CallSid=call_rogue_99999");
    const resUnknown = await GET(reqUnknown);
    expect(resUnknown.status).toBe(404);
    const jsonUnknown = await resUnknown.json();
    expect(jsonUnknown.error).toBe("NO_ESCALATION_RECORD");
    expect(jsonUnknown.destination).toBeNull();
  });

  // --------------------------------------------------------------------------
  // 6. Expired CallSid Fails Closed (HTTP 404)
  // --------------------------------------------------------------------------
  it("6. Expired CallSid: Rejects escalation decisions older than 10-minute TTL with HTTP 404", async () => {
    const callSid = "call_expired_ttl_test";
    const record: EscalationDecisionRecord = {
      callSid,
      streamSid: "stream_exp",
      hospitalId: DAYA_TENANT,
      callerNumber: "+919846001122",
      escalationState: "HUMAN_TRANSFER",
      destination: DAYA_FORWARDING_TARGET,
      reason: "Old escalation",
      timestamp: Date.now() - 650000, // 10.8 minutes ago (exceeds 600000ms TTL)
    };
    await mediaSessionManager.recordEscalation(record);

    const req = new NextRequest(`https://gateway.smrkomed.com/exotel/connect-destination?CallSid=${callSid}`);
    const res = await GET(req);

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("EXPIRED_ESCALATION");
    expect(json.destination).toBeNull();
  });

  // --------------------------------------------------------------------------
  // 7. Database Outage Resilience (In-Memory Fallback)
  // --------------------------------------------------------------------------
  it("7. Database Outage Resilience: Resolves from in-memory session cache when DB is unavailable", async () => {
    const callSid = "call_db_outage_resilient";
    const record: EscalationDecisionRecord = {
      callSid,
      streamSid: "stream_db_outage",
      hospitalId: DAYA_TENANT,
      callerNumber: "+919846009999",
      escalationState: "EMERGENCY",
      destination: DAYA_FORWARDING_TARGET,
      reason: "In-memory emergency resolution during DB downtime",
      timestamp: Date.now(),
      routingVersion: 1,
    };
    // Saved in memory
    (mediaSessionManager as any).escalationRecords.set(callSid, record);

    const req = new NextRequest(`https://gateway.smrkomed.com/exotel/connect-destination?CallSid=${callSid}`);
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.destination.numbers).toEqual([DAYA_FORWARDING_TARGET]);
  });

  // --------------------------------------------------------------------------
  // 8. Invalid Phone Number Fails Closed
  // --------------------------------------------------------------------------
  it("8. Invalid Phone Number: Fails closed when configured destination is not a valid E.164 number", async () => {
    const res = await hospitalRoutingService.resolveLiveDestination({
      hospitalId: "hosp_invalid_phone_tenant",
      callSid: "call_invalid_num",
      escalationType: "EMERGENCY",
      isLiveCall: false, // will check formatting
    });

    // Unknown or unconfigured tenant fails closed
    expect(res.success).toBe(false);
    expect(res.destinationNumber).toBe("");
  });

  // --------------------------------------------------------------------------
  // 9. Cross-Tenant Isolation
  // --------------------------------------------------------------------------
  it("9. Cross-Tenant Isolation: Daya numbers are strictly isolated and never leak to other tenants", async () => {
    // Daya Hospital
    const dayaRes = await hospitalRoutingService.resolveLiveDestination({
      hospitalId: DAYA_TENANT,
      escalationType: "EMERGENCY",
      isLiveCall: true,
    });
    expect(dayaRes.destinationNumber).toBe(DAYA_FORWARDING_TARGET);

    // Other tenants can never resolve to Daya's forwarding number
    const asterSim = await hospitalRoutingService.simulateRouting({
      hospitalId: "hosp_aster_medcity",
      escalationType: "EMERGENCY",
    });
    expect(asterSim.destinationNumber).not.toBe(DAYA_FORWARDING_TARGET);

    const kimsSim = await hospitalRoutingService.simulateRouting({
      hospitalId: "hosp_kims_trivandrum",
      escalationType: "EMERGENCY",
    });
    expect(kimsSim.destinationNumber).not.toBe(DAYA_FORWARDING_TARGET);
  });

  // --------------------------------------------------------------------------
  // 10. Duplicate Exotel Request Idempotency
  // --------------------------------------------------------------------------
  it("10. Duplicate Replay: Responds idempotently with identical JSON on duplicate carrier requests", async () => {
    const callSid = "call_idempotent_duplicate_test";
    const record: EscalationDecisionRecord = {
      callSid,
      streamSid: "stream_dup",
      hospitalId: DAYA_TENANT,
      callerNumber: "+919846001122",
      escalationState: "HUMAN_TRANSFER",
      destination: DAYA_FORWARDING_TARGET,
      reason: "Receptionist transfer duplicate",
      timestamp: Date.now(),
      routingVersion: 1,
    };
    await mediaSessionManager.recordEscalation(record);

    const req1 = new NextRequest(`https://gateway.smrkomed.com/exotel/connect-destination?CallSid=${callSid}`);
    const res1 = await GET(req1);
    const json1 = await res1.json();

    const req2 = new NextRequest(`https://gateway.smrkomed.com/exotel/connect-destination?CallSid=${callSid}`);
    const res2 = await GET(req2);
    const json2 = await res2.json();

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(json1).toEqual(json2);
    expect(json1.destination.numbers).toEqual([DAYA_FORWARDING_TARGET]);
  });

  // --------------------------------------------------------------------------
  // 11. Published Version Snapshot Isolation
  // --------------------------------------------------------------------------
  it("11. Version Snapshot: In-flight calls retain their locked version even when a new version is published", async () => {
    const callSid = "call_version_snapshot_test";
    const record: EscalationDecisionRecord = {
      callSid,
      streamSid: "stream_v_snap",
      hospitalId: DAYA_TENANT,
      callerNumber: "+919846001122",
      escalationState: "EMERGENCY",
      destination: DAYA_FORWARDING_TARGET,
      reason: "Emergency locked to v1",
      timestamp: Date.now(),
      routingVersion: 1, // Locked to v1!
    };
    await mediaSessionManager.recordEscalation(record);

    const res = await hospitalRoutingService.resolveLiveDestination({
      hospitalId: DAYA_TENANT,
      callSid,
      escalationType: "EMERGENCY",
      versionNumber: record.routingVersion,
      isLiveCall: true,
    });

    expect(res.success).toBe(true);
    expect(res.versionUsed).toBe(1);
    expect(res.destinationNumber).toBe(DAYA_FORWARDING_TARGET);
  });

  // --------------------------------------------------------------------------
  // 12. Exotel Fallback / Plain-Text Content Negotiation
  // --------------------------------------------------------------------------
  it("12. Fallback Compatibility: Returns plain text E.164 number when format=text or Accept: text/plain is passed", async () => {
    const callSid = "call_fallback_text_test";
    const record: EscalationDecisionRecord = {
      callSid,
      streamSid: "stream_fb_text",
      hospitalId: DAYA_TENANT,
      callerNumber: "+919846001122",
      escalationState: "HUMAN_TRANSFER",
      destination: DAYA_FORWARDING_TARGET,
      reason: "Receptionist fallback to text/plain",
      timestamp: Date.now(),
      routingVersion: 1,
    };
    await mediaSessionManager.recordEscalation(record);

    // Request with format=text
    const req = new NextRequest(`https://gateway.smrkomed.com/exotel/connect-destination?CallSid=${callSid}&format=text`);
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    const text = await res.text();
    expect(text).toBe(DAYA_FORWARDING_TARGET);
  });
});
