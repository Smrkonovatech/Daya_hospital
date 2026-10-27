import { describe, it, expect } from "vitest";
import { MockDayaHmsAdapter } from "./mock-adapter";

describe("MockDayaHmsAdapter", () => {
  const adapter = new MockDayaHmsAdapter();

  it("returns healthy status on healthCheck", async () => {
    const health = await adapter.healthCheck();
    expect(health.status).toBe("HEALTHY");
    expect(health.mode).toBe("MOCK_MODE");
    expect(health.service).toBe("daya_hms");
  });

  it("checks doctor availability slots", async () => {
    const slots = await adapter.checkDoctorSlots("DOC_ORTHO_01", "2026-10-28");
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0].doctorName).toBe("Dr. Suresh Kumar");
    expect(slots[0].consultationFee).toBe(450);
  });

  it("books appointment and returns valid HMS reference and token", async () => {
    const result = await adapter.bookAppointment({
      doctorId: "DOC_ORTHO_01",
      doctorName: "Dr. Suresh Kumar",
      department: "Orthopaedics",
      date: "2026-10-28",
      slotTime: "10:30 AM",
      patientMobile: "+919846018392",
      patientName: "Krishnan Namboothiri",
      idempotencyKey: "test_idem_booking_001",
    });

    expect(result.success).toBe(true);
    expect(result.bookingRef).toMatch(/^DAYA-HMS-OPD-\d+$/);
    expect(result.tokenNumber).toBeGreaterThan(0);
  });

  it("enforces idempotency on duplicate booking requests with same key", async () => {
    const input = {
      doctorId: "DOC_ORTHO_01",
      doctorName: "Dr. Suresh Kumar",
      department: "Orthopaedics",
      date: "2026-10-28",
      slotTime: "10:30 AM",
      patientMobile: "+919846018392",
      patientName: "Krishnan Namboothiri",
      idempotencyKey: "test_duplicate_idem_002",
    };

    const firstCall = await adapter.bookAppointment(input);
    const secondCall = await adapter.bookAppointment(input);

    expect(firstCall.bookingRef).toBe(secondCall.bookingRef);
    expect(firstCall.tokenNumber).toBe(secondCall.tokenNumber);
  });

  it("cancels appointment successfully", async () => {
    const result = await adapter.cancelAppointment(
      "DAYA-HMS-OPD-78219",
      "test_cancel_idem_001"
    );
    expect(result.success).toBe(true);
    expect(result.cancelledRef).toBe("DAYA-HMS-OPD-78219");
  });
});
