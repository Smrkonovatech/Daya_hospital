/**
 * ============================================================================
 * SMRKO VOICE ACTION LAYER TEST SUITE (PHASE 3, 4, 8)
 * ============================================================================
 *
 * Verifies that SMRKO VOICE can take full action without falling back to
 * "I will forward this to the receptionist":
 * 1. GET /api/v1/voice-agent/doctors
 * 2. POST /api/v1/voice-agent/check-availability
 * 3. POST /api/v1/voice-agent/book-appointment
 * 4. POST /api/v1/voice-agent/reschedule-appointment
 * 5. POST /api/v1/voice-agent/cancel-appointment
 * 6. POST /api/v1/voice-agent/get-appointment
 * 7. POST /api/v1/voice-agent/emergency-escalate
 */

import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET as getDoctors } from "./doctors/route";
import { POST as checkAvailability } from "./check-availability/route";
import { POST as bookAppointment } from "./book-appointment/route";
import { POST as rescheduleAppointment } from "./reschedule-appointment/route";
import { POST as cancelAppointment } from "./cancel-appointment/route";
import { POST as getAppointment, GET as getAppointmentByQuery } from "./get-appointment/route";
import { POST as emergencyEscalate } from "./emergency-escalate/route";
import { actionsService } from "@/lib/services/actions-service";

describe("SMRKO VOICE Intelligence & Action Layer", () => {
  // --------------------------------------------------------------------------
  // 1. Doctor Directory Search
  // --------------------------------------------------------------------------
  it("1. get-doctors: Returns available consultants with specialties and consultation fees (Simulated)", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/voice-agent/doctors?department=Cardiology&simulate=true", {
      method: "GET",
      headers: { "x-hms-simulation": "true" },
    });

    const res = await getDoctors(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.count).toBeGreaterThan(0);
    expect(json.doctors[0].department).toContain("Cardiology");
    expect(json.doctors[0].consultationFee).toBe(600);
    expect(json.verbalSummaryMalayalam).toContain("ഡോക്ടർമാർ");
  });

  // --------------------------------------------------------------------------
  // 2. Doctor Slot Availability Check
  // --------------------------------------------------------------------------
  it("2. check-availability: Returns concrete available slots without passive handoff disclaimers (Simulated)", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/voice-agent/check-availability?simulate=true", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-hms-simulation": "true" },
      body: JSON.stringify({
        department: "Orthopaedics",
        preferredDate: "2026-11-28",
      }),
    });

    const res = await checkAvailability(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.available).toBe(true);
    expect(json.availableSlots.length).toBeGreaterThan(0);
    expect(json.verbalSummaryMalayalam).toContain("ലഭ്യമായ സമയങ്ങൾ");
    // Invariant: Must NOT contain the old provisional/disclaimer instructing to send to receptionist
    expect(json.agentInstructions).toBeUndefined();
    expect(json.disclaimerMalayalam).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // 3. Appointment Booking Execution
  // --------------------------------------------------------------------------
  it("3. book-appointment: Confirms booking with token number and logs auditable action (Simulated)", async () => {
    const testPhone = "+919846011223";
    const req = new NextRequest("http://localhost:3000/api/v1/voice-agent/book-appointment?simulate=true", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-hms-simulation": "true" },
      body: JSON.stringify({
        patientName: "Gopalan Nair",
        patientPhone: testPhone,
        department: "General Medicine",
        doctorName: "Dr. Anjali Menon",
        appointmentDate: "2026-11-28",
        slotTime: "10:30 AM",
      }),
    });

    const res = await bookAppointment(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.bookingReference).toMatch(/^DAYA-(OPD|HMS-OPD)-/);
    expect(json.tokenNumber).toBeGreaterThan(0);
    expect(json.verbalConfirmationMalayalam).toContain("വിജയകരമായി ബുക്ക് ചെയ്തിരിക്കുന്നു");
    expect(json.verbalConfirmationEnglish).toContain("confirmed");

    // Verify it was logged into actionsService ledger
    const actions = await actionsService.getActions({ searchQuery: testPhone });
    expect(actions.actions.length).toBeGreaterThan(0);
    expect(actions.actions[0].status).toBe("CONFIRMED");
  });

  // --------------------------------------------------------------------------
  // 4. Appointment Rescheduling Execution
  // --------------------------------------------------------------------------
  it("4. reschedule-appointment: Successfully moves booking to new date and slot (Simulated)", async () => {
    const bookingRef = "DAYA-HMS-OPD-78219";
    const req = new NextRequest("http://localhost:3000/api/v1/voice-agent/reschedule-appointment?simulate=true", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-hms-simulation": "true" },
      body: JSON.stringify({
        bookingRef,
        patientMobile: "+919846018392",
        targetDate: "2026-11-29",
        targetSlotTime: "11:00 AM",
      }),
    });

    const res = await rescheduleAppointment(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.bookingRef).toBe(bookingRef);
    expect(json.allocatedSlot).toContain("2026-11-29");
    expect(json.verbalConfirmationMalayalam).toContain("മാറ്റിയിരിക്കുന്നു");
  });

  // --------------------------------------------------------------------------
  // 5. Appointment Cancellation Execution
  // --------------------------------------------------------------------------
  it("5. cancel-appointment: Successfully cancels appointment and releases slot (Simulated)", async () => {
    const bookingRef = "DAYA-HMS-OPD-78220";
    const req = new NextRequest("http://localhost:3000/api/v1/voice-agent/cancel-appointment?simulate=true", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-hms-simulation": "true" },
      body: JSON.stringify({
        bookingRef,
        reason: "Patient travel schedule change",
      }),
    });

    const res = await cancelAppointment(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.cancelledRef).toBe(bookingRef);
    expect(json.verbalConfirmationMalayalam).toContain("റദ്ദാക്കിയിരിക്കുന്നു");
  });

  // --------------------------------------------------------------------------
  // 6. Appointment Lookup by Reference & Phone
  // --------------------------------------------------------------------------
  it("6. get-appointment: Retrieves status and details for caller (Simulated)", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/voice-agent/get-appointment?simulate=true", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-hms-simulation": "true" },
      body: JSON.stringify({
        bookingRef: "DAYA-HMS-OPD-78219",
      }),
    });

    const res = await getAppointment(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.found).toBe(true);
    expect(json.status).toBe("CONFIRMED");
    expect(json.verbalSummaryMalayalam).toContain("സ്ഥിരീകരിച്ചതാണ്");
  });

  // --------------------------------------------------------------------------
  // 7. Emergency Casualty Escalation
  // --------------------------------------------------------------------------
  it("7. emergency-escalate: Immediately escalates acute symptoms without delays", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/voice-agent/emergency-escalate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symptom: "Severe chest pain and sudden breathlessness",
        callerPhone: "+919447012345",
      }),
    });

    const res = await emergencyEscalate(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.action).toBe("FAST_TRACK_CASUALTY");
    expect(json.verbalAnnouncementMalayalam).toContain("അടിയന്തിര സാഹചര്യമായി കണക്കാക്കുന്നു");
    expect(json.verbalAnnouncementEnglish).toContain("emergency");
  });
});
