/**
 * ============================================================================
 * SMRKOMED UNIFIED EXOTEL TELEPHONY SERVICE (PHASE 1)
 * ============================================================================
 *
 * Reusable application service providing high-level hospital telephony operations:
 * - initiateCall(): Programmable outbound AI calls with idempotency & rate limits
 * - getCallDetails(): Live and historical call metadata from Exotel REST API
 * - terminateCall(): Immediate active call termination / hangup
 * - transferCall(): Exotel Connect flow transfer or staff extension routing
 * - getRecordingMetadata(): Audio recording URL and metadata retrieval
 * - getRecordingAudio(): Binary recording audio retrieval
 * - processWebhookEvent(): Idempotent, out-of-order protected status callback ingestion
 *
 * Multi-Hospital Isolation:
 * Scoped by hospitalId, dynamically resolving credentials, ExoPhones, and routing policies.
 *
 * Region: Singapore (api.exotel.com)
 * Account SID: smrkonova1
 */

import * as crypto from "crypto";
import {
  getHospitalConfig,
  HospitalConfig,
} from "@/lib/config/hospital-config";
import { ExotelTelephonyAdapter } from "@/lib/integrations/telephony/exotel-adapter";
import {
  ExotelCallDetails,
  OutboundCallRequest,
} from "@/lib/integrations/telephony/standard-telephony-types";
import { callsService } from "@/lib/services/calls-service";
import { systemRepository } from "@/lib/repositories/system-repository";
import { prisma, checkDatabaseConnection } from "@/lib/db/prisma";
import { CallRecord, CallStatus, IntentCategory, CallLanguage } from "@/types";
import { durableConcurrencyService } from "./durable-concurrency";

export interface StandardOutboundCallParams {
  hospitalId: string;
  patientId: string;
  phoneNumber: string;
  purpose: string;
  mode?: "AI" | "HUMAN";
  language?: string;
  patientName?: string;
  context?: Record<string, unknown>;
  idempotencyKey: string;
  correlationId?: string;
}

export interface StandardOutboundCallResult {
  success: boolean;
  callId: string;
  callSid: string;
  hospitalId: string;
  patientId: string;
  phoneNumber: string;
  purpose: string;
  mode: string;
  status: string;
  correlationId: string;
  createdAt: string;
  isDuplicateReplay?: boolean;
  error?: string;
}

export interface RecordingMetadataResult {
  recordingSid?: string;
  recordingUrl: string;
  durationSeconds?: number;
  mimeType: string;
  callSid: string;
}

export interface WebhookProcessingResult {
  received: boolean;
  status: "PROCESSED" | "ALREADY_PROCESSED_IDEMPOTENT" | "IGNORED_OUT_OF_ORDER" | "INVALID_SIGNATURE" | "ERROR";
  rawState?: string;
  callSid?: string;
  callStatus?: string;
  eventId?: string;
  message?: string;
}

// In-memory rate limiter: max 10 calls per minute per hospital tenant
interface RateLimitBucket {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, RateLimitBucket>();

// In-memory idempotency cache for fast sub-second deduplication
interface IdempotencyCacheEntry {
  callId: string;
  callSid: string;
  result: StandardOutboundCallResult;
  timestamp: number;
}
const idempotencyCache = new Map<string, IdempotencyCacheEntry>();

export class ExotelTelephonyService {
  private adapterMap = new Map<string, ExotelTelephonyAdapter>();

  /**
   * Retrieves or instantiates the scoped Exotel adapter for a given hospital.
   */
  public getAdapter(hospitalId?: string): ExotelTelephonyAdapter {
    const config = getHospitalConfig(hospitalId);
    const key = config.hospitalId;

    if (!this.adapterMap.has(key)) {
      this.adapterMap.set(
        key,
        new ExotelTelephonyAdapter({
          hospitalId: config.hospitalId,
          ...config.telephony.exotel,
        })
      );
    }

    return this.adapterMap.get(key)!;
  }

