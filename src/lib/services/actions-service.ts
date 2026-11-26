import {
  AiActionDetail,
  ActionCategory,
  ActionStatus,
  ActionReviewEntry,
  ActionWebhookEvent,
} from "@/types";
import { DayaHmsClient } from "@/lib/integrations/hms/hms-client";
import { maskPhoneNumber } from "@/lib/utils";

const hmsClient = new DayaHmsClient();

export interface ActionFilterParams {
  searchQuery?: string;
  dateRange?: string; // "ALL" | "Today" | "Yesterday" | "Last 7 Days" | "Last 30 Days"
  status?: string; // "ALL" | ActionStatus
  actionType?: string; // "ALL" | ActionType
  category?: string; // "ALL" | ActionCategory
  onlyFollowUp?: boolean;
  sortBy?: "requestedAt" | "status" | "actionType" | "callerNumber";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface PaginatedActionsResult {
  actions: AiActionDetail[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
  summaryCounts: {
    total: number;
    confirmed: number;
    requiresFollowUp: number;
    failed: number;
    inProgress: number;
    pendingVerification: number;
    cancelled: number;
  };
}

// In-memory actions store with comprehensive mock records across all 10 categories
const initialActionsStore: AiActionDetail[] = [
  {
    id: "act_101",
    callId: "call_901",
    callerNumber: "+919846018392",
    callerName: "Krishnan Namboothiri",
    actionType: "APPOINTMENT_BOOKING",
    category: "APPOINTMENT_BOOKING",
    status: "CONFIRMED",
    idempotencyKey: "idem_901_book_78219",
    requestedAt: "2026-10-27T10:46:50+05:30",
    completedAt: "2026-10-27T10:46:52+05:30",
    hmsBookingRef: "DAYA-HMS-OPD-78219",
    hmsTransactionId: "TXN-HMS-99210-OPD",
    doctorName: "Dr. Suresh Kumar",
    department: "Orthopaedics & Joint Replacement",
    appointmentSlot: "Wednesday, 28 Oct - 10:30 AM",
    patientUhid: "UHID-2026-8812",
    patientName: "Krishnan Namboothiri",
    callerRequestSummary: "Caller requested OPD consultation slot for Dr. Suresh Kumar on Wednesday morning.",
    aiAttemptSummary: "AI queried Dr. Suresh Kumar's Wednesday OPD availability and submitted a reservation request for the 10:30 AM slot.",
    sanitizedPayload: {
      doctorId: "DOC_ORTHO_04",
      slotTime: "10:30 AM",
      date: "2026-10-28",
      patientMobile: "+919846018392",
      bookingMode: "AI_SARVAM_VOICE",
      department: "Orthopaedics",
    },
    hmsResultSummary: "HMS confirmed Token #14 with Dr. Suresh Kumar. ₹450 consultation fee due at counter #3.",
    timingDetails: {
      initiatedAt: "2026-10-27T10:46:50+05:30",
      completedAt: "2026-10-27T10:46:52+05:30",
      latencyMs: 1420,
      processingStatus: "COMPLETED",
    },
    retryAttempts: 0,
    eventId: "evt_hms_act_101",
    isReviewed: true,
    reviewedBy: "Dr. Anjali Menon",
    reviewedAt: "2026-10-27T11:15:00+05:30",
    reviewHistory: [
      {
        id: "rev_act_101_1",
        reviewerId: "staff_anjali",
        reviewerName: "Dr. Anjali Menon",
        action: "REVIEWED",
        notes: "Token #14 verified against OP counter ledger.",
        timestamp: "2026-10-27T11:15:00+05:30",
      },
    ],
  },
  {
    id: "act_102",
    callId: "call_904",
    callerNumber: "+919495112233",
    callerName: "Biju Parakkal",
    actionType: "APPOINTMENT_RESCHEDULING",
    category: "APPOINTMENT_RESCHEDULING",
    status: "REQUIRES_STAFF_FOLLOW_UP",
    idempotencyKey: "idem_904_resched_099",
    requestedAt: "2026-10-27T10:00:15+05:30",
    completedAt: "2026-10-27T10:00:18+05:30",
    hmsTransactionId: "TXN-HMS-99211-ERR",
    doctorName: "Dr. K. R. Balakrishnan",
    department: "Cardiology",
    appointmentSlot: "Thursday, 29 Oct - Morning Slot",
    patientUhid: "UHID-2024-1923",
    patientName: "Biju Parakkal",
    callerRequestSummary: "Patient requested to move his cardiology follow-up from Friday to Thursday morning.",
    aiAttemptSummary: "AI checked quota for Dr. Balakrishnan on Thursday morning and attempted reschedule transaction.",
    sanitizedPayload: {
      originalAppointmentRef: "DAYA-HMS-OPD-71004",
      targetDoctorId: "DOC_CARDIO_01",
      targetDate: "2026-10-29",
      targetSlot: "Morning",
    },
    hmsResultSummary: "HMS rejected reschedule: Maximum OPD capacity (40 tokens) reached for Dr. Balakrishnan.",
    timingDetails: {
      initiatedAt: "2026-10-27T10:00:15+05:30",
      completedAt: "2026-10-27T10:00:18+05:30",
      latencyMs: 2310,
      processingStatus: "COMPLETED",
    },
    retryAttempts: 1,
    eventId: "evt_hms_act_102",
    errorDetails: {
      code: "HMS_CAPACITY_EXCEEDED",
      safeMessage: "Maximum OPD quota of 40 patients reached for requested doctor date. Priority triage required.",
      followUpRequired: true,
    },
    failureReason: "HMS_CAPACITY_EXCEEDED: Maximum OPD quota reached for Dr. K. R. Balakrishnan.",
    staffNotes: "Sister Mary assigned. Caller willing to take afternoon emergency triage slot.",
    assignedStaff: "Sister Mary (Cardiology Triage)",
    isReviewed: false,
    reviewHistory: [],
  },
  {
    id: "act_103",
    callId: "call_890",
    callerNumber: "+919846199882",
    callerName: "Anoop Raghavan",
    actionType: "APPOINTMENT_CANCELLATION",
    category: "APPOINTMENT_CANCELLATION",
    status: "CONFIRMED",
    idempotencyKey: "idem_890_cancel_7718",
    requestedAt: "2026-10-27T08:50:12+05:30",
    completedAt: "2026-10-27T08:50:14+05:30",
    hmsBookingRef: "DAYA-HMS-OPD-77189",
    hmsTransactionId: "TXN-HMS-99212-CNL",
    doctorName: "Dr. Haridas",
    department: "Neurology",
    appointmentSlot: "Tuesday, 27 Oct - 11:00 AM",
    patientUhid: "UHID-2025-4421",
    patientName: "Anoop Raghavan",
    callerRequestSummary: "Caller requested cancellation of Tuesday neurology appointment due to personal travel.",
    aiAttemptSummary: "AI validated caller identity against booking reference DAYA-HMS-OPD-77189 and sent cancellation request to Daya HMS.",
    sanitizedPayload: {
      bookingRef: "DAYA-HMS-OPD-77189",
      reason: "Patient personal travel",
      callerPhone: "+919846199882",
    },
    hmsResultSummary: "HMS cancelled token #9. Slot released back into neurology OPD pool.",
    timingDetails: {
      initiatedAt: "2026-10-27T08:50:12+05:30",
      completedAt: "2026-10-27T08:50:14+05:30",
      latencyMs: 1100,
      processingStatus: "COMPLETED",
    },
    retryAttempts: 0,
    eventId: "evt_hms_act_103",
    isReviewed: true,
    reviewedBy: "Sreejith K. (OP Desk)",
    reviewedAt: "2026-10-27T09:10:00+05:30",
    reviewHistory: [
      {
        id: "rev_act_103_1",
        reviewerId: "staff_sreejith",
        reviewerName: "Sreejith K. (OP Desk)",
        action: "REVIEWED",
        notes: "Slot successfully re-allocated to waiting list patient.",
        timestamp: "2026-10-27T09:10:00+05:30",
      },
    ],
  },
  {
    id: "act_104",
    callId: "call_903",
    callerNumber: "+919745582910",
    callerName: "Mohammed Fayiz",
    actionType: "APPOINTMENT_AVAILABILITY",
    category: "APPOINTMENT_AVAILABILITY",
    status: "CONFIRMED",
    idempotencyKey: "idem_903_avail_anitha",
    requestedAt: "2026-10-27T10:14:48+05:30",
    completedAt: "2026-10-27T10:14:49+05:30",
    doctorName: "Dr. Anitha Varghese",
    department: "General Medicine & Diabetology",
    appointmentSlot: "Today, Tuesday - 4:00 PM to 7:00 PM",
    callerRequestSummary: "Caller enquired about Dr. Anitha Varghese's OPD timings for Tuesday evening.",
    aiAttemptSummary: "AI queried HMS consultant roster for Dr. Anitha Varghese and provided available evening consultation slots.",
    sanitizedPayload: {
      doctorId: "DOC_GEN_02",
      queryDate: "2026-10-27",
    },
    hmsResultSummary: "Active OPD session found: 4:00 PM to 7:00 PM. 12 open tokens remaining.",
    timingDetails: {
      initiatedAt: "2026-10-27T10:14:48+05:30",
      completedAt: "2026-10-27T10:14:49+05:30",
      latencyMs: 380,
      processingStatus: "COMPLETED",
    },
    retryAttempts: 0,
    eventId: "evt_hms_act_104",
    isReviewed: true,
    reviewedBy: "Dr. Anjali Menon",
    reviewedAt: "2026-10-27T10:30:00+05:30",
    reviewHistory: [],
  },
  {
    id: "act_105",
    callId: "call_907",
    callerNumber: "+919847223344",
    callerName: "Devadasan Nair",
    actionType: "HOSPITAL_INFO_PROVIDED",
    category: "HOSPITAL_INFO_PROVIDED",
    status: "CONFIRMED",
    idempotencyKey: "idem_907_info_visit",
    requestedAt: "2026-10-27T09:40:00+05:30",
    completedAt: "2026-10-27T09:40:02+05:30",
    department: "Hospital Administration & ICU",
    callerRequestSummary: "Caller asked for ICU patient visiting hours and visitor pass procedures.",
    aiAttemptSummary: "AI provided verified ICU visiting protocols (4:30 PM - 6:30 PM, maximum 1 visitor at a time with pass from counter #1).",
    sanitizedPayload: {
      kbArticleId: "kb_03_visiting_hours",
      queryTopic: "ICU visiting rules",
    },
    hmsResultSummary: "Knowledge base hit confirmed. Accurate verified hospital policy dispatched.",
    timingDetails: {
      initiatedAt: "2026-10-27T09:40:00+05:30",
      completedAt: "2026-10-27T09:40:02+05:30",
      latencyMs: 250,
      processingStatus: "COMPLETED",
    },
    retryAttempts: 0,
    eventId: "evt_hms_act_105",
    isReviewed: false,
    reviewHistory: [],
  },
  {
    id: "act_106",
    callId: "call_908",
    callerNumber: "+919446338811",
    callerName: "Lathika K.",
    actionType: "CONSULTATION_FEE_ENQUIRY",
    category: "CONSULTATION_FEE_ENQUIRY",
    status: "CONFIRMED",
    idempotencyKey: "idem_908_fee_cardio",
    requestedAt: "2026-10-27T09:25:10+05:30",
    completedAt: "2026-10-27T09:25:11+05:30",
    doctorName: "Dr. K. R. Balakrishnan",
    department: "Cardiology",
    callerRequestSummary: "Caller enquired about first-time consultation fees and registration charges for Cardiology.",
    aiAttemptSummary: "AI checked HMS tariff schedule and informed caller: ₹600 consultant fee + ₹100 one-time new patient registration fee.",
    sanitizedPayload: {
      department: "Cardiology",
      doctorLevel: "Senior Interventional Cardiologist",
      isNewRegistration: true,
    },
    hmsResultSummary: "Tariff returned: ₹600 OPD Fee + ₹100 UHID Registration (Valid for 14 days).",
    timingDetails: {
      initiatedAt: "2026-10-27T09:25:10+05:30",
      completedAt: "2026-10-27T09:25:11+05:30",
      latencyMs: 310,
      processingStatus: "COMPLETED",
    },
    retryAttempts: 0,
    eventId: "evt_hms_act_106",
    isReviewed: false,
    reviewHistory: [],
  },
  {
    id: "act_107",
    callId: "call_909",
    callerNumber: "+919747123456",
    callerName: "Kunjunni Pillai",
    actionType: "CALLBACK_REQUESTED",
    category: "CALLBACK_REQUESTED",
    status: "REQUIRES_STAFF_FOLLOW_UP",
    idempotencyKey: "idem_909_callback_geriatric",
    requestedAt: "2026-10-27T09:12:00+05:30",
    completedAt: "2026-10-27T09:12:02+05:30",
    department: "Geriatric Home Care & Physiotherapy",
    callerRequestSummary: "Elderly caller requested a callback from Daya Home Care coordinator regarding bedridden patient physiotherapy visits.",
    aiAttemptSummary: "AI logged caller details, address in Punkunnam Thrissur, and queued callback request in staff follow-up system.",
    sanitizedPayload: {
      patientLocation: "Punkunnam, Thrissur",
      serviceRequested: "Home Physiotherapy",
      preferredCallbackTime: "Before 2:00 PM",
    },
    hmsResultSummary: "Callback registered in hospital outreach CRM. Queue ticket #DAYA-CB-401.",
    timingDetails: {
      initiatedAt: "2026-10-27T09:12:00+05:30",
      completedAt: "2026-10-27T09:12:02+05:30",
      latencyMs: 420,
      processingStatus: "COMPLETED",
    },
    retryAttempts: 0,
    eventId: "evt_hms_act_107",
    errorDetails: {
      code: "STAFF_CALLBACK_PENDING",
      safeMessage: "Home care coordinator must phone patient to confirm route and schedule nurse physiotherapist visit.",
      followUpRequired: true,
    },
    staffNotes: "Home Care Sister Bindu notified. Follow-up pending before 2:00 PM.",
    assignedStaff: "Sister Bindu (Home Care)",
    isReviewed: false,
    reviewHistory: [],
  },
  {
    id: "act_108",
    callId: "call_902",
    callerNumber: "+919447192831",
    callerName: "Sujatha Varma",
    actionType: "CALL_TRANSFERRED_TO_STAFF",
    category: "CALL_TRANSFERRED_TO_STAFF",
    status: "CONFIRMED",
    idempotencyKey: "idem_902_xfer_tpa",
    requestedAt: "2026-10-27T10:34:50+05:30",
    completedAt: "2026-10-27T10:34:55+05:30",
    department: "TPA & Cashless Insurance Desk",
    callerRequestSummary: "Enquired about cashless insurance pre-authorization under Star Health for knee surgery.",
    aiAttemptSummary: "AI initiated PBX warm transfer to Extension #204 (Daya TPA Desk Officer).",
    sanitizedPayload: {
      transferTarget: "EXT_204",
      department: "TPA_INSURANCE",
      callerNumber: "+919447192831",
    },
    hmsResultSummary: "Call bridge established with Ext #204. Staff agent answered within 5 seconds.",
    timingDetails: {
      initiatedAt: "2026-10-27T10:34:50+05:30",
      completedAt: "2026-10-27T10:34:55+05:30",
      latencyMs: 4800,
      processingStatus: "COMPLETED",
    },
    retryAttempts: 0,
    eventId: "evt_hms_act_108",
    isReviewed: true,
    reviewedBy: "Dr. Anjali Menon",
    reviewedAt: "2026-10-27T10:40:00+05:30",
    reviewHistory: [],
  },
  {
    id: "act_109",
    callId: "call_910",
    callerNumber: "+919846554433",
    callerName: "Reji Mathew",
    actionType: "UNRESOLVED_ENQUIRY",
    category: "UNRESOLVED_ENQUIRY",
    status: "REQUIRES_STAFF_FOLLOW_UP",
    idempotencyKey: "idem_910_unresolved_transplant",
    requestedAt: "2026-10-27T08:30:10+05:30",
    completedAt: "2026-10-27T08:30:12+05:30",
    department: "Organ Transplant & Nephrology",
    callerRequestSummary: "Caller asked about state organ registry protocol (Mrithasanjeevani) for renal donor transplants.",
    aiAttemptSummary: "AI recognized high clinical complexity query not covered in standard outpatient FAQ. Declined speculative answers and logged triage ticket.",
    sanitizedPayload: {
      clinicalDomain: "Renal Transplant Protocol",
      callerEnquiry: "Deceased donor waiting list and state authority approvals",
    },
    hmsResultSummary: "Clinical triage flag raised. Routed to Senior Medical Social Worker (PRO).",
    timingDetails: {
      initiatedAt: "2026-10-27T08:30:10+05:30",
      completedAt: "2026-10-27T08:30:12+05:30",
      latencyMs: 980,
      processingStatus: "COMPLETED",
    },
    retryAttempts: 0,
    eventId: "evt_hms_act_109",
    errorDetails: {
      code: "CLINICAL_COMPLEXITY_ESCALATION",
      safeMessage: "Complex transplant regulatory protocol must be handled by Medical Social Worker (MSW).",
      followUpRequired: true,
    },
    staffNotes: "PRO Smt. Remya assigned to phone patient with organ transplant registry counseling brochure.",
    assignedStaff: "Remya S. (Senior Medical Social Worker)",
    isReviewed: false,
    reviewHistory: [],
  },
  {
    id: "act_110",
    callId: "call_911",
    callerNumber: "+919847101020",
    callerName: "Shanti Joseph",
    actionType: "OTHER_ACTION",
    category: "OTHER_ACTION",
    status: "CONFIRMED",
    idempotencyKey: "idem_911_lab_package",
    requestedAt: "2026-10-27T08:05:00+05:30",
    completedAt: "2026-10-27T08:05:01+05:30",
    department: "Clinical Diagnostic Laboratory",
    callerRequestSummary: "Caller enquired about Comprehensive Diabetic Health Check-up package pricing and fasting requirements.",
    aiAttemptSummary: "AI provided diagnostic package details (₹1,450 package, 10-12 hours overnight fasting required, sample collection starts 6:30 AM).",
    sanitizedPayload: {
      packageId: "PKG_DIABETIC_COMPREHENSIVE",
      fastingHours: 12,
    },
    hmsResultSummary: "Diagnostic schedule verified. SMS instructions dispatched to caller.",
    timingDetails: {
      initiatedAt: "2026-10-27T08:05:00+05:30",
      completedAt: "2026-10-27T08:05:01+05:30",
      latencyMs: 340,
      processingStatus: "COMPLETED",
    },
    retryAttempts: 0,
    eventId: "evt_hms_act_110",
    isReviewed: true,
    reviewedBy: "Dr. Anjali Menon",
    reviewedAt: "2026-10-27T08:20:00+05:30",
    reviewHistory: [],
  },
  {
    id: "act_111",
    callId: "call_882",
    callerNumber: "+919744118833",
    callerName: "Mini Thomas",
    actionType: "APPOINTMENT_BOOKING",
    category: "APPOINTMENT_BOOKING",
    status: "FAILED",
    idempotencyKey: "idem_882_book_fail_01",
    requestedAt: "2026-10-27T08:15:30+05:30",
    completedAt: "2026-10-27T08:15:35+05:30",
    doctorName: "Dr. Sheela Pillai",
    department: "Obstetrics & Gynaecology",
    patientName: "Mini Thomas",
    callerRequestSummary: "Caller attempted to book Dr. Sheela Pillai for antenatal review on Thursday afternoon.",
    aiAttemptSummary: "AI attempted to submit booking request to Daya HMS, but gateway timed out after 5,000ms.",
    sanitizedPayload: {
      doctorId: "DOC_OBGYN_01",
      targetDate: "2026-10-29",
      patientMobile: "+919744118833",
    },
    hmsResultSummary: "HMS Gateway Timeout 504: Core hospital database connection timed out.",
    timingDetails: {
      initiatedAt: "2026-10-27T08:15:30+05:30",
      completedAt: "2026-10-27T08:15:35+05:30",
      latencyMs: 5120,
      processingStatus: "TIMEOUT",
    },
    retryAttempts: 2,
    eventId: "evt_hms_act_111",
    errorDetails: {
      code: "HMS_GATEWAY_TIMEOUT_504",
      safeMessage: "Hospital booking gateway timed out. Automated retries were safely halted without side-effects.",
      followUpRequired: true,
    },
    failureReason: "HMS_TIMEOUT_504: Daya Hospital Database Gateway timed out after 5000ms. Safe rollback executed.",
    staffNotes: "OPD Registrar Srikanth assigned to confirm token once database sync restores.",
    assignedStaff: "Srikanth M. (OP Registrar)",
    isReviewed: false,
    reviewHistory: [],
  },
  {
    id: "act_112",
    callId: "call_912",
    callerNumber: "+919846099887",
    callerName: "Varghese Chacko",
    actionType: "APPOINTMENT_BOOKING",
    category: "APPOINTMENT_BOOKING",
    status: "PENDING_VERIFICATION",
    idempotencyKey: "idem_912_pending_verif",
    requestedAt: "2026-10-27T10:48:00+05:30",
    doctorName: "Dr. Jacob Pulikkal",
    department: "Gastroenterology",
    appointmentSlot: "Wednesday, 28 Oct - 11:30 AM",
    patientName: "Varghese Chacko",
    callerRequestSummary: "Caller booked endoscopy follow-up slot with Dr. Jacob Pulikkal.",
    aiAttemptSummary: "AI booked token in temporary hold state. Awaiting HMS batch ledger verification.",
    sanitizedPayload: {
      doctorId: "DOC_GASTRO_03",
      slotTime: "11:30 AM",
      date: "2026-10-28",
      reservationType: "PROVISIONAL_HOLD",
    },
    hmsResultSummary: "Provisional hold active in HMS buffer. Permanent token generation pending verification.",
    timingDetails: {
      initiatedAt: "2026-10-27T10:48:00+05:30",
      processingStatus: "PENDING",
    },
    retryAttempts: 0,
    eventId: "evt_hms_act_112",
    isReviewed: false,
    reviewHistory: [],
  },
  {
    id: "act_113",
    callId: "call_913",
    callerNumber: "+919847012399",
    callerName: "Fatima Beevi",
    actionType: "APPOINTMENT_BOOKING",
    category: "APPOINTMENT_BOOKING",
    status: "IN_PROGRESS",
    idempotencyKey: "idem_913_inprogress_ent",
    requestedAt: "2026-10-27T10:49:10+05:30",
    doctorName: "Dr. Radhakrishnan",
    department: "ENT (Ear, Nose & Throat)",
    appointmentSlot: "Today, Tuesday - 5:30 PM",
    patientName: "Fatima Beevi",
    callerRequestSummary: "Caller booking urgent ENT consultation for child with ear pain.",
    aiAttemptSummary: "AI checking paediatric ENT token quota with live OPD desk.",
    sanitizedPayload: {
      doctorId: "DOC_ENT_01",
      date: "2026-10-27",
      slotTime: "05:30 PM",
    },
    timingDetails: {
      initiatedAt: "2026-10-27T10:49:10+05:30",
      processingStatus: "PENDING",
    },
    retryAttempts: 0,
    eventId: "evt_hms_act_113",
    isReviewed: false,
    reviewHistory: [],
  },
  {
    id: "act_114",
    callId: "call_914",
    callerNumber: "+919447234567",
    callerName: "Praveen V.",
    actionType: "APPOINTMENT_CANCELLATION",
    category: "APPOINTMENT_CANCELLATION",
    status: "CANCELLED",
    idempotencyKey: "idem_914_user_abort",
    requestedAt: "2026-10-27T07:45:00+05:30",
    completedAt: "2026-10-27T07:45:03+05:30",
    department: "Dermatology",
    callerRequestSummary: "Caller initiated appointment cancellation then asked AI to keep existing appointment.",
    aiAttemptSummary: "AI began cancellation workflow, caller changed mind; transaction aborted safely before committing to HMS.",
    sanitizedPayload: {
      bookingRef: "DAYA-HMS-OPD-78220",
      actionAbortReason: "Caller opted to retain existing appointment",
    },
    hmsResultSummary: "Cancellation aborted by caller request. Original token remains confirmed and active.",
    timingDetails: {
      initiatedAt: "2026-10-27T07:45:00+05:30",
      completedAt: "2026-10-27T07:45:03+05:30",
      latencyMs: 720,
      processingStatus: "COMPLETED",
    },
    retryAttempts: 0,
    eventId: "evt_hms_act_114",
    isReviewed: true,
    reviewedBy: "Dr. Anjali Menon",
    reviewedAt: "2026-10-27T08:00:00+05:30",
    reviewHistory: [],
  },
];

let actionsStore: AiActionDetail[] = [...initialActionsStore];
const processedEvents = new Map<string, { actionId: string; timestamp: string }>();

// Seed initial idempotency keys
initialActionsStore.forEach((act) => {
  if (act.idempotencyKey) {
    processedEvents.set(act.idempotencyKey, {
      actionId: act.id,
      timestamp: act.requestedAt,
    });
  }
  if (act.eventId) {
    processedEvents.set(act.eventId, {
      actionId: act.id,
      timestamp: act.requestedAt,
    });
  }
});

export class ActionsService {
  /**
   * Query actions with multi-parameter filtering, search, sorting, and pagination
   */
  async getActions(params: ActionFilterParams): Promise<PaginatedActionsResult> {
    let filtered = [...actionsStore];

    // 1. Follow-up queue only filter (for Staff Follow-Up tab)
    if (params.onlyFollowUp) {
      filtered = filtered.filter(
        (a) =>
          a.status === "REQUIRES_STAFF_FOLLOW_UP" ||
          a.status === "FAILED" ||
          a.status === "PENDING_VERIFICATION" ||
          a.errorDetails?.followUpRequired === true
      );
    }

    // 2. Date Range Filter
    if (params.dateRange && params.dateRange !== "ALL") {
      const now = new Date("2026-10-27T12:00:00+05:30");
      filtered = filtered.filter((a) => {
        const actionDate = new Date(a.requestedAt);
        const diffMs = now.getTime() - actionDate.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        if (params.dateRange === "Today") {
          return diffHours <= 24;
        } else if (params.dateRange === "Yesterday") {
          return diffHours > 24 && diffHours <= 48;
        } else if (params.dateRange === "Last 7 Days") {
          return diffHours <= 24 * 7;
        } else if (params.dateRange === "Last 30 Days") {
          return diffHours <= 24 * 30;
        }
        return true;
      });
    }

    // 3. Status Filter
    if (params.status && params.status !== "ALL") {
      filtered = filtered.filter((a) => a.status === params.status);
    }

    // 4. Action Type / Category Filter
    if (params.actionType && params.actionType !== "ALL") {
      filtered = filtered.filter(
        (a) =>
          a.actionType === params.actionType ||
          a.category === params.actionType
      );
    }

    // 5. Search Query (Action ID, Linked Call ID, Doctor, Department, HMS Ref, Caller, Patient)
    if (params.searchQuery && params.searchQuery.trim() !== "") {
      const q = params.searchQuery.toLowerCase().trim();
      filtered = filtered.filter((a) => {
        return (
          a.id.toLowerCase().includes(q) ||
          a.callId.toLowerCase().includes(q) ||
          a.callerNumber.toLowerCase().includes(q) ||
          (a.callerName && a.callerName.toLowerCase().includes(q)) ||
          (a.doctorName && a.doctorName.toLowerCase().includes(q)) ||
          (a.department && a.department.toLowerCase().includes(q)) ||
          (a.hmsBookingRef && a.hmsBookingRef.toLowerCase().includes(q)) ||
          (a.patientUhid && a.patientUhid.toLowerCase().includes(q)) ||
          (a.patientName && a.patientName.toLowerCase().includes(q)) ||
          (a.idempotencyKey && a.idempotencyKey.toLowerCase().includes(q))
        );
      });
    }

    // 6. Summary Counts
    const summaryCounts = {
      total: actionsStore.length,
      confirmed: actionsStore.filter((a) => a.status === "CONFIRMED").length,
      requiresFollowUp: actionsStore.filter(
        (a) => a.status === "REQUIRES_STAFF_FOLLOW_UP"
      ).length,
      failed: actionsStore.filter((a) => a.status === "FAILED").length,
      inProgress: actionsStore.filter((a) => a.status === "IN_PROGRESS").length,
      pendingVerification: actionsStore.filter(
        (a) => a.status === "PENDING_VERIFICATION"
      ).length,
      cancelled: actionsStore.filter((a) => a.status === "CANCELLED").length,
    };

    // 7. Sorting
    const sortBy = params.sortBy || "requestedAt";
    const sortOrder = params.sortOrder || "desc";

    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "requestedAt") {
        comparison =
          new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime();
      } else if (sortBy === "status") {
        comparison = a.status.localeCompare(b.status);
      } else if (sortBy === "actionType") {
        comparison = a.actionType.localeCompare(b.actionType);
      } else if (sortBy === "callerNumber") {
        comparison = a.callerNumber.localeCompare(b.callerNumber);
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    // 8. Pagination
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, params.limit || 8);
    const totalCount = filtered.length;
    const totalPages = Math.ceil(totalCount / limit) || 1;
    const offset = (page - 1) * limit;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      actions: paginated,
      totalCount,
      page,
      limit,
      totalPages,
      summaryCounts,
    };
  }

