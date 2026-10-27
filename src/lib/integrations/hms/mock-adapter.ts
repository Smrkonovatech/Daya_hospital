import {
  IDayaHmsAdapter,
  IntegrationHealth,
  Doctor,
  Department,
  DoctorSlot,
  Patient,
  BookAppointmentInput,
  BookAppointmentResult,
  RescheduleAppointmentInput,
  CancelAppointmentResult,
} from "../types";

const MOCK_DOCTORS: Doctor[] = [
  {
    doctorId: "DOC-ENT-012",
    doctorName: "Dr. Rajesh Kumar",
    department: "ENT & Head-Neck Surgery",
    qualifications: "MBBS, MS (ENT), DNB",
    opdDays: ["Monday", "Wednesday", "Friday"],
    consultationFee: 450,
  },
  {
    doctorId: "DOC-ORTHO-004",
    doctorName: "Dr. Suresh Kumar",
    department: "Orthopaedics & Joint Replacement",
    qualifications: "MBBS, MS (Ortho), MCh",
    opdDays: ["Tuesday", "Thursday", "Saturday"],
    consultationFee: 450,
  },
  {
    doctorId: "DOC-GASTRO-007",
    doctorName: "Dr. Vinod",
    department: "Gastroenterology",
    qualifications: "MD, DM (Gastroenterology)",
    opdDays: ["Tuesday", "Saturday"],
    consultationFee: 600,
  },
  {
    doctorId: "DOC-CARDIO-001",
    doctorName: "Dr. K. R. Balakrishnan",
    department: "Cardiology & Interventional Care",
    qualifications: "MD, DM (Cardio), FACC",
    opdDays: ["Monday", "Tuesday", "Thursday"],
    consultationFee: 600,
  },
  {
    doctorId: "DOC-PAED-009",
    doctorName: "Dr. Latha Menon",
    department: "Paediatrics & Neonatology",
    qualifications: "MBBS, DCH, MD (Paediatrics)",
    opdDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    consultationFee: 350,
  },
  {
    doctorId: "DOC-GEN-002",
    doctorName: "Dr. Anjali Menon",
    department: "General Medicine",
    qualifications: "MBBS, MD (General Medicine)",
    opdDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    consultationFee: 250,
  },
];

