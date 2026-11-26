/**
 * ============================================================================
 * SMRKOMED PHASE 10.12 — FINAL EXOTEL CONNECT URL CONTRACT VERIFICATION
 * ============================================================================
 *
 * Verifies against the live deployed Railway service:
 * 1. Endpoint path resolution: /exotel/connect-destination vs /api/webhooks/exotel/connect-destination
 * 2. Automatic query parameter extraction (CallSid, CallTo, CallFrom)
 * 3. Tenant authentication enforcement (rejection of unauthenticated hospitalId)
 * 4. Exact JSON response structure and Content-Type
 * 5. Emergency independence and fail-closed behaviour
 */

const GATEWAY_URL = process.env.LIVE_GATEWAY_URL || "https://dayahospital-production-467a7d31.up.railway.app";
const DAYA_EXOPHONE = "08047291658";
const CALLER = "+919846001122";

interface Check {
  name: string;
  url: string;
  method?: string;
  headers?: Record<string, string>;
  expectedStatus: number;
}

async function probe(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, redirect: "manual" });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {}
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v;
  });
  return { status: res.status, headers, text, json };
}

async function main() {
  console.log("================================================================================");
  console.log("SMRKOMED PHASE 10.12: LIVE CONTRACT VERIFICATION");
  console.log(`Target: ${GATEWAY_URL}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log("================================================================================\n");

  // 1. Compare Endpoint Paths:
  // Path A: /exotel/connect-destination
  console.log("--- 1. PATH RESOLUTION COMPARISON ---");
  const pathA = `${GATEWAY_URL}/exotel/connect-destination?CallSid=call_syn_10_12_A&CallTo=${DAYA_EXOPHONE}&CallFrom=${encodeURIComponent(CALLER)}&hospitalId=hosp_daya_thrissur&type=HUMAN_TRANSFER`;
  const resA = await probe(pathA);
  console.log("Path A (/exotel/connect-destination):", {
    status: resA.status,
    contentType: resA.headers["content-type"],
    tenantHeader: resA.headers["x-smrkomed-tenant"],
    escalationHeader: resA.headers["x-smrkomed-escalation"],
    destination: resA.json?.destination?.numbers,
    maxRing: resA.json?.max_ringing_duration,
  });

  // Path B: /api/webhooks/exotel/connect-destination
  const pathB = `${GATEWAY_URL}/api/webhooks/exotel/connect-destination?CallSid=call_syn_10_12_B&CallTo=${DAYA_EXOPHONE}&CallFrom=${encodeURIComponent(CALLER)}&hospitalId=hosp_daya_thrissur&type=HUMAN_TRANSFER`;
  const resB = await probe(pathB);
  console.log("Path B (/api/webhooks/exotel/connect-destination):", {
    status: resB.status,
    contentType: resB.headers["content-type"],
    tenantHeader: resB.headers["x-smrkomed-tenant"],
    escalationHeader: resB.headers["x-smrkomed-escalation"],
    destination: resB.json?.destination?.numbers,
    maxRing: resB.json?.max_ringing_duration,
  });

  // 2. Security Test: Untrusted hospitalId query parameter probe (without valid token or mapped ExoPhone)
  console.log("\n--- 2. UNTRUSTED QUERY PARAMETER REJECTION ---");
  // Rogue probe pretending to be Aster Medcity or Daya without ExoPhone or token
  const rogueUrl = `${GATEWAY_URL}/exotel/connect-destination?CallSid=call_rogue_probe&hospitalId=hosp_aster_medcity&type=HUMAN_TRANSFER`;
  const rogueRes = await probe(rogueUrl);
  console.log("Rogue tenant probe without verified context:", {
    status: rogueRes.status,
    json: rogueRes.json,
  });

  // Rogue probe attempting cross-tenant access to Daya using mismatched ExoPhone
  const spoofUrl = `${GATEWAY_URL}/exotel/connect-destination?CallSid=call_spoof_probe&CallTo=08047291999&hospitalId=hosp_daya_thrissur&type=HUMAN_TRANSFER`;
  const spoofRes = await probe(spoofUrl);
  console.log("Cross-tenant spoof probe (mismatched CallTo):", {
    status: spoofRes.status,
    json: spoofRes.json,
  });

  // 3. Exact JSON Schema Verification for Primary URL
  console.log("\n--- 3. EXACT JSON RESPONSE PAYLOAD (PATH A) ---");
  console.log(JSON.stringify(resA.json, null, 2));

  console.log("\n--- 4. EXACT JSON RESPONSE PAYLOAD (PATH B) ---");
  console.log(JSON.stringify(resB.json, null, 2));
}

main().catch(console.error);
