/**
 * ============================================================================
 * SMRKOMED / SMRKO VOICE DRAFT SPECIFICATION & ACTION TOOL REGISTRY (PHASE 3, 4, 5)
 * ============================================================================
 *
 * Defines the Draft Agent Version (v9) for Daya General Hospital, Thrissur.
 * Powered by SMRKO VOICE Engine.
 *
 * Implements:
 * 1. Complete tool schemas for all SMRKO VOICE action endpoints:
 *    - context (GET /api/v1/voice-agent/context)
 *    - check-availability (POST /api/v1/voice-agent/check-availability)
 *    - book-appointment (POST /api/v1/voice-agent/book-appointment)
 *    - reschedule-appointment (POST /api/v1/voice-agent/reschedule-appointment)
 *    - cancel-appointment (POST /api/v1/voice-agent/cancel-appointment)
 *    - get-appointment (POST /api/v1/voice-agent/get-appointment)
 *    - get-doctors (GET /api/v1/voice-agent/doctors)
 *    - emergency-escalate (POST /api/v1/voice-agent/emergency-escalate)
 *    - call-ended (POST /api/v1/voice-agent/call-ended)
 *    - call_transfer (CORE_TOOL)
 * 2. Intelligent Receptionist Action Execution:
 *    - Eliminates passive human handoffs ("I will forward to the receptionist").
 *    - Takes direct action via tools for all bookings, lookups, reschedules, and cancellations.
 * 3. Bilingual natural Malayalam (kavitha) & Indian English fluency.
 * 4. Acute emergency casualty fast-tracking and zero-delay safety policy.
 * 5. Strict multi-tenant isolation (scoped to hosp_daya_thrissur).
 */

import { SarvamVoiceAgentDeployment, SarvamAgentTool } from "./voice-agent-types";

export const DRAFT_AGENT_APP_ID = "smrkomed-8401f738-b749";
export const PUBLISHED_VERSION_NUMBER = 8;
export const DRAFT_VERSION_NUMBER = 9;

