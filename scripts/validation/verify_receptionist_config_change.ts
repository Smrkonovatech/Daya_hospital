/**
 * ============================================================================
 * SMRKOMED PHASE 10.11: RECEPTIONIST TEST DESTINATION VALIDATION SCRIPT
 * ============================================================================
 *
 * Demonstrates the secure dashboard workflow:
 * 1. Reads initial published reception destination (+919606654032).
 * 2. Fetches Connect endpoint response BEFORE change.
 * 3. Simulates admin setting an authorized test destination (+914872475000) with ring timeout 25s.
 * 4. Publishes a new version with audit changelog.
 * 5. Fetches Connect endpoint response AFTER change (demonstrating dynamic update without Exotel applet modification).
 * 6. Checks emergency destination to verify strict independence.
 * 7. Checks unauthenticated call to verify fail closed (never leaks test destinations).
 * 8. Restores baseline configuration.
 */

import { hospitalRoutingService } from "../../src/lib/services/hospital-routing-service";
import { dynamicExotelRoutingAdapter } from "../../src/lib/services/dynamic-exotel-routing-adapter";

async function main() {
  const DAYA_TENANT = "hosp_daya_thrissur";
  const ROUTING_TOKEN = "smrko_test_routing_token_2026";
  const AUTHORIZED_TEST_RECEPTION = "+914872475000"; // Authorized Daya front desk test number

  console.log("============================================================================");
  console.log("SMRKOMED PHASE 10.11: RECEPTIONIST CONFIGURATION & ROUTING VALIDATION");
  console.log("============================================================================\n");

  // Step 0: Ensure baseline state (+919606654032)
  await hospitalRoutingService.saveDraft(
    DAYA_TENANT,
    {
      receptionistDestination: {
        primaryNumber: "+919606654032",
        departmentName: "Front Desk Reception",
        extension: "201",
      },
      receptionistRingTimeoutSeconds: 20,
    },
    "usr_admin_daya",
    "Daya Telephony Administrator"
  );
  await hospitalRoutingService.publishVersion(
    DAYA_TENANT,
    "Reset baseline Daya routing configuration before test",
    "usr_admin_daya",
    "Daya Telephony Administrator"
  );

  // Step 1: Baseline Check
  console.log("--- 1. INITIAL BASELINE RESOLUTION (BEFORE DASHBOARD UPDATE) ---");
  const beforeRes = await dynamicExotelRoutingAdapter.resolveConnectDestination({
    callSid: "call_phase10_11_before",
    hospitalId: DAYA_TENANT,
    escalationType: "HUMAN_TRANSFER",
    routingToken: ROUTING_TOKEN,
  });

  console.log("HTTP Status:", beforeRes.statusCode);
  console.log("Headers:", JSON.stringify(beforeRes.headers, null, 2));
  console.log("Payload:\n" + JSON.stringify(beforeRes.jsonPayload, null, 2));

  // Step 2: Dashboard Save Draft
  console.log("\n--- 2. ADMIN SAVES DRAFT CONFIGURATION ---");
  const draft = await hospitalRoutingService.saveDraft(
    DAYA_TENANT,
    {
      receptionistDestination: {
        primaryNumber: AUTHORIZED_TEST_RECEPTION,
        departmentName: "Authorized Reception Test Desk",
        extension: "201",
      },
      receptionistRingTimeoutSeconds: 25,
    },
    "usr_admin_daya",
    "Daya Telephony Administrator"
  );
  console.log("Draft saved successfully for tenant:", draft.hospitalId);
  console.log("Draft receptionist number:", draft.receptionistDestination.primaryNumber);
  console.log("Draft ring timeout:", draft.receptionistRingTimeoutSeconds);

  // Step 3: Admin Publishes Version
  console.log("\n--- 3. ADMIN PUBLISHES VERSION WITH AUDIT CHANGELOG ---");
  const publishRes = await hospitalRoutingService.publishVersion(
    DAYA_TENANT,
    "Phase 10.11: Configured authorized receptionist test destination (+914872475000) with 25s timeout",
    "usr_admin_daya",
    "Daya Telephony Administrator"
  );
  console.log("Publish result:", publishRes);

  // Step 4: Endpoint Dynamic Resolution After Change
  console.log("\n--- 4. ENDPOINT RESOLUTION (AFTER DASHBOARD UPDATE — ZERO APPLET CHANGE) ---");
  const afterRes = await dynamicExotelRoutingAdapter.resolveConnectDestination({
    callSid: "call_phase10_11_after",
    hospitalId: DAYA_TENANT,
    escalationType: "HUMAN_TRANSFER",
    routingToken: ROUTING_TOKEN,
  });

  console.log("HTTP Status:", afterRes.statusCode);
  console.log("Headers:", JSON.stringify(afterRes.headers, null, 2));
  console.log("Payload:\n" + JSON.stringify(afterRes.jsonPayload, null, 2));

  // Step 5: Independence Check (Emergency Destination)
  console.log("\n--- 5. INDEPENDENCE CHECK (EMERGENCY RESOLUTION) ---");
  const emergencyRes = await dynamicExotelRoutingAdapter.resolveConnectDestination({
    callSid: "call_phase10_11_emergency",
    hospitalId: DAYA_TENANT,
    escalationType: "EMERGENCY_TRANSFER",
    routingToken: ROUTING_TOKEN,
  });

  console.log("HTTP Status:", emergencyRes.statusCode);
  console.log("Headers:", JSON.stringify(emergencyRes.headers, null, 2));
  console.log("Payload:\n" + JSON.stringify(emergencyRes.jsonPayload, null, 2));

  // Step 6: Anti-Leakage / Fail Closed Check
  console.log("\n--- 6. ANTI-LEAKAGE / FAIL CLOSED CHECK (INVALID TOKEN) ---");
  const unauthRes = await dynamicExotelRoutingAdapter.resolveConnectDestination({
    callSid: "call_phase10_11_unauth",
    hospitalId: DAYA_TENANT,
    escalationType: "HUMAN_TRANSFER",
    routingToken: "invalid_untrusted_token",
  });

  console.log("HTTP Status:", unauthRes.statusCode);
  console.log("Payload:\n" + JSON.stringify(unauthRes.jsonPayload, null, 2));

  // Step 7: Restore baseline
  console.log("\n--- 7. RESTORING BASELINE CONFIGURATION ---");
  await hospitalRoutingService.saveDraft(
    DAYA_TENANT,
    {
      receptionistDestination: {
        primaryNumber: "+919606654032",
        departmentName: "Front Desk Reception",
        extension: "201",
      },
      receptionistRingTimeoutSeconds: 20,
    },
    "usr_admin_daya",
    "Daya Telephony Administrator"
  );
  await hospitalRoutingService.publishVersion(
    DAYA_TENANT,
    "Restore baseline Daya routing configuration post Phase 10.11 verification",
    "usr_admin_daya",
    "Daya Telephony Administrator"
  );
  console.log("Baseline restored successfully.");
}

main().catch(console.error);