const MOCK_DEPARTMENTS: Department[] = [
  { id: "DEP-ENT", name: "ENT & Head-Neck Surgery", hodName: "Dr. Rajesh Kumar", roomNumbers: "OPD 14-16" },
  { id: "DEP-ORTHO", name: "Orthopaedics & Joint Replacement", hodName: "Dr. Suresh Kumar", roomNumbers: "OPD 20-24" },
  { id: "DEP-GASTRO", name: "Gastroenterology", hodName: "Dr. Vinod", roomNumbers: "OPD 18" },
  { id: "DEP-CARDIO", name: "Cardiology", hodName: "Dr. K. R. Balakrishnan", roomNumbers: "Block B, 1st Floor" },
  { id: "DEP-PAED", name: "Paediatrics", hodName: "Dr. Latha Menon", roomNumbers: "OPD 05-08" },
  { id: "DEP-GEN", name: "General Medicine", hodName: "Dr. Anjali Menon", roomNumbers: "OPD 01-04" },
  { id: "DEP-CASUALTY", name: "Emergency Casualty & Trauma", hodName: "Dr. Manoj Kumar", roomNumbers: "Ground Floor 24/7" },
];

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

  async getDoctors(department?: string): Promise<Doctor[]> {
    if (!department) return [...MOCK_DOCTORS];
    return MOCK_DOCTORS.filter(
      (d) => d.department.toLowerCase().includes(department.toLowerCase())
    );
  }

  async getDepartments(): Promise<Department[]> {
    return [...MOCK_DEPARTMENTS];
  }

  async checkDoctorSlots(doctorId: string, date: string): Promise<DoctorSlot[]> {
    const doctor = MOCK_DOCTORS.find((d) => d.doctorId === doctorId || d.doctorName.includes(doctorId));
    const docName = doctor?.doctorName || "Dr. Suresh Kumar";
    const depName = doctor?.department || "Orthopaedics & Joint Replacement";
    const fee = doctor?.consultationFee || 450;

    return [
      {
        slotId: `SLOT_${doctorId}_0930`,
        doctorId,
        doctorName: docName,
        department: depName,
        date,
        time: "09:30 AM",
        isAvailable: true,
        consultationFee: fee,
      },
      {
        slotId: `SLOT_${doctorId}_1030`,
        doctorId,
        doctorName: docName,
        department: depName,
        date,
        time: "10:30 AM",
        isAvailable: true,
        consultationFee: fee,
      },
      {
        slotId: `SLOT_${doctorId}_1145`,
        doctorId,
        doctorName: docName,
        department: depName,
        date,
        time: "11:45 AM",
        isAvailable: false,
        consultationFee: fee,
      },
    ];
  }

  async lookupPatientByMobile(mobile: string): Promise<Patient | null> {
    if (mobile.includes("94471") || mobile.includes("98460")) {
      return {
        uhid: "DGH-2026-4412",
        name: "Saritha Varma",
        mobile,
        age: 42,
        gender: "Female",
      };
    }
    return null;
  }

  async bookAppointment(input: BookAppointmentInput): Promise<BookAppointmentResult> {
    // 1. Validation check
    if (!input.patientMobile || input.patientMobile.length < 10) {
      return {
        success: false,
        error: "Valid 10-digit patient mobile number is required by Daya HMS.",
        errorCode: "VALIDATION_FAILED",
      };
    }

    // 2. Idempotency check
    if (idempotencyStore.has(input.idempotencyKey)) {
      return idempotencyStore.get(input.idempotencyKey)!;
    }

    // 3. Simulated timeout check
    if (input.slotTime.includes("Timeout")) {
      const timeoutResult: BookAppointmentResult = {
        success: false,
        error: "HMS token allocation gateway timed out after 3000ms.",
        errorCode: "HMS_TIMEOUT",
        retryAfterMs: 2000,
      };
      return timeoutResult;
    }

    // 4. Quota / slot full check
    if (input.slotTime.includes("Full")) {
      const failResult: BookAppointmentResult = {
        success: false,
        error: "Requested OPD quota reached for this consultant session.",
        errorCode: "SLOT_UNAVAILABLE",
      };
      idempotencyStore.set(input.idempotencyKey, failResult);
      return failResult;
    }

    // 5. Generate confirmed booking reference
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

    if (input.bookingRef === "INVALID_REF") {
      const errResult: BookAppointmentResult = {
        success: false,
        error: "Existing booking reference not found in Daya HMS system.",
        errorCode: "PATIENT_NOT_FOUND",
      };
      idempotencyStore.set(input.idempotencyKey, errResult);
      return errResult;
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
    if (bookingRef === "INVALID_REF") {
      return {
        success: false,
        cancelledRef: bookingRef,
        error: "No active appointment found matching reference.",
      };
    }

    return {
      success: true,
      cancelledRef: bookingRef,
      releasedSlot: "Released back into Daya HMS OPD inventory pool",
    };
  }

  async verifyBooking(bookingRef: string): Promise<{
    verified: boolean;
    bookingRef: string;
    doctorName?: string;
    slot?: string;
    status: "CONFIRMED" | "NOT_FOUND" | "CANCELLED";
  }> {
    const validRefs = [
      "DAYA-HMS-OPD-78219",
      "DAYA-HMS-OPD-78220",
      "DAYA-HMS-OPD-77189",
      "DAYA-HMS-OPD-71004",
    ];

    if (validRefs.includes(bookingRef) || bookingRef.startsWith("DAYA-HMS-OPD-")) {
      return {
        verified: true,
        bookingRef,
        doctorName: "Dr. Suresh Kumar",
        slot: "OPD Slot Token #14",
        status: "CONFIRMED",
      };
    }

    return {
      verified: false,
      bookingRef,
      status: "NOT_FOUND",
    };
  }
}
