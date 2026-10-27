import {
  CallRecord,
  AiActionDetail,
  KnowledgeArticle,
  OverviewMetrics,
  UserProfile,
} from "@/types";

export const MOCK_USER: UserProfile = {
  id: "usr_daya_01",
  name: "Dr. Anjali Menon",
  email: "anjali.menon@dayahospital.com",
  role: "HOSPITAL_ADMIN",
  department: "Healthcare Informatics & Patient Care",
  avatarUrl: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&auto=format&fit=crop&q=80",
};

export const MOCK_OVERVIEW_METRICS: OverviewMetrics = {
  totalCallsOffered: 1248,
  callsAnsweredByAi: 1184,
  callsHandledSuccessfully: 1042,
  callsMissedOrDropped: 64,
  callsTransferredToStaff: 142,
  callsRequiringFollowUp: 38,
  appointmentsBooked: 312,
  appointmentsRescheduled: 84,
  appointmentsCancelled: 29,
  failedActions: 9,
  avgCallDurationSecs: 148,
  systemHealth: {
    sarvamAiVoice: "HEALTHY",
    dayaHmsGateway: "HEALTHY",
    ivrTelephonyTrunk: "HEALTHY",
    activeChannels: 18,
    totalCapacity: 30,
    averageLatencyMs: 240,
    lastPingTimestamp: "2026-10-27T10:55:00+05:30",
    mode: "MOCK_MODE",
  },
  hourlyTrends: [
    { hour: "00:00", offered: 14, answered: 14, transferred: 2 },
    { hour: "02:00", offered: 8, answered: 8, transferred: 1 },
    { hour: "04:00", offered: 12, answered: 11, transferred: 2 },
    { hour: "06:00", offered: 32, answered: 30, transferred: 4 },
    { hour: "08:00", offered: 96, answered: 92, transferred: 12 },
    { hour: "09:00", offered: 148, answered: 142, transferred: 18 },
    { hour: "10:00", offered: 165, answered: 158, transferred: 24 },
    { hour: "11:00", offered: 152, answered: 145, transferred: 20 },
    { hour: "12:00", offered: 110, answered: 106, transferred: 14 },
    { hour: "13:00", offered: 82, answered: 80, transferred: 8 },
    { hour: "14:00", offered: 95, answered: 90, transferred: 11 },
    { hour: "15:00", offered: 105, answered: 100, transferred: 13 },
    { hour: "16:00", offered: 118, answered: 112, transferred: 15 },
    { hour: "17:00", offered: 98, answered: 94, transferred: 9 },
    { hour: "18:00", offered: 74, answered: 70, transferred: 6 },
    { hour: "20:00", offered: 52, answered: 50, transferred: 4 },
    { hour: "22:00", offered: 28, answered: 28, transferred: 3 },
  ],
  intentBreakdown: [
    {
      intent: "APPOINTMENT_BOOKING",
      intentLabel: "OPD Booking & Scheduling",
      count: 425,
      percentage: 34.1,
      color: "#0C5DB8",
    },
    {
      intent: "DOCTOR_AVAILABILITY",
      intentLabel: "Doctor Schedule & Timings",
      count: 289,
      percentage: 23.2,
      color: "#18A99D",
    },
    {
      intent: "CONSULTATION_FEES",
      intentLabel: "Fees & Registration Enquiry",
      count: 178,
      percentage: 14.3,
      color: "#3B82F6",
    },
    {
      intent: "DEPARTMENT_ENQUIRY",
      intentLabel: "Department & Services",
      count: 142,
      percentage: 11.4,
      color: "#06B6D4",
    },
    {
      intent: "INSURANCE_TPA",
      intentLabel: "Insurance & Ayushman Desks",
      count: 94,
      percentage: 7.5,
      color: "#F59E0B",
    },
    {
      intent: "EMERGENCY_AMBULANCE",
      intentLabel: "Emergency / Ambulance Triage",
      count: 48,
      percentage: 3.8,
      color: "#EF4444",
    },
    {
      intent: "GENERAL_QUERY",
      intentLabel: "General Hospital Query",
      count: 72,
      percentage: 5.7,
      color: "#64748B",
    },
  ],
};

