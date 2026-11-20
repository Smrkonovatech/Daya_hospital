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
  | "FAILED";

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
}

export interface CallStatusUpdateEvent {
  event_id: string;
  call_id: string;
  hospital_id: string;
  state: TelephonyCallState;
  duration_seconds?: number;
  recording_url?: string;
  transfer_destination?: string;
  failure_reason?: string;
  timestamp: string;
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
}

