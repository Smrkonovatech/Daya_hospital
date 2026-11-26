/**
 * ============================================================================
 * SMRKOMED PHASE 10.13: DAYA TRIAL ROUTING DESTINATIONS VERIFICATION
 * ============================================================================
 *
 * Verifies:
 * 1. Receptionist destination: +919606654032 (ring timeout: 20s)
 * 2. Emergency destination: +919740662046 (classified as TEMPORARY_DEV_TEST_RECEIVER)
 * 3. Exact Exotel Connect contract for HUMAN_TRANSFER
 * 4. Exact Exotel Connect contract for EMERGENCY_TRANSFER
 * 5. Strict independence between receptionist and emergency routing
 * 6. Tenant isolation and fail-closed security
 */

import { hospitalRoutingService } from "../../src/lib/services/hospital-routing-service";
import { dynamicExotelRoutingAdapter } from "../../src/lib/services/dynamic-exotel-routing-adapter";

async function main() {
  const DAYA_TENANT = "hosp_daya_thrissur";
  const ROUTING_TOKEN = "smrko_test_routing_token_2026";
  const TRIAL_RECEPTIONIST = "+919606654032";
  const TRIAL_EMERGENCY = "+919740662046";

  console.log("================================================================================");
  console.log("SMRKOMED PHASE 10.13: DAYA HOSPITAL TRIAL ROUTING DESTINATIONS");
  console.log("================================================================================\n");

  // Step 1: Save and Publish Trial Routing Configuration
  console.log("--- 1. PUBLISHING PHASE 10.13 TRIAL ROUTING CONFIGURATION ---");
  await hospitalRoutingService.saveDraft(
    DAYA_TENANT,
    {
      emergencyDestination: {
        primaryNumber: TRIAL_EMERGENCY,
        backupNumber: "+914872475100",
        departmentName: "Casualty Emergency Desk (DEV TEST RECEIVER)",
        extension: "100",
        receiverClassification: "TEMPORARY_DEV_TEST_RECEIVER",
        emergencyPstnTransferEnabled: false,
        verificationNotes:
          "RECLASSIFIED PER PHASE 10.13: Strictly temporary development test receiver (+919740662046). Live carrier emergency PSTN transfer disabled pending Daya hospital clinical signoff.",
      },
      receptionistDestination: {
        primaryNumber: TRIAL_RECEPTIONIST,
        backupNumber: "+914872475000",
        departmentName: "Main Inbound Reception (DEV TEST RECEIVER)",
        extension: "201",
      },
      receptionistRingTimeoutSeconds: 20,
      aiOverflowEnabled: true,
      noAnswerBehavior: "AI_VOICEBOT",
      busyBehavior: "AI_VOICEBOT",
      unavailableBehavior: "AI_VOICEBOT",
    },
    "usr_admin_daya",
    "Daya Telephony Administrator"
  );

  const pubResult = await hospitalRoutingService.publishVersion(
    DAYA_TENANT,
    "Phase 10.13: Configured Daya Hospital trial routing destinations (Emergency: +919740662046, Receptionist: +919606654032)",
    "usr_admin_daya",
    "Daya Telephony Administrator"
  );
  console.log("Published version result:", pubResult);

  // Step 2: Verify HUMAN_TRANSFER (DTMF 2 - Appointment)
  console.log("\n--- 2. VERIFY HUMAN_TRANSFER RESOLUTION (DTMF 2) ---");
  const humanRes = await dynamicExotelRoutingAdapter.resolveConnectDestination({
    callSid: "call_phase10_13_human_verify",
    hospitalId: DAYA_TENANT,
    callTo: "08047291658",
    escalationType: "HUMAN_TRANSFER",
    routingToken: ROUTING_TOKEN,
  });

  console.log("HTTP Status:", humanRes.statusCode);
  console.log("Headers:", JSON.stringify(humanRes.headers, null, 2));
  console.log("JSON Payload:\n" + JSON.stringify(humanRes.jsonPayload, null, 2));

  // Step 3: Verify EMERGENCY_TRANSFER (DTMF 1 - Emergency)
  console.log("\n--- 3. VERIFY EMERGENCY_TRANSFER RESOLUTION (DTMF 1) ---");
  const emergencyRes = await dynamicExotelRoutingAdapter.resolveConnectDestination({
    callSid: "call_phase10_13_emergency_verify",
    hospitalId: DAYA_TENANT,
    callTo: "08047291658",
    escalationType: "EMERGENCY_TRANSFER",
    routingToken: ROUTING_TOKEN,
  });

  console.log("HTTP Status:", emergencyRes.statusCode);
  console.log("Headers:", JSON.stringify(emergencyRes.headers, null, 2));
  console.log("JSON Payload:\n" + JSON.stringify(emergencyRes.jsonPayload, null, 2));

  // Step 4: Verify Fail-Closed & Anti-Leakage
  console.log("\n--- 4. VERIFY UNTRUSTED CONTEXT FAILS CLOSED ---");
  const unauthRes = await dynamicExotelRoutingAdapter.resolveConnectDestination({
    callSid: "call_phase10_13_unauth",
    hospitalId: DAYA_TENANT,
    escalationType: "EMERGENCY_TRANSFER",
    routingToken: "untrusted_token",
  });

  console.log("HTTP Status:", unauthRes.statusCode);
  console.log("JSON Payload:\n" + JSON.stringify(unauthRes.jsonPayload, null, 2));

  // Step 5: Verify Staging Voicebot Applet Target
  console.log("\n--- 5. VERIFY STAGING VOICEBOT APPLET ---");
  const stagingApplet = dynamicExotelRoutingAdapter.getTargetVoicebotApplet(false);
  const prodApplet = dynamicExotelRoutingAdapter.getTargetVoicebotApplet(true);
  console.log(`Staging Applet ID: ${stagingApplet} (Expected: 1393240)`);
  console.log(`Production Applet ID: ${prodApplet} (Expected: 1393239)`);
}

main().catch(console.error);