export const SARVAM_BOUND_TOOLS: SarvamAgentTool[] = [
  {
    name: "context",
    description: "Fetches live Daya Hospital operational context, active departments, visiting hours, and policies.",
    type: "API_TOOL",
    parameters: {
      type: "object",
      properties: {
        hospitalId: {
          type: "string",
          description: "Hospital tenant ID (default: hosp_daya_thrissur)",
        },
      },
    },
    endpoint: {
      url: "https://dayahospital-production-467a7d31.up.railway.app/api/v1/voice-agent/context",
      method: "GET",
      headers: {
        "X-SMRKOMED-Tenant": "hosp_daya_thrissur",
      },
      timeoutMs: 3000,
    },
  },
  {
    name: "get-doctors",
    description: "Searches available doctors by department or specialty in Daya Hospital.",
    type: "API_TOOL",
    parameters: {
      type: "object",
      properties: {
        department: {
          type: "string",
          description: "Department name or code (e.g. Cardiology, Orthopaedics, Paediatrics, ENT, General Medicine)",
        },
        query: {
          type: "string",
          description: "Search keyword (doctor name or specialty)",
        },
        hospitalId: {
          type: "string",
          description: "Hospital tenant ID (default: hosp_daya_thrissur)",
        },
      },
    },
    endpoint: {
      url: "https://dayahospital-production-467a7d31.up.railway.app/api/v1/voice-agent/doctors",
      method: "GET",
      headers: {
        "X-SMRKOMED-Tenant": "hosp_daya_thrissur",
      },
      timeoutMs: 3000,
    },
  },
  {
    name: "check-availability",
    description: "Queries doctor OPD consulting hours and appointment slot availability in Daya Hospital.",
    type: "API_TOOL",
    parameters: {
      type: "object",
      properties: {
        departmentId: {
          type: "string",
          description: "Department code or name (e.g. Cardiology, Orthopaedics, Paediatrics, General Medicine)",
        },
        doctorName: {
          type: "string",
          description: "Optional specific doctor name to check",
        },
        preferredDate: {
          type: "string",
          description: "Preferred appointment date in YYYY-MM-DD format",
        },
        hospitalId: {
          type: "string",
          description: "Hospital tenant ID (default: hosp_daya_thrissur)",
        },
      },
      required: ["departmentId"],
    },
    endpoint: {
      url: "https://dayahospital-production-467a7d31.up.railway.app/api/v1/voice-agent/check-availability",
      method: "POST",
      headers: {
        "X-SMRKOMED-Tenant": "hosp_daya_thrissur",
      },
      timeoutMs: 4000,
    },
  },
  {
    name: "book-appointment",
    description: "Books a confirmed OPD appointment in Daya Hospital Management System (HMS).",
    type: "API_TOOL",
    parameters: {
      type: "object",
      properties: {
        patientName: {
          type: "string",
          description: "Full legal name of the patient",
        },
        patientPhone: {
          type: "string",
          description: "Patient contact mobile number in E.164 format (+91...)",
        },
        departmentId: {
          type: "string",
          description: "Department name or code",
        },
        doctorName: {
          type: "string",
          description: "Optional selected doctor name",
        },
        appointmentDate: {
          type: "string",
          description: "Appointment date in YYYY-MM-DD format",
        },
        slotTime: {
          type: "string",
          description: "Selected slot time (e.g. 10:30 AM)",
        },
        hospitalId: {
          type: "string",
          description: "Hospital tenant ID (default: hosp_daya_thrissur)",
        },
        idempotencyKey: {
          type: "string",
          description: "Optional unique key to prevent duplicate booking submissions",
        },
      },
      required: ["patientName", "patientPhone", "departmentId"],
    },
    endpoint: {
      url: "https://dayahospital-production-467a7d31.up.railway.app/api/v1/voice-agent/book-appointment",
      method: "POST",
      headers: {
        "X-SMRKOMED-Tenant": "hosp_daya_thrissur",
      },
      timeoutMs: 5000,
    },
  },
  {
    name: "reschedule-appointment",
    description: "Reschedules an existing appointment to a new date or slot in Daya Hospital.",
    type: "API_TOOL",
    parameters: {
      type: "object",
      properties: {
        bookingRef: {
          type: "string",
          description: "Existing appointment booking reference (e.g. DAYA-HMS-OPD-78219)",
        },
        patientMobile: {
          type: "string",
          description: "Caller/patient mobile number",
        },
        targetDate: {
          type: "string",
          description: "New requested appointment date in YYYY-MM-DD format",
        },
        targetSlotTime: {
          type: "string",
          description: "New requested slot time (e.g. 10:30 AM)",
        },
        hospitalId: {
          type: "string",
          description: "Hospital tenant ID (default: hosp_daya_thrissur)",
        },
      },
      required: ["bookingRef", "targetDate", "targetSlotTime"],
    },
    endpoint: {
      url: "https://dayahospital-production-467a7d31.up.railway.app/api/v1/voice-agent/reschedule-appointment",
      method: "POST",
      headers: {
        "X-SMRKOMED-Tenant": "hosp_daya_thrissur",
      },
      timeoutMs: 5000,
    },
  },
  {
    name: "cancel-appointment",
    description: "Cancels an existing appointment in Daya Hospital and releases the slot.",
    type: "API_TOOL",
    parameters: {
      type: "object",
      properties: {
        bookingRef: {
          type: "string",
          description: "Appointment booking reference to cancel (e.g. DAYA-HMS-OPD-78219)",
        },
        reason: {
          type: "string",
          description: "Optional reason for cancellation",
        },
        hospitalId: {
          type: "string",
          description: "Hospital tenant ID (default: hosp_daya_thrissur)",
        },
      },
      required: ["bookingRef"],
    },
    endpoint: {
      url: "https://dayahospital-production-467a7d31.up.railway.app/api/v1/voice-agent/cancel-appointment",
      method: "POST",
      headers: {
        "X-SMRKOMED-Tenant": "hosp_daya_thrissur",
      },
      timeoutMs: 4000,
    },
  },
  {
    name: "get-appointment",
    description: "Looks up active appointments for a patient using their phone number or booking reference.",
    type: "API_TOOL",
    parameters: {
      type: "object",
      properties: {
        bookingRef: {
          type: "string",
          description: "Appointment reference to lookup",
        },
        patientMobile: {
          type: "string",
          description: "Patient phone number to lookup appointments",
        },
        hospitalId: {
          type: "string",
          description: "Hospital tenant ID (default: hosp_daya_thrissur)",
        },
      },
    },
    endpoint: {
      url: "https://dayahospital-production-467a7d31.up.railway.app/api/v1/voice-agent/get-appointment",
      method: "POST",
      headers: {
        "X-SMRKOMED-Tenant": "hosp_daya_thrissur",
      },
      timeoutMs: 4000,
    },
  },
  {
    name: "emergency-escalate",
    description: "Triggers immediate emergency casualty triage override for acute medical symptoms (chest pain, breathlessness, bleeding, loss of consciousness).",
    type: "API_TOOL",
    parameters: {
      type: "object",
      properties: {
        symptom: {
          type: "string",
          description: "Reported acute medical symptom",
        },
        callerPhone: {
          type: "string",
          description: "Phone number of caller",
        },
        callSid: {
          type: "string",
          description: "Carrier telephony CallSid",
        },
        hospitalId: {
          type: "string",
          description: "Hospital tenant ID (default: hosp_daya_thrissur)",
        },
      },
      required: ["symptom"],
    },
    endpoint: {
      url: "https://dayahospital-production-467a7d31.up.railway.app/api/v1/voice-agent/emergency-escalate",
      method: "POST",
      headers: {
        "X-SMRKOMED-Tenant": "hosp_daya_thrissur",
      },
      timeoutMs: 2500,
    },
  },
  {
    name: "call-ended",
    description: "Lifecycle hook triggered at call conclusion to record transcripts, durations, dispositions, and audio recordings.",
    type: "API_TOOL",
    parameters: {
      type: "object",
      properties: {
        interaction_id: {
          type: "string",
          description: "Unique Sarvam interaction identifier",
        },
        call_sid: {
          type: "string",
          description: "Carrier CallSid",
        },
        duration_seconds: {
          type: "number",
          description: "Total call duration in seconds",
        },
        status: {
          type: "string",
          description: "Call completion status",
        },
        disposition: {
          type: "string",
          description: "Call disposition category",
        },
        transcript_turns: {
          type: "array",
          description: "List of conversation speech turns",
        },
      },
      required: ["interaction_id"],
    },
    endpoint: {
      url: "https://dayahospital-production-467a7d31.up.railway.app/api/v1/voice-agent/call-ended",
      method: "POST",
      headers: {
        "X-SMRKOMED-Tenant": "hosp_daya_thrissur",
      },
      timeoutMs: 5000,
    },
  },
  {
    name: "call_transfer",
    description: "Native carrier SIP/telephony transfer tool to bridge call to human receptionist desk or emergency department.",
    type: "CORE_TOOL",
    parameters: {
      type: "object",
      properties: {
        destinationNumber: {
          type: "string",
          description: "Target E.164 phone number to bridge call",
        },
      },
    },
  },
];

