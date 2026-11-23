/**
 * ============================================================================
 * SMRKOMED VISUAL IVR & INBOUND CALL FLOW DEFINITIONS (PHASE 4)
 * ============================================================================
 *
 * Strongly typed node specifications, connection graphs, execution contexts,
 * and Exotel provider deployment status tracking.
 */

export type FlowNodeType =
  | "INCOMING_CALL"
  | "WELCOME_GREETING"
  | "LANGUAGE_SELECTION"
  | "IVR_MENU"
  | "DTMF_INPUT"
  | "AI_VOICE_AGENT"
  | "DIRECT_AI_RECEPTIONIST"
  | "EMERGENCY_MONITOR"
  | "EMERGENCY_HANDLING"
  | "LANGUAGE_DETECTION"
  | "INTENT_DETECTION"
  | "CONDITION_BRANCH"
  | "DEPARTMENT_SELECTION"
  | "APPOINTMENT_FLOW"
  | "BILLING_FLOW"
  | "REUSABLE_SUBFLOW"
  | "RETURN_SUBFLOW"
  | "HUMAN_TRANSFER"
  | "BUSINESS_HOURS"
  | "AFTER_HOURS"
  | "QUEUE_WAITING"
  | "TIMEOUT"
  | "INVALID_INPUT"
  | "REPEAT_MENU"
  | "ERROR_HANDLER"
  | "END_CALL";

export type FlowCategory =
  | "INBOUND_RECEPTION"
  | "EMERGENCY_ESCALATION"
  | "DEPARTMENT_ROUTING"
  | "AFTER_HOURS"
  | "APPOINTMENT"
  | "BILLING_INSURANCE"
  | "HUMAN_HANDOFF"
  | "LAB_ENQUIRIES"
  | "DOCTOR_INFO"
  | "CUSTOM";

export type IvrFlowStatus = "DRAFT" | "VALIDATED" | "PUBLISHED" | "ARCHIVED";

export type ExotelDeploymentStatus =
  | "SMRKOMED_DRAFT"
  | "VALIDATED"
  | "PUBLISHED_INTERNALLY"
  | "EXOTEL_MAPPING_REQUIRED"
  | "EXOTEL_MAPPING_VERIFIED"
  | "ACTIVE";

export interface FlowNodePort {
  id: string;
  label: string;
  direction: "input" | "output";
}

export type FlowNodeData =
  | IncomingCallNodeData
  | WelcomeGreetingNodeData
  | LanguageSelectionNodeData
  | IvrMenuNodeData
  | DtmfInputNodeData
  | AiVoiceAgentNodeData
  | DirectAiReceptionistNodeData
  | EmergencyMonitorNodeData
  | EmergencyHandlingNodeData
  | LanguageDetectionNodeData
  | IntentDetectionNodeData
  | ConditionBranchNodeData
  | DepartmentSelectionNodeData
  | AppointmentFlowNodeData
  | BillingFlowNodeData
  | ReusableSubflowNodeData
  | ReturnSubflowNodeData
  | HumanTransferNodeData
  | BusinessHoursNodeData
  | AfterHoursNodeData
  | QueueWaitingNodeData
  | TimeoutNodeData
  | InvalidInputNodeData
  | RepeatMenuNodeData
  | ErrorHandlerNodeData
  | EndCallNodeData
  | Record<string, unknown>;

export interface FlowNode<T = FlowNodeData> {
  id: string;
  type: FlowNodeType;
  title: string;
  description?: string;
  position: { x: number; y: number };
  data: T;
  ports: {
    inputs: FlowNodePort[];
    outputs: FlowNodePort[];
  };
}

export interface FlowEdge {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
  label?: string;
}

// ----------------------------------------------------
// NODE DATA SCHEMAS (15 REQUIRED NODES)
// ----------------------------------------------------

export interface IncomingCallNodeData {
  callerNumberVariable: string;
  defaultLanguage: "ml-IN" | "en-IN" | "hi-IN";
  ringDurationSeconds: number;
}

export interface WelcomeGreetingNodeData {
  greetingMode: "TTS" | "AUDIO_RECORDING";
  textMalayalam: string;
  textEnglish: string;
  ttsSpeaker: string;
  speakingPace: number;
  playOnce: boolean;
}

export interface LanguageOption {
  key: string; // e.g. "1", "2"
  languageCode: "ml-IN" | "en-IN" | "hi-IN";
  labelMalayalam: string;
  labelEnglish: string;
}

export interface LanguageSelectionNodeData {
  promptMalayalam: string;
  promptEnglish: string;
  options: LanguageOption[];
  timeoutSeconds: number;
  maxRetries: number;
}

export interface IvrMenuOption {
  key: string; // e.g. "1", "2", "3", "9", "0"
  label: string;
  labelMalayalam?: string;
  description?: string;
  isEmergency?: boolean;
}

export interface IvrMenuNodeData {
  menuPromptMalayalam: string;
  menuPromptEnglish: string;
  options: IvrMenuOption[];
  timeoutSeconds: number;
  maxRetries: number;
}

