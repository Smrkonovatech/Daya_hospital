/**
 * ============================================================================
 * SMRKOMED HOSPITAL CONVERSATION ENGINE (MALAYALAM VOICE AI)
 * ============================================================================
 *
 * Provider-independent dialogue orchestrator for hospital reception.
 * Initial Pilot: Daya General Hospital & Specialty Surgical Centre, Thrissur.
 *
 * Responsibilities:
 * - Polite Malayalam telephone receptionist persona.
 * - Welcome greeting: "നമസ്കാരം! ദയ ഹോസ്പിറ്റലിലേക്ക് സ്വാഗതം. ഞാൻ സ്മാർക്കോമെഡ് AI അസിസ്റ്റന്റാണ്. എങ്ങനെ സഹായിക്കാം?"
 * - Triage & emergency safeguard: direct escalation to 24/7 Casualty (0487 2475100).
 * - Multi-turn appointment information collection (Patient Name, Doctor/Dept, Date/Time).
 * - Strict healthcare boundaries: never prescribes medication or diagnoses illnesses.
 * - Dynamic generation via Sarvam 105B conversations LLM with fast rule-based fallback.
 */

import { HospitalConfig, DAYA_HOSPITAL_CONFIG } from "@/lib/config/hospital-config";
import { getSarvamConfig, SarvamConfig } from "./sarvam-config";

export interface ConversationTurn {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export interface ConversationResult {
  replyText: string;
  firstSentenceText?: string;
  intent: "GREETING" | "APPOINTMENT" | "DOCTOR_INFO" | "FEES" | "CASUALTY" | "STAFF_TRANSFER" | "GENERAL";
  shouldTransfer: boolean;
  transferDestination?: string;
  appointmentData?: {
    patientName?: string;
    department?: string;
    doctorName?: string;
    preferredDate?: string;
    preferredTime?: string;
  };
  llmTimestamps?: {
    llmStartMs: number;
    llmFirstTokenMs?: number;
    llmResponseReadyMs: number;
  };
}

export class HospitalConversationEngine {
  private hospitalConfig: HospitalConfig;
  private sarvamConfig: SarvamConfig;
  private history: ConversationTurn[] = [];
  private turnCount = 0;
  private collectedAppointment: {
    patientName?: string;
    department?: string;
    doctorName?: string;
    preferredDate?: string;
    preferredTime?: string;
  } = {};

  constructor(
    hospitalConfig?: HospitalConfig,
    sarvamConfigOverrides?: Partial<SarvamConfig>
  ) {
    this.hospitalConfig = hospitalConfig || DAYA_HOSPITAL_CONFIG;
    this.sarvamConfig = getSarvamConfig(sarvamConfigOverrides);
  }

  /**
   * Returns the initial welcome greeting spoken by the receptionist when call connects.
   */
  public getInitialGreeting(): string {
    return "നമസ്കാരം! ദയ ഹോസ്പിറ്റലിലേക്ക് സ്വാഗതം. ഞാൻ സ്മാർക്കോമെഡ് AI അസിസ്റ്റന്റാണ്. എങ്ങനെ സഹായിക്കാം?";
  }

