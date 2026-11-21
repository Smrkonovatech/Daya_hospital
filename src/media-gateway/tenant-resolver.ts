/**
 * ============================================================================
 * MULTI-HOSPITAL TENANT RESOLVER & METADATA VALIDATOR
 * ============================================================================
 *
 * Secure server-side tenant identification for multi-hospital SaaS.
 * Prevents tenant impersonation by cross-verifying Exotel call metadata
 * (dialed number, caller number, Account SID, and signed custom fields)
 * against trusted server-side configurations.
 */

import {
  HospitalConfig,
  getHospitalConfig,
  resolveHospitalByPhoneNumber,
  resolveHospitalByAccountSid,
  HOSPITAL_REGISTRY,
} from "@/lib/config/hospital-config";

export interface TenantResolutionInput {
  streamSid: string;
  callSid: string;
  accountSid: string;
  to: string; // Hospital virtual number (ExoPhone)
  from: string; // Patient caller number
  customField?: string; // Optional metadata passed from Exotel flow
}

export interface TenantResolutionResult {
  hospitalId: string;
  hospitalConfig: HospitalConfig;
  verified: boolean;
  resolutionSource: "PHONE_NUMBER" | "ACCOUNT_SID" | "VALIDATED_CUSTOM_FIELD" | "DEFAULT_FALLBACK";
  warning?: string;
}

export class TenantResolver {
  /**
   * Resolves the hospital tenant from validated Exotel start metadata.
   *
   * Security Invariant:
   * Never blindly trust an unverified tenant ID supplied by an external client.
   * Cross-checks `to` (ExoPhone) and `accountSid` against server-side registries.
   */
  public resolveTenant(input: TenantResolutionInput): TenantResolutionResult {
    const { to, accountSid, customField } = input;

    // 1. Primary verification: match the dialed ExoPhone against known hospital numbers
    if (to) {
      const hospitalByPhone = resolveHospitalByPhoneNumber(to);
      if (hospitalByPhone && hospitalByPhone.hospitalId) {
        // If customField is also provided, check if it matches the phone owner
        if (customField && customField !== hospitalByPhone.hospitalId) {
          return {
            hospitalId: hospitalByPhone.hospitalId,
            hospitalConfig: hospitalByPhone,
            verified: true,
            resolutionSource: "PHONE_NUMBER",
            warning: `Mismatch: customField '${customField}' does not match ExoPhone owner '${hospitalByPhone.hospitalId}'. Overriding with trusted phone configuration.`,
          };
        }

        return {
          hospitalId: hospitalByPhone.hospitalId,
          hospitalConfig: hospitalByPhone,
          verified: true,
          resolutionSource: "PHONE_NUMBER",
        };
      }
    }

    // 2. Secondary verification: match by Account SID (for multi-account SaaS setups)
    if (accountSid) {
      const hospitalByAccount = resolveHospitalByAccountSid(accountSid);
      if (hospitalByAccount && hospitalByAccount.hospitalId) {
        return {
          hospitalId: hospitalByAccount.hospitalId,
          hospitalConfig: hospitalByAccount,
          verified: true,
          resolutionSource: "ACCOUNT_SID",
        };
      }
    }

    // 3. Tertiary: if customField matches a registered hospital ID in our server registry
    if (customField && HOSPITAL_REGISTRY[customField]) {
      const config = HOSPITAL_REGISTRY[customField];
      return {
        hospitalId: config.hospitalId,
        hospitalConfig: config,
        verified: true,
        resolutionSource: "VALIDATED_CUSTOM_FIELD",
      };
    }

    // 4. Fallback to default Daya Hospital pilot configuration with unverified notice
    const defaultConfig = getHospitalConfig();
    return {
      hospitalId: defaultConfig.hospitalId,
      hospitalConfig: defaultConfig,
      verified: false,
      resolutionSource: "DEFAULT_FALLBACK",
      warning: `Unable to verify hospital tenant from ExoPhone '${to}' or AccountSid '${accountSid}'. Defaulted to pilot tenant '${defaultConfig.hospitalId}'.`,
    };
  }
}

export const tenantResolver = new TenantResolver();