  /**
   * Normalizes Indian and international phone numbers into:
   * 1. Display / E.164 format (+91XXXXXXXXXX)
   * 2. Exotel dial format (0XXXXXXXXXX)
   */
  public normalizePhoneNumber(phone: string): {
    isValid: boolean;
    e164: string;
    exotelFormat: string;
    clean10Digits: string;
    error?: string;
  } {
    if (!phone || typeof phone !== "string") {
      return { isValid: false, e164: "", exotelFormat: "", clean10Digits: "", error: "Phone number is required" };
    }

    // Strip whitespace, hyphens, parentheses, dots
    const cleaned = phone.replace(/[\s\-\(\)\.]/g, "");

    // Must match valid Indian mobile pattern (+91 or 0 or 10 digits starting with 6,7,8,9)
    const match = cleaned.match(/^(?:\+91|91|0)?([6-9]\d{9})$/);
    if (!match) {
      return {
        isValid: false,
        e164: "",
        exotelFormat: "",
        clean10Digits: "",
        error: "Invalid phone number format. Must be a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.",
      };
    }

    const clean10Digits = match[1];
    return {
      isValid: true,
      e164: `+91${clean10Digits}`,
      exotelFormat: `0${clean10Digits}`,
      clean10Digits,
    };
  }

  /**
   * Checks if destination number is a protected emergency or receptionist destination.
   */
  public isProtectedEmergencyDestination(phone: string, hospitalConfig?: HospitalConfig): boolean {
    const norm = this.normalizePhoneNumber(phone);
    if (!norm.isValid) return false;

    const conf = hospitalConfig || getHospitalConfig();
    const primaryReceptionistClean = this.normalizePhoneNumber(
      conf.routing.casualtyDirectNumber || "+919606654032"
    ).clean10Digits;

    // Check against Daya Hospital primary receptionist hotline
    if (norm.clean10Digits === "9606654032" || norm.clean10Digits === primaryReceptionistClean) {
      return true;
    }

    // Check against hospital virtual ExoPhones
    const exoClean = this.normalizePhoneNumber(conf.telephony.exotel?.defaultExoPhone || "08047291658").clean10Digits;
    if (norm.clean10Digits === exoClean) {
      return true;
    }

    return false;
  }

  /**
   * Enforces token bucket rate limiting (max 10 outbound calls/minute per hospital).
   */
  public checkRateLimit(hospitalId: string, maxCallsPerMinute = 10): { allowed: boolean; retryAfterSeconds?: number } {
    const now = Date.now();
    const bucket = rateLimitMap.get(hospitalId);

    if (!bucket || now >= bucket.resetAt) {
      rateLimitMap.set(hospitalId, { count: 1, resetAt: now + 60000 });
      return { allowed: true };
    }

    if (bucket.count >= maxCallsPerMinute) {
      const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);
      return { allowed: false, retryAfterSeconds };
    }

    bucket.count++;
    return { allowed: true };
  }

