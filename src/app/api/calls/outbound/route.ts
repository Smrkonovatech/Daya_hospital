import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifySessionToken, AUTH_COOKIE_NAME } from "@/lib/auth/session";
import { exotelAdapter } from "@/lib/integrations";
import { callsService } from "@/lib/services/calls-service";
import { getHospitalConfig } from "@/lib/config/hospital-config";
import { maskPhoneNumber } from "@/lib/utils";
import { systemRepository } from "@/lib/repositories/system-repository";

const outboundCallSchema = z.object({
  toNumber: z
    .string()
    .min(10, "Phone number must have at least 10 digits")
    .regex(/^(\+91|0)?[6-9]\d{9}$/, "Invalid Indian mobile number format"),
  patientName: z.string().optional().default("Valued Patient"),
  hospitalId: z.string().optional(),
  purpose: z
    .enum([
      "APPOINTMENT_REMINDER",
      "DOCTOR_RESCHEDULE_NOTICE",
      "POST_OP_FOLLOW_UP",
      "LAB_REPORT_READY",
      "GENERAL_TELEPHONY_TEST",
    ])
    .optional()
    .default("APPOINTMENT_REMINDER"),
  doctorName: z.string().optional(),
  scheduledSlot: z.string().optional(),
  customField: z.string().optional(),
});

export async function POST(request: NextRequest) {
  // 1. Authenticate user session
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  if (!session) {
    return NextResponse.json(
      { success: false, error: "Unauthorized: Active session required to initiate outbound calls" },
      { status: 401 }
    );
  }

  // 2. Validate request payload
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON request body" },
      { status: 400 }
    );
  }

  const parseResult = outboundCallSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Validation failed",
        details: parseResult.error.flatten().fieldErrors,
      },
      { status: 422 }
    );
  }

  const { toNumber, patientName, hospitalId, purpose, doctorName, scheduledSlot, customField } =
    parseResult.data;

  // 3. Resolve hospital tenant
  const hospital = getHospitalConfig(hospitalId);
  const callerExoPhone = hospital.telephony.exotel?.defaultExoPhone || hospital.telephony.incomingHospitalNumber;
  const appId = hospital.telephony.exotel?.defaultAppId || "app_daya_voicebot_v1";

  // 4. Format numbers for Exotel
  const cleanNumber = toNumber.replace(/\D/g, "").slice(-10);
  const formattedTo = `0${cleanNumber}`;
  const customMetadata = customField || `${hospital.hospitalId}:${purpose}:${Date.now()}`;

  // 5. Initiate call via Exotel adapter
  const exotelRes = await exotelAdapter.initiateOutboundCall({
    from: formattedTo,
    to: callerExoPhone,
    callerId: callerExoPhone,
    url: `http://my.exotel.com/${hospital.telephony.exotel?.accountSid || "exotel_account"}/exoml/start_voice/${appId}`,
    customField: customMetadata,
    statusCallback: hospital.telephony.exotel?.statusCallbackUrl,
    statusCallbackEvents: ["terminal", "answered", "in-progress"],
  });

  if (!exotelRes.success) {
    return NextResponse.json(
      {
        success: false,
        error: exotelRes.error || "Failed to initiate outbound call with Exotel",
      },
      { status: 502 }
    );
  }

  // 6. Record call in ledger
  const callId = `call_out_${Date.now()}`;
  const newRecord = await callsService.createCallRecord({
    id: callId,
    externalCallId: exotelRes.callSid,
    telephonySessionId: exotelRes.callSid,
    callerNumber: maskPhoneNumber(`+91${cleanNumber}`),
    callerName: patientName,
    startTime: new Date().toISOString(),
    durationSeconds: 0,
    callStatus: "ANSWERED",
    callSource: "DIRECT_HOTLINE",
    language: "MALAYALAM",
    intentCategory: "APPOINTMENT_BOOKING",
    aiSummary: `Outbound call to ${patientName} regarding ${purpose.replace(/_/g, " ")}. Exotel Call SID: ${exotelRes.callSid}.`,
    aiConfidence: 0.96,
    requiresFollowUp: false,
    followUpStatus: "NOT_REQUIRED",
    hospitalId: hospital.hospitalId,
    provider: "EXOTEL",
    direction: "OUTBOUND",
    fromNumber: callerExoPhone,
    toNumber: `+91${cleanNumber}`,
    telephonyAccountSid: exotelRes.accountSid,
    actions: doctorName
      ? [
          {
            id: `act_${Date.now()}`,
            type: "CHECK_DOCTOR_SLOT",
            status: "CONFIRMED",
            description: `Automated reminder for Dr. ${doctorName} slot ${scheduledSlot || "OPD"}`,
            timestamp: new Date().toISOString(),
          },
        ]
      : [],
    transcript: [
      {
        id: `tr_${Date.now()}_1`,
        speaker: "AI_AGENT",
        speakerName: "Smrko Voice Assistant",
        text: `നമസ്കാരം ${patientName}, ദയാ ജനറൽ ഹോസ്പിറ്റലിൽ നിന്നാണ് വിളിക്കുന്നത്.`,
        timestampMs: 1000,
        timestamp: "00:01",
      },
    ],
  });

  // 7. Audit log entry
  await systemRepository.recordAuditLog({
    entityType: "CALL",
    entityId: callId,
    action: "OUTBOUND_CALL_INITIATED",
    performedBy: session.name,
    userId: session.userId,
    details: `Initiated outbound call to ${maskPhoneNumber(`+91${cleanNumber}`)} via Exotel (SID: ${exotelRes.callSid})`,
  });

  return NextResponse.json({
    success: true,
    message: "Outbound call initiated successfully via Exotel",
    callId: newRecord.id,
    callSid: exotelRes.callSid,
    accountSid: exotelRes.accountSid,
    status: exotelRes.status,
    direction: "OUTBOUND",
    hospitalId: hospital.hospitalId,
    timestamp: new Date().toISOString(),
  });
}

