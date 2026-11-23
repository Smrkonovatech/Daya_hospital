/**
 * ============================================================================
 * SMRKOMED IVR NODE METADATA & DEFAULT TEMPLATES (PHASE 4)
 * ============================================================================
 *
 * Provides node registries, default input/output port definitions, and
 * multi-tenant flow generation templates.
 */

import {
  FlowNodeType,
  FlowNode,
  FlowNodeData,
  FlowNodePort,
  IvrFlowData,
  IncomingCallNodeData,
  WelcomeGreetingNodeData,
  LanguageSelectionNodeData,
  IvrMenuNodeData,
  DtmfInputNodeData,
  AiVoiceAgentNodeData,
  HumanTransferNodeData,
  EmergencyHandlingNodeData,
  BusinessHoursNodeData,
  DepartmentSelectionNodeData,
  QueueWaitingNodeData,
  TimeoutNodeData,
  InvalidInputNodeData,
  RepeatMenuNodeData,
  EndCallNodeData,
} from "@/lib/types/ivr-flow";

export interface NodeTypeMetadata {
  type: FlowNodeType;
  title: string;
  category: "FLOW_CONTROL" | "AUDIO_SPEECH" | "INTERACTION" | "AGENT_TRANSFER" | "SAFETY";
  description: string;
  defaultInputs: FlowNodePort[];
  defaultOutputs: FlowNodePort[];
  iconName: string;
  badgeColor: string;
}

