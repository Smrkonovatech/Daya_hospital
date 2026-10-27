export interface IntegrationHealth {
  service: "sarvam_ai" | "daya_hms" | "telephony_ivr";
  status: "HEALTHY" | "DEGRADED" | "DOWN";
  latencyMs: number;
  mode: "MOCK_MODE" | "PRODUCTION";
  lastChecked: string;
  details?: string;
}

export interface DoctorSlot {
  slotId: string;
  doctorId: string;
  doctorName: string;
  department: string;
  date: string;
  time: string;
  isAvailable: boolean;
  consultationFee: number;
}

export interface BookAppointmentInput {
  doctorId: string;
  doctorName: string;
  department: string;
  date: string;
  slotTime: string;
  patientMobile: string;
  patientName: string;
  idempotencyKey: string;
}

export interface BookAppointmentResult {
  success: boolean;
  bookingRef?: string;
  tokenNumber?: number;
  consultationFee?: number;
  allocatedSlot?: string;
  error?: string;
  errorCode?: "SLOT_UNAVAILABLE" | "HMS_TIMEOUT" | "PATIENT_NOT_FOUND" | "DUPLICATE_IDEMPOTENCY";
}

export interface RescheduleAppointmentInput {
  bookingRef: string;
  patientMobile: string;
  targetDoctorId: string;
  targetDate: string;
  targetSlotTime: string;
  idempotencyKey: string;
}

export interface CancelAppointmentResult {
  success: boolean;
  cancelledRef: string;
  releasedSlot?: string;
  error?: string;
}

export interface IDayaHmsAdapter {
  healthCheck(): Promise<IntegrationHealth>;
  checkDoctorSlots(doctorId: string, date: string): Promise<DoctorSlot[]>;
  bookAppointment(input: BookAppointmentInput): Promise<BookAppointmentResult>;
  rescheduleAppointment(input: RescheduleAppointmentInput): Promise<BookAppointmentResult>;
  cancelAppointment(bookingRef: string, idempotencyKey: string): Promise<CancelAppointmentResult>;
  verifyBooking(bookingRef: string): Promise<{
    verified: boolean;
    bookingRef: string;
    doctorName?: string;
    slot?: string;
    status: "CONFIRMED" | "NOT_FOUND" | "CANCELLED";
  }>;
}

export interface ISarvamVoiceAdapter {
  healthCheck(): Promise<IntegrationHealth>;
  transcribeMalayalamAudio(audioBuffer: Buffer): Promise<{ transcriptText: string; languageConfidence: number }>;
  generateSpokenMalayalam(textMalayalam: string): Promise<{ audioUrl: string; durationSecs: number }>;
}

export interface ITelephonyIvrAdapter {
  healthCheck(): Promise<IntegrationHealth>;
  forwardToAiQueue(incomingCallId: string): Promise<{ sessionUrl: string }>;
  transferToHumanAgent(callId: string, departmentExt: string): Promise<{ success: boolean; extension: string }>;
}
