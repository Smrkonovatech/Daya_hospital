import {
  CallRecord,
  CallStatus,
  IntentCategory,
  CallLanguage,
  ActionType,
  FollowUpStatus,
} from "@/types";
import { prisma, checkDatabaseConnection } from "@/lib/db/prisma";
import { MOCK_CALL_RECORDS } from "@/lib/mock-data";

export interface CallFilterParams {
  q?: string;
  search?: string;
  searchQuery?: string;
  dateRange?: string;
  status?: string;
  intent?: string;
  language?: string;
  actionType?: string;
  followUp?: string;
  durationRange?: string;
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
  isDemoData: boolean;
}

// In-memory fallback store initialized with realistic hospital records
const inMemoryCalls: CallRecord[] = [
  ...MOCK_CALL_RECORDS.map((c, index) => ({
    ...c,
    isReviewed: index % 3 === 0,
    reviewedBy: index % 3 === 0 ? "Dr. Anjali Menon" : undefined,
    reviewedAt: index % 3 === 0 ? "2026-10-27T11:15:00+05:30" : undefined,
    reviewHistory:
      index % 3 === 0
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
    recordingUrl:
      c.callStatus === "ANSWERED" && index < 5
        ? `/api/calls/${c.id}/recording`
        : undefined,
  })),
  {
    id: "call_910",
    externalCallId: "sarvam_sess_1301aa",
    callerNumber: "+91 98461 •••••",
    callerName: "Valsala Kumari",
    startTime: "2026-10-27T08:15:20+05:30",
    endTime: "2026-10-27T08:17:50+05:30",
    durationSeconds: 150,
    callStatus: "ANSWERED",
    callSource: "IVR_ROLLOVER",
    language: "MALAYALAM",
    intentCategory: "DOCTOR_AVAILABILITY",
    aiSummary:
      "Enquired about Dr. Vinod (Gastroenterology) consultation days. Advised Tuesday and Saturday morning clinics.",
    aiConfidence: 0.97,
    requiresFollowUp: false,
    followUpStatus: "NOT_REQUIRED",
    actions: [
      {
        id: "act_111",
        type: "CHECK_DOCTOR_SLOT",
        status: "CONFIRMED",
        description: "Retrieved OPD schedule for Dr. Vinod (Gastro)",
        result: "Confirmed Tuesday 9:00 AM - 1:00 PM",
        timestamp: "2026-10-27T08:16:10+05:30",
      },
    ],
    transcript: [
      {
        id: "tr_910_01",
        speaker: "AI_AGENT",
        speakerName: "Sarvam Voice Assistant",
        text: "നമസ്കാരം, ദയാ ഹോസ്പിറ്റൽ ഹെൽപ്പ് ഡെസ്ക്. എന്ത് വിവരമാണ് അറിയേണ്ടത്?",
        timestampMs: 2000,
        timestamp: "08:15:22",
      },
      {
        id: "tr_910_02",
        speaker: "CALLER",
        speakerName: "Valsala Kumari",
        text: "ഡോക്ടർ വിനോദ് ഗ്യാസ്ട്രോ എന്ന് കാണാൻ പറ്റും?",
        timestampMs: 10000,
        timestamp: "08:15:30",
      },
      {
        id: "tr_910_03",
        speaker: "AI_AGENT",
        speakerName: "Sarvam Voice Assistant",
        text: "ഡോ. വിനോദ് ചൊവ്വ, ശനി ദിവസങ്ങളിൽ രാവിലെ ഒമ്പത് മുതൽ ഒരു മണി വരെ ഉണ്ടായിരിക്കും.",
        timestampMs: 25000,
        timestamp: "08:15:45",
      },
    ],
  },
];

class CallsRepository {
  /**
   * Retrieves calls with server-side filtering, sorting, and pagination.
   */
  async getCalls(params: CallFilterParams): Promise<PaginatedCallsResult> {
    const dbStatus = await checkDatabaseConnection();

    if (dbStatus.connected) {
      try {
        return await this.getCallsFromDatabase(params);
      } catch (err) {
        console.warn("Database query failed; falling back to in-memory store:", err);
      }
    }

    return this.getCallsFromMemory(params);
  }

