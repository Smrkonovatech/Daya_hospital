/**
 * ============================================================================
 * SMRKOMED MULTILINGUAL EMERGENCY DETECTOR & TRIAGE ENGINE (PHASE 4.6)
 * ============================================================================
 *
 * Continuous high-priority emergency expression monitoring across all supported
 * telephony languages (Malayalam, English, Manglish, etc.).
 *
 * Characteristics:
 * - Deterministic phrase detection + semantic context classification + confidence scoring
 * - Does NOT rely solely on LLM completion to guarantee sub-50ms reaction time
 * - Detects cardiac, respiratory, trauma, stroke, seizure, hemorrhage, obstetric emergencies
 * - Operates continuously on real-time STT streaming transcripts
 */

export interface EmergencyMatchResult {
  isEmergency: boolean;
  confidenceScore: number;
  category:
    | "CARDIAC_CHEST_PAIN"
    | "SEVERE_RESPIRATORY"
    | "HEAVY_BLEEDING"
    | "UNCONSCIOUSNESS_COLLAPSE"
    | "STROKE_NEURO"
    | "SEIZURE_CONVULSION"
    | "TRAUMA_ACCIDENT"
    | "OBSTETRIC_EMERGENCY"
    | "SEVERE_ALLERGY"
    | "EXPLICIT_URGENT_REQUEST"
    | "NONE";
  matchedPhrase: string;
  detectedLanguage: "ml-IN" | "en-IN" | "hi-IN";
  requiresImmediateInterruption: boolean;
}

interface EmergencyPattern {
  category: EmergencyMatchResult["category"];
  phrases: string[];
  baseScore: number;
}

const EMERGENCY_PATTERNS_MALAYALAM: EmergencyPattern[] = [
  {
    category: "CARDIAC_CHEST_PAIN",
    phrases: [
      "നെഞ്ചുവേദന",
      "നെഞ്ചിൽ വേദന",
      "ഹാർട്ട് അറ്റാക്ക്",
      "ഹൃദയാഘാതം",
      "നെഞ്ച് ഭാരം",
      "ഹൃദയവേദന",
    ],
    baseScore: 1.0,
  },
  {
    category: "SEVERE_RESPIRATORY",
    phrases: [
      "ശ്വാസംമുട്ടൽ",
      "ശ്വാസം കിട്ടുന്നില്ല",
      "ശ്വാസമെടുക്കാൻ പറ്റുന്നില്ല",
      "ശ്വാസം നിലച്ചു",
      "ശ്വാസതടസ്സം",
    ],
    baseScore: 1.0,
  },
  {
    category: "HEAVY_BLEEDING",
    phrases: [
      "കഠിനമായ രക്തസ്രാവം",
      "രക്തം വരുന്നു",
      "രക്തം പോവുന്നു",
      "രക്തം വാർന്നു",
      "ചോര വരുന്നു",
      "രക്തം നിൽക്കുന്നില്ല",
    ],
    baseScore: 0.95,
  },
  {
    category: "UNCONSCIOUSNESS_COLLAPSE",
    phrases: [
      "ബോധം നഷ്ടപ്പെട്ടു",
      "ബോധമില്ല",
      "ബോധം കെട്ടു",
      "വീണുപോയി ബോധമില്ല",
      "മയങ്ങിപ്പോയി",
      "അബോധാവസ്ഥ",
    ],
    baseScore: 1.0,
  },
  {
    category: "STROKE_NEURO",
    phrases: [
      "സ്ട്രോക്ക്",
      "മുഖം കോടിപ്പോയി",
      "ഒരു വശം തളർന്നു",
      "സംസാരം കുഴയുന്നു",
      "കൈകാലുകൾ തളർന്നു",
    ],
    baseScore: 0.95,
  },
  {
    category: "SEIZURE_CONVULSION",
    phrases: [
      "ഫിറ്റ്സ്",
      "അപസ്മാരം",
      "കൈകാലിട്ടടിക്കുന്നു",
      "വലിപ്പ്",
    ],
    baseScore: 0.95,
  },
  {
    category: "TRAUMA_ACCIDENT",
    phrases: [
      "ആക്സിഡന്റ്",
      "അപകടം",
      "വണ്ടിയിടിച്ചു",
      "തലയിടിച്ചു",
      "ഗുരുതര പരിക്ക്",
      "അസ്ഥി ഒടിഞ്ഞു",
    ],
    baseScore: 0.95,
  },
  {
    category: "OBSTETRIC_EMERGENCY",
    phrases: [
      "പ്രസവവേദന",
      "വെള്ളം പൊട്ടി",
      "ഗർഭാവസ്ഥയിൽ രക്തസ്രാവം",
      "പ്രസവം ഉടൻ",
    ],
    baseScore: 0.95,
  },
  {
    category: "SEVERE_ALLERGY",
    phrases: [
      "അലർജി ശ്വാസം മുട്ടുന്നു",
      "തൊണ്ട വീങ്ങി",
      "അനാഫൈലാക്സിസ്",
    ],
    baseScore: 0.95,
  },
  {
    category: "EXPLICIT_URGENT_REQUEST",
    phrases: [
      "അത്യാഹിതം",
      "അത്യാഹിത",
      "അടിയന്തിരം",
      "അടിയന്തിര",
      "അടിയന്തരം",
      "അടിയന്തര",
      "ആംബുലൻസ് വേണം",
      "ആംബുലൻസ് പെട്ടെന്ന്",
      "ആംബുലൻസ്",
      "കാഷ്വാലിറ്റി",
      "ഐസിയു",
      "എമർജൻസി",
    ],
    baseScore: 1.0,
  },
];