export interface DtmfInputNodeData {
  promptMalayalam: string;
  promptEnglish: string;
  minDigits: number;
  maxDigits: number;
  terminationKey: "#" | "*" | "NONE";
  timeoutSeconds: number;
  variableName: string; // e.g. "uhid", "doctor_id"
}

export interface AiVoiceAgentNodeData {
  agentId: string;
  agentName: string;
  publishedVersion: number;
  fallbackAction: "TRANSFER" | "HANGUP" | "MENU";
  silenceTimeoutMs: number;
  enableEmergencyInterruption: boolean;
}

export interface HumanTransferNodeData {
  transferType: "DEPARTMENT" | "PHONE_NUMBER" | "QUEUE";
  destinationNumber?: string;
  departmentId?: string;
  whisperMessage?: string;
  timeoutSeconds: number;
  failureBehavior: "VOICEMAIL" | "AI_AGENT" | "END_CALL";
}

export interface EmergencyHandlingNodeData {
  priorityEscalation: boolean;
  announcementMalayalam: string;
  announcementEnglish: string;
  casualtyDestinationNumber: string;
  fallbackInstructionsMalayalam: string;
  fallbackInstructionsEnglish: string;
  bypassBusinessHours: boolean;
  autoTransfer?: boolean;
  isConfirmedDestination?: boolean;
}

export interface DaySchedule {
  isOpen: boolean;
  openTime: string; // HH:mm
  closeTime: string; // HH:mm
}

export interface BusinessHoursNodeData {
  timezone: string;
  schedule: Record<"monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday", DaySchedule>;
  holidayOverrides: Array<{
    date: string; // YYYY-MM-DD
    name: string;
    isClosed: boolean;
  }>;
}

export interface DepartmentOption {
  departmentId: string;
  nameMalayalam: string;
  nameEnglish: string;
  key: string;
  extension?: string;
}

export interface DepartmentSelectionNodeData {
  promptMalayalam: string;
  promptEnglish: string;
  departments: DepartmentOption[];
  timeoutSeconds: number;
}

export interface QueueWaitingNodeData {
  queueName: string;
  maxWaitSeconds: number;
  musicOnHoldUrl?: string;
  announcePosition: boolean;
  periodicAnnouncementIntervalSeconds: number;
}

export interface TimeoutNodeData {
  timeoutPromptMalayalam: string;
  timeoutPromptEnglish: string;
  maxConsecutiveTimeouts: number;
  action: "RETRY" | "TRANSFER" | "HANGUP";
}

export interface InvalidInputNodeData {
  invalidPromptMalayalam: string;
  invalidPromptEnglish: string;
  maxConsecutiveInvalid: number;
  action: "RETRY" | "TRANSFER" | "HANGUP";
}

export interface RepeatMenuNodeData {
  targetMenuNodeId?: string;
  repeatPromptMalayalam: string;
  repeatPromptEnglish: string;
  maxRepeats: number;
}

export interface EndCallNodeData {
  goodbyePromptMalayalam: string;
  goodbyePromptEnglish: string;
  hangupReason: "NORMAL_COMPLETION" | "CALLER_HANGUP" | "TIMEOUT_EXCEEDED" | "EMERGENCY_ESCALATED" | "TRANSFER_FAILED";
}

export interface DirectAiReceptionistNodeData {
  initialGreetingEnglish: string;
  initialGreetingMalayalam?: string;
  autoDetectLanguage: boolean;
  supportedLanguages: string[];
  sarvamSttModel: string;
  sarvamTtsModel: string;
  sarvamSpeaker: string;
  speakingPace: number;
  emergencyInterruptionEnabled: boolean;
}

export interface EmergencyMonitorNodeData {
  continuousMonitoring: boolean;
  confidenceThreshold: number;
  emergencyFlowId?: string;
  cancelOngoingSpeech: boolean;
  announcementEnglish?: string;
  announcementMalayalam?: string;
}

export interface LanguageDetectionNodeData {
  defaultLanguage: "ml-IN" | "en-IN" | "hi-IN";
  detectionTimeoutMs: number;
  autoSwitchPace: boolean;
}

export interface IntentDetectionNodeData {
  intents: Array<{
    id: string;
    name: string;
    targetPortId: string;
    samplePhrases: string[];
  }>;
  fallbackPortId: string;
}

export interface ConditionBranchNodeData {
  conditions: Array<{
    variable: string;
    operator: "EQUALS" | "NOT_EQUALS" | "CONTAINS" | "EXISTS" | "GREATER_THAN";
    value: string;
    targetPortId: string;
  }>;
  defaultPortId: string;
}

export interface ReusableSubflowNodeData {
  targetFlowId: string;
  targetFlowCategory?: FlowCategory;
  targetVersion?: number; // lock to specific version or latest published
  passVariables: boolean;
  onReturnPortId: string;
  onErrorPortId: string;
}

export interface ReturnSubflowNodeData {
  returnStatus: "SUCCESS" | "CANCELLED" | "COMPLETED" | "FAILED";
  returnVariables?: Record<string, unknown>;
}