export const MOCK_CALL_RECORDS: CallRecord[] = [
  {
    id: "call_901",
    externalCallId: "sarvam_sess_084f1a",
    callerNumber: "+919846018392",
    callerName: "Krishnan Namboothiri",
    startTime: "2026-10-27T10:45:10+05:30",
    endTime: "2026-10-27T10:47:32+05:30",
    durationSeconds: 142,
    callStatus: "ANSWERED",
    callSource: "IVR_ROLLOVER",
    language: "MALAYALAM",
    intentCategory: "APPOINTMENT_BOOKING",
    aiSummary: "Caller booked an OPD consultation for Dr. Suresh Kumar (Orthopaedics) on Wednesday at 10:30 AM. Verified patient UHID and sent SMS confirmation.",
    aiConfidence: 0.98,
    requiresFollowUp: false,
    followUpStatus: "NOT_REQUIRED",
    hmsTransactionRef: "DAYA-HMS-OPD-78219",
    actions: [
      {
        id: "act_101",
        type: "CHECK_DOCTOR_SLOT",
        status: "CONFIRMED",
        description: "Checked Wednesday morning slots for Dr. Suresh Kumar",
        hmsReference: "SLOT-CHECK-291",
        timestamp: "2026-10-27T10:45:34+05:30",
      },
      {
        id: "act_102",
        type: "BOOK_APPOINTMENT",
        status: "CONFIRMED",
        description: "Confirmed OPD Token #14 with HMS (Dr. Suresh Kumar, 10:30 AM)",
        hmsReference: "DAYA-HMS-OPD-78219",
        timestamp: "2026-10-27T10:46:50+05:30",
      },
    ],
    transcript: [
      {
        id: "t_1",
        speaker: "agent",
        speakerName: "Daya AI (Sarvam)",
        text: "Namaskaram! Welcome to Daya General Hospital Thrissur. How may I help you today?",
        malayalamText: "നമസ്കാരം! ദയ ജനറൽ ഹോസ്പിറ്റലിലേക്ക് സ്വാഗതം. താങ്കളെ എങ്ങനെയാണ് സഹായിക്കേണ്ടത്?",
        timestampMs: 0,
      },
      {
        id: "t_2",
        speaker: "caller",
        speakerName: "Caller",
        text: "Namaskaram, I want to consult Dr. Suresh Kumar in Ortho. Is he available tomorrow morning?",
        malayalamText: "നമസ്കാരം, എനിക്ക് ഓർത്തോയിൽ ഡോക്ടർ സുരേഷ് കുമാറിനെ കാണണം. നാളെ രാവിലെ അവൈലബിൾ ആണോ?",
        timestampMs: 5200,
      },
      {
        id: "t_3",
        speaker: "agent",
        speakerName: "Daya AI (Sarvam)",
        text: "Dr. Suresh Kumar is available tomorrow, Wednesday, from 9:30 AM to 1:00 PM. Available slots are at 10:30 AM and 11:45 AM. Which time would you prefer?",
        malayalamText: "ഡോക്ടർ സുരേഷ് കുമാർ നാളെ ബുധനാഴ്ച രാവിലെ 9:30 മുതൽ 1 മണി വരെ ലഭ്യമാണ്. 10:30 നും 11:45 നും സ്ലോട്ട് ഉണ്ട്. ഏത് സമയമാണ് സൗകര്യം?",
        timestampMs: 14200,
      },
      {
        id: "t_4",
        speaker: "caller",
        speakerName: "Caller",
        text: "10:30 AM is good for me. Patient name is Krishnan.",
        malayalamText: "10:30 AM സൗകര്യമാണ്. രോഗിയുടെ പേര് കൃഷ്ണൻ.",
        timestampMs: 25400,
      },
      {
        id: "t_5",
        speaker: "agent",
        speakerName: "Daya AI (Sarvam)",
        text: "Your appointment with Dr. Suresh Kumar is confirmed for Wednesday at 10:30 AM. Token #14. Confirmation SMS has been sent to your registered number. Consultation fee is ₹450 at counter #3.",
        malayalamText: "താങ്കളുടെ അപ്പോയിന്റ്മെന്റ് ബുധനാഴ്ച രാവിലെ 10:30 ന് ടോക്കൺ നമ്പർ 14 ആയി കൺഫേം ചെയ്തിരിക്കുന്നു. കൺഫർമേഷൻ മെസ്സേജ് താങ്കളുടെ ഫോണിൽ ലഭിക്കും. കൗണ്ടർ 3-ൽ ₹450 കൺസൾട്ടേഷൻ ഫീസ് നൽകുക.",
        timestampMs: 38000,
      },
    ],
  },
  {
    id: "call_902",
    externalCallId: "sarvam_sess_091a32",
    callerNumber: "+919447192831",
    callerName: "Sujatha Varma",
    startTime: "2026-10-27T10:32:00+05:30",
    endTime: "2026-10-27T10:35:12+05:30",
    durationSeconds: 192,
    callStatus: "TRANSFERRED",
    callSource: "IVR_ROLLOVER",
    language: "MALAYALAM",
    intentCategory: "INSURANCE_TPA",
    aiSummary: "Enquired about cashless insurance approval for knee arthroscopy surgery under Star Health. Transferred to Daya TPA desk officer upon request.",
    aiConfidence: 0.94,
    requiresFollowUp: false,
    followUpStatus: "RESOLVED",
    actions: [
      {
        id: "act_103",
        type: "TRANSFER_CALL_TO_STAFF",
        status: "CONFIRMED",
        description: "Transferred to TPA / Insurance Helpdesk Extension #204",
        timestamp: "2026-10-27T10:34:50+05:30",
      },
    ],
    transcript: [
      {
        id: "t_11",
        speaker: "agent",
        speakerName: "Daya AI (Sarvam)",
        text: "Namaskaram! Welcome to Daya General Hospital Thrissur. How may I assist you?",
        malayalamText: "നമസ്കാരം! ദയ ജനറൽ ഹോസ്പിറ്റലിലേക്ക് സ്വാഗതം. ഞാൻ എങ്ങനെ സഹായിക്കണം?",
        timestampMs: 0,
      },
      {
        id: "t_12",
        speaker: "caller",
        speakerName: "Caller",
        text: "Does Daya Hospital have cashless facility for Star Health Insurance for knee surgery?",
        malayalamText: "സ്റ്റാർ ഹെൽത്ത് ഇൻഷുറൻസിൽ മുട്ടു മാറ്റിവെക്കൽ സർജറിക്ക് ദയയിൽ ക്യാഷ്‌ലെസ്സ് ഫെസിലിറ്റി ഉണ്ടോ?",
        timestampMs: 4500,
      },
      {
        id: "t_13",
        speaker: "agent",
        speakerName: "Daya AI (Sarvam)",
        text: "Yes, Daya Hospital has approved cashless tie-ups with Star Health TPA for planned surgical procedures. I am connecting you to our Insurance & TPA coordinator for pre-authorization details.",
        malayalamText: "അതെ, സ്റ്റാർ ഹെൽത്ത് ഇൻഷുറൻസ് ഉൾപ്പെടെയുള്ള പ്രധാന ഇൻഷുറൻസുകൾക്ക് ദയയിൽ ക്യാഷ്‌ലെസ്സ് സൗകര്യമുണ്ട്. കൂടുതൽ വിവരങ്ങൾക്ക് ഞാൻ താങ്കളെ ഇൻഷുറൻസ് ഡെസ്കിലേക്ക് കണക്ട് ചെയ്യാം.",
        timestampMs: 14000,
      },
    ],
  },
  {
    id: "call_903",
    externalCallId: "sarvam_sess_1138dd",
    callerNumber: "+919745582910",
    callerName: "Mohammed Fayiz",
    startTime: "2026-10-27T10:14:22+05:30",
    endTime: "2026-10-27T10:16:04+05:30",
    durationSeconds: 102,
    callStatus: "ANSWERED",
    callSource: "DIRECT_HOTLINE",
    language: "MANGLISH",
    intentCategory: "DOCTOR_AVAILABILITY",
    aiSummary: "Enquired about Dr. Anitha Varghese (Diabetology & General Medicine). Informed evening clinic hours (4:00 PM to 7:00 PM on Tuesday & Thursday).",
    aiConfidence: 0.96,
    requiresFollowUp: false,
    followUpStatus: "NOT_REQUIRED",
    actions: [
      {
        id: "act_104",
        type: "CHECK_DOCTOR_SLOT",
        status: "CONFIRMED",
        description: "Retrieved OPD timetable for Dr. Anitha Varghese",
        hmsReference: "SCHED-MED-441",
        timestamp: "2026-10-27T10:14:48+05:30",
      },
    ],
    transcript: [
      {
        id: "t_21",
        speaker: "agent",
        speakerName: "Daya AI (Sarvam)",
        text: "Namaskaram! Daya General Hospital. How can I help you?",
        malayalamText: "നമസ്കാരം! ദയ ജനറൽ ഹോസ്പിറ്റലിലേക്ക് സ്വാഗതം.",
        timestampMs: 0,
      },
      {
        id: "t_22",
        speaker: "caller",
        speakerName: "Caller",
        text: "Doctor Anitha Varghese general medicine innundo?",
        malayalamText: "ഡോക്ടർ അനിത വർഗീസ് ജനറൽ മെഡിസിൻ ഇന്ന് ഉണ്ടോ?",
        timestampMs: 3800,
      },
      {
        id: "t_23",
        speaker: "agent",
        speakerName: "Daya AI (Sarvam)",
        text: "Yes, Dr. Anitha Varghese has OPD today from 4:00 PM to 7:00 PM in Room 108. Registration starts at 3:30 PM. Would you like me to book a slot?",
        malayalamText: "അതെ, ഡോക്ടർ അനിത വർഗീസ് ഇന്ന് വൈകുന്നേരം 4:00 മുതൽ 7:00 വരെ റൂം 108-ൽ ഉണ്ടാകും. ടോക്കൺ ബുക്ക് ചെയ്യണോ?",
        timestampMs: 12000,
      },
    ],
  },
  {
    id: "call_904",
    externalCallId: "sarvam_sess_1189fe",
    callerNumber: "+919495112233",
    callerName: "Biju Parakkal",
    startTime: "2026-10-27T09:58:11+05:30",
    endTime: "2026-10-27T10:01:45+05:30",
    durationSeconds: 214,
    callStatus: "ANSWERED",
    callSource: "IVR_ROLLOVER",
    language: "MALAYALAM",
    intentCategory: "APPOINTMENT_BOOKING",
    aiSummary: "Attempted to reschedule Dr. K. R. Balakrishnan cardiology appointment. HMS API returned slot full error. Flagged for staff follow-up.",
    aiConfidence: 0.91,
    requiresFollowUp: true,
    followUpStatus: "PENDING",
    followUpNotes: "Patient requested morning slot on Oct 29. Regular slots full, staff needs to allocate VIP/Emergency reserve slot.",
    assignedStaff: "Sister Mary (OPD Lead)",
    actions: [
      {
        id: "act_105",
        type: "RESCHEDULE_APPOINTMENT",
        status: "REQUIRES_STAFF_FOLLOW_UP",
        description: "HMS returned slot fully booked; queued for manual OPD coordinator call-back",
        timestamp: "2026-10-27T10:00:15+05:30",
      },
    ],
    transcript: [
      {
        id: "t_31",
        speaker: "agent",
        speakerName: "Daya AI (Sarvam)",
        text: "Namaskaram! Welcome to Daya General Hospital.",
        malayalamText: "നമസ്കാരം! ദയ ജനറൽ ഹോസ്പിറ്റലിലേക്ക് സ്വാഗതം.",
        timestampMs: 0,
      },
      {
        id: "t_32",
        speaker: "caller",
        speakerName: "Caller",
        text: "I have an appointment for Dr. Balakrishnan tomorrow. Can you move it to Thursday morning?",
        malayalamText: "ഡോക്ടർ ബാലകൃഷ്ണന്റെ നാളത്തെ അപ്പോയിന്റ്മെന്റ് വ്യാഴാഴ്ച രാവിലത്തേക്ക് മാറ്റാൻ പറ്റുമോ?",
        timestampMs: 6500,
      },
      {
        id: "t_33",
        speaker: "agent",
        speakerName: "Daya AI (Sarvam)",
        text: "Thursday morning slots for Dr. Balakrishnan are currently fully occupied. Our OPD staff has been notified to check priority slot allocations and will call you back within 30 minutes.",
        malayalamText: "വ്യാഴാഴ്ച രാവിലെ എല്ലാ സാധാരണ സ്ലോട്ടുകളും ഫുൾ ആണ്. താങ്കളെ സഹായിക്കാൻ ഞങ്ങളുടെ ഒപി കോർഡിനേറ്റർ അര മണിക്കൂറിനുള്ളിൽ തിരികെ വിളിക്കുന്നതാണ്.",
        timestampMs: 18200,
      },
    ],
  },
  {
    id: "call_905",
    externalCallId: "sarvam_sess_1204cc",
    callerNumber: "+919847990011",
    callerName: "Deepa Menon",
    startTime: "2026-10-27T09:40:00+05:30",
    endTime: "2026-10-27T09:42:15+05:30",
    durationSeconds: 135,
    callStatus: "ANSWERED",
    callSource: "IVR_ROLLOVER",
    language: "MALAYALAM",
    intentCategory: "CONSULTATION_FEES",
    aiSummary: "Enquired about Paediatric vaccination charges and registration fee. Provided Daya Hospital schedule and advised counter timing.",
    aiConfidence: 0.99,
    requiresFollowUp: false,
    followUpStatus: "NOT_REQUIRED",
    actions: [
      {
        id: "act_106",
        type: "FEE_ENQUIRY",
        status: "CONFIRMED",
        description: "Shared official vaccination fee chart & OPD registration fee",
        timestamp: "2026-10-27T09:41:00+05:30",
      },
    ],
    transcript: [
      {
        id: "t_41",
        speaker: "agent",
        speakerName: "Daya AI (Sarvam)",
        text: "Namaskaram! Welcome to Daya General Hospital.",
        malayalamText: "നമസ്കാരം! ദയ ജനറൽ ഹോസ്പിറ്റലിലേക്ക് സ്വാഗതം.",
        timestampMs: 0,
      },
      {
        id: "t_42",
        speaker: "caller",
        speakerName: "Caller",
        text: "What are the paediatric consultation and vaccination charges?",
        malayalamText: "കുട്ടികളുടെ ഡോക്ടറെ കാണുന്നതിനും വാക്സിനേഷനും എത്രയാണ് ചാർജ്?",
        timestampMs: 4200,
      },
      {
        id: "t_43",
        speaker: "agent",
        speakerName: "Daya AI (Sarvam)",
        text: "Paediatric consultation is ₹350. Standard government vaccinations are free at the primary counter, and optional vaccines have subsidized hospital MRP. Vaccination clinic runs Monday to Saturday from 9 AM to 1 PM.",
        malayalamText: "പീഡിയാട്രിക് കൺസൾട്ടേഷൻ ₹350 ആണ്. സർക്കാർ വാക്സിനുകൾ സൗജന്യവും മറ്റ് വാക്സിനുകൾ സബ്സിഡി നിരക്കിലും ലഭ്യമാണ്. തിങ്കൾ മുതൽ ശനി വരെ രാവിലെ 9 മുതൽ 1 വരെയാണ് വാക്സിനേഷൻ ക്ലിനിക്ക്.",
        timestampMs: 16500,
      },
    ],
  },
  {
    id: "call_906",
    externalCallId: "sarvam_sess_12501a",
    callerNumber: "+919446221144",
    callerName: "Unknown Caller",
    startTime: "2026-10-27T09:12:00+05:30",
    endTime: "2026-10-27T09:13:20+05:30",
    durationSeconds: 80,
    callStatus: "TRANSFERRED",
    callSource: "DIRECT_HOTLINE",
    language: "MALAYALAM",
    intentCategory: "EMERGENCY_AMBULANCE",
    aiSummary: "Emergency dispatch request for road accident near Thrissur Round. Immediate triage bypass to Daya 24x7 Emergency Casualty Desk.",
    aiConfidence: 0.99,
    requiresFollowUp: false,
    followUpStatus: "RESOLVED",
    actions: [
      {
        id: "act_107",
        type: "TRANSFER_CALL_TO_STAFF",
        status: "CONFIRMED",
        description: "Priority bypass to 24/7 Casualty Trauma Team (Ext #100)",
        timestamp: "2026-10-27T09:12:30+05:30",
      },
    ],
    transcript: [
      {
        id: "t_51",
        speaker: "agent",
        speakerName: "Daya AI (Sarvam)",
        text: "Daya General Hospital Emergency. Please state your urgent need.",
        malayalamText: "ദയ ജനറൽ ഹോസ്പിറ്റൽ എമർജൻസി. താങ്കളുടെ അടിയന്തിര ആവശ്യം പറയുക.",
        timestampMs: 0,
      },
      {
        id: "t_52",
        speaker: "caller",
        speakerName: "Caller",
        text: "Accident near Round, need ambulance immediately!",
        malayalamText: "റൗണ്ടിനടുത്ത് ഒരു അപകടം പറ്റിയിട്ടുണ്ട്, ഉടൻ ഒരു ആംബുലൻസ് വേണം!",
        timestampMs: 3100,
      },
      {
        id: "t_53",
        speaker: "agent",
        speakerName: "Daya AI (Sarvam)",
        text: "Connecting you directly to Daya Emergency Casualty and Ambulance Dispatch right now.",
        malayalamText: "ഞാൻ ഉടൻ തന്നെ താങ്കളെ ദയ കാഷ്വാലിറ്റി ആംബുലൻസ് യൂണിറ്റിലേക്ക് കണക്ട് ചെയ്യുകയാണ്.",
        timestampMs: 8200,
      },
    ],
  },
  {
    id: "call_907",
    externalCallId: "sarvam_sess_13010b",
    callerNumber: "+919847119900",
    callerName: "Geetha Mohan",
    startTime: "2026-10-27T08:45:10+05:30",
    endTime: "2026-10-27T08:46:55+05:30",
    durationSeconds: 105,
    callStatus: "ANSWERED",
    callSource: "IVR_ROLLOVER",
    language: "MALAYALAM",
    intentCategory: "DOCTOR_AVAILABILITY",
    aiSummary: "Enquired about Dr. Mathew Joseph (Cardiology). Informed that doctor is in cath lab on Tuesday morning, OPD starts at 2:00 PM.",
    aiConfidence: 0.97,
    requiresFollowUp: false,
    followUpStatus: "NOT_REQUIRED",
    actions: [
      {
        id: "act_108",
        type: "CHECK_DOCTOR_SLOT",
        status: "CONFIRMED",
        description: "Checked schedule for Dr. Mathew Joseph",
        hmsReference: "SCHED-CARD-892",
        timestamp: "2026-10-27T08:45:30+05:30",
      },
    ],
    transcript: [
      {
        id: "t_61",
        speaker: "agent",
        speakerName: "Daya AI (Sarvam)",
        text: "Namaskaram! Welcome to Daya General Hospital.",
        malayalamText: "നമസ്കാരം! ദയ ജനറൽ ഹോസ്പിറ്റലിലേക്ക് സ്വാഗതം.",
        timestampMs: 0,
      },
      {
        id: "t_62",
        speaker: "caller",
        speakerName: "Caller",
        text: "Is Dr. Mathew Joseph available this morning?",
        malayalamText: "ഡോക്ടർ മാത്യു ജോസഫ് ഇന്ന് രാവിലെ ഒപിയിൽ ഉണ്ടോ?",
        timestampMs: 4000,
      },
      {
        id: "t_63",
        speaker: "agent",
        speakerName: "Daya AI (Sarvam)",
        text: "Dr. Mathew Joseph has cardiac procedures this morning. His OPD consultation starts at 2:00 PM. Would you like me to reserve an afternoon token?",
        malayalamText: "ഡോക്ടർ മാത്യു ജോസഫ് ഇന്ന് രാവിലെ കാത്ത് ലാബിലാണ്. ഉച്ചയ്ക്ക് 2:00 മണി മുതലാണ് ഒപി കൺസൾട്ടേഷൻ. ഉച്ചയ്ക്കത്തേക്ക് ടോക്കൺ ബുക്ക് ചെയ്യണോ?",
        timestampMs: 14000,
      },
    ],
  },
  {
    id: "call_908",
    externalCallId: "sarvam_sess_13409a",
    callerNumber: "+919446001122",
    callerName: "K. R. Venu",
    startTime: "2026-10-27T08:20:00+05:30",
    endTime: "2026-10-27T08:21:40+05:30",
    durationSeconds: 100,
    callStatus: "ANSWERED",
    callSource: "IVR_ROLLOVER",
    language: "MALAYALAM",
    intentCategory: "APPOINTMENT_BOOKING",
    aiSummary: "Caller cancelled Dr. Haridas neurology appointment due to personal travel. Token #11 released in HMS.",
    aiConfidence: 0.98,
    requiresFollowUp: false,
    followUpStatus: "NOT_REQUIRED",
    hmsTransactionRef: "DAYA-HMS-OPD-77189",
    actions: [
      {
        id: "act_109",
        type: "CANCEL_APPOINTMENT",
        status: "CONFIRMED",
        description: "Cancelled token #11 for Dr. Haridas in HMS",
        hmsReference: "DAYA-HMS-OPD-77189",
        timestamp: "2026-10-27T08:21:10+05:30",
      },
    ],
    transcript: [
      {
        id: "t_71",
        speaker: "agent",
        speakerName: "Daya AI (Sarvam)",
        text: "Namaskaram! Daya General Hospital.",
        malayalamText: "നമസ്കാരം! ദയ ജനറൽ ഹോസ്പിറ്റൽ.",
        timestampMs: 0,
      },
      {
        id: "t_72",
        speaker: "caller",
        speakerName: "Caller",
        text: "I want to cancel my 11:00 AM appointment with Dr. Haridas today.",
        malayalamText: "ഡോക്ടർ ഹരിദാസിന്റെ ഇന്നത്തെ 11 മണിയുടെ അപ്പോയിന്റ്മെന്റ് ക്യാൻസൽ ചെയ്യണം.",
        timestampMs: 5000,
      },
      {
        id: "t_73",
        speaker: "agent",
        speakerName: "Daya AI (Sarvam)",
        text: "Your appointment has been cancelled. Confirmation message has been dispatched.",
        malayalamText: "താങ്കളുടെ അപ്പോയിന്റ്മെന്റ് ക്യാൻസൽ ചെയ്തിരിക്കുന്നു. കൺഫർമേഷൻ മെസ്സേജ് അയച്ചിട്ടുണ്ട്.",
        timestampMs: 14000,
      },
    ],
  },
  {
    id: "call_909",
    externalCallId: "sarvam_sess_14022a",
    callerNumber: "+919746332211",
    callerName: "Unknown Caller",
    startTime: "2026-10-27T07:55:00+05:30",
    endTime: "2026-10-27T07:55:22+05:30",
    durationSeconds: 22,
    callStatus: "MISSED",
    callSource: "OFF_HOURS",
    language: "MALAYALAM",
    intentCategory: "GENERAL_QUERY",
    aiSummary: "Caller hung up after IVR greeting before stating intent. Queued for callback review.",
    aiConfidence: 0.50,
    requiresFollowUp: false,
    followUpStatus: "NOT_REQUIRED",
    actions: [],
    transcript: [
      {
        id: "t_81",
        speaker: "agent",
        speakerName: "Daya AI (Sarvam)",
        text: "Namaskaram! Welcome to Daya General Hospital Thrissur.",
        malayalamText: "നമസ്കാരം! ദയ ജനറൽ ഹോസ്പിറ്റലിലേക്ക് സ്വാഗതം.",
        timestampMs: 0,
      },
    ],
  },
];