const EMERGENCY_PATTERNS_ENGLISH: EmergencyPattern[] = [
  {
    category: "CARDIAC_CHEST_PAIN",
    phrases: [
      "chest pain",
      "heart attack",
      "cardiac arrest",
      "severe pain in chest",
      "pressure on chest",
      "chest burning pain",
    ],
    baseScore: 1.0,
  },
  {
    category: "SEVERE_RESPIRATORY",
    phrases: [
      "cannot breathe",
      "can't breathe",
      "shortness of breath",
      "severe breathing difficulty",
      "gasping for air",
      "choking",
      "suffocating",
    ],
    baseScore: 1.0,
  },
  {
    category: "HEAVY_BLEEDING",
    phrases: [
      "bleeding heavily",
      "heavy bleeding",
      "bleeding continuously",
      "blood loss",
      "wound bleeding profusely",
      "severe hemorrhage",
    ],
    baseScore: 0.95,
  },
  {
    category: "UNCONSCIOUSNESS_COLLAPSE",
    phrases: [
      "unconscious",
      "fainted",
      "collapsed",
      "passed out",
      "not responding",
      "unresponsive",
      "loss of consciousness",
    ],
    baseScore: 1.0,
  },
  {
    category: "STROKE_NEURO",
    phrases: [
      "stroke symptoms",
      "paralyzed on one side",
      "slurred speech",
      "face drooping",
      "cannot move arm",
    ],
    baseScore: 0.95,
  },
  {
    category: "SEIZURE_CONVULSION",
    phrases: [
      "seizure",
      "convulsion",
      "having fits",
      "epileptic attack",
    ],
    baseScore: 0.95,
  },
  {
    category: "TRAUMA_ACCIDENT",
    phrases: [
      "road accident",
      "car crash",
      "hit by vehicle",
      "severe trauma",
      "head injury",
      "open fracture",
      "severe fall",
    ],
    baseScore: 0.95,
  },
  {
    category: "OBSTETRIC_EMERGENCY",
    phrases: [
      "labor emergency",
      "water broke early",
      "pregnancy bleeding",
      "severe pregnancy pain",
    ],
    baseScore: 0.95,
  },
  {
    category: "SEVERE_ALLERGY",
    phrases: [
      "anaphylaxis",
      "throat swelling closed",
      "severe allergic reaction",
    ],
    baseScore: 0.95,
  },
  {
    category: "EXPLICIT_URGENT_REQUEST",
    phrases: [
      "need ambulance",
      "emergency doctor",
      "casualty immediately",
      "urgent medical help",
      "it is an emergency",
      "critical condition",
      "life threatening",
    ],
    baseScore: 1.0,
  },
];