export const NODE_TYPE_REGISTRY: Record<FlowNodeType, NodeTypeMetadata> = {
  INCOMING_CALL: {
    type: "INCOMING_CALL",
    title: "Incoming Call",
    category: "FLOW_CONTROL",
    description: "Inbound call entrypoint from Exotel telephony gateway",
    defaultInputs: [],
    defaultOutputs: [{ id: "next", label: "Call Answered", direction: "output" }],
    iconName: "PhoneIncoming",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300",
  },
  WELCOME_GREETING: {
    type: "WELCOME_GREETING",
    title: "Welcome Greeting",
    category: "AUDIO_SPEECH",
    description: "Plays bilingual hospital greeting audio or Sarvam TTS announcement",
    defaultInputs: [{ id: "in", label: "In", direction: "input" }],
    defaultOutputs: [{ id: "next", label: "Next", direction: "output" }],
    iconName: "Volume2",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-300",
  },
  LANGUAGE_SELECTION: {
    type: "LANGUAGE_SELECTION",
    title: "Language Selection",
    category: "INTERACTION",
    description: "Prompts caller to choose preferred language (Malayalam, English, etc.)",
    defaultInputs: [{ id: "in", label: "In", direction: "input" }],
    defaultOutputs: [
      { id: "lang_ml-IN", label: "Malayalam (1)", direction: "output" },
      { id: "lang_en-IN", label: "English (2)", direction: "output" },
      { id: "timeout", label: "Timeout", direction: "output" },
      { id: "invalid", label: "Invalid", direction: "output" },
    ],
    iconName: "Languages",
    badgeColor: "bg-indigo-100 text-indigo-800 border-indigo-300",
  },
  IVR_MENU: {
    type: "IVR_MENU",
    title: "IVR Menu",
    category: "INTERACTION",
    description: "Presents multi-option DTMF audio menu with branch routing",
    defaultInputs: [{ id: "in", label: "In", direction: "input" }],
    defaultOutputs: [
      { id: "opt_1", label: "Press 1 (Emergency)", direction: "output" },
      { id: "opt_2", label: "Press 2 (AI Assistant)", direction: "output" },
      { id: "opt_3", label: "Press 3 (Departments)", direction: "output" },
      { id: "opt_0", label: "Press 0 (Reception)", direction: "output" },
      { id: "timeout", label: "Timeout", direction: "output" },
      { id: "invalid", label: "Invalid Key", direction: "output" },
    ],
    iconName: "ListFilter",
    badgeColor: "bg-purple-100 text-purple-800 border-purple-300",
  },
  DTMF_INPUT: {
    type: "DTMF_INPUT",
    title: "DTMF Input",
    category: "INTERACTION",
    description: "Collects numeric digits from caller (e.g. UHID, doctor ID, booking ref)",
    defaultInputs: [{ id: "in", label: "In", direction: "input" }],
    defaultOutputs: [
      { id: "success", label: "Digits Received", direction: "output" },
      { id: "timeout", label: "Timeout", direction: "output" },
      { id: "invalid", label: "Invalid", direction: "output" },
    ],
    iconName: "Hash",
    badgeColor: "bg-cyan-100 text-cyan-800 border-cyan-300",
  },
  AI_VOICE_AGENT: {
    type: "AI_VOICE_AGENT",
    title: "AI Voice Agent",
    category: "AGENT_TRANSFER",
    description: "Hands off call to published Sarvam AI voice assistant",
    defaultInputs: [{ id: "in", label: "In", direction: "input" }],
    defaultOutputs: [
      { id: "call_completed", label: "Query Resolved", direction: "output" },
      { id: "human_handoff", label: "Staff Handoff", direction: "output" },
      { id: "emergency_escalation", label: "Emergency Triggered", direction: "output" },
      { id: "error", label: "Service Error", direction: "output" },
    ],
    iconName: "Bot",
    badgeColor: "bg-teal-100 text-teal-800 border-teal-300",
  },
  HUMAN_TRANSFER: {
    type: "HUMAN_TRANSFER",
    title: "Human Transfer",
    category: "AGENT_TRANSFER",
    description: "Transfers call to hospital department, queue, or external phone number",
    defaultInputs: [{ id: "in", label: "In", direction: "input" }],
    defaultOutputs: [
      { id: "connected", label: "Call Connected", direction: "output" },
      { id: "failed", label: "Transfer Failed", direction: "output" },
      { id: "timeout", label: "No Answer", direction: "output" },
      { id: "busy", label: "Line Busy", direction: "output" },
    ],
    iconName: "PhoneForwarded",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-300",
  },
  EMERGENCY_HANDLING: {
    type: "EMERGENCY_HANDLING",
    title: "Emergency Handling",
    category: "SAFETY",
    description: "Immediate high-priority escalation to hospital Casualty / Emergency triage",
    defaultInputs: [{ id: "in", label: "In", direction: "input" }],
    defaultOutputs: [
      { id: "transferred", label: "Casualty Connected", direction: "output" },
      { id: "transfer_failed", label: "Fallback Action", direction: "output" },
    ],
    iconName: "AlertTriangle",
    badgeColor: "bg-rose-100 text-rose-800 border-rose-300 font-semibold",
  },
  BUSINESS_HOURS: {
    type: "BUSINESS_HOURS",
    title: "Business Hours",
    category: "FLOW_CONTROL",
    description: "Branches call flow based on hospital operating hours and holiday calendar",
    defaultInputs: [{ id: "in", label: "In", direction: "input" }],
    defaultOutputs: [
      { id: "open", label: "During Hours (Open)", direction: "output" },
      { id: "closed", label: "After Hours (Closed)", direction: "output" },
      { id: "holiday", label: "Holiday", direction: "output" },
    ],
    iconName: "Clock",
    badgeColor: "bg-sky-100 text-sky-800 border-sky-300",
  },
  DEPARTMENT_SELECTION: {
    type: "DEPARTMENT_SELECTION",
    title: "Department Selection",
    category: "INTERACTION",
    description: "Clinical department directory selection (Cardiology, Ortho, etc.)",
    defaultInputs: [{ id: "in", label: "In", direction: "input" }],
    defaultOutputs: [
      { id: "dept_cardio", label: "Cardiology", direction: "output" },
      { id: "dept_ortho", label: "Orthopaedics", direction: "output" },
      { id: "dept_pedia", label: "Paediatrics", direction: "output" },
      { id: "dept_gen", label: "General Medicine", direction: "output" },
      { id: "timeout", label: "Timeout", direction: "output" },
      { id: "invalid", label: "Invalid", direction: "output" },
    ],
    iconName: "Stethoscope",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-300",
  },
  QUEUE_WAITING: {
    type: "QUEUE_WAITING",
    title: "Queue / Waiting",
    category: "AGENT_TRANSFER",
    description: "Places caller in waiting queue with hold music and position announcement",
    defaultInputs: [{ id: "in", label: "In", direction: "input" }],
    defaultOutputs: [
      { id: "agent_answered", label: "Staff Picked Up", direction: "output" },
      { id: "queue_timeout", label: "Queue Max Wait", direction: "output" },
      { id: "caller_hangup", label: "Caller Abandoned", direction: "output" },
    ],
    iconName: "Hourglass",
    badgeColor: "bg-yellow-100 text-yellow-800 border-yellow-300",
  },
  TIMEOUT: {
    type: "TIMEOUT",
    title: "Timeout",
    category: "FLOW_CONTROL",
    description: "Handles absence of caller DTMF or voice response with retry bounding",
    defaultInputs: [{ id: "in", label: "In", direction: "input" }],
    defaultOutputs: [
      { id: "retry", label: "Prompt Again", direction: "output" },
      { id: "exceeded", label: "Max Timeouts Exceeded", direction: "output" },
    ],
    iconName: "Timer",
    badgeColor: "bg-orange-100 text-orange-800 border-orange-300",
  },
  INVALID_INPUT: {
    type: "INVALID_INPUT",
    title: "Invalid Input",
    category: "FLOW_CONTROL",
    description: "Handles unrecognized DTMF keys with corrective prompt and retry limits",
    defaultInputs: [{ id: "in", label: "In", direction: "input" }],
    defaultOutputs: [
      { id: "retry", label: "Retry Input", direction: "output" },
      { id: "exceeded", label: "Max Invalid Exceeded", direction: "output" },
    ],
    iconName: "XCircle",
    badgeColor: "bg-red-100 text-red-800 border-red-300",
  },
  REPEAT_MENU: {
    type: "REPEAT_MENU",
    title: "Repeat Menu",
    category: "INTERACTION",
    description: "Replays previous menu options up to configured maximum repetitions",
    defaultInputs: [{ id: "in", label: "In", direction: "input" }],
    defaultOutputs: [
      { id: "repeat", label: "Replay Menu", direction: "output" },
      { id: "exceeded", label: "Limit Reached", direction: "output" },
    ],
    iconName: "RotateCcw",
    badgeColor: "bg-slate-100 text-slate-800 border-slate-300",
  },
  END_CALL: {
    type: "END_CALL",
    title: "End Call",
    category: "FLOW_CONTROL",
    description: "Plays closing courtesy message and politely terminates telephony session",
    defaultInputs: [{ id: "in", label: "In", direction: "input" }],
    defaultOutputs: [],
    iconName: "PhoneOff",
    badgeColor: "bg-slate-200 text-slate-900 border-slate-400 font-medium",
  },
  DIRECT_AI_RECEPTIONIST: {
    type: "DIRECT_AI_RECEPTIONIST",
    title: "Direct AI Receptionist",
    category: "AGENT_TRANSFER",
    description: "Direct multilingual Sarvam AI voice reception with auto language detection",
    defaultInputs: [{ id: "in", label: "In", direction: "input" }],
    defaultOutputs: [
      { id: "call_completed", label: "Query Resolved", direction: "output" },
      { id: "emergency_escalation", label: "Emergency Triggered", direction: "output" },
      { id: "department_transfer", label: "Transfer to Dept", direction: "output" },
      { id: "human_handoff", label: "Human Staff Handoff", direction: "output" },
      { id: "error", label: "Service Error", direction: "output" },
    ],
    iconName: "Sparkles",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold",
  },
  EMERGENCY_MONITOR: {
    type: "EMERGENCY_MONITOR",
    title: "Emergency Monitor",
    category: "SAFETY",
    description: "Continuous background multilingual emergency phrase detection with sub-50ms reaction",
    defaultInputs: [{ id: "in", label: "In", direction: "input" }],
    defaultOutputs: [
      { id: "emergency_detected", label: "Emergency Escalation", direction: "output" },
      { id: "normal_flow", label: "Normal Flow", direction: "output" },
    ],
    iconName: "ShieldAlert",
    badgeColor: "bg-red-100 text-red-800 border-red-300 font-bold",
  },
  LANGUAGE_DETECTION: {
    type: "LANGUAGE_DETECTION",
    title: "Language Detection",
    category: "INTERACTION",
    description: "Automatically detects Malayalam, English, or Manglish from live caller speech",
    defaultInputs: [{ id: "in", label: "In", direction: "input" }],
    defaultOutputs: [
      { id: "lang_ml", label: "Malayalam (ml-IN)", direction: "output" },
      { id: "lang_en", label: "English (en-IN)", direction: "output" },
      { id: "lang_hi", label: "Hindi (hi-IN)", direction: "output" },
    ],
    iconName: "Globe",
    badgeColor: "bg-indigo-100 text-indigo-800 border-indigo-300",
  },
  INTENT_DETECTION: {
    type: "INTENT_DETECTION",
    title: "Intent Detection",
    category: "INTERACTION",
    description: "Branches to subflows or actions based on caller speech intent",
    defaultInputs: [{ id: "in", label: "In", direction: "input" }],
    defaultOutputs: [
      { id: "emergency", label: "Emergency", direction: "output" },
      { id: "appointment", label: "Appointments", direction: "output" },
      { id: "billing", label: "Billing & Insurance", direction: "output" },
      { id: "department", label: "Departments", direction: "output" },
      { id: "lab", label: "Lab Reports", direction: "output" },
      { id: "doctor_info", label: "Doctor Timings", direction: "output" },
      { id: "human_handoff", label: "Human Staff", direction: "output" },
      { id: "fallback", label: "Fallback", direction: "output" },
    ],
    iconName: "Cpu",
    badgeColor: "bg-violet-100 text-violet-800 border-violet-300",
  },
  CONDITION_BRANCH: {
    type: "CONDITION_BRANCH",
    title: "Condition Branch",
    category: "FLOW_CONTROL",
    description: "Branches flow dynamically based on context or caller variables",
    defaultInputs: [{ id: "in", label: "In", direction: "input" }],
    defaultOutputs: [
      { id: "true", label: "Condition Met", direction: "output" },
      { id: "false", label: "Default / Else", direction: "output" },
    ],
    iconName: "GitBranch",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-300",
  },
  APPOINTMENT_FLOW: {
    type: "APPOINTMENT_FLOW",
    title: "Appointment Subflow",
    category: "AGENT_TRANSFER",
    description: "Handles doctor schedule lookup, slot booking, and consultation enquiries",
    defaultInputs: [{ id: "in", label: "In", direction: "input" }],
    defaultOutputs: [
      { id: "booked", label: "Appointment Booked", direction: "output" },
      { id: "cancelled", label: "Cancelled / Handoff", direction: "output" },
      { id: "fallback", label: "Fallback", direction: "output" },
    ],
    iconName: "Calendar",
    badgeColor: "bg-teal-100 text-teal-800 border-teal-300",
  },
  BILLING_FLOW: {
    type: "BILLING_FLOW",
    title: "Billing & Insurance Subflow",
    category: "AGENT_TRANSFER",
    description: "Handles cashless insurance, Medisep, and billing desk inquiries",
    defaultInputs: [{ id: "in", label: "In", direction: "input" }],
    defaultOutputs: [
      { id: "resolved", label: "Enquiry Resolved", direction: "output" },
      { id: "transfer_billing", label: "Transfer Billing Desk", direction: "output" },
    ],
    iconName: "CreditCard",
    badgeColor: "bg-green-100 text-green-800 border-green-300",
  },
  REUSABLE_SUBFLOW: {
    type: "REUSABLE_SUBFLOW",
    title: "Reusable Subflow",
    category: "FLOW_CONTROL",
    description: "Invokes an independent modular subflow with call stack return tracking",
    defaultInputs: [{ id: "in", label: "In", direction: "input" }],
    defaultOutputs: [
      { id: "return", label: "Return from Subflow", direction: "output" },
      { id: "error", label: "Subflow Error", direction: "output" },
    ],
    iconName: "Layers",
    badgeColor: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300",
  },
  RETURN_SUBFLOW: {
    type: "RETURN_SUBFLOW",
    title: "Return from Subflow",
    category: "FLOW_CONTROL",
    description: "Returns execution context and control back to the invoking parent flow",
    defaultInputs: [{ id: "in", label: "In", direction: "input" }],
    defaultOutputs: [],
    iconName: "CornerDownLeft",
    badgeColor: "bg-pink-100 text-pink-800 border-pink-300",
  },
  AFTER_HOURS: {
    type: "AFTER_HOURS",
    title: "After-Hours Subflow",
    category: "FLOW_CONTROL",
    description: "Night & weekend triage flow offering morning booking or casualty transfer",
    defaultInputs: [{ id: "in", label: "In", direction: "input" }],
    defaultOutputs: [
      { id: "casualty_transfer", label: "Casualty Transfer", direction: "output" },
      { id: "morning_booking", label: "Morning Booking Recorded", direction: "output" },
      { id: "end_call", label: "End Call", direction: "output" },
    ],
    iconName: "Moon",
    badgeColor: "bg-purple-100 text-purple-800 border-purple-300",
  },
  ERROR_HANDLER: {
    type: "ERROR_HANDLER",
    title: "Error Handler",
    category: "SAFETY",
    description: "Catches unexpected flow exceptions and safeguards patient experience",
    defaultInputs: [{ id: "in", label: "In", direction: "input" }],
    defaultOutputs: [
      { id: "retry", label: "Retry", direction: "output" },
      { id: "transfer_casualty", label: "Escalate to Casualty", direction: "output" },
      { id: "hangup", label: "Graceful Hangup", direction: "output" },
    ],
    iconName: "AlertOctagon",
    badgeColor: "bg-red-100 text-red-800 border-red-300",
  },
};