  /**
   * Processes a transcribed caller utterance and produces a polite Malayalam response.
   * Supports optional onFirstSentenceChunk callback for early-start streaming TTS.
   */
  public async processCallerUtterance(
    callerText: string,
    onFirstSentenceChunk?: (sentence: string) => void
  ): Promise<ConversationResult> {
    const text = (callerText || "").trim();
    this.turnCount++;
    this.history.push({ role: "user", content: text, timestamp: Date.now() });

    const tImmediate = Date.now();
    const immediateTimestamps = {
      llmStartMs: tImmediate,
      llmFirstTokenMs: tImmediate,
      llmResponseReadyMs: tImmediate,
    };

    if (!text) {
      const defaultPrompt = "ദയവായി താങ്കൾക്ക് എന്ത് സഹായമാണ് വേണ്ടതെന്ന് പറയാമോ?";
      this.history.push({ role: "assistant", content: defaultPrompt, timestamp: Date.now() });
      if (onFirstSentenceChunk) onFirstSentenceChunk(defaultPrompt);
      return {
        replyText: defaultPrompt,
        firstSentenceText: defaultPrompt,
        intent: "GENERAL",
        shouldTransfer: false,
        llmTimestamps: immediateTimestamps,
      };
    }

    const lower = text.toLowerCase();

    // ----------------------------------------------------
    // 1. EMERGENCY & CASUALTY TRIAGE SAFEGUARD
    // ----------------------------------------------------
    if (this.isEmergency(lower)) {
      const casualtyNumber =
        this.hospitalConfig.routing.casualtyDirectNumber || "+914872475100";
      const reply = `ഇതൊരു അത്യാഹിത സാഹചര്യമായതിനാൽ ഞാൻ കാഷ്വാലിറ്റി എമർജൻസി ഡെസ്കിലേക്ക് കണക്ട് ചെയ്യുകയാണ്. ദയവായി ലൈനിൽ തുടരുക, അല്ലെങ്കിൽ ${casualtyNumber} എന്ന നമ്പറിൽ ഉടൻ ബന്ധപ്പെടുക.`;

      this.history.push({ role: "assistant", content: reply, timestamp: Date.now() });
      if (onFirstSentenceChunk) onFirstSentenceChunk(reply);
      return {
        replyText: reply,
        firstSentenceText: reply,
        intent: "CASUALTY",
        shouldTransfer: true,
        transferDestination: this.hospitalConfig.routing.casualtyExtension || "100",
        llmTimestamps: immediateTimestamps,
      };
    }

    // ----------------------------------------------------
    // 2. HUMAN OPERATOR / STAFF TRANSFER REQUEST
    // ----------------------------------------------------
    if (this.isStaffTransferRequested(lower)) {
      const reply =
        "തീർച്ചയായും, ഞാൻ ഇപ്പോൾ തന്നെ ഹോസ്പിറ്റൽ ഫ്രണ്ട് ഡെസ്ക് സ്റ്റാഫിലേക്ക് കോൾ ട്രാൻസ്ഫർ ചെയ്യാം. ദയവായി ലൈനിൽ തുടരുക.";
      this.history.push({ role: "assistant", content: reply, timestamp: Date.now() });
      if (onFirstSentenceChunk) onFirstSentenceChunk(reply);
      return {
        replyText: reply,
        firstSentenceText: reply,
        intent: "STAFF_TRANSFER",
        shouldTransfer: true,
        transferDestination: "201",
        llmTimestamps: immediateTimestamps,
      };
    }

    // ----------------------------------------------------
    // 3. APPOINTMENT BOOKING WORKFLOW
    // ----------------------------------------------------
    if (this.isAppointmentIntent(lower)) {
      const appointmentResult = this.handleAppointmentStep(text);
      this.history.push({
        role: "assistant",
        content: appointmentResult.replyText,
        timestamp: Date.now(),
      });
      if (onFirstSentenceChunk) onFirstSentenceChunk(appointmentResult.replyText);
      return {
        ...appointmentResult,
        firstSentenceText: appointmentResult.replyText,
        llmTimestamps: immediateTimestamps,
      };
    }

    // ----------------------------------------------------
    // 4. CONSULTATION FEES & CHARGES
    // ----------------------------------------------------
    if (this.isFeesInquiry(lower)) {
      const reply =
        "ദയ ഹോസ്പിറ്റലിൽ പുതിയ പേഷ്യന്റ് രജിസ്ട്രേഷന് 100 രൂപയും, ജനറൽ മെഡിസിൻ ഒപി കൺസൾട്ടേഷന് 250 രൂപയുമാണ്. സ്പെഷ്യലിസ്റ്റ് കൺസൾട്ടേഷൻ ഫീസ് 450 രൂപയും, സൂപ്പർ സ്പെഷ്യാലിറ്റി ഒപി ഫീസ് 600 രൂപയുമാണ്.";
      this.history.push({ role: "assistant", content: reply, timestamp: Date.now() });
      if (onFirstSentenceChunk) onFirstSentenceChunk(reply);
      return {
        replyText: reply,
        firstSentenceText: reply,
        intent: "FEES",
        shouldTransfer: false,
        llmTimestamps: immediateTimestamps,
      };
    }

    // ----------------------------------------------------
    // 5. DOCTOR & DEPARTMENT INFORMATION
    // ----------------------------------------------------
    if (this.isDoctorInfoInquiry(lower)) {
      const reply =
        "ദയ ഹോസ്പിറ്റലിൽ കാർഡിയോളജി, ഓർത്തോപീഡിക്സ്, ജനറൽ മെഡിസിൻ, പീഡിയാട്രിക്സ്, ഇഎൻടി, ന്യൂറോളജി എന്നീ വിഭാഗങ്ങൾ പ്രവർത്തിക്കുന്നുണ്ട്. രാവിലെ 9 മണി മുതൽ വൈകുന്നേരം 5 മണി വരെയാണ് ഒപി കൺസൾട്ടേഷൻ സമയം.";
      this.history.push({ role: "assistant", content: reply, timestamp: Date.now() });
      if (onFirstSentenceChunk) onFirstSentenceChunk(reply);
      return {
        replyText: reply,
        firstSentenceText: reply,
        intent: "DOCTOR_INFO",
        shouldTransfer: false,
        llmTimestamps: immediateTimestamps,
      };
    }

    // ----------------------------------------------------
    // 6. DYNAMIC MALAYALAM LLM STREAMING (SARVAM-105B)
    // ----------------------------------------------------
    const tStart = Date.now();
    let aiResponse = "";
    let firstSentence = "";
    let llmFirstTokenMs: number | undefined;

    if (this.sarvamConfig.isConfigured) {
      const llmResult = await this.querySarvamLlm(text, onFirstSentenceChunk);
      aiResponse = llmResult.fullText;
      firstSentence = llmResult.firstSentence;
      llmFirstTokenMs = llmResult.llmFirstTokenMs;
    }

    if (!aiResponse) {
      aiResponse =
        "തീർച്ചയായും. ഡോക്ടറെ കാണുന്നതിനായുള്ള അപ്പോയിന്റ്മെന്റ് അല്ലെങ്കിൽ ഹോസ്പിറ്റൽ സേവനങ്ങളെക്കുറിച്ചുള്ള വിവരങ്ങൾക്ക് സഹായിക്കാം. ഏത് വിഭാഗത്തിലാണ് സഹായം വേണ്ടത്?";
      firstSentence = aiResponse;
      if (onFirstSentenceChunk) onFirstSentenceChunk(aiResponse);
    }

    const tEnd = Date.now();
    this.history.push({ role: "assistant", content: aiResponse, timestamp: tEnd });
    return {
      replyText: aiResponse,
      firstSentenceText: firstSentence || aiResponse,
      intent: "GENERAL",
      shouldTransfer: false,
      llmTimestamps: {
        llmStartMs: tStart,
        llmFirstTokenMs: llmFirstTokenMs || tStart,
        llmResponseReadyMs: tEnd,
      },
    };
  }

