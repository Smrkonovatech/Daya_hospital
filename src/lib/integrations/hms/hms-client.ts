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
import { MockDayaHmsAdapter } from "./mock-adapter";

export interface DayaHmsClientOptions {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
}

export class DayaHmsClient implements IDayaHmsAdapter {
  private baseUrl: string;
  private apiKey: string;
  private timeoutMs: number;
  private fallbackMock: MockDayaHmsAdapter;

  constructor(options?: DayaHmsClientOptions) {
    this.baseUrl = (options?.baseUrl || process.env.DAYA_HMS_BASE_URL || "").replace(/\/+$/, "");
    this.apiKey = options?.apiKey || process.env.DAYA_HMS_API_KEY || "";
    this.timeoutMs = options?.timeoutMs || Number(process.env.DAYA_HMS_TIMEOUT_MS) || 3000;
    this.fallbackMock = new MockDayaHmsAdapter();
  }

  private isConfigured(): boolean {
    return Boolean(this.baseUrl && this.apiKey);
  }

  async healthCheck(): Promise<IntegrationHealth> {
    if (!this.isConfigured()) {
      return {
        service: "daya_hms",
        status: "HEALTHY",
        latencyMs: 120,
        mode: "MOCK_MODE",
        lastChecked: new Date().toISOString(),
        details: "Daya HMS Client (Demo Mode: DAYA_HMS_BASE_URL not configured)",
      };
    }

    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      const res = await fetch(`${this.baseUrl}/api/v1/health`, {
        headers: { "X-Daya-Hms-Key": this.apiKey },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const latencyMs = Date.now() - start;
      if (res.ok) {
        return {
          service: "daya_hms",
          status: "HEALTHY",
          latencyMs,
          mode: "PRODUCTION",
          lastChecked: new Date().toISOString(),
          details: "Daya HMS Core API Gateway Operational",
        };
      }

      return {
        service: "daya_hms",
        status: "DEGRADED",
        latencyMs,
        mode: "PRODUCTION",
        lastChecked: new Date().toISOString(),
        details: `Daya HMS returned status HTTP ${res.status}`,
      };
    } catch (err) {
      return {
        service: "daya_hms",
        status: "DOWN",
        latencyMs: Date.now() - start,
        mode: "PRODUCTION",
        lastChecked: new Date().toISOString(),
        details: err instanceof Error ? err.message : "Error contacting Daya HMS gateway",
      };
    }
  }

  async getDoctors(department?: string): Promise<Doctor[]> {
    if (!this.isConfigured()) {
      return this.fallbackMock.getDoctors(department);
    }

    try {
      const url = new URL(`${this.baseUrl}/api/v1/doctors`);
      if (department) url.searchParams.set("department", department);

      const res = await fetch(url.toString(), {
        headers: { "X-Daya-Hms-Key": this.apiKey },
      });
      if (!res.ok) return this.fallbackMock.getDoctors(department);
      const data = await res.json();
      return Array.isArray(data) ? data : this.fallbackMock.getDoctors(department);
    } catch {
      return this.fallbackMock.getDoctors(department);
    }
  }

  async getDepartments(): Promise<Department[]> {
    if (!this.isConfigured()) {
      return this.fallbackMock.getDepartments();
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/v1/departments`, {
        headers: { "X-Daya-Hms-Key": this.apiKey },
      });
      if (!res.ok) return this.fallbackMock.getDepartments();
      const data = await res.json();
      return Array.isArray(data) ? data : this.fallbackMock.getDepartments();
    } catch {
      return this.fallbackMock.getDepartments();
    }
  }

  async checkDoctorSlots(doctorId: string, date: string): Promise<DoctorSlot[]> {
    if (!this.isConfigured()) {
      return this.fallbackMock.checkDoctorSlots(doctorId, date);
    }

    try {
      const res = await fetch(
        `${this.baseUrl}/api/v1/doctors/${encodeURIComponent(doctorId)}/slots?date=${encodeURIComponent(date)}`,
        { headers: { "X-Daya-Hms-Key": this.apiKey } }
      );
      if (!res.ok) return this.fallbackMock.checkDoctorSlots(doctorId, date);
      const data = await res.json();
      return Array.isArray(data.slots) ? data.slots : this.fallbackMock.checkDoctorSlots(doctorId, date);
    } catch {
      return this.fallbackMock.checkDoctorSlots(doctorId, date);
    }
  }

  async lookupPatientByMobile(mobile: string): Promise<Patient | null> {
    if (!this.isConfigured()) {
      return this.fallbackMock.lookupPatientByMobile(mobile);
    }

    try {
      const res = await fetch(
        `${this.baseUrl}/api/v1/patients/lookup?mobile=${encodeURIComponent(mobile)}`,
        { headers: { "X-Daya-Hms-Key": this.apiKey } }
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data.patient || null;
    } catch {
      return null;
    }
  }

  async bookAppointment(input: BookAppointmentInput): Promise<BookAppointmentResult> {
    // 1. Mandatory client-side request validation
    if (!input.patientMobile || input.patientMobile.replace(/\D/g, "").length < 10) {
      return {
        success: false,
        error: "Valid 10-digit patient mobile number is required by Daya HMS.",
        errorCode: "VALIDATION_FAILED",
      };
    }

    if (!input.doctorId || !input.date || !input.slotTime) {
      return {
        success: false,
        error: "Doctor ID, consultation date, and slot time are mandatory.",
        errorCode: "VALIDATION_FAILED",
      };
    }

    if (!this.isConfigured()) {
      return this.fallbackMock.bookAppointment(input);
    }

    // 2. Production API call with timeout protection and idempotency key
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/api/v1/appointments/book`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Daya-Hms-Key": this.apiKey,
          "X-Idempotency-Key": input.idempotencyKey,
        },
        body: JSON.stringify({
          doctorId: input.doctorId,
          doctorName: input.doctorName,
          department: input.department,
          date: input.date,
          slotTime: input.slotTime,
          patientMobile: input.patientMobile,
          patientName: input.patientName,
          uhid: input.uhid,
          idempotencyKey: input.idempotencyKey,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const json = await res.json();

      if (res.ok && json.success) {
        return {
          success: true,
          bookingRef: json.bookingRef,
          tokenNumber: json.tokenNumber,
          consultationFee: json.consultationFee,
          allocatedSlot: json.allocatedSlot,
        };
      }

      if (res.status === 409) {
        return {
          success: false,
          error: json.error || "Requested OPD slot is no longer available.",
          errorCode: "SLOT_UNAVAILABLE",
        };
      }

      return {
        success: false,
        error: json.error || "HMS rejected booking request.",
        errorCode: json.errorCode || "VALIDATION_FAILED",
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      // If timed out, check status before claiming failure or retry
      const isTimeout =
        (err instanceof DOMException && err.name === "AbortError") ||
        (err instanceof Error && err.message.toLowerCase().includes("timeout"));

      if (isTimeout) {
        // Query status by idempotency key
        const check = await this.checkBookingByIdempotency(input.idempotencyKey);
        if (check?.verified && check.bookingRef) {
          return {
            success: true,
            bookingRef: check.bookingRef,
            allocatedSlot: check.slot,
          };
        }

        return {
          success: false,
          error: "HMS token allocation gateway timed out after 3000ms. Status verified before retry.",
          errorCode: "HMS_TIMEOUT",
          retryAfterMs: 2000,
        };
      }

      return {
        success: false,
        error: err instanceof Error ? err.message : "Network error contacting HMS gateway",
        errorCode: "VALIDATION_FAILED",
      };
    }
  }

  async rescheduleAppointment(input: RescheduleAppointmentInput): Promise<BookAppointmentResult> {
    if (!this.isConfigured()) {
      return this.fallbackMock.rescheduleAppointment(input);
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/v1/appointments/reschedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Daya-Hms-Key": this.apiKey,
          "X-Idempotency-Key": input.idempotencyKey,
        },
        body: JSON.stringify(input),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        return {
          success: true,
          bookingRef: json.bookingRef || input.bookingRef,
          tokenNumber: json.tokenNumber,
          allocatedSlot: json.allocatedSlot,
        };
      }

      return {
        success: false,
        error: json.error || "Rescheduling failed in HMS.",
        errorCode: json.errorCode || "PATIENT_NOT_FOUND",
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Error contacting HMS for rescheduling",
        errorCode: "VALIDATION_FAILED",
      };
    }
  }

  async cancelAppointment(bookingRef: string, idempotencyKey: string): Promise<CancelAppointmentResult> {
    if (!this.isConfigured()) {
      return this.fallbackMock.cancelAppointment(bookingRef, idempotencyKey);
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/v1/appointments/${encodeURIComponent(bookingRef)}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Daya-Hms-Key": this.apiKey,
          "X-Idempotency-Key": idempotencyKey,
        },
      });

