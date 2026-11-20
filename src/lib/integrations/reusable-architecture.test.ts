import { describe, it, expect, beforeEach } from "vitest";
import {
  DAYA_HOSPITAL_CONFIG,
  getHospitalConfig,
  GrandisHmsAdapter,
  BitVoiceTelephonyAdapter,
  ApiMappingEngine,
  GRANDIS_DEFAULT_MAPPING_SCHEMA,
  callRoutingEngine,
  smrkoVoiceService,
} from "./index";

describe("REUSABLE INTEGRATION ARCHITECTURE (BitVoice -> Smrko Voice -> Grandis HMS)", () => {
  let grandisAdapter: GrandisHmsAdapter;
  let bitvoiceAdapter: BitVoiceTelephonyAdapter;
  let mappingEngine: ApiMappingEngine;

  beforeEach(() => {
    grandisAdapter = new GrandisHmsAdapter();
    bitvoiceAdapter = new BitVoiceTelephonyAdapter();
    mappingEngine = new ApiMappingEngine(GRANDIS_DEFAULT_MAPPING_SCHEMA);
  });

  // --------------------------------------------------------------------------
  // 1. Hospital Tenant & Configuration Layer
  // --------------------------------------------------------------------------
  it("Tenant Configuration: Resolves Daya Hospital as standalone pilot with stable ID", () => {
    const config = getHospitalConfig();
    expect(config.hospitalId).toBe(DAYA_HOSPITAL_CONFIG.hospitalId);
    expect(config.hospitalId).toBe("hosp_daya_thrissur");
    expect(config.hospitalName).toContain("Daya General Hospital");
    expect(config.telephony.provider).toBe("BITVOICE");
    expect(config.telephony.forwardingScope).toBe("APPOINTMENT_ONLY");
    expect(config.telephony.status).toBe("PENDING_CONFIRMATION");
    expect(config.hms.product).toBe("GRANDIS");
    expect(config.hms.vpnRequired).toBe(true);
    expect(config.voice.engine).toBe("SMRKO_VOICE");
    expect(config.routing.daytimeAgents).toBe(4);
    expect(config.routing.appointmentOnly).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 2. Grandis HMS Adapter (Standard 10 Operations Contract)
  // --------------------------------------------------------------------------
  it("Grandis HMS: Retrieves clinical departments with standard models", async () => {
    const depts = await grandisAdapter.getDepartments();
    expect(depts.length).toBeGreaterThan(0);
    const ent = depts.find((d) => d.department_name.includes("ENT"));
    expect(ent).toBeDefined();
    expect(ent?.department_id).toBeDefined();
  });

  it("Grandis HMS: Retrieves doctors and schedules", async () => {
    const doctors = await grandisAdapter.getDoctors();
    expect(doctors.length).toBeGreaterThan(0);
    const firstDoc = doctors[0];
    expect(firstDoc.doctor_id).toBeDefined();
    expect(firstDoc.doctor_name).toBeDefined();

    const slots = await grandisAdapter.getAvailableSlots(firstDoc.doctor_id, "2026-10-28");
    expect(Array.isArray(slots)).toBe(true);
  });

  it("Grandis HMS: Enforces idempotency and booking verification", async () => {
    const bookingReq = {
      doctor_id: "DOC-ENT-012",
      doctor_name: "Dr. Rajesh Kumar",
      department_name: "ENT & Head-Neck Surgery",
      date: "2026-10-28",
      slot_time: "10:30 AM",
      patient_mobile: "+919846018392",
      patient_name: "Krishnan Namboothiri",
      idempotency_key: "idem_reusable_arch_001",
    };

    const res = await grandisAdapter.bookAppointment(bookingReq);
    expect(res.success).toBe(true);
    expect(res.verified_by_hms).toBe(true);
    expect(res.booking_ref).toMatch(/^DAYA-HMS-OPD-\d+$/);
    expect(res.token_number).toBeGreaterThan(0);

    // Verify appointment status
    if (res.booking_ref) {
      const verify = await grandisAdapter.verifyAppointmentStatus(res.booking_ref);
      expect(verify.verified).toBe(true);
      expect(verify.status).toBe("CONFIRMED");
    }
  });

  // --------------------------------------------------------------------------
  // 3. BitVoice Telephony Connector
  // --------------------------------------------------------------------------
  it("BitVoice Telephony: Marks live credentials as PENDING_CONFIRMATION until official docs", async () => {
    const health = await bitvoiceAdapter.healthCheck();
    expect(health.status).toBe("HEALTHY");
    expect(health.mode).toBe("PENDING_CONFIRMATION");
    expect(health.details).toContain("Pending official API credentials");
  });

  it("BitVoice Telephony: Provides trunk status metrics", async () => {
    const status = await bitvoiceAdapter.getTrunkStatus();
    expect(status.totalChannels).toBe(30);
    expect(status.activeChannels).toBe(18);
    expect(status.availableChannels).toBe(12);
  });

  it("BitVoice Telephony: Breaks forwarding loops when hop count > 3", () => {
    const decision = bitvoiceAdapter.evaluateCallRouting({
      event_id: "evt_loop",
      call_id: "call_loop_1",
      hospital_id: "hosp_daya_thrissur",
      called_number: "+914872475000",
      caller_number: "+919447011001",
      timestamp: new Date().toISOString(),
      initial_intent: "APPOINTMENT_BOOKING",
      hop_count: 4, // Exceeds limit
    });

    expect(decision.action).toBe("REJECT_LOOP");
    expect(decision.destination_id).toBe("EXT_100");
  });

  // --------------------------------------------------------------------------
  // 4. Declarative API Mapping Engine
  // --------------------------------------------------------------------------
  it("API Mapping Engine: Transforms internal request to Grandis payload and back", () => {
    const internalReq = {
      doctor_id: "DOC-101",
      date: "2026-11-20",
      slot_time: "10:00 AM",
      patient_mobile: "+919846011223",
      patient_name: "Ramesh K",
    };

    const transformedReq = mappingEngine.transformRequest("bookAppointment", internalReq);
    expect(transformedReq.doc_id).toBe("DOC-101");
    expect(transformedReq.booking_date).toBe("2026-11-20");
    expect(transformedReq.mobile).toBe("+919846011223");

    const rawGrandisResponse = {
      booking_ref: "DAYA-HMS-OPD-99881",
      token_no: 7,
      status: "CONFIRMED",
    };

    const normalizedRes = mappingEngine.transformResponse<{
      booking_ref: string;
      token_number: number;
      booking_status: string;
    }>("bookAppointment", rawGrandisResponse);

    expect(normalizedRes.booking_ref).toBe("DAYA-HMS-OPD-99881");
    expect(normalizedRes.token_number).toBe(7);
  });

  // --------------------------------------------------------------------------
  // 5. Call Routing Engine (Daya First)
  // --------------------------------------------------------------------------
  it("Call Routing Engine: Routes emergency/casualty calls directly to casualty desk", () => {
    const result = callRoutingEngine.evaluate({
      callerNumber: "+919447100001",
      calledNumber: "+914872475000",
      intent: "EMERGENCY_AMBULANCE",
    });

    expect(result.shouldForwardToAi).toBe(false);
    expect(result.destination).toBe("CASUALTY_DESK");
    expect(result.destinationNumberOrExt).toBe("+914872475100");
  });

  it("Call Routing Engine: Forwards appointment calls to Smrko Voice when human agents busy", () => {
    const result = callRoutingEngine.evaluate({
      callerNumber: "+919447100002",
      calledNumber: "+914872475000",
      intent: "APPOINTMENT_BOOKING",
      allHumanAgentsBusy: true,
    });

    expect(result.shouldForwardToAi).toBe(true);
    expect(result.destination).toBe("SMRKO_VOICE");
  });

  it("Call Routing Engine: Forwards appointment calls to Smrko Voice on 20s ring timeout", () => {
    const result = callRoutingEngine.evaluate({
      callerNumber: "+919447100003",
      calledNumber: "+914872475000",
      intent: "DOCTOR_AVAILABILITY",
      ringDurationSeconds: 22,
    });

    expect(result.shouldForwardToAi).toBe(true);
    expect(result.destination).toBe("SMRKO_VOICE");
    expect(result.reason).toContain("Ring timeout exceeded 20s");
  });

  it("Call Routing Engine: Keeps general billing/admin inquiries on human agent queue", () => {
    const result = callRoutingEngine.evaluate({
      callerNumber: "+919447100004",
      calledNumber: "+914872475000",
      intent: "INSURANCE_TPA_BILLING",
    });

    expect(result.shouldForwardToAi).toBe(false);
    expect(result.destination).toBe("HUMAN_AGENT_QUEUE");
  });

  // --------------------------------------------------------------------------
  // 6. Smrko Voice Service Interface
  // --------------------------------------------------------------------------
  it("Smrko Voice Service: Reports healthy conversational engine and retrieves turns", async () => {
    const health = await smrkoVoiceService.healthCheck();
    expect(health.status).toBe("HEALTHY");
    expect(health.engine).toContain("Smrko Voice");

    const turns = await smrkoVoiceService.getTranscript("interaction_001");
    expect(Array.isArray(turns)).toBe(true);
  });
});

