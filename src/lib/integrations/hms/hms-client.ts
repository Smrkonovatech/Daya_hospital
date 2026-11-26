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
  simulationMode?: boolean;
}

export class DayaHmsClient implements IDayaHmsAdapter {
  private baseUrl: string;
  private apiKey: string;
  private timeoutMs: number;
  private isSimulationMode: boolean;
  private fallbackMock: MockDayaHmsAdapter;

  constructor(options?: DayaHmsClientOptions) {
    this.baseUrl = (options?.baseUrl || process.env.DAYA_HMS_BASE_URL || "").replace(/\/+$/, "");
    this.apiKey = options?.apiKey || process.env.DAYA_HMS_API_KEY || "";
    this.timeoutMs = options?.timeoutMs || Number(process.env.DAYA_HMS_TIMEOUT_MS) || 3000;
    this.isSimulationMode = Boolean(
      options?.simulationMode ??
        (process.env.HMS_ENVIRONMENT === "simulation" || process.env.DAYA_HMS_SIMULATION === "true")
    );
    this.fallbackMock = new MockDayaHmsAdapter();
  }

  public setSimulationMode(enabled: boolean) {
    this.isSimulationMode = enabled;
  }

  public getSimulationMode(): boolean {
    return this.isSimulationMode;
  }

  private isConfigured(): boolean {
    return Boolean(this.baseUrl && this.apiKey);
  }

  async healthCheck(): Promise<IntegrationHealth> {
    if (!this.isConfigured()) {
      if (this.isSimulationMode) {
        return {
          service: "daya_hms",
          status: "HEALTHY",
          latencyMs: 120,
          mode: "MOCK_MODE",
          lastChecked: new Date().toISOString(),
          details: "Daya HMS Client (Authorized Simulation Sandbox)",
        };
      }
      return {
        service: "daya_hms",
        status: "DOWN",
        latencyMs: 0,
        mode: "PRODUCTION",
        lastChecked: new Date().toISOString(),
        details: "Daya HMS Client: Real HMS gateway URL / API key unconfigured. Status: DISCONNECTED",
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
        details: err instanceof Error ? `HMS Network/VPN Error: ${err.message}` : "Error contacting Daya HMS gateway",
      };
    }
  }

  async getDoctors(department?: string): Promise<Doctor[]> {
    if (!this.isConfigured()) {
      if (this.isSimulationMode) {
        return this.fallbackMock.getDoctors(department);
      }
      throw new Error("HMS_DISCONNECTED: Daya HMS is not configured. Real hospital doctors list unavailable.");
    }

    try {
      const url = new URL(`${this.baseUrl}/api/v1/doctors`);
      if (department) url.searchParams.set("department", department);

      const res = await fetch(url.toString(), {
        headers: { "X-Daya-Hms-Key": this.apiKey },
      });
      if (!res.ok) {
        if (this.isSimulationMode) return this.fallbackMock.getDoctors(department);
        throw new Error(`HMS_ERROR: Daya HMS returned HTTP ${res.status}`);
      }
      const data = await res.json();
      return Array.isArray(data) ? data : (this.isSimulationMode ? this.fallbackMock.getDoctors(department) : []);
    } catch (err) {
      if (this.isSimulationMode) {
        return this.fallbackMock.getDoctors(department);
      }
      console.error("[DayaHmsClient] Failed to retrieve doctors from real HMS:", err);
      throw new Error(`HMS_UNAVAILABLE: Failed to reach Daya HMS. ${err instanceof Error ? err.message : ""}`);
    }
  }

