/**
 * ============================================================================
 * SMRKOMED PROVIDER REGISTRY
 * ============================================================================
 *
 * Central registry for discovering, registering, and retrieving active Telephony
 * and AI provider adapters across hospitals.
 */

import { ITelephonyProvider } from "./telephony/telephony-provider.interface";
import { exotelTelephonyProvider } from "./telephony/exotel/exotel-provider";
import { IAiProvider } from "./ai/ai-provider.interface";
import { sarvamAiProvider } from "./ai/sarvam/sarvam-provider";

class ProviderRegistry {
  private telephonyProviders: Map<string, ITelephonyProvider> = new Map();
  private aiProviders: Map<string, IAiProvider> = new Map();

  constructor() {
    // Register default enterprise providers
    this.registerTelephonyProvider(exotelTelephonyProvider);
    this.registerAiProvider(sarvamAiProvider);
  }

  public registerTelephonyProvider(provider: ITelephonyProvider): void {
    this.telephonyProviders.set(provider.providerName.toUpperCase(), provider);
  }

  public registerAiProvider(provider: IAiProvider): void {
    this.aiProviders.set(provider.providerName.toUpperCase(), provider);
  }

  public getTelephonyProvider(name = "EXOTEL"): ITelephonyProvider {
    const prov = this.telephonyProviders.get(name.toUpperCase());
    if (!prov) {
      // Default to Exotel
      return exotelTelephonyProvider;
    }
    return prov;
  }

  public getAiProvider(name = "SARVAM_AI"): IAiProvider {
    const prov = this.aiProviders.get(name.toUpperCase());
    if (!prov) {
      // Default to Sarvam
      return sarvamAiProvider;
    }
    return prov;
  }

  public listAvailableTelephonyProviders(): string[] {
    return Array.from(this.telephonyProviders.keys());
  }

  public listAvailableAiProviders(): string[] {
    return Array.from(this.aiProviders.keys());
  }
}

export const providerRegistry = new ProviderRegistry();
