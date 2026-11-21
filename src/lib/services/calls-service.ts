import {
  CallRecord,
  FollowUpStatus,
} from "@/types";
import { maskPhoneNumber } from "@/lib/utils";
import {
  callsRepository,
  CallFilterParams,
  PaginatedCallsResult,
} from "@/lib/repositories/calls-repository";

export type { CallFilterParams, PaginatedCallsResult };

class CallsService {
  /**
   * Retrieves calls with server-side pagination, filters, and sorting.
   */
  async getCalls(params: CallFilterParams): Promise<PaginatedCallsResult> {
    return callsRepository.getCalls(params);
  }

  /**
   * Retrieves a single call record with transcripts, audio metadata, and actions.
   */
  async getCallById(callId: string): Promise<CallRecord | null> {
    return callsRepository.getCallById(callId);
  }

  /**
   * Updates review metadata and follow-up status on a call record.
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
    return callsRepository.updateCallReview(callId, update);
  }

  /**
   * Appends an internal review note to a call record.
   */
  async addReviewNote(
    callId: string,
    reviewerId: string,
    reviewerName: string,
    notes: string
  ): Promise<CallRecord | null> {
    return callsRepository.updateCallReview(callId, {
      reviewerId,
      reviewerName,
      notes,
    });
  }

  /**
   * Updates the triage follow-up status on a call record.
   */
  async updateFollowUpStatus(
    callId: string,
    followUpStatus: FollowUpStatus,
    reviewerId: string,
    reviewerName: string,
    notes?: string
  ): Promise<CallRecord | null> {
    const requiresFollowUp =
      followUpStatus === "PENDING" || followUpStatus === "IN_PROGRESS";

    return callsRepository.updateCallReview(callId, {
      requiresFollowUp,
      followUpStatus,
      reviewerId,
      reviewerName,
      notes,
    });
  }

  /**
   * Generates CSV export content for permitted calls.
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

  /**
   * Records a new inbound or outbound call session in the ledger.
   */
  async createCallRecord(
    call: Partial<CallRecord> & { id: string; callerNumber: string }
  ): Promise<CallRecord> {
    return callsRepository.createCallRecord(call);
  }

  /**
   * Updates an existing call session by its external provider ID (e.g. Exotel Call SID).
   */
  async updateCallStatusByExternalId(
    externalCallId: string,
    update: {
      callStatus?: CallRecord["callStatus"];
      durationSeconds?: number;
      recordingUrl?: string;
      recordingSid?: string;
      failureReason?: string;
      endTime?: string;
    }
  ): Promise<CallRecord | null> {
    return callsRepository.updateCallStatusByExternalId(externalCallId, update);
  }
}

export const callsService = new CallsService();
