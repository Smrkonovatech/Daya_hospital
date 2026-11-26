import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  hospitalRoutingService,
  isValidE164,
  formatE164,
  HospitalRoutingConfig,
} from "./hospital-routing-service";
import { prisma, checkDatabaseConnection } from "@/lib/db/prisma";

describe("PHASE 9.6: Multi-Tenant Dynamic Telephony Destination Routing", () => {
  beforeAll(async () => {
    try {
      const dbStatus = await checkDatabaseConnection();
      if (dbStatus.connected) {
        await prisma.hospitalConfigVersion.deleteMany({
          where: { hospitalId: { in: ["hosp_aster_medcity", "hosp_kims_trivandrum"] } },
        });
        await prisma.hospitalConfigDraft.deleteMany({
          where: { hospitalId: { in: ["hosp_aster_medcity", "hosp_kims_trivandrum"] } },
        });
      }
    } catch {}
  });

  afterAll(async () => {
    try {
      const dbStatus = await checkDatabaseConnection();
      if (dbStatus.connected) {
        await prisma.hospitalConfigVersion.deleteMany({
          where: { hospitalId: { in: ["hosp_aster_medcity", "hosp_kims_trivandrum"] } },
        });
        await prisma.hospitalConfigDraft.deleteMany({
          where: { hospitalId: { in: ["hosp_aster_medcity", "hosp_kims_trivandrum"] } },
        });
      }
    } catch {}
  });

  // --------------------------------------------------------------------------
  // 1. E.164 Validation & Formatting Tests
  // --------------------------------------------------------------------------
  describe("E.164 Validation & Sanitization", () => {
    it("accepts valid E.164 numbers from India and international carriers", () => {
      expect(isValidE164("+919606654032")).toBe(true);
      expect(isValidE164("+914872475100")).toBe(true);
      expect(isValidE164("+914846699999")).toBe(true);
      expect(isValidE164("+14155552671")).toBe(true);
      expect(isValidE164("+442071838750")).toBe(true);
    });

    it("rejects non-E.164 numbers (local extensions, national 10-digit without +, letters)", () => {
      expect(isValidE164("9606654032")).toBe(false); // Missing leading +
      expect(isValidE164("04872475100")).toBe(false); // National trunk prefix 0
      expect(isValidE164("100")).toBe(false); // Short extension
      expect(isValidE164("201")).toBe(false);
      expect(isValidE164("+0123456789")).toBe(false); // Invalid country code 0
      expect(isValidE164("+91-9606-654032")).toBe(true); // Space/dash tolerance in regex helper
      expect(isValidE164("invalid_phone")).toBe(false);
      expect(isValidE164("")).toBe(false);
    });

    it("formats 10-digit national mobile to E.164 by prepending +91", () => {
      expect(formatE164("9606654032")).toBe("+919606654032");
      expect(formatE164("+919606654032")).toBe("+919606654032");
      expect(formatE164("+91 96066 54032")).toBe("+919606654032");
    });
  });

  // --------------------------------------------------------------------------
  // 2. Multi-Tenant Dynamic Resolution Across 3 Synthetic Hospital Tenants
  // --------------------------------------------------------------------------
  describe("Dynamic Destination Resolution Across 3 Hospital Tenants", () => {
    const tenants = [
      {
        id: "hosp_daya_thrissur",
        name: "Daya General Hospital",
        expectedEmergency: "+919606654032",
        expectedReception: "+919606654032",
        cardiologyDept: "+914872475102",
      },
      {
        id: "hosp_aster_medcity",
        name: "Aster Medcity Kochi",
        expectedEmergency: "+914846699999",
        expectedReception: "+914846699000",
        cardiologyDept: "+914846699101",
      },
      {
        id: "hosp_kims_trivandrum",
        name: "KIMSHEALTH Trivandrum",
        expectedEmergency: "+914713041999",
        expectedReception: "+914713041234",
        pediatricsDept: "+914713041555",
      },
    ];

    tenants.forEach((tenant) => {
      it(`resolves correct emergency and reception destinations for ${tenant.name} (${tenant.id})`, async () => {
        // Test Emergency
        const emRes = await hospitalRoutingService.resolveLiveDestination({
          hospitalId: tenant.id,
          callSid: `call_em_${tenant.id}`,
          escalationType: "EMERGENCY",
        });
        expect(emRes.success).toBe(true);
        expect(emRes.hospitalId).toBe(tenant.id);
        expect(emRes.destinationNumber).toBe(tenant.expectedEmergency);
        expect(isValidE164(emRes.destinationNumber)).toBe(true);

        // Test Receptionist
        const recRes = await hospitalRoutingService.resolveLiveDestination({
          hospitalId: tenant.id,
          callSid: `call_rec_${tenant.id}`,
          escalationType: "HUMAN_TRANSFER",
        });
        expect(recRes.success).toBe(true);
        expect(recRes.hospitalId).toBe(tenant.id);
        expect(recRes.destinationNumber).toBe(tenant.expectedReception);
        expect(isValidE164(recRes.destinationNumber)).toBe(true);
      });
    });

    it("resolves specialty department destinations accurately per tenant", async () => {
      // Daya Cardiology OPD
      const dayaCardio = await hospitalRoutingService.resolveLiveDestination({
        hospitalId: "hosp_daya_thrissur",
        escalationType: "DEPARTMENT",
        departmentId: "dept_cardiology",
      });
      expect(dayaCardio.success).toBe(true);
      expect(dayaCardio.destinationNumber).toBe("+914872475102");
      expect(dayaCardio.departmentName).toBe("Cardiology OPD");

      // Aster Cardiology OPD
      const asterCardio = await hospitalRoutingService.resolveLiveDestination({
        hospitalId: "hosp_aster_medcity",
        escalationType: "DEPARTMENT",
        departmentId: "dept_cardiology",
      });
      expect(asterCardio.success).toBe(true);
      expect(asterCardio.destinationNumber).toBe("+914846699101");
      expect(asterCardio.departmentName).toBe("Cardiology OPD");

      // KIMS Pediatrics OPD
      const kimsPed = await hospitalRoutingService.resolveLiveDestination({
        hospitalId: "hosp_kims_trivandrum",
        escalationType: "DEPARTMENT",
        departmentId: "dept_pediatrics",
      });
      expect(kimsPed.success).toBe(true);
      expect(kimsPed.destinationNumber).toBe("+914713041555");
      expect(kimsPed.departmentName).toBe("Pediatrics OPD");
    });
  });

  // --------------------------------------------------------------------------
  // 3. Strict Cross-Tenant Isolation & Anti-Leakage
  // --------------------------------------------------------------------------
  describe("Cross-Tenant Isolation & Anti-Leakage Safeguards", () => {
    it("guarantees Aster Medcity tenant never receives Daya Hospital destinations", async () => {
      const asterEm = await hospitalRoutingService.resolveLiveDestination({
        hospitalId: "hosp_aster_medcity",
        escalationType: "EMERGENCY",
      });
      expect(asterEm.destinationNumber).not.toBe("+919606654032");
      expect(asterEm.destinationNumber).toBe("+914846699999");

      const asterRec = await hospitalRoutingService.resolveLiveDestination({
        hospitalId: "hosp_aster_medcity",
        escalationType: "HUMAN_TRANSFER",
      });
      expect(asterRec.destinationNumber).not.toBe("+919606654032");
      expect(asterRec.destinationNumber).toBe("+914846699000");
    });

    it("guarantees Daya Hospital tenant never receives KIMS or Aster destinations", async () => {
      const dayaEm = await hospitalRoutingService.resolveLiveDestination({
        hospitalId: "hosp_daya_thrissur",
        escalationType: "EMERGENCY",
      });
      expect(dayaEm.destinationNumber).toBe("+919606654032");
      expect(dayaEm.destinationNumber).not.toBe("+914846699999");
      expect(dayaEm.destinationNumber).not.toBe("+914713041999");
    });
  });

  // --------------------------------------------------------------------------
  // 4. Fail-Closed on Unknown or Rogue Tenants
  // --------------------------------------------------------------------------
  describe("Fail-Closed Security on Invalid Tenants", () => {
    it("fails closed when tenant is unknown or unconfigured", async () => {
      const rogueRes = await hospitalRoutingService.resolveLiveDestination({
        hospitalId: "hosp_rogue_unregistered_tenant",
        escalationType: "EMERGENCY",
      });
      expect(rogueRes.success).toBe(false);
      expect(rogueRes.destinationNumber).toBe("");
      expect(rogueRes.routingRule).toBe("TENANT_UNCONFIGURED_FAIL_CLOSED");
    });

    it("fails closed when hospitalId is empty or whitespace", async () => {
      const emptyRes = await hospitalRoutingService.resolveLiveDestination({
        hospitalId: "   ",
        escalationType: "HUMAN_TRANSFER",
      });
      expect(emptyRes.success).toBe(false);
      expect(emptyRes.destinationNumber).toBe("");
      expect(emptyRes.routingRule).toBe("TENANT_INVALID_FAIL_CLOSED");
    });
  });

  // --------------------------------------------------------------------------
  // 5. Immutable Published Versioning & In-Flight Call Resilience
  // --------------------------------------------------------------------------
  describe("Immutable Configuration Versioning & In-Flight Call Resilience", () => {
    it(
      "maintains version snapshot isolation so active calls are unaffected by new publishes",
      async () => {
      const tenantId = `hosp_version_test_${Date.now()}`;

      // 1. Initialize draft and publish Version 1
      await hospitalRoutingService.saveDraft(
        tenantId,
        {
          emergencyDestination: {
            primaryNumber: "+914846699999",
            departmentName: "Aster Emergency Facility",
          },
          receptionistDestination: {
            primaryNumber: "+914846699000",
            departmentName: "Aster Front Desk",
          },
        },
        "usr_admin",
        "Aster Admin"
      );

      const pub1 = await hospitalRoutingService.publishVersion(
        tenantId,
        "Version 1 baseline",
        "usr_admin",
        "Aster Admin"
      );
      expect(pub1.success).toBe(true);
      const v1 = pub1.versionNumber;

      // 2. Active call locks to version v1
      const activeCallSid = "call_in_flight_12345";
      const callResolutionV1 = await hospitalRoutingService.resolveLiveDestination({
        hospitalId: tenantId,
        callSid: activeCallSid,
        escalationType: "EMERGENCY",
        versionNumber: v1,
      });
      expect(callResolutionV1.destinationNumber).toBe("+914846699999");
      expect(callResolutionV1.versionUsed).toBe(v1);

      // 3. Admin updates draft to a NEW emergency number and publishes Version 2
      await hospitalRoutingService.saveDraft(
        tenantId,
        {
          emergencyDestination: {
            primaryNumber: "+914846699888", // Changed number
            departmentName: "Aster New Trauma Facility",
          },
        },
        "usr_admin",
        "Aster Admin"
      );

      const pub2 = await hospitalRoutingService.publishVersion(
        tenantId,
        "Version 2 updated emergency hotline to +914846699888",
        "usr_admin",
        "Aster Admin"
      );
      expect(pub2.success).toBe(true);
      const v2 = pub2.versionNumber;
      expect(v2).toBeGreaterThan(v1);

      // 4. Assert: In-flight active call querying with locked version v1 STILL gets original number
      const inFlightCheck = await hospitalRoutingService.resolveLiveDestination({
        hospitalId: tenantId,
        callSid: activeCallSid,
        escalationType: "EMERGENCY",
        versionNumber: v1, // Locked to v1!
      });
      expect(inFlightCheck.destinationNumber).toBe("+914846699999");
      expect(inFlightCheck.versionUsed).toBe(v1);

      // 5. Assert: New incoming calls querying without version lock (latest) get new v2 number
      const newCallCheck = await hospitalRoutingService.resolveLiveDestination({
        hospitalId: tenantId,
        callSid: "call_new_incoming_67890",
        escalationType: "EMERGENCY",
      });
      expect(newCallCheck.destinationNumber).toBe("+914846699888");
      expect(newCallCheck.versionUsed).toBe(v2);

      // 6. Rollback to v1
      const rollbackOk = await hospitalRoutingService.rollbackVersion(tenantId, v1);
      expect(rollbackOk).toBe(true);

      const rolledBackCheck = await hospitalRoutingService.resolveLiveDestination({
        hospitalId: tenantId,
        escalationType: "EMERGENCY",
      });
      expect(rolledBackCheck.destinationNumber).toBe("+914846699999");
      expect(rolledBackCheck.versionUsed).toBe(v1);
    }, 15000);
  });

  // --------------------------------------------------------------------------
  // 6. Idempotency & Replay Protection
  // --------------------------------------------------------------------------
  describe("Idempotency & Duplicate Replay Protection", () => {
    it("returns identical deterministic destination and state on duplicate carrier queries", async () => {
      const callSid = "exotel_call_sid_idempotent_test";

      const firstCall = await hospitalRoutingService.resolveLiveDestination({
        hospitalId: "hosp_daya_thrissur",
        callSid,
        escalationType: "HUMAN_TRANSFER",
      });

      const secondCall = await hospitalRoutingService.resolveLiveDestination({
        hospitalId: "hosp_daya_thrissur",
        callSid,
        escalationType: "HUMAN_TRANSFER",
      });

      expect(firstCall.destinationNumber).toBe(secondCall.destinationNumber);
      expect(firstCall.routingRule).toBe(secondCall.routingRule);
      expect(firstCall.departmentName).toBe(secondCall.departmentName);
      expect(firstCall.destinationNumber).toBe("+919606654032");
    });
  });

  // --------------------------------------------------------------------------
  // 7. Dry-Run Routing Simulation Engine
  // --------------------------------------------------------------------------
  describe("Carrier Dry-Run Routing Simulation", () => {
    it("simulates after-hours casualty transfer behavior", async () => {
      const sim = await hospitalRoutingService.simulateRouting({
        hospitalId: "hosp_daya_thrissur",
        escalationType: "AFTER_HOURS",
        simulatedTimeIso: "2026-11-23T23:30:00.000Z", // Night 11:30 PM
      });

      expect(sim.success).toBe(true);
      expect(sim.isAfterHours).toBe(true);
      expect(sim.routingRule).toBe("AFTER_HOURS_ESCALATION");
      expect(sim.destinationNumber).toBe("+919606654032");
    });

    it("simulates human fallback when receptionist does not answer", async () => {
      const sim = await hospitalRoutingService.simulateRouting({
        hospitalId: "hosp_daya_thrissur",
        escalationType: "FALLBACK",
      });

      expect(sim.success).toBe(true);
      expect(sim.routingRule).toBe("HUMAN_FALLBACK_ROUTING");
      expect(sim.departmentName).toBe("Supervisor Fallback Desk");
      expect(sim.destinationNumber).toBe("+919606654032");
    });
  });
});
