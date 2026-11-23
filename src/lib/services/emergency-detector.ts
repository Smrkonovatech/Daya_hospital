/**
 * ============================================================================
 * SMRKOMED MULTILINGUAL EMERGENCY DETECTOR & TRIAGE ENGINE (PHASE 4.6.1)
 * ============================================================================
 *
 * Continuous high-priority emergency expression monitoring across all supported
 * telephony languages (Malayalam, English, Manglish, Hindi, Tamil, etc.).
 *
 * Characteristics:
 * - Deterministic phrase detection + semantic context classification + confidence scoring
 * - Does NOT rely solely on LLM completion to guarantee sub-millisecond reaction time
 * - Distinguishes active emergencies from historical or hypothetical discussions
 * - Detects cardiac, respiratory, trauma, stroke, seizure, hemorrhage, poisoning, burns, allergy, obstetric emergencies
 * - Operates continuously on real-time STT streaming transcripts (interim and final)
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
    | "POISONING_OVERDOSE"
    | "BURNS_FIRE"
    | "OBSTETRIC_EMERGENCY"
    | "SEVERE_ALLERGY"
    | "EXPLICIT_URGENT_REQUEST"
    | "NONE";
  matchedCategory?: string;
  matchedPhrase: string;
  detectedLanguage: "ml-IN" | "en-IN" | "hi-IN" | "ta-IN";
  requiresImmediateInterruption: boolean;
  isHistoricalOrHypothetical?: boolean;
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
    category: "POISONING_OVERDOSE",
    phrases: [
      "വിഷം കഴിച്ചു",
      "വിഷബാധ",
      "പാമ്പ് കടിച്ചു",
      "മരുന്ന് കൂടുതൽ കഴിച്ചു",
      "വിഷാംശം",
    ],
    baseScore: 1.0,
  },
  {
    category: "BURNS_FIRE",
    phrases: [
      "പൊള്ളലേറ്റു",
      "തീപിടിച്ചു",
      "ശരീരം പൊള്ളി",
      "കഠിനമായ പൊള്ളൽ",
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
      "arterial bleeding",
      "bleeding from",
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
      "stroke",
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
      "convulsions",
      "having fits",
      "fits",
      "epileptic attack",
    ],
    baseScore: 0.95,
  },
  {
    category: "TRAUMA_ACCIDENT",
    phrases: [
      "road accident",
      "car accident",
      "car crash",
      "hit by vehicle",
      "severe trauma",
      "head injury",
      "open fracture",
      "fracture",
      "severe fall",
    ],
    baseScore: 0.95,
  },
  {
    category: "POISONING_OVERDOSE",
    phrases: [
      "consumed poison",
      "drank poison",
      "swallowed poison",
      "snake bite",
      "drug overdose",
      "acute overdose",
      "overdose",
      "poisoning",
    ],
    baseScore: 1.0,
  },
  {
    category: "BURNS_FIRE",
    phrases: [
      "severe burns",
      "fire burn",
      "burns all over",
      "fire accident",
      "body burned",
      "chemical burn",
    ],
    baseScore: 0.95,
  },
  {
    category: "OBSTETRIC_EMERGENCY",
    phrases: [
      "labor emergency",
      "labour pain",
      "labor pain",
      "water broke",
      "water breaking",
      "pregnancy bleeding",
      "severe pregnancy pain",
    ],
    baseScore: 0.95,
  },
  {
    category: "SEVERE_ALLERGY",
    phrases: [
      "anaphylaxis",
      "anaphylactic",
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
    category: "POISONING_OVERDOSE",
    phrases: ["visham kazhichu", "pambu kadichu", "vishabaadha"],
    baseScore: 0.95,
  },
  {
    category: "BURNS_FIRE",
    phrases: ["pollal", "theepidichu", "polli"],
    baseScore: 0.95,
  },
  {
    category: "EXPLICIT_URGENT_REQUEST",
    phrases: ["athyahitham", "adiyanthiram", "ambulance venam", "ambulance", "casualty connect cheyyu", "urgent"],
    baseScore: 0.95,
  },
];

const EMERGENCY_PATTERNS_HINDI: EmergencyPattern[] = [
  {
    category: "CARDIAC_CHEST_PAIN",
    phrases: ["सीने में दर्द", "हार्ट अटैक", "दिल का दौरा", "chhati me dard"],
    baseScore: 0.95,
  },
  {
    category: "SEVERE_RESPIRATORY",
    phrases: ["सांस लेने में तकलीफ", "सांस नहीं आ रही", "dum ghut raha hai"],
    baseScore: 0.95,
  },
  {
    category: "EXPLICIT_URGENT_REQUEST",
    phrases: ["इमरजेंसी", "एंबुलेंस चाहिए", "आपातकालीन", "ambulance chahiye"],
    baseScore: 0.95,
  },
];

const EMERGENCY_PATTERNS_TAMIL: EmergencyPattern[] = [
  {
    category: "CARDIAC_CHEST_PAIN",
    phrases: ["நெஞ்சு வலி", "மாரடைப்பு", "nenju vali"],
    baseScore: 0.95,
  },
  {
    category: "SEVERE_RESPIRATORY",
    phrases: ["மூச்சு திணறல்", "மூச்சு விட முடியவில்லை", "moochu thinareal"],
    baseScore: 0.95,
  },
  {
    category: "EXPLICIT_URGENT_REQUEST",
    phrases: ["அவசரம்", "ஆம்புலன்ஸ் வேண்டும்", "ambulance vendum"],
    baseScore: 0.95,
  },
];

/**
 * Historical and hypothetical markers indicating past medical history or questions,
 * rather than an active acute emergency requiring real-time call interruption.
 */
