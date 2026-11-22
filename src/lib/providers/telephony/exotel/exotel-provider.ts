/**
 * ============================================================================
 * EXOTEL TELEPHONY PROVIDER IMPLEMENTATION
 * ============================================================================
 *
 * Implements ITelephonyProvider for Exotel Telephony Cloud (Singapore region).
 * Wraps ExotelTelephonyService and ExotelTelephonyAdapter without rewriting logic.
 */

import {
  ITelephonyProvider,
  TelephonyCapabilities,
  TelephonyProviderValidationResult,
} from "../telephony-provider.interface";
import {
  exotelTelephonyService,
  RecordingMetadataResult,
  StandardOutboundCallParams,
  StandardOutboundCallResult,
  WebhookProcessingResult,
} from "@/lib/services/exotel-telephony-service";
import { ExotelCallDetails } from "@/lib/integrations/telephony/standard-telephony-types";
import { getExotelCapabilities } from "./exotel-capabilities";
import { getHospitalConfig } from "@/lib/config/hospital-config";

export class ExotelTelephonyProvider implements ITelephonyProvider {
  public readonly providerName = "EXOTEL";

  public async initiateCall(params: StandardOutboundCallParams): Promise<StandardOutboundCallResult> {
    return exotelTelephonyService.initiateCall(params);
  }

  public async getCallDetails(callSid: string, hospitalId?: string): Promise<ExotelCallDetails | null> {
    return exotelTelephonyService.getCallDetails(callSid, hospitalId);
  }

  public async terminateCall(callSid: string, hospitalId?: string): Promise<boolean> {
    const res = await exotelTelephonyService.terminateCall(callSid, hospitalId);
    return res.success;
  }

  public async transferCall(callSid: string, destination: string, hospitalId?: string): Promise<boolean> {
    const res = await exotelTelephonyService.transferCall(callSid, destination, hospitalId);
    return res.success;
  }

  public async getRecordingMetadata(callSid: string, hospitalId?: string): Promise<RecordingMetadataResult | null> {
    return exotelTelephonyService.getRecordingMetadata(callSid, hospitalId);
  }

  public async getRecordingAudio(
    callSid: string,
    hospitalId?: string
  ): Promise<{ audioBuffer: Buffer; contentType: string } | null> {
    return exotelTelephonyService.getRecordingAudio(callSid, hospitalId);
  }

  public async processWebhookEvent(
    rawBody: string,
    headers: Headers,
    searchParams: URLSearchParams
  ): Promise<WebhookProcessingResult> {
    return exotelTelephonyService.processWebhookEvent(rawBody, headers, searchParams);
  }

  public async validateConfiguration(
    config: Record<string, unknown>
  ): Promise<TelephonyProviderValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const accountSid = String(config.accountSid || config.exotelAccountSid || "");
    const apiKey = String(config.apiKey || config.exotelApiKey || "");
    const apiToken = String(config.apiToken || config.exotelApiToken || "");
    const virtualNumber = String(config.defaultExoPhone || config.exotelVirtualNumber || "");

    if (!accountSid) errors.push("Exotel Account SID is required.");
    if (!apiKey) errors.push("Exotel API Key is required.");
    if (!apiToken) errors.push("Exotel API Token is required.");
    if (!virtualNumber) {
      warnings.push("No primary virtual ExoPhone specified. Inbound calls will not route.");
    } else if (!/^(\+91|0)?[6-9]\d{9}$/.test(virtualNumber.replace(/\D/g, ""))) {
      warnings.push("Virtual number does not match standard Indian phone format.");
    }

    return {
      isValid: errors.length === 0,
      provider: this.providerName,
      accountSid: accountSid || undefined,
      region: "Singapore (api.exotel.com)",
      errors,
      warnings,
    };
  }

  public getCapabilities(): TelephonyCapabilities {
    const hospital = getHospitalConfig();
    const sid = hospital.telephony.exotel?.accountSid || "smrkonova1";
    return getExotelCapabilities(sid);
  }
}

export const exotelTelephonyProvider = new ExotelTelephonyProvider();