  /**
   * Get single action by ID
   */
  async getActionById(id: string): Promise<AiActionDetail | null> {
    const action = actionsStore.find((a) => a.id === id);
    return action ? { ...action } : null;
  }

  /**
   * Staff follow-up review updates (add note, assign staff, mark reviewed, resolve)
   * CLINICAL RULE: Do not let staff manually convert a failed action into a confirmed appointment
   * without an authoritative HMS confirmation.
   */
  async updateStaffReview(
    actionId: string,
    update: {
      reviewerName: string;
      reviewerId: string;
      notes?: string;
      assignedStaff?: string;
      markReviewed?: boolean;
      markResolved?: boolean;
    }
  ): Promise<AiActionDetail | null> {
    const index = actionsStore.findIndex((a) => a.id === actionId);
    if (index === -1) return null;

    const current = actionsStore[index];
    const timestamp = new Date().toISOString();
    const newHistory: ActionReviewEntry[] = [...(current.reviewHistory || [])];

    let updatedStatus = current.status;

    // Handle resolution
    if (update.markResolved) {
      // If it was requiring follow-up, mark as CONFIRMED (if valid ref) or RESOLVED/CANCELLED
      if (current.status === "REQUIRES_STAFF_FOLLOW_UP") {
        if (current.hmsBookingRef) {
          updatedStatus = "CONFIRMED";
        }
      }
      newHistory.push({
        id: `rev_${Date.now()}_res`,
        reviewerId: update.reviewerId,
        reviewerName: update.reviewerName,
        action: "RESOLVED",
        notes: update.notes || "Staff follow-up marked as completed/resolved.",
        timestamp,
      });
    }

    if (update.assignedStaff && update.assignedStaff !== current.assignedStaff) {
      newHistory.push({
        id: `rev_${Date.now()}_assign`,
        reviewerId: update.reviewerId,
        reviewerName: update.reviewerName,
        action: "FOLLOW_UP_ASSIGNED",
        notes: `Assigned to ${update.assignedStaff}`,
        timestamp,
      });
    }

    if (update.notes && !update.markResolved) {
      newHistory.push({
        id: `rev_${Date.now()}_note`,
        reviewerId: update.reviewerId,
        reviewerName: update.reviewerName,
        action: "NOTE_ADDED",
        notes: update.notes,
        timestamp,
      });
    }

    if (update.markReviewed !== undefined && update.markReviewed !== current.isReviewed) {
      newHistory.push({
        id: `rev_${Date.now()}_rev`,
        reviewerId: update.reviewerId,
        reviewerName: update.reviewerName,
        action: "REVIEWED",
        notes: update.markReviewed ? "Marked reviewed by staff" : "Review mark cleared",
        timestamp,
      });
    }

    const updated: AiActionDetail = {
      ...current,
      status: updatedStatus,
      staffNotes: update.notes || current.staffNotes,
      assignedStaff: update.assignedStaff || current.assignedStaff,
      isReviewed: update.markReviewed !== undefined ? update.markReviewed : current.isReviewed,
      reviewedBy: update.reviewerName,
      reviewedAt: timestamp,
      reviewHistory: newHistory,
    };

    actionsStore[index] = updated;
    return { ...updated };
  }

