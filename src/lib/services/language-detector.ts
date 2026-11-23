/**
 * ============================================================================
 * SMRKOMED MULTILINGUAL LANGUAGE DETECTOR & CAPABILITY MATRIX (PHASE 4.6.1)
 * ============================================================================
 *
 * Automatic language detection for incoming caller speech.
 * Maps detected speech to verified Sarvam Saaras v4 (STT) and Bulbul v3 (TTS) models.
 *
 * Verified Supported Languages:
 * - ml-IN: Malayalam (Native Primary Pilot)
 * - en-IN: Indian English
 * - ta-IN: Tamil
 * - hi-IN: Hindi
 * - kn-IN: Kannada
 * - te-IN: Telugu
 *
 * Unsupported languages gracefully fall back to English (en-IN) or hospital default.
 */

export interface LanguageCapability {
  code: string;
  name: string;
  sttModel: string;
  ttsModel: string;
  ttsVoice: string;
  conversationalSupport: boolean;
  mixedLanguageSupport: boolean;
  sampleRate: number;
}

export const VERIFIED_LANGUAGE_CAPABILITIES: Record<string, LanguageCapability> = {
  "ml-IN": {
    code: "ml-IN",
    name: "Malayalam",
    sttModel: "saaras:v4",
    ttsModel: "bulbul:v3",
    ttsVoice: "kavitha",
    conversationalSupport: true,
    mixedLanguageSupport: true, // Manglish
    sampleRate: 8000,
  },
  "en-IN": {
    code: "en-IN",
    name: "English (Indian)",
    sttModel: "saaras:v4",
    ttsModel: "bulbul:v3",
    ttsVoice: "ratan",
    conversationalSupport: true,
    mixedLanguageSupport: true,
    sampleRate: 8000,
  },
  "hi-IN": {
    code: "hi-IN",
    name: "Hindi",
    sttModel: "saaras:v4",
    ttsModel: "bulbul:v3",
    ttsVoice: "meera",
    conversationalSupport: true,
    mixedLanguageSupport: true, // Hinglish
    sampleRate: 8000,
  },
  "ta-IN": {
    code: "ta-IN",
    name: "Tamil",
    sttModel: "saaras:v4",
    ttsModel: "bulbul:v3",
    ttsVoice: "pavithra",
    conversationalSupport: true,
    mixedLanguageSupport: true, // Tanglish
    sampleRate: 8000,
  },
  "kn-IN": {
    code: "kn-IN",
    name: "Kannada",
    sttModel: "saaras:v4",
    ttsModel: "bulbul:v3",
    ttsVoice: "arvind",
    conversationalSupport: true,
    mixedLanguageSupport: true,
    sampleRate: 8000,
  },
  "te-IN": {
    code: "te-IN",
    name: "Telugu",
    sttModel: "saaras:v4",
    ttsModel: "bulbul:v3",
    ttsVoice: "lalitha",
    conversationalSupport: true,
    mixedLanguageSupport: true,
    sampleRate: 8000,
  },
};

export interface LanguageDetectionResult {
  languageCode: string;
  detectedLanguage: string;
  confidence: number;
  isSupported: boolean;
  isCodeMixed: boolean;
  detectedScript: "MALAYALAM" | "TAMIL" | "DEVANAGARI" | "KANNADA" | "TELUGU" | "LATIN" | "OTHER";
  fallbackApplied: boolean;
}