  // --------------------------------------------------------------------------
  // HEURISTIC INTENT CLASSIFIERS
  // --------------------------------------------------------------------------

  private isEmergency(text: string): boolean {
    const emergencyKeywords = [
      "emergency",
      "എമർജൻസി",
      "accident",
      "അടിയന്തിരം",
      "അടിയന്തരം",
      "ആക്സിഡന്റ്",
      "അപകടം",
      "നെഞ്ചുവേദന",
      "ശ്വാസംമുട്ടൽ",
      "അത്യാഹിതം",
      "രക്തം",
      "ആംബുലൻസ്",
      "കാഷ്വാലിറ്റി",
      "casualty",
      "ambulance",
      "icu",
      "serious",
    ];
    return emergencyKeywords.some((kw) => text.includes(kw));
  }

  private isStaffTransferRequested(text: string): boolean {
    const transferKeywords = [
      "സ്റ്റാഫിനോട്",
      "മനുഷ്യനോട്",
      "ആളോട്",
      "ഓപ്പറേറ്റർ",
      "കണക്ട് ചെയ്യ്",
      "transfer",
      "operator",
      "human",
      "staff",
      "speak to person",
    ];
    return transferKeywords.some((kw) => text.includes(kw));
  }

  private isAppointmentIntent(text: string): boolean {
    const appointmentKeywords = [
      "appointment",
      "അപ്പോയിന്റ്മെന്റ്",
      "അപ്പോയിന്റ്മെൻ്റ്",
      "ബുക്കിംഗ്",
      "booking",
      "ഡോക്ടറെ കാണാൻ",
      "ഡോക്ടറെ കാണണം",
      "കാണണം",
      "സമയം",
      "slot",
      "book",
      "consult",
      "consultation",
    ];
    return appointmentKeywords.some((kw) => text.includes(kw));
  }

