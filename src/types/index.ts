export type UserRole = "HOSPITAL_ADMIN" | "CALL_REVIEWER";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  avatarUrl?: string;
}

export type CallStatus = "ANSWERED" | "BUSY" | "MISSED" | "TRANSFERRED" | "FAILED";

export type CallSource = "IVR_ROLLOVER" | "DIRECT_HOTLINE" | "OFF_HOURS";

export type CallLanguage = "MALAYALAM" | "MANGLISH" | "ENGLISH";

export type IntentCategory =
  | "APPOINTMENT_BOOKING"
  | "DOCTOR_AVAILABILITY"
  | "DEPARTMENT_ENQUIRY"
  | "CONSULTATION_FEES"
  | "HOSPITAL_TIMINGS"
  | "EMERGENCY_AMBULANCE"
  | "INSURANCE_TPA"
  | "GENERAL_QUERY";

export type FollowUpStatus = "NOT_REQUIRED" | "PENDING" | "IN_PROGRESS" | "RESOLVED";

export type ActionStatus =
  | "REQUESTED"
  | "IN_PROGRESS"
  | "CONFIRMED"
  | "FAILED"
  | "PENDING_VERIFICATION"
  | "REQUIRES_STAFF_FOLLOW_UP"
  | "CANCELLED";

export type ActionCategory =
  | "APPOINTMENT_BOOKING"
  | "APPOINTMENT_RESCHEDULING"
  | "APPOINTMENT_CANCELLATION"
  | "APPOINTMENT_AVAILABILITY"
  | "HOSPITAL_INFO_PROVIDED"
  | "CONSULTATION_FEE_ENQUIRY"
  | "CALLBACK_REQUESTED"
  | "CALL_TRANSFERRED_TO_STAFF"
  | "UNRESOLVED_ENQUIRY"
  | "OTHER_ACTION";

export type ActionType =
  | ActionCategory
  | "CHECK_DOCTOR_SLOT"
  | "BOOK_APPOINTMENT"
  | "RESCHEDULE_APPOINTMENT"
  | "CANCEL_APPOINTMENT"
  | "TRANSFER_CALL_TO_STAFF"
  | "FEE_ENQUIRY"
  | "DEPARTMENT_ROUTING";

export interface TranscriptEntry {
  id: string;
  speaker: "agent" | "caller" | "ivr";
  speakerName: string;
  text: string;
  malayalamText?: string;
  timestampMs: number;
}

export interface AiActionSummary {
  id: string;
  type: ActionType;
  status: ActionStatus;
  description: string;
  hmsReference?: string;
  timestamp: string;
}

export interface CallReviewEntry {
  id: string;
  reviewerId: string;
  reviewerName: string;
  action: "REVIEWED" | "NOTE_ADDED" | "FOLLOW_UP_REQUESTED" | "FOLLOW_UP_RESOLVED";
  notes?: string;
  timestamp: string;
}

export interface CallRecord {
  id: string;
  externalCallId: string;
  callerNumber: string;
  callerName?: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  callStatus: CallStatus;
  callSource: CallSource;
  language: CallLanguage;
  intentCategory: IntentCategory;
  aiSummary: string;
  aiConfidence: number; // 0 to 1
  transcript: TranscriptEntry[];
  recordingUrl?: string;
  audioDurationSeconds?: number;
  requiresFollowUp: boolean;
  followUpStatus: FollowUpStatus;
  followUpNotes?: string;
  assignedStaff?: string;
  hmsTransactionRef?: string;
  actions: AiActionSummary[];
  isReviewed?: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewHistory?: CallReviewEntry[];
}

export interface ActionReviewEntry {
  id: string;
  reviewerId: string;
  reviewerName: string;
  action: "REVIEWED" | "NOTE_ADDED" | "FOLLOW_UP_ASSIGNED" | "RESOLVED" | "VERIFICATION_CHECKED";
  notes?: string;
  timestamp: string;
}