/**
 * Creates a default node with pre-populated properties based on node type.
 */
export function createDefaultNode(
  type: FlowNodeType,
  position: { x: number; y: number },
  hospitalDefaults?: {
    hospitalName?: string;
    emergencyNumber?: string;
    casualtyExtension?: string;
    receptionNumber?: string;
  }
): FlowNode {
  const meta = NODE_TYPE_REGISTRY[type];
  const id = `node_${type.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const hospName = hospitalDefaults?.hospitalName || "our hospital";
  const emergencyNum = hospitalDefaults?.emergencyNumber || "";

  let data: FlowNodeData = {};

  switch (type) {
    case "INCOMING_CALL":
      data = {
        callerNumberVariable: "caller_number",
        defaultLanguage: "ml-IN",
        ringDurationSeconds: 15,
      } as IncomingCallNodeData;
      break;

    case "WELCOME_GREETING":
      data = {
        greetingMode: "TTS",
        textMalayalam: `നമസ്കാരം, ${hospName}-ലേക്ക് സ്വാഗതം.`,
        textEnglish: `Hello, welcome to ${hospName}.`,
        ttsSpeaker: "kavitha",
        speakingPace: 1.15,
        playOnce: true,
      } as WelcomeGreetingNodeData;
      break;

    case "LANGUAGE_SELECTION":
      data = {
        promptMalayalam: "മലയാളത്തിൽ സംസാരിക്കാൻ 1 അമർത്തുക. For English, press 2.",
        promptEnglish: "For English, press 2. മലയാളത്തിൽ സംസാരിക്കാൻ 1 അമർത്തുക.",
        options: [
          { key: "1", languageCode: "ml-IN", labelMalayalam: "മലയാളം", labelEnglish: "Malayalam" },
          { key: "2", languageCode: "en-IN", labelMalayalam: "ഇംഗ്ലീഷ്", labelEnglish: "English" },
        ],
        timeoutSeconds: 7,
        maxRetries: 2,
      } as LanguageSelectionNodeData;
      break;

    case "IVR_MENU":
      data = {
        menuPromptMalayalam:
          "അത്യാഹിത വിഭാഗത്തിന് 1 അമർത്തുക. എഐ അസിസ്റ്റന്റിന് 2 അമർത്തുക. ഡിപ്പാർട്ട്മെന്റുകൾക്ക് 3 അമർത്തുക. റിസപ്ഷന് 0 അമർത്തുക.",
        menuPromptEnglish:
          "For Emergency, press 1. For AI Assistant, press 2. For Departments, press 3. For Reception, press 0.",
        options: [
          { key: "1", label: "Emergency / Casualty", labelMalayalam: "അത്യാഹിത വിഭാഗം", isEmergency: true },
          { key: "2", label: "AI Voice Assistant", labelMalayalam: "എഐ അസിസ്റ്റന്റ്" },
          { key: "3", label: "Departments", labelMalayalam: "ഡിപ്പാർട്ട്മെന്റുകൾ" },
          { key: "0", label: "Human Reception", labelMalayalam: "റിസപ്ഷൻ" },
        ],
        timeoutSeconds: 8,
        maxRetries: 2,
      } as IvrMenuNodeData;
      break;

    case "DTMF_INPUT":
      data = {
        promptMalayalam: "നിങ്ങളുടെ പേഷ്യന്റ് UHID നമ്പർ ടൈപ്പ് ചെയ്ത് ഹാഷ് അമർത്തുക.",
        promptEnglish: "Please enter your patient UHID number followed by hash.",
        minDigits: 4,
        maxDigits: 10,
        terminationKey: "#",
        timeoutSeconds: 10,
        variableName: "patient_uhid",
      } as DtmfInputNodeData;
      break;

    case "AI_VOICE_AGENT":
      data = {
        agentId: "agent_daya_receptionist_v1",
        agentName: "Hospital Voice Assistant",
        publishedVersion: 1,
        fallbackAction: "TRANSFER",
        silenceTimeoutMs: 400,
        enableEmergencyInterruption: true,
      } as AiVoiceAgentNodeData;
      break;

    case "HUMAN_TRANSFER":
      data = {
        transferType: "DEPARTMENT",
        departmentId: "dept_reception",
        whisperMessage: "Incoming hospital call transferred from Smrkomed IVR.",
        timeoutSeconds: 25,
        failureBehavior: "AI_AGENT",
      } as HumanTransferNodeData;
      break;

    case "EMERGENCY_HANDLING":
      data = {
        priorityEscalation: true,
        announcementMalayalam: "ഇതൊരു അത്യാഹിത കോളായതിനാൽ ഉടൻ കാഷ്വാലിറ്റിയിലേക്ക് കണക്ട് ചെയ്യുന്നു. ദയവായി കാത്തിരിക്കുക.",
        announcementEnglish: "Connecting you immediately to the Casualty department. Please stay on the line.",
        casualtyDestinationNumber: emergencyNum || "",
        autoTransfer: Boolean(emergencyNum),
        isConfirmedDestination: Boolean(emergencyNum),
        fallbackInstructionsMalayalam: "അടിയന്തിര ട്രാൻസ്ഫർ ലഭ്യമല്ലെങ്കിൽ ദയവായി തൊട്ടടുത്ത ആശുപത്രിയിലെത്തുകയോ 108 ലേക്ക് വിളിക്കുകയോ ചെയ്യുക.",
        fallbackInstructionsEnglish: "If transfer is unavailable, please proceed directly to the nearest emergency department or call emergency services (108 / 112).",
        bypassBusinessHours: true,
      } as EmergencyHandlingNodeData;
      break;

    case "BUSINESS_HOURS":
      data = {
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
        holidayOverrides: [],
      } as BusinessHoursNodeData;
      break;

    case "DEPARTMENT_SELECTION":
      data = {
        promptMalayalam: "കാർഡിയോളജിക്ക് 1, ഓർത്തോപീഡിക്സിന് 2, ജനറൽ മെഡിസിന് 3 അമർത്തുക.",
        promptEnglish: "Press 1 for Cardiology, 2 for Orthopaedics, 3 for General Medicine.",
        departments: [
          { departmentId: "dept_cardio", nameMalayalam: "കാർഡിയോളജി", nameEnglish: "Cardiology", key: "1" },
          { departmentId: "dept_ortho", nameMalayalam: "ഓർത്തോപീഡിക്സ്", nameEnglish: "Orthopaedics", key: "2" },
          { departmentId: "dept_gen", nameMalayalam: "ജനറൽ മെഡിസിൻ", nameEnglish: "General Medicine", key: "3" },
        ],
        timeoutSeconds: 8,
      } as DepartmentSelectionNodeData;
      break;

    case "QUEUE_WAITING":
      data = {
        queueName: "Outpatient Reception Queue",
        maxWaitSeconds: 90,
        announcePosition: true,
        periodicAnnouncementIntervalSeconds: 30,
      } as QueueWaitingNodeData;
      break;

    case "TIMEOUT":
      data = {
        timeoutPromptMalayalam: "ക്ഷമിക്കണം, മറുപടിയൊന്നും ലഭിച്ചില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.",
        timeoutPromptEnglish: "Sorry, we did not receive any input. Please try again.",
        maxConsecutiveTimeouts: 2,
        action: "RETRY",
      } as TimeoutNodeData;
      break;

    case "INVALID_INPUT":
      data = {
        invalidPromptMalayalam: "ക്ഷമിക്കണം, നിങ്ങൾ നൽകിയ നമ്പർ അസാധുവാണ്. ദയവായി നൽകിയിരിക്കുന്ന ഓപ്ഷനുകളിൽ ഒന്ന് തിരഞ്ഞെടുക്കുക.",
        invalidPromptEnglish: "Sorry, that was an invalid selection. Please choose from the available options.",
        maxConsecutiveInvalid: 2,
        action: "RETRY",
      } as InvalidInputNodeData;
      break;

    case "REPEAT_MENU":
      data = {
        repeatPromptMalayalam: "മെനു ഓപ്ഷനുകൾ വീണ്ടും കേൾപ്പിക്കുന്നു.",
        repeatPromptEnglish: "Replaying the menu options.",
        maxRepeats: 2,
      } as RepeatMenuNodeData;
      break;

    case "END_CALL":
      data = {
        goodbyePromptMalayalam: `${hospName}-ലേക്ക് വിളിച്ചതിന് നന്ദി. നല്ലൊരു ദിവസം ആശംസിക്കുന്നു.`,
        goodbyePromptEnglish: `Thank you for calling ${hospName}. Have a good day.`,
        hangupReason: "NORMAL_COMPLETION",
      } as EndCallNodeData;
      break;

    case "DIRECT_AI_RECEPTIONIST":
      data = {
        initialGreetingEnglish: `Hello, thank you for calling ${hospName}. How may I help you today?`,
        initialGreetingMalayalam: `നമസ്കാരം, ${hospName}-ലേക്ക് സ്വാഗതം. ഞാൻ എങ്ങനെ സഹായിക്കണം?`,
        autoDetectLanguage: true,
        supportedLanguages: ["en-IN", "ml-IN"],
        sarvamSttModel: "saaras:v4",
        sarvamTtsModel: "bulbul:v3",
        sarvamSpeaker: "kavitha",
        speakingPace: 1.15,
        emergencyInterruptionEnabled: true,
      };
      break;

    case "EMERGENCY_MONITOR":
      data = {
        continuousMonitoring: true,
        confidenceThreshold: 0.7,
        cancelOngoingSpeech: true,
        announcementEnglish: "Connecting you to Emergency Casualty immediately. Please stay on the line.",
        announcementMalayalam: "അടിയന്തിര കാഷ്വാലിറ്റി വിഭാഗത്തിലേക്ക് കണക്ട് ചെയ്യുന്നു. ദയവായി കാത്തിരിക്കുക.",
      };
      break;

    case "LANGUAGE_DETECTION":
      data = {
        defaultLanguage: "ml-IN",
        detectionTimeoutMs: 2500,
        autoSwitchPace: true,
      };
      break;

    case "INTENT_DETECTION":
      data = {
        intents: [
          { id: "emergency", name: "Emergency", targetPortId: "emergency", samplePhrases: ["emergency", "accident", "chest pain"] },
          { id: "appointment", name: "Appointments", targetPortId: "appointment", samplePhrases: ["book doctor", "appointment", "doctor timing"] },
          { id: "billing", name: "Billing", targetPortId: "billing", samplePhrases: ["insurance", "cashless", "bill", "medisep"] },
          { id: "department", name: "Departments", targetPortId: "department", samplePhrases: ["cardiology", "ortho", "paediatric"] },
          { id: "lab", name: "Lab Reports", targetPortId: "lab", samplePhrases: ["blood test", "lab report", "test result"] },
          { id: "doctor_info", name: "Doctor Information", targetPortId: "doctor_info", samplePhrases: ["visiting doctor", "specialist", "timings"] },
          { id: "human_handoff", name: "Staff Transfer", targetPortId: "human_handoff", samplePhrases: ["speak to human", "operator", "receptionist"] },
        ],
        fallbackPortId: "fallback",
      };
      break;

    case "CONDITION_BRANCH":
      data = {
        conditions: [
          { variable: "isEmergency", operator: "EQUALS", value: "true", targetPortId: "true" },
        ],
        defaultPortId: "false",
      };
      break;

    case "APPOINTMENT_FLOW":
      data = {
        allowDemoBooking: true,
        hmsIntegrationMode: "DEMO_SANDBOX",
        supportedDepartments: ["Cardiology", "Orthopaedics", "General Medicine", "Paediatrics"],
      };
      break;

    case "BILLING_FLOW":
      data = {
        insuranceTpaSupported: true,
        cashlessEnquiryEnabled: true,
        billingDeskExtension: "104",
      };
      break;

    case "REUSABLE_SUBFLOW":
      data = {
        targetFlowId: "",
        passVariables: true,
        onReturnPortId: "return",
        onErrorPortId: "error",
      };
      break;

    case "RETURN_SUBFLOW":
      data = {
        returnStatus: "COMPLETED",
        returnVariables: {},
      };
      break;

    case "AFTER_HOURS":
      data = {
        afterHoursGreetingEnglish: `Thank you for calling ${hospName}. Our regular OPD counters are currently closed (operating hours 08:00 AM to 08:00 PM).`,
        afterHoursGreetingMalayalam: `${hospName}-ലേക്ക് വിളിച്ചതിന് നന്ദി. ഒപി വിഭാഗം ഇപ്പോൾ പ്രവർത്തിക്കുന്നില്ല (പ്രവർത്തന സമയം രാവിലെ 8 മുതൽ രാത്രി 8 വരെ).`,
        emergencyTransferAllowed: true,
        casualtyNumber: emergencyNum,
      };
      break;

    case "ERROR_HANDLER":
      data = {
        errorPromptMalayalam: "സാങ്കേതിക തകരാർ കാരണം ക്ഷമ ചോദിക്കുന്നു. ദയവായി കാത്തിരിക്കുക.",
        errorPromptEnglish: "We are experiencing a temporary error. Please hold while we reconnect.",
        action: "TRANSFER_CASUALTY",
      };
      break;
  }

  return {
    id,
    type,
    title: meta.title,
    description: meta.description,
    position,
    data,
    ports: {
      inputs: [...meta.defaultInputs],
      outputs: [...meta.defaultOutputs],
    },
  };
}

/**
 * Creates a complete default inbound call flow template for a hospital tenant.
 */
export function createDefaultHospitalFlow(
  hospitalId: string,
  hospitalName = "General Hospital",
  emergencyNumber = "",
  defaultAgentId = "agent_hospital_receptionist_v1"
): IvrFlowData {
  const resolvedEmergencyNumber =
    emergencyNumber ||
    (hospitalId === "hosp_daya_thrissur" ? process.env.DAYA_CASUALTY_NUMBER || "+919606654032" : "");

  const defaults = {
    hospitalName,
    emergencyNumber: resolvedEmergencyNumber,
  };

  const incomingNode = createDefaultNode("INCOMING_CALL", { x: 50, y: 220 }, defaults);
  const welcomeNode = createDefaultNode("WELCOME_GREETING", { x: 300, y: 220 }, defaults);
  const langNode = createDefaultNode("LANGUAGE_SELECTION", { x: 580, y: 220 }, defaults);
  const menuNode = createDefaultNode("IVR_MENU", { x: 880, y: 220 }, defaults);
  
  const emergencyNode = createDefaultNode("EMERGENCY_HANDLING", { x: 1220, y: 50 }, defaults);
  if (hospitalId === "hosp_daya_thrissur") {
    (emergencyNode.data as unknown as EmergencyHandlingNodeData).autoTransfer = true;
    (emergencyNode.data as unknown as EmergencyHandlingNodeData).isConfirmedDestination = true;
    (emergencyNode.data as unknown as EmergencyHandlingNodeData).casualtyDestinationNumber =
      process.env.DAYA_CASUALTY_NUMBER || "+919606654032";
  }

  const aiAgentNode = createDefaultNode("AI_VOICE_AGENT", { x: 1220, y: 200 }, defaults);
  (aiAgentNode.data as unknown as AiVoiceAgentNodeData).agentId = defaultAgentId;

  const deptNode = createDefaultNode("DEPARTMENT_SELECTION", { x: 1220, y: 350 }, defaults);
  const transferNode = createDefaultNode("HUMAN_TRANSFER", { x: 1220, y: 500 }, defaults);
  if (hospitalId === "hosp_daya_thrissur") {
    (transferNode.data as unknown as HumanTransferNodeData).destinationNumber =
      process.env.DAYA_RECEPTION_NUMBER || "+919606654032";
    (transferNode.data as unknown as HumanTransferNodeData).transferType = "PHONE_NUMBER";
  }

  const timeoutNode = createDefaultNode("TIMEOUT", { x: 880, y: 480 }, defaults);
  const invalidNode = createDefaultNode("INVALID_INPUT", { x: 880, y: 620 }, defaults);
  const endCallNode = createDefaultNode("END_CALL", { x: 1550, y: 280 }, defaults);

  const nodes = [
    incomingNode,
    welcomeNode,
    langNode,
    menuNode,
    emergencyNode,
    aiAgentNode,
    deptNode,
    transferNode,
    timeoutNode,
    invalidNode,
    endCallNode,
  ];

  const edges = [
    {
      id: "edge_in_to_welcome",
      sourceNodeId: incomingNode.id,
      sourcePortId: "next",
      targetNodeId: welcomeNode.id,
      targetPortId: "in",
      label: "Answer",
    },
    {
      id: "edge_welcome_to_lang",
      sourceNodeId: welcomeNode.id,
      sourcePortId: "next",
      targetNodeId: langNode.id,
      targetPortId: "in",
    },
    {
      id: "edge_lang_ml_to_menu",
      sourceNodeId: langNode.id,
      sourcePortId: "lang_ml-IN",
      targetNodeId: menuNode.id,
      targetPortId: "in",
      label: "Malayalam",
    },
    {
      id: "edge_lang_en_to_menu",
      sourceNodeId: langNode.id,
      sourcePortId: "lang_en-IN",
      targetNodeId: menuNode.id,
      targetPortId: "in",
      label: "English",
    },
    {
      id: "edge_menu_opt1_emergency",
      sourceNodeId: menuNode.id,
      sourcePortId: "opt_1",
      targetNodeId: emergencyNode.id,
      targetPortId: "in",
      label: "1: Emergency",
    },
    {
      id: "edge_menu_opt2_ai",
      sourceNodeId: menuNode.id,
      sourcePortId: "opt_2",
      targetNodeId: aiAgentNode.id,
      targetPortId: "in",
      label: "2: AI Voice",
    },
    {
      id: "edge_menu_opt3_dept",
      sourceNodeId: menuNode.id,
      sourcePortId: "opt_3",
      targetNodeId: deptNode.id,
      targetPortId: "in",
      label: "3: Departments",
    },
    {
      id: "edge_menu_opt0_reception",
      sourceNodeId: menuNode.id,
      sourcePortId: "opt_0",
      targetNodeId: transferNode.id,
      targetPortId: "in",
      label: "0: Reception",
    },
    {
      id: "edge_menu_timeout",
      sourceNodeId: menuNode.id,
      sourcePortId: "timeout",
      targetNodeId: timeoutNode.id,
      targetPortId: "in",
      label: "Timeout",
    },
    {
      id: "edge_menu_invalid",
      sourceNodeId: menuNode.id,
      sourcePortId: "invalid",
      targetNodeId: invalidNode.id,
      targetPortId: "in",
      label: "Invalid",
    },
    {
      id: "edge_ai_completed",
      sourceNodeId: aiAgentNode.id,
      sourcePortId: "call_completed",
      targetNodeId: endCallNode.id,
      targetPortId: "in",
      label: "Done",
    },
    {
      id: "edge_ai_handoff",
      sourceNodeId: aiAgentNode.id,
      sourcePortId: "human_handoff",
      targetNodeId: transferNode.id,
      targetPortId: "in",
      label: "Staff Transfer",
    },
    {
      id: "edge_ai_emergency",
      sourceNodeId: aiAgentNode.id,
      sourcePortId: "emergency_escalation",
      targetNodeId: emergencyNode.id,
      targetPortId: "in",
      label: "Casualty Escalation",
    },
    {
      id: "edge_dept_to_end",
      sourceNodeId: deptNode.id,
      sourcePortId: "timeout",
      targetNodeId: endCallNode.id,
      targetPortId: "in",
    },
    {
      id: "edge_transfer_to_end",
      sourceNodeId: transferNode.id,
      sourcePortId: "connected",
      targetNodeId: endCallNode.id,
      targetPortId: "in",
    },
    {
      id: "edge_timeout_exceeded",
      sourceNodeId: timeoutNode.id,
      sourcePortId: "exceeded",
      targetNodeId: endCallNode.id,
      targetPortId: "in",
    },
    {
      id: "edge_invalid_exceeded",
      sourceNodeId: invalidNode.id,
      sourcePortId: "exceeded",
      targetNodeId: endCallNode.id,
      targetPortId: "in",
    },
  ];

  return {
    id: `flow_${hospitalId}_main_inbound`,
    hospitalId,
    name: "Main Inbound Reception Flow",
    description: "Standard hospital inbound IVR flow with bilingual greeting, emergency fast-track, and Sarvam AI assistant handoff.",
    status: "PUBLISHED",
    deploymentStatus: "EXOTEL_MAPPING_VERIFIED",
    isDefault: true,
    currentVersion: 1,
    category: "INBOUND_RECEPTION",
    direction: "INBOUND",
    executionPriority: 0,
    isEnabled: true,
    isTemplate: false,
    nodes,
    edges,
    variables: {
      defaultLanguage: "ml-IN",
      casualtyHotline: emergencyNumber,
      maxCallDurationSeconds: 600,
    },
    exotelMapping: {
      appletId: "1393239",
      appletName: "Daya Hospital Voicebot Flow",
      endpointUrl: "wss://dayahospital-production-467a7d31.up.railway.app/exotel/voicebot",
      requiredAppletType: "Voicebot Applet",
      streamingPath: "/exotel/voicebot",
      verifiedAt: "2026-11-22T08:00:00.000Z",
      mappingInstructions: [
        "In Exotel App Bazaar, locate Applet ID 1393239.",
        "Ensure the Voicebot Applet points to WebSocket URL: wss://dayahospital-production-467a7d31.up.railway.app/exotel/voicebot",
        "Verify ExoPhone 08047291658 is routed to this flow.",
      ],
      lastVerificationStatus: "VERIFIED",
    },
    lastUpdatedBy: "Hospital Administrator",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
