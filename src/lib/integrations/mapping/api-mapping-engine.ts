/**
 * ============================================================================
 * DECLARATIVE API CONFIGURATION & MAPPING ENGINE
 * ============================================================================
 *
 * Provides a declarative configuration layer for hospital HMS integrations.
 * Allows onboarding new hospitals with custom or legacy HMS systems
 * without modifying the core call processing workflow.
 */

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type AuthScheme = "BEARER" | "API_KEY_HEADER" | "API_KEY_QUERY" | "BASIC" | "CUSTOM";

export interface EndpointOperationConfig {
  path: string;
  method: HttpMethod;
  description: string;
  authScheme: AuthScheme;
  customHeaders?: Record<string, string>;
  timeoutMs?: number;
  requestFieldMap?: Record<string, string>; // Maps internal field -> HMS target field
  responseFieldMap?: Record<string, string>; // Maps HMS target field -> internal field
  errorMap?: Record<number | string, string>; // Maps status/error code -> internal code
}

export interface HmsApiMappingSchema {
  hospitalId: string;
  productName: string;
  baseUrl: string;
  defaultAuthScheme: AuthScheme;
  defaultHeaders: Record<string, string>;
  operations: {
    getDepartments: EndpointOperationConfig;
    getDoctors: EndpointOperationConfig;
    getDoctorSlots: EndpointOperationConfig;
    patientLookup: EndpointOperationConfig;
    patientRegister?: EndpointOperationConfig;
    bookAppointment: EndpointOperationConfig;
    rescheduleAppointment: EndpointOperationConfig;
    cancelAppointment: EndpointOperationConfig;
    verifyBooking: EndpointOperationConfig;
  };
}

/**
 * Pre-defined default mapping for Grandis HMS (Daya Hospital pilot).
 */
export const GRANDIS_DEFAULT_MAPPING_SCHEMA: HmsApiMappingSchema = {
  hospitalId: "hosp_daya_thrissur",
  productName: "Grandis HMS",
  baseUrl: process.env.GRANDIS_HMS_BASE_URL || "https://grandis-hms.daya.internal",
  defaultAuthScheme: "API_KEY_HEADER",
  defaultHeaders: {
    "Content-Type": "application/json",
    "X-Client-Id": "smrko-voice-gateway",
  },
  operations: {
    getDepartments: {
      path: "/api/v1/departments",
      method: "GET",
      description: "List all active hospital clinical departments",
      authScheme: "API_KEY_HEADER",
      responseFieldMap: {
        dept_id: "department_id",
        dept_name: "department_name",
        hod_name: "hod_name",
      },
    },
    getDoctors: {
      path: "/api/v1/doctors",
      method: "GET",
      description: "List doctors filtered by department",
      authScheme: "API_KEY_HEADER",
      responseFieldMap: {
        doc_id: "doctor_id",
        doc_name: "doctor_name",
        dept_id: "department_id",
        dept_name: "department_name",
        consultation_fee: "consultation_fee",
      },
    },
    getDoctorSlots: {
      path: "/api/v1/doctor-slots",
      method: "GET",
      description: "Query real-time slot availability for doctor and date",
      authScheme: "API_KEY_HEADER",
      responseFieldMap: {
        slot_id: "slot_id",
        doc_id: "doctor_id",
        slot_time: "time",
        slot_date: "date",
        available: "is_available",
      },
    },
    patientLookup: {
      path: "/api/v1/patients/lookup",
      method: "GET",
      description: "Lookup patient record by 10-digit mobile number or UHID",
      authScheme: "API_KEY_HEADER",
      responseFieldMap: {
        mrn: "uhid",
        patient_name: "patient_name",
        mobile_no: "mobile_number",
      },
      errorMap: {
        404: "PATIENT_NOT_FOUND",
      },
    },
    bookAppointment: {
      path: "/api/v1/appointments/book",
      method: "POST",
      description: "Submit confirmed OPD appointment booking with idempotency key",
      authScheme: "API_KEY_HEADER",
      requestFieldMap: {
        doctor_id: "doc_id",
        date: "booking_date",
        slot_time: "time_slot",
        patient_mobile: "mobile",
        patient_name: "patient_name",
        uhid: "patient_uhid",
      },
      responseFieldMap: {
        booking_ref: "booking_ref",
        token_no: "token_number",
        status: "booking_status",
      },
      errorMap: {
        409: "SLOT_UNAVAILABLE",
        400: "VALIDATION_FAILED",
      },
    },
    rescheduleAppointment: {
      path: "/api/v1/appointments/reschedule",
      method: "POST",
      description: "Reschedule existing verified appointment to a new slot",
      authScheme: "API_KEY_HEADER",
      errorMap: {
        404: "BOOKING_NOT_FOUND",
        409: "SLOT_UNAVAILABLE",
      },
    },
    cancelAppointment: {
      path: "/api/v1/appointments/cancel",
      method: "POST",
      description: "Cancel verified appointment and release slot",
      authScheme: "API_KEY_HEADER",
    },
    verifyBooking: {
      path: "/api/v1/appointments/verify",
      method: "GET",
      description: "Verify booking status and token validity in Grandis ledger",
      authScheme: "API_KEY_HEADER",
    },
  },
};

/**
 * Executes field transformations between internal standard objects and external HMS representations.
 */
export class ApiMappingEngine {
  private schema: HmsApiMappingSchema;

  constructor(schema: HmsApiMappingSchema = GRANDIS_DEFAULT_MAPPING_SCHEMA) {
    this.schema = schema;
  }

  /**
   * Transforms an internal standardized request object into the target HMS payload.
   */
  public transformRequest(
    operationName: keyof HmsApiMappingSchema["operations"],
    internalData: Record<string, unknown>
  ): Record<string, unknown> {
    const op = this.schema.operations[operationName];
    if (!op || !op.requestFieldMap) return { ...internalData };

    const mapped: Record<string, unknown> = {};
    for (const [internalKey, value] of Object.entries(internalData)) {
      const targetKey = op.requestFieldMap[internalKey] || internalKey;
      mapped[targetKey] = value;
    }
    return mapped;
  }

  /**
   * Transforms a raw HMS response payload into standardized internal format.
   */
  public transformResponse<T = Record<string, unknown>>(
    operationName: keyof HmsApiMappingSchema["operations"],
    rawHmsData: Record<string, unknown>
  ): T {
    const op = this.schema.operations[operationName];
    if (!op || !op.responseFieldMap) return rawHmsData as unknown as T;

    const mapped: Record<string, unknown> = {};
    for (const [rawKey, value] of Object.entries(rawHmsData)) {
      const internalKey = op.responseFieldMap[rawKey] || rawKey;
      mapped[internalKey] = value;
    }
    return mapped as unknown as T;
  }
}