  private isFeesInquiry(text: string): boolean {
    const feeKeywords = ["ഫീസ്", "ചാർജ്", "പണം", "രൂപ", "rate", "charge", "cost", "fee"];
    return feeKeywords.some((kw) => text.includes(kw));
  }

  private isDoctorInfoInquiry(text: string): boolean {
    const doctorKeywords = [
      "ഡോക്ടർമാർ",
      "ഡോക്ടർ",
      "doctor",
      "കാർഡിയോളജി",
      "സ്പെഷ്യലിസ്റ്റ്",
      "വിഭാഗങ്ങൾ",
      "ഡിപ്പാർട്ട്മെന്റ്",
      "ആരൊക്കെ ഉണ്ട്",
      "ടൈം",
      "സമയം",
      "സമയം ഉണ്ടോ",
      "doctor list",
      "department",
    ];
    return doctorKeywords.some((kw) => text.includes(kw));
  }

  private handleAppointmentStep(text: string): ConversationResult {
    // Extract department if mentioned
    if (text.includes("കാർഡിയോളജി") || text.toLowerCase().includes("cardio")) {
      this.collectedAppointment.department = "Cardiology";
    } else if (text.includes("ഓർത്തോ") || text.toLowerCase().includes("ortho")) {
      this.collectedAppointment.department = "Orthopaedics";
    } else if (text.includes("കുട്ടികളുടെ") || text.toLowerCase().includes("pediatric")) {
      this.collectedAppointment.department = "Paediatrics";
    } else if (text.includes("ജനറൽ മെഡിസിൻ") || text.toLowerCase().includes("general")) {
      this.collectedAppointment.department = "General Medicine";
    }

    // Step 1: Missing department
    if (!this.collectedAppointment.department) {
      return {
        replyText:
          "തീർച്ചയായും. ഏത് വിഭാഗത്തിലെ ഡോക്ടറെയാണ് കാണേണ്ടത്? കാർഡിയോളജി, ഓർത്തോപീഡിക്സ്, ജനറൽ മെഡിസിൻ, പീഡിയാട്രിക്സ് എന്നിവ ലഭ്യമാണ്.",
        intent: "APPOINTMENT",
        shouldTransfer: false,
        appointmentData: { ...this.collectedAppointment },
      };
    }

    // Step 2: Missing preferred time
    if (!this.collectedAppointment.preferredDate) {
      if (text.includes("നാളെ") || text.toLowerCase().includes("tomorrow")) {
        this.collectedAppointment.preferredDate = "Tomorrow";
      } else if (text.includes("ഇന്ന്") || text.toLowerCase().includes("today")) {
        this.collectedAppointment.preferredDate = "Today";
      } else {
        return {
          replyText: `ശരി, ${this.collectedAppointment.department} വിഭാഗത്തിൽ അപ്പോയിന്റ്മെന്റ് എടുക്കാം. താങ്കൾക്ക് സൗകര്യപ്രദമായ തീയതിയും സമയവും എപ്പോഴാണ്? നാളെ രാവിലെയോ വൈകുന്നേരമോ?`,
          intent: "APPOINTMENT",
          shouldTransfer: false,
          appointmentData: { ...this.collectedAppointment },
        };
      }
    }

    // Step 3: Confirmation (Explicit safety guard: AI must never falsely claim an appointment is booked or slot confirmed)
    const isMockOrTest = Boolean(
      this.hospitalConfig.telephony.status === "MOCK_SANDBOX" ||
      process.env.AI_DEMO_MODE === "true" ||
      process.env.NODE_ENV !== "production"
    );
    const replyText = isMockOrTest
      ? "നന്ദി. ഇതൊരു പരീക്ഷണ കോളായതിനാൽ യഥാർത്ഥ അപ്പോയിന്റ്മെന്റ് ബുക്ക് ചെയ്തിട്ടില്ല. ഡെമോൺസ്ട്രേഷനായി താങ്കളുടെ വിവരങ്ങൾ രേഖപ്പെടുത്തിയിട്ടുണ്ട്."
      : "നന്ദി. താങ്കളുടെ അപ്പോയിന്റ്മെന്റ് വിവരങ്ങൾ രേഖപ്പെടുത്തിയിട്ടുണ്ട്. ഒപി വിഭാഗത്തിൽ നിന്ന് കൺഫർമേഷനായി ബന്ധപ്പെടുന്നതാണ്.";

    return {
      replyText,
      intent: "APPOINTMENT",
      shouldTransfer: false,
      appointmentData: { ...this.collectedAppointment },
    };
  }

