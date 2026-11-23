/**
 * ============================================================================
 * SMRKOMED IVR FLOW EXECUTION & SIMULATION ENGINE (PHASE 4)
 * ============================================================================
 *
 * Deterministic runtime execution engine for inbound IVR call flows:
 * - Decoupled from React UI: executes in API routes, test runner, or live gateway
 * - Evaluates node transitions, DTMF inputs, timeouts, and business schedules
 * - Integrates with AI Agent Builder (Phase 3) and Exotel Telephony (Phase 1)
 * - Emergency priority escalation and casualty overrides
 * - Infinite loop detection and retry bounding
 * - Call-session immutability (locks published version for lifetime of active call)
 */

import {
  FlowExecutionContext,
  FlowExecutionStepResult,
  IvrFlowData,
  IvrMenuNodeData,
  LanguageSelectionNodeData,
  WelcomeGreetingNodeData,
  DtmfInputNodeData,
  AiVoiceAgentNodeData,
  HumanTransferNodeData,
  EmergencyHandlingNodeData,
  BusinessHoursNodeData,
  DepartmentSelectionNodeData,
  TimeoutNodeData,
  InvalidInputNodeData,
  RepeatMenuNodeData,
  EndCallNodeData,
  QueueWaitingNodeData,
  DirectAiReceptionistNodeData,
  EmergencyMonitorNodeData,
  IntentDetectionNodeData,
  ConditionBranchNodeData,
  BillingFlowNodeData,
  ReusableSubflowNodeData,
  ReturnSubflowNodeData,
  AfterHoursNodeData,
  ErrorHandlerNodeData,
  SubflowCallFrame,
} from "@/lib/types/ivr-flow";
import { EmergencyDetector } from "./emergency-detector";

export interface StepInputEvent {
  type:
    | "START_CALL"
    | "DTMF_KEY"
    | "DTMF_DIGITS"
    | "TIMEOUT"
    | "AI_COMPLETED"
    | "AI_HANDOFF"
    | "EMERGENCY_DETECTED"
    | "TRANSFER_FAILED"
    | "SUBFLOW_RETURN"
    | "SPEECH_TRANSCRIPT";
  value?: string;
}

export class IvrFlowExecutionEngine {
  /**
   * Initializes a new call execution context locked to a specific published flow.
   */
  public static initializeContext(
    flow: IvrFlowData,
    callSid: string,
    callerNumber: string,
    hospitalId: string,
    initialLanguage: "ml-IN" | "en-IN" | "hi-IN" = "ml-IN"
  ): FlowExecutionContext {
    const startNode = flow.nodes.find((n) => n.type === "INCOMING_CALL");
    if (!startNode) {
      throw new Error(`Flow '${flow.id}' does not have a valid INCOMING_CALL start node.`);
    }

    return {
      callSid,
      callerNumber,
      hospitalId,
      flowId: flow.id,
      flowVersion: flow.currentVersion,
      currentLanguage: initialLanguage,
      currentNodeId: startNode.id,
      variables: {
        caller_number: callerNumber,
        call_sid: callSid,
        hospital_id: hospitalId,
        ...flow.variables,
      },
      history: [
        {
          nodeId: startNode.id,
          nodeType: "INCOMING_CALL",
          nodeTitle: startNode.title,
          timestamp: new Date().toISOString(),
          actionTaken: "CALL_ANSWERED",
        },
      ],
      turnCount: 0,
      retryCounts: {},
      isEmergency: false,
      subflowStack: [],
      activeFlowId: flow.id,
      rootFlowId: flow.id,
      executionPriority: "NORMAL",
    };
  }