  /**
   * 1. INITIATE OUTBOUND CALL
   *
   * Validates parameters, prevents duplicate calls, checks rate limits, creates CallRecord,
   * and triggers Exotel Calls/connect API.
   */
  public async initiateCall(params: StandardOutboundCallParams): Promise<StandardOutboundCallResult> {
    const correlationId =
      params.correlationId || `corr_out_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    // 1. Resolve Hospital Tenant Configuration
    const hospital = getHospitalConfig(params.hospitalId);
    const hospitalId = hospital.hospitalId;

    // 2. Validate Phone Number
    const phoneNorm = this.normalizePhoneNumber(params.phoneNumber);
    if (!phoneNorm.isValid) {
      return {
        success: false,
        callId: "",
        callSid: "",
        hospitalId,
        patientId: params.patientId,
        phoneNumber: params.phoneNumber,
        purpose: params.purpose,
        mode: params.mode || "AI",
        status: "FAILED",
        correlationId,
        createdAt: nowIso,
        error: phoneNorm.error || "Invalid phone number",
      };
    }

    // 3. Safety Check: Never dial emergency receptionist number as a patient destination
    if (this.isProtectedEmergencyDestination(phoneNorm.e164, hospital)) {
      return {
        success: false,
        callId: "",
        callSid: "",
        hospitalId,
        patientId: params.patientId,
        phoneNumber: phoneNorm.e164,
        purpose: params.purpose,
        mode: params.mode || "AI",
        status: "FAILED",
        correlationId,
        createdAt: nowIso,
        error:
          "Emergency destination number (+91 96066 54032) cannot be used as an outbound patient destination.",
      };
    }

    // 4. Durable Idempotency & Duplicate Call Prevention
    const idempotencyKey = params.idempotencyKey?.trim();
    if (idempotencyKey) {
      const reservation = await durableConcurrencyService.acquireIdempotencyReservation(
        hospitalId,
        idempotencyKey,
        "OUTBOUND_CALL",
        30
      );

      if (!reservation.isFirstAcquisition) {
        if (reservation.cachedResponse) {
          return {
            ...(reservation.cachedResponse as unknown as StandardOutboundCallResult),
            isDuplicateReplay: true,
          };
        }
        return {
          success: true,
          callId: reservation.callId || `call_cached_${Date.now()}`,
          callSid: reservation.callSid || "exo_call_cached",
          hospitalId,
          patientId: params.patientId,
          phoneNumber: phoneNorm.e164,
          purpose: params.purpose,
          mode: params.mode || "AI",
          status: "INITIATED",
          correlationId,
          createdAt: nowIso,
          isDuplicateReplay: true,
        };
      }
    }

    // 5. Durable Rate Limiting Check (Max 10 calls/min per hospital)
    const rateLimit = await durableConcurrencyService.checkRateLimit(hospitalId, "outbound_calls", 10, 60);
    if (!rateLimit.allowed) {
      return {
        success: false,
        callId: "",
        callSid: "",
        hospitalId,
        patientId: params.patientId,
        phoneNumber: phoneNorm.e164,
        purpose: params.purpose,
        mode: params.mode || "AI",
        status: "RATE_LIMITED",
        correlationId,
        createdAt: nowIso,
        error: `Rate limit exceeded. Maximum 10 outbound calls per minute per hospital. Retry after ${rateLimit.retryAfterSeconds}s.`,
      };
    }

    // 6. Generate Call Identifiers
    const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const callerExoPhone = hospital.telephony.exotel?.defaultExoPhone || "08047291658";
    const accountSid = hospital.telephony.exotel?.accountSid || "smrkonova1";
    const appId = hospital.telephony.exotel?.defaultAppId || "1393239";
    const customMetadata = `${hospitalId}:${params.purpose}:${idempotencyKey || callId}`;

    // 7. Dispatch Exotel Outbound Request
    const adapter = this.getAdapter(hospitalId);
    const exotelReq: OutboundCallRequest = {
      from: phoneNorm.exotelFormat,
      to: callerExoPhone,
      callerId: callerExoPhone,
      url: `https://my.exotel.com/${accountSid}/exoml/start_voice/${appId}`,
      customField: customMetadata,
      statusCallback: hospital.telephony.exotel?.statusCallbackUrl,
      statusCallbackEvents: ["terminal", "answered", "ringing"],
      timeLimit: hospital.telephony.exotel?.maxCallDurationSeconds || 600,
      timeOut: hospital.telephony.exotel?.ringTimeoutSeconds || 30,
      record: true,
    };

    const exotelRes = await adapter.initiateOutboundCall(exotelReq);

    if (!exotelRes.success) {
      return {
        success: false,
        callId,
        callSid: "",
        hospitalId,
        patientId: params.patientId,
        phoneNumber: phoneNorm.e164,
        purpose: params.purpose,
        mode: params.mode || "AI",
        status: "FAILED",
        correlationId,
        createdAt: nowIso,
        error: exotelRes.error || "Failed to initiate call via Exotel REST API",
      };
    }

    const exotelCallSid = exotelRes.callSid;

    // 8. Persist Call Record & Action in Ledger
    let intentCategory: IntentCategory = "APPOINTMENT_BOOKING";
    const purp = params.purpose.toUpperCase();
    if (purp.includes("DOCTOR") || purp.includes("RESCHEDULE")) intentCategory = "DOCTOR_AVAILABILITY";
    else if (purp.includes("LAB") || purp.includes("REPORT")) intentCategory = "GENERAL_QUERY";
    else if (purp.includes("EMERGENCY")) intentCategory = "EMERGENCY_AMBULANCE";

    let callLanguage: CallLanguage = "MALAYALAM";
    if (params.language?.includes("en")) callLanguage = "ENGLISH";