  async getDepartments(): Promise<Department[]> {
    if (!this.isConfigured()) {
      if (this.isSimulationMode) {
        return this.fallbackMock.getDepartments();
      }
      throw new Error("HMS_DISCONNECTED: Daya HMS is not configured. Real hospital departments unavailable.");
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/v1/departments`, {
        headers: { "X-Daya-Hms-Key": this.apiKey },
      });
      if (!res.ok) {
        if (this.isSimulationMode) return this.fallbackMock.getDepartments();
        throw new Error(`HMS_ERROR: Daya HMS returned HTTP ${res.status}`);
      }
      const data = await res.json();
      return Array.isArray(data) ? data : (this.isSimulationMode ? this.fallbackMock.getDepartments() : []);
    } catch (err) {
      if (this.isSimulationMode) {
        return this.fallbackMock.getDepartments();
      }
      console.error("[DayaHmsClient] Failed to retrieve departments from real HMS:", err);
      throw new Error(`HMS_UNAVAILABLE: Failed to reach Daya HMS. ${err instanceof Error ? err.message : ""}`);
    }
  }

  async checkDoctorSlots(doctorId: string, date: string): Promise<DoctorSlot[]> {
    if (!this.isConfigured()) {
      if (this.isSimulationMode) {
        return this.fallbackMock.checkDoctorSlots(doctorId, date);
      }
      throw new Error("HMS_DISCONNECTED: Daya HMS is not configured. Cannot retrieve doctor appointment slots.");
    }

    try {
      const res = await fetch(
        `${this.baseUrl}/api/v1/doctors/${encodeURIComponent(doctorId)}/slots?date=${encodeURIComponent(date)}`,
        { headers: { "X-Daya-Hms-Key": this.apiKey } }
      );
      if (!res.ok) {
        if (this.isSimulationMode) return this.fallbackMock.checkDoctorSlots(doctorId, date);
        throw new Error(`HMS_ERROR: Daya HMS returned HTTP ${res.status}`);
      }
      const data = await res.json();
      return Array.isArray(data.slots) ? data.slots : (this.isSimulationMode ? this.fallbackMock.checkDoctorSlots(doctorId, date) : []);
    } catch (err) {
      if (this.isSimulationMode) {
        return this.fallbackMock.checkDoctorSlots(doctorId, date);
      }
      console.error("[DayaHmsClient] Failed to retrieve doctor slots from real HMS:", err);
      throw new Error(`HMS_UNAVAILABLE: Failed to reach Daya HMS. ${err instanceof Error ? err.message : ""}`);
    }
  }

  async lookupPatientByMobile(mobile: string): Promise<Patient | null> {
    if (!this.isConfigured()) {
      if (this.isSimulationMode) {
        return this.fallbackMock.lookupPatientByMobile(mobile);
      }
      return null;
    }

    try {
      const res = await fetch(
        `${this.baseUrl}/api/v1/patients/lookup?mobile=${encodeURIComponent(mobile)}`,
        { headers: { "X-Daya-Hms-Key": this.apiKey } }
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data.patient || null;
    } catch (err) {
      if (this.isSimulationMode) {
        return this.fallbackMock.lookupPatientByMobile(mobile);
      }
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
      if (this.isSimulationMode) {
        const sim = await this.fallbackMock.bookAppointment(input);
        return {
          ...sim,
          isSimulated: true,
          source: "SIMULATED_MOCK_SANDBOX",
          simulationNotice: "This is simulated test data and not a confirmed hospital booking.",
        };
      }
      return {
        success: false,
        error: "Daya HMS gateway URL or API key is not configured. Real appointment booking is unavailable.",
        errorCode: "HMS_DISCONNECTED",
        hmsStatus: "DISCONNECTED",
        isSimulated: false,
      };
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
          isSimulated: false,
          source: "LIVE_HMS",
          hmsStatus: "CONNECTED",
        };
      }

      if (res.status === 409) {
        return {
          success: false,
          error: json.error || "Requested OPD slot is no longer available.",
          errorCode: "SLOT_UNAVAILABLE",
          isSimulated: false,
        };
      }

      return {
        success: false,
        error: json.error || "HMS rejected booking request.",
        errorCode: json.errorCode || "VALIDATION_FAILED",
        isSimulated: false,
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      // Explicit simulation sandbox branch ONLY
      if (this.isSimulationMode) {
        console.warn("[DayaHmsClient] Network request failed; running in explicitly authorized simulation sandbox:", err);
        const sim = await this.fallbackMock.bookAppointment(input);
        return {
          ...sim,
          isSimulated: true,
          source: "SIMULATED_MOCK_SANDBOX",
          simulationNotice: "This is simulated test data and not a confirmed hospital booking.",
        };
      }

      // CRITICAL: NO SILENT MOCK FALLBACK IN OPERATIONAL PATH
      const requestId = `req_hms_err_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      console.error(`[DayaHmsClient:${requestId}] Real HMS network request failed:`, err);
      return {
        success: false,
        error: `Daya HMS gateway is unreachable on internal network (Request ID: ${requestId}). Hospital VPN tunnel or on-premise HIS is offline.`,
        errorCode: "HMS_UNAVAILABLE",
        hmsStatus: "DISCONNECTED",
        isSimulated: false,
      };
    }
  }

