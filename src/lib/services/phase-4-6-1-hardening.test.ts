import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { EmergencyDetector } from "./emergency-detector";
import { LanguageDetector } from "./language-detector";
import {
  ALL_TEMPLATES_BUILDERS,
  buildTemplateEmergencyEscalation,
  buildTemplateMainAiReception,
} from "./flow-templates";
import { IvrFlowValidator } from "./ivr-flow-validator";
import { ivrFlowService } from "./ivr-flow-service";
import { IvrFlowExecutionEngine } from "./ivr-flow-engine";
import { HospitalConversationEngine } from "@/media-gateway/conversation-engine";
import { DAYA_HOSPITAL_CONFIG } from "@/lib/config/hospital-config";
import { createDefaultNode } from "./ivr-node-definitions";

describe("Phase 4.6.1 Flow Orchestration Hardening & Safety Acceptance Suite", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ==========================================================================
  // 1. UNAPPROVED EMERGENCY DESTINATION SAFEGUARDS
  // ==========================================================================
  describe("1. Emergency Destination Hardening & Unapproved Number Removal", () => {
    it("ensures all 11 default flow templates contain no hardcoded Daya emergency numbers", () => {
      const unapprovedNumbers = ["0487 2475100", "+919606654032", "+91 96066 54032", "0487 2475000", "+914872475100"];

      for (const [key, builder] of Object.entries(ALL_TEMPLATES_BUILDERS)) {
        const flow = builder("General Hospital", "");
        const json = JSON.stringify(flow);
        for (const num of unapprovedNumbers) {
          expect(json, `Template '${key}' contained unapproved number ${num}`).not.toContain(num);
        }
      }
    });

    it("verifies Emergency Escalation template defaults autoTransfer to false and unconfirmed", () => {
      const template = buildTemplateEmergencyEscalation("Daya Hospital", "");
      const emNode = template.nodes.find((n) => n.type === "EMERGENCY_HANDLING")!;
      expect(emNode).toBeDefined();

      const data = emNode.data as Record<string, unknown>;
      expect(data.autoTransfer).toBe(false);
      expect(data.isConfirmedDestination).toBe(false);
      expect(data.casualtyDestinationNumber).toBe("");
    });

    it("flow validator strictly blocks publishing flows with autoTransfer enabled without confirmed destination", () => {
      const emNode = createDefaultNode("EMERGENCY_HANDLING", { x: 0, y: 0 });
      (emNode.data as Record<string, unknown>).autoTransfer = true;
      (emNode.data as Record<string, unknown>).isConfirmedDestination = false;
      (emNode.data as Record<string, unknown>).casualtyDestinationNumber = "0487 2475100";

      const startNode = createDefaultNode("INCOMING_CALL", { x: -100, y: 0 });
      const nodes = [startNode, emNode];
      const edges = [
        {
          id: "e1",
          sourceNodeId: startNode.id,
          sourcePortId: "next",
          targetNodeId: emNode.id,
          targetPortId: "in",
        },
      ];

      const validation = IvrFlowValidator.validate(nodes, edges);
      expect(validation.isValid).toBe(false);
      const err = validation.errors.find((e) => e.code === "UNCONFIRMED_EMERGENCY_DESTINATION");
      expect(err).toBeDefined();
    });

    it("flow service blocks enabling emergency live transfer unless destination is verified", async () => {
      await expect(
        ivrFlowService.updateEmergencyRoutingConfig("hosp_unconfirmed_tenant", {
          casualtyNumber: "9999999999",
          isVerified: false,
          allowLiveTransfer: true, // Should be rejected because isVerified is false
        })
      ).rejects.toThrow("Emergency auto-transfer requires verified destination authorization");
    });

    it("conversation engine provides safe medical guidance when emergency occurs with unconfirmed destination", async () => {
      process.env.HOSPITAL_DESTINATIONS_CONFIRMED = "false";

      const engine = new HospitalConversationEngine({
        ...DAYA_HOSPITAL_CONFIG,
        routing: {
          ...DAYA_HOSPITAL_CONFIG.routing,
          casualtyDirectNumber: "", // Unconfirmed
        },
      });

      const result = await engine.processCallerUtterance("I am having severe chest pain right now!");
      expect(result.intent).toBe("CASUALTY");
      expect(result.shouldTransfer).toBe(false);
      expect(result.replyText).toContain("108");
      expect(result.transferDestination).toBeUndefined();
    });
  });

  // ==========================================================================
  // 2. MAIN AI RECEPTION FLOW (ZERO-DTMF & LANGUAGE DETECTION)
  // ==========================================================================
  describe("2. Main AI Reception Flow (Zero-DTMF & Automatic Language Detection)", () => {
    it("Main AI Reception template starts immediately with Direct AI Receptionist and zero DTMF", () => {
      const mainFlow = buildTemplateMainAiReception("Test Hospital", "");
      const incomingNode = mainFlow.nodes.find((n) => n.type === "INCOMING_CALL")!;
      expect(incomingNode).toBeDefined();

      const directEdge = mainFlow.edges.find((e) => e.sourceNodeId === incomingNode.id)!;
      const targetNode = mainFlow.nodes.find((n) => n.id === directEdge.targetNodeId)!;

      // Must directly route to AI Voice / Direct Receptionist without an intermediate DTMF or language menu
      expect(targetNode.type).toBe("DIRECT_AI_RECEPTIONIST");
    });

    it("conversation engine provides immediate English greeting by default on connection", () => {
      const engine = new HospitalConversationEngine(DAYA_HOSPITAL_CONFIG);
      const greeting = engine.getInitialGreeting("en-IN");
      expect(greeting).toContain("Hello! Welcome to Daya General Hospital");
      expect(greeting).toContain("How may I help you today?");
    });

    it("conversation engine supports multilingual greetings for ml, hi, ta, kn, te", () => {
      const engine = new HospitalConversationEngine(DAYA_HOSPITAL_CONFIG);
      expect(engine.getInitialGreeting("ml-IN")).toContain("നമസ്കാരം!");
      expect(engine.getInitialGreeting("hi-IN")).toContain("नमस्ते!");
      expect(engine.getInitialGreeting("ta-IN")).toContain("வணக்கம்!");
      expect(engine.getInitialGreeting("kn-IN")).toContain("ನಮಸ್ಕಾರ!");
      expect(engine.getInitialGreeting("te-IN")).toContain("నమస్కారం!");
    });

    it("LanguageDetector accurately identifies Malayalam script and Manglish vocabulary", () => {
      const mlScript = LanguageDetector.detectLanguage("എനിക്ക് നാളെ ഡോക്ടറെ കാണണം");
      expect(mlScript.detectedLanguage).toBe("ml-IN");
      expect(mlScript.confidence).toBeGreaterThanOrEqual(0.7);

      const manglish = LanguageDetector.detectLanguage("doctor appointment venam enikku");
      expect(manglish.detectedLanguage).toBe("ml-IN");
      expect(manglish.isCodeMixed).toBe(true);
    });

    it("LanguageDetector accurately identifies English, Hindi, and Tamil", () => {
      const eng = LanguageDetector.detectLanguage("I want to consult an orthopedic specialist tomorrow");
      expect(eng.detectedLanguage).toBe("en-IN");
      expect(eng.confidence).toBeGreaterThanOrEqual(0.8);

      const hindi = LanguageDetector.detectLanguage("मुझे डॉक्टर से मिलना है बुखार है");
      expect(hindi.detectedLanguage).toBe("hi-IN");

      const tamil = LanguageDetector.detectLanguage("மருத்துவரை பார்க்க வேண்டும்");
      expect(tamil.detectedLanguage).toBe("ta-IN");
    });

    it("LanguageDetector handles unsupported language safely with low confidence and fallback", () => {
      const french = LanguageDetector.detectLanguage("Bonjour monsieur je voudrais un rendez-vous");
      expect(french.confidence).toBeLessThan(0.7);
      expect(french.fallbackApplied).toBe(true);
      // System falls back gracefully without throwing
      expect(["en-IN", "ml-IN"]).toContain(french.detectedLanguage);
    });
  });

  // ==========================================================================
  // 3. CONTINUOUS EMERGENCY MONITORING, CONTEXTUAL FILTERING & BENCHMARK
  // ==========================================================================
  describe("3. Continuous Emergency Monitoring & Contextual Filtering", () => {
    it("detects all medical emergency categories across English and Malayalam", () => {
      const testCases = [
        { text: "Patient is clutching chest and having severe heart attack", expected: "CARDIAC_CHEST_PAIN" },
        { text: "Cannot breathe, severe asthma attack gasping for air", expected: "SEVERE_RESPIRATORY" },
        { text: "Face drooping and slurred speech, think it is a stroke", expected: "STROKE_NEURO" },
        { text: "Major car accident with severe trauma and fracture", expected: "TRAUMA_ACCIDENT" },
        { text: "Severe hemorrhage with heavy bleeding from head", expected: "HEAVY_BLEEDING" },
        { text: "Patient collapsed and is completely unconscious", expected: "UNCONSCIOUSNESS_COLLAPSE" },
        { text: "Baby having fits and convulsion with fever", expected: "SEIZURE_CONVULSION" },
        { text: "Pregnant woman with active labour pain and water breaking", expected: "OBSTETRIC_EMERGENCY" },
        { text: "Throat swelling closed, acute anaphylaxis shock", expected: "SEVERE_ALLERGY" },
        { text: "Child drank poison accidentally, acute overdose", expected: "POISONING_OVERDOSE" },
        { text: "Severe burns all over body after fire accident", expected: "BURNS_FIRE" },
        { text: "Need ambulance and casualty immediately", expected: "EXPLICIT_URGENT_REQUEST" },
      ];

      for (const tc of testCases) {
        const evalResult = EmergencyDetector.evaluate(tc.text);
        expect(evalResult.isEmergency, `Failed on: ${tc.text}`).toBe(true);
        expect(evalResult.category, `Category mismatch on: ${tc.text}`).toBe(tc.expected);
      }
    });

    it("correctly identifies Malayalam emergency phrases across new categories", () => {
      const poisoning = EmergencyDetector.evaluate("വിഷം കഴിച്ചു ഉടൻ ഡോക്ടർ വേണം");
      expect(poisoning.isEmergency).toBe(true);
      expect(poisoning.category).toBe("POISONING_OVERDOSE");

      const burn = EmergencyDetector.evaluate("തീപ്പൊള്ളലേറ്റു വളരെ ഗുരുതരമാണ്");
      expect(burn.isEmergency).toBe(true);
      expect(burn.category).toBe("BURNS_FIRE");
    });

    it("filters out historical or hypothetical emergency discussions (contextual filtering)", () => {
      // Historical discussions should NOT trigger an emergency
      const pastHeartAttack = EmergencyDetector.evaluate("I had a heart attack 2 years ago, need a routine checkup");
      expect(pastHeartAttack.isEmergency).toBe(false);
      expect(pastHeartAttack.isHistoricalOrHypothetical).toBe(true);

      const pastAccidentMl = EmergencyDetector.evaluate("രണ്ട് വർഷം മുൻപ് ഒരു accident പറ്റിയിരുന്നു, പഴയ വിവരങ്ങൾ അറിയാൻ വിളിച്ചതാണ്");
      expect(pastAccidentMl.isEmergency).toBe(false);
      expect(pastAccidentMl.isHistoricalOrHypothetical).toBe(true);

      const explicitNegation = EmergencyDetector.evaluate("There is no emergency, I just want OPD timings");
      expect(explicitNegation.isEmergency).toBe(false);

      const negationMl = EmergencyDetector.evaluate("അടിയന്തിരമല്ല, സാധാരണ ഡോക്ടറെ കാണാൻ വേണ്ടിയാണ്");
      expect(negationMl.isEmergency).toBe(false);
    });

    it("overrides historical markers if active emergency urgency is present", () => {
      const activeAndPast = EmergencyDetector.evaluate("I had a heart attack last year and now having severe chest pain right now!");
      expect(activeAndPast.isEmergency).toBe(true);
      expect(activeAndPast.category).toBe("CARDIAC_CHEST_PAIN");
    });

    it("benchmarks execution latency to confirm sub-50ms performance", () => {
      const benchmark = EmergencyDetector.benchmark(100);
      expect(benchmark.iterations).toBe(100);
      expect(benchmark.sub50msVerified).toBe(true);
      expect(benchmark.averageLatencyMs).toBeLessThan(1.0);
    });
  });

  // ==========================================================================
  // 4. TENANT ISOLATION & VERSION SNAPSHOT STABILITY
  // ==========================================================================
  describe("4. Tenant Isolation & Flow Version Snapshot Stability", () => {
    it("locks in-flight call context to initial flow version snapshot upon start", () => {
      const flow = buildTemplateMainAiReception("Alpha Hospital", "");
      flow.hospitalId = "tenant_alpha";
      flow.currentVersion = 1;

      const context = IvrFlowExecutionEngine.initializeContext(
        flow,
        "CA_snapshot_test_101",
        "+919876543210",
        "tenant_alpha"
      );

      expect(context.flowVersion).toBe(1);

      // Even if flow version advances in the database, context version remains locked
      flow.currentVersion = 2;
      expect(context.flowVersion).toBe(1);
    });

    it("strictly isolates tenants during flow execution", () => {
      const flowTenantA = buildTemplateMainAiReception("Hospital A", "");
      flowTenantA.hospitalId = "tenant_A";
      flowTenantA.isTemplate = false;

      const contextTenantB = IvrFlowExecutionEngine.initializeContext(
        flowTenantA,
        "CA_iso_101",
        "+919876543210",
        "tenant_B" // Mismatched tenant
      );

      // Tenant mismatch detected on step execution
      const step = IvrFlowExecutionEngine.executeStep(flowTenantA, contextTenantB, { type: "START_CALL" });
      expect(step.action).toBe("HANGUP");
      expect(step.isTerminal).toBe(true);
      expect(step.logMessage).toContain("Cross-tenant access violation");
    });
  });
});
