/**
 * ============================================================================
 * PHASE 2.1 — REAL DATA ENFORCEMENT & HMS DISCONNECTED VERIFICATION TEST SUITE
 * ============================================================================
 *
 * Verifies that when live Grandis HMS connectivity is unreachable (VPN pending):
 * 1. Automatic mock fallback is completely eliminated from the operational path.
 * 2. All appointment operations fail closed with explicit HTTP 503 HMS_UNAVAILABLE.
 * 3. NO fake booking references (e.g. DAYA-HMS-OPD-78219), fake tokens, or fake slots are generated.
 * 4. Caller is explicitly informed that booking cannot be completed autonomously and
 *    is guided to the human receptionist desk.
 */

import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET as getDoctors } from "./doctors/route";
import { POST as checkAvailability } from "./check-availability/route";
import { POST as bookAppointment } from "./book-appointment/route";
import { POST as rescheduleAppointment } from "./reschedule-appointment/route";
import { POST as cancelAppointment } from "./cancel-appointment/route";

describe("Phase 2.1 — Real Data Enforcement: Live HMS Disconnected Fail-Closed Behavior", () => {
  // --------------------------------------------------------------------------
  // 1. Doctors Directory Fails Closed
  // --------------------------------------------------------------------------
  it("1. get-doctors fails closed with 503 HMS_UNAVAILABLE when live HMS is disconnected", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/voice-agent/doctors?department=Cardiology", {
      method: "GET",
    });

    const res = await getDoctors(req);
    expect(res.status).toBe(503);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe("HMS_UNAVAILABLE");
    expect(json.hmsStatus).toBe("DISCONNECTED");
    expect(json.message).toContain("Grandis HMS API is temporarily unreachable");
    expect(json.verbalSummaryMalayalam).toContain("സാധിക്കുന്നില്ല");
  });

  // --------------------------------------------------------------------------
  // 2. Check Availability Fails Closed without Fabricated Slots
  // --------------------------------------------------------------------------
  it("2. check-availability fails closed with 503 HMS_UNAVAILABLE and zero fabricated slots", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/voice-agent/check-availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        department: "Orthopaedics",
        preferredDate: "2026-11-28",
      }),
    });

    const res = await checkAvailability(req);
    expect(res.status).toBe(503);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.available).toBe(false);
    expect(json.error).toBe("HMS_UNAVAILABLE");
    expect(json.hmsStatus).toBe("DISCONNECTED");
    expect(json.agentInstructions).toContain("receptionist_transfer");
  });

  // --------------------------------------------------------------------------
  // 3. Book Appointment Fails Closed: ZERO Fake References Generated
  // --------------------------------------------------------------------------
  it("3. book-appointment fails closed with 503 and strictly generates ZERO fake booking references", async () => {
    const testPhone = "+919846011223";
    const req = new NextRequest("http://localhost:3000/api/v1/voice-agent/book-appointment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientName: "Biju Parakkal",
        patientPhone: testPhone,
        department: "Orthopaedics",
        doctorName: "Dr. Suresh Kumar",
        appointmentDate: "2026-11-28",
        slotTime: "10:30 AM",
      }),
    });

    const res = await bookAppointment(req);
    expect(res.status).toBe(503);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.confirmed).toBe(false);
    expect(json.bookingReference).toBeNull();
    expect(json.tokenNumber).toBeNull();
    expect(json.error).toBe("HMS_UNAVAILABLE");
    expect(json.hmsStatus).toBe("DISCONNECTED");
    expect(json.agentInstructions).toContain("Do NOT claim the appointment is booked");
  });

  // --------------------------------------------------------------------------
  // 4. Reschedule Fails Closed
  // --------------------------------------------------------------------------
  it("4. reschedule-appointment fails closed with 503 HMS_UNAVAILABLE", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/voice-agent/reschedule-appointment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingRef: "DAYA-HMS-OPD-78219",
        patientMobile: "+919846018392",
        targetDate: "2026-11-29",
        targetSlotTime: "11:00 AM",
      }),
    });

    const res = await rescheduleAppointment(req);
    expect(res.status).toBe(503);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe("HMS_UNAVAILABLE");
    expect(json.hmsStatus).toBe("DISCONNECTED");
  });

  // --------------------------------------------------------------------------
  // 5. Cancel Fails Closed
  // --------------------------------------------------------------------------
  it("5. cancel-appointment fails closed with 503 HMS_UNAVAILABLE", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/voice-agent/cancel-appointment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingRef: "DAYA-HMS-OPD-78220",
        reason: "Patient travel schedule change",
      }),
    });

    const res = await cancelAppointment(req);
    expect(res.status).toBe(503);

    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe("HMS_UNAVAILABLE");
    expect(json.hmsStatus).toBe("DISCONNECTED");
  });
});