const HISTORICAL_OR_HYPOTHETICAL_MARKERS = [
  "years ago",
  "months ago",
  "last year",
  "last month",
  "in the past",
  "history of",
  "had a heart attack",
  "had an accident",
  "do not have",
  "don't have",
  "no emergency",
  "not an emergency",
  "not urgent",
  "just asking",
  "is casualty open",
  "do you treat",
  "മുൻപ്",
  "പണ്ട്",
  "കഴിഞ്ഞ വർഷം",
  "കഴിഞ്ഞ മാസം",
  "നെഞ്ചുവേദന ഇല്ല",
  "അടിയന്തിരം ഒന്നുമല്ല",
  "അടിയന്തിരമല്ല",
  "അടിയന്തരമല്ല",
  "അടിയന്തിരമില്ല",
  "അടിയന്തരമില്ല",
  "അത്യാഹിതമല്ല",
  "വെറുതെ ചോദിച്ചതാണ്",
  "ആക്സിഡന്റ് പറ്റിയിരുന്നു",
  "പഴയ അസുഖം",
  "munpu",
  "pandu",
  "kazhinja varsham",
  "kazhinja maasam",
  "nenju vedana illa",
  "adiyanthiram alla",
  "veruthe chodichatha",
  "accident pattiyirunnu",
];

/**
 * Concurrent active urgency indicators that override historical markers
 * (e.g. "had a heart attack before AND having severe chest pain right now").
 */
const ACTIVE_URGENCY_OVERRIDE_MARKERS = [
  "now",
  "right now",
  "today",
  "currently",
  "help me immediately",
  "calling for emergency",
  "pain right now",
  "ഇപ്പോൾ",
  "ഇന്ന്",
  "നിലവിൽ",
  "പെട്ടെന്ന് സഹായിക്കൂ",
  "ഇപ്പോഴാണ്",
  "ippol",
  "pettennu",
  "sahaayikku",
];

