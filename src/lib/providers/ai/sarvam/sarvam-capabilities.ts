/**
 * ============================================================================
 * SARVAM AI CAPABILITIES CATALOGUE & CACHE SERVICE
 * ============================================================================
 *
 * Official verified catalogue of Sarvam Speech & Language models, speakers,
 * and supported Indian languages.
 *
 * Security Invariant:
 * - Credentials are read strictly server-side.
 * - Catalogue is cached in memory with a timestamp and refresh mechanism.
 * - Clearly tags verified vs documentation-only capabilities.
 */

import {
  AiCapabilities,
  ModelCapabilityItem,
  SpeakerCapabilityItem,
} from "../ai-provider.interface";

export const SARVAM_SUPPORTED_LANGUAGES = [
  { code: "ml-IN", name: "Malayalam", nativeName: "മലയാളം" },
  { code: "en-IN", name: "English (Indian)", nativeName: "English" },
  { code: "hi-IN", name: "Hindi", nativeName: "हिन्दी" },
  { code: "ta-IN", name: "Tamil", nativeName: "தமிழ்" },
  { code: "te-IN", name: "Telugu", nativeName: "తెలుగు" },
  { code: "kn-IN", name: "Kannada", nativeName: "ಕನ್ನಡ" },
  { code: "mr-IN", name: "Marathi", nativeName: "मराठी" },
  { code: "bn-IN", name: "Bengali", nativeName: "বাংলা" },
  { code: "gu-IN", name: "Gujarati", nativeName: "ગુજરાતી" },
  { code: "pa-IN", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ" },
  { code: "od-IN", name: "Odia", nativeName: "ଓଡ଼ିଆ" },
];

export const SARVAM_STT_MODELS: ModelCapabilityItem[] = [
  {
    id: "saaras:v4",
    name: "Saaras v4 (Real-Time WebSocket Streaming)",
    type: "STT",
    description: "Low-latency streaming STT designed for real-time conversational telephony at 8000 Hz / 16000 Hz.",
    supportedLanguages: ["ml-IN", "hi-IN", "en-IN", "ta-IN", "te-IN", "kn-IN", "mr-IN", "bn-IN", "gu-IN", "pa-IN", "od-IN"],
    streamingSupported: true,
    sampleRates: [8000, 16000],
    audioFormats: ["linear16", "wav"],
    isVerified: true,
    notes: "Verified on live Railway gateway for Daya Hospital incoming Malayalam calls.",
  },
  {
    id: "saaras:v2",
    name: "Saaras v2 (Batch Audio Transcription)",
    type: "STT",
    description: "Standard REST API model for transcribing completed audio recordings and voicemails.",
    supportedLanguages: ["ml-IN", "hi-IN", "en-IN", "ta-IN", "te-IN", "kn-IN"],
    streamingSupported: false,
    sampleRates: [8000, 16000, 44100],
    audioFormats: ["wav", "mp3", "webm"],
    isVerified: true,
  },
];

export const SARVAM_LLM_MODELS: ModelCapabilityItem[] = [
  {
    id: "sarvam-105b-conversations",
    name: "Sarvam 105B Conversations",
    type: "LLM",
    description: "State-of-the-art multilingual conversational intelligence tuned for Indian healthcare dialogues.",
    supportedLanguages: ["ml-IN", "en-IN", "hi-IN", "ta-IN", "te-IN", "kn-IN", "mr-IN", "bn-IN"],
    streamingSupported: true,
    sampleRates: [],
    audioFormats: [],
    isVerified: true,
    notes: "Verified with Daya Hospital clinical triage and casualty escalation scenarios.",
  },
  {
    id: "sarvam-2b",
    name: "Sarvam 2B (Ultra Fast Intent Classifier)",
    type: "LLM",
    description: "Compact fast model for rapid intent recognition and language detection before conversational routing.",
    supportedLanguages: ["ml-IN", "en-IN", "hi-IN"],
    streamingSupported: false,
    sampleRates: [],
    audioFormats: [],
    isVerified: false,
    notes: "Documentation-only; reserved for fast intent filtering.",
  },
];

export const SARVAM_TTS_MODELS: ModelCapabilityItem[] = [
  {
    id: "bulbul:v3",
    name: "Bulbul v3 (Multilingual Telephony Neural Voice)",
    type: "TTS",
    description: "Natural, highly articulate neural TTS supporting Malayalam, English, and 9 other Indian languages.",
    supportedLanguages: ["ml-IN", "hi-IN", "en-IN", "ta-IN", "te-IN", "kn-IN", "mr-IN", "bn-IN", "gu-IN", "pa-IN", "od-IN"],
    streamingSupported: true,
    sampleRates: [8000, 16000, 24000],
    audioFormats: ["linear16", "wav", "mp3"],
    isVerified: true,
    notes: "Official verified production model for Daya Hospital voice assistant with speaker 'kavitha'.",
  },
  {
    id: "bulbul:v2",
    name: "Bulbul v2 (Legacy Neural Voice)",
    type: "TTS",
    description: "Previous generation neural speech synthesizer.",
    supportedLanguages: ["hi-IN", "en-IN"],
    streamingSupported: false,
    sampleRates: [8000, 16000],
    audioFormats: ["wav", "mp3"],
    isVerified: true,
  },
  {
    id: "bulbul:v4-flash",
    name: "Bulbul v4-Flash (Fast English & Hindi)",
    type: "TTS",
    description: "Ultra low latency synthesizer currently optimized ONLY for Hindi and English.",
    supportedLanguages: ["hi-IN", "en-IN"],
    streamingSupported: true,
    sampleRates: [8000, 16000, 24000],
    audioFormats: ["linear16", "wav"],
    isVerified: false,
    notes: "DO NOT USE FOR MALAYALAM. Malayalam is not supported on v4-flash.",
  },
];

export const SARVAM_SPEAKERS: SpeakerCapabilityItem[] = [
  {
    id: "kavitha",
    name: "Kavitha",
    gender: "FEMALE",
    compatibleTtsModels: ["bulbul:v3"],
    primaryLanguages: ["ml-IN"],
    supportedLanguages: ["ml-IN", "en-IN"],
    isVerified: true,
    isAvailable: true,
    description: "Warm, professional, hospital-trained native Malayalam female speaker. Official verified voice of Daya Hospital Voice Receptionist.",
  },
  {
    id: "ratan",
    name: "Ratan",
    gender: "MALE",
    compatibleTtsModels: ["bulbul:v3"],
    primaryLanguages: ["hi-IN"],
    supportedLanguages: ["hi-IN", "en-IN", "ml-IN", "ta-IN"],
    isVerified: true,
    isAvailable: true,
    description: "Authoritative, calm male voice verified for hospital appointment confirmations and outpatient guidance.",
  },
  {
    id: "shubh",
    name: "Shubh",
    gender: "MALE",
    compatibleTtsModels: ["bulbul:v3"],
    primaryLanguages: ["en-IN"],
    supportedLanguages: ["en-IN", "ml-IN", "hi-IN"],
    isVerified: true,
    isAvailable: true,
    description: "Clear, neutral tone male speaker. Official Sarvam default speaker for general announcements.",
  },
  {
    id: "priya",
    name: "Priya",
    gender: "FEMALE",
    compatibleTtsModels: ["bulbul:v3"],
    primaryLanguages: ["en-IN"],
    supportedLanguages: ["en-IN", "ml-IN", "hi-IN"],
    isVerified: true,
    isAvailable: true,
    description: "Gentle, articulate female voice suitable for medical reminders and patient care instructions.",
  },
  {
    id: "rohan",
    name: "Rohan",
    gender: "MALE",
    compatibleTtsModels: ["bulbul:v3"],
    primaryLanguages: ["en-IN"],
    supportedLanguages: ["en-IN", "ml-IN", "hi-IN"],
    isVerified: true,
    isAvailable: true,
    description: "Crisp Indian English male voice suitable for administrative announcements.",
  },
  {
    id: "pooja",
    name: "Pooja",
    gender: "FEMALE",
    compatibleTtsModels: ["bulbul:v3"],
    primaryLanguages: ["en-IN"],
    supportedLanguages: ["en-IN", "ml-IN", "hi-IN"],
    isVerified: true,
    isAvailable: true,
    description: "Polite female voice with multilingual clarity.",
  },
  {
    id: "meera",
    name: "Meera",
    gender: "FEMALE",
    compatibleTtsModels: ["bulbul:v3"],
    primaryLanguages: ["hi-IN"],
    supportedLanguages: ["hi-IN", "en-IN"],
    isVerified: false,
    isAvailable: false,
    unavailabilityReason: "Not available in Sarvam API for bulbul:v3. Verified through live API test: returns HTTP 400 'Speaker meera is not recognized'.",
    description: "UNAVAILABLE: Speaker 'meera' is not in Sarvam's official 37-speaker bulbul:v3 directory. Please use Kavitha or Priya.",
  },
];

// In-memory cache singleton
let cachedCapabilities: AiCapabilities | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export function getCachedSarvamCapabilities(forceRefresh = false): AiCapabilities {
  const now = Date.now();
  if (!forceRefresh && cachedCapabilities && now - lastCacheTime < CACHE_TTL_MS) {
    return {
      ...cachedCapabilities,
      isStale: false,
    };
  }

  cachedCapabilities = {
    provider: "SARVAM_AI",
    sttModels: SARVAM_STT_MODELS,
    llmModels: SARVAM_LLM_MODELS,
    ttsModels: SARVAM_TTS_MODELS,
    speakers: SARVAM_SPEAKERS,
    supportedLanguages: SARVAM_SUPPORTED_LANGUAGES,
    retrievedAt: new Date().toISOString(),
    isStale: false,
  };
  lastCacheTime = now;

  return cachedCapabilities;
}
