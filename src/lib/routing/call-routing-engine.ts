import { getHospitalConfig } from "@/lib/config/hospital-config";

export interface CallRoutingInput {
  callerNumber: string;
  calledNumber: string;
  intent: string; // e.g., APPOINTMENT_BOOKING, DOCTOR_AVAILABILITY, EMERGENCY_AMBULANCE, GENERAL_QUERY
  allHumanAgentsBusy?: boolean;
  ringDurationSeconds?: number;
  currentHops?: number;
  callTime?: Date;
}

export interface RoutingDecisionResult {
  shouldForwardToAi: boolean;
  destination: "SMRKO_VOICE" | "HUMAN_AGENT_QUEUE" | "CASUALTY_DESK" | "LOOP_FALLBACK";
  destinationNumberOrExt: string;
  reason: string;
  isPeakHour: boolean;
  hopCount: number;
  providerSideRuleRequired: string;
}

/**
 * Call Routing Engine (Daya First)
 *
 * Implements the approved routing rules for Daya General Hospital:
 * 1. Single hospital number receives call via BitVoice.
 * 2. ONLY appointment & doctor availability calls are eligible for AI forwarding.
 * 3. Emergency / casualty calls are immediately routed to 24/7 casualty desk (+91 487 2475100 / Ext 100).
 * 4. General enquiries & administration stay on hospital human staff queue.
 * 5. Rollover triggers when daytime human agents (4 agents) are busy or after 20s ring timeout.
 * 6. Forwarding loop prevention: Max 3 hops.
 */
export class CallRoutingEngine {
  private config = getHospitalConfig();

  /**
   * Determines if call timestamp falls within Daya's peak period (09:00 - 12:00 IST).
   */
  public isPeakHour(date = new Date()): boolean {
    const hours = date.getHours(); // Local / IST
    return hours >= 9 && hours < 12;
  }

  /**
   * Evaluates the routing decision for an incoming call.
   */
  public evaluate(input: CallRoutingInput): RoutingDecisionResult {
    const hops = input.currentHops || 1;
    const maxHops = this.config.routing.maxHops || 3;

    // 1. Loop Prevention check
    if (hops > maxHops) {
      return {
        shouldForwardToAi: false,
        destination: "LOOP_FALLBACK",
        destinationNumberOrExt: this.config.routing.casualtyExtension,
        reason: `Hop count limit exceeded (${hops} > ${maxHops}). Breaking potential forwarding loop.`,
        isPeakHour: this.isPeakHour(input.callTime),
        hopCount: hops,
        providerSideRuleRequired: "Ensure BitVoice IVR doesn't bounce transferred calls back to inbound trunk.",
      };
    }

    const normalizedIntent = input.intent.toUpperCase();

    // 2. Clinical Emergency / Ambulance -> Immediate Human Casualty Hand-off
    if (
      normalizedIntent.includes("EMERGENCY") ||
      normalizedIntent.includes("AMBULANCE") ||
      normalizedIntent.includes("CASUALTY") ||
      normalizedIntent.includes("TRAUMA")
    ) {
      return {
        shouldForwardToAi: false,
        destination: "CASUALTY_DESK",
        destinationNumberOrExt: this.config.routing.casualtyDirectNumber,
        reason: "Clinical emergency detected. Direct routing to 24/7 Casualty & Trauma desk.",
        isPeakHour: this.isPeakHour(input.callTime),
        hopCount: hops,
        providerSideRuleRequired: "BitVoice IVR Keypress 1 or priority CLI routing to Casualty extension 100.",
      };
    }

    // 3. Appointment & Doctor Availability Enquiries -> Eligible for Smrko Voice
    const isAppointmentEnquiry =
      normalizedIntent.includes("APPOINTMENT") ||
      normalizedIntent.includes("DOCTOR") ||
      normalizedIntent.includes("BOOKING") ||
      normalizedIntent.includes("SCHEDULE") ||
      normalizedIntent.includes("TOKEN");

    if (isAppointmentEnquiry) {
      const ringTimeout = input.ringDurationSeconds && input.ringDurationSeconds >= 20;
      const agentsBusy = input.allHumanAgentsBusy ?? true; // Default rollover on IVR forward

      if (agentsBusy || ringTimeout) {
        return {
          shouldForwardToAi: true,
          destination: "SMRKO_VOICE",
          destinationNumberOrExt: "SMRKO_VOICE_SIP_TRUNK",
          reason: ringTimeout
            ? "Ring timeout exceeded 20s on human agent desk. Forwarding appointment enquiry to Smrko Voice."
            : "All 4 daytime human agents busy. Forwarding appointment enquiry to Smrko Voice.",
          isPeakHour: this.isPeakHour(input.callTime),
          hopCount: hops + 1,
          providerSideRuleRequired: "BitVoice IVR rollover rule: forward appointment calls to SIP trunk on 20s no-answer or busy.",
        };
      }
    }

    // 4. Other Enquiry Categories (Billing, Insurance, Admin) -> Retain Hospital Human Queue
    return {
      shouldForwardToAi: false,
      destination: "HUMAN_AGENT_QUEUE",
      destinationNumberOrExt: "EXT_101",
      reason: "General enquiry or administrative call. Stays on existing hospital human agent queue.",
      isPeakHour: this.isPeakHour(input.callTime),
      hopCount: hops,
      providerSideRuleRequired: "BitVoice retains default hunt group routing for non-appointment options.",
    };
  }
}

export const callRoutingEngine = new CallRoutingEngine();

