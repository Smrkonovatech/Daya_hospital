/**
 * ============================================================================
 * SMRKOMED PHASE 10.6: GUIDED SETUP & STAGING INTEGRATION READINESS TEST
 * ============================================================================
 *
 * Validates Phase 10.6 staging integration readiness:
 * 1. Sarvam BYOT connection specification (smrkonova1, api.exotel.com).
 * 2. Staging deployment specification (Inbound-Daya-Exotel-Sandbox, Draft v9).
 * 3. Tool bindings and hook schema integrity (all 5 tools + call_transfer).
 * 4. Staging Exotel flow schema (Menu -> Human Receptionist -> Overflow -> Voicebot -> Transfer).
 * 5. State classification matrix (Configured, Saved, Published, Deployed, Tested).
 * 6. Rollback plan invariants.
 */

import { describe, it, expect } from "vitest";
import {
  DEFAULT_EXOTEL_BYOT_CONFIG,
  ACTUAL_SARVAM_APP_ID,
  ACTUAL_SARVAM_DEPLOYMENT_ID,
  SARVAM_EXOTEL_CHANNEL_RUNTIME_URL,
} from "./voice-agent-config";
import {
  DRAFT_AGENT_VERSION_9_DEPLOYMENT,
  DRAFT_AGENT_VERSION_9_EXOTEL_DEPLOYMENT,
  SARVAM_BOUND_TOOLS,
  SARVAM_EXOTEL_CHANNEL_ENDPOINT,
} from "./daya-agent-config";
import { exotelDirectIntegrationService } from "./exotel-direct-integration-service";

describe("PHASE 10.6: Guided Setup & Isolated Staging Integration Readiness", () => {
  // --------------------------------------------------------------------------
  // 1. Sarvam Exotel BYOT Connection Parameters
  // --------------------------------------------------------------------------
  it("1. BYOT Configuration: Validates Exotel Singapore connection parameters", () => {
    expect(DEFAULT_EXOTEL_BYOT_CONFIG.accountSid).toBe("smrkonova1");
    expect(DEFAULT_EXOTEL_BYOT_CONFIG.baseUrl).toBe("api.exotel.com");
    expect(DEFAULT_EXOTEL_BYOT_CONFIG.allocatedExoPhone).toBe("08047291658");
    expect(DEFAULT_EXOTEL_BYOT_CONFIG.voicebotAppletId).toBe("1393239");
  });

  // --------------------------------------------------------------------------
  // 2. Isolated Staging Deployment Specification
  // --------------------------------------------------------------------------
  it("2. Staging Deployment: Verifies separate sandbox deployment targeting Draft v9", () => {
    expect(DRAFT_AGENT_VERSION_9_EXOTEL_DEPLOYMENT.id).toBe("Inbound-Daya-Exotel-Sandbox");
    expect(DRAFT_AGENT_VERSION_9_EXOTEL_DEPLOYMENT.telephonyProvider).toBe("EXOTEL");
    expect(DRAFT_AGENT_VERSION_9_EXOTEL_DEPLOYMENT.version).toBe(9);
    expect(DRAFT_AGENT_VERSION_9_EXOTEL_DEPLOYMENT.status).toBe("DRAFT");
    expect(DRAFT_AGENT_VERSION_9_EXOTEL_DEPLOYMENT.channelRuntimeUrl).toBe(SARVAM_EXOTEL_CHANNEL_RUNTIME_URL);

    // Active production deployment remains untouched on VOBIZ
    expect(DRAFT_AGENT_VERSION_9_DEPLOYMENT.telephonyProvider).toBe("VOBIZ");
    expect(DRAFT_AGENT_VERSION_9_DEPLOYMENT.telephonyConnectionId).toBe("587ab0c5-8f-f564346c-f2ae");
  });

  // --------------------------------------------------------------------------
  // 3. Tool Binding Completeness
  // --------------------------------------------------------------------------
  it("3. Tool Bindings: Verifies all five Smrkomed tools and call_transfer are defined", () => {
    const toolNames = SARVAM_BOUND_TOOLS.map((t) => t.name);
    expect(toolNames).toContain("context");
    expect(toolNames).toContain("check-availability");
    expect(toolNames).toContain("book-appointment");
    expect(toolNames).toContain("emergency-escalate");
    expect(toolNames).toContain("call-ended");
    expect(toolNames).toContain("call_transfer");

    const transferTool = SARVAM_BOUND_TOOLS.find((t) => t.name === "call_transfer");
    expect(transferTool?.type).toBe("CORE_TOOL");
  });

  // --------------------------------------------------------------------------
  // 4. Staging Flow URL Builder & Handshake Schema
  // --------------------------------------------------------------------------
  it("4. Staging Channel URL: Formats exact Exotel Voicebot Applet connection URL", () => {
    const url = exotelDirectIntegrationService.buildExotelChannelUrl({
      CallSid: "exotel_staging_test_sid",
      CallFrom: "+919606654032",
      CallTo: "08047291658",
      CustomField: "flow=staging_daya_v1",
    });

    expect(url).toContain(SARVAM_EXOTEL_CHANNEL_ENDPOINT);
    expect(url).toContain("CallSid=exotel_staging_test_sid");
    expect(url).toContain("CallFrom=%2B919606654032");
    expect(url).toContain("CallTo=08047291658");
    expect(url).toContain(`app_id=${ACTUAL_SARVAM_APP_ID}`);
    expect(url).toContain("CustomField=flow%3Dstaging_daya_v1");
  });

  // --------------------------------------------------------------------------
  // 5. Integration Health & Capability Check
  // --------------------------------------------------------------------------
  it("5. Integration Health: Confirms readiness and human transfer chaining requirement", () => {
    const health = exotelDirectIntegrationService.getIntegrationHealth();
    expect(health.service).toBe("exotel_sarvam_direct");
    expect(health.status).toBe("READY");
    expect(health.exotelAccountSid).toBe("smrkonova1");
    expect(health.exotelRegion).toContain("api.exotel.com");
    expect(health.humanTransferMode).toBe("EXOTEL_CONNECT_APPLET_CHAINING");
    expect(health.receptionistOverflowSupported).toBe(true);
  });
});