  /**
   * PostgreSQL Prisma query with relational joins and index-backed pagination.
   */
  private async getCallsFromDatabase(
    params: CallFilterParams
  ): Promise<PaginatedCallsResult> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 8));
    const skip = (page - 1) * limit;

    // Build Prisma WhereInput
    const where: Record<string, unknown> = {};

    const q = params.q || params.search || params.searchQuery;
    if (q?.trim()) {
      where.OR = [
        { id: { contains: q.trim(), mode: "insensitive" } },
        { callerNumber: { contains: q.trim(), mode: "insensitive" } },
        { callerName: { contains: q.trim(), mode: "insensitive" } },
        { aiSummary: { contains: q.trim(), mode: "insensitive" } },
      ];
    }

    if (params.status && params.status !== "ALL") {
      where.callStatus = params.status;
    }

    if (params.intent && params.intent !== "ALL") {
      where.intentCategory = params.intent;
    }

    if (params.language && params.language !== "ALL") {
      where.language = params.language;
    }

    if (params.followUp && params.followUp !== "ALL") {
      where.requiresFollowUp = params.followUp === "YES";
    }

    const orderBy: Record<string, "asc" | "desc"> = {};
    const sortField = params.sortBy || "startTime";
    orderBy[sortField] = params.sortOrder || "desc";

    const [totalCount, rows] = await Promise.all([
      prisma.callRecord.count({ where }),
      prisma.callRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          transcriptEntries: { orderBy: { timestampMs: "asc" } },
          recordingMetadata: true,
          actions: true,
        },
      }),
    ]);

    const calls: CallRecord[] = rows.map((r) => ({
      id: r.id,
      externalCallId: r.externalCallId || undefined,
      callerNumber: r.callerNumber,
      callerName: r.callerName || undefined,
      startTime: r.startTime.toISOString(),
      endTime: r.endTime?.toISOString() || undefined,
      durationSeconds: r.durationSeconds,
      callStatus: r.callStatus as CallStatus,
      callSource: r.callSource,
      language: r.language as CallLanguage,
      intentCategory: r.intentCategory as IntentCategory,
      aiSummary: r.aiSummary,
      aiConfidence: r.aiConfidence,
      requiresFollowUp: r.requiresFollowUp,
      followUpStatus: r.followUpStatus as FollowUpStatus,
      followUpNotes: r.followUpNotes || undefined,
      isReviewed: r.isReviewed,
      reviewedBy: r.reviewedBy || undefined,
      reviewedAt: r.reviewedAt?.toISOString() || undefined,
      recordingUrl: r.recordingMetadata ? `/api/calls/${r.id}/recording` : undefined,
      transcript: r.transcriptEntries.map((t) => ({
        id: t.id,
        speaker: t.speaker as "agent" | "caller" | "ivr" | "AI_AGENT" | "CALLER" | "STAFF",
        speakerName: t.speaker === "AI_AGENT" ? "Sarvam Voice Assistant" : "Caller",
        text: t.text,
        malayalamText: t.textMalayalam || undefined,
        timestampMs: t.timestampMs,
        timestamp: `${Math.floor(t.timestampMs / 1000)}s`,
      })),
      actions: r.actions.map((a) => ({
        id: a.id,
        type: a.actionType as ActionType,
        status: a.status as "REQUESTED" | "CONFIRMED" | "FAILED" | "PENDING_VERIFICATION" | "REQUIRES_STAFF_FOLLOW_UP" | "CANCELLED",
        description: `${a.actionType} - ${a.department || ""}`,
        result: a.doctorName ? `Doctor: ${a.doctorName}` : a.status,
        timestamp: a.requestedAt.toISOString(),
      })),
    }));

    return {
      calls,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit) || 1,
      isDemoData: false,
    };
  }

  /**
   * In-memory query engine supporting identical filtering, sorting, and pagination.
   */
  private getCallsFromMemory(params: CallFilterParams): PaginatedCallsResult {
    let filtered = [...inMemoryCalls];

    const q = params.q || params.search || params.searchQuery;
    if (q?.trim()) {
      const query = q.trim().toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.id.toLowerCase().includes(query) ||
          c.callerNumber.toLowerCase().includes(query) ||
          c.callerName?.toLowerCase().includes(query) ||
          c.aiSummary.toLowerCase().includes(query)
      );
    }

    if (params.status && params.status !== "ALL") {
      filtered = filtered.filter((c) => c.callStatus === params.status);
    }

    if (params.intent && params.intent !== "ALL") {
      filtered = filtered.filter((c) => c.intentCategory === params.intent);
    }

    if (params.language && params.language !== "ALL") {
      filtered = filtered.filter((c) => c.language === params.language);
    }

    if (params.followUp && params.followUp !== "ALL") {
      filtered = filtered.filter(
        (c) => c.requiresFollowUp === (params.followUp === "YES")
      );
    }

    if (params.durationRange && params.durationRange !== "ALL") {
      filtered = filtered.filter((c) => {
        const d = c.durationSeconds;
        switch (params.durationRange) {
          case "LT_1M":
            return d < 60;
          case "1_3M":
            return d >= 60 && d <= 180;
          case "3_5M":
            return d > 180 && d <= 300;
          case "GT_5M":
            return d > 300;
          default:
            return true;
        }
      });
    }

    const sortField = params.sortBy || "startTime";
    const sortOrder = params.sortOrder || "desc";

    filtered.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];

      if (valA === undefined) return 1;
      if (valB === undefined) return -1;

      if (typeof valA === "string" && typeof valB === "string") {
        return sortOrder === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    const totalCount = filtered.length;
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 8));
    const totalPages = Math.ceil(totalCount / limit) || 1;
    const startIdx = (page - 1) * limit;
    const paginatedCalls = filtered.slice(startIdx, startIdx + limit);

    return {
      calls: paginatedCalls,
      totalCount,
      page,
      limit,
      totalPages,
      isDemoData: true,
    };
  }

  /**
   * Retrieves a single call record by ID.
   */
  async getCallById(callId: string): Promise<CallRecord | null> {
    const dbStatus = await checkDatabaseConnection();

    if (dbStatus.connected) {
      try {
        const r = await prisma.callRecord.findUnique({
          where: { id: callId },
          include: {
            transcriptEntries: { orderBy: { timestampMs: "asc" } },
            recordingMetadata: true,
            actions: true,
          },
        });

        if (r) {
          return {
            id: r.id,
            externalCallId: r.externalCallId || undefined,
            callerNumber: r.callerNumber,
            callerName: r.callerName || undefined,
            startTime: r.startTime.toISOString(),
            endTime: r.endTime?.toISOString() || undefined,
            durationSeconds: r.durationSeconds,
            callStatus: r.callStatus as CallStatus,
            callSource: r.callSource,
            language: r.language as CallLanguage,
            intentCategory: r.intentCategory as IntentCategory,
            aiSummary: r.aiSummary,
            aiConfidence: r.aiConfidence,
            requiresFollowUp: r.requiresFollowUp,
            followUpStatus: r.followUpStatus as FollowUpStatus,
            followUpNotes: r.followUpNotes || undefined,
            isReviewed: r.isReviewed,
            reviewedBy: r.reviewedBy || undefined,
            reviewedAt: r.reviewedAt?.toISOString() || undefined,
            recordingUrl: r.recordingMetadata
              ? `/api/calls/${r.id}/recording`
              : undefined,
            transcript: r.transcriptEntries.map((t) => ({
              id: t.id,
              speaker: t.speaker as "agent" | "caller" | "ivr" | "AI_AGENT" | "CALLER" | "STAFF",
              speakerName: t.speaker === "AI_AGENT" ? "Sarvam Voice Assistant" : "Caller",
              text: t.text,
              malayalamText: t.textMalayalam || undefined,
              timestampMs: t.timestampMs,
              timestamp: `${Math.floor(t.timestampMs / 1000)}s`,
            })),
            actions: r.actions.map((a) => ({
              id: a.id,
              type: a.actionType as ActionType,
              status: a.status as "REQUESTED" | "CONFIRMED" | "FAILED" | "PENDING_VERIFICATION" | "REQUIRES_STAFF_FOLLOW_UP" | "CANCELLED",
              description: `${a.actionType} - ${a.department || ""}`,
              result: a.doctorName ? `Doctor: ${a.doctorName}` : a.status,
              timestamp: a.requestedAt.toISOString(),
            })),
          };
        }
      } catch (err) {
        console.warn("DB getCallById failed; checking memory:", err);
      }
    }

    const found = inMemoryCalls.find(
      (c) => c.id === callId || c.externalCallId === callId || c.telephonySessionId === callId
    );
    return found ? { ...found } : null;
  }

  /**
   * Updates review and follow-up status on a call record.
   */
  async updateCallReview(
    callId: string,
    update: {
      isReviewed?: boolean;
      reviewerName?: string;
      reviewerId?: string;
      notes?: string;
      requiresFollowUp?: boolean;
      followUpStatus?: FollowUpStatus;
    }
  ): Promise<CallRecord | null> {
    const nowIso = new Date().toISOString();
    const dbStatus = await checkDatabaseConnection();

    if (dbStatus.connected) {
      try {
        await prisma.callRecord.update({
          where: { id: callId },
          data: {
            isReviewed: update.isReviewed,
            reviewedBy: update.reviewerName,
            reviewedAt: update.isReviewed ? new Date() : undefined,
            followUpNotes: update.notes,
            requiresFollowUp: update.requiresFollowUp,
            followUpStatus: update.followUpStatus,
          },
        });
      } catch (err) {
        console.warn("DB updateCallReview failed:", err);
      }
    }

    // Always update in-memory record so UI stays responsive and coherent
    const idx = inMemoryCalls.findIndex((c) => c.id === callId);
    if (idx === -1) return null;

    const current = inMemoryCalls[idx];
    const newReviewHistory = [...(current.reviewHistory || [])];

    if (update.notes?.trim()) {
      newReviewHistory.unshift({
        id: `rev_${callId}_${Date.now()}`,
        reviewerId: update.reviewerId || "usr_current",
        reviewerName: update.reviewerName || "Hospital Staff",
        action: "NOTE_ADDED",
        notes: update.notes.trim(),
        timestamp: nowIso,
      });
    }

    if (update.isReviewed !== undefined && update.isReviewed !== current.isReviewed) {
      newReviewHistory.unshift({
        id: `rev_${callId}_status_${Date.now()}`,
        reviewerId: update.reviewerId || "usr_current",
        reviewerName: update.reviewerName || "Hospital Staff",
        action: update.isReviewed ? "REVIEWED" : "FLAGGED",
        notes: update.isReviewed
          ? "Call marked as clinically reviewed."
          : "Review status reset to unreviewed.",
        timestamp: nowIso,
      });
    }

    const updatedCall: CallRecord = {
      ...current,
      isReviewed:
        update.isReviewed !== undefined ? update.isReviewed : current.isReviewed,
      reviewedBy: update.isReviewed ? update.reviewerName : current.reviewedBy,
      reviewedAt: update.isReviewed ? nowIso : current.reviewedAt,
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

    inMemoryCalls[idx] = updatedCall;
    return updatedCall;
  }

  /**
   * Creates or records a new call record (e.g. from Exotel outbound initiation or incoming stream).
   */
  async createCallRecord(
    call: Partial<CallRecord> & { id: string; callerNumber: string }
  ): Promise<CallRecord> {
    const now = new Date();
    const newRecord: CallRecord = {
      id: call.id,
      externalCallId: call.externalCallId,
      telephonySessionId: call.telephonySessionId || call.externalCallId,
      callerNumber: call.callerNumber,
      callerName: call.callerName || (call.direction === "OUTBOUND" ? "Outbound Patient" : "Incoming Patient"),
      patientUhid: call.patientUhid,
      startTime: call.startTime || now.toISOString(),
      endTime: call.endTime,
      durationSeconds: call.durationSeconds || 0,
      callStatus: call.callStatus || "ANSWERED",
      callSource: call.callSource || (call.direction === "OUTBOUND" ? "DIRECT_HOTLINE" : "IVR_ROLLOVER"),
      language: call.language || "MALAYALAM",
      intentCategory: call.intentCategory || (call.direction === "OUTBOUND" ? "APPOINTMENT_BOOKING" : "GENERAL_QUERY"),
      aiSummary:
        call.aiSummary ||
        (call.direction === "OUTBOUND"
          ? "Outbound consultation follow-up initiated via Exotel."
          : "Inbound hospital telephony enquiry."),
      aiConfidence: call.aiConfidence || 0.95,
      transcript: call.transcript || [],
      recordingUrl: call.recordingUrl,
      requiresFollowUp: call.requiresFollowUp || false,
      followUpStatus: call.followUpStatus || "NOT_REQUIRED",
      actions: call.actions || [],
      hospitalId: call.hospitalId || "hosp_daya_thrissur",
      provider: call.provider || "EXOTEL",
      direction: call.direction || "INBOUND",
      telephonyAccountSid: call.telephonyAccountSid,
      streamSid: call.streamSid,
      fromNumber: call.fromNumber || call.callerNumber,
      toNumber: call.toNumber,
      failureReason: call.failureReason,
      recordingSid: call.recordingSid,
      reviewHistory: [],
    };

    const dbStatus = await checkDatabaseConnection();
    if (dbStatus.connected) {
      try {
        await prisma.callRecord.upsert({
          where: { id: call.id },
          create: {
            id: newRecord.id,
            externalCallId: newRecord.externalCallId,
            telephonySessionId: newRecord.telephonySessionId,
            callerNumber: newRecord.callerNumber,
            callerName: newRecord.callerName,
            patientUhid: newRecord.patientUhid,
            startTime: new Date(newRecord.startTime),
            endTime: newRecord.endTime ? new Date(newRecord.endTime) : undefined,
            durationSeconds: newRecord.durationSeconds,
            callStatus: newRecord.callStatus,
            callSource: newRecord.callSource,
            language: newRecord.language,
            intentCategory: newRecord.intentCategory,
            aiSummary: newRecord.aiSummary,
            aiConfidence: newRecord.aiConfidence,
            requiresFollowUp: newRecord.requiresFollowUp,
            followUpStatus: newRecord.followUpStatus,
            hospitalId: newRecord.hospitalId || "hosp_daya_thrissur",
            provider: newRecord.provider || "EXOTEL",
            direction: newRecord.direction || "INBOUND",
            telephonyAccountSid: newRecord.telephonyAccountSid,
            streamSid: newRecord.streamSid,
            fromNumber: newRecord.fromNumber,
            toNumber: newRecord.toNumber,
            failureReason: newRecord.failureReason,
            recordingSid: newRecord.recordingSid,
          },
          update: {
            callStatus: newRecord.callStatus,
            durationSeconds: newRecord.durationSeconds,
            endTime: newRecord.endTime ? new Date(newRecord.endTime) : undefined,
            failureReason: newRecord.failureReason,
            recordingSid: newRecord.recordingSid,
          },
        });
      } catch (err) {
        console.warn("DB createCallRecord failed, falling back to memory:", err);
      }
    }

    const existingIdx = inMemoryCalls.findIndex((c) => c.id === call.id);
    if (existingIdx >= 0) {
      inMemoryCalls[existingIdx] = { ...inMemoryCalls[existingIdx], ...newRecord };
    } else {
      inMemoryCalls.unshift(newRecord);
    }

    return newRecord;
  }

  /**
   * Updates call status, duration, and recording by external Exotel Call SID.
   */
  async updateCallStatusByExternalId(
    externalCallId: string,
    update: {
      callStatus?: CallStatus;
      durationSeconds?: number;
      recordingUrl?: string;
      recordingSid?: string;
      failureReason?: string;
      endTime?: string;
    }
  ): Promise<CallRecord | null> {
    const idx = inMemoryCalls.findIndex(
      (c) =>
        c.externalCallId === externalCallId ||
        c.telephonySessionId === externalCallId ||
        c.id === externalCallId
    );

    // Out-of-order callback protection:
    // Do not downgrade a terminal status (ANSWERED, BUSY, MISSED, FAILED, TRANSFERRED)
    // if a delayed or out-of-order pre-connection event (e.g. RINGING) arrives.
    let resolvedStatus = update.callStatus;
    if (idx >= 0 && update.callStatus) {
      const current = inMemoryCalls[idx];
      const isTerminal =
        current.callStatus === "ANSWERED" ||
        current.callStatus === "BUSY" ||
        current.callStatus === "MISSED" ||
        current.callStatus === "FAILED" ||
        current.callStatus === "TRANSFERRED";
      if (isTerminal && (update.callStatus as string) === "RINGING") {
        resolvedStatus = current.callStatus;
      }
    }

    const dbStatus = await checkDatabaseConnection();
    if (dbStatus.connected) {
      try {
        await prisma.callRecord.updateMany({
          where: {
            OR: [
              { externalCallId },
              { telephonySessionId: externalCallId },
              { id: externalCallId },
            ],
          },
          data: {
            callStatus: resolvedStatus,
            durationSeconds: update.durationSeconds,
            endTime: update.endTime ? new Date(update.endTime) : undefined,
            failureReason: update.failureReason,
            recordingSid: update.recordingSid,
          },
        });
      } catch (err) {
        console.warn("DB updateCallStatusByExternalId failed:", err);
      }
    }

    if (idx === -1) return null;
    inMemoryCalls[idx] = {
      ...inMemoryCalls[idx],
      ...update,
      callStatus: resolvedStatus || inMemoryCalls[idx].callStatus,
      durationSeconds:
        update.durationSeconds !== undefined
          ? update.durationSeconds
          : inMemoryCalls[idx].durationSeconds,
      recordingUrl: update.recordingUrl || inMemoryCalls[idx].recordingUrl,
      endTime: update.endTime || inMemoryCalls[idx].endTime,
      failureReason: update.failureReason || inMemoryCalls[idx].failureReason,
    };
    return inMemoryCalls[idx];
  }
}

export const callsRepository = new CallsRepository();
