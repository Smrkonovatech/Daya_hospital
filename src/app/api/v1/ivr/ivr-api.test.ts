import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET as getFlows, POST as createFlow } from "./flows/route";
import { GET as getFlowById, PUT as updateFlow } from "./flows/[flowId]/route";
import { POST as validateFlow } from "./flows/[flowId]/validate/route";
import { POST as publishFlow } from "./flows/[flowId]/publish/route";
import { GET as getVersions } from "./flows/[flowId]/versions/route";
import { POST as rollbackFlow } from "./flows/[flowId]/rollback/route";
import { POST as simulateFlow } from "./flows/[flowId]/simulate/route";

describe("IVR Flows REST APIs (Phase 4)", () => {
  const hospitalId = "hosp_daya_thrissur";

  it("GET /api/v1/ivr/flows returns list of hospital flows", async () => {
    const req = new NextRequest(`http://localhost:3000/api/v1/ivr/flows?hospitalId=${hospitalId}`);
    const res = await getFlows(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBeGreaterThanOrEqual(1);
  });

  it("POST /api/v1/ivr/flows creates a new flow", async () => {
    const flowName = `Cardiology Triage Flow ${Date.now()}`;
    const req = new NextRequest("http://localhost:3000/api/v1/ivr/flows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hospitalId,
        name: flowName,
        description: "Specialized cardiology call routing flow",
      }),
    });

    const res = await createFlow(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.success).toBe(true);
    expect(json.data.name).toBe(flowName);
    expect(json.data.nodes.length).toBeGreaterThan(5);
  });

  it("POST /api/v1/ivr/flows rejects empty name", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/ivr/flows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hospitalId,
        name: "   ",
      }),
    });

    const res = await createFlow(req);
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.success).toBe(false);
  });

  it("PUT and GET /api/v1/ivr/flows/[flowId] saves and retrieves draft", async () => {
    const flowId = `flow_api_test_${Date.now()}`;
    // Create draft
    const putReq = new NextRequest(`http://localhost:3000/api/v1/ivr/flows/${flowId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: flowId,
        hospitalId,
        name: "Draft API Flow",
        description: "API testing draft",
      }),
    });

    const putRes = await updateFlow(putReq, { params: Promise.resolve({ flowId }) });
    expect(putRes.status).toBe(200);

    // Retrieve
    const getReq = new NextRequest(`http://localhost:3000/api/v1/ivr/flows/${flowId}?hospitalId=${hospitalId}`);
    const getRes = await getFlowById(getReq, { params: Promise.resolve({ flowId }) });
    const getJson = await getRes.json();

    expect(getRes.status).toBe(200);
    expect(getJson.success).toBe(true);
    expect(getJson.data.name).toBe("Draft API Flow");
  });

  it("POST /api/v1/ivr/flows/[flowId]/validate validates flow", async () => {
    const listReq = new NextRequest(`http://localhost:3000/api/v1/ivr/flows?hospitalId=${hospitalId}`);
    const listRes = await getFlows(listReq);
    const listJson = await listRes.json();
    const targetFlow = listJson.data.find((f: { nodes: unknown[] }) => f.nodes.length > 0) || listJson.data[0];

    const valReq = new NextRequest(`http://localhost:3000/api/v1/ivr/flows/${targetFlow.id}/validate`, {
      method: "POST",
    });
    const valRes = await validateFlow(valReq, { params: Promise.resolve({ flowId: targetFlow.id }) });
    const valJson = await valRes.json();

    expect(valRes.status).toBe(200);
    expect(valJson.success).toBe(true);
    expect(valJson.data.isValid).toBe(true);
  });

  it("POST /api/v1/ivr/flows/[flowId]/publish and versions endpoint", async () => {
    const listReq = new NextRequest(`http://localhost:3000/api/v1/ivr/flows?hospitalId=${hospitalId}`);
    const listRes = await getFlows(listReq);
    const listJson = await listRes.json();
    const targetFlow = listJson.data.find((f: { nodes: unknown[] }) => f.nodes.length > 0) || listJson.data[0];

    const pubReq = new NextRequest(`http://localhost:3000/api/v1/ivr/flows/${targetFlow.id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hospitalId,
        changelog: "API test publish v2",
      }),
    });

    const pubRes = await publishFlow(pubReq, { params: Promise.resolve({ flowId: targetFlow.id }) });
    const pubJson = await pubRes.json();

    expect(pubRes.status).toBe(200);
    expect(pubJson.success).toBe(true);
    expect(pubJson.versionNumber).toBeGreaterThanOrEqual(1);

    // Get versions
    const verReq = new NextRequest(`http://localhost:3000/api/v1/ivr/flows/${targetFlow.id}/versions?hospitalId=${hospitalId}`);
    const verRes = await getVersions(verReq, { params: Promise.resolve({ flowId: targetFlow.id }) });
    const verJson = await verRes.json();

    expect(verRes.status).toBe(200);
    expect(verJson.success).toBe(true);
    expect(Array.isArray(verJson.data)).toBe(true);

    // Publish second version
    const pubReq2 = new NextRequest(`http://localhost:3000/api/v1/ivr/flows/${targetFlow.id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hospitalId,
        changelog: "Second publish version",
      }),
    });
    const pubRes2 = await publishFlow(pubReq2, { params: Promise.resolve({ flowId: targetFlow.id }) });
    expect(pubRes2.status).toBe(200);

    // Rollback to first published version
    const rbReq = new NextRequest(`http://localhost:3000/api/v1/ivr/flows/${targetFlow.id}/rollback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hospitalId,
        targetVersion: pubJson.versionNumber,
      }),
    });

    const rbRes = await rollbackFlow(rbReq, { params: Promise.resolve({ flowId: targetFlow.id }) });
    const rbJson = await rbRes.json();
    expect(rbRes.status).toBe(200);
    expect(rbJson.success).toBe(true);
  });

  it("POST /api/v1/ivr/flows/[flowId]/simulate runs turn-by-turn simulation", async () => {
    const listReq = new NextRequest(`http://localhost:3000/api/v1/ivr/flows?hospitalId=${hospitalId}`);
    const listRes = await getFlows(listReq);
    const listJson = await listRes.json();
    const targetFlow = listJson.data[0];

    // Turn 1: Start Call
    const simReq1 = new NextRequest(`http://localhost:3000/api/v1/ivr/flows/${targetFlow.id}/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hospitalId,
        callerNumber: "+919447199999",
        language: "ml-IN",
        input: { type: "START_CALL" },
      }),
    });

    const simRes1 = await simulateFlow(simReq1, { params: Promise.resolve({ flowId: targetFlow.id }) });
    const simJson1 = await simRes1.json();

    expect(simRes1.status).toBe(200);
    expect(simJson1.success).toBe(true);
    expect(simJson1.data.action).toBeDefined();
    expect(simJson1.data.context).toBeDefined();

    // Turn 2: Send Emergency Keyword
    const simReq2 = new NextRequest(`http://localhost:3000/api/v1/ivr/flows/${targetFlow.id}/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hospitalId,
        context: simJson1.data.context,
        input: { type: "EMERGENCY_DETECTED", value: "Emergency!" },
      }),
    });

    const simRes2 = await simulateFlow(simReq2, { params: Promise.resolve({ flowId: targetFlow.id }) });
    const simJson2 = await simRes2.json();

    expect(simRes2.status).toBe(200);
    expect(simJson2.data.action).toBe("EMERGENCY_ESCALATE");
    expect(simJson2.data.context.isEmergency).toBe(true);
  });
});
