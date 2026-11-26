import { prisma, checkDatabaseConnection } from "../../src/lib/db/prisma";

const GATEWAY_URL = "https://dayahospital-production-467a7d31.up.railway.app";

async function runLivePassthruValidation() {
  console.log("================================================================================");
  console.log("PHASE 9.5.3 — LIVE DEPLOYED /exotel/passthru ENDPOINT SYNTHETIC VALIDATION");
  console.log(`Target Railway Gateway: ${GATEWAY_URL}`);
  console.log("================================================================================\n");

  const dbStatus = await checkDatabaseConnection();
  console.log(`[Neon DB] Connected: ${dbStatus.connected}, Message: ${dbStatus.message}`);
  if (!dbStatus.connected) {
    throw new Error("Neon PostgreSQL database not accessible");
  }

  const now = Date.now();
  const humanCallSid = `syn_human_transfer_${now}`;
  const emergencyCallSid = `syn_emergency_${now}`;
  const expiredCallSid = `syn_expired_${now}`;
  const normalCallSid = `syn_normal_${now}`;
  const unknownCallSid = `syn_unknown_${now}`;

  console.log("\n[Setup] Seeding synthetic escalation records into Neon DB...");

  // 1. Seed HUMAN_TRANSFER
  await prisma.durableIdempotencyRecord.upsert({
    where: {
      hospitalId_idempotencyKey: {
        hospitalId: "hosp_daya_thrissur",
        idempotencyKey: `escalation_${humanCallSid}`,
      },
    },
    create: {
      hospitalId: "hosp_daya_thrissur",
      idempotencyKey: `escalation_${humanCallSid}`,
      resourceType: "CALL_ESCALATION",
      callSid: humanCallSid,
      status: "HUMAN_TRANSFER",
      responseJson: JSON.stringify({
        callSid: humanCallSid,
        hospitalId: "hosp_daya_thrissur",
        callerNumber: "+919846001122",
        escalationState: "HUMAN_TRANSFER",
        destination: "+919606654032",
        reason: "Synthetic test caller requested hospital receptionist",
        timestamp: now,
      }),
      expiresAt: new Date(now + 600000), // 10 minutes TTL
    },
    update: {},
  });

  // 2. Seed EMERGENCY
  await prisma.durableIdempotencyRecord.upsert({
    where: {
      hospitalId_idempotencyKey: {
        hospitalId: "hosp_daya_thrissur",
        idempotencyKey: `escalation_${emergencyCallSid}`,
      },
    },
    create: {
      hospitalId: "hosp_daya_thrissur",
      idempotencyKey: `escalation_${emergencyCallSid}`,
      resourceType: "CALL_ESCALATION",
      callSid: emergencyCallSid,
      status: "EMERGENCY",
      responseJson: JSON.stringify({
        callSid: emergencyCallSid,
        hospitalId: "hosp_daya_thrissur",
        callerNumber: "+919846009988",
        escalationState: "EMERGENCY",
        destination: "+919606654032",
        reason: "Synthetic test caller severe chest pain casualty escalation",
        timestamp: now,
      }),
      expiresAt: new Date(now + 600000), // 10 minutes TTL
    },
    update: {},
  });

  // 3. Seed EXPIRED record (expired 2 minutes ago)
  await prisma.durableIdempotencyRecord.upsert({
    where: {
      hospitalId_idempotencyKey: {
        hospitalId: "hosp_daya_thrissur",
        idempotencyKey: `escalation_${expiredCallSid}`,
      },
    },
    create: {
      hospitalId: "hosp_daya_thrissur",
      idempotencyKey: `escalation_${expiredCallSid}`,
      resourceType: "CALL_ESCALATION",
      callSid: expiredCallSid,
      status: "HUMAN_TRANSFER",
      responseJson: JSON.stringify({
        callSid: expiredCallSid,
        hospitalId: "hosp_daya_thrissur",
        callerNumber: "+919846003344",
        escalationState: "HUMAN_TRANSFER",
        destination: "+919606654032",
        reason: "Synthetic test caller expired transfer",
        timestamp: now - 660000,
      }),
      expiresAt: new Date(now - 60000), // Expired 1 min ago
    },
    update: {},
  });

  console.log("Seeding complete. Probing live Railway endpoint...\n");

  const results: any[] = [];

  // Helper function to test endpoint with manual redirect handling
  async function probe(testName: string, url: string, options: RequestInit = {}) {
    const res = await fetch(url, {
      ...options,
      redirect: "manual", // Do not follow 302 redirect so we can inspect status and Location header
    });
    const status = res.status;
    const location = res.headers.get("location");
    let json: any = null;
    try {
      json = await res.json();
    } catch {}

    return { testName, status, location, json };
  }

  // TEST 1: HUMAN_TRANSFER -> HTTP 200
  console.log("[Test 1/7] Testing HUMAN_TRANSFER escalation -> Expect HTTP 200");
  const t1 = await probe(
    "HUMAN_TRANSFER Escalation",
    `${GATEWAY_URL}/exotel/passthru?CallSid=${humanCallSid}`
  );
  console.log(`  Status: ${t1.status} | Action: ${t1.json?.action} | Destination: ${t1.json?.destination} | State: ${t1.json?.escalationState}`);
  if (t1.status === 200 && t1.json?.action === "CONNECT" && t1.json?.destination === "+919606654032" && t1.json?.escalationState === "HUMAN_TRANSFER") {
    console.log("  >>> PASS: Correctly routed to Choice A (Connect Applet) with HTTP 200");
    results.push({ name: "HUMAN_TRANSFER -> HTTP 200", pass: true, detail: t1.json });
  } else {
    console.error("  >>> FAIL:", t1);
    results.push({ name: "HUMAN_TRANSFER -> HTTP 200", pass: false, detail: t1 });
  }

  // TEST 2: EMERGENCY -> HTTP 200
  console.log("\n[Test 2/7] Testing EMERGENCY escalation -> Expect HTTP 200");
  const t2 = await probe(
    "EMERGENCY Escalation",
    `${GATEWAY_URL}/exotel/passthru?CallSid=${emergencyCallSid}`
  );
  console.log(`  Status: ${t2.status} | Action: ${t2.json?.action} | Destination: ${t2.json?.destination} | State: ${t2.json?.escalationState}`);
  if (t2.status === 200 && t2.json?.action === "CONNECT" && t2.json?.destination === "+919606654032" && t2.json?.escalationState === "EMERGENCY") {
    console.log("  >>> PASS: Correctly routed to Choice A (Connect Applet) with HTTP 200");
    results.push({ name: "EMERGENCY -> HTTP 200", pass: true, detail: t2.json });
  } else {
    console.error("  >>> FAIL:", t2);
    results.push({ name: "EMERGENCY -> HTTP 200", pass: false, detail: t2 });
  }

  // TEST 3: Normal completion -> HTTP 302
  console.log("\n[Test 3/7] Testing Normal Call Completion (No escalation) -> Expect HTTP 302");
  const t3 = await probe(
    "Normal Completion",
    `${GATEWAY_URL}/exotel/passthru?CallSid=${normalCallSid}`
  );
  console.log(`  Status: ${t3.status} | Location: ${t3.location} | Action: ${t3.json?.action} | Reason: "${t3.json?.reason}"`);
  if (t3.status === 302 && t3.json?.action === "HANGUP" && t3.location === "#") {
    console.log("  >>> PASS: Correctly routed to Choice B (Hangup Applet) with HTTP 302 and Location: #");
    results.push({ name: "Normal Completion -> HTTP 302", pass: true, detail: t3.json });
  } else {
    console.error("  >>> FAIL:", t3);
    results.push({ name: "Normal Completion -> HTTP 302", pass: false, detail: t3 });
  }

  // TEST 4: Unknown CallSid -> Safe Failure (HTTP 302)
  console.log("\n[Test 4/7] Testing Unknown CallSid -> Expect HTTP 302");
  const t4 = await probe(
    "Unknown CallSid",
    `${GATEWAY_URL}/exotel/passthru?CallSid=${unknownCallSid}`
  );
  console.log(`  Status: ${t4.status} | Location: ${t4.location} | Action: ${t4.json?.action}`);
  if (t4.status === 302 && t4.json?.action === "HANGUP") {
    console.log("  >>> PASS: Safely rejected unknown CallSid with HTTP 302 Hangup");
    results.push({ name: "Unknown CallSid -> HTTP 302", pass: true, detail: t4.json });
  } else {
    console.error("  >>> FAIL:", t4);
    results.push({ name: "Unknown CallSid -> HTTP 302", pass: false, detail: t4 });
  }

  // TEST 5: Expired CallSid (>10m TTL) -> Safe Failure (HTTP 302)
  console.log("\n[Test 5/7] Testing Expired CallSid (TTL elapsed) -> Expect HTTP 302");
  const t5 = await probe(
    "Expired CallSid",
    `${GATEWAY_URL}/exotel/passthru?CallSid=${expiredCallSid}`
  );
  console.log(`  Status: ${t5.status} | Location: ${t5.location} | Action: ${t5.json?.action}`);
  if (t5.status === 302 && t5.json?.action === "HANGUP") {
    console.log("  >>> PASS: Correctly expired stale record and routed to HTTP 302 Hangup");
    results.push({ name: "Expired CallSid -> HTTP 302", pass: true, detail: t5.json });
  } else {
    console.error("  >>> FAIL:", t5);
    results.push({ name: "Expired CallSid -> HTTP 302", pass: false, detail: t5 });
  }

  // TEST 6: Duplicate Request Replay -> Idempotent HTTP 200
  console.log("\n[Test 6/7] Testing Duplicate Replay (Exotel network retry) -> Expect Idempotent HTTP 200");
  const t6 = await probe(
    "Duplicate Request Replay",
    `${GATEWAY_URL}/exotel/passthru?CallSid=${humanCallSid}`
  );
  console.log(`  Status: ${t6.status} | Action: ${t6.json?.action} | CallSid: ${t6.json?.callSid}`);
  if (t6.status === 200 && t6.json?.action === "CONNECT" && t6.json?.callSid === humanCallSid) {
    console.log("  >>> PASS: Duplicate request yielded identical idempotent HTTP 200 CONNECT response");
    results.push({ name: "Duplicate Request Replay -> Idempotent HTTP 200", pass: true, detail: t6.json });
  } else {
    console.error("  >>> FAIL:", t6);
    results.push({ name: "Duplicate Request Replay -> Idempotent HTTP 200", pass: false, detail: t6 });
  }

  // TEST 7: POST method (Form-urlencoded payload) -> HTTP 200
  console.log("\n[Test 7/7] Testing POST Request (Form-URLencoded) -> Expect HTTP 200");
  const t7 = await probe(
    "POST Form-URLencoded",
    `${GATEWAY_URL}/exotel/passthru`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `CallSid=${humanCallSid}&From=%2B919846001122`,
    }
  );
  console.log(`  Status: ${t7.status} | Action: ${t7.json?.action} | Destination: ${t7.json?.destination}`);
  if (t7.status === 200 && t7.json?.action === "CONNECT") {
    console.log("  >>> PASS: POST method correctly handled and returned HTTP 200 CONNECT");
    results.push({ name: "POST Method -> HTTP 200", pass: true, detail: t7.json });
  } else {
    console.error("  >>> FAIL:", t7);
    results.push({ name: "POST Method -> HTTP 200", pass: false, detail: t7 });
  }

  // Cleanup synthetic records from DB
  console.log("\n[Cleanup] Removing synthetic test records from Neon DB...");
  await prisma.durableIdempotencyRecord.deleteMany({
    where: {
      idempotencyKey: {
        in: [
          `escalation_${humanCallSid}`,
          `escalation_${emergencyCallSid}`,
          `escalation_${expiredCallSid}`,
        ],
      },
    },
  });
  console.log("Cleanup complete.");

  const allPassed = results.every((r) => r.pass);
  console.log("\n================================================================================");
  console.log(`VALIDATION SUMMARY: ${allPassed ? "ALL 7 TESTS PASSED (100%)" : "SOME TESTS FAILED"}`);
  console.log("================================================================================");

  process.exit(allPassed ? 0 : 1);
}

runLivePassthruValidation().catch((err) => {
  console.error("Fatal validation error:", err);
  process.exit(1);
});

