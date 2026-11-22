import { describe, it, expect } from "vitest";
import { IvrFlowExecutionEngine } from "./ivr-flow-engine";
import { createDefaultHospitalFlow } from "./ivr-node-definitions";
import { BusinessHoursNodeData } from "@/lib/types/ivr-flow";

describe("IvrFlowExecutionEngine (Phase 4)", () => {
  const hospitalId = "hosp_daya_thrissur";
  const flow = createDefaultHospitalFlow(hospitalId, "Daya Hospital Thrissur");

  it("initializes a call execution context locked to the flow's version", () => {
    const callSid = "CA_test_ivr_101";
    const callerNumber = "+919447199999";
    const context = IvrFlowExecutionEngine.initializeContext(
      flow,
      callSid,
      callerNumber,
      hospitalId,
      "ml-IN"
    );

    expect(context.callSid).toBe(callSid);
    expect(context.callerNumber).toBe(callerNumber);
    expect(context.hospitalId).toBe(hospitalId);
    expect(context.flowId).toBe(flow.id);
    expect(context.flowVersion).toBe(flow.currentVersion);
    expect(context.currentLanguage).toBe("ml-IN");
    expect(context.turnCount).toBe(0);
    expect(context.isEmergency).toBe(false);
  });

  it("advances through Welcome Greeting and Language Selection on DTMF keypress", () => {
    const context = IvrFlowExecutionEngine.initializeContext(
      flow,
      "CA_test_ivr_102",
      "+919847012345",
      hospitalId,
      "ml-IN"
    );

    // Turn 1: Inbound Call answered -> Advances to Welcome Greeting
    const step1 = IvrFlowExecutionEngine.executeStep(flow, context, { type: "START_CALL" });
    expect(step1.nextNodeId).toBeDefined();

    // Turn 2: Welcome Greeting -> Plays bilingual announcement, advances to Language Selection
    const step2 = IvrFlowExecutionEngine.executeStep(flow, context, { type: "START_CALL" });
    expect(step2.action).toBe("PLAY_AUDIO");
    expect(step2.nextNodeId).toBeDefined();

    // Turn 3: Language Selection -> Prompts caller for DTMF input
    const step3 = IvrFlowExecutionEngine.executeStep(flow, context, { type: "START_CALL" });
    expect(step3.action).toBe("COLLECT_DTMF");

    // Turn 4: Caller selects English (Key 2) -> Advances to IVR Menu
    const step4 = IvrFlowExecutionEngine.executeStep(flow, context, { type: "DTMF_KEY", value: "2" });
    expect(context.currentLanguage).toBe("en-IN");
    expect(step4.nextNodeId).toBeDefined();
  });

  it("navigates IVR Menu: pressing '1' triggers Casualty / Emergency Handling", () => {
    const context = IvrFlowExecutionEngine.initializeContext(
      flow,
      "CA_test_ivr_103",
      "+919847012345",
      hospitalId,
      "ml-IN"
    );

    const menuNode = flow.nodes.find((n) => n.type === "IVR_MENU")!;
    context.currentNodeId = menuNode.id;

    // Caller presses '1' (Emergency)
    IvrFlowExecutionEngine.executeStep(flow, context, { type: "DTMF_KEY", value: "1" });

    expect(context.isEmergency).toBe(true);
    const emergencyNode = flow.nodes.find((n) => n.type === "EMERGENCY_HANDLING")!;
    expect(context.currentNodeId).toBe(emergencyNode.id);
  });

  it("navigates IVR Menu: pressing '2' routes to Sarvam AI Voice Agent", () => {
    const context = IvrFlowExecutionEngine.initializeContext(
      flow,
      "CA_test_ivr_104",
      "+919847012345",
      hospitalId,
      "ml-IN"
    );

    const menuNode = flow.nodes.find((n) => n.type === "IVR_MENU")!;
    context.currentNodeId = menuNode.id;

    // Caller presses '2' (AI Assistant)
    IvrFlowExecutionEngine.executeStep(flow, context, { type: "DTMF_KEY", value: "2" });

    const aiNode = flow.nodes.find((n) => n.type === "AI_VOICE_AGENT")!;
    expect(context.currentNodeId).toBe(aiNode.id);
  });

  it("handles invalid DTMF input with retry bounding", () => {
    const context = IvrFlowExecutionEngine.initializeContext(
      flow,
      "CA_test_ivr_105",
      "+919847012345",
      hospitalId,
      "ml-IN"
    );

    const menuNode = flow.nodes.find((n) => n.type === "IVR_MENU")!;
    context.currentNodeId = menuNode.id;

    // Attempt 1: Invalid key '8'
    IvrFlowExecutionEngine.executeStep(flow, context, { type: "DTMF_KEY", value: "8" });
    expect(context.retryCounts[menuNode.id]).toBe(1);
    expect(context.currentNodeId).toBe(menuNode.id); // Stays on menu to retry

    // Attempt 2: Invalid key '9' (reaches maxRetries = 2)
    IvrFlowExecutionEngine.executeStep(flow, context, { type: "DTMF_KEY", value: "9" });
    expect(context.retryCounts[menuNode.id]).toBe(2);

    // Routed to Invalid Input node
    const invalidNode = flow.nodes.find((n) => n.type === "INVALID_INPUT")!;
    expect(context.currentNodeId).toBe(invalidNode.id);
  });

  it("handles timeout on IVR menu and routes to Timeout handler", () => {
    const context = IvrFlowExecutionEngine.initializeContext(
      flow,
      "CA_test_ivr_106",
      "+919847012345",
      hospitalId,
      "ml-IN"
    );

    const menuNode = flow.nodes.find((n) => n.type === "IVR_MENU")!;
    context.currentNodeId = menuNode.id;

    IvrFlowExecutionEngine.executeStep(flow, context, { type: "TIMEOUT" });

    const timeoutNode = flow.nodes.find((n) => n.type === "TIMEOUT")!;
    expect(context.currentNodeId).toBe(timeoutNode.id);
  });

  it("handles immediate Priority Emergency Override regardless of current node", () => {
    const context = IvrFlowExecutionEngine.initializeContext(
      flow,
      "CA_test_ivr_107",
      "+919847012345",
      hospitalId,
      "ml-IN"
    );

    // Call is currently at Department Selection
    const deptNode = flow.nodes.find((n) => n.type === "DEPARTMENT_SELECTION")!;
    context.currentNodeId = deptNode.id;

    // Caller screams emergency or triggers emergency keyword
    const step = IvrFlowExecutionEngine.executeStep(flow, context, {
      type: "EMERGENCY_DETECTED",
      value: "Casualty urgent help needed!",
    });

    expect(context.isEmergency).toBe(true);
    expect(step.action).toBe("EMERGENCY_ESCALATE");
    expect(step.transferDestination).toBe("0487 2475100");
    const emergencyNode = flow.nodes.find((n) => n.type === "EMERGENCY_HANDLING")!;
    expect(context.currentNodeId).toBe(emergencyNode.id);
  });

  it("correctly evaluates business hours schedule (open vs closed vs holiday)", () => {
    const bhData: BusinessHoursNodeData = {
      timezone: "Asia/Kolkata",
      schedule: {
        monday: { isOpen: true, openTime: "08:00", closeTime: "20:00" },
        tuesday: { isOpen: true, openTime: "08:00", closeTime: "20:00" },
        wednesday: { isOpen: true, openTime: "08:00", closeTime: "20:00" },
        thursday: { isOpen: true, openTime: "08:00", closeTime: "20:00" },
        friday: { isOpen: true, openTime: "08:00", closeTime: "20:00" },
        saturday: { isOpen: true, openTime: "08:00", closeTime: "18:00" },
        sunday: { isOpen: false, openTime: "00:00", closeTime: "00:00" },
      },
      holidayOverrides: [
        { date: "2026-12-25", name: "Christmas", isClosed: true },
      ],
    };

    // Open during Monday 10:30 AM
    const mondayOpen = new Date("2026-11-23T10:30:00");
    expect(IvrFlowExecutionEngine.evaluateBusinessHours(bhData, mondayOpen)).toBe("open");

    // Closed during Monday 11:30 PM
    const mondayNight = new Date("2026-11-23T23:30:00");
    expect(IvrFlowExecutionEngine.evaluateBusinessHours(bhData, mondayNight)).toBe("closed");

    // Closed on Sunday
    const sunday = new Date("2026-11-29T12:00:00");
    expect(IvrFlowExecutionEngine.evaluateBusinessHours(bhData, sunday)).toBe("closed");

    // Holiday override
    const christmas = new Date("2026-12-25T11:00:00");
    expect(IvrFlowExecutionEngine.evaluateBusinessHours(bhData, christmas)).toBe("holiday");
  });

  it("safely terminates infinite loop when execution exceeds turn threshold", () => {
    const context = IvrFlowExecutionEngine.initializeContext(
      flow,
      "CA_test_ivr_loop",
      "+919847012345",
      hospitalId,
      "ml-IN"
    );

    context.turnCount = 51; // simulate runaway loop

    const step = IvrFlowExecutionEngine.executeStep(flow, context, { type: "START_CALL" });
    expect(step.action).toBe("HANGUP");
    expect(step.isTerminal).toBe(true);
    expect(step.logMessage).toContain("maximum execution turn limit (50) exceeded");
  });
});