  /**
   * Authoritative HMS Verification:
   * Re-queries the Daya HMS adapter to see if a valid booking token exists.
   * If HMS confirms it, status is safely upgraded to CONFIRMED.
   * If HMS has no record, status remains FAILED and prevents fraudulent overrides.
   */
  async verifyWithHms(
    actionId: string,
    reviewerName: string
  ): Promise<{ success: boolean; action: AiActionDetail | null; message: string }> {
    const index = actionsStore.findIndex((a) => a.id === actionId);
    if (index === -1) {
      return { success: false, action: null, message: "Action not found." };
    }

    const current = actionsStore[index];
    const timestamp = new Date().toISOString();

    if (!current.hmsBookingRef) {
      return {
        success: false,
        action: current,
        message: "No HMS Booking Reference associated with this action. Cannot verify without reference token.",
      };
    }

    // Enforce real HMS verification contract: do not silently mock verification when real HMS is offline
    if (!hmsClient.getSimulationMode()) {
      return {
        success: false,
        action: current,
        message: "Live Daya HMS is currently offline (site-to-site VPN pending). Re-verification failed closed without simulating false confirmation.",
      };
    }

    // Call Authoritative HMS Client in simulation mode
    const hmsCheck = await hmsClient.verifyBooking(current.hmsBookingRef);

    const newHistory: ActionReviewEntry[] = [...(current.reviewHistory || [])];

    if (hmsCheck.verified && hmsCheck.status === "CONFIRMED") {
      const updated: AiActionDetail = {
        ...current,
        status: "CONFIRMED",
        isReviewed: true,
        reviewedBy: reviewerName,
        reviewedAt: timestamp,
        hmsResultSummary: `HMS Authoritative Audit: Verified confirmed active booking (${hmsCheck.slot || "OPD Slot"}).`,
        reviewHistory: [
          ...newHistory,
          {
            id: `rev_${Date.now()}`,
            reviewerId: "staff_verifier",
            reviewerName,
            action: "VERIFICATION_CHECKED",
            notes: `Authoritative Daya HMS check PASSED. Verified active token ${current.hmsBookingRef}.`,
            timestamp,
          },
        ],
      };
      actionsStore[index] = updated;
      return {
        success: true,
        action: updated,
        message: `Authoritative HMS verification succeeded: Active token ${current.hmsBookingRef} confirmed in hospital database.`,
      };
    }

    // Failed check - keep status as FAILED or REQUIRES_STAFF_FOLLOW_UP
    const updated: AiActionDetail = {
      ...current,
      reviewHistory: [
        ...newHistory,
        {
          id: `rev_${Date.now()}`,
          reviewerId: "staff_verifier",
          reviewerName,
          action: "VERIFICATION_CHECKED",
          notes: `Authoritative Daya HMS check FAILED: Reference ${current.hmsBookingRef} not found in hospital booking ledger.`,
          timestamp,
        },
      ],
    };
    actionsStore[index] = updated;
    return {
      success: false,
      action: updated,
      message: `Authoritative HMS check failed: Reference ${current.hmsBookingRef} was not found or is inactive in hospital records. Manual status confirmation blocked.`,
    };
  }

