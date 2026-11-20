/**
 * ============================================================================
 * STANDARD REUSABLE HMS INTERFACE & DATA MODELS
 * ============================================================================
 *
 * Provider-independent contract for all Hospital Management Systems (Grandis,
 * Cerner, custom REST, etc.).
 *
 * All Voice AI and frontend operations depend on this internal model, never
 * directly on Grandis-specific JSON shapes.
 */

export interface StandardDoctor {
  doctor_id: string;
  doctor_name: string;
  department_id: string;
  department_name: string;
  qualifications: string;
  opd_days: string[];
  consultation_fee: number;
}

export interface StandardDepartment {
  department_id: string;
  department_name: string;
  hod_name: string;
  room_numbers: string;
}

export interface StandardSlot {
  slot_id: string;
  doctor_id: string;
  doctor_name: string;
  date: string;
  time: string;
  is_available: boolean;
  consultation_fee: number;
}

export interface StandardPatient {
  patient_id: string;
  patient_name: string;
  mobile_number: string;
  uhid?: string;
  age?: number;
  gender?: string;
}

export interface StandardBookingRequest {
  doctor_id: string;
  doctor_name: string;
  department_id?: string;
  department_name?: string;
  date: string;
  slot_time: string;
  patient_mobile: string;
  patient_name: string;
  idempotency_key: string;
  uhid?: string;
}

export interface StandardBookingResponse {
  success: boolean;
  booking_ref?: string;
  token_number?: number;
  consultation_fee?: number;
  allocated_slot?: string;
  verified_by_hms: boolean;
  error_code?:
    | "SLOT_UNAVAILABLE"
    | "HMS_TIMEOUT"
    | "PATIENT_NOT_FOUND"
    | "DUPLICATE_IDEMPOTENCY"
    | "VPN_UNAVAILABLE"
    | "VALIDATION_FAILED";
  error_message?: string;
  retry_after_ms?: number;
}

export interface StandardRescheduleRequest {
  booking_ref: string;
  patient_mobile: string;
  target_doctor_id: string;
  target_date: string;
  target_slot_time: string;
  idempotency_key: string;
}

export interface StandardCancelRequest {
  booking_ref: string;
  idempotency_key: string;
  reason?: string;
}

export interface StandardCancelResponse {
  success: boolean;
  cancelled_ref: string;
  released_slot?: string;
  verified_by_hms: boolean;
  error?: string;
}

export interface StandardVerificationResult {
  verified: boolean;
  booking_ref: string;
  status: "CONFIRMED" | "CANCELLED" | "NOT_FOUND";
  doctor_name?: string;
  slot?: string;
  patient_name?: string;
  last_verified_at: string;
}

export interface HmsConnectionHealth {
  status: "HEALTHY" | "DEGRADED" | "DOWN";
  product: string;
  vpn_verified: boolean;
  latency_ms: number;
  mode: "MOCK_SANDBOX" | "PRODUCTION";
  last_checked: string;
  details: string;
}

/**
 * The standard 10 HMS operations contract required for AI Calling.
 */
export interface IHmsConnector {
  healthCheck(): Promise<HmsConnectionHealth>;
  getDepartments(): Promise<StandardDepartment[]>;
  getDoctors(departmentId?: string): Promise<StandardDoctor[]>;
  getDoctorSchedule(doctorId: string, date: string): Promise<StandardSlot[]>;
  getAvailableSlots(doctorId: string, date: string): Promise<StandardSlot[]>;
  findPatient(identifier: { mobile?: string; uhid?: string }): Promise<StandardPatient | null>;
  registerPatient(patient: {
    name: string;
    mobile: string;
    age?: number;
    gender?: string;
  }): Promise<StandardPatient>;
  bookAppointment(request: StandardBookingRequest): Promise<StandardBookingResponse>;
  rescheduleAppointment(request: StandardRescheduleRequest): Promise<StandardBookingResponse>;
  cancelAppointment(request: StandardCancelRequest): Promise<StandardCancelResponse>;
  verifyAppointmentStatus(bookingRef: string): Promise<StandardVerificationResult>;
}

