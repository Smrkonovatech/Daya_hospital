import { describe, it, expect } from "vitest";
import { IvrFlowValidator } from "./ivr-flow-validator";
import { createDefaultNode, createDefaultHospitalFlow } from "./ivr-node-definitions";
import { FlowEdge } from "@/lib/types/ivr-flow";

describe("IvrFlowValidator (Phase 4)", () => {
  it("validates a healthy default hospital flow with 0 errors", () => {
    const defaultFlow = createDefaultHospitalFlow("hosp_daya_thrissur", "Daya Hospital Thrissur");
    const result = IvrFlowValidator.validate(defaultFlow.nodes, defaultFlow.edges);

    expect(result.isValid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it("fails validation when start node (INCOMING_CALL) is missing", () => {
    const defaultFlow = createDefaultHospitalFlow("hosp_daya_thrissur");
    const nodesWithoutStart = defaultFlow.nodes.filter((n) => n.type !== "INCOMING_CALL");
    const result = IvrFlowValidator.validate(nodesWithoutStart, defaultFlow.edges);

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === "MISSING_ENTRY_NODE")).toBe(true);
  });

  it("fails validation when multiple start nodes exist", () => {
    const defaultFlow = createDefaultHospitalFlow("hosp_daya_thrissur");
    const duplicateStart = createDefaultNode("INCOMING_CALL", { x: 100, y: 100 });
    const nodes = [...defaultFlow.nodes, duplicateStart];
    const result = IvrFlowValidator.validate(nodes, defaultFlow.edges);

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === "MULTIPLE_ENTRY_NODES")).toBe(true);
  });

  it("catches direct self-connections on a node", () => {
    const defaultFlow = createDefaultHospitalFlow("hosp_daya_thrissur");
    const menuNode = defaultFlow.nodes.find((n) => n.type === "IVR_MENU")!;

    const selfEdge: FlowEdge = {
      id: "edge_self_loop",
      sourceNodeId: menuNode.id,
      sourcePortId: "opt_1",
      targetNodeId: menuNode.id,
      targetPortId: "in",
    };

    const result = IvrFlowValidator.validate(defaultFlow.nodes, [...defaultFlow.edges, selfEdge]);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === "DIRECT_SELF_LOOP")).toBe(true);
  });

  it("warns about unreachable / orphan nodes in the graph", () => {
    const defaultFlow = createDefaultHospitalFlow("hosp_daya_thrissur");
    const orphanNode = createDefaultNode("QUEUE_WAITING", { x: 2000, y: 2000 });
    const nodes = [...defaultFlow.nodes, orphanNode];

    const result = IvrFlowValidator.validate(nodes, defaultFlow.edges);
    expect(result.warnings.some((w) => w.code === "UNREACHABLE_NODE")).toBe(true);
  });

  it("fails validation if IVR menu has duplicate DTMF keys", () => {
    const defaultFlow = createDefaultHospitalFlow("hosp_daya_thrissur");
    const nodes = defaultFlow.nodes.map((n) => {
      if (n.type === "IVR_MENU") {
        return {
          ...n,
          data: {
            ...n.data,
            options: [
              { key: "1", label: "Option One" },
              { key: "1", label: "Option Duplicate" },
            ],
          },
        };
      }
      return n;
    });

    const result = IvrFlowValidator.validate(nodes, defaultFlow.edges);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === "DUPLICATE_DTMF_KEY")).toBe(true);
  });

  it("fails validation if Emergency Handling node has no casualty phone number", () => {
    const defaultFlow = createDefaultHospitalFlow("hosp_daya_thrissur", "Daya Hospital", "0487 2475100");
    const nodes = defaultFlow.nodes.map((n) => {
      if (n.type === "EMERGENCY_HANDLING") {
        return {
          ...n,
          data: {
            ...n.data,
            autoTransfer: true,
            casualtyDestinationNumber: "",
          },
        };
      }
      return n;
    });

    const result = IvrFlowValidator.validate(nodes, defaultFlow.edges);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === "MISSING_EMERGENCY_DESTINATION")).toBe(true);
  });

  it("fails validation if DTMF Input minDigits > maxDigits", () => {
    const defaultFlow = createDefaultHospitalFlow("hosp_daya_thrissur");
    const dtmfNode = createDefaultNode("DTMF_INPUT", { x: 500, y: 500 });
    dtmfNode.data = {
      ...dtmfNode.data,
      minDigits: 10,
      maxDigits: 4,
    };

    const result = IvrFlowValidator.validate([...defaultFlow.nodes, dtmfNode], defaultFlow.edges);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === "INVALID_DIGIT_RANGE")).toBe(true);
  });

  it("fails validation if Business Hours openTime >= closeTime", () => {
    const defaultFlow = createDefaultHospitalFlow("hosp_daya_thrissur");
    const bhNode = createDefaultNode("BUSINESS_HOURS", { x: 500, y: 500 });
    bhNode.data = {
      ...bhNode.data,
      schedule: {
        monday: { isOpen: true, openTime: "18:00", closeTime: "08:00" }, // Inverted
      },
    };

    const result = IvrFlowValidator.validate([...defaultFlow.nodes, bhNode], defaultFlow.edges);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === "INVALID_BUSINESS_HOURS")).toBe(true);
  });
});