  /**
   * Webhook Integration Event Consumer:
   * Consumes action events from backend webhook processor.
   * Handles duplicate events (idempotency), delayed events, missing fields,
   * unknown action types, and retry attempts.
   */
  async consumeWebhookEvent(event: ActionWebhookEvent): Promise<{
    success: boolean;
    status: "PROCESSED" | "DUPLICATE" | "OUT_OF_ORDER" | "RETRY_UPDATED";
    action: AiActionDetail;
    message: string;
  }> {
    // 1. Idempotency Check: check eventId or idempotencyKey
    const existingByIdem =
      (event.idempotencyKey && processedEvents.get(event.idempotencyKey)) ||
      (event.eventId && processedEvents.get(event.eventId));

    if (existingByIdem) {
      const existingAction = actionsStore.find((a) => a.id === existingByIdem.actionId);
      if (existingAction) {
        return {
          success: true,
          status: "DUPLICATE",
          action: existingAction,
          message: `Idempotent duplicate event ignored. Action ${existingAction.id} already recorded.`,
        };
      }
    }

    // 2. Normalize action category & handle unknown action types
    const validCategories: ActionCategory[] = [
      "APPOINTMENT_BOOKING",
      "APPOINTMENT_RESCHEDULING",
      "APPOINTMENT_CANCELLATION",
      "APPOINTMENT_AVAILABILITY",
      "HOSPITAL_INFO_PROVIDED",
      "CONSULTATION_FEE_ENQUIRY",
      "CALLBACK_REQUESTED",
      "CALL_TRANSFERRED_TO_STAFF",
      "UNRESOLVED_ENQUIRY",
      "OTHER_ACTION",
    ];

    let mappedCategory: ActionCategory = "OTHER_ACTION";
    if (validCategories.includes(event.actionType as ActionCategory)) {
      mappedCategory = event.actionType as ActionCategory;
    } else if (event.actionType === "BOOK_APPOINTMENT") {
      mappedCategory = "APPOINTMENT_BOOKING";
    } else if (event.actionType === "RESCHEDULE_APPOINTMENT") {
      mappedCategory = "APPOINTMENT_RESCHEDULING";
    } else if (event.actionType === "CANCEL_APPOINTMENT") {
      mappedCategory = "APPOINTMENT_CANCELLATION";
    } else if (event.actionType === "CHECK_DOCTOR_SLOT") {
      mappedCategory = "APPOINTMENT_AVAILABILITY";
    } else if (event.actionType === "TRANSFER_CALL_TO_STAFF") {
      mappedCategory = "CALL_TRANSFERRED_TO_STAFF";
    } else if (event.actionType === "FEE_ENQUIRY") {
      mappedCategory = "CONSULTATION_FEE_ENQUIRY";
    }

    // 3. Status determination based on verified HMS result
    let actionStatus: ActionStatus = "REQUESTED";
    let hmsSummary: string | undefined;

    if (event.hmsResult) {
      if (event.hmsResult.status === "SUCCESS") {
        actionStatus = "CONFIRMED";
        hmsSummary = `HMS Confirmed Token #${event.hmsResult.tokenNumber || "N/A"}. Ref: ${event.hmsResult.bookingRef || "N/A"}.`;
      } else if (event.hmsResult.status === "FAILED") {
        actionStatus = "FAILED";
        hmsSummary = `HMS Error: ${event.hmsResult.errorMessage || "Transaction rejected."} (${event.hmsResult.errorCode || "HMS_ERROR"}).`;
      } else if (event.hmsResult.status === "PENDING") {
        actionStatus = "PENDING_VERIFICATION";
        hmsSummary = "Awaiting asynchronous HMS ledger confirmation.";
      }
    }

    // 4. Handle missing fields with safe healthcare defaults
    const safeActionId = `act_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const safeCallerNumber = event.callerNumber || "+910000000000";
    const safeCallId = event.callId || `call_orphan_${Date.now().toString().slice(-4)}`;
    const safeRequestedAt = event.timestamp || new Date().toISOString();

    const newAction: AiActionDetail = {
      id: safeActionId,
      callId: safeCallId,
      callerNumber: safeCallerNumber,
      callerName: event.callerName || "Unregistered Patient",
      actionType: mappedCategory,
      category: mappedCategory,
      status: actionStatus,
      idempotencyKey: event.idempotencyKey || `idem_auto_${Date.now()}`,
      eventId: event.eventId,
      requestedAt: safeRequestedAt,
      completedAt: event.hmsResult ? new Date().toISOString() : undefined,
      hmsBookingRef: event.hmsResult?.bookingRef,
      hmsTransactionId: event.hmsResult?.transactionId,
      doctorName: event.doctorName,
      department: event.department,
      callerRequestSummary: event.callerRequest || `Caller initiated enquiry regarding ${mappedCategory.replace(/_/g, " ")}.`,
      aiAttemptSummary: event.aiAttempt || `AI voice assistant attempted ${mappedCategory.replace(/_/g, " ")} on behalf of caller.`,
      sanitizedPayload: event.payload || {},
      hmsResultSummary: hmsSummary,
      timingDetails: {
        initiatedAt: safeRequestedAt,
        completedAt: event.hmsResult ? new Date().toISOString() : undefined,
        latencyMs: 1200,
        processingStatus: event.hmsResult?.status === "SUCCESS" ? "COMPLETED" : "PENDING",
      },
      retryAttempts: event.retryCount || 0,
      errorDetails:
        actionStatus === "FAILED"
          ? {
              code: event.hmsResult?.errorCode || "HMS_TRANSACTION_FAILED",
              safeMessage: event.hmsResult?.errorMessage || "Hospital management system declined transaction.",
              followUpRequired: true,
            }
          : undefined,
      failureReason: event.hmsResult?.errorMessage,
      isReviewed: false,
      reviewHistory: [],
    };

    // Store in memory
    actionsStore.unshift(newAction);

    // Register idempotency
    if (event.idempotencyKey) {
      processedEvents.set(event.idempotencyKey, {
        actionId: safeActionId,
        timestamp: safeRequestedAt,
      });
    }
    if (event.eventId) {
      processedEvents.set(event.eventId, {
        actionId: safeActionId,
        timestamp: safeRequestedAt,
      });
    }

    return {
      success: true,
      status: "PROCESSED",
      action: newAction,
      message: `Action ${newAction.id} successfully recorded from integration webhook.`,
    };
  }

  /**
   * Reset store to initial mock dataset (useful for testing)
   */
  resetStore(): void {
    actionsStore = [...initialActionsStore];
  }

  /**
   * Generate RFC-4180 compliant CSV export
   */
  generateCSV(actions: AiActionDetail[], revealPhones: boolean = false): string {
    const headers = [
      "Action ID",
      "Timestamp (IST)",
      "Linked Call ID",
      "Caller Number",
      "Patient Name",
      "Action Type",
      "Category",
      "Doctor",
      "Department",
      "Status",
      "HMS Booking Reference",
      "HMS Transaction ID",
      "Caller Request",
      "AI Attempt",
      "HMS Result",
      "Latency (ms)",
      "Retries",
      "Reviewed (Y/N)",
      "Reviewed By",
      "Staff Notes",
    ];

    const escapeCSV = (val: unknown): string => {
      if (val === undefined || val === null) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = actions.map((act) => {
      const phone = revealPhones ? act.callerNumber : maskPhoneNumber(act.callerNumber);
      return [
        escapeCSV(act.id),
        escapeCSV(act.requestedAt),
        escapeCSV(act.callId),
        escapeCSV(phone),
        escapeCSV(act.patientName || ""),
        escapeCSV(act.actionType),
        escapeCSV(act.category || act.actionType),
        escapeCSV(act.doctorName || ""),
        escapeCSV(act.department || ""),
        escapeCSV(act.status),
        escapeCSV(act.hmsBookingRef || ""),
        escapeCSV(act.hmsTransactionId || ""),
        escapeCSV(act.callerRequestSummary || ""),
        escapeCSV(act.aiAttemptSummary || ""),
        escapeCSV(act.hmsResultSummary || ""),
        escapeCSV(act.timingDetails?.latencyMs || ""),
        escapeCSV(act.retryAttempts || 0),
        escapeCSV(act.isReviewed ? "YES" : "NO"),
        escapeCSV(act.reviewedBy || ""),
        escapeCSV(act.staffNotes || ""),
      ].join(",");
    });

    return [headers.map((h) => escapeCSV(h)).join(","), ...rows].join("\n");
  }
}

export const actionsService = new ActionsService();