export const MOCK_AI_ACTIONS: AiActionDetail[] = [
  {
    id: "act_detail_01",
    callId: "call_901",
    callerNumber: "+919846018392",
    callerName: "Krishnan Namboothiri",
    actionType: "BOOK_APPOINTMENT",
    status: "CONFIRMED",
    idempotencyKey: "idem_901_book_78219",
    requestedAt: "2026-10-27T10:46:50+05:30",
    completedAt: "2026-10-27T10:46:52+05:30",
    hmsBookingRef: "DAYA-HMS-OPD-78219",
    doctorName: "Dr. Suresh Kumar",
    department: "Orthopaedics & Joint Replacement",
    appointmentSlot: "Wednesday, 28 Oct - 10:30 AM",
    patientUhid: "UHID-2026-8812",
    patientName: "Krishnan Namboothiri",
    payload: {
      doctorId: "DOC_ORTHO_04",
      slotId: "SLOT_WED_1030",
      patientMobile: "+919846018392",
      bookingMode: "AI_SARVAM_VOICE",
    },
    responsePayload: {
      status: "SUCCESS",
      tokenNumber: 14,
      consultationFee: 450,
      counter: "OPD Counter 3",
      smsDispatched: true,
    },
  },
  {
    id: "act_detail_02",
    callId: "call_904",
    callerNumber: "+919495112233",
    callerName: "Biju Parakkal",
    actionType: "RESCHEDULE_APPOINTMENT",
    status: "REQUIRES_STAFF_FOLLOW_UP",
    idempotencyKey: "idem_904_resched_099",
    requestedAt: "2026-10-27T10:00:15+05:30",
    doctorName: "Dr. K. R. Balakrishnan",
    department: "Cardiology",
    appointmentSlot: "Thursday, 29 Oct - Morning Slot",
    patientUhid: "UHID-2024-1923",
    patientName: "Biju Parakkal",
    failureReason: "HMS_CAPACITY_EXCEEDED: Maximum OPD quota of 40 patients reached for requested doctor date.",
    staffNotes: "Staff Sister Mary assigned. Patient will accept 1:30 PM afternoon slot if morning unavailable.",
    payload: {
      originalAppointmentRef: "DAYA-HMS-OPD-71004",
      targetDoctorId: "DOC_CARDIO_01",
      targetDate: "2026-10-29",
      targetTime: "10:00:00",
    },
  },
  {
    id: "act_detail_03",
    callId: "call_902",
    callerNumber: "+919447192831",
    callerName: "Sujatha Varma",
    actionType: "TRANSFER_CALL_TO_STAFF",
    status: "CONFIRMED",
    idempotencyKey: "idem_902_xfer_tpa",
    requestedAt: "2026-10-27T10:34:50+05:30",
    completedAt: "2026-10-27T10:34:55+05:30",
    department: "TPA & Cashless Insurance Desk",
    staffNotes: "Transferred successfully to Ext #204. Star Health cashless pre-auth enquiry.",
  },
  {
    id: "act_detail_04",
    callId: "call_903",
    callerNumber: "+919745582910",
    callerName: "Mohammed Fayiz",
    actionType: "CHECK_DOCTOR_SLOT",
    status: "CONFIRMED",
    idempotencyKey: "idem_903_check_anitha",
    requestedAt: "2026-10-27T10:14:48+05:30",
    completedAt: "2026-10-27T10:14:49+05:30",
    doctorName: "Dr. Anitha Varghese",
    department: "General Medicine & Diabetology",
    appointmentSlot: "Today, Tuesday - 4:00 PM to 7:00 PM",
  },
  {
    id: "act_detail_05",
    callId: "call_890",
    callerNumber: "+919846199882",
    callerName: "Anoop Raghavan",
    actionType: "CANCEL_APPOINTMENT",
    status: "CONFIRMED",
    idempotencyKey: "idem_890_cancel_7718",
    requestedAt: "2026-10-27T08:50:12+05:30",
    completedAt: "2026-10-27T08:50:14+05:30",
    hmsBookingRef: "DAYA-HMS-OPD-77189",
    doctorName: "Dr. Haridas",
    department: "Neurology",
    appointmentSlot: "Tuesday, 27 Oct - 11:00 AM",
    patientUhid: "UHID-2025-4421",
    patientName: "Anoop Raghavan",
    staffNotes: "Appointment cancelled upon patient request due to personal travel. Slot released back into HMS.",
  },
  {
    id: "act_detail_06",
    callId: "call_882",
    callerNumber: "+919744118833",
    callerName: "Mini Thomas",
    actionType: "BOOK_APPOINTMENT",
    status: "FAILED",
    idempotencyKey: "idem_882_book_fail_01",
    requestedAt: "2026-10-27T08:15:30+05:30",
    doctorName: "Dr. Sheela Pillai",
    department: "Obstetrics & Gynaecology",
    patientName: "Mini Thomas",
    failureReason: "HMS_TIMEOUT_504: Daya Hospital Database Gateway timed out after 5000ms. Booking was safely aborted without side-effects.",
    staffNotes: "Call dropped after retry. Automated retry did not duplicate transaction due to idempotency protection.",
  },
];

