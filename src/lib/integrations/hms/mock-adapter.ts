import {
  IDayaHmsAdapter,
  IntegrationHealth,
  DoctorSlot,
  BookAppointmentInput,
  BookAppointmentResult,
  RescheduleAppointmentInput,
  CancelAppointmentResult,
} from "../types";

/**
 * In-memory idempotency cache for local development/mock sandbox
 */
const idempotencyStore = new Map<string, BookAppointmentResult>();

export class MockDayaHmsAdapter implements IDayaHmsAdapter {
  async healthCheck(): Promise<IntegrationHealth> {
    return {
      service: "daya_hms",
      status: "HEALTHY",
      latencyMs: 145,
      mode: "MOCK_MODE",
      lastChecked: new Date().toISOString(),
      details: "Mock Daya HMS Adapter — Simulated Sandbox API",
    };
  }

  async checkDoctorSlots(doctorId: string, date: string): Promise<DoctorSlot[]> {
    // Return realistic slots for Daya Hospital consultants
    return [
      {
        slotId: `SLOT_${doctorId}_0930`,
        doctorId,
        doctorName: "Dr. Suresh Kumar",
        department: "Orthopaedics & Joint Replacement",
        date,
        time: "09:30 AM",
        isAvailable: true,
        consultationFee: 450,
      },
      {
        slotId: `SLOT_${doctorId}_1030`,
        doctorId,
        doctorName: "Dr. Suresh Kumar",
        department: "Orthopaedics & Joint Replacement",
        date,
        time: "10:30 AM",
        isAvailable: true,
        consultationFee: 450,
      },
      {
        slotId: `SLOT_${doctorId}_1145`,
        doctorId,
        doctorName: "Dr. Suresh Kumar",
        department: "Orthopaedics & Joint Replacement",
        date,
        time: "11:45 AM",
        isAvailable: false,
        consultationFee: 450,
      },
    ];
  }

  async bookAppointment(input: BookAppointmentInput): Promise<BookAppointmentResult> {
    // 1. Idempotency check: If key already processed, return existing result without duplicate side-effects
    if (idempotencyStore.has(input.idempotencyKey)) {
      return idempotencyStore.get(input.idempotencyKey)!;
    }

    // 2. Simulate slot availability check
    if (input.slotTime.includes("Full")) {
      const failResult: BookAppointmentResult = {
        success: false,
        error: "Requested OPD quota reached for this consultant session.",
        errorCode: "SLOT_UNAVAILABLE",
      };
      idempotencyStore.set(input.idempotencyKey, failResult);
      return failResult;
    }

    // 3. Generate confirmed booking reference
    const randomToken = Math.floor(Math.random() * 20) + 10;
    const refId = `DAYA-HMS-OPD-${Math.floor(10000 + Math.random() * 90000)}`;

    const successResult: BookAppointmentResult = {
      success: true,
      bookingRef: refId,
      tokenNumber: randomToken,
      consultationFee: 450,
      allocatedSlot: `${input.date} - ${input.slotTime}`,
    };

    idempotencyStore.set(input.idempotencyKey, successResult);
    return successResult;
  }

  async rescheduleAppointment(input: RescheduleAppointmentInput): Promise<BookAppointmentResult> {
    if (idempotencyStore.has(input.idempotencyKey)) {
      return idempotencyStore.get(input.idempotencyKey)!;
    }

    const updatedResult: BookAppointmentResult = {
      success: true,
      bookingRef: input.bookingRef,
      tokenNumber: 8,
      allocatedSlot: `${input.targetDate} - ${input.targetSlotTime}`,
    };

    idempotencyStore.set(input.idempotencyKey, updatedResult);
    return updatedResult;
  }

  async cancelAppointment(
    bookingRef: string,
    idempotencyKey: string
  ): Promise<CancelAppointmentResult> {
    void idempotencyKey;
    return {
      success: true,
      cancelledRef: bookingRef,
      releasedSlot: "Released back into Daya HMS OPD inventory pool",
    };
  }
}
