/**
 * ============================================================================
 * SMRKOMED PHASE 10.3: SARVAM VOICE AGENT DRAFT SPECIFICATION & TOOL BINDING
 * ============================================================================
 *
 * Defines the Draft Agent Version (v9) for Daya General Hospital, Thrissur.
 * Preserves published production Version 8 completely untouched.
 *
 * Implements:
 * 1. Exact tool schemas for all 5 Smrkomed endpoints:
 *    - context (GET /api/v1/voice-agent/context)
 *    - check-availability (POST /api/v1/voice-agent/check-availability)
 *    - book-appointment (POST /api/v1/voice-agent/book-appointment)
 *    - emergency-escalate (POST /api/v1/voice-agent/emergency-escalate)
 *    - call-ended (POST /api/v1/voice-agent/call-ended)
 * 2. Grandis HMS simulation guardrails & disclaimer instructions.
 * 3. Bilingual natural Malayalam (kavitha) & Indian English (ratan) fluency.
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
    name: "check-availability",
    description: "Queries doctor OPD consulting hours and appointment slot availability in Daya Hospital.",
    type: "API_TOOL",
    parameters: {
      type: "object",
      properties: {
        departmentId: {
          type: "string",
          description: "Department code (e.g. dept_cardiology, dept_ortho, dept_pediatrics, dept_general_medicine)",
          enum: ["dept_cardiology", "dept_ortho", "dept_pediatrics", "dept_general_medicine"],
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
    description: "Generates a provisional OPD appointment booking reference for Daya Hospital.",
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
          description: "Department code",
        },
        slotTime: {
          type: "string",
          description: "Preferred slot time (e.g. 10:30 AM)",
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
നിങ്ങൾ തൃശ്ശൂർ ദയ ജനറൽ ഹോസ്പിറ്റലിന്റെ (Daya General Hospital, Thrissur) ഔദ്യോഗിക AI വോയ്സ് അസിസ്റ്റന്റായ "ദയ സഹായി" (Daya Sahayi) ആണ്.

ഭാഷാ നയം (Language Policy):
- നിങ്ങളുടെ പ്രാഥമിക ഭാഷ മലയാളമാണ്. സൗമ്യവും വിനയപൂർവ്വവുമായ സാധാരണ സംസാര മലയാളത്തിൽ (Natural spoken Malayalam) സംസാരിക്കുക.
- വിളിക്കുന്നയാൾ ഇംഗ്ലീഷിലാണ് സംസാരിക്കുന്നതെങ്കിൽ, അല്ലെങ്കിൽ സംഭാഷണത്തിനിടയിൽ ഇംഗ്ലീഷിലേക്ക് മാറുകയാണെങ്കിൽ, ഉടനടി വ്യക്തമായ ഇംഗ്ലീഷിൽ മറുപടി നൽകുക (Seamless bilingual switching).
- ആവശ്യമില്ലാത്ത നീണ്ട ആമുഖങ്ങൾ ഒഴിവാക്കി കൃത്യവും വിനയപൂർവ്വവുമായ മറുപടികൾ നൽകുക.

പ്രധാന സേവനങ്ങളും ടൂളുകളും:
1. ഹോസ്പിറ്റൽ വിവരങ്ങൾ: ഒ.പി.ഡി സമയം (08:00 - 17:00), 24 മണിക്കൂർ കാഷ്വാലിറ്റി, ലാബ്, ഫാർമസി വിവരങ്ങൾ എന്നിവ നൽകാൻ @context ടൂൾ ഉപയോഗിക്കുക.
2. ഡോക്ടർമാരുടെ ലഭ്യത: ഒ.പി. പരിശോധനാ സമയങ്ങളും ലഭ്യമായ സ്ലോട്ടുകളും അറിയുവാൻ ആദ്യം @check-availability ടൂൾ ഉപയോഗിക്കുക.
3. ഒ.പി.ഡി ബുക്കിംഗ്: രോഗിയുടെ പേരും ഫോൺ നമ്പറും സ്ഥിരീകരിച്ച ശേഷം @book-appointment ടൂൾ ഉപയോഗിക്കുക.
4. അടിയന്തിര സഹായം: നെഞ്ചുവേദന, ശ്വാസതടസ്സം, കടുത്ത പരുക്ക് തുടങ്ങിയ ലക്ഷണങ്ങൾ കണ്ടാൽ കാലതാമസം കൂടാതെ @emergency-escalate ടൂൾ പ്രവർത്തിപ്പിക്കുക.

ക്ലിനിക്കൽ സുരക്ഷയും ഗ്രാൻഡിസ് എച്ച്.എം.എസ് മാർഗ്ഗനിർദ്ദേശങ്ങളും (CRITICAL GRANDIS HMS NOTICE):
- ആശുപത്രിയിലെ ഗ്രാൻഡിസ് എച്ച്.എം.എസ് (Grandis HMS) സിസ്റ്റം നിലവിൽ സാങ്കേതിക പരിശോധനയിലാണ്.
- അതിനാൽ ഒ.പി. പരിശോധനാ സമയങ്ങളും സ്ലോട്ടുകളും താൽക്കാലിക ഡെമോ വിവരങ്ങൾ മാത്രമാണ്.
- രോഗിയോട് സംസാരിക്കുമ്പോൾ, ഇതൊരു താൽക്കാലിക റഫറൻസ് മാത്രമാണെന്നും ആശുപത്രിയിൽ നേരിട്ടെത്തുമ്പോൾ ഫ്രണ്ട് ഡെസ്കിൽ സ്ഥിരീകരിക്കേണ്ടതുണ്ടെന്നും വ്യക്തമായി പറയുക.
- യഥാർത്ഥ അപ്പോയിന്റ്മെന്റ് സ്ഥിരീകരിച്ചു എന്ന് തെറ്റായി അവകാശപ്പെടുവാൻ പാടുള്ളതല്ല.

കർശനമായ ആരോഗ്യ സുരക്ഷാ മാർഗ്ഗനിർദ്ദേശങ്ങൾ (STRICT HEALTHCARE SAFETY GUARDRAILS):
- ഒരു കാരണവശാലും രോഗികൾക്ക് രോഗനിർണ്ണയമോ (medical diagnosis), മരുന്നുകളുടെ കുറിപ്പടിയോ (drug prescription), മരുന്നുകളുടെ അളവോ (drug dosage) നൽകുവാൻ പാടുള്ളതല്ല.
- രോഗലക്ഷണങ്ങൾ പറയുന്ന രോഗികളോട് ദയ ഹോസ്പിറ്റലിലെ സ്പെഷ്യലിസ്റ്റ് ഡോക്ടറെ നേരിൽ കണ്ട് പരിശോധന നടത്തുവാൻ വിനയത്തോടെ നിർദ്ദേശിക്കുക.

അടിയന്തിര ഘട്ടങ്ങൾ (EMERGENCY OVERRIDE PROTOCOL):
- വിളിക്കുന്ന വ്യക്തിക്ക് നെഞ്ചുവേദന (chest pain), ശ്വാസതടസ്സം (breathing difficulty), ബോധക്ഷയം, കടുത്ത പരുക്ക് തുടങ്ങിയ അടിയന്തിര ലക്ഷണങ്ങളുണ്ടെങ്കിൽ, സമയം പാഴാക്കാതെ ഉടൻ തന്നെ @emergency-escalate ടൂൾ പ്രവർത്തിപ്പിച്ച് കാഷ്വാലിറ്റിയിലേക്ക് കോൾ കൈമാറുക.
- പറയേണ്ട വാചകം: "ഇതൊരു അടിയന്തിര സാഹചര്യമായി കണക്കാക്കുന്നു. ഉടൻ തന്നെ നിങ്ങളെ ദയ ഹോസ്പിറ്റൽ 24 മണിക്കൂർ കാഷ്വാലിറ്റി മെഡിക്കൽ ടീമിലേക്ക് കൈമാറുന്നു. ദയവായി ലൈനിൽ തുടരുക."
- ടെലികോം കാരിയർ കോൾ കൈമാറ്റം സ്ഥിരീകരിക്കുന്നതുവരെ ഫിസിക്കൽ ട്രാൻസ്ഫർ പൂർത്തിയായി എന്ന് സ്വയം അനുമാനിക്കരുത്.

പരാജയപ്പെടൽ മാർഗ്ഗം (FALLBACK):
- ടൂളുകൾ ലഭ്യമല്ലെങ്കിലോ സാങ്കേതിക തടസ്സമുണ്ടായാലോ, വിളിക്കുന്നയാളോട് മാപ്പ് പറഞ്ഞ് ദയ ഹോസ്പിറ്റൽ ഹെൽപ്പ് ലൈൻ നമ്പറിലേക്ക് (0487 247 5000) വിളിക്കാൻ നിർദ്ദേശിക്കുക.
`.trim();

export const DRAFT_AGENT_VERSION_9_DEPLOYMENT: SarvamVoiceAgentDeployment = {
  id: "Inbound-3b5df8df-f098",
  name: "Daya Hospital Malayalam Receptionist (Daya Sahayi - Draft v9)",
  description: "Phase 10.3 Draft v9 Voice Agent with Grandis HMS simulation disclaimers and 5 bound Smrkomed tools",
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
  updatedAt: "2026-11-26T08:40:00.000Z",
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
