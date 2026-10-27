import {
  CallRecord,
  FollowUpStatus,
  CallReviewEntry,
} from "@/types";
import { MOCK_CALL_RECORDS } from "@/lib/mock-data";
import { maskPhoneNumber } from "@/lib/utils";

export interface CallFilterParams {
  searchQuery?: string;
  dateRange?: string; // "ALL" | "Today" | "Yesterday" | "Last 7 Days" | "Last 30 Days"
  status?: string; // "ALL" | CallStatus
  intent?: string; // "ALL" | IntentCategory
  language?: string; // "ALL" | CallLanguage
  actionType?: string; // "ALL" | ActionType
  followUp?: string; // "ALL" | "YES" | "NO"
  durationRange?: string; // "ALL" | "LT_1M" | "1_3M" | "3_5M" | "GT_5M"
  sortBy?: "startTime" | "durationSeconds" | "callStatus" | "callerNumber";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface PaginatedCallsResult {
  calls: CallRecord[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

// In-memory store with extended mock dataset for pagination & audit
const callsStore: CallRecord[] = [
  ...MOCK_CALL_RECORDS.map((c, index) => ({
    ...c,
    // Add default review metadata
    isReviewed: index % 3 === 0,
    reviewedBy: index % 3 === 0 ? "Dr. Anjali Menon" : undefined,
    reviewedAt: index % 3 === 0 ? "2026-10-27T11:15:00+05:30" : undefined,
    reviewHistory: index % 3 === 0
      ? [
          {
            id: `rev_${c.id}_01`,
            reviewerId: "usr_daya_01",
            reviewerName: "Dr. Anjali Menon",
            action: "REVIEWED" as const,
            notes: "Clinical triage and Malayalam audio verified accurate.",
            timestamp: "2026-10-27T11:15:00+05:30",
          },
        ]
      : [],
    // Recording URL only for supported answered calls
    recordingUrl:
      c.callStatus === "ANSWERED" && index < 5
        ? `/api/calls/${c.id}/recording`
        : undefined,
  })),
  // Additional mock records to guarantee multi-page pagination and diverse filter values
  {
    id: "call_910",
    externalCallId: "sarvam_sess_1301aa",
    callerNumber: "+919846114422",
    callerName: "Valsala Kumari",
    startTime: "2026-10-27T08:15:20+05:30",
    endTime: "2026-10-27T08:17:50+05:30",
    durationSeconds: 150,
    callStatus: "ANSWERED",
    callSource: "IVR_ROLLOVER",
    language: "MALAYALAM",
    intentCategory: "DOCTOR_AVAILABILITY",
    aiSummary: "Enquired about Dr. Vinod (Gastroenterology) consultation days. Advised Tuesday and Saturday morning clinics.",
    aiConfidence: 0.97,
    requiresFollowUp: false,
    followUpStatus: "NOT_REQUIRED",
    actions: [
      {
        id: "act_111",
        type: "CHECK_DOCTOR_SLOT",
        status: "CONFIRMED",
        description: "Retrieved OPD schedule for Dr. Vinod (Gastro)",
        timestamp: "2026-10-27T08:16:10+05:30",
      },
    ],
    transcript: [
      {
        id: "t_101",
        speaker: "agent",
        speakerName: "Daya AI (Sarvam)",
        text: "Namaskaram! Daya General Hospital. How may I assist you?",
        malayalamText: "നമസ്കാരം! ദയ ജനറൽ ഹോസ്പിറ്റലിലേക്ക് സ്വാഗതം.",
        timestampMs: 0,
      },
      {
        id: "t_102",
        speaker: "caller",
        speakerName: "Caller",
        text: "Dr. Vinod Gastro eppozhanu ullathu?",
        malayalamText: "ഡോക്ടർ വിനോദ് ഗ്യാസ്ട്രോ എപ്പോഴാണ് ഉള്ളത്?",
        timestampMs: 4000,
      },
    ],
    isReviewed: true,
    reviewedBy: "Sister Gracy",
    reviewedAt: "2026-10-27T09:00:00+05:30",
    reviewHistory: [],
    recordingUrl: `/api/calls/call_910/recording`,
  },
  {
    id: "call_911",
    externalCallId: "sarvam_sess_1402bb",
    callerNumber: "+919446001122",
    callerName: "Rajeev Pillai",
    startTime: "2026-10-26T16:20:10+05:30",
    endTime: "2026-10-26T16:20:45+05:30",
    durationSeconds: 35,
    callStatus: "MISSED",
    callSource: "OFF_HOURS",
    language: "MALAYALAM",
    intentCategory: "GENERAL_QUERY",
    aiSummary: "Caller disconnected after 35 seconds before completing enquiry. Logged as abandoned call.",
    aiConfidence: 0.72,
    requiresFollowUp: true,
    followUpStatus: "PENDING",
    followUpNotes: "Short call dropped during evening rush. Sister needs to call back.",
    actions: [],
    transcript: [
      {
        id: "t_111",
        speaker: "agent",
        speakerName: "Daya AI (Sarvam)",
        text: "Namaskaram! Daya General Hospital Thrissur.",
        malayalamText: "നമസ്കാരം! ദയ ജനറൽ ഹോസ്പിറ്റൽ തൃശൂർ.",
        timestampMs: 0,
      },
    ],
    isReviewed: false,
    reviewHistory: [],
    // No recording for abandoned calls
    recordingUrl: undefined,
  },
  {
    id: "call_912",
    externalCallId: "sarvam_sess_1503cc",
    callerNumber: "+919747338899",
    callerName: "Anitha Ravindran",
    startTime: "2026-10-26T11:10:00+05:30",
    endTime: "2026-10-26T11:16:30+05:30",
    durationSeconds: 390,
    callStatus: "TRANSFERRED",
    callSource: "IVR_ROLLOVER",
    language: "MALAYALAM",
    intentCategory: "EMERGENCY_AMBULANCE",
    aiSummary: "Acute chest pain emergency call from Ollur. AI immediately initiated emergency protocol and patched directly to Daya 24/7 Casualty Desk.",
    aiConfidence: 0.99,
    requiresFollowUp: true,
    followUpStatus: "RESOLVED",
    followUpNotes: "Cardiac emergency patient admitted to ICCU via Daya Ambulance within 22 minutes.",
    actions: [
      {
        id: "act_112",
        type: "TRANSFER_CALL_TO_STAFF",
        status: "CONFIRMED",
        description: "Priority Trauma/Emergency Transfer to Casualty Ext #100",
        timestamp: "2026-10-26T11:10:45+05:30",
      },
    ],
    transcript: [
      {
        id: "t_121",
        speaker: "caller",
        speakerName: "Caller",
        text: "Emergency! Heavy chest pain for my husband. We are in Ollur.",
        malayalamText: "എമർജൻസി ആണ്! ഭർത്താവിന് കടുത്ത നെഞ്ചുവേദന. ഞങ്ങൾ ഒല്ലൂരിലാണ്.",
        timestampMs: 1200,
      },
      {
        id: "t_122",
        speaker: "agent",
        speakerName: "Daya AI (Sarvam)",
        text: "Connecting you immediately to Daya Emergency Casualty and Ambulance Control. Please stay on the line.",
        malayalamText: "ഞാൻ ഉടൻ തന്നെ കാഷ്വാലിറ്റി എമർജൻസി ഡെസ്കിലേക്കും ആംബുലൻസിലേക്കും കണക്ട് ചെയ്യുന്നു. ദയവായി ഫോൺ വെക്കരുത്.",
        timestampMs: 4800,
      },
    ],
    isReviewed: true,
    reviewedBy: "Dr. Anjali Menon",
    reviewedAt: "2026-10-26T12:00:00+05:30",
    reviewHistory: [
      {
        id: "rev_912_01",
        reviewerId: "usr_daya_01",
        reviewerName: "Dr. Anjali Menon",
        action: "FOLLOW_UP_RESOLVED",
        notes: "Emergency transfer verified in under 5 seconds. Patient received in Cath Lab.",
        timestamp: "2026-10-26T12:00:00+05:30",
      },
    ],
    recordingUrl: `/api/calls/call_912/recording`,
  },
  {
    id: "call_913",
    externalCallId: "sarvam_sess_1604dd",
    callerNumber: "+919846882244",
    callerName: "Pradeep Kumar",
    startTime: "2026-10-25T14:45:10+05:30",
    endTime: "2026-10-25T14:48:20+05:30",
    durationSeconds: 190,
    callStatus: "ANSWERED",
    callSource: "DIRECT_HOTLINE",
    language: "ENGLISH",
    intentCategory: "DEPARTMENT_ENQUIRY",
    aiSummary: "Enquired regarding Master Health Checkup packages and fasting requirements. Sent SMS with package brochure link.",
    aiConfidence: 0.98,
    requiresFollowUp: false,
    followUpStatus: "NOT_REQUIRED",
    actions: [
      {
        id: "act_113",
        type: "DEPARTMENT_ROUTING",
        status: "CONFIRMED",
        description: "Sent Health Checkup details via SMS to registered mobile",
        timestamp: "2026-10-25T14:47:30+05:30",
      },
    ],
    transcript: [
      {
        id: "t_131",
        speaker: "agent",
        speakerName: "Daya AI (Sarvam)",
        text: "Welcome to Daya General Hospital. How may I help you?",
        malayalamText: "ദയ ജനറൽ ഹോസ്പിറ്റലിലേക്ക് സ്വാഗതം.",
        timestampMs: 0,
      },
      {
        id: "t_132",
        speaker: "caller",
        speakerName: "Caller",
        text: "I want details on the Executive Health Checkup package.",
        timestampMs: 3500,
      },
    ],
    isReviewed: true,
    reviewedBy: "Reception Desk",
    reviewedAt: "2026-10-25T15:30:00+05:30",
    reviewHistory: [],
    recordingUrl: `/api/calls/call_913/recording`,
  },
  {
    id: "call_914",
    externalCallId: "sarvam_sess_1705ee",
    callerNumber: "+919447551122",
    callerName: "Geetha Mohan",
    startTime: "2026-10-24T09:30:00+05:30",
    endTime: "2026-10-24T09:32:10+05:30",
    durationSeconds: 130,
    callStatus: "ANSWERED",
    callSource: "IVR_ROLLOVER",
    language: "MALAYALAM",
    intentCategory: "APPOINTMENT_BOOKING",
    aiSummary: "Cancelled appointment for Dr. Jacob (Paediatrics) on Saturday. Slot released back to HMS.",
    aiConfidence: 0.97,
    requiresFollowUp: false,
    followUpStatus: "NOT_REQUIRED",
    actions: [
      {
        id: "act_114",
        type: "CANCEL_APPOINTMENT",
        status: "CONFIRMED",
        description: "Cancelled token #09 and freed slot in HMS",
        hmsReference: "DAYA-CANC-9912",
        timestamp: "2026-10-24T09:31:40+05:30",
      },
    ],
    transcript: [],
    isReviewed: false,
    reviewHistory: [],
    recordingUrl: undefined,
  },
];

class CallsService {
  /**
   * Filter, search, sort and paginate calls
   */
  async getCalls(params: CallFilterParams = {}): Promise<PaginatedCallsResult> {
    let filtered = [...callsStore];

    // 1. Text Search (call ID, caller phone, caller name, AI summary, HMS ref)
    if (params.searchQuery && params.searchQuery.trim()) {
      const q = params.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (c) =>
          c.id.toLowerCase().includes(q) ||
          c.externalCallId.toLowerCase().includes(q) ||
          c.callerNumber.toLowerCase().includes(q) ||
          (c.callerName && c.callerName.toLowerCase().includes(q)) ||
          c.aiSummary.toLowerCase().includes(q) ||
          (c.hmsTransactionRef && c.hmsTransactionRef.toLowerCase().includes(q))
      );
    }

    // 2. Date Range Filter
    if (params.dateRange && params.dateRange !== "ALL") {
      const todayDate = "2026-10-27";
      const yesterdayDate = "2026-10-26";

      if (params.dateRange === "Today") {
        filtered = filtered.filter((c) => c.startTime.startsWith(todayDate));
      } else if (params.dateRange === "Yesterday") {
        filtered = filtered.filter((c) => c.startTime.startsWith(yesterdayDate));
      } else if (params.dateRange === "Last 7 Days") {
        const sevenDaysAgo = new Date("2026-10-20T00:00:00+05:30").getTime();
        filtered = filtered.filter(
          (c) => new Date(c.startTime).getTime() >= sevenDaysAgo
        );
      } else if (params.dateRange === "Last 30 Days") {
        const thirtyDaysAgo = new Date("2026-09-27T00:00:00+05:30").getTime();
        filtered = filtered.filter(
          (c) => new Date(c.startTime).getTime() >= thirtyDaysAgo
        );
      }
    }

    // 3. Status Filter
    if (params.status && params.status !== "ALL") {
      filtered = filtered.filter((c) => c.callStatus === params.status);
    }

    // 4. Intent Filter
    if (params.intent && params.intent !== "ALL") {
      filtered = filtered.filter((c) => c.intentCategory === params.intent);
    }

    // 5. Language Filter
    if (params.language && params.language !== "ALL") {
      filtered = filtered.filter((c) => c.language === params.language);
    }

    // 6. Action Type Filter
    if (params.actionType && params.actionType !== "ALL") {
      filtered = filtered.filter((c) =>
        c.actions.some((a) => a.type === params.actionType)
      );
    }

    // 7. Follow-Up Filter
    if (params.followUp && params.followUp !== "ALL") {
      if (params.followUp === "YES" || params.followUp === "true") {
        filtered = filtered.filter((c) => c.requiresFollowUp);
      } else if (params.followUp === "NO" || params.followUp === "false") {
        filtered = filtered.filter((c) => !c.requiresFollowUp);
      }
    }

    // 8. Duration Range Filter
    if (params.durationRange && params.durationRange !== "ALL") {
      if (params.durationRange === "LT_1M") {
        filtered = filtered.filter((c) => c.durationSeconds < 60);
      } else if (params.durationRange === "1_3M") {
        filtered = filtered.filter(
          (c) => c.durationSeconds >= 60 && c.durationSeconds <= 180
        );
      } else if (params.durationRange === "3_5M") {
        filtered = filtered.filter(
          (c) => c.durationSeconds > 180 && c.durationSeconds <= 300
        );
      } else if (params.durationRange === "GT_5M") {
        filtered = filtered.filter((c) => c.durationSeconds > 300);
      }
    }

    // 9. Sorting
    const sortBy = params.sortBy || "startTime";
    const sortOrder = params.sortOrder || "desc";

    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "startTime") {
        comparison =
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      } else if (sortBy === "durationSeconds") {
        comparison = a.durationSeconds - b.durationSeconds;
      } else if (sortBy === "callStatus") {
        comparison = a.callStatus.localeCompare(b.callStatus);
      } else if (sortBy === "callerNumber") {
        comparison = a.callerNumber.localeCompare(b.callerNumber);
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    // 10. Pagination
    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, params.limit || 8);
    const totalCount = filtered.length;
    const totalPages = Math.ceil(totalCount / limit) || 1;
    const offset = (page - 1) * limit;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      calls: paginated,
      totalCount,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Get single call by ID
   */
  async getCallById(callId: string): Promise<CallRecord | null> {
    const found = callsStore.find((c) => c.id === callId);
    return found ? { ...found } : null;
  }

  /**
   * Update staff review and follow-up status
   */
  async updateCallReview(
    callId: string,
    update: {
      isReviewed?: boolean;
      reviewerName: string;
      reviewerId: string;
      notes?: string;
      requiresFollowUp?: boolean;
      followUpStatus?: FollowUpStatus;
    }
  ): Promise<CallRecord | null> {
    const index = callsStore.findIndex((c) => c.id === callId);
    if (index === -1) return null;

    const current = callsStore[index];
    const timestamp = new Date().toISOString();

    const newReviewHistory: CallReviewEntry[] = [
      ...(current.reviewHistory || []),
    ];

    let reviewAction: CallReviewEntry["action"] = "NOTE_ADDED";
    if (update.isReviewed !== undefined && update.isReviewed !== current.isReviewed) {
      reviewAction = "REVIEWED";
    } else if (update.requiresFollowUp === false && current.requiresFollowUp) {
      reviewAction = "FOLLOW_UP_RESOLVED";
    } else if (update.requiresFollowUp === true && !current.requiresFollowUp) {
      reviewAction = "FOLLOW_UP_REQUESTED";
    }

    newReviewHistory.push({
      id: `rev_${callId}_${Date.now()}`,
      reviewerId: update.reviewerId,
      reviewerName: update.reviewerName,
      action: reviewAction,
      notes: update.notes,
      timestamp,
    });

    const updated: CallRecord = {
      ...current,
      isReviewed:
        update.isReviewed !== undefined ? update.isReviewed : current.isReviewed,
      reviewedBy: update.reviewerName,
      reviewedAt: timestamp,
      followUpNotes:
        update.notes !== undefined ? update.notes : current.followUpNotes,
      requiresFollowUp:
        update.requiresFollowUp !== undefined
          ? update.requiresFollowUp
          : current.requiresFollowUp,
      followUpStatus:
        update.followUpStatus !== undefined
          ? update.followUpStatus
          : current.followUpStatus,
      reviewHistory: newReviewHistory,
    };

    callsStore[index] = updated;
    return { ...updated };
  }

  /**
   * Generate CSV content for exported records
   */
  generateCSV(calls: CallRecord[], revealPhones = false): string {
    const headers = [
      "Call ID",
      "External Sarvam ID",
      "Start Time (IST)",
      "Duration (s)",
      "Caller Number",
      "Caller Name",
      "Language",
      "Intent Category",
      "Primary AI Action",
      "Status",
      "HMS Booking Reference",
      "Requires Follow-up",
      "Follow-up Status",
      "Staff Notes",
      "Reviewed",
      "Reviewed By",
      "AI Summary",
    ];

    const escapeCSV = (value: unknown): string => {
      if (value === null || value === undefined) return '""';
      const str = String(value).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = calls.map((c) => {
      const primaryAction =
        c.actions && c.actions.length > 0 ? c.actions[0].type : "NONE";
      const phone = revealPhones ? c.callerNumber : maskPhoneNumber(c.callerNumber);

      return [
        escapeCSV(c.id),
        escapeCSV(c.externalCallId),
        escapeCSV(c.startTime),
        escapeCSV(c.durationSeconds),
        escapeCSV(phone),
        escapeCSV(c.callerName || ""),
        escapeCSV(c.language),
        escapeCSV(c.intentCategory),
        escapeCSV(primaryAction),
        escapeCSV(c.callStatus),
        escapeCSV(c.hmsTransactionRef || ""),
        escapeCSV(c.requiresFollowUp ? "YES" : "NO"),
        escapeCSV(c.followUpStatus),
        escapeCSV(c.followUpNotes || ""),
        escapeCSV(c.isReviewed ? "YES" : "NO"),
        escapeCSV(c.reviewedBy || ""),
        escapeCSV(c.aiSummary),
      ].join(",");
    });

    return [headers.join(","), ...rows].join("\n");
  }
}

export const callsService = new CallsService();