  /**
   * Generates dynamic Malayalam conversation using Sarvam's 105B conversation model.
   * Supports streaming with early first-sentence detection to minimize TTS startup latency.
   */
  private async querySarvamLlm(
    userPrompt: string,
    onFirstSentence?: (sentence: string) => void
  ): Promise<{
    fullText: string;
    firstSentence: string;
    llmStartMs: number;
    llmFirstTokenMs?: number;
    llmResponseReadyMs: number;
  }> {
    const llmStartMs = Date.now();
    let llmFirstTokenMs: number | undefined;

    try {
      const systemPrompt = `You are the AI Voice Receptionist at ${this.hospitalConfig.hospitalName}, ${this.hospitalConfig.city}, Kerala.
Rules:
1. Always reply in polite, natural spoken Malayalam. Keep responses very brief (1 to 2 short sentences) suitable for telephony speech.
2. For appointment inquiries, guide caller to provide department, doctor, and preferred time.
3. For emergency or casualty inquiries, direct caller immediately to Casualty Hotline: ${this.hospitalConfig.routing.casualtyDirectNumber}.
4. Never invent medical advice or fake prescriptions.
5. Be courteous, respectful and welcoming.`;

      const messages = [
        { role: "system", content: systemPrompt },
        ...this.history.slice(-4).map((h) => ({ role: h.role, content: h.content })),
        { role: "user", content: userPrompt },
      ];

      const res = await fetch(`${this.sarvamConfig.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "api-subscription-key": this.sarvamConfig.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.sarvamConfig.chatModel || "sarvam-105b-conversations",
          messages,
          temperature: 0.2,
          max_tokens: 100,
          stream: true,
        }),
      });

      if (res.ok && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";
        let firstSentence = "";
        let firstSentenceSent = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === "data: [DONE]") continue;
            if (trimmed.startsWith("data: ")) {
              try {
                const parsed = JSON.parse(trimmed.slice(6));
                const delta = parsed.choices?.[0]?.delta?.content || "";
                if (delta) {
                  if (!llmFirstTokenMs) {
                    llmFirstTokenMs = Date.now();
                  }
                  fullText += delta;

                  // Detect first sentence boundary for early TTS start
                  if (!firstSentenceSent && fullText.length >= 8) {
                    const match = fullText.match(/^([^.!?।\n]+[.!?।\n])/);
                    if (match && match[1]?.trim()) {
                      firstSentence = match[1].trim();
                      firstSentenceSent = true;
                      if (onFirstSentence) {
                        onFirstSentence(firstSentence);
                      }
                    }
                  }
                }
              } catch {}
            }
          }
        }

        const llmResponseReadyMs = Date.now();
        const finalFullText = fullText.trim();
        return {
          fullText: finalFullText,
          firstSentence: firstSentence || finalFullText,
          llmStartMs,
          llmFirstTokenMs: llmFirstTokenMs || llmResponseReadyMs,
          llmResponseReadyMs,
        };
      }
    } catch (err) {
      console.warn("[ConversationEngine] Sarvam LLM streaming error:", err);
    }

    const fallbackTime = Date.now();
    return {
      fullText: "",
      firstSentence: "",
      llmStartMs,
      llmFirstTokenMs: fallbackTime,
      llmResponseReadyMs: fallbackTime,
    };
  }

  public getHistory(): ConversationTurn[] {
    return [...this.history];
  }
}
