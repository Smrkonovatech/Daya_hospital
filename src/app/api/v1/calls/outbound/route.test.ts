import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { createSessionToken } from "@/lib/auth/session";

describe("POST /api/v1/calls/outbound (Standardized Outbound Calling API)", () => {
  let validToken: string;

  beforeEach(async () => {
    validToken = await createSessionToken({
      userId: "usr_test_01",
      name: "Dr. Admin",
      email: "admin@dayahospital.com",
      role: "HOSPITAL_ADMIN",
      department: "Administration",
      canAccessRecordings: true,
    });
  });

  it("returns 401 Unauthorized when missing authentication credentials", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/calls/outbound", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        hospitalId: "daya-hospital",
        patientId: "P-101",
        phoneNumber: "+919846123456",
        purpose: "APPOINTMENT_CONFIRMATION",
        idempotencyKey: `idem_unauth_${Date.now()}`,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("Unauthorized");
  });

  it("returns 422 Unprocessable Entity when phone number is malformed", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/calls/outbound", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${validToken}`,
      },
      body: JSON.stringify({
        hospitalId: "daya-hospital",
        patientId: "P-101",
        phoneNumber: "invalid-1234",
        purpose: "APPOINTMENT_CONFIRMATION",
        idempotencyKey: `idem_inv_phone_${Date.now()}`,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("Invalid phone number");
  });

  it("returns 422 Unprocessable Entity if target number matches Daya receptionist emergency number (+91 96066 54032)", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/calls/outbound", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${validToken}`,
      },
      body: JSON.stringify({
        hospitalId: "daya-hospital",
        patientId: "P-GUARD",
        phoneNumber: "+91 96066 54032",
        purpose: "APPOINTMENT_CONFIRMATION",
        idempotencyKey: `idem_rec_guard_${Date.now()}`,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("Emergency destination number");
  });

  it("returns 422 Unprocessable Entity when required fields are missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/calls/outbound", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${validToken}`,
      },
      body: JSON.stringify({
        // Missing hospitalId, patientId, idempotencyKey
        phoneNumber: "+919846123456",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  it("successfully initiates outbound call and returns 201 Created with standardized payload", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/calls/outbound", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${validToken}`,
        "x-correlation-id": "test_corr_id_999",
      },
      body: JSON.stringify({
        hospitalId: "daya-hospital",
        patientId: "P-CONFIRM-99",
        phoneNumber: "+919846998877",
        purpose: "APPOINTMENT_CONFIRMATION",
        mode: "AI",
        language: "ml-IN",
        context: {
          appointmentId: "APT-9901",
        },
        idempotencyKey: `idem_success_${Date.now()}`,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(res.headers.get("x-correlation-id")).toBe("test_corr_id_999");

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.callId).toMatch(/^call_/);
    expect(data.callSid).toBeDefined();
    expect(data.status).toBe("INITIATED");
    expect(data.phoneNumber).toBe("+919846998877");
    expect(data.hospitalId).toBe("hosp_daya_thrissur");
  });

  it("handles duplicate idempotencyKey by returning 200 OK with isDuplicateReplay flag", async () => {
    const key = `idem_dup_api_${Date.now()}`;
    const payload = {
      hospitalId: "daya-hospital",
      patientId: "P-DUP-API",
      phoneNumber: "+919846554433",
      purpose: "APPOINTMENT_CONFIRMATION",
      idempotencyKey: key,
    };

    // First request -> 201
    const req1 = new NextRequest("http://localhost:3000/api/v1/calls/outbound", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${validToken}`,
      },
      body: JSON.stringify(payload),
    });
    const res1 = await POST(req1);
    expect(res1.status).toBe(201);
    const data1 = await res1.json();

    // Duplicate request -> 200 idempotent replay
    const req2 = new NextRequest("http://localhost:3000/api/v1/calls/outbound", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${validToken}`,
      },
      body: JSON.stringify(payload),
    });
    const res2 = await POST(req2);
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.isDuplicateReplay).toBe(true);
    expect(data2.callId).toBe(data1.callId);
    expect(data2.callSid).toBe(data1.callSid);
  });
});

