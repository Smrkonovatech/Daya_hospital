import { describe, it, expect } from "vitest";
import { EmergencyDetector } from "./emergency-detector";
import {
  getFlowTemplatesCatalog,
  getFlowTemplateById,
  cloneFlowFromTemplate,
  buildTemplateMainAiReception,
} from "./flow-templates";
import { IvrFlowExecutionEngine } from "./ivr-flow-engine";
import { ivrFlowService } from "./ivr-flow-service";
import { IvrFlowData, ReusableSubflowNodeData } from "@/lib/types/ivr-flow";

describe("Phase 4.6: Multi-Tenant Call Flow Orchestration & Emergency Escalation", () => {
  const hospitalId = "hosp_daya_thrissur";

  // ==========================================================================
  // 1. EMERGENCY DETECTOR & MULTILINGUAL CONFIDENCE SCORING
  // ==========================================================================
  describe("EmergencyDetector", () => {
    it("detects Malayalam critical cardiac and respiratory emergencies", () => {
      const phrases = [
        "നെഞ്ചുവേദനയുണ്ട് വേഗം സഹായിക്കണം",
        "രോഗിക്ക് കഠിനമായ ശ്വാസംമുട്ടൽ ആണ്",
        "ഹാർട്ട് അറ്റാക്ക് ആണെന്ന് തോന്നുന്നു",
        "അത്യാഹിത വിഭാഗത്തിലേക്ക് കണക്ട് ചെയ്യുക",
        "കാഷ്വാലിറ്റി എമർജൻസി നമ്പർ വേണം",
      ];

      for (const phrase of phrases) {
        const result = EmergencyDetector.evaluate(phrase);
        expect(result.isEmergency).toBe(true);
        expect(result.confidenceScore).toBeGreaterThanOrEqual(0.7);
        expect(result.requiresImmediateInterruption).toBe(true);
        expect(EmergencyDetector.isEmergency(phrase)).toBe(true);
      }
    });

    it("detects English trauma, stroke, and hemorrhage emergencies", () => {
      const phrases = [
        "Patient is having severe chest pain and radiating down arm",
        "We had a road accident, heavy bleeding from head",
        "My mother collapsed and is completely unconscious",
        "Send an ambulance immediately to our location",
        "This is an emergency, need casualty doctor right now",
      ];

      for (const phrase of phrases) {
        const result = EmergencyDetector.evaluate(phrase);
        expect(result.isEmergency).toBe(true);
        expect(result.confidenceScore).toBeGreaterThanOrEqual(0.7);
        expect(result.requiresImmediateInterruption).toBe(true);
        expect(EmergencyDetector.isEmergency(phrase)).toBe(true);
      }
    });

    it("detects Manglish phonetic emergency expressions", () => {
      const phrases = [
        "nenju vedana kuravilla",
        "swasam muttal koodi varunnu",
        "accident patti blood varunnu",
        "ambulance venam urgent",
      ];

      for (const phrase of phrases) {
        const result = EmergencyDetector.evaluate(phrase);
        expect(result.isEmergency).toBe(true);
        expect(result.requiresImmediateInterruption).toBe(true);
      }
    });

    it("does NOT falsely flag benign clinical inquiries or greetings", () => {
      const benignPhrases = [
        "നമസ്കാരം, ദയ ഹോസ്പിറ്റലിലെ ഡോക്ടർമാരുടെ സമയം അറിയാമോ?",
        "I would like to book an appointment with Dr. Mathew in Cardiology.",
        "What are the OPD consultation fees for general medicine?",
        "Do you accept Medisep or Star Health insurance cashless?",
        "When can I collect my blood test and cholesterol lab report?",
        "Good morning, can I speak to the hospital front desk receptionist?",
      ];

      for (const phrase of benignPhrases) {
        const result = EmergencyDetector.evaluate(phrase);
        expect(result.isEmergency).toBe(false);
        expect(result.requiresImmediateInterruption).toBe(false);
        expect(EmergencyDetector.isEmergency(phrase)).toBe(false);
      }
    });

    it("respects custom confidence thresholds", () => {
      const lowConfidenceText = "casualty";
      const highThreshold = 0.99;
      const result = EmergencyDetector.evaluate(lowConfidenceText, highThreshold);
      expect(result.confidenceScore).toBeLessThan(highThreshold);
    });
  });

  // ==========================================================================
  // 2. FLOW TEMPLATES CATALOG & CLONING ENGINE
  // ==========================================================================
  describe("Flow Templates Catalog", () => {
    it("provides all 11 standardized clinical flow templates", () => {
      const catalog = getFlowTemplatesCatalog();
      expect(catalog.length).toBe(11);

      const templateIds = catalog.map((t) => t.id);
      expect(templateIds).toContain("template_main_ai_reception");
      expect(templateIds).toContain("template_emergency_escalation");
      expect(templateIds).toContain("template_department_routing");
      expect(templateIds).toContain("template_after_hours");
      expect(templateIds).toContain("template_appointment_enquiries");
      expect(templateIds).toContain("template_appointment_booking");
      expect(templateIds).toContain("template_billing_insurance");
      expect(templateIds).toContain("template_human_handoff");
      expect(templateIds).toContain("template_lab_enquiries");
      expect(templateIds).toContain("template_doctor_info");
      expect(templateIds).toContain("template_custom");
    });

    it("clones a template with fresh unique node and edge IDs for a hospital tenant", () => {
      const cloned = cloneFlowFromTemplate(
        "template_emergency_escalation",
        hospitalId,
        "Daya Hospital Thrissur"
      );

      expect(cloned.id).toContain(`flow_${hospitalId}_emergency_escalation`);
      expect(cloned.hospitalId).toBe(hospitalId);
      expect(cloned.category).toBe("EMERGENCY_ESCALATION");
      expect(cloned.executionPriority).toBe(100);
      expect(cloned.isTemplate).toBe(false);
      expect(cloned.status).toBe("DRAFT");

      // Verify node IDs were deeply re-generated
      for (const node of cloned.nodes) {
        expect(node.id).toMatch(/^node_/);
      }
      for (const edge of cloned.edges) {
        expect(edge.id).toMatch(/^edge_/);
      }
    });
  });

  // ==========================================================================
  // 3. SUBFLOW CALL STACK & RUNTIME RECURSION SAFEGUARDS
  // ==========================================================================
  describe("IvrFlowExecutionEngine Subflows & Call Stack", () => {
    it("pushes a call frame onto subflowStack when executing REUSABLE_SUBFLOW", () => {
      const flow = buildTemplateMainAiReception("Daya Hospital Thrissur");
      const context = IvrFlowExecutionEngine.initializeContext(
        flow,
        "CA_test_subflow_001",
        "+919847111222",
        hospitalId,
        "en-IN"
      );

      const subflowNode = flow.nodes.find((n) => n.type === "REUSABLE_SUBFLOW")!;
      context.currentNodeId = subflowNode.id;

      const step = IvrFlowExecutionEngine.executeStep(flow, context, { type: "START_CALL" });

      expect(step.action).toBe("INVOKE_SUBFLOW");
      expect(step.subflowTarget).toBeDefined();
      expect(context.subflowStack.length).toBe(1);
      expect(context.subflowStack[0].parentFlowId).toBe(flow.id);
      expect(context.subflowStack[0].returnNodeId).toBe(subflowNode.id);
    });

    it("enforces maximum call stack depth (limit 5) to protect against runaway recursion", () => {
      const flow = buildTemplateMainAiReception("Daya Hospital Thrissur");
      const context = IvrFlowExecutionEngine.initializeContext(
        flow,
        "CA_test_stack_overflow",
        "+919847111222",
        hospitalId,
        "en-IN"
      );

      // Pre-fill stack with 5 frames
      for (let i = 0; i < 5; i++) {
        context.subflowStack.push({
          parentFlowId: `parent_${i}`,
          parentFlowVersion: 1,
          returnNodeId: `node_${i}`,
          returnPortId: "return",
          invokedAt: new Date().toISOString(),
        });
      }

      const subflowNode = flow.nodes.find((n) => n.type === "REUSABLE_SUBFLOW")!;
      context.currentNodeId = subflowNode.id;

      const step = IvrFlowExecutionEngine.executeStep(flow, context, { type: "START_CALL" });

      // Invocations beyond limit 5 should be rejected and not increase stack
      expect(context.subflowStack.length).toBe(5);
      expect(step.logMessage).toContain("maximum call stack depth (5) reached");
    });

    it("detects recursive cycle loops when invoking a subflow already in the stack", () => {
      const flow = buildTemplateMainAiReception("Daya Hospital Thrissur");
      const context = IvrFlowExecutionEngine.initializeContext(
        flow,
        "CA_test_cycle_loop",
        "+919847111222",
        hospitalId,
        "en-IN"
      );

      const targetFlowId = "flow_recursive_loop";
      const subflowNode = flow.nodes.find((n) => n.type === "REUSABLE_SUBFLOW")!;
      (subflowNode.data as unknown as ReusableSubflowNodeData).targetFlowId = targetFlowId;

      // Add targetFlowId already to stack
      context.subflowStack.push({
        parentFlowId: targetFlowId,
        parentFlowVersion: 1,
        returnNodeId: "node_prev",
        returnPortId: "return",
        invokedAt: new Date().toISOString(),
      });

      context.currentNodeId = subflowNode.id;
      const step = IvrFlowExecutionEngine.executeStep(flow, context, { type: "START_CALL" });

      expect(step.logMessage).toContain("recursive cycle detected");
      expect(context.subflowStack.length).toBe(1); // Not incremented
    });

    it("pops top frame from subflowStack on RETURN_SUBFLOW", () => {
      const flow = getFlowTemplateById("template_emergency_escalation")!;
      const context = IvrFlowExecutionEngine.initializeContext(
        flow,
        "CA_test_return_subflow",
        "+919847111222",
        hospitalId,
        "en-IN"
      );

      // Seed an active parent call frame
      context.subflowStack.push({
        parentFlowId: "parent_main_flow",
        parentFlowVersion: 1,
        returnNodeId: "node_parent_caller",
        returnPortId: "return",
        invokedAt: new Date().toISOString(),
      });

      const returnNode = flow.nodes.find((n) => n.type === "RETURN_SUBFLOW")!;
      context.currentNodeId = returnNode.id;

      const step = IvrFlowExecutionEngine.executeStep(flow, context, { type: "START_CALL" });

      expect(step.action).toBe("RETURN_FROM_SUBFLOW");
      expect(step.nextNodeId).toBe("node_parent_caller");
      expect(context.subflowStack.length).toBe(0);
    });
  });

  // ==========================================================================
  // 4. DIRECT AI RECEPTIONIST TEMPLATE LOGIC
  // ==========================================================================
  describe("Direct AI Receptionist", () => {
    it("starts with a concise initial English greeting and Sarvam configuration", () => {
      const flow = buildTemplateMainAiReception("Daya Hospital Thrissur");
      const context = IvrFlowExecutionEngine.initializeContext(
        flow,
        "CA_test_direct_ai",
        "+919847998877",
        hospitalId,
        "en-IN"
      );

      const directAiNode = flow.nodes.find((n) => n.type === "DIRECT_AI_RECEPTIONIST")!;
      context.currentNodeId = directAiNode.id;

      const step = IvrFlowExecutionEngine.executeStep(flow, context, { type: "START_CALL" });

      expect(step.action).toBe("STREAM_AI_AGENT");
      expect(step.audioText).toContain("Daya Hospital");
      expect(step.aiAgentConfig).toBeDefined();
    });

    it("triggers emergency escalation immediately if emergency speech is heard during turn", () => {
      const flow = buildTemplateMainAiReception("Daya Hospital Thrissur");
      const context = IvrFlowExecutionEngine.initializeContext(
        flow,
        "CA_test_direct_ai_emergency",
        "+919847998877",
        hospitalId,
        "en-IN"
      );

      const directAiNode = flow.nodes.find((n) => n.type === "DIRECT_AI_RECEPTIONIST")!;
      context.currentNodeId = directAiNode.id;

      const step = IvrFlowExecutionEngine.executeStep(flow, context, {
        type: "SPEECH_TRANSCRIPT",
        value: "എന്റെ അമ്മയ്ക്ക് നെഞ്ചുവേദനയുണ്ട് പെട്ടെന്ന് സഹായിക്കണം",
      });

      expect(context.isEmergency).toBe(true);
      expect(context.executionPriority).toBe("EMERGENCY");
      expect(step.action).toBe("EMERGENCY_ESCALATE");
    });
  });

  // ==========================================================================
  // 5. FLOW SERVICE & PERSISTENCE HELPERS
  // ==========================================================================
  describe("IvrFlowService Flow Centre Operations", () => {
    it("clones a template into tenant workspace and saves draft", async () => {
      const cloned = await ivrFlowService.cloneFromTemplate(
        "template_department_routing",
        hospitalId,
        "Daya Hospital Thrissur",
        { name: "Unit Test Cardiology Routing" }
      );

      expect(cloned.name).toBe("Unit Test Cardiology Routing");
      expect(cloned.category).toBe("DEPARTMENT_ROUTING");
      expect(cloned.hospitalId).toBe(hospitalId);

      const fetched = await ivrFlowService.getFlowById(cloned.id, hospitalId);
      expect(fetched).toBeDefined();
      expect(fetched?.id).toBe(cloned.id);
    });

    it("retrieves and updates hospital emergency routing configuration", async () => {
      const config = await ivrFlowService.getEmergencyRoutingConfig(hospitalId);
      expect(config).toBeDefined();
      expect(config?.casualtyNumber).toBeDefined();

      const updated = await ivrFlowService.updateEmergencyRoutingConfig(hospitalId, {
        casualtyNumber: "0487 2475100",
        confidenceThreshold: 0.75,
      });

      expect(updated.casualtyNumber).toBe("0487 2475100");
      expect(updated.confidenceThreshold).toBe(0.75);
    });

    it("logs and retrieves emergency events", async () => {
      const event = await ivrFlowService.logEmergencyEvent({
        hospitalId,
        callSid: "CA_test_emergency_evt",
        flowId: "flow_emergency_test",
        flowVersion: 1,
        triggerPhrase: "severe chest pain",
        targetDestination: "0487 2475100",
        confidenceScore: 0.95,
      });

      expect(event.id).toBeDefined();
      expect(event.triggerPhrase).toBe("severe chest pain");

      const events = await ivrFlowService.getEmergencyEvents(hospitalId, 10);
      expect(Array.isArray(events)).toBe(true);
    });
  });
});