export class EmergencyDetector {
  /**
   * Analyzes speech transcript text continuously and detects emergency expressions
   * with confidence scoring, classification, and contextual filtering.
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

    // Contextual classification: distinguish historical or hypothetical references
    const hasHistoricalMarker = HISTORICAL_OR_HYPOTHETICAL_MARKERS.some((marker) =>
      normalized.includes(marker)
    );
    const hasActiveUrgency = ACTIVE_URGENCY_OVERRIDE_MARKERS.some((active) =>
      normalized.includes(active)
    );

    const isHistoricalDiscussion = hasHistoricalMarker && !hasActiveUrgency;

    // Helper to evaluate a pattern set
    const matchPatternSet = (
      patterns: EmergencyPattern[],
      lang: "ml-IN" | "en-IN" | "hi-IN" | "ta-IN"
    ): EmergencyMatchResult | null => {
      for (const pattern of patterns) {
        for (const phrase of pattern.phrases) {
          if (normalized.includes(phrase)) {
            if (isHistoricalDiscussion) {
              return {
                isEmergency: false,
                confidenceScore: 0.20,
                category: pattern.category,
                matchedCategory: pattern.category,
                matchedPhrase: phrase,
                detectedLanguage: lang,
                requiresImmediateInterruption: false,
                isHistoricalOrHypothetical: true,
              };
            }
            return {
              isEmergency: true,
              confidenceScore: pattern.baseScore,
              category: pattern.category,
              matchedCategory: pattern.category,
              matchedPhrase: phrase,
              detectedLanguage: lang,
              requiresImmediateInterruption: true,
              isHistoricalOrHypothetical: false,
            };
          }
        }
      }
      return null;
    };

    // 1. Check Malayalam expressions
    const mlMatch = matchPatternSet(EMERGENCY_PATTERNS_MALAYALAM, "ml-IN");
    if (mlMatch) return mlMatch;

    // 2. Check English expressions
    const enMatch = matchPatternSet(EMERGENCY_PATTERNS_ENGLISH, "en-IN");
    if (enMatch) return enMatch;

    // 3. Check Manglish phonetic expressions
    const manglishMatch = matchPatternSet(EMERGENCY_PATTERNS_MANGLISH, "ml-IN");
    if (manglishMatch) return manglishMatch;

    // 4. Check Hindi expressions
    const hiMatch = matchPatternSet(EMERGENCY_PATTERNS_HINDI, "hi-IN");
    if (hiMatch) return hiMatch;

    // 5. Check Tamil expressions
    const taMatch = matchPatternSet(EMERGENCY_PATTERNS_TAMIL, "ta-IN");
    if (taMatch) return taMatch;

    // 6. Keyword fuzzy check (single critical tokens)
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
        if (isHistoricalDiscussion) {
          return {
            isEmergency: false,
            confidenceScore: 0.20,
            category: c.cat,
            matchedCategory: c.cat,
            matchedPhrase: c.token,
            detectedLanguage: c.lang,
            requiresImmediateInterruption: false,
            isHistoricalOrHypothetical: true,
          };
        }
        if (c.score >= confidenceThreshold) {
          return {
            isEmergency: true,
            confidenceScore: c.score,
            category: c.cat,
            matchedCategory: c.cat,
            matchedPhrase: c.token,
            detectedLanguage: c.lang,
            requiresImmediateInterruption: true,
            isHistoricalOrHypothetical: false,
          };
        }
      }
    }

    return {
      isEmergency: false,
      confidenceScore: 0,
      category: "NONE",
      matchedCategory: "NONE",
      matchedPhrase: "",
      detectedLanguage: "ml-IN",
      requiresImmediateInterruption: false,
      isHistoricalOrHypothetical: isHistoricalDiscussion,
    };
  }

  /**
   * Fast boolean check for emergency intent with optional confidence threshold.
   */
  public static isEmergency(text: string, confidenceThreshold = 0.70): boolean {
    return this.evaluate(text, confidenceThreshold).isEmergency;
  }

  /**
   * Benchmark execution latency across N iterations.
   * Uses high-resolution process.hrtime.bigint() for reproducible performance measurement.
   */
  public static benchmark(iterations = 1000): {
    iterations: number;
    totalTimeMs: number;
    averageLatencyMs: number;
    p95LatencyMs: number;
    sub50msVerified: boolean;
  } {
    const testPhrases = [
      "അടിയന്തിരമാണ് പെട്ടെന്ന് സഹായിക്കൂ",
      "I am experiencing severe chest pain right now",
      "accident aayi raktham varunnu",
      "I had a heart attack two years ago and want an appointment",
      "Can I know the outpatient consultation hours for cardiology?",
    ];

    const latenciesUs: number[] = [];
    const overallStart = process.hrtime.bigint();

    for (let i = 0; i < iterations; i++) {
      const phrase = testPhrases[i % testPhrases.length];
      const start = process.hrtime.bigint();
      EmergencyDetector.evaluate(phrase);
      const end = process.hrtime.bigint();
      latenciesUs.push(Number(end - start) / 1000); // microseconds
    }

    const overallEnd = process.hrtime.bigint();
    const totalTimeMs = Number(overallEnd - overallStart) / 1_000_000;
    latenciesUs.sort((a, b) => a - b);

    const averageLatencyMs = totalTimeMs / iterations;
    const p95Index = Math.floor(iterations * 0.95);
    const p95LatencyMs = latenciesUs[p95Index] / 1000;

    return {
      iterations,
      totalTimeMs,
      averageLatencyMs,
      p95LatencyMs,
      sub50msVerified: p95LatencyMs < 50.0,
    };
  }
}
