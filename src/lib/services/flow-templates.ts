/**
 * ============================================================================
 * SMRKOMED REUSABLE FLOW TEMPLATES CATALOG (PHASE 4.6)
 * ============================================================================
 *
 * 11 Standardized, clinical-grade reusable call flow templates for multi-hospital
 * orchestration:
 *
 * 1.  MAIN_AI_RECEPTION       - Direct AI Receptionist with multilingual streaming
 * 2.  EMERGENCY_ESCALATION    - High-priority casualty routing & interruption flow
 * 3.  DEPARTMENT_ROUTING      - Clinical OPD department routing
 * 4.  AFTER_HOURS             - Night & weekend triage with morning appointment booking
 * 5.  APPOINTMENT_ENQUIRIES   - Doctor timetable, fees, and consultation slots
 * 6.  APPOINTMENT_BOOKING     - Interactive appointment scheduling demonstration
 * 7.  BILLING_INSURANCE       - Cashless TPA & Medisep insurance inquiries
 * 8.  HUMAN_HANDOFF           - Controlled front-desk receptionist queue transfer
 * 9.  LAB_ENQUIRIES           - Diagnostics, blood test readiness & SMS dispatch
 * 10. DOCTOR_INFO             - Visiting specialists & OPD clinic hours
 * 11. CUSTOM                  - Clean starter template for bespoke hospital flows
 */

import {
  IvrFlowData,
  FlowCategory,
  FlowNode,
  FlowEdge,
} from "@/lib/types/ivr-flow";
import { createDefaultNode } from "./ivr-node-definitions";

export interface IvrFlowTemplateSummary {
  id: string;
  name: string;
  description: string;
  category: FlowCategory;
  nodeCount: number;
  executionPriority: number;
  isDefaultCandidate?: boolean;
}