  async rescheduleAppointment(input: RescheduleAppointmentInput): Promise<BookAppointmentResult> {
    if (!this.isConfigured()) {
      if (this.isSimulationMode) {
        const sim = await this.fallbackMock.rescheduleAppointment(input);
        return {
          ...sim,
          isSimulated: true,
          source: "SIMULATED_MOCK_SANDBOX",
          simulationNotice: "This is simulated test data and not a confirmed hospital reschedule.",
        };
      }
      return {
        success: false,
        error: "Daya HMS gateway is not configured. Reschedule operation unavailable.",
        errorCode: "HMS_DISCONNECTED",
        isSimulated: false,
      };
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
          isSimulated: false,
          source: "LIVE_HMS",
        };
      }

      return {
        success: false,
        error: json.error || "Rescheduling failed in HMS.",
        errorCode: json.errorCode || "PATIENT_NOT_FOUND",
        isSimulated: false,
      };
    } catch (err) {
      if (this.isSimulationMode) {
        console.warn("[DayaHmsClient] Reschedule network request failed; falling back to explicit simulation sandbox:", err);
        const sim = await this.fallbackMock.rescheduleAppointment(input);
        return {
          ...sim,
          isSimulated: true,
          source: "SIMULATED_MOCK_SANDBOX",
          simulationNotice: "This is simulated test data and not a confirmed hospital reschedule.",
        };
      }

      const requestId = `req_resched_err_${Date.now()}`;
      console.error(`[DayaHmsClient:${requestId}] Reschedule failed due to unreachable HMS:`, err);
      return {
        success: false,
        error: `Daya HMS gateway is unreachable. Cannot reschedule booking (Request ID: ${requestId}).`,
        errorCode: "HMS_UNAVAILABLE",
        isSimulated: false,
      };
    }
  }

  async cancelAppointment(bookingRef: string, idempotencyKey: string): Promise<CancelAppointmentResult> {
    if (!this.isConfigured()) {
      if (this.isSimulationMode) {
        return this.fallbackMock.cancelAppointment(bookingRef, idempotencyKey);
      }
      return {
        success: false,
        cancelledRef: bookingRef,
        error: "Daya HMS gateway is not configured. Cancellation unavailable.",
      };
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
      if (this.isSimulationMode) {
        console.warn("[DayaHmsClient] Cancel network request failed; falling back to explicit simulation sandbox:", err);
        return this.fallbackMock.cancelAppointment(bookingRef, idempotencyKey);
      }

      const requestId = `req_cancel_err_${Date.now()}`;
      console.error(`[DayaHmsClient:${requestId}] Cancellation failed due to unreachable HMS:`, err);
      return {
        success: false,
        cancelledRef: bookingRef,
        error: `Daya HMS gateway is unreachable. Cannot cancel booking (Request ID: ${requestId}).`,
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
      if (this.isSimulationMode) {
        return this.fallbackMock.verifyBooking(bookingRef);
      }
      return { verified: false, bookingRef, status: "NOT_FOUND" };
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
    } catch (err) {
      if (this.isSimulationMode) {
        return this.fallbackMock.verifyBooking(bookingRef);
      }
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