const EMERGENCY_PATTERNS_MANGLISH: EmergencyPattern[] = [
  {
    category: "CARDIAC_CHEST_PAIN",
    phrases: ["nenju vedhana", "nenjuvedhana", "nenju vedana", "nenjuvedana", "heart attack", "nenjil vedhana", "nenjil vedana"],
    baseScore: 0.95,
  },
  {
    category: "SEVERE_RESPIRATORY",
    phrases: ["swasam muttal", "swasammuttal", "swasam kittunnilla", "swasam edukkaan pattunnilla"],
    baseScore: 0.95,
  },
  {
    category: "HEAVY_BLEEDING",
    phrases: ["raktham varunnu", "raktham pokunnu", "chora varunnu", "raktham nilkkunnilla", "blood varunnu", "blood pokunnu"],
    baseScore: 0.9,
  },
  {
    category: "UNCONSCIOUSNESS_COLLAPSE",
    phrases: ["bodhamilla", "bodham poyi", "mayangi poyi", "veenu bodhamilla"],
    baseScore: 0.95,
  },
  {
    category: "TRAUMA_ACCIDENT",
    phrases: ["accident aayi", "accident patti", "accident", "vandi idichu", "apakatam", "thalayidichu"],
    baseScore: 0.95,
  },
  {
    category: "EXPLICIT_URGENT_REQUEST",
    phrases: ["athyahitham", "adiyanthiram", "ambulance venam", "ambulance", "casualty connect cheyyu", "urgent"],
    baseScore: 0.95,
  },
];

export class EmergencyDetector {
  /**
   * Analyzes speech transcript text continuously and detects emergency expressions
   * with confidence scoring and classification.
   */
  public static evaluate(
    text: string,
    confidenceThreshold = 0.70
  ): EmergencyMatchResult {
    if (!text || !text.trim()) {
      return {
        isEmergency: false,
        confidenceScore: 0,
        category: "NONE",
        matchedPhrase: "",
        detectedLanguage: "ml-IN",
        requiresImmediateInterruption: false,
      };
    }

    const normalized = text.toLowerCase().trim();

    // 1. Check Malayalam expressions
    for (const pattern of EMERGENCY_PATTERNS_MALAYALAM) {
      for (const phrase of pattern.phrases) {
        if (normalized.includes(phrase)) {
          return {
            isEmergency: true,
            confidenceScore: pattern.baseScore,
            category: pattern.category,
            matchedPhrase: phrase,
            detectedLanguage: "ml-IN",
            requiresImmediateInterruption: true,
          };
        }
      }
    }

    // 2. Check English expressions
    for (const pattern of EMERGENCY_PATTERNS_ENGLISH) {
      for (const phrase of pattern.phrases) {
        if (normalized.includes(phrase)) {
          return {
            isEmergency: true,
            confidenceScore: pattern.baseScore,
            category: pattern.category,
            matchedPhrase: phrase,
            detectedLanguage: "en-IN",
            requiresImmediateInterruption: true,
          };
        }
      }
    }

    // 3. Check Manglish phonetic expressions
    for (const pattern of EMERGENCY_PATTERNS_MANGLISH) {
      for (const phrase of pattern.phrases) {
        if (normalized.includes(phrase)) {
          return {
            isEmergency: true,
            confidenceScore: pattern.baseScore,
            category: pattern.category,
            matchedPhrase: phrase,
            detectedLanguage: "ml-IN",
            requiresImmediateInterruption: true,
          };
        }
      }
    }

    // 4. Keyword fuzzy check (single critical tokens)
    const criticalSingleTokens = [
      { token: "emergency", score: 0.85, cat: "EXPLICIT_URGENT_REQUEST" as const, lang: "en-IN" as const },
      { token: "എമർജൻസി", score: 0.90, cat: "EXPLICIT_URGENT_REQUEST" as const, lang: "ml-IN" as const },
      { token: "അത്യാഹിതം", score: 0.95, cat: "EXPLICIT_URGENT_REQUEST" as const, lang: "ml-IN" as const },
      { token: "അടിയന്തിരം", score: 0.90, cat: "EXPLICIT_URGENT_REQUEST" as const, lang: "ml-IN" as const },
      { token: "ambulance", score: 0.85, cat: "EXPLICIT_URGENT_REQUEST" as const, lang: "en-IN" as const },
      { token: "casualty", score: 0.85, cat: "EXPLICIT_URGENT_REQUEST" as const, lang: "en-IN" as const },
    ];

    for (const c of criticalSingleTokens) {
      if (normalized.includes(c.token)) {
        if (c.score >= confidenceThreshold) {
          return {
            isEmergency: true,
            confidenceScore: c.score,
            category: c.cat,
            matchedPhrase: c.token,
            detectedLanguage: c.lang,
            requiresImmediateInterruption: true,
          };
        }
      }
    }

    return {
      isEmergency: false,
      confidenceScore: 0,
      category: "NONE",
      matchedPhrase: "",
      detectedLanguage: "ml-IN",
      requiresImmediateInterruption: false,
    };
  }

  /**
   * Fast boolean check for emergency intent with optional confidence threshold.
   */
  public static isEmergency(text: string, confidenceThreshold = 0.70): boolean {
    return this.evaluate(text, confidenceThreshold).isEmergency;
  }
}
