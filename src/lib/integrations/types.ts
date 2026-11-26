export interface IntegrationHealth {
  service: "sarvam_ai" | "sarvam_voice_agents" | "daya_hms" | "telephony_ivr";
  status: "HEALTHY" | "DEGRADED" | "DOWN";
  latencyMs: number;
  mode: "MOCK_MODE" | "PRODUCTION";
  lastChecked: string;
  details?: string;
}

// ----------------------------------------------------
// A. SARVAM AI VOICE TYPES
// ----------------------------------------------------

export interface SarvamTranscriptTurn {
  id: string;
  speaker: "agent" | "caller" | "system";
  text: string;
  textMalayalam?: string;
  timestampMs: number;
  confidence?: number;
}

export interface SarvamSummary {
  summaryMalayalam: string;
  summaryEnglish: string;
  primaryIntent: string;
  intentConfidence: number;
  detectedLanguage: "malayalam" | "manglish" | "english";
  actionIdentified?: string;
  requiresFollowUp: boolean;
  followUpReason?: string;
}

export interface SarvamInteractionMetadata {
  interactionId: string;
  agentId: string;
  startTime: string;
  endTime?: string;
  durationSeconds: number;
  status: "COMPLETED" | "FAILED" | "IN_PROGRESS" | "TRANSFERRED";
  callerNumber: string;
  audioRecordingAvailable: boolean;
  recordingUrl?: string;
  language: string;
}

export interface SarvamWebhookPayload {
  eventId: string;
  eventType: "call_ended" | "call_started" | "action_event" | "speech_detected";
  interactionId: string;
  timestamp: string;
  metadata?: {
    durationSeconds?: number;
    callerNumber?: string;
    callStatus?: "ANSWERED" | "BUSY" | "MISSED" | "TRANSFERRED" | "FAILED" | "COMPLETED";
    language?: string;
  };
  summary?: SarvamSummary;
  transcript?: SarvamTranscriptTurn[];
  recording?: {
    recordingUrl?: string;
    mimeType?: string;
    durationSeconds?: number;
  };
  actions?: Array<{
    actionId: string;
    actionType: string;
    status: string;
    parameters: Record<string, unknown>;
  }>;
}

export interface ISarvamVoiceAdapter {
  healthCheck(): Promise<IntegrationHealth>;
  verifyWebhookSignature(rawBody: string, signature: string): boolean;
  getInteractionMetadata(interactionId: string): Promise<SarvamInteractionMetadata | null>;
  getTranscript(interactionId: string): Promise<SarvamTranscriptTurn[]>;
  getSummary(interactionId: string): Promise<SarvamSummary | null>;
  getRecordingUrl(interactionId: string): Promise<{ url: string; mimeType: string } | null>;
  executeTool(toolName: string, parameters: Record<string, unknown>): Promise<{ success: boolean; result: unknown; error?: string }>;
  transcribeMalayalamAudio?(audioBuffer: Buffer): Promise<{ transcriptText: string; languageConfidence: number }>;
  generateSpokenMalayalam?(textMalayalam: string): Promise<{ audioUrl: string; durationSecs: number }>;
}

// ----------------------------------------------------
// B. DAYA HOSPITAL MANAGEMENT SYSTEM (HMS) TYPES
// ----------------------------------------------------

export interface Doctor {
  doctorId: string;
  doctorName: string;
  department: string;
  qualifications: string;
  opdDays: string[];
  consultationFee: number;
}

export interface Department {
  id: string;
  name: string;
  hodName: string;
  roomNumbers: string;
}

export interface DoctorSlot {
  slotId: string;
  doctorId: string;
  doctorName: string;
  department: string;
  date: string;
  time: string;
  isAvailable: boolean;
  consultationFee: number;
}

export interface Patient {
  uhid: string;
  name: string;
  mobile: string;
  age?: number;
  gender?: string;
}

export interface BookAppointmentInput {
  doctorId: string;
  doctorName: string;
  department: string;
  date: string;
  slotTime: string;
  patientMobile: string;
  patientName: string;
  idempotencyKey: string;
  uhid?: string;
}

export interface BookAppointmentResult {
  success: boolean;
  bookingRef?: string;
  tokenNumber?: number;
  consultationFee?: number;
  allocatedSlot?: string;
  error?: string;
  errorCode?:
    | "SLOT_UNAVAILABLE"
    | "HMS_TIMEOUT"
    | "PATIENT_NOT_FOUND"
    | "DUPLICATE_IDEMPOTENCY"
    | "VALIDATION_FAILED"
    | "HMS_UNAVAILABLE"
    | "HMS_DISCONNECTED";
  retryAfterMs?: number;
  isSimulated?: boolean;
  source?: "LIVE_HMS" | "SIMULATED_MOCK_SANDBOX";
  simulationNotice?: string;
  hmsStatus?: "CONNECTED" | "DISCONNECTED" | "DOWN";
}

export interface RescheduleAppointmentInput {
  bookingRef: string;
  patientMobile: string;
  targetDoctorId: string;
  targetDate: string;
  targetSlotTime: string;
  idempotencyKey: string;
}

export interface CancelAppointmentResult {
  success: boolean;
  cancelledRef: string;
  releasedSlot?: string;
  error?: string;
}

export interface IDayaHmsAdapter {
  healthCheck(): Promise<IntegrationHealth>;
  getDoctors(department?: string): Promise<Doctor[]>;
  getDepartments(): Promise<Department[]>;
  checkDoctorSlots(doctorId: string, date: string): Promise<DoctorSlot[]>;
  lookupPatientByMobile(mobile: string): Promise<Patient | null>;
  bookAppointment(input: BookAppointmentInput): Promise<BookAppointmentResult>;
  rescheduleAppointment(input: RescheduleAppointmentInput): Promise<BookAppointmentResult>;
  cancelAppointment(bookingRef: string, idempotencyKey: string): Promise<CancelAppointmentResult>;
  verifyBooking(bookingRef: string): Promise<{
    verified: boolean;
    bookingRef: string;
    doctorName?: string;
    slot?: string;
    status: "CONFIRMED" | "NOT_FOUND" | "CANCELLED";
  }>;
}

// ----------------------------------------------------
// C. IVR & TELEPHONY INTEGRATION TYPES
// ----------------------------------------------------

export interface TelephonyForwardResult {
  forwarded: boolean;
  routingSessionId: string;
  sessionUrl: string;
  hopCount: number;
  rolloverReason: "ALL_AGENTS_BUSY" | "RING_TIMEOUT_20S" | "OFF_HOURS";
}

export interface TelephonyTransferResult {
  success: boolean;
  destinationExtension: string;
  department: string;
  hopCount: number;
  error?: string;
}

export interface TelephonyTrunkStatus {
  totalChannels: number;
  activeChannels: number;
  availableChannels: number;
  trunkHealth: "HEALTHY" | "DEGRADED" | "DOWN";
}

export interface ITelephonyIvrAdapter {
  healthCheck(): Promise<IntegrationHealth>;
  getTrunkStatus(): Promise<TelephonyTrunkStatus>;
  forwardToAiQueue(incomingCallId: string, currentHops?: number): Promise<TelephonyForwardResult>;
  transferToHumanAgent(callId: string, departmentExt: string, currentHops?: number): Promise<TelephonyTransferResult>;
  getCallRoutingMetrics(): Promise<{
    offeredToAgents: number;
    busyRollovers: number;
    timeoutRollovers: number;
    aiHandled: number;
    casualtyFallbacks: number;
  }>;
}