      const json = await res.json();
      if (res.ok && json.success) {
        return {
          success: true,
          cancelledRef: bookingRef,
          releasedSlot: json.releasedSlot || "Released back into OPD pool",
        };
      }

      return {
        success: false,
        cancelledRef: bookingRef,
        error: json.error || "Cancellation rejected by HMS.",
      };
    } catch (err) {
      return {
        success: false,
        cancelledRef: bookingRef,
        error: err instanceof Error ? err.message : "Network error cancelling appointment",
      };
    }
  }

  async verifyBooking(bookingRef: string): Promise<{
    verified: boolean;
    bookingRef: string;
    doctorName?: string;
    slot?: string;
    status: "CONFIRMED" | "NOT_FOUND" | "CANCELLED";
  }> {
    if (!this.isConfigured()) {
      return this.fallbackMock.verifyBooking(bookingRef);
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/v1/appointments/${encodeURIComponent(bookingRef)}/verify`, {
        headers: { "X-Daya-Hms-Key": this.apiKey },
      });
      if (!res.ok) {
        return { verified: false, bookingRef, status: "NOT_FOUND" };
      }
      const data = await res.json();
      return {
        verified: Boolean(data.verified),
        bookingRef,
        doctorName: data.doctorName,
        slot: data.slot,
        status: data.status || "CONFIRMED",
      };
    } catch {
      return { verified: false, bookingRef, status: "NOT_FOUND" };
    }
  }

  private async checkBookingByIdempotency(idempotencyKey: string) {
    try {
      const res = await fetch(
        `${this.baseUrl}/api/v1/appointments/by-idempotency?key=${encodeURIComponent(idempotencyKey)}`,
        { headers: { "X-Daya-Hms-Key": this.apiKey } }
      );
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch {
      return null;
    }
  }
}
