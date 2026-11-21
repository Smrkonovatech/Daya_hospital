/**
 * ============================================================================
 * STANDARD REUSABLE TELEPHONY INTERFACE & CALL EVENT TYPES
 * ============================================================================
 *
 * Provider-independent contract for hospital telephony integrations (BitVoice,
 * Exotel, Knowlarity, MyOperator, Airtel IQ, SIP trunk).
 */

export type CallDirection = "INBOUND" | "OUTBOUND";

export type TelephonyCallState =
  | "RINGING"
  | "OFFERED_TO_AGENT"
  | "FORWARDED_TO_AI"
  | "AI_CONNECTED"
  | "TRANSFERRED_TO_STAFF"
  | "COMPLETED"
  | "MISSED"
  | "FAILED"
  | "BUSY"
  | "NO_ANSWER";

export interface InboundCallEvent {
  event_id: string;
  call_id: string;
  hospital_id: string;
  called_number: string;
  caller_number: string;
  timestamp: string;
  channel_number?: number;
  initial_intent?: string;
  ivr_digits?: string;
  hop_count: number;
  direction?: CallDirection;
  provider?: string;
  rawPayload?: Record<string, unknown>;
}

export interface CallStatusUpdateEvent {
  event_id: string;
  call_id: string;
  hospital_id: string;
  state: TelephonyCallState;
  duration_seconds?: number;
  recording_url?: string;
  recording_sid?: string;
  transfer_destination?: string;
  failure_reason?: string;
  direction?: CallDirection;
  from_number?: string;
  to_number?: string;
  timestamp: string;
  rawPayload?: Record<string, unknown>;
}

export interface CallRoutingDecision {
  action: "FORWARD_TO_AI" | "ROUTE_TO_STAFF" | "ROUTE_TO_CASUALTY" | "REJECT_LOOP";
  destination_id: string;
  reason: string;
  hop_count: number;
}

export interface TelephonyTrunkStatus {
  totalChannels: number;
  activeChannels: number;
  availableChannels: number;
  trunkHealth: "HEALTHY" | "DEGRADED" | "DOWN";
  provider: string;
  statusDetails: string;
}

export interface TelephonyForwardResult {
  forwarded: boolean;
  routingSessionId: string;
  sessionUrl: string;
  hopCount: number;
  rolloverReason: "APPOINTMENT_ROUTED" | "ALL_AGENTS_BUSY" | "RING_TIMEOUT_20S" | "OFF_HOURS";
}

export interface TelephonyTransferResult {
  success: boolean;
  destinationExtension: string;
  department: string;
  hopCount: number;
  error?: string;
}

/**
 * Standard parameters for initiating programmable outbound phone calls
 * via telephony providers (e.g., Exotel connect API).
 */
export interface OutboundCallRequest {
  from: string; // Patient destination or agent
  to: string; // Exotel virtual number / Voicebot flow
  callerId?: string; // Hospital ExoPhone
  url?: string; // Applet Flow URL (e.g., start_voice/<appId>)
  customField?: string; // Tenant/session correlation metadata
  statusCallback?: string;
  statusCallbackEvents?: string[];
  record?: boolean;
  timeLimit?: number; // max seconds
  timeOut?: number; // ring timeout in seconds
}

export interface OutboundCallResponse {
  success: boolean;
  callSid: string;
  accountSid: string;
  status: string;
  direction: string;
  from: string;
  to: string;
  dateCreated: string;
  phoneNumberSid?: string;
  uri?: string;
  error?: string;
  rawResponse?: Record<string, unknown>;
}

export interface ExotelCallDetails {
  callSid: string;
  parentCallSid?: string;
  accountSid: string;
  from: string;
  to: string;
  phoneNumberSid?: string;
  status: TelephonyCallState;
  startTime?: string;
  endTime?: string;
  durationSeconds?: number;
  recordingUrl?: string;
  recordingSid?: string;
  direction: CallDirection;
  price?: string;
  rawStatus: string;
  customField?: string;
  answeredBy?: string;
}

export interface ExotelAccountDetails {
  accountSid: string;
  friendlyName: string;
  type: string; // "Trial" | "Full"
  status: string; // "active" | "suspended"
  billingType: string; // "prepaid" | "postpaid"
  dateCreated: string;
  dateUpdated: string;
  kycStatus?: string;
}

export interface ExotelRestError {
  status: number;
  message: string;
  code?: number;
  category:
    | "RATE_LIMITED"
    | "AUTHENTICATION_FAILED"
    | "INVALID_NUMBER"
    | "INSUFFICIENT_CREDITS"
    | "FLOW_NOT_FOUND"
    | "NETWORK_ERROR"
    | "GENERAL_ERROR";
}

export interface ITelephonyConnector {
  healthCheck(): Promise<{
    status: "HEALTHY" | "DEGRADED" | "DOWN";
    latencyMs: number;
    mode: "PRODUCTION" | "PENDING_CONFIRMATION" | "MOCK_SANDBOX";
    details: string;
  }>;
  getTrunkStatus(): Promise<TelephonyTrunkStatus>;
  evaluateCallRouting(event: InboundCallEvent): CallRoutingDecision;
  forwardToAiQueue(callId: string, currentHops?: number): Promise<TelephonyForwardResult>;
  transferToHumanAgent(
    callId: string,
    departmentExt: string,
    currentHops?: number
  ): Promise<TelephonyTransferResult>;
  verifyWebhookSignature(rawBody: string, signature: string): boolean;
  parseWebhookPayload(rawPayload: unknown): InboundCallEvent | CallStatusUpdateEvent | null;

  // Optional extended capabilities for outbound calling & Exotel API
  initiateOutboundCall?(request: OutboundCallRequest): Promise<OutboundCallResponse>;
  getCallDetails?(callSid: string): Promise<ExotelCallDetails | null>;
  terminateCall?(callSid: string): Promise<{ success: boolean; error?: string }>;
  getCallRecording?(callSid: string): Promise<{ recordingUrl?: string; recordingSid?: string; durationSeconds?: number } | null>;
}