  /**
   * Executes a single turn in the IVR flow based on the current context and input event.
   */
  public static executeStep(
    flow: IvrFlowData,
    context: FlowExecutionContext,
    input: StepInputEvent,
    now: Date = new Date()
  ): FlowExecutionStepResult {
    const currentNode = flow.nodes.find((n) => n.id === context.currentNodeId);
    if (!currentNode) {
      return {
        nextNodeId: null,
        action: "HANGUP",
        logMessage: `Execution error: Current node '${context.currentNodeId}' not found in flow '${flow.id}'.`,
        isTerminal: true,
        context,
      };
    }

    // Safety: prevent runaway infinite recursion
    if (context.turnCount > 50) {
      return {
        nextNodeId: null,
        action: "HANGUP",
        logMessage: "Call terminated safely: maximum execution turn limit (50) exceeded.",
        isTerminal: true,
        context,
      };
    }

    context.turnCount += 1;

    // ----------------------------------------------------
    // 1. EMERGENCY OVERRIDE CHECK
    // ----------------------------------------------------
    if (
      input.type === "EMERGENCY_DETECTED" ||
      (input.type === "SPEECH_TRANSCRIPT" && input.value && EmergencyDetector.isEmergency(input.value))
    ) {
      const emergencyNode = flow.nodes.find((n) => n.type === "EMERGENCY_HANDLING" || n.type === "EMERGENCY_MONITOR");
      if (emergencyNode) {
        context.isEmergency = true;
        context.executionPriority = "EMERGENCY";
        context.currentNodeId = emergencyNode.id;
        context.history.push({
          nodeId: emergencyNode.id,
          nodeType: emergencyNode.type,
          nodeTitle: emergencyNode.title,
          timestamp: new Date().toISOString(),
          actionTaken: "EMERGENCY_PRIORITY_ESCALATION",
          inputReceived: input.value,
        });

        const emData = emergencyNode.data as unknown as EmergencyHandlingNodeData;
        const text =
          context.currentLanguage === "en-IN"
            ? (emData.announcementEnglish || "Connecting you immediately to the Casualty department.")
            : (emData.announcementMalayalam || "ഇതൊരു അത്യാഹിത കോളായതിനാൽ ഉടൻ കാഷ്വാലിറ്റിയിലേക്ക് കണക്ട് ചെയ്യുന്നു.");

        return {
          nextNodeId: emergencyNode.id,
          action: "EMERGENCY_ESCALATE",
          audioText: text,
          audioLanguage: context.currentLanguage,
          transferDestination:
            emData.casualtyDestinationNumber ||
            (context.variables.casualtyHotline as string) ||
            "0487 2475100",
          logMessage: `[EMERGENCY OVERRIDE] Casualty fast-track activated. Transferring to Casualty.`,
          isTerminal: false,
          context,
        };
      }
    }

    // ----------------------------------------------------
    // 2. PROCESS CURRENT NODE LOGIC & TRANSITION
    // ----------------------------------------------------
    let nextNodeId: string | null = null;
    let actionResult: FlowExecutionStepResult["action"] = "PLAY_AUDIO";
    let audioText: string | undefined;
    let ttsSpeaker: string | undefined;
    let speakingPace: number | undefined;
    let transferDestination: string | undefined;
    let dtmfPrompt: string | undefined;
    let dtmfExpectedDigits: number | undefined;
    let aiAgentConfig: FlowExecutionStepResult["aiAgentConfig"];
    let logMessage = "";
    let isTerminal = false;

    switch (currentNode.type) {
      case "INCOMING_CALL": {
        // Immediate transition to the node connected to 'next'
        const nextEdge = flow.edges.find(
          (e) => e.sourceNodeId === currentNode.id && e.sourcePortId === "next"
        );
        nextNodeId = nextEdge ? nextEdge.targetNodeId : null;
        logMessage = `Inbound call established from ${context.callerNumber}. Proceeding to ${nextNodeId || "End"}.`;
        break;
      }

      case "WELCOME_GREETING": {
        const welcomeData = currentNode.data as unknown as WelcomeGreetingNodeData;
        audioText = context.currentLanguage === "en-IN" ? welcomeData.textEnglish : welcomeData.textMalayalam;
        ttsSpeaker = welcomeData.ttsSpeaker || "kavitha";
        speakingPace = welcomeData.speakingPace || 1.15;
        actionResult = "PLAY_AUDIO";

        const nextEdge = flow.edges.find(
          (e) => e.sourceNodeId === currentNode.id && e.sourcePortId === "next"
        );
        nextNodeId = nextEdge ? nextEdge.targetNodeId : null;
        logMessage = `Playing Welcome Greeting: "${audioText}"`;
        break;
      }

      case "LANGUAGE_SELECTION": {
        const langData = currentNode.data as unknown as LanguageSelectionNodeData;
        
        if (input.type === "TIMEOUT") {
          const edge = flow.edges.find(
            (e) => e.sourceNodeId === currentNode.id && e.sourcePortId === "timeout"
          );
          nextNodeId = edge ? edge.targetNodeId : null;
          logMessage = "Language selection timeout.";
        } else if (input.type === "DTMF_KEY" && input.value) {
          const selectedOption = langData.options.find((o) => o.key === input.value);
          if (selectedOption) {
            context.currentLanguage = selectedOption.languageCode;
            const edge = flow.edges.find(
              (e) => e.sourceNodeId === currentNode.id && e.sourcePortId === `lang_${selectedOption.languageCode}`
            );
            nextNodeId = edge ? edge.targetNodeId : null;
            logMessage = `Language set to ${selectedOption.languageCode} (Key ${input.value}).`;
          } else {
            // Invalid key pressed
            const retryCount = (context.retryCounts[currentNode.id] || 0) + 1;
            context.retryCounts[currentNode.id] = retryCount;

            if (retryCount >= langData.maxRetries) {
              const edge = flow.edges.find(
                (e) => e.sourceNodeId === currentNode.id && e.sourcePortId === "invalid"
              );
              nextNodeId = edge ? edge.targetNodeId : null;
              logMessage = `Invalid language key '${input.value}' max retries reached. Routing to invalid fallback.`;
            } else {
              nextNodeId = currentNode.id;
              actionResult = "COLLECT_DTMF";
              dtmfPrompt = "Invalid choice. " + langData.promptMalayalam;
              logMessage = `Invalid language key '${input.value}'. Retrying (${retryCount}/${langData.maxRetries}).`;
            }
          }
        } else {
          actionResult = "COLLECT_DTMF";
          dtmfPrompt = langData.promptMalayalam;
          dtmfExpectedDigits = 1;
          logMessage = `Prompting Language Selection: "${langData.promptMalayalam}"`;
        }
        break;
      }

      case "IVR_MENU": {
        const menuData = currentNode.data as unknown as IvrMenuNodeData;

        if (input.type === "TIMEOUT") {
          const edge = flow.edges.find(
            (e) => e.sourceNodeId === currentNode.id && e.sourcePortId === "timeout"
          );
          nextNodeId = edge ? edge.targetNodeId : null;
          logMessage = "IVR Menu timeout.";
        } else if (input.type === "DTMF_KEY" && input.value) {
          const selected = menuData.options.find((o) => o.key === input.value);
          if (selected) {
            // Check if option triggers emergency handling
            if (selected.isEmergency) {
              context.isEmergency = true;
            }

            const edge = flow.edges.find(
              (e) => e.sourceNodeId === currentNode.id && e.sourcePortId === `opt_${selected.key}`
            );
            nextNodeId = edge ? edge.targetNodeId : null;
            logMessage = `Menu Option Selected: ${selected.label} (Key ${input.value}). Routing to ${nextNodeId}.`;
          } else {
            const retryCount = (context.retryCounts[currentNode.id] || 0) + 1;
            context.retryCounts[currentNode.id] = retryCount;

            if (retryCount >= menuData.maxRetries) {
              const edge = flow.edges.find(
                (e) => e.sourceNodeId === currentNode.id && e.sourcePortId === "invalid"
              );
              nextNodeId = edge ? edge.targetNodeId : null;
              logMessage = `Menu key '${input.value}' invalid. Max retries exceeded.`;
            } else {
              nextNodeId = currentNode.id;
              actionResult = "COLLECT_DTMF";
              dtmfPrompt =
                context.currentLanguage === "en-IN"
                  ? "Invalid choice. Please try again. " + menuData.menuPromptEnglish
                  : "നൽകിയ നമ്പർ അസാധുവാണ്. " + menuData.menuPromptMalayalam;
              logMessage = `Invalid menu key '${input.value}'. Retrying (${retryCount}/${menuData.maxRetries}).`;
            }
          }
        } else {
          actionResult = "COLLECT_DTMF";
          dtmfPrompt = context.currentLanguage === "en-IN" ? menuData.menuPromptEnglish : menuData.menuPromptMalayalam;
          dtmfExpectedDigits = 1;
          logMessage = `Presenting IVR Menu: "${dtmfPrompt}"`;
        }
        break;
      }

      case "BUSINESS_HOURS": {
        const bhData = currentNode.data as unknown as BusinessHoursNodeData;
        const status = this.evaluateBusinessHours(bhData, now);

        const edge = flow.edges.find(
          (e) => e.sourceNodeId === currentNode.id && e.sourcePortId === status
        );
        nextNodeId = edge ? edge.targetNodeId : null;
        logMessage = `Business hours evaluated: ${status.toUpperCase()} at ${now.toISOString()}. Next: ${nextNodeId}.`;
        break;
      }

      case "AI_VOICE_AGENT": {
        const aiData = currentNode.data as unknown as AiVoiceAgentNodeData;
        actionResult = "STREAM_AI_AGENT";
        aiAgentConfig = {
          agentId: aiData.agentId,
          agentName: aiData.agentName,
          version: aiData.publishedVersion,
        };

        if (input.type === "AI_COMPLETED") {
          const edge = flow.edges.find(
            (e) => e.sourceNodeId === currentNode.id && e.sourcePortId === "call_completed"
          );
          nextNodeId = edge ? edge.targetNodeId : null;
          logMessage = `AI Voice Assistant completed call turn successfully.`;
        } else if (input.type === "AI_HANDOFF") {
          const edge = flow.edges.find(
            (e) => e.sourceNodeId === currentNode.id && e.sourcePortId === "human_handoff"
          );
          nextNodeId = edge ? edge.targetNodeId : null;
          logMessage = `AI Voice Assistant requested human staff handoff.`;
        } else {
          // Normal entrance into AI agent node
          logMessage = `Connecting call session to published AI Agent '${aiData.agentName}' (v${aiData.publishedVersion}).`;
        }
        break;
      }

      case "HUMAN_TRANSFER": {
        const trData = currentNode.data as unknown as HumanTransferNodeData;
        actionResult = "TRANSFER_CALL";
        transferDestination = trData.destinationNumber || "Reception";

        if (input.type === "TRANSFER_FAILED") {
          const edge = flow.edges.find(
            (e) => e.sourceNodeId === currentNode.id && e.sourcePortId === "failed"
          );
          nextNodeId = edge ? edge.targetNodeId : null;
          logMessage = `Transfer to ${transferDestination} failed. Executing fallback.`;
        } else {
          const edge = flow.edges.find(
            (e) => e.sourceNodeId === currentNode.id && e.sourcePortId === "connected"
          );
          nextNodeId = edge ? edge.targetNodeId : null;
          logMessage = `Initiating transfer to ${transferDestination}.`;
        }
        break;
      }

      case "EMERGENCY_HANDLING": {
        const emData = currentNode.data as unknown as EmergencyHandlingNodeData;
        actionResult = "EMERGENCY_ESCALATE";
        transferDestination = emData.casualtyDestinationNumber;
        audioText = context.currentLanguage === "en-IN" ? emData.announcementEnglish : emData.announcementMalayalam;

        const edge = flow.edges.find(
          (e) => e.sourceNodeId === currentNode.id && e.sourcePortId === "transferred"
        );
        nextNodeId = edge ? edge.targetNodeId : null;
        logMessage = `[EMERGENCY PROTOCOL] Direct connection to Casualty (${transferDestination}).`;
        break;
      }

      case "DTMF_INPUT": {
        const dtmfData = currentNode.data as unknown as DtmfInputNodeData;
        if (input.type === "START_CALL" || !input.value) {
          actionResult = "COLLECT_DTMF";
          dtmfPrompt = context.currentLanguage === "en-IN" ? dtmfData.promptEnglish : dtmfData.promptMalayalam;
          dtmfExpectedDigits = dtmfData.maxDigits;
          logMessage = `Prompting DTMF Input: "${dtmfPrompt}"`;
        } else if (input.type === "DTMF_DIGITS") {
          const digits = input.value;
          if (digits.length >= dtmfData.minDigits && digits.length <= dtmfData.maxDigits) {
            context.variables[dtmfData.variableName] = digits;
            const edge = flow.edges.find(
              (e) => e.sourceNodeId === currentNode.id && e.sourcePortId === "success"
            );
            nextNodeId = edge ? edge.targetNodeId : null;
            logMessage = `DTMF Digits received: ${digits} stored in '${dtmfData.variableName}'.`;
          } else {
            const edge = flow.edges.find(
              (e) => e.sourceNodeId === currentNode.id && e.sourcePortId === "invalid"
            );
            nextNodeId = edge ? edge.targetNodeId : null;
            logMessage = `DTMF Digits '${digits}' outside valid range [${dtmfData.minDigits}, ${dtmfData.maxDigits}].`;
          }
        }
        break;
      }

      case "DEPARTMENT_SELECTION": {
        const deptData = currentNode.data as unknown as DepartmentSelectionNodeData;
        if (input.type === "START_CALL" || !input.value) {
          actionResult = "COLLECT_DTMF";
          dtmfPrompt = context.currentLanguage === "en-IN" ? deptData.promptEnglish : deptData.promptMalayalam;
          dtmfExpectedDigits = 1;
          logMessage = `Presenting Department Selection: "${dtmfPrompt}"`;
        } else if (input.type === "DTMF_KEY") {
          const matched = deptData.departments.find((d) => d.key === input.value);
          if (matched) {
            context.variables.selected_department = matched.departmentId;
            const edge = flow.edges.find(
              (e) => e.sourceNodeId === currentNode.id && (e.sourcePortId === matched.departmentId || e.sourcePortId.includes(matched.key))
            );
            nextNodeId = edge ? edge.targetNodeId : null;
            logMessage = `Department selected: ${matched.nameEnglish} (Key ${input.value}).`;
          } else {
            const edge = flow.edges.find(
              (e) => e.sourceNodeId === currentNode.id && e.sourcePortId === "invalid"
            );
            nextNodeId = edge ? edge.targetNodeId : null;
            logMessage = `Invalid department key '${input.value}'.`;
          }
        }
        break;
      }

      case "TIMEOUT": {
        const toData = currentNode.data as unknown as TimeoutNodeData;
        audioText = context.currentLanguage === "en-IN" ? toData.timeoutPromptEnglish : toData.timeoutPromptMalayalam;
        const edge = flow.edges.find(
          (e) => e.sourceNodeId === currentNode.id && e.sourcePortId === "exceeded"
        );
        nextNodeId = edge ? edge.targetNodeId : null;
        logMessage = `Timeout handler executed. Prompting: "${audioText}"`;
        break;
      }

      case "INVALID_INPUT": {
        const invData = currentNode.data as unknown as InvalidInputNodeData;
        audioText = context.currentLanguage === "en-IN" ? invData.invalidPromptEnglish : invData.invalidPromptMalayalam;
        const edge = flow.edges.find(
          (e) => e.sourceNodeId === currentNode.id && e.sourcePortId === "exceeded"
        );
        nextNodeId = edge ? edge.targetNodeId : null;
        logMessage = `Invalid input handler executed. Prompting: "${audioText}"`;
        break;
      }

      case "REPEAT_MENU": {
        const repData = currentNode.data as unknown as RepeatMenuNodeData;
        audioText = context.currentLanguage === "en-IN" ? repData.repeatPromptEnglish : repData.repeatPromptMalayalam;
        const edge = flow.edges.find(
          (e) => e.sourceNodeId === currentNode.id && e.sourcePortId === "repeat"
        );
        nextNodeId = edge ? edge.targetNodeId : null;
        logMessage = `Repeating menu: "${audioText}"`;
        break;
      }

      case "END_CALL": {
        const endData = currentNode.data as unknown as EndCallNodeData;
        audioText = context.currentLanguage === "en-IN" ? endData.goodbyePromptEnglish : endData.goodbyePromptMalayalam;
        actionResult = "HANGUP";
        isTerminal = true;
        logMessage = `Call ended gracefully. Closing message: "${audioText}"`;
        break;
      }

      case "QUEUE_WAITING": {
        const qData = currentNode.data as unknown as QueueWaitingNodeData;
        actionResult = "PLAY_AUDIO";
        audioText =
          context.currentLanguage === "en-IN"
            ? "Automated queue distribution is not active. Connecting you to hospital reception."
            : "ഓട്ടോമേറ്റഡ് ക്യൂ സേവനം നിലവിൽ ലഭ്യമല്ല. നിങ്ങളെ ഹോസ്പിറ്റൽ റിസപ്ഷനിലേക്ക് ബന്ധിപ്പിക്കുന്നു.";
        
        // Find next edge or fallback to human transfer/reception
        const edge = flow.edges.find(
          (e) =>
            e.sourceNodeId === currentNode.id &&
            (e.sourcePortId === "agent_answered" ||
              e.sourcePortId === "queue_timeout" ||
              e.sourcePortId === "next")
        );
        nextNodeId = edge ? edge.targetNodeId : null;
        logMessage = `[QUEUE_UNSUPPORTED] Telephony queue '${qData.queueName || "General"}' not provisioned. Initiating controlled staff handoff. Next: ${nextNodeId || "Reception"}`;
        break;
      }

      case "DIRECT_AI_RECEPTIONIST": {
        const directAiData = currentNode.data as unknown as DirectAiReceptionistNodeData;
        actionResult = "STREAM_AI_AGENT";
        aiAgentConfig = {
          agentId: "agent_daya_direct_receptionist",
          agentName: "Direct Multilingual AI Receptionist",
          version: 1,
        };

        if (input.type === "START_CALL" || !input.value) {
          audioText = directAiData.initialGreetingEnglish || "Thank you for calling Daya Hospital. How may I assist you today?";
          speakingPace = directAiData.speakingPace || 1.15;
          ttsSpeaker = directAiData.sarvamSpeaker || "kavitha";
          logMessage = `Starting Direct AI Receptionist. Initial greeting: "${audioText}"`;
        } else if (input.type === "AI_COMPLETED") {
          const edge = flow.edges.find((e) => e.sourceNodeId === currentNode.id && e.sourcePortId === "call_completed");
          nextNodeId = edge ? edge.targetNodeId : null;
          logMessage = `Direct AI Receptionist completed query. Routing to ${nextNodeId}.`;
        } else if (input.type === "AI_HANDOFF") {
          const edge = flow.edges.find((e) => e.sourceNodeId === currentNode.id && e.sourcePortId === "human_handoff");
          nextNodeId = edge ? edge.targetNodeId : null;
          logMessage = `Direct AI Receptionist requested human staff handoff.`;
        } else if (input.type === "EMERGENCY_DETECTED") {
          const edge = flow.edges.find((e) => e.sourceNodeId === currentNode.id && e.sourcePortId === "emergency_escalation");
          nextNodeId = edge ? edge.targetNodeId : null;
          logMessage = `Direct AI Receptionist triggered emergency escalation.`;
        } else {
          const transcript = input.value || "";
          if (EmergencyDetector.isEmergency(transcript)) {
            context.isEmergency = true;
            context.executionPriority = "EMERGENCY";
            const edge = flow.edges.find((e) => e.sourceNodeId === currentNode.id && e.sourcePortId === "emergency_escalation");
            nextNodeId = edge ? edge.targetNodeId : null;
            actionResult = "EMERGENCY_ESCALATE";
            logMessage = `Emergency detected in caller speech during Direct AI Reception turn.`;
          } else {
            logMessage = `Direct AI Receptionist processing speech turn.`;
          }
        }
        break;
      }

      case "EMERGENCY_MONITOR": {
        const emMonData = currentNode.data as unknown as EmergencyMonitorNodeData;
        const text = input.value || "";
        const match = EmergencyDetector.evaluate(text, emMonData.confidenceThreshold || 0.7);

        if (match.isEmergency) {
          context.isEmergency = true;
          context.executionPriority = "EMERGENCY";
          const edge = flow.edges.find((e) => e.sourceNodeId === currentNode.id && e.sourcePortId === "emergency_detected");
          nextNodeId = edge ? edge.targetNodeId : null;
          actionResult = "EMERGENCY_ESCALATE";
          audioText =
            context.currentLanguage === "en-IN"
              ? (emMonData.announcementEnglish || "Connecting to emergency casualty.")
              : (emMonData.announcementMalayalam || "കാഷ്വാലിറ്റിയിലേക്ക് കണക്ട് ചെയ്യുന്നു.");
          logMessage = `Emergency Monitor triggered on '${match.matchedPhrase}' (confidence: ${match.confidenceScore.toFixed(2)}).`;
        } else {
          const edge = flow.edges.find((e) => e.sourceNodeId === currentNode.id && e.sourcePortId === "normal_flow");
          nextNodeId = edge ? edge.targetNodeId : null;
          logMessage = `Emergency Monitor: normal speech evaluated. Advancing to ${nextNodeId}.`;
        }
        break;
      }

      case "LANGUAGE_DETECTION": {
        const text = input.value || "";
        const hasMalayalam = /[\u0D00-\u0D7F]/.test(text);
        const detectedLang = hasMalayalam ? "ml-IN" : "en-IN";
        context.currentLanguage = detectedLang;
        const portId = detectedLang === "ml-IN" ? "lang_ml" : "lang_en";
        const edge = flow.edges.find((e) => e.sourceNodeId === currentNode.id && e.sourcePortId === portId);
        nextNodeId = edge ? edge.targetNodeId : null;
        logMessage = `Language detected as ${detectedLang}. Routing to ${nextNodeId}.`;
        break;
      }

      case "INTENT_DETECTION": {
        const intentData = currentNode.data as unknown as IntentDetectionNodeData;
        const text = (input.value || "").toLowerCase();

        if (EmergencyDetector.isEmergency(text)) {
          const edge = flow.edges.find((e) => e.sourceNodeId === currentNode.id && e.sourcePortId === "emergency");
          nextNodeId = edge ? edge.targetNodeId : null;
          logMessage = `Intent Detection: emergency intent recognized.`;
          break;
        }

        let matchedPortId: string | null = null;
        if (intentData.intents && intentData.intents.length > 0) {
          for (const intent of intentData.intents) {
            if (text.includes(intent.id.toLowerCase()) || text.includes(intent.name.toLowerCase())) {
              matchedPortId = intent.targetPortId;
              break;
            }
            if (intent.samplePhrases && intent.samplePhrases.some((phrase) => text.includes(phrase.toLowerCase()))) {
              matchedPortId = intent.targetPortId;
              break;
            }
          }
        }

        if (!matchedPortId) {
          if (text.includes("appoint") || text.includes("book") || text.includes("doctor") || text.includes("ടോക്കൺ")) {
            matchedPortId = "appointment";
          } else if (text.includes("bill") || text.includes("insurance") || text.includes("tpa") || text.includes("medisep")) {
            matchedPortId = "billing";
          } else if (text.includes("cardio") || text.includes("ortho") || text.includes("department") || text.includes("വിഭാഗം")) {
            matchedPortId = "department";
          } else if (text.includes("lab") || text.includes("blood") || text.includes("report") || text.includes("റിപ്പോർട്ട്")) {
            matchedPortId = "lab";
          } else if (text.includes("staff") || text.includes("reception") || text.includes("human") || text.includes("ആളോട്")) {
            matchedPortId = "human_handoff";
          } else {
            matchedPortId = intentData.fallbackPortId || "fallback";
          }
        }

        const edge = flow.edges.find((e) => e.sourceNodeId === currentNode.id && e.sourcePortId === matchedPortId);
        nextNodeId = edge ? edge.targetNodeId : null;
        logMessage = `Intent matched: '${matchedPortId}'. Routing to ${nextNodeId}.`;
        break;
      }

      case "CONDITION_BRANCH": {
        const condData = currentNode.data as unknown as ConditionBranchNodeData;
        let targetPort = condData.defaultPortId || "false";

        if (condData.conditions && condData.conditions.length > 0) {
          for (const cond of condData.conditions) {
            const val = String(context.variables[cond.variable] ?? "");
            let met = false;
            switch (cond.operator) {
              case "EQUALS":
                met = val.toLowerCase() === cond.value.toLowerCase();
                break;
              case "NOT_EQUALS":
                met = val.toLowerCase() !== cond.value.toLowerCase();
                break;
              case "CONTAINS":
                met = val.toLowerCase().includes(cond.value.toLowerCase());
                break;
              case "EXISTS":
                met = val.trim().length > 0;
                break;
              case "GREATER_THAN":
                met = Number(val) > Number(cond.value);
                break;
            }
            if (met) {
              targetPort = cond.targetPortId;
              break;
            }
          }
        }

        const edge = flow.edges.find((e) => e.sourceNodeId === currentNode.id && e.sourcePortId === targetPort);
        nextNodeId = edge ? edge.targetNodeId : null;
        logMessage = `Condition branch resolved to '${targetPort}'. Routing to ${nextNodeId}.`;
        break;
      }

      case "REUSABLE_SUBFLOW": {
        const subflowData = currentNode.data as unknown as ReusableSubflowNodeData;
        const targetFlowId =
          subflowData.targetFlowId ||
          (subflowData.targetFlowCategory ? `category_${subflowData.targetFlowCategory}` : "");

        if (!context.subflowStack) {
          context.subflowStack = [];
        }

        // 1. Max stack depth check (limit 5)
        if (context.subflowStack.length >= 5) {
          logMessage = `Subflow invocation rejected: maximum call stack depth (5) reached.`;
          const errorEdge = flow.edges.find(
            (e) => e.sourceNodeId === currentNode.id && e.sourcePortId === (subflowData.onErrorPortId || "error")
          );
          nextNodeId = errorEdge ? errorEdge.targetNodeId : null;
          break;
        }

        // 2. Loop/Cycle Detection
        const isRecursiveCycle = context.subflowStack.some((frame) => frame.parentFlowId === targetFlowId);
        if (isRecursiveCycle) {
          logMessage = `Subflow invocation rejected: recursive cycle detected for flow '${targetFlowId}'.`;
          const errorEdge = flow.edges.find(
            (e) => e.sourceNodeId === currentNode.id && e.sourcePortId === (subflowData.onErrorPortId || "error")
          );
          nextNodeId = errorEdge ? errorEdge.targetNodeId : null;
          break;
        }

        // 3. Push call frame
        const frame: SubflowCallFrame = {
          parentFlowId: context.activeFlowId || flow.id,
          parentFlowVersion: context.flowVersion,
          returnNodeId: currentNode.id,
          returnPortId: subflowData.onReturnPortId || "return",
          invokedAt: new Date().toISOString(),
          frameVariables: subflowData.passVariables ? { ...context.variables } : undefined,
        };
        context.subflowStack.push(frame);

        return {
          nextNodeId: null,
          action: "INVOKE_SUBFLOW",
          subflowTarget: {
            flowId: targetFlowId,
            version: subflowData.targetVersion,
            onReturnNodeId: currentNode.id,
            onReturnPortId: subflowData.onReturnPortId || "return",
          },
          logMessage: `[SUBFLOW INVOKE] Pushed frame to call stack (depth: ${context.subflowStack.length}). Invoking target '${targetFlowId}'.`,
          isTerminal: false,
          context,
        };
      }

      case "RETURN_SUBFLOW": {
        const returnData = currentNode.data as unknown as ReturnSubflowNodeData;
        if (!context.subflowStack || context.subflowStack.length === 0) {
          actionResult = "HANGUP";
          isTerminal = true;
          logMessage = `Flow completed via ReturnSubflow with status '${returnData.returnStatus || "COMPLETED"}'.`;
          break;
        }

        const poppedFrame = context.subflowStack.pop()!;
        if (returnData.returnVariables) {
          Object.assign(context.variables, returnData.returnVariables);
        }

        return {
          nextNodeId: poppedFrame.returnNodeId,
          action: "RETURN_FROM_SUBFLOW",
          logMessage: `[SUBFLOW RETURN] Returned from subflow to parent '${poppedFrame.parentFlowId}' (remaining depth: ${context.subflowStack.length}).`,
          isTerminal: false,
          context,
        };
      }

      case "AFTER_HOURS": {
        const ahData = currentNode.data as unknown as AfterHoursNodeData;
        const text = input.value || "";
        if (EmergencyDetector.isEmergency(text)) {
          const edge = flow.edges.find((e) => e.sourceNodeId === currentNode.id && e.sourcePortId === "casualty_transfer");
          nextNodeId = edge ? edge.targetNodeId : null;
          actionResult = "EMERGENCY_ESCALATE";
          transferDestination = ahData.casualtyNumber || "0487 2475100";
          logMessage = `Emergency detected during after-hours. Connecting to casualty.`;
        } else if (text.includes("book") || text.includes("morning") || text.includes("appointment")) {
          const edge = flow.edges.find((e) => e.sourceNodeId === currentNode.id && e.sourcePortId === "morning_booking");
          nextNodeId = edge ? edge.targetNodeId : null;
          logMessage = `Caller requested morning booking during after-hours.`;
        } else {
          actionResult = "PLAY_AUDIO";
          audioText = context.currentLanguage === "en-IN" ? ahData.afterHoursGreetingEnglish : ahData.afterHoursGreetingMalayalam;
          const edge = flow.edges.find((e) => e.sourceNodeId === currentNode.id && e.sourcePortId === "end_call");
          nextNodeId = edge ? edge.targetNodeId : null;
          logMessage = `Playing after-hours announcement.`;
        }
        break;
      }

      case "APPOINTMENT_FLOW": {
        actionResult = "STREAM_AI_AGENT";
        aiAgentConfig = {
          agentId: "agent_appointment_booking",
          agentName: "Appointment Scheduling Assistant",
          version: 1,
        };
        const edge = flow.edges.find((e) => e.sourceNodeId === currentNode.id && e.sourcePortId === "booked");
        nextNodeId = edge ? edge.targetNodeId : null;
        logMessage = `Appointment subflow executed. Advancing to ${nextNodeId}.`;
        break;
      }

      case "BILLING_FLOW": {
        const billData = currentNode.data as unknown as BillingFlowNodeData;
        const text = (input.value || "").toLowerCase();
        if (text.includes("desk") || text.includes("person") || text.includes("executive")) {
          const edge = flow.edges.find((e) => e.sourceNodeId === currentNode.id && e.sourcePortId === "transfer_billing");
          nextNodeId = edge ? edge.targetNodeId : null;
          actionResult = "TRANSFER_CALL";
          transferDestination = billData.billingDeskExtension || "104";
          logMessage = `Transferring to Billing Desk extension ${transferDestination}.`;
        } else {
          const edge = flow.edges.find((e) => e.sourceNodeId === currentNode.id && e.sourcePortId === "resolved");
          nextNodeId = edge ? edge.targetNodeId : null;
          logMessage = `Billing inquiry handled. Advancing to ${nextNodeId}.`;
        }
        break;
      }

      case "ERROR_HANDLER": {
        const errData = currentNode.data as unknown as ErrorHandlerNodeData;
        audioText = context.currentLanguage === "en-IN" ? errData.errorPromptEnglish : errData.errorPromptMalayalam;
        actionResult = errData.action === "TRANSFER_CASUALTY" ? "EMERGENCY_ESCALATE" : "HANGUP";
        const edge = flow.edges.find((e) => e.sourceNodeId === currentNode.id);
        nextNodeId = edge ? edge.targetNodeId : null;
        logMessage = `Error handler triggered with action '${errData.action}'.`;
        break;
      }

      default: {
        const nextEdge = flow.edges.find((e) => e.sourceNodeId === currentNode.id);
        nextNodeId = nextEdge ? nextEdge.targetNodeId : null;
        logMessage = `Executed node ${currentNode.title} (${currentNode.type}).`;
        break;
      }
    }

    // Update context currentNodeId if advancing
    if (nextNodeId && nextNodeId !== context.currentNodeId) {
      context.currentNodeId = nextNodeId;
      const target = flow.nodes.find((n) => n.id === nextNodeId);
      if (target) {
        context.history.push({
          nodeId: target.id,
          nodeType: target.type,
          nodeTitle: target.title,
          timestamp: new Date().toISOString(),
          actionTaken: logMessage,
          inputReceived: input.value,
        });
      }
    }

    return {
      nextNodeId,
      action: actionResult,
      audioText,
      audioLanguage: context.currentLanguage,
      ttsSpeaker,
      speakingPace,
      dtmfPrompt,
      dtmfExpectedDigits,
      transferDestination,
      aiAgentConfig,
      logMessage,
      isTerminal,
      context,
    };
  }

  /**
   * Evaluates current date/time against configured business hours and holiday overrides.
   */
  public static evaluateBusinessHours(
    data: BusinessHoursNodeData,
    date: Date
  ): "open" | "closed" | "holiday" {
    // 1. Check holiday overrides (YYYY-MM-DD)
    const dateStr = date.toISOString().split("T")[0];
    const holiday = data.holidayOverrides?.find((h) => h.date === dateStr);
    if (holiday && holiday.isClosed) {
      return "holiday";
    }

    // 2. Day of week in schedule
    const days: Array<"sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday"> = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const dayName = days[date.getDay()];
    const daySchedule = data.schedule?.[dayName];

    if (!daySchedule || !daySchedule.isOpen) {
      return "closed";
    }

    // 3. Time comparison (HH:mm)
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const currentTimeStr = `${hours}:${minutes}`;

    if (currentTimeStr >= daySchedule.openTime && currentTimeStr < daySchedule.closeTime) {
      return "open";
    }

    return "closed";
  }

  /**
   * Detects emergency / casualty keywords across Malayalam, English, and mixed speech.
   */
  public static detectEmergencyIntent(text: string): boolean {
    if (!text) return false;
    return EmergencyDetector.isEmergency(text);
  }
}