export const MOCK_KNOWLEDGE_ARTICLES: KnowledgeArticle[] = [
  {
    id: "kb_01",
    title: "OPD Registration & Doctor Consultation Fees",
    titleMalayalam: "ഒപി രജിസ്ട്രേഷനും ഡോക്ടർ കൺസൾട്ടേഷൻ ഫീസും",
    category: "FEES_CHARGES",
    summary: "Standard fees for new registration, follow-ups, general OPD and super-speciality consultants.",
    content: `1. New Patient Registration: ₹100 (one-time lifetime registration with Digital UHID card).
2. General Medicine OPD Consultation: ₹250 (valid for 7 days revisit).
3. Specialist Consultation (Orthopaedics, Paediatrics, ENT, Ophthalmology, OBG): ₹450.
4. Super Speciality (Cardiology, Neurology, Urology, Gastro): ₹600.
5. Emergency Casualty Triage & Doctor Fee: ₹500 (24/7).
6. Payment modes: UPI (GPay/PhonePe), Credit/Debit Cards, Cash, and Approved TPA Cashless.`,
    contentMalayalam: `1. പുതിയ പേഷ്യന്റ് രജിസ്ട്രേഷൻ: ₹100 (ആജീവനാന്ത ഡിജിറ്റൽ UHID കാർഡ്).
2. ജനറൽ മെഡിസിൻ ഒപി കൺസൾട്ടേഷൻ: ₹250 (7 ദിവസത്തിനുള്ളിൽ സൗജന്യ റീവിസിറ്റ്).
3. സ്പെഷ്യലിസ്റ്റ് കൺസൾട്ടേഷൻ (ഓർത്തോ, പീഡിയാട്രിക്സ്, ഇഎൻടി, ഗൈനക്കോളജി): ₹450.
4. സൂപ്പർ സ്പെഷ്യാലിറ്റി (കാർഡിയോളജി, ന്യൂറോളജി, ഗാസ്ട്രോ): ₹600.
5. കാഷ്വാലിറ്റി എമർജൻസി ഫീസ്: ₹500 (24 മണിക്കൂറും).
6. പണമായും കാർഡ് വഴിയും യുപിഐ വഴിയും പണമടയ്ക്കാം.`,
    status: "PUBLISHED",
    version: 4,
    lastUpdatedBy: "Dr. Anjali Menon",
    updatedAt: "2026-10-24T14:30:00+05:30",
    syncedToSarvam: true,
    lastSyncedAt: "2026-10-24T14:35:10+05:30",
    auditHistory: [
      {
        version: 4,
        updatedBy: "Dr. Anjali Menon",
        timestamp: "2026-10-24T14:30:00+05:30",
        summaryOfChanges: "Updated super-speciality consultation charge to ₹600 as per management circular #2026/18.",
      },
      {
        version: 3,
        updatedBy: "Mathew George",
        timestamp: "2026-08-10T11:15:00+05:30",
        summaryOfChanges: "Clarified 7-day revisit policy validity.",
      },
    ],
  },
  {
    id: "kb_02",
    title: "Visiting Hours and Inpatient (IP) Regulations",
    titleMalayalam: "സന്ദർശന സമയങ്ങളും കിടത്തിച്ചികിത്സാ നിയമങ്ങളും",
    category: "HOSPITAL_POLICIES",
    summary: "Visiting hours for general wards, private rooms and intensive care units (ICU).",
    content: `1. General Ward Visiting Hours: Morning 11:30 AM to 1:00 PM; Evening 4:30 PM to 6:30 PM.
2. Only 1 bystander is permitted with the patient around the clock using the Bystander Pass.
3. Maximum 2 visitors per patient at a time during visiting hours.
4. Intensive Care Units (ICU / CCU / NICU): 12:00 PM to 1:00 PM and 5:00 PM to 6:00 PM (1 visitor only, sanitization mandatory).
5. Children under 12 years are restricted from inpatient wards for infection control.`,
    contentMalayalam: `1. ജനറൽ വാർഡ് സന്ദർശന സമയം: രാവിലെ 11:30 മുതൽ 1:00 വരെ; വൈകുന്നേരം 4:30 മുതൽ 6:30 വരെ.
2. രോഗിയോടൊപ്പം നിൽക്കാൻ 1 ബൈസ്റ്റാൻഡർക്ക് മാത്രമേ പാസ്സ് അനുവദിക്കൂ.
3. സന്ദർശന സമയത്ത് ഒരേസമയം 2 സന്ദർശകർക്ക് മാത്രമേ അനുവാദമുള്ളൂ.
4. ഐസിയു / സിസിയു സന്ദർശനം: 12:00 മുതൽ 1:00 വരെയും, വൈകുന്നേരം 5:00 മുതൽ 6:00 വരെയും.
5. അണുബാധ നിയന്ത്രണത്തിനായി 12 വയസ്സിന് താഴെയുള്ള കുട്ടികൾക്ക് വാർഡുകളിൽ പ്രവേശനമില്ല.`,
    status: "PUBLISHED",
    version: 2,
    lastUpdatedBy: "Sister Mary",
    updatedAt: "2026-09-15T09:00:00+05:30",
    syncedToSarvam: true,
    lastSyncedAt: "2026-09-15T09:05:00+05:30",
    auditHistory: [
      {
        version: 2,
        updatedBy: "Sister Mary",
        timestamp: "2026-09-15T09:00:00+05:30",
        summaryOfChanges: "Updated ICU bystander gowning and sanitization rules.",
      },
    ],
  },
  {
    id: "kb_03",
    title: "Doctor OPD Schedules and Specialities",
    titleMalayalam: "ഡോക്ടർമാരുടെ ഒപി സമയക്രമവും സ്പെഷ്യാലിറ്റികളും",
    category: "DOCTORS_SCHEDULE",
    summary: "Weekly doctor consultation hours across major hospital departments.",
    content: `• Cardiology:
  - Dr. K. R. Balakrishnan: Monday, Wednesday, Friday (9:00 AM - 1:00 PM)
  - Dr. Mathew Joseph: Tuesday, Thursday, Saturday (10:00 AM - 2:00 PM)

• Orthopaedics:
  - Dr. Suresh Kumar: Monday to Saturday (9:30 AM - 1:00 PM)
  - Dr. Praveen Menon: Monday to Friday (2:00 PM - 5:00 PM)

• Paediatrics:
  - Dr. Radhika Nair: Monday to Saturday (9:00 AM - 2:00 PM)
  - Evening Clinic: 4:30 PM - 7:00 PM (Duty Paediatrician)

• General Medicine & Diabetology:
  - Dr. Anitha Varghese: Monday to Saturday (9:00 AM - 1:00 PM & 4:00 PM - 7:00 PM)

• 24/7 Casualty & Emergency Trauma:
  - Full medical officer team on duty 24 hours a day, 7 days a week.`,
    contentMalayalam: `• കാർഡിയോളജി:
  - ഡോക്ടർ കെ. ആർ. ബാലകൃഷ്ണൻ: തിങ്കൾ, ബുധൻ, വെള്ളി (9:00 AM - 1:00 PM)
  - ഡോക്ടർ മാത്യു ജോസഫ്: ചൊവ്വ, വ്യാഴം, ശനി (10:00 AM - 2:00 PM)

• ഓർത്തോപീഡിക്സ്:
  - ഡോക്ടർ സുരേഷ് കുമാർ: തിങ്കൾ മുതൽ ശനി വരെ (9:30 AM - 1:00 PM)
  - ഡോക്ടർ പ്രവീൺ മേനോൻ: തിങ്കൾ മുതൽ വെള്ളി വരെ (2:00 PM - 5:00 PM)

• പീഡിയാട്രിക്സ്:
  - ഡോക്ടർ രാധിക നായർ: തിങ്കൾ മുതൽ ശനി വരെ (9:00 AM - 2:00 PM)

• 24 മണിക്കൂർ കാഷ്വാലിറ്റി:
  - അടിയന്തിര വിഭാഗത്തിൽ മുഴുവൻ സമയവും ഡ്യൂട്ടി ഡോക്ടർമാരുടെ സേവനം ലഭ്യമാണ്.`,
    status: "PUBLISHED",
    version: 5,
    lastUpdatedBy: "Dr. Anjali Menon",
    updatedAt: "2026-10-26T16:00:00+05:30",
    syncedToSarvam: true,
    lastSyncedAt: "2026-10-26T16:02:15+05:30",
    auditHistory: [
      {
        version: 5,
        updatedBy: "Dr. Anjali Menon",
        timestamp: "2026-10-26T16:00:00+05:30",
        summaryOfChanges: "Updated Dr. Praveen Menon afternoon slot.",
      },
    ],
  },
  {
    id: "kb_04",
    title: "Insurance, TPA & Ayushman Bharat Empanelment",
    titleMalayalam: "ഇൻഷുറൻസ്, ടിപിഎ, ആയുഷ്മാൻ ഭാരത് സേവനങ്ങൾ",
    category: "INSURANCE_TPA",
    summary: "Cashless insurance empanelment, documentation checklist and Ayushman / Karunya coverage.",
    content: `1. Empanelled Insurance Providers: Star Health, ICICI Lombard, HDFC ERGO, Care Health, Niva Bupa, Reliance General, United India, Oriental Insurance, New India Assurance.
2. Government Schemes:
   - Karunya Benevolent Fund (KBF) & KASP: Empanelled for selected surgical and oncology procedures.
   - Ayushman Bharat PM-JAY: Active for inpatient hospitalization as per state health authority guidelines.
3. Pre-authorization Requirements:
   - Photo ID of patient (Aadhaar / Voter ID)
   - Active Insurance Card / Policy Schedule
   - Doctor's admission advice & preliminary investigation reports
4. Contact TPA Helpdesk directly: Extension 204 (8:00 AM to 8:00 PM).`,
    contentMalayalam: `1. അംഗീകൃത ഇൻഷുറൻസ് കമ്പനികൾ: സ്റ്റാർ ഹെൽത്ത്, ഐസിഐസിഐ ലോംബാർഡ്, എച്ച്ഡിഎഫ്സി എർഗോ, കെയർ ഹെൽത്ത്, നിവ ബുപ, യുണൈറ്റഡ് ഇന്ത്യ, ന്യൂ ഇന്ത്യ അഷ്വറൻസ് തുടങ്ങിയവ.
2. സർക്കാർ പദ്ധതികൾ: കാരുണ്യ ആരോഗ്യ സുരക്ഷാ പദ്ധതി (KASP), ആയുഷ്മാൻ ഭാരത് PM-JAY സൗകര്യം ലഭ്യമാണ്.
3. ആവശ്യമായ രേഖകൾ: ആധാർ കാർഡ്, ഇൻഷുറൻസ് കാർഡ്, ഡോക്ടറുടെ അഡ്മിഷൻ പ്രിസ്ക്രിപ്ഷൻ.
4. ഇൻഷുറൻസ് ഡെസ്ക് സമയം: രാവിലെ 8:00 മുതൽ രാത്രി 8:00 വരെ (എക്സ്റ്റൻഷൻ 204).`,
    status: "PUBLISHED",
    version: 3,
    lastUpdatedBy: "Prakash Nair (TPA Head)",
    updatedAt: "2026-10-18T12:00:00+05:30",
    syncedToSarvam: true,
    lastSyncedAt: "2026-10-18T12:04:10+05:30",
    auditHistory: [
      {
        version: 3,
        updatedBy: "Prakash Nair (TPA Head)",
        timestamp: "2026-10-18T12:00:00+05:30",
        summaryOfChanges: "Updated list of empanelled government scheme packages.",
      },
    ],
  },
  {
    id: "kb_05",
    title: "Emergency Casualty, Trauma & Ambulance Services",
    titleMalayalam: "എമർജൻസി കാഷ്വാലിറ്റി, ട്രോമ, ആംബുലൻസ് സർവീസുകൾ",
    category: "EMERGENCY_AMBULANCE",
    summary: "24/7 emergency care protocol, ICU ambulance fleet, and direct casualty phone numbers.",
    content: `1. Daya 24x7 Emergency Helpline: 0487 2475000 / Ext 100.
2. Direct Ambulance Dispatch: +91 94470 12345 (Advanced Cardiac Life Support ICU Ambulances available).
3. Casualty Location: Ground Floor, Emergency Entrance (East Gate, directly accessible for ambulances).
4. Immediate trauma team on site: Emergency Medical Officer, Trauma Surgeon, Anaesthetist, and Critical Care Nurses.
5. In case of cardiac arrest or stroke symptoms, call emergency directly without waiting for standard OPD IVR queue.`,
    contentMalayalam: `1. ദയ 24 മണിക്കൂർ എമർജൻസി ഹെൽപ്‌ലൈൻ: 0487 2475000 / എക്സ്റ്റൻഷൻ 100.
2. ആംബുലൻസ് ഡയറക്ട് നമ്പർ: +91 94470 12345 (ഐസിയു സൗകര്യമുള്ള ആംബുലൻസ്).
3. കാഷ്വാലിറ്റി പ്രവേശന കവാടം: ഗ്രൗണ്ട് ഫ്ലോർ, ഈസ്റ്റ് ഗേറ്റ്.
4. നെഞ്ചുവേദന, സ്ട്രോക്ക് ലക്ഷണങ്ങൾ എന്നിവയുണ്ടായാൽ ഒപിഐവിആർ വെയിറ്റ് ചെയ്യാതെ ഉടൻ എമർജൻസിയിൽ അറിയിക്കുക.`,
    status: "PUBLISHED",
    version: 1,
    lastUpdatedBy: "Dr. Anjali Menon",
    updatedAt: "2026-10-01T10:00:00+05:30",
    syncedToSarvam: true,
    lastSyncedAt: "2026-10-01T10:01:20+05:30",
    auditHistory: [
      {
        version: 1,
        updatedBy: "Dr. Anjali Menon",
        timestamp: "2026-10-01T10:00:00+05:30",
        summaryOfChanges: "Initial approved emergency casualty protocol.",
      },
    ],
  },
];
