import { z } from "zod";

/**
 * Validated query parameters for listing calls with server-side pagination & filters.
 */
export const callsQuerySchema = z.object({
  q: z.string().max(100).optional(),
  search: z.string().max(100).optional(),
  dateRange: z
    .enum(["ALL", "Today", "Yesterday", "Last 7 Days", "Last 30 Days"])
    .optional()
    .default("ALL"),
  status: z
    .enum(["ALL", "ANSWERED", "BUSY", "MISSED", "TRANSFERRED", "FAILED", "COMPLETED"])
    .optional()
    .default("ALL"),
  intent: z
    .enum([
      "ALL",
      "APPOINTMENT_BOOKING",
      "DOCTOR_AVAILABILITY",
      "DEPARTMENT_ENQUIRY",
      "CONSULTATION_FEES",
      "HOSPITAL_TIMINGS",
      "EMERGENCY_AMBULANCE",
      "INSURANCE_TPA",
      "GENERAL_QUERY",
    ])
    .optional()
    .default("ALL"),
  language: z
    .enum(["ALL", "MALAYALAM", "MANGLISH", "ENGLISH"])
    .optional()
    .default("ALL"),
  actionType: z
    .enum([
      "ALL",
      "CHECK_DOCTOR_SLOT",
      "BOOK_APPOINTMENT",
      "RESCHEDULE_APPOINTMENT",
      "CANCEL_APPOINTMENT",
      "TRANSFER_CALL_TO_STAFF",
      "FEE_ENQUIRY",
      "DEPARTMENT_ROUTING",
      "GENERAL_ASSISTANCE",
    ])
    .optional()
    .default("ALL"),
  followUp: z.enum(["ALL", "YES", "NO"]).optional().default("ALL"),
  durationRange: z
    .enum(["ALL", "LT_1M", "1_3M", "3_5M", "GT_5M"])
    .optional()
    .default("ALL"),
  sortBy: z
    .enum(["startTime", "durationSeconds", "callStatus", "callerNumber"])
    .optional()
    .default("startTime"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(8),
});

export type ValidatedCallsQuery = z.infer<typeof callsQuerySchema>;

/**
 * Validated payload for updating a call review or follow-up status.
 */
export const callReviewUpdateSchema = z.object({
  isReviewed: z.boolean().optional(),
  reviewerName: z.string().min(1).max(100).optional(),
  reviewerId: z.string().min(1).max(100).optional(),
  notes: z.string().max(1000).optional(),
  requiresFollowUp: z.boolean().optional(),
  followUpStatus: z
    .enum(["NOT_REQUIRED", "PENDING", "IN_PROGRESS", "RESOLVED"])
    .optional(),
});

export type ValidatedCallReviewUpdate = z.infer<typeof callReviewUpdateSchema>;

/**
 * Validated query parameters for AI actions.
 */
export const actionsQuerySchema = z.object({
  search: z.string().max(100).optional(),
  status: z
    .enum([
      "ALL",
      "REQUESTED",
      "IN_PROGRESS",
      "CONFIRMED",
      "FAILED",
      "PENDING_VERIFICATION",
      "REQUIRES_STAFF_FOLLOW_UP",
      "CANCELLED",
    ])
    .optional()
    .default("ALL"),
  actionType: z
    .enum([
      "ALL",
      "CHECK_DOCTOR_SLOT",
      "BOOK_APPOINTMENT",
      "RESCHEDULE_APPOINTMENT",
      "CANCEL_APPOINTMENT",
      "TRANSFER_CALL_TO_STAFF",
      "FEE_ENQUIRY",
      "DEPARTMENT_ROUTING",
      "GENERAL_ASSISTANCE",
    ])
    .optional()
    .default("ALL"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export type ValidatedActionsQuery = z.infer<typeof actionsQuerySchema>;

/**
 * Validated query parameters for Knowledge Base.
 */
export const knowledgeQuerySchema = z.object({
  search: z.string().max(100).optional(),
  category: z.string().optional().default("ALL"),
  status: z.enum(["ALL", "DRAFT", "UNDER_REVIEW", "PUBLISHED", "ARCHIVED"]).optional().default("ALL"),
  syncStatus: z.enum(["ALL", "SYNCED", "NOT_SYNCED"]).optional().default("ALL"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ValidatedKnowledgeQuery = z.infer<typeof knowledgeQuerySchema>;

/**
 * Validated query parameters for Overview metrics.
 */
export const metricsQuerySchema = z.object({
  dateRange: z
    .enum(["Today", "Yesterday", "Last 7 Days", "Last 30 Days"])
    .default("Today"),
  timezone: z.string().default("Asia/Kolkata"),
});

export type ValidatedMetricsQuery = z.infer<typeof metricsQuerySchema>;