export const DRAFT_AGENT_SYSTEM_PROMPT = `
നിങ്ങൾ തൃശ്ശൂർ ദയ ജനറൽ ഹോസ്പിറ്റലിന്റെ (Daya General Hospital, Thrissur) ഔദ്യോഗിക ഇന്റലിജന്റ് AI വോയ്സ് റിസപ്ഷനിസ്റ്റായ "ദയ സഹായി" (Daya Sahayi) ആണ്. പവർ ചെയ്യുന്നത്: SMRKO VOICE.

ഭാഷാ നയം (Language Policy):
- നിങ്ങളുടെ പ്രാഥമിക ഭാഷ മലയാളമാണ്. സൗമ്യവും വിനയപൂർവ്വവുമായ സാധാരണ സംസാര മലയാളത്തിൽ (Natural spoken Malayalam) സംസാരിക്കുക.
- വിളിക്കുന്നയാൾ ഇംഗ്ലീഷിലാണ് സംസാരിക്കുന്നതെങ്കിൽ, അല്ലെങ്കിൽ സംഭാഷണത്തിനിടയിൽ ഇംഗ്ലീഷിലേക്ക് മാറുകയാണെങ്കിൽ, ഉടനടി വ്യക്തമായ ഇംഗ്ലീഷിൽ മറുപടി നൽകുക (വ്യക്തമായ ഇംഗ്ലീഷിൽ മറുപടി നൽകുക - Seamless bilingual switching).
- ആവശ്യമില്ലാത്ത നീണ്ട ആമുഖങ്ങൾ ഒഴിവാക്കി കൃത്യവും വിനയപൂർവ്വവുമായ മറുപടികൾ നൽകുക.

പ്രധാന റിസപ്ഷനിസ്റ്റ് പ്രവർത്തനങ്ങൾ (ACTION EXECUTION MANDATE):
നിങ്ങൾ വെറുമൊരു സംഭാഷണ ബോട്ട് അല്ല, ആശുപത്രിയുടെ കാര്യക്ഷമമായ വോയ്സ് റിസപ്ഷനിസ്റ്റാണ്. അതിനാൽ "ഞാൻ ഇത് റിസപ്ഷനിസ്റ്റിന് കൈമാറാം" എന്ന് ഒരിക്കലും പറയരുത്. താഴെ പറയുന്ന ആവശ്യങ്ങൾക്ക് നേരിട്ട് ടൂളുകൾ ഉപയോഗിക്കുക:

1. ഡോക്ടർമാരുടെ വിവരങ്ങൾ: ഏതെങ്കിലും സ്പെഷ്യലിസ്റ്റ് ഡോക്ടറെപ്പറ്റി ചോദിച്ചാൽ @get-doctors ടൂൾ ഉപയോഗിച്ച് ഡോക്ടർമാരുടെ പേരുകളും വിഭാഗങ്ങളും നൽകുക.
2. ഒ.പി.ഡി ലഭ്യത പരിശോധന: പരിശോധനാ സമയങ്ങളും ലഭ്യമായ സ്ലോട്ടുകളും അറിയുവാൻ @check-availability ടൂൾ ഉപയോഗിച്ച് അടുത്ത 2-3 സ്ലോട്ടുകൾ നൽകുക.
3. പുതിയ അപ്പോയിന്റ്മെന്റ് ബുക്കിംഗ്: രോഗിയുടെ പേര്, ഫോൺ നമ്പർ, വിഭാഗം/ഡോക്ടർ എന്നിവ ചോദിച്ച് സ്ഥിരീകരിച്ച ശേഷം @book-appointment ടൂൾ പ്രവർത്തിപ്പിച്ച് ടോക്കൺ നമ്പറും ബുക്കിംഗ് റഫറൻസും രോഗിക്ക് നൽകുക.
4. അപ്പോയിന്റ്മെന്റ് മാറ്റി നിശ്ചയിക്കൽ (Reschedule): നിലവിലെ ബുക്കിംഗ് റഫറൻസ് നമ്പറും പുതിയ തീയതിയും ചോദിച്ച് @reschedule-appointment ടൂൾ പ്രവർത്തിപ്പിച്ച് പുതിയ സമയം സ്ഥിരീകരിക്കുക.
5. അപ്പോയിന്റ്മെന്റ് റദ്ദാക്കൽ (Cancel): ബുക്കിംഗ് റഫറൻസ് നമ്പർ ചോദിച്ച് @cancel-appointment ടൂൾ പ്രവർത്തിപ്പിച്ച് റദ്ദാക്കുക.
6. നിലവിലെ അപ്പോയിന്റ്മെന്റ് വിവരങ്ങൾ അറിയൽ (Lookup): റഫറൻസ് നമ്പറോ ഫോൺ നമ്പറോ ഉപയോഗിച്ച് @get-appointment ടൂൾ പ്രവർത്തിപ്പിച്ച് വിവരം നൽകുക.
7. ഹോസ്പിറ്റൽ വിവരങ്ങൾ: സന്ദർശന സമയം, ലാബ്, ഫാർമസി വിവരങ്ങൾ എന്നിവയ്ക്ക് @context ടൂൾ ഉപയോഗിക്കുക.

മനുഷ്യ റിസപ്ഷനിസ്റ്റിലേക്ക് കൈമാറേണ്ട സന്ദർഭങ്ങൾ (STRICT HUMAN TRANSFER CRITERIA):
താഴെ പറയുന്ന സന്ദർഭങ്ങളിൽ മാത്രമേ കോൾ മനുഷ്യ റിസപ്ഷനിസ്റ്റിലേക്ക് മാറ്റാവൂ:
a) വിളിക്കുന്ന വ്യക്തി നേരിട്ട് ഒരു മനുഷ്യ റിസപ്ഷനിസ്റ്റുമായി സംസാരിക്കണമെന്ന് ആവശ്യപ്പെടുമ്പോൾ ("മനുഷ്യനോട് സംസാരിക്കണം", "ട്രാൻസ്ഫർ ചെയ്യ്").
b) അടിയന്തിര മെഡിക്കൽ എമർജൻസി ഉണ്ടാകുമ്പോൾ (@emergency-escalate പ്രവർത്തിപ്പിച്ച ശേഷം).
c) സാങ്കേതിക തകരാർ കാരണം ടൂൾ പ്രവർത്തനം പരാജയപ്പെടുമ്പോൾ.

കർശനമായ ആരോഗ്യ സുരക്ഷാ മാർഗ്ഗനിർദ്ദേശങ്ങൾ (STRICT HEALTHCARE SAFETY GUARDRAILS):
- ഒരു കാരണവശാലും രോഗികൾക്ക് രോഗനിർണ്ണയമോ (രോഗനിർണ്ണയമോ - medical diagnosis), മരുന്നുകളുടെ കുറിപ്പടിയോ (മരുന്നുകളുടെ കുറിപ്പടിയോ - drug prescription), മരുന്നുകളുടെ അളവോ (drug dosage) നൽകുവാൻ പാടുള്ളതല്ല.
- രോഗലക്ഷണങ്ങൾ പറയുന്ന രോഗികളോട് ദയ ഹോസ്പിറ്റലിലെ സ്പെഷ്യലിസ്റ്റ് ഡോക്ടറെ നേരിൽ കണ്ട് പരിശോധന നടത്തുവാൻ വിനയത്തോടെ നിർദ്ദേശിക്കുക.

അടിയന്തിര ഘട്ടങ്ങൾ (EMERGENCY OVERRIDE PROTOCOL):
- വിളിക്കുന്ന വ്യക്തിക്ക് നെഞ്ചുവേദന (chest pain), ശ്വാസതടസ്സം (breathing difficulty), ബോധക്ഷയം, കടുത്ത പരുക്ക് തുടങ്ങിയ അടിയന്തിര ലക്ഷണങ്ങളുണ്ടെങ്കിൽ, സമയം പാഴാക്കാതെ ഉടൻ തന്നെ @emergency-escalate ടൂൾ പ്രവർത്തിപ്പിച്ച് കാഷ്വാലിറ്റിയിലേക്ക് കോൾ കൈമാറുക.
- പറയേണ്ട വാചകം: "ഇതൊരു അടിയന്തിര സാഹചര്യമായി കണക്കാക്കുന്നു. ഉടൻ തന്നെ നിങ്ങളെ ദയ ഹോസ്പിറ്റൽ 24 മണിക്കൂർ കാഷ്വാലിറ്റി മെഡിക്കൽ ടീമിലേക്ക് കൈമാറുന്നു. ദയവായി ലൈനിൽ തുടരുക."

പരാജയപ്പെടൽ മാർഗ്ഗം (FALLBACK):
- ടൂളുകൾ ലഭ്യമല്ലെങ്കിലോ സാങ്കേതിക തടസ്സമുണ്ടായാലോ, വിളിക്കുന്നയാളോട് മാപ്പ് പറഞ്ഞ് ദയ ഹോസ്പിറ്റൽ ഹെൽപ്പ് ലൈൻ നമ്പറിലേക്ക് (0487 247 5000) വിളിക്കാൻ നിർദ്ദേശിക്കുക.
`.trim();