export class LanguageDetector {
  /**
   * Evaluates text from caller speech and determines language code.
   * Deterministic script counting + vocabulary indicators for sub-millisecond execution.
   */
  public static detectLanguage(
    text: string,
    defaultLanguage = "en-IN"
  ): LanguageDetectionResult {
    if (!text || !text.trim()) {
      return {
        languageCode: defaultLanguage,
        detectedLanguage: defaultLanguage,
        confidence: 0,
        isSupported: true,
        isCodeMixed: false,
        detectedScript: "LATIN",
        fallbackApplied: false,
      };
    }

    const trimmed = text.trim();
    let malayalamChars = 0;
    let tamilChars = 0;
    let devanagariChars = 0;
    let kannadaChars = 0;
    let teluguChars = 0;
    let latinChars = 0;
    let otherChars = 0;

    for (const char of trimmed) {
      const code = char.charCodeAt(0);
      if (code >= 0x0d00 && code <= 0x0d7f) malayalamChars++;
      else if (code >= 0x0b80 && code <= 0x0bff) tamilChars++;
      else if (code >= 0x0900 && code <= 0x097f) devanagariChars++;
      else if (code >= 0x0c80 && code <= 0x0cff) kannadaChars++;
      else if (code >= 0x0c00 && code <= 0x0c7f) teluguChars++;
      else if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) latinChars++;
      else if (code > 127) otherChars++;
    }

    const totalIndic =
      malayalamChars + tamilChars + devanagariChars + kannadaChars + teluguChars;

    // 1. Script-based detection
    if (malayalamChars > 0 && malayalamChars >= totalIndic) {
      return {
        languageCode: "ml-IN",
        detectedLanguage: "ml-IN",
        confidence: Math.min(1.0, 0.7 + (malayalamChars / trimmed.length) * 0.3),
        isSupported: true,
        isCodeMixed: latinChars > 2,
        detectedScript: "MALAYALAM",
        fallbackApplied: false,
      };
    }

    if (tamilChars > 0 && tamilChars >= totalIndic) {
      return {
        languageCode: "ta-IN",
        detectedLanguage: "ta-IN",
        confidence: Math.min(1.0, 0.7 + (tamilChars / trimmed.length) * 0.3),
        isSupported: true,
        isCodeMixed: latinChars > 2,
        detectedScript: "TAMIL",
        fallbackApplied: false,
      };
    }

    if (devanagariChars > 0 && devanagariChars >= totalIndic) {
      return {
        languageCode: "hi-IN",
        detectedLanguage: "hi-IN",
        confidence: Math.min(1.0, 0.7 + (devanagariChars / trimmed.length) * 0.3),
        isSupported: true,
        isCodeMixed: latinChars > 2,
        detectedScript: "DEVANAGARI",
        fallbackApplied: false,
      };
    }

    if (kannadaChars > 0 && kannadaChars >= totalIndic) {
      return {
        languageCode: "kn-IN",
        detectedLanguage: "kn-IN",
        confidence: Math.min(1.0, 0.7 + (kannadaChars / trimmed.length) * 0.3),
        isSupported: true,
        isCodeMixed: latinChars > 2,
        detectedScript: "KANNADA",
        fallbackApplied: false,
      };
    }

    if (teluguChars > 0 && teluguChars >= totalIndic) {
      return {
        languageCode: "te-IN",
        detectedLanguage: "te-IN",
        confidence: Math.min(1.0, 0.7 + (teluguChars / trimmed.length) * 0.3),
        isSupported: true,
        isCodeMixed: latinChars > 2,
        detectedScript: "TELUGU",
        fallbackApplied: false,
      };
    }

