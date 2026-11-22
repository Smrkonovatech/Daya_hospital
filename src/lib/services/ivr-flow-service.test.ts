import { describe, it, expect } from "vitest";
import { ivrFlowService } from "./ivr-flow-service";
import { createDefaultHospitalFlow } from "./ivr-node-definitions";

describe("IvrFlowService (Phase 4)", () => {
  const hospitalId = "hosp_daya_thrissur";

  it("retrieves or seeds default flow for hospital tenant", async () => {
    const flows = await ivrFlowService.getFlowsByHospital(hospitalId);
    expect(flows.length).toBeGreaterThanOrEqual(1);

    const defaultFlow = flows.find((f) => f.isDefault);
    expect(defaultFlow).toBeDefined();
    expect(defaultFlow?.hospitalId).toBe(hospitalId);
    expect(defaultFlow?.nodes.length).toBeGreaterThan(5);
  });

  it("saves and updates a flow draft", async () => {
    const defaultFlow = createDefaultHospitalFlow(hospitalId, "Test Outpatient Flow");
    const flowId = `flow_test_${Date.now()}`;

    const saved = await ivrFlowService.saveDraft(
      {
        ...defaultFlow,
        id: flowId,
        hospitalId,
        name: "Test Outpatient Flow",
        status: "DRAFT",
        deploymentStatus: "SMRKOMED_DRAFT",
      },
      "Test Administrator"
    );

    expect(saved.id).toBe(flowId);
    expect(saved.status).toBe("DRAFT");
    expect(saved.deploymentStatus).toBe("SMRKOMED_DRAFT");

    const fetched = await ivrFlowService.getFlowById(flowId, hospitalId);
    expect(fetched?.name).toBe("Test Outpatient Flow");
  });

  it("enforces tenant isolation: blocks access to flow belonging to another hospital", async () => {
    const flowId = `flow_tenant_isolated_${Date.now()}`;
    await ivrFlowService.saveDraft({
      ...createDefaultHospitalFlow("hosp_apollo_kochi", "Apollo Kochi Flow"),
      id: flowId,
      hospitalId: "hosp_apollo_kochi",
      name: "Apollo Flow",
    });

    // Attempt to access with Daya Hospital ID
    const crossTenantAccess = await ivrFlowService.getFlowById(flowId, "hosp_daya_thrissur");
    expect(crossTenantAccess).toBeNull();
  });

  it("validates flow and updates status to VALIDATED", async () => {
    const flowId = `flow_val_${Date.now()}`;
    await ivrFlowService.saveDraft({
      ...createDefaultHospitalFlow(hospitalId),
      id: flowId,
      hospitalId,
      name: "Valid Flow",
      status: "DRAFT",
    });

    const validation = await ivrFlowService.validateFlow(flowId, hospitalId);
    expect(validation.isValid).toBe(true);
    expect(validation.errors.length).toBe(0);

    const updated = await ivrFlowService.getFlowById(flowId, hospitalId);
    expect(updated?.status).toBe("VALIDATED");
  });

  it("publishes flow, creating an immutable version snapshot", async () => {
    const flowId = `flow_pub_${Date.now()}`;
    await ivrFlowService.saveDraft({
      ...createDefaultHospitalFlow(hospitalId),
      id: flowId,
      hospitalId,
      name: "Publish Test Flow",
    });

    const pubResult = await ivrFlowService.publishFlow(
      flowId,
      hospitalId,
      "Version 2 release: added emergency triage",
      "Lead Medical Director"
    );

    expect(pubResult.success).toBe(true);
    expect(pubResult.versionNumber).toBe(2);

    // Verify version history
    const versions = await ivrFlowService.getFlowVersions(flowId, hospitalId);
    expect(versions.length).toBeGreaterThanOrEqual(1);
    expect(versions[0].versionNumber).toBe(2);
    expect(versions[0].changelog).toBe("Version 2 release: added emergency triage");
    expect(versions[0].snapshot.name).toBe("Publish Test Flow");
  });

  it("rolls back flow to a previous version snapshot", async () => {
    const flowId = `flow_rb_${Date.now()}`;
    const initialFlow = createDefaultHospitalFlow(hospitalId);
    await ivrFlowService.saveDraft({
      ...initialFlow,
      id: flowId,
      hospitalId,
      name: "Initial Version 1",
    });

    // Publish v2
    await ivrFlowService.publishFlow(flowId, hospitalId, "Release v2");

    // Modify draft to v3
    await ivrFlowService.saveDraft({
      ...initialFlow,
      id: flowId,
      hospitalId,
      name: "Modified Name v3",
    });
    await ivrFlowService.publishFlow(flowId, hospitalId, "Release v3");

    // Roll back to v2
    const rbResult = await ivrFlowService.rollbackFlow(flowId, 2, hospitalId, "Auditor");
    expect(rbResult.success).toBe(true);
    expect(rbResult.versionNumber).toBe(4); // New published version created from v2 snapshot
  });

  it("updates Exotel applet mapping and marks deployment verified", async () => {
    const flowId = `flow_exotel_${Date.now()}`;
    await ivrFlowService.saveDraft({
      ...createDefaultHospitalFlow(hospitalId),
      id: flowId,
      hospitalId,
      name: "Exotel Live Flow",
    });

    const result = await ivrFlowService.updateExotelMapping(
      flowId,
      hospitalId,
      {
        appletId: "1393239",
        appletName: "Daya Hospital Voicebot Applet",
      },
      "Telephony Engineer"
    );

    expect(result.success).toBe(true);
    expect(result.flow.deploymentStatus).toBe("EXOTEL_MAPPING_VERIFIED");
    expect(result.flow.exotelMapping?.appletId).toBe("1393239");
    expect(result.flow.exotelMapping?.lastVerificationStatus).toBe("VERIFIED");
  });
});