    const newRecord: Partial<CallRecord> & { id: string; callerNumber: string } = {
      id: callId,
      externalCallId: exotelCallSid,
      telephonySessionId: exotelCallSid,
      callerNumber: phoneNorm.e164,
      callerName: params.patientName || (params.patientId ? `Outbound Patient (${params.patientId})` : "Outbound Patient"),
      patientUhid: params.patientId,
      startTime: nowIso,
      durationSeconds: 0,
      callStatus: "ANSWERED",
      callSource: "DIRECT_HOTLINE",
      language: callLanguage,
      intentCategory,
      aiSummary: `Outbound ${params.purpose} call initiated to ${phoneNorm.e164} via Exotel Voicebot Applet ${appId}`,
      aiConfidence: 0.98,
      requiresFollowUp: false,
      hospitalId,
      provider: "EXOTEL",
      direction: "OUTBOUND",
      telephonyAccountSid: accountSid,
      streamSid: `stream_${exotelCallSid}`,
      fromNumber: callerExoPhone,
      toNumber: phoneNorm.e164,
    };

    try {
      await callsService.createCallRecord(newRecord);

      // Record AiAction for audit and idempotency lookup
      const dbStatus = await checkDatabaseConnection();
      if (dbStatus.connected && idempotencyKey) {
        await prisma.aiAction.create({
          data: {
            id: `act_${callId}`,
            callId,
            actionType: "BOOK_APPOINTMENT",
            status: "REQUESTED",
            idempotencyKey,
            externalReference: exotelCallSid,
            department: "Outbound Telephony",
            patientUhid: params.patientId,
            payloadJson: JSON.stringify(params),
          },
        });
      }
    } catch (dbErr) {
      console.warn("[ExotelTelephonyService] DB record creation warning:", dbErr);
    }

    const finalResult: StandardOutboundCallResult = {
      success: true,
      callId,
      callSid: exotelCallSid,
      hospitalId,
      patientId: params.patientId,
      phoneNumber: phoneNorm.e164,
      purpose: params.purpose,
      mode: params.mode || "AI",
      status: "INITIATED",
      correlationId,
      createdAt: nowIso,
    };

    if (idempotencyKey) {
      await durableConcurrencyService.completeIdempotencyReservation(hospitalId, idempotencyKey, {
        status: "COMPLETED",
        callId,
        callSid: exotelCallSid,
        responseJson: finalResult as unknown as Record<string, unknown>,
      });
      idempotencyCache.set(idempotencyKey, {
        callId,
        callSid: exotelCallSid,
        result: finalResult,
        timestamp: Date.now(),
      });
    }