    // 2. Latin script vocabulary check (Manglish / Tanglish / Hinglish vs Standard English)
    if (latinChars > 0) {
      const lower = trimmed.toLowerCase();

      // Manglish keywords
      const manglishMarkers = [
        "namaskaram",
        "swagatham",
        "venam",
        "pattumo",
        "chodikkan",
        "doctorundoo",
        "undoo",
        "illa",
        "ennanu",
        "evideyaanu",
        "varunnu",
        "pokunnu",
        "aarukannaan",
        "appointment venam",
        "hospitalil",
        "kazhinju",
        "aano",
      ];
      if (manglishMarkers.some((m) => lower.includes(m))) {
        return {
          languageCode: "ml-IN",
          detectedLanguage: "ml-IN",
          confidence: 0.85,
          isSupported: true,
          isCodeMixed: true,
          detectedScript: "LATIN",
          fallbackApplied: false,
        };
      }

      // Hinglish keywords
      const hinglishMarkers = [
        "namaste",
        "kya haal",
        "doctor hai",
        "chahiye",
        "kab aana",
        "batayein",
        "madad",
        "batao",
        "mujhe",
      ];
      if (hinglishMarkers.some((m) => lower.includes(m))) {
        return {
          languageCode: "hi-IN",
          detectedLanguage: "hi-IN",
          confidence: 0.85,
          isSupported: true,
          isCodeMixed: true,
          detectedScript: "LATIN",
          fallbackApplied: false,
        };
      }

      // Tanglish keywords
      const tanglishMarkers = [
        "vanakkam",
        "doctor irukkara",
        "irukaa",
        "venum",
        "solreenga",
        "eppadi",
        "solla mudiyuma",
      ];
      if (tanglishMarkers.some((m) => lower.includes(m))) {
        return {
          languageCode: "ta-IN",
          detectedLanguage: "ta-IN",
          confidence: 0.85,
          isSupported: true,
          isCodeMixed: true,
          detectedScript: "LATIN",
          fallbackApplied: false,
        };
      }

      // Common English words check to distinguish Indian English from foreign Latin scripts
      const englishWords = [
        "the", "is", "at", "which", "on", "a", "an", "and", "or", "in", "to", "for", "of",
        "with", "i", "you", "he", "she", "it", "we", "they", "my", "your", "can", "could",
        "would", "should", "want", "need", "doctor", "hospital", "help", "appointment",
        "please", "call", "time", "date", "have", "has", "had", "hello", "hi", "good",
        "morning", "afternoon", "evening", "yes", "no", "how", "what", "where", "when",
        "specialist", "orthopedic", "cardiology", "consultation", "consult",
      ];
      const words = lower.split(/[^a-z]+/).filter(Boolean);
      const matchedEnglishCount = words.filter((w) => englishWords.includes(w)).length;
      const isLikelyEnglish = words.length > 0 && matchedEnglishCount / words.length >= 0.25;

      if (isLikelyEnglish) {
        return {
          languageCode: "en-IN",
          detectedLanguage: "en-IN",
          confidence: 0.9,
          isSupported: true,
          isCodeMixed: false,
          detectedScript: "LATIN",
          fallbackApplied: false,
        };
      }

      // Unrecognized Latin script (e.g. French, German, Spanish)
      return {
        languageCode: defaultLanguage,
        detectedLanguage: defaultLanguage,
        confidence: 0.4,
        isSupported: false,
        isCodeMixed: false,
        detectedScript: "LATIN",
        fallbackApplied: true,
      };
    }

    // 3. Foreign / Unsupported script (e.g., Cyrillic, Arabic, Chinese)
    if (otherChars > 0) {
      return {
        languageCode: defaultLanguage,
        detectedLanguage: defaultLanguage,
        confidence: 0.2,
        isSupported: false,
        isCodeMixed: false,
        detectedScript: "OTHER",
        fallbackApplied: true,
      };
    }

    return {
      languageCode: defaultLanguage,
      detectedLanguage: defaultLanguage,
      confidence: 0.5,
      isSupported: true,
      isCodeMixed: false,
      detectedScript: "LATIN",
      fallbackApplied: false,
    };
  }

  /**
   * Validates whether a requested language code is supported by Sarvam models.
   */
  public static isSupportedLanguage(code: string): boolean {
    return Boolean(VERIFIED_LANGUAGE_CAPABILITIES[code]);
  }

  /**
   * Returns voice and model mapping for a given language.
   */
  public static getCapability(code: string): LanguageCapability {
    return (
      VERIFIED_LANGUAGE_CAPABILITIES[code] ||
      VERIFIED_LANGUAGE_CAPABILITIES["en-IN"]
    );
  }
}