export interface AiActionDetail {
  id: string;
  callId: string;
  callerNumber: string;
  callerName?: string;
  actionType: ActionType;
  category?: ActionCategory;
  status: ActionStatus;
  idempotencyKey: string;
  requestedAt: string;
  completedAt?: string;
  hmsBookingRef?: string;
  hmsTransactionId?: string;
  doctorName?: string;
  department?: string;
  appointmentSlot?: string;
  patientUhid?: string;
  patientName?: string;
  callerRequestSummary?: string;
  aiAttemptSummary?: string;
  sanitizedPayload?: Record<string, unknown>;
  hmsResultSummary?: string;
  timingDetails?: {
    initiatedAt: string;
    completedAt?: string;
    latencyMs?: number;
    processingStatus: "COMPLETED" | "TIMEOUT" | "RETRYING" | "PENDING" | "ERROR";
  };
  retryAttempts?: number;
  eventId?: string;
  errorDetails?: {
    code: string;
    safeMessage: string;
    followUpRequired: boolean;
  };
  failureReason?: string;
  staffNotes?: string;
  assignedStaff?: string;
  isReviewed?: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewHistory?: ActionReviewEntry[];
  payload?: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
}

export interface ActionWebhookEvent {
  eventId: string;
  idempotencyKey: string;
  callId: string;
  callerNumber: string;
  callerName?: string;
  actionType: string;
  timestamp: string;
  callerRequest?: string;
  aiAttempt?: string;
  doctorName?: string;
  department?: string;
  payload?: Record<string, unknown>;
  hmsResult?: {
    status: "SUCCESS" | "FAILED" | "PENDING";
    transactionId?: string;
    bookingRef?: string;
    tokenNumber?: number;
    errorCode?: string;
    errorMessage?: string;
  };
  retryCount?: number;
}

export type KnowledgeCategory =
  | "DEPARTMENTS"
  | "DOCTORS_SCHEDULE"
  | "FEES_CHARGES"
  | "HOSPITAL_POLICIES"
  | "EMERGENCY_AMBULANCE"
  | "INSURANCE_TPA";

export type KnowledgeStatus = "DRAFT" | "UNDER_REVIEW" | "PUBLISHED" | "ARCHIVED";

export interface KnowledgeArticle {
  id: string;
  title: string;
  titleMalayalam: string;
  category: KnowledgeCategory;
  summary: string;
  content: string;
  contentMalayalam: string;
  status: KnowledgeStatus;
  version: number;
  lastUpdatedBy: string;
  updatedAt: string;
  syncedToSarvam: boolean;
  lastSyncedAt?: string;
  auditHistory: {
    version: number;
    updatedBy: string;
    timestamp: string;
    summaryOfChanges: string;
  }[];
}

export interface SystemHealthStatus {
  sarvamAiVoice: "HEALTHY" | "DEGRADED" | "DOWN";
  dayaHmsGateway: "HEALTHY" | "DEGRADED" | "DOWN";
  ivrTelephonyTrunk: "HEALTHY" | "DEGRADED" | "DOWN";
  activeChannels: number;
  totalCapacity: number;
  averageLatencyMs: number;
  lastPingTimestamp: string;
  mode: "MOCK_MODE" | "PRODUCTION";
}

export interface OverviewMetrics {
  totalCallsOffered: number;
  callsAnsweredByAi: number;
  callsHandledSuccessfully: number;
  callsMissedOrDropped: number;
  callsTransferredToStaff: number;
  callsRequiringFollowUp: number;
  appointmentsBooked: number;
  appointmentsRescheduled: number;
  appointmentsCancelled: number;
  failedActions: number;
  avgCallDurationSecs: number;
  systemHealth: SystemHealthStatus;
  hourlyTrends: {
    hour: string;
    offered: number;
    answered: number;
    transferred: number;
  }[];
  intentBreakdown: {
    intent: string;
    intentLabel: string;
    count: number;
    percentage: number;
    color: string;
  }[];
}