export function buildTemplateMainAiReception(hospitalName = "General Hospital", emergencyNumber = ""): IvrFlowData {
  const defaults = { hospitalName, emergencyNumber };

  const incomingNode = createDefaultNode("INCOMING_CALL", { x: 60, y: 220 }, defaults);
  const directAiNode = createDefaultNode("DIRECT_AI_RECEPTIONIST", { x: 340, y: 220 }, defaults);
  const intentNode = createDefaultNode("INTENT_DETECTION", { x: 680, y: 220 }, defaults);

  const emergencySubflow = createDefaultNode("REUSABLE_SUBFLOW", { x: 1040, y: 40 }, defaults);
  emergencySubflow.title = "Escalate to Emergency Flow";
  (emergencySubflow.data as Record<string, unknown>).targetFlowCategory = "EMERGENCY_ESCALATION";

  const apptSubflow = createDefaultNode("REUSABLE_SUBFLOW", { x: 1040, y: 160 }, defaults);
  apptSubflow.title = "Invoke Appointment Flow";
  (apptSubflow.data as Record<string, unknown>).targetFlowCategory = "APPOINTMENT";

  const deptSubflow = createDefaultNode("REUSABLE_SUBFLOW", { x: 1040, y: 280 }, defaults);
  deptSubflow.title = "Invoke Department Flow";
  (deptSubflow.data as Record<string, unknown>).targetFlowCategory = "DEPARTMENT_ROUTING";

  const billingSubflow = createDefaultNode("REUSABLE_SUBFLOW", { x: 1040, y: 400 }, defaults);
  billingSubflow.title = "Invoke Billing Flow";
  (billingSubflow.data as Record<string, unknown>).targetFlowCategory = "BILLING_INSURANCE";

  const staffTransfer = createDefaultNode("HUMAN_TRANSFER", { x: 1040, y: 520 }, defaults);
  staffTransfer.title = "Front Desk Staff Handoff";

  const endCallNode = createDefaultNode("END_CALL", { x: 1400, y: 280 }, defaults);

  const nodes: FlowNode[] = [
    incomingNode,
    directAiNode,
    intentNode,
    emergencySubflow,
    apptSubflow,
    deptSubflow,
    billingSubflow,
    staffTransfer,
    endCallNode,
  ];

  const edges: FlowEdge[] = [
    { id: "e1", sourceNodeId: incomingNode.id, sourcePortId: "next", targetNodeId: directAiNode.id, targetPortId: "in", label: "Answer Call" },
    { id: "e2", sourceNodeId: directAiNode.id, sourcePortId: "call_completed", targetNodeId: intentNode.id, targetPortId: "in", label: "Analyze Intent" },
    { id: "e3", sourceNodeId: directAiNode.id, sourcePortId: "emergency_escalation", targetNodeId: emergencySubflow.id, targetPortId: "in", label: "Emergency Trigger" },
    { id: "e4", sourceNodeId: directAiNode.id, sourcePortId: "human_handoff", targetNodeId: staffTransfer.id, targetPortId: "in", label: "Staff Handoff" },
    { id: "e5", sourceNodeId: intentNode.id, sourcePortId: "emergency", targetNodeId: emergencySubflow.id, targetPortId: "in", label: "Emergency Intent" },
    { id: "e6", sourceNodeId: intentNode.id, sourcePortId: "appointment", targetNodeId: apptSubflow.id, targetPortId: "in", label: "Appointment Intent" },
    { id: "e7", sourceNodeId: intentNode.id, sourcePortId: "department", targetNodeId: deptSubflow.id, targetPortId: "in", label: "Department Intent" },
    { id: "e8", sourceNodeId: intentNode.id, sourcePortId: "billing", targetNodeId: billingSubflow.id, targetPortId: "in", label: "Billing Intent" },
    { id: "e9", sourceNodeId: intentNode.id, sourcePortId: "human_handoff", targetNodeId: staffTransfer.id, targetPortId: "in", label: "Human Request" },
    { id: "e10", sourceNodeId: intentNode.id, sourcePortId: "fallback", targetNodeId: endCallNode.id, targetPortId: "in", label: "Fallback End" },
    { id: "e11", sourceNodeId: apptSubflow.id, sourcePortId: "return", targetNodeId: endCallNode.id, targetPortId: "in", label: "Appt Done" },
    { id: "e12", sourceNodeId: deptSubflow.id, sourcePortId: "return", targetNodeId: endCallNode.id, targetPortId: "in", label: "Dept Done" },
    { id: "e13", sourceNodeId: billingSubflow.id, sourcePortId: "return", targetNodeId: endCallNode.id, targetPortId: "in", label: "Billing Done" },
    { id: "e14", sourceNodeId: staffTransfer.id, sourcePortId: "connected", targetNodeId: endCallNode.id, targetPortId: "in", label: "Call Done" },
  ];

  return {
    id: "template_main_ai_reception",
    hospitalId: "template",
    name: "Main AI Reception Flow",
    description: "Modular AI voice receptionist with short English initial greeting, automatic Malayalam/English language detection, and intelligent subflow routing.",
    status: "PUBLISHED",
    deploymentStatus: "EXOTEL_MAPPING_VERIFIED",
    isDefault: true,
    currentVersion: 1,
    category: "INBOUND_RECEPTION",
    direction: "INBOUND",
    executionPriority: 0,
    isEnabled: true,
    isTemplate: true,
    templateCategory: "Reception",
    nodes,
    edges,
    variables: {
      defaultLanguage: "en-IN",
      autoDetectLanguage: true,
      casualtyHotline: emergencyNumber,
    },
    lastUpdatedBy: "Smrkomed Template Engine",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function buildTemplateEmergencyEscalation(hospitalName = "General Hospital", emergencyNumber = ""): IvrFlowData {
  const defaults = { hospitalName, emergencyNumber };

  const incomingNode = createDefaultNode("INCOMING_CALL", { x: 80, y: 200 }, defaults);
  incomingNode.title = "Emergency Inbound";

  const monitorNode = createDefaultNode("EMERGENCY_MONITOR", { x: 340, y: 200 }, defaults);
  const emergencyHandlingNode = createDefaultNode("EMERGENCY_HANDLING", { x: 680, y: 200 }, defaults);
  const emData = emergencyHandlingNode.data as Record<string, unknown>;
  emData.casualtyDestinationNumber = emergencyNumber || "";
  emData.autoTransfer = false;
  emData.isConfirmedDestination = false;
  emData.fallbackInstructionsMalayalam = "അടിയന്തിര ട്രാൻസ്ഫർ നിലവിൽ സജ്ജീകരിച്ചിട്ടില്ലാത്തതിനാൽ ദയവായി തൊട്ടടുത്ത ആശുപത്രി അത്യാഹിത വിഭാഗത്തിൽ നേരിട്ടെത്തുകയോ 108 അല്ലെങ്കിൽ 112 ലേക്ക് വിളിക്കുകയോ ചെയ്യുക.";
  emData.fallbackInstructionsEnglish = "Emergency telephone transfer is currently disabled pending destination confirmation. Please proceed immediately to the nearest hospital casualty or call emergency services (108 / 112).";

  const returnNode = createDefaultNode("RETURN_SUBFLOW", { x: 1020, y: 140 }, defaults);
  returnNode.title = "Return to Calling Flow";
  const endCallNode = createDefaultNode("END_CALL", { x: 1020, y: 280 }, defaults);

  const nodes: FlowNode[] = [
    incomingNode,
    monitorNode,
    emergencyHandlingNode,
    returnNode,
    endCallNode,
  ];

  const edges: FlowEdge[] = [
    { id: "em_e1", sourceNodeId: incomingNode.id, sourcePortId: "next", targetNodeId: emergencyHandlingNode.id, targetPortId: "in", label: "Fast Track" },
    { id: "em_e2", sourceNodeId: monitorNode.id, sourcePortId: "emergency_detected", targetNodeId: emergencyHandlingNode.id, targetPortId: "in", label: "Escalate" },
    { id: "em_e3", sourceNodeId: emergencyHandlingNode.id, sourcePortId: "transferred", targetNodeId: returnNode.id, targetPortId: "in", label: "Casualty Connected" },
    { id: "em_e4", sourceNodeId: emergencyHandlingNode.id, sourcePortId: "transfer_failed", targetNodeId: endCallNode.id, targetPortId: "in", label: "Fallback End" },
  ];

  return {
    id: "template_emergency_escalation",
    hospitalId: "template",
    name: "Emergency Escalation Flow",
    description: "High-priority reusable emergency handling subflow. Immediately speaks bilingual casualty instructions and connects to the hospital emergency department.",
    status: "PUBLISHED",
    deploymentStatus: "PUBLISHED_INTERNALLY",
    isDefault: false,
    currentVersion: 1,
    category: "EMERGENCY_ESCALATION",
    direction: "INBOUND",
    executionPriority: 100,
    isEnabled: true,
    isTemplate: true,
    templateCategory: "Emergency",
    nodes,
    edges,
    variables: {
      casualtyDestinationNumber: emergencyNumber,
      bypassBusinessHours: true,
      priority: 100,
    },
    lastUpdatedBy: "Smrkomed Template Engine",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function buildTemplateDepartmentRouting(hospitalName = "General Hospital", emergencyNumber = ""): IvrFlowData {
  const defaults = { hospitalName, emergencyNumber };

  const incomingNode = createDefaultNode("INCOMING_CALL", { x: 60, y: 240 }, defaults);
  const deptNode = createDefaultNode("DEPARTMENT_SELECTION", { x: 340, y: 240 }, defaults);
  const transferCardio = createDefaultNode("HUMAN_TRANSFER", { x: 700, y: 80 }, defaults);
  transferCardio.title = "Cardiology OPD Desk";
  const transferOrtho = createDefaultNode("HUMAN_TRANSFER", { x: 700, y: 200 }, defaults);
  transferOrtho.title = "Orthopaedics OPD Desk";
  const transferGeneral = createDefaultNode("HUMAN_TRANSFER", { x: 700, y: 320 }, defaults);
  transferGeneral.title = "General Medicine Desk";
  const returnNode = createDefaultNode("RETURN_SUBFLOW", { x: 1040, y: 200 }, defaults);
  const endCallNode = createDefaultNode("END_CALL", { x: 1040, y: 360 }, defaults);

  const nodes: FlowNode[] = [
    incomingNode,
    deptNode,
    transferCardio,
    transferOrtho,
    transferGeneral,
    returnNode,
    endCallNode,
  ];

  const edges: FlowEdge[] = [
    { id: "dp_e1", sourceNodeId: incomingNode.id, sourcePortId: "next", targetNodeId: deptNode.id, targetPortId: "in", label: "Select Dept" },
    { id: "dp_e2", sourceNodeId: deptNode.id, sourcePortId: "dept_cardio", targetNodeId: transferCardio.id, targetPortId: "in", label: "Cardio" },
    { id: "dp_e3", sourceNodeId: deptNode.id, sourcePortId: "dept_ortho", targetNodeId: transferOrtho.id, targetPortId: "in", label: "Ortho" },
    { id: "dp_e4", sourceNodeId: deptNode.id, sourcePortId: "dept_gen", targetNodeId: transferGeneral.id, targetPortId: "in", label: "General Med" },
    { id: "dp_e5", sourceNodeId: deptNode.id, sourcePortId: "timeout", targetNodeId: returnNode.id, targetPortId: "in", label: "Return on Timeout" },
    { id: "dp_e6", sourceNodeId: transferCardio.id, sourcePortId: "connected", targetNodeId: returnNode.id, targetPortId: "in" },
    { id: "dp_e7", sourceNodeId: transferOrtho.id, sourcePortId: "connected", targetNodeId: returnNode.id, targetPortId: "in" },
    { id: "dp_e8", sourceNodeId: transferGeneral.id, sourcePortId: "connected", targetNodeId: returnNode.id, targetPortId: "in" },
  ];

  return {
    id: "template_department_routing",
    hospitalId: "template",
    name: "Department Routing Flow",
    description: "Clinical department directory offering direct extension and queue routing for Cardiology, Orthopaedics, and General Medicine.",
    status: "PUBLISHED",
    deploymentStatus: "PUBLISHED_INTERNALLY",
    isDefault: false,
    currentVersion: 1,
    category: "DEPARTMENT_ROUTING",
    direction: "INBOUND",
    executionPriority: 10,
    isEnabled: true,
    isTemplate: true,
    templateCategory: "Departments",
    nodes,
    edges,
    variables: {},
    lastUpdatedBy: "Smrkomed Template Engine",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function buildTemplateAfterHours(hospitalName = "General Hospital", emergencyNumber = ""): IvrFlowData {
  const defaults = { hospitalName, emergencyNumber };

  const incomingNode = createDefaultNode("INCOMING_CALL", { x: 60, y: 220 }, defaults);
  const afterHoursNode = createDefaultNode("AFTER_HOURS", { x: 340, y: 220 }, defaults);
  const casualtyTransfer = createDefaultNode("HUMAN_TRANSFER", { x: 700, y: 120 }, defaults);
  casualtyTransfer.title = "Night Casualty Escalation";
  const returnNode = createDefaultNode("RETURN_SUBFLOW", { x: 700, y: 260 }, defaults);
  returnNode.title = "Morning Request Stored";
  const endCallNode = createDefaultNode("END_CALL", { x: 1020, y: 200 }, defaults);

  const nodes: FlowNode[] = [
    incomingNode,
    afterHoursNode,
    casualtyTransfer,
    returnNode,
    endCallNode,
  ];

  const edges: FlowEdge[] = [
    { id: "ah_e1", sourceNodeId: incomingNode.id, sourcePortId: "next", targetNodeId: afterHoursNode.id, targetPortId: "in" },
    { id: "ah_e2", sourceNodeId: afterHoursNode.id, sourcePortId: "casualty_transfer", targetNodeId: casualtyTransfer.id, targetPortId: "in", label: "Casualty" },
    { id: "ah_e3", sourceNodeId: afterHoursNode.id, sourcePortId: "morning_booking", targetNodeId: returnNode.id, targetPortId: "in", label: "Leave Booking" },
    { id: "ah_e4", sourceNodeId: afterHoursNode.id, sourcePortId: "end_call", targetNodeId: endCallNode.id, targetPortId: "in", label: "Polite Hangup" },
    { id: "ah_e5", sourceNodeId: casualtyTransfer.id, sourcePortId: "connected", targetNodeId: endCallNode.id, targetPortId: "in" },
  ];

  return {
    id: "template_after_hours",
    hospitalId: "template",
    name: "After-Hours Triage Flow",
    description: "Specialized night and weekend workflow that informs callers of OPD operating hours, fast-tracks emergencies, and logs morning callback requests.",
    status: "PUBLISHED",
    deploymentStatus: "PUBLISHED_INTERNALLY",
    isDefault: false,
    currentVersion: 1,
    category: "AFTER_HOURS",
    direction: "INBOUND",
    executionPriority: 20,
    isEnabled: true,
    isTemplate: true,
    templateCategory: "Operations",
    nodes,
    edges,
    variables: {
      opdHours: "08:00 AM - 08:00 PM",
    },
    lastUpdatedBy: "Smrkomed Template Engine",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function buildTemplateAppointmentEnquiries(hospitalName = "General Hospital", emergencyNumber = ""): IvrFlowData {
  const defaults = { hospitalName, emergencyNumber };

  const incomingNode = createDefaultNode("INCOMING_CALL", { x: 60, y: 220 }, defaults);
  const aiAgent = createDefaultNode("AI_VOICE_AGENT", { x: 340, y: 220 }, defaults);
  aiAgent.title = "Doctor Timetable Assistant";
  const returnNode = createDefaultNode("RETURN_SUBFLOW", { x: 700, y: 160 }, defaults);
  const endCallNode = createDefaultNode("END_CALL", { x: 700, y: 300 }, defaults);

  const nodes: FlowNode[] = [incomingNode, aiAgent, returnNode, endCallNode];
  const edges: FlowEdge[] = [
    { id: "ae_e1", sourceNodeId: incomingNode.id, sourcePortId: "next", targetNodeId: aiAgent.id, targetPortId: "in" },
    { id: "ae_e2", sourceNodeId: aiAgent.id, sourcePortId: "call_completed", targetNodeId: returnNode.id, targetPortId: "in", label: "Return" },
    { id: "ae_e3", sourceNodeId: aiAgent.id, sourcePortId: "error", targetNodeId: endCallNode.id, targetPortId: "in", label: "End" },
  ];

  return {
    id: "template_appointment_enquiries",
    hospitalId: "template",
    name: "Appointment Enquiries Flow",
    description: "Doctor schedules, OPD visiting days, consultation fees, and available token inquiries.",
    status: "PUBLISHED",
    deploymentStatus: "PUBLISHED_INTERNALLY",
    isDefault: false,
    currentVersion: 1,
    category: "APPOINTMENT",
    direction: "INBOUND",
    executionPriority: 10,
    isEnabled: true,
    isTemplate: true,
    templateCategory: "Appointments",
    nodes,
    edges,
    variables: {},
    lastUpdatedBy: "Smrkomed Template Engine",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function buildTemplateAppointmentBooking(hospitalName = "General Hospital", emergencyNumber = ""): IvrFlowData {
  const defaults = { hospitalName, emergencyNumber };

  const incomingNode = createDefaultNode("INCOMING_CALL", { x: 60, y: 220 }, defaults);
  const dtmfUhid = createDefaultNode("DTMF_INPUT", { x: 340, y: 220 }, defaults);
  dtmfUhid.title = "Enter Patient UHID";
  const apptFlowNode = createDefaultNode("APPOINTMENT_FLOW", { x: 680, y: 220 }, defaults);
  const returnNode = createDefaultNode("RETURN_SUBFLOW", { x: 1020, y: 160 }, defaults);
  const endCallNode = createDefaultNode("END_CALL", { x: 1020, y: 300 }, defaults);

  const nodes: FlowNode[] = [incomingNode, dtmfUhid, apptFlowNode, returnNode, endCallNode];
  const edges: FlowEdge[] = [
    { id: "ab_e1", sourceNodeId: incomingNode.id, sourcePortId: "next", targetNodeId: dtmfUhid.id, targetPortId: "in" },
    { id: "ab_e2", sourceNodeId: dtmfUhid.id, sourcePortId: "success", targetNodeId: apptFlowNode.id, targetPortId: "in", label: "UHID Valid" },
    { id: "ab_e3", sourceNodeId: apptFlowNode.id, sourcePortId: "booked", targetNodeId: returnNode.id, targetPortId: "in", label: "Slot Booked" },
    { id: "ab_e4", sourceNodeId: apptFlowNode.id, sourcePortId: "fallback", targetNodeId: endCallNode.id, targetPortId: "in", label: "End" },
  ];

  return {
    id: "template_appointment_booking",
    hospitalId: "template",
    name: "Appointment Booking Subflow",
    description: "Interactive appointment scheduling workflow that captures patient UHID, doctor choice, and registers demonstration appointment slots.",
    status: "PUBLISHED",
    deploymentStatus: "PUBLISHED_INTERNALLY",
    isDefault: false,
    currentVersion: 1,
    category: "APPOINTMENT",
    direction: "INBOUND",
    executionPriority: 10,
    isEnabled: true,
    isTemplate: true,
    templateCategory: "Appointments",
    nodes,
    edges,
    variables: {
      enableDemoBooking: true,
    },
    lastUpdatedBy: "Smrkomed Template Engine",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function buildTemplateBillingInsurance(hospitalName = "General Hospital", emergencyNumber = ""): IvrFlowData {
  const defaults = { hospitalName, emergencyNumber };

  const incomingNode = createDefaultNode("INCOMING_CALL", { x: 60, y: 220 }, defaults);
  const billingNode = createDefaultNode("BILLING_FLOW", { x: 340, y: 220 }, defaults);
  const transferBillingDesk = createDefaultNode("HUMAN_TRANSFER", { x: 700, y: 140 }, defaults);
  transferBillingDesk.title = "Transfer to Billing Desk Ext 104";
  const returnNode = createDefaultNode("RETURN_SUBFLOW", { x: 700, y: 280 }, defaults);
  const endCallNode = createDefaultNode("END_CALL", { x: 1020, y: 220 }, defaults);

  const nodes: FlowNode[] = [incomingNode, billingNode, transferBillingDesk, returnNode, endCallNode];
  const edges: FlowEdge[] = [
    { id: "bi_e1", sourceNodeId: incomingNode.id, sourcePortId: "next", targetNodeId: billingNode.id, targetPortId: "in" },
    { id: "bi_e2", sourceNodeId: billingNode.id, sourcePortId: "transfer_billing", targetNodeId: transferBillingDesk.id, targetPortId: "in", label: "Desk Transfer" },
    { id: "bi_e3", sourceNodeId: billingNode.id, sourcePortId: "resolved", targetNodeId: returnNode.id, targetPortId: "in", label: "Resolved" },
    { id: "bi_e4", sourceNodeId: transferBillingDesk.id, sourcePortId: "connected", targetNodeId: endCallNode.id, targetPortId: "in" },
  ];

  return {
    id: "template_billing_insurance",
    hospitalId: "template",
    name: "Billing & Insurance Flow",
    description: "Guidance for cashless TPA claims, Medisep scheme requirements, and direct transfer to hospital billing executives.",
    status: "PUBLISHED",
    deploymentStatus: "PUBLISHED_INTERNALLY",
    isDefault: false,
    currentVersion: 1,
    category: "BILLING_INSURANCE",
    direction: "INBOUND",
    executionPriority: 10,
    isEnabled: true,
    isTemplate: true,
    templateCategory: "Billing",
    nodes,
    edges,
    variables: {
      insuranceDeskExt: "104",
      supportsMedisep: true,
    },
    lastUpdatedBy: "Smrkomed Template Engine",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function buildTemplateHumanHandoff(hospitalName = "General Hospital", emergencyNumber = ""): IvrFlowData {
  const defaults = { hospitalName, emergencyNumber };

  const incomingNode = createDefaultNode("INCOMING_CALL", { x: 60, y: 220 }, defaults);
  const queueNode = createDefaultNode("QUEUE_WAITING", { x: 340, y: 220 }, defaults);
  const transferReception = createDefaultNode("HUMAN_TRANSFER", { x: 680, y: 220 }, defaults);
  transferReception.title = "Hospital Front Desk Reception";
  const endCallNode = createDefaultNode("END_CALL", { x: 1020, y: 220 }, defaults);

  const nodes: FlowNode[] = [incomingNode, queueNode, transferReception, endCallNode];
  const edges: FlowEdge[] = [
    { id: "hh_e1", sourceNodeId: incomingNode.id, sourcePortId: "next", targetNodeId: queueNode.id, targetPortId: "in" },
    { id: "hh_e2", sourceNodeId: queueNode.id, sourcePortId: "agent_answered", targetNodeId: transferReception.id, targetPortId: "in" },
    { id: "hh_e3", sourceNodeId: transferReception.id, sourcePortId: "connected", targetNodeId: endCallNode.id, targetPortId: "in" },
  ];

  return {
    id: "template_human_handoff",
    hospitalId: "template",
    name: "Human Receptionist Handoff Flow",
    description: "Controlled front desk queue distribution and staff handoff with queue hold music and fail-safe fallback.",
    status: "PUBLISHED",
    deploymentStatus: "PUBLISHED_INTERNALLY",
    isDefault: false,
    currentVersion: 1,
    category: "HUMAN_HANDOFF",
    direction: "INBOUND",
    executionPriority: 15,
    isEnabled: true,
    isTemplate: true,
    templateCategory: "Staff Handoff",
    nodes,
    edges,
    variables: {},
    lastUpdatedBy: "Smrkomed Template Engine",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function buildTemplateLabEnquiries(hospitalName = "General Hospital", emergencyNumber = ""): IvrFlowData {
  const defaults = { hospitalName, emergencyNumber };

  const incomingNode = createDefaultNode("INCOMING_CALL", { x: 60, y: 220 }, defaults);
  const dtmfUhid = createDefaultNode("DTMF_INPUT", { x: 340, y: 220 }, defaults);
  dtmfUhid.title = "Enter Lab Bill / UHID Number";
  const aiAgent = createDefaultNode("AI_VOICE_AGENT", { x: 680, y: 220 }, defaults);
  aiAgent.title = "Diagnostics Report Advisor";
  const returnNode = createDefaultNode("RETURN_SUBFLOW", { x: 1020, y: 220 }, defaults);

  const nodes: FlowNode[] = [incomingNode, dtmfUhid, aiAgent, returnNode];
  const edges: FlowEdge[] = [
    { id: "lb_e1", sourceNodeId: incomingNode.id, sourcePortId: "next", targetNodeId: dtmfUhid.id, targetPortId: "in" },
    { id: "lb_e2", sourceNodeId: dtmfUhid.id, sourcePortId: "success", targetNodeId: aiAgent.id, targetPortId: "in" },
    { id: "lb_e3", sourceNodeId: aiAgent.id, sourcePortId: "call_completed", targetNodeId: returnNode.id, targetPortId: "in" },
  ];

  return {
    id: "template_lab_enquiries",
    hospitalId: "template",
    name: "Lab & Diagnostics Enquiries Flow",
    description: "Blood test readiness verification, sample collection timings, and automated SMS report download link dispatch.",
    status: "PUBLISHED",
    deploymentStatus: "PUBLISHED_INTERNALLY",
    isDefault: false,
    currentVersion: 1,
    category: "LAB_ENQUIRIES",
    direction: "INBOUND",
    executionPriority: 10,
    isEnabled: true,
    isTemplate: true,
    templateCategory: "Diagnostics",
    nodes,
    edges,
    variables: {},
    lastUpdatedBy: "Smrkomed Template Engine",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function buildTemplateDoctorInfo(hospitalName = "General Hospital", emergencyNumber = ""): IvrFlowData {
  const defaults = { hospitalName, emergencyNumber };

  const incomingNode = createDefaultNode("INCOMING_CALL", { x: 60, y: 220 }, defaults);
  const aiAgent = createDefaultNode("AI_VOICE_AGENT", { x: 340, y: 220 }, defaults);
  aiAgent.title = "Consultant Directory Voice Assistant";
  const returnNode = createDefaultNode("RETURN_SUBFLOW", { x: 700, y: 220 }, defaults);

  const nodes: FlowNode[] = [incomingNode, aiAgent, returnNode];
  const edges: FlowEdge[] = [
    { id: "di_e1", sourceNodeId: incomingNode.id, sourcePortId: "next", targetNodeId: aiAgent.id, targetPortId: "in" },
    { id: "di_e2", sourceNodeId: aiAgent.id, sourcePortId: "call_completed", targetNodeId: returnNode.id, targetPortId: "in" },
  ];

  return {
    id: "template_doctor_info",
    hospitalId: "template",
    name: "Doctor & Specialist Info Flow",
    description: "Profiles, visiting days, qualification credentials, and token schedule for senior doctors and visiting specialists.",
    status: "PUBLISHED",
    deploymentStatus: "PUBLISHED_INTERNALLY",
    isDefault: false,
    currentVersion: 1,
    category: "DOCTOR_INFO",
    direction: "INBOUND",
    executionPriority: 10,
    isEnabled: true,
    isTemplate: true,
    templateCategory: "Doctors",
    nodes,
    edges,
    variables: {},
    lastUpdatedBy: "Smrkomed Template Engine",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function buildTemplateCustom(hospitalName = "General Hospital", emergencyNumber = ""): IvrFlowData {
  const defaults = { hospitalName, emergencyNumber };

  const incomingNode = createDefaultNode("INCOMING_CALL", { x: 80, y: 220 }, defaults);
  const aiAgent = createDefaultNode("DIRECT_AI_RECEPTIONIST", { x: 400, y: 220 }, defaults);
  const endCallNode = createDefaultNode("END_CALL", { x: 760, y: 220 }, defaults);

  const nodes: FlowNode[] = [incomingNode, aiAgent, endCallNode];
  const edges: FlowEdge[] = [
    { id: "cs_e1", sourceNodeId: incomingNode.id, sourcePortId: "next", targetNodeId: aiAgent.id, targetPortId: "in" },
    { id: "cs_e2", sourceNodeId: aiAgent.id, sourcePortId: "call_completed", targetNodeId: endCallNode.id, targetPortId: "in" },
  ];

  return {
    id: "template_custom",
    hospitalId: "template",
    name: "Custom Blank Hospital Flow",
    description: "A minimal starter template with incoming call entry, direct AI receptionist, and polite termination for bespoke clinical workflows.",
    status: "DRAFT",
    deploymentStatus: "SMRKOMED_DRAFT",
    isDefault: false,
    currentVersion: 1,
    category: "CUSTOM",
    direction: "INBOUND",
    executionPriority: 0,
    isEnabled: true,
    isTemplate: true,
    templateCategory: "Custom",
    nodes,
    edges,
    variables: {},
    lastUpdatedBy: "Smrkomed Template Engine",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ----------------------------------------------------
// REGISTRY & CLONING UTILITIES
// ----------------------------------------------------

export const ALL_TEMPLATES_BUILDERS: Record<string, (hospName?: string, emNum?: string) => IvrFlowData> = {
  template_main_ai_reception: buildTemplateMainAiReception,
  template_emergency_escalation: buildTemplateEmergencyEscalation,
  template_department_routing: buildTemplateDepartmentRouting,
  template_after_hours: buildTemplateAfterHours,
  template_appointment_enquiries: buildTemplateAppointmentEnquiries,
  template_appointment_booking: buildTemplateAppointmentBooking,
  template_billing_insurance: buildTemplateBillingInsurance,
  template_human_handoff: buildTemplateHumanHandoff,
  template_lab_enquiries: buildTemplateLabEnquiries,
  template_doctor_info: buildTemplateDoctorInfo,
  template_custom: buildTemplateCustom,
};

export function getFlowTemplatesCatalog(): IvrFlowTemplateSummary[] {
  return Object.values(ALL_TEMPLATES_BUILDERS).map((builder) => {
    const flow = builder();
    return {
      id: flow.id,
      name: flow.name,
      description: flow.description || "",
      category: flow.category,
      nodeCount: flow.nodes.length,
      executionPriority: flow.executionPriority,
      isDefaultCandidate: flow.category === "INBOUND_RECEPTION",
    };
  });
}

export function getFlowTemplateById(templateId: string, hospitalName?: string, emergencyNumber?: string): IvrFlowData | null {
  const builder = ALL_TEMPLATES_BUILDERS[templateId];
  if (!builder) return null;
  return builder(hospitalName, emergencyNumber);
}

export function cloneFlowFromTemplate(
  templateId: string,
  hospitalId: string,
  hospitalName = "General Hospital",
  overrides?: Partial<IvrFlowData>
): IvrFlowData {
  const template = getFlowTemplateById(templateId, hospitalName);
  if (!template) {
    throw new Error(`Template '${templateId}' not found in Smrkomed template catalog.`);
  }

  const newFlowId = `flow_${hospitalId}_${template.category.toLowerCase()}_${Date.now()}`;
  const now = new Date().toISOString();

  // Deep clone nodes and edges with fresh node IDs to ensure complete uniqueness
  const nodeIdMap = new Map<string, string>();
  const clonedNodes: FlowNode[] = template.nodes.map((node) => {
    const newId = `node_${node.type.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    nodeIdMap.set(node.id, newId);
    return {
      ...node,
      id: newId,
      data: JSON.parse(JSON.stringify(node.data)),
      ports: {
        inputs: [...node.ports.inputs],
        outputs: [...node.ports.outputs],
      },
    };
  });

  const clonedEdges: FlowEdge[] = template.edges.map((edge, index) => {
    return {
      id: `edge_${Date.now()}_${index}`,
      sourceNodeId: nodeIdMap.get(edge.sourceNodeId) || edge.sourceNodeId,
      sourcePortId: edge.sourcePortId,
      targetNodeId: nodeIdMap.get(edge.targetNodeId) || edge.targetNodeId,
      targetPortId: edge.targetPortId,
      label: edge.label,
    };
  });

  return {
    ...template,
    id: newFlowId,
    hospitalId,
    name: overrides?.name || `${template.name} (${hospitalName})`,
    description: overrides?.description || template.description,
    status: overrides?.status || "DRAFT",
    deploymentStatus: overrides?.deploymentStatus || "SMRKOMED_DRAFT",
    isDefault: overrides?.isDefault !== undefined ? overrides.isDefault : false,
    currentVersion: 1,
    nodes: clonedNodes,
    edges: clonedEdges,
    variables: {
      ...template.variables,
      ...(overrides?.variables || {}),
    },
    isTemplate: false,
    isEnabled: true,
    lastUpdatedBy: overrides?.lastUpdatedBy || "Hospital Administrator",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