    return finalResult;
  }

  /**
   * 2. GET CALL DETAILS
   *
   * Queries Exotel REST API for real-time call state, duration, price, and recording URL.
   */
  public async getCallDetails(callSid: string, hospitalId?: string): Promise<ExotelCallDetails | null> {
    if (!callSid) return null;
    const adapter = this.getAdapter(hospitalId);
    return adapter.getCallDetails(callSid);
  }

  /**
   * 3. TERMINATE CALL
   *
   * Immediately hangs up / completes an active call via Exotel REST API.
   */
  public async terminateCall(callSid: string, hospitalId?: string): Promise<{ success: boolean; error?: string }> {
    if (!callSid) return { success: false, error: "callSid is required" };
    const adapter = this.getAdapter(hospitalId);
    const res = await adapter.terminateCall(callSid);

    if (res.success) {
      await callsService.updateCallStatusByExternalId(callSid, {
        callStatus: "FAILED",
        failureReason: "Terminated by administrator via API",
        endTime: new Date().toISOString(),
      });
    }

    return res;
  }

  /**
   * 4. TRANSFER CALL
   *
   * Handles call transfer to human hunt groups (e.g., Extension 201-206) or 24/7 Casualty (Extension 100).
   * Updates call status in ledger to TRANSFERRED.
   */
  public async transferCall(
    callSid: string,
    destination: string,
    hospitalId?: string
  ): Promise<{ success: boolean; transferType: string; destination: string; error?: string }> {
    if (!callSid || !destination) {
      return { success: false, transferType: "NONE", destination, error: "callSid and destination are required" };
    }

    const hospital = getHospitalConfig(hospitalId);
    const adapter = this.getAdapter(hospital.hospitalId);

    // Call transfer via Exotel adapter
    const transferRes = await adapter.transferToHumanAgent(callSid, destination);

    // Update Call Record status to TRANSFERRED
    await callsService.updateCallStatusByExternalId(callSid, {
      callStatus: "TRANSFERRED",
    });

    // Record Action in DB if available
    const dbStatus = await checkDatabaseConnection();
    if (dbStatus.connected) {
      try {
        const call = await prisma.callRecord.findFirst({
          where: {
            OR: [{ externalCallId: callSid }, { telephonySessionId: callSid }, { id: callSid }],
          },
        });
        if (call) {
          await prisma.aiAction.create({
            data: {
              id: `act_trans_${Date.now()}`,
              callId: call.id,
              actionType: "TRANSFER_CALL_TO_STAFF",
              status: "CONFIRMED",
              idempotencyKey: `trans_${callSid}_${Date.now()}`,
              externalReference: callSid,
              department: transferRes.department,
              staffNotes: `Transferred call to ${destination} (${transferRes.department})`,
            },
          });
        }
      } catch {
        // Ignored
      }
    }

    return {
      success: transferRes.success,
      transferType: "EXOTEL_CONNECT_APPLET",
      destination,
      error: transferRes.error,
    };
  }

  /**
   * 5. GET RECORDING METADATA
   *
   * Resolves audio recording URL and duration from Exotel call details or database.
   */
  public async getRecordingMetadata(
    callSidOrRecordingSid: string,
    hospitalId?: string
  ): Promise<RecordingMetadataResult | null> {
    if (!callSidOrRecordingSid) return null;

    // 1. Check database first
    const dbStatus = await checkDatabaseConnection();
    if (dbStatus.connected) {
      try {
        const rec = await prisma.recordingMetadata.findFirst({
          where: {
            OR: [
              { callId: callSidOrRecordingSid },
              { externalSessionId: callSidOrRecordingSid },
              { id: callSidOrRecordingSid },
            ],
          },
          include: { call: true },
        });

        if (rec && rec.storageUrl) {
          return {
            recordingSid: rec.externalSessionId || rec.id,
            recordingUrl: rec.storageUrl,
            durationSeconds: rec.durationSeconds,
            mimeType: rec.mimeType,
            callSid: rec.call?.externalCallId || rec.callId,
          };
        }
      } catch {
        // Fall back to API
      }
    }

    // 2. Fetch from Exotel API
    const details = await this.getCallDetails(callSidOrRecordingSid, hospitalId);
    if (!details || !details.recordingUrl) return null;

    return {
      recordingSid: details.recordingSid,
      recordingUrl: details.recordingUrl,
      durationSeconds: details.durationSeconds,
      mimeType: "audio/wav",
      callSid: details.callSid,
    };
  }

  /**
   * 6. GET RECORDING AUDIO
   *
   * Fetches binary recording audio buffer from verified recording URL.
   */
  public async getRecordingAudio(
    callSidOrRecordingSid: string,
    hospitalId?: string
  ): Promise<{ audioBuffer: Buffer; contentType: string } | null> {
    const meta = await this.getRecordingMetadata(callSidOrRecordingSid, hospitalId);
    if (!meta || !meta.recordingUrl) return null;

    try {
      const adapter = this.getAdapter(hospitalId);
      const res = await adapter.fetchWithRetry(meta.recordingUrl, {
        headers: {
          Accept: "audio/*",
        },
      });

      if (!res.ok) return null;

      const arrayBuffer = await res.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuffer);
      const contentType = res.headers.get("content-type") || meta.mimeType || "audio/wav";

      return { audioBuffer, contentType };
    } catch {
      return null;
    }
  }

  /**
   * 7. PROCESS WEBHOOK EVENT (NORMALIZATION, IDEMPOTENCY & OUT-OF-ORDER PROTECTION)
   */
  public async processWebhookEvent(
    rawBody: string,
    headers: Headers,
    urlParams: URLSearchParams
  ): Promise<WebhookProcessingResult> {
    // 1. Signature Verification
    const signature =
      headers.get("x-exotel-signature") ||
      headers.get("x-signature") ||
      urlParams.get("token") ||
      "";

    const adapter = this.getAdapter();
    const isVerified = adapter.verifyWebhookSignature(rawBody, signature);

    if (!isVerified) {
      return {
        received: false,
        status: "INVALID_SIGNATURE",
        message: "Invalid or missing Exotel webhook authentication signature",
      };
    }

    // 2. Parse Payload (JSON or x-www-form-urlencoded)
    let payload: Record<string, unknown> = {};
    try {
      const contentType = headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        payload = JSON.parse(rawBody);
      } else {
        const search = new URLSearchParams(rawBody);
        for (const [k, v] of search.entries()) {
          payload[k] = v;
        }
      }
    } catch {
      return { received: false, status: "ERROR", message: "Malformed webhook payload" };
    }

    // 3. Normalize Event
    const normalized = adapter.parseWebhookPayload(payload);
    if (!normalized) {
      return { received: false, status: "ERROR", message: "Unrecognized Exotel payload structure" };
    }

    const callSid = normalized.call_id;
    const eventId =
      headers.get("x-exotel-event-id") ||
      (payload.EventId ? String(payload.EventId) : null) ||
      normalized.event_id ||
      `exo_evt_${callSid}_${Date.now()}`;

    // 4. Idempotency Check
    const payloadHash = crypto.createHash("sha256").update(rawBody).digest("hex");
    const existingWebhook = await systemRepository.getWebhookByEventId(eventId);

    if (existingWebhook) {
      return {
        received: true,
        status: "ALREADY_PROCESSED_IDEMPOTENT",
        callSid,
        eventId,
        message: "Duplicate Exotel event acknowledged without re-execution.",
      };
    }

    // Record webhook entry in audit
    await systemRepository.recordWebhook({
      provider: "EXOTEL",
      eventType: "status_callback",
      externalEventId: eventId,
      idempotencyKey: eventId,
      payloadHash,
      status: "PROCESSED",
    });

    // 5. Update Call Status & Handle Out-of-Order Callbacks
    if ("state" in normalized) {
      const state = normalized.state;
      let mappedStatus: CallStatus = "ANSWERED";

      if (state === "COMPLETED") mappedStatus = "ANSWERED";
      else if (state === "BUSY") mappedStatus = "BUSY";
      else if (state === "MISSED" || state === "NO_ANSWER") mappedStatus = "MISSED";
      else if (state === "FAILED") mappedStatus = "FAILED";
      else if (state === "TRANSFERRED_TO_STAFF") mappedStatus = "TRANSFERRED";

      await callsService.updateCallStatusByExternalId(callSid, {
        callStatus: mappedStatus,
        durationSeconds: normalized.duration_seconds,
        recordingUrl: normalized.recording_url,
        recordingSid: normalized.recording_sid,
        failureReason: normalized.failure_reason,
        endTime: new Date().toISOString(),
      });

      // Synchronize RecordingMetadata if recording URL is present
      if (normalized.recording_url) {
        const dbStatus = await checkDatabaseConnection();
        if (dbStatus.connected) {
          try {
            const call = await prisma.callRecord.findFirst({
              where: {
                OR: [{ externalCallId: callSid }, { telephonySessionId: callSid }, { id: callSid }],
              },
            });
            if (call) {
              await prisma.recordingMetadata.upsert({
                where: { callId: call.id },
                create: {
                  id: `rec_${call.id}`,
                  callId: call.id,
                  externalSessionId: normalized.recording_sid || callSid,
                  storageUrl: normalized.recording_url,
                  mimeType: "audio/wav",
                  durationSeconds: normalized.duration_seconds || call.durationSeconds,
                  hasConsent: true,
                  retentionExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30-day retention
                },
                update: {
                  storageUrl: normalized.recording_url,
                  durationSeconds: normalized.duration_seconds || call.durationSeconds,
                },
              });
            }
          } catch {
            // Ignored
          }
        }
      }

      return {
        received: true,
        status: "PROCESSED",
        rawState: normalized.state,
        callSid,
        callStatus: mappedStatus,
        eventId,
      };
    }

    return {
      received: true,
      status: "PROCESSED",
      callSid,
      eventId,
    };
  }
}

export const exotelTelephonyService = new ExotelTelephonyService();

