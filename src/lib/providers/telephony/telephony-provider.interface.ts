/**
 * ============================================================================
 * SMRKOMED TELEPHONY PROVIDER INTERFACE
 * ============================================================================
 *
 * Pluggable contract for telephony cloud providers (Exotel, BitVoice, Airtel IQ).
 * All hospital calling and routing operations must be routed through this interface.
 */

import { ExotelCallDetails } from "@/lib/integrations/telephony/standard-telephony-types";
import {
  RecordingMetadataResult,
  StandardOutboundCallParams,
  StandardOutboundCallResult,
  WebhookProcessingResult,
} from "@/lib/services/exotel-telephony-service";

export type CapabilityStatus =
  | "VERIFIED_API_SUPPORTED"
  | "VERIFIED_DASHBOARD_ONLY"
  | "REQUIRES_PROVIDER_CONFIRMATION"
  | "NOT_SUPPORTED"
  | "NOT_YET_TESTED";

export interface TelephonyCapabilityItem {
  id: string;
  name: string;
  category: "CALL_CONTROL" | "ROUTING" | "STREAMING" | "RECORDING" | "MESSAGING" | "CONFIGURATION";
  status: CapabilityStatus;
  description: string;
  verificationSource: string;
  notes?: string;
}

export interface TelephonyCapabilities {
  provider: string;
  region: string;
  accountIdentifier: string;
  capabilities: TelephonyCapabilityItem[];
  verifiedAt: string;
}

export interface TelephonyProviderValidationResult {
  isValid: boolean;
  provider: string;
  accountSid?: string;
  region?: string;
  errors: string[];
  warnings: string[];
}

export interface ITelephonyProvider {
  readonly providerName: string;

  /**
   * Initiates a programmable outbound call session.
   */
  initiateCall(params: StandardOutboundCallParams): Promise<StandardOutboundCallResult>;

  /**
   * Retrieves active or historical call session details from telephony cloud.
   */
  getCallDetails(callSid: string, hospitalId?: string): Promise<ExotelCallDetails | null>;

  /**
   * Immediately terminates an in-flight phone call session.
   */
  terminateCall(callSid: string, hospitalId?: string): Promise<boolean>;

  /**
   * Transfers an in-flight call to a staff extension, hunt group, or PSTN number.
   */
  transferCall(callSid: string, destination: string, hospitalId?: string): Promise<boolean>;

  /**
   * Retrieves audio recording metadata and download storage URL.
   */
  getRecordingMetadata(callSid: string, hospitalId?: string): Promise<RecordingMetadataResult | null>;

  /**
   * Downloads raw binary recording audio from provider storage.
   */
  getRecordingAudio(callSid: string, hospitalId?: string): Promise<{ audioBuffer: Buffer; contentType: string } | null>;

  /**
   * Ingests, verifies HMAC, and normalizes incoming telephony status callbacks.
   */
  processWebhookEvent(
    rawBody: string,
    headers: Headers,
    searchParams: URLSearchParams
  ): Promise<WebhookProcessingResult>;

  /**
   * Validates account credentials, virtual numbers, and region connectivity.
   */
  validateConfiguration(config: Record<string, unknown>): Promise<TelephonyProviderValidationResult>;

  /**
   * Returns authoritative capabilities report for this provider and region.
   */
  getCapabilities(): TelephonyCapabilities;
}