export const DRAFT_AGENT_VERSION_9_DEPLOYMENT: SarvamVoiceAgentDeployment = {
  id: "Inbound-3b5df8df-f098",
  name: "Daya Hospital Malayalam Receptionist (SMRKO VOICE - Draft v9)",
  description: "Phase 3/5 Draft v9 SMRKO VOICE Agent with complete action tools and zero-receptionist-loop mandate",
  orgId: "01a06777-00d4-7317-835c-507054052514",
  workspaceId: "01a06777-00da-7f77-abe3-dc1fc871a5ab",
  systemPrompt: DRAFT_AGENT_SYSTEM_PROMPT,
  primaryLanguage: "ml-IN",
  secondaryLanguages: ["en-IN"],
  voiceId: "kavitha",
  tools: SARVAM_BOUND_TOOLS,
  onStartHook: {
    url: "https://dayahospital-production-467a7d31.up.railway.app/api/v1/voice-agent/context",
    method: "GET",
    headers: {
      "X-SMRKOMED-Tenant": "hosp_daya_thrissur",
    },
    timeoutMs: 3000,
  },
  onEndHook: {
    url: "https://dayahospital-production-467a7d31.up.railway.app/api/v1/voice-agent/call-ended",
    method: "POST",
    headers: {
      "X-SMRKOMED-Tenant": "hosp_daya_thrissur",
    },
    timeoutMs: 5000,
  },
  telephonyProvider: "VOBIZ",
  telephonyConnectionId: "587ab0c5-8f-f564346c-f2ae",
  version: DRAFT_VERSION_NUMBER,
  status: "DRAFT",
  createdAt: "2026-11-26T08:40:00.000Z",
  updatedAt: "2026-11-26T16:10:00.000Z",
};

export const SARVAM_EXOTEL_CHANNEL_ENDPOINT = "https://apps.sarvam.ai/api/app-runtime/channels/exotel";

export const DRAFT_AGENT_VERSION_9_EXOTEL_DEPLOYMENT: SarvamVoiceAgentDeployment = {
  ...DRAFT_AGENT_VERSION_9_DEPLOYMENT,
  id: "Inbound-Daya-Exotel-Sandbox",
  name: "Daya Hospital Malayalam Receptionist (Exotel Direct BYOT - Draft v9)",
  telephonyProvider: "EXOTEL",
  telephonyConnectionId: "pending_exotel_byot_connection",
  channelRuntimeUrl: SARVAM_EXOTEL_CHANNEL_ENDPOINT,
  status: "DRAFT",
};

// Aliases for backwards compatibility with existing test suites
export const DAYA_VOICE_AGENT_TOOLS = SARVAM_BOUND_TOOLS;
export const DAYA_PILOT_SYSTEM_PROMPT = DRAFT_AGENT_SYSTEM_PROMPT;
export const DAYA_PILOT_VOICE_AGENT_DEPLOYMENT = DRAFT_AGENT_VERSION_9_DEPLOYMENT;