export interface AppointmentFlowNodeData {
  allowDemoBooking: boolean;
  hmsIntegrationMode: "DEMO_SANDBOX" | "LIVE_REST";
  supportedDepartments: string[];
}

export interface BillingFlowNodeData {
  insuranceTpaSupported: boolean;
  cashlessEnquiryEnabled: boolean;
  billingDeskExtension: string;
}

export interface AfterHoursNodeData {
  afterHoursGreetingEnglish: string;
  afterHoursGreetingMalayalam: string;
  emergencyTransferAllowed: boolean;
  casualtyNumber: string;
}

export interface ErrorHandlerNodeData {
  errorPromptMalayalam: string;
  errorPromptEnglish: string;
  action: "RETRY" | "TRANSFER_CASUALTY" | "HANGUP";
}

export interface SubflowCallFrame {
  parentFlowId: string;
  parentFlowVersion: number;
  returnNodeId: string;
  returnPortId: string;
  invokedAt: string;
  frameVariables?: Record<string, unknown>;
}

// ----------------------------------------------------
// FLOW GRAPH & VERSIONING
// ----------------------------------------------------

export interface ExotelMappingGuide {
  appletId?: string;
  appletName?: string;
  endpointUrl?: string;
  requiredAppletType: "Voicebot Applet" | "Connect Applet" | "Passthru Applet";
  streamingPath: string;
  verifiedAt?: string;
  mappingInstructions: string[];
  lastVerificationStatus: "VERIFIED" | "PENDING_MAPPING" | "MISMATCH";
}

export interface IvrFlowData {
  id: string;
  hospitalId: string;
  name: string;
  description?: string;
  status: IvrFlowStatus;
  deploymentStatus: ExotelDeploymentStatus;
  isDefault: boolean;
  currentVersion: number;
  category: FlowCategory;
  direction: "INBOUND" | "OUTBOUND";
  executionPriority: number;
  triggerConditions?: Record<string, unknown>;
  isEnabled: boolean;
  isTemplate: boolean;
  templateCategory?: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  variables: Record<string, unknown>;
  exotelMapping?: ExotelMappingGuide;
  lastUpdatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface IvrFlowVersionData {
  id: string;
  flowId: string;
  versionNumber: number;
  status: IvrFlowStatus;
  deploymentStatus: ExotelDeploymentStatus;
  changelog?: string;
  snapshot: {
    name: string;
    description?: string;
    category?: FlowCategory;
    direction?: "INBOUND" | "OUTBOUND";
    executionPriority?: number;
    triggerConditions?: Record<string, unknown>;
    nodes: FlowNode[];
    edges: FlowEdge[];
    variables: Record<string, unknown>;
    exotelMapping?: ExotelMappingGuide;
  };
  publishedBy: string;
  publishedAt: string;
}

// ----------------------------------------------------
// VALIDATION & SIMULATION
// ----------------------------------------------------

export interface ValidationIssue {
  nodeId?: string;
  edgeId?: string;
  level: "ERROR" | "WARNING";
  message: string;
  code: string;
}

export interface FlowValidationResult {
  isValid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface FlowExecutionContext {
  callSid: string;
  callerNumber: string;
  hospitalId: string;
  flowId: string;
  flowVersion: number;
  currentLanguage: "ml-IN" | "en-IN" | "hi-IN" | "ta-IN" | "kn-IN" | "te-IN" | string;
  currentNodeId: string;
  variables: Record<string, unknown>;
  history: Array<{
    nodeId: string;
    nodeType: FlowNodeType;
    nodeTitle: string;
    timestamp: string;
    actionTaken: string;
    inputReceived?: string;
  }>;
  turnCount: number;
  retryCounts: Record<string, number>;
  isEmergency: boolean;
  subflowStack: SubflowCallFrame[];
  activeFlowId: string;
  rootFlowId: string;
  executionPriority: "NORMAL" | "HIGH" | "EMERGENCY";
}

export interface FlowExecutionStepResult {
  nextNodeId: string | null;
  action:
    | "PLAY_AUDIO"
    | "COLLECT_DTMF"
    | "STREAM_AI_AGENT"
    | "TRANSFER_CALL"
    | "HANGUP"
    | "EMERGENCY_ESCALATE"
    | "INVOKE_SUBFLOW"
    | "RETURN_FROM_SUBFLOW";
  audioText?: string;
  audioLanguage?: "ml-IN" | "en-IN" | "hi-IN" | "ta-IN" | "kn-IN" | "te-IN" | string;
  ttsSpeaker?: string;
  speakingPace?: number;
  dtmfPrompt?: string;
  dtmfExpectedDigits?: number;
  transferDestination?: string;
  aiAgentConfig?: {
    agentId: string;
    agentName: string;
    version: number;
  };
  subflowTarget?: {
    flowId: string;
    version?: number;
    onReturnNodeId: string;
    onReturnPortId: string;
  };
  logMessage: string;
  isTerminal: boolean;
  context: FlowExecutionContext;
}
