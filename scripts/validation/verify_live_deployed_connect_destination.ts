/**
 * ============================================================================
 * SMRKOMED LIVE DEPLOYED /exotel/connect-destination ENDPOINT VERIFICATION
 * Phase 10.10: Synthetic Test Harness
 * ============================================================================
 */

import { formatE164, isValidE164 } from "../../src/lib/services/hospital-routing-service";

const GATEWAY_URL = process.env.LIVE_GATEWAY_URL || "https://dayahospital-production-467a7d31.up.railway.app";
const DAYA_EXOPHONE = "08047291658";
const SYNTHETIC_CALLER = "+919846001122";

interface ProbeResult {
  testName: string;
  status: number;
  contentType: string | null;
  headers: Record<string, string>;
  json: any;
  text: string;
}

async function probe(testName: string, url: string, options: RequestInit = {}): Promise<ProbeResult> {
  const res = await fetch(url, {
    ...options,
    redirect: "manual",
  });
  const status = res.status;
  const contentType = res.headers.get("content-type");
  const headers: Record<string, string> = {};
  res.headers.forEach((val, key) => {
    headers[key.toLowerCase()] = val;
  });

  const rawText = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(rawText);
  } catch {}

  return { testName, status, contentType, headers, json, text: rawText };
}

export async function runLiveConnectDestinationValidation() {
  console.log("================================================================================");
  console.log("PHASE 10.10 — LIVE DEPLOYED /exotel/connect-destination SYNTHETIC VALIDATION");
  console.log(`Target Gateway: ${GATEWAY_URL}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log("================================================================================\n");

  const results: Array<{ name: string; pass: boolean; detail?: any }> = [];
  const now = Date.now();
  const validCallSid = `syn_connect_valid_${now}`;
  const unauthCallSid = `syn_connect_unauth_${now}`;
  const spoofCallSid = `syn_connect_spoof_${now}`;
  const textCallSid = `syn_connect_text_${now}`;

  // --------------------------------------------------------------------------
  // TEST 1: Valid Authenticated Daya Receptionist Request -> HTTP 200 JSON
  // --------------------------------------------------------------------------
  console.log("[Test 1/6] Testing Valid Daya Receptionist Request -> Expect HTTP 200 JSON");
  const t1Url = `${GATEWAY_URL}/exotel/connect-destination?CallSid=${validCallSid}&CallTo=${DAYA_EXOPHONE}&CallFrom=${encodeURIComponent(
    SYNTHETIC_CALLER
  )}&hospitalId=hosp_daya_thrissur&type=HUMAN_TRANSFER`;

  const t1 = await probe("Valid Daya Receptionist Request", t1Url);
  console.log(`  HTTP Status: ${t1.status}`);
  console.log(`  Content-Type: ${t1.contentType}`);
  console.log(`  Response JSON:`, JSON.stringify(t1.json, null, 2));

  const hasValidDestination =
    t1.json?.destination?.numbers &&
    Array.isArray(t1.json.destination.numbers) &&
    t1.json.destination.numbers.length > 0 &&
    isValidE164(t1.json.destination.numbers[0]);

  const matchesExotelContract =
    t1.status === 200 &&
    t1.contentType?.includes("application/json") &&
    t1.json?.fetch_after_attempt === false &&
    t1.json?.record === true &&
    t1.json?.outgoing_phone_number === DAYA_EXOPHONE &&
    typeof t1.json?.max_ringing_duration === "number" &&
    t1.json.max_ringing_duration >= 5 &&
    t1.json.max_ringing_duration <= 60 &&
    hasValidDestination;

  if (matchesExotelContract) {
    console.log("  >>> PASS: Exact Exotel Programmable Connect JSON contract satisfied.");
    results.push({ name: "Valid Daya Receptionist Request -> HTTP 200 JSON", pass: true, detail: t1.json });
  } else {
    console.error("  >>> FAIL: Did not match contract or server returned error:", t1.text);
    results.push({ name: "Valid Daya Receptionist Request -> HTTP 200 JSON", pass: false, detail: t1 });
  }

  // --------------------------------------------------------------------------
  // TEST 2: Dynamic Ring Timeout & E.164 Verification
  // --------------------------------------------------------------------------
  console.log("\n[Test 2/6] Verifying Dynamic Ring Timeout & E.164 Formatting");
  const destNumber = t1.json?.destination?.numbers?.[0];
  const ringDuration = t1.json?.max_ringing_duration;
  console.log(`  Resolved Destination: ${destNumber} (Valid E.164: ${isValidE164(destNumber)})`);
  console.log(`  Configured max_ringing_duration: ${ringDuration}s`);

  if (isValidE164(destNumber) && typeof ringDuration === "number" && ringDuration > 0) {
    console.log("  >>> PASS: Destination is strictly E.164 and ring duration is dynamic.");
    results.push({ name: "Dynamic Ring Timeout & E.164 Formatting", pass: true });
  } else {
    console.error("  >>> FAIL: Invalid destination format or missing ring duration.");
    results.push({ name: "Dynamic Ring Timeout & E.164 Formatting", pass: false });
  }

  // --------------------------------------------------------------------------
  // TEST 3: Missing CallSid Fails Closed -> HTTP 404
  // --------------------------------------------------------------------------
  console.log("\n[Test 3/6] Testing Missing CallSid -> Expect HTTP 404 Fail Closed");
  const t3Url = `${GATEWAY_URL}/exotel/connect-destination?CallTo=${DAYA_EXOPHONE}&hospitalId=hosp_daya_thrissur&type=HUMAN_TRANSFER`;
  const t3 = await probe("Missing CallSid", t3Url);
  console.log(`  HTTP Status: ${t3.status} | Error: ${t3.json?.error || t3.text}`);

  if (t3.status === 404 && (t3.json?.error === "UNKNOWN_CALL_SID" || t3.text.includes("UNKNOWN_CALL_SID"))) {
    console.log("  >>> PASS: Safely rejected missing CallSid with HTTP 404.");
    results.push({ name: "Missing CallSid -> HTTP 404", pass: true });
  } else {
    console.error("  >>> FAIL:", t3);
    results.push({ name: "Missing CallSid -> HTTP 404", pass: false });
  }

  // --------------------------------------------------------------------------
  // TEST 4: Unauthenticated Query Probing Fails Closed -> HTTP 403
  // --------------------------------------------------------------------------
  console.log("\n[Test 4/6] Testing Unauthenticated Query Probing -> Expect HTTP 403 Forbidden");
  const t4Url = `${GATEWAY_URL}/exotel/connect-destination?CallSid=${unauthCallSid}&hospitalId=hosp_daya_thrissur&type=HUMAN_TRANSFER`;
  const t4 = await probe("Unauthenticated Query Probing", t4Url);
  console.log(`  HTTP Status: ${t4.status} | Error: ${t4.json?.error || t4.text}`);

  if (t4.status === 403 && (t4.json?.error === "SECURITY_UNTRUSTED_TENANT" || t4.text.includes("UNTRUSTED_TENANT"))) {
    console.log("  >>> PASS: Safely blocked unauthenticated tenant probing with HTTP 403.");
    results.push({ name: "Unauthenticated Query Probing -> HTTP 403", pass: true });
  } else {
    console.error("  >>> FAIL:", t4);
    results.push({ name: "Unauthenticated Query Probing -> HTTP 403", pass: false });
  }

  // --------------------------------------------------------------------------
  // TEST 5: Cross-Tenant Spoofing against Dialed ExoPhone Fails Closed -> HTTP 403
  // --------------------------------------------------------------------------
  console.log("\n[Test 5/6] Testing Cross-Tenant Spoofing against ExoPhone -> Expect HTTP 403 Forbidden");
  const t5Url = `${GATEWAY_URL}/exotel/connect-destination?CallSid=${spoofCallSid}&CallTo=${DAYA_EXOPHONE}&hospitalId=hosp_aster_medcity&type=HUMAN_TRANSFER`;
  const t5 = await probe("Cross-Tenant Spoofing", t5Url);
  console.log(`  HTTP Status: ${t5.status} | Error: ${t5.json?.error || t5.text}`);

  if (t5.status === 403 && (t5.json?.error === "SECURITY_UNTRUSTED_TENANT" || t5.text.includes("TENANT_MISMATCH"))) {
    console.log("  >>> PASS: Safely blocked cross-tenant spoofing attempt with HTTP 403.");
    results.push({ name: "Cross-Tenant Spoofing -> HTTP 403", pass: true });
  } else {
    console.error("  >>> FAIL:", t5);
    results.push({ name: "Cross-Tenant Spoofing -> HTTP 403", pass: false });
  }

  // --------------------------------------------------------------------------
  // TEST 6: Format Text Fallback Negotiation -> HTTP 200 text/plain
  // --------------------------------------------------------------------------
  console.log("\n[Test 6/6] Testing Format Text Fallback -> Expect HTTP 200 text/plain");
  const t6Url = `${GATEWAY_URL}/exotel/connect-destination?CallSid=${textCallSid}&CallTo=${DAYA_EXOPHONE}&CallFrom=${encodeURIComponent(
    SYNTHETIC_CALLER
  )}&hospitalId=hosp_daya_thrissur&type=HUMAN_TRANSFER&format=text`;

  const t6 = await probe("Format Text Fallback", t6Url);
  console.log(`  HTTP Status: ${t6.status}`);
  console.log(`  Content-Type: ${t6.contentType}`);
  console.log(`  Raw Text Body: "${t6.text.trim()}"`);

  if (t6.status === 200 && t6.contentType?.includes("text/plain") && isValidE164(t6.text.trim())) {
    console.log("  >>> PASS: Plain text fallback negotiation returned valid E.164 phone number.");
    results.push({ name: "Format Text Fallback -> HTTP 200 text/plain", pass: true, detail: t6.text.trim() });
  } else {
    console.error("  >>> FAIL:", t6);
    results.push({ name: "Format Text Fallback -> HTTP 200 text/plain", pass: false });
  }

  console.log("\n================================================================================");
  const allPassed = results.every((r) => r.pass);
  console.log(`SYNTHETIC VALIDATION SUMMARY: ${allPassed ? "ALL TESTS PASSED (100%)" : "SOME TESTS FAILED"}`);
  console.log("================================================================================");

  return { allPassed, results };
}

if (require.main === module) {
  runLiveConnectDestinationValidation().catch((err) => {
    console.error("Fatal validation failure:", err);
    process.exit(1);
  });
}
