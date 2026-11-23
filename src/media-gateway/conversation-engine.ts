/**
 * ============================================================================
 * SMRKOMED HOSPITAL CONVERSATION ENGINE (SARVAM-NATIVE CONVERSATIONAL AI)
 * ============================================================================
 *
 * Direct Sarvam AI conversational reasoning and dialogue generation with
 * hospital-specific knowledge orchestration, tenant guardrails, triage monitoring,
 * and pipelined first-sentence streaming.
 *
 * Initial Pilot: Daya General Hospital & Specialty Surgical Centre, Thrissur.
 *
 * Responsibilities:
 * - Polite, natural Malayalam / English / Manglish receptionist persona.
 * - Sarvam 105B conversation model (`sarvam-105b-conversations`) as the primary brain
 *   reasoning over approved hospital context, departments, doctors, visiting hours,
 *   consultation fees, facilities, and appointment policies.
 * - Streaming token processing with intelligent sentence boundary detection for early
 *   first-sentence dispatch to Sarvam Bulbul TTS (<1.0-1.5s prompt-to-speech latency).
 * - Triage & emergency safeguard: immediate escalation to 24/7 Casualty or 108.
 * - Strict healthcare boundaries: never prescribes medication or diagnoses illnesses.
 * - Offline mock fallback for unit tests when API keys are unconfigured.
 */

import { HospitalConfig, DAYA_HOSPITAL_CONFIG } from "@/lib/config/hospital-config";
import { getSarvamConfig, SarvamConfig } from "./sarvam-config";
import { EmergencyDetector } from "@/lib/services/emergency-detector";
import { LanguageDetector } from "@/lib/services/language-detector";

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
    llmFirstSentenceMs?: number;
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
   * Defaults to Malayalam for Kerala pilot, with multi-language adaptation.
   */
  public getInitialGreeting(lang: string = "ml-IN"): string {
    const isDaya =
      this.hospitalConfig.hospitalId === "hosp_daya_thrissur" ||
      (this.hospitalConfig.hospitalName || "").toLowerCase().includes("daya");
    const hospitalMl = isDaya
      ? "ദയ ഹോസ്പിറ്റൽ"
      : this.hospitalConfig.shortName || this.hospitalConfig.hospitalName || "ഹോസ്പിറ്റൽ";
    const destinationMl = isDaya ? "ദയ ഹോസ്പിറ്റലിലേക്ക്" : `${hospitalMl}ലേക്ക്`;
    const hospitalEn = this.hospitalConfig.hospitalName || "General Hospital";
    const hospital = hospitalEn;

    switch (lang) {
      case "ml-IN":
        return `നമസ്കാരം! ${destinationMl} സ്വാഗതം. ഞാൻ സ്മാർക്കോമെഡ് AI അസിസ്റ്റന്റാണ്. എങ്ങനെ സഹായിക്കാം?`;
      case "hi-IN":
        return `नमस्ते! ${hospital} में आपका स्वागत है। मैं स्मार्कोमेड AI सहायक हूँ। मैं आपकी क्या मदद कर सकता हूँ?`;
      case "ta-IN":
        return `வணக்கம்! ${hospital}க்கு வரவேற்கிறோம். நான் ஸ்மார்டோமெட் AI உதவியாளர். உங்களுக்கு എങ്ങനെ സഹായിക്കാം?`;
      case "kn-IN":
        return `ನಮಸ್ಕಾರ! ${hospital} ಗೆ ಸುಸ್ವಾಗತ. ನಾನು ಸ್ಮಾರ್ಕೋമെಡ್ AI ಸಹಾಯಕ. ನಾನು ನಿಮಗೆ എങ്ങനെ സഹായിക്കാം?`;
      case "te-IN":
        return `నమస్కారం! ${hospital} కి స్వాగతం. నేను స్మార్కోమెడ్ AI సహాయకుడిని. ఎలా സഹായിക്കാം?`;
      case "en-IN":
      default:
        return `Hello! Welcome to ${hospital}. I am your AI receptionist. How may I help you today?`;
    }
  }

  /**
   * Processes a transcribed caller utterance and produces a polite, language-aware response.
   * Supports streaming sentence emission via onSentenceChunk callback for pipelined TTS.
   */
  public async processCallerUtterance(
    callerText: string,
    onSentenceChunk?: (sentence: string, sentenceIndex: number) => void
  ): Promise<ConversationResult> {
    const text = (callerText || "").trim();
    this.turnCount++;
    this.history.push({ role: "user", content: text, timestamp: Date.now() });

    const tImmediate = Date.now();
    const immediateTimestamps = {
      llmStartMs: tImmediate,
      llmFirstTokenMs: tImmediate,
      llmFirstSentenceMs: tImmediate,
      llmResponseReadyMs: tImmediate,
    };

    const detection = LanguageDetector.detectLanguage(text);
    const lang = detection.detectedLanguage;

    if (!text) {
      const defaultPrompt = lang === "ml-IN"
        ? "ദയവായി താങ്കൾക്ക് എന്ത് സഹായമാണ് വേണ്ടതെന്ന് പറയാമോ?"
        : "Could you please tell me how I can assist you today?";
      this.history.push({ role: "assistant", content: defaultPrompt, timestamp: Date.now() });
      if (onSentenceChunk) onSentenceChunk(defaultPrompt, 0);
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
      const casualtyNumber = (this.hospitalConfig.routing.casualtyDirectNumber || "").trim();
      const isConfirmed = process.env.HOSPITAL_DESTINATIONS_CONFIRMED === "true" && !!casualtyNumber;

      let reply: string;
      if (isConfirmed) {
        reply = lang === "ml-IN"
          ? `ഇതൊരു അത്യാഹിത സാഹചര്യമായതിനാൽ ഞാൻ കാഷ്വാലിറ്റി എമർജൻസി ഡെസ്കിലേക്ക് കണക്ട് ചെയ്യുകയാണ്. ദയവായി ലൈനിൽ തുടരുക, അല്ലെങ്കിൽ ${casualtyNumber} എന്ന നമ്പറിൽ ഉടൻ ബന്ധപ്പെടുക.`
          : `ഇതൊരു അത്യാഹിത സാഹചര്യമായതിനാൽ ഞാൻ കാഷ്വാലിറ്റി എമർജൻസി ഡെസ്കിലേക്ക് കണക്ട് ചെയ്യുകയാണ് (${casualtyNumber}). This is an emergency situation. I am connecting you to the casualty emergency desk at ${casualtyNumber}. Please stay on the line.`;
      } else {
        console.warn("[ConversationEngine] Emergency detected but hospital destination is unconfirmed. Providing safe medical guidance.");
        reply = lang === "ml-IN"
          ? "ശ്രദ്ധിക്കുക: അടിയന്തര സാഹചര്യങ്ങളിൽ ദയവായി തൊട്ടടുത്തുള്ള ആശുപത്രിയിലെ കാഷ്വാലിറ്റി വിഭാഗത്തിൽ നേരിട്ടെത്തുകയോ അല്ലെങ്കിൽ 108 ആംബുലൻസ് സർവീസുമായി ഉടൻ ബന്ധപ്പെടുകയോ ചെയ്യുക."
          : "Please note: In a medical emergency, please visit the nearest hospital casualty emergency department immediately or call the national emergency ambulance service at 108.";
      }

      this.history.push({ role: "assistant", content: reply, timestamp: Date.now() });
      if (onSentenceChunk) onSentenceChunk(reply, 0);
      return {
        replyText: reply,
        firstSentenceText: reply,
        intent: "CASUALTY",
        shouldTransfer: isConfirmed,
        transferDestination: isConfirmed ? (this.hospitalConfig.routing.casualtyExtension || casualtyNumber) : undefined,
        llmTimestamps: immediateTimestamps,
      };
    }

    // ----------------------------------------------------
    // 2. HUMAN OPERATOR / STAFF TRANSFER REQUEST
    // ----------------------------------------------------
    if (this.isStaffTransferRequested(lower)) {
      const reply = lang === "ml-IN"
        ? "തീർച്ചയായും, ഞാൻ ഇപ്പോൾ തന്നെ ഹോസ്പിറ്റൽ ഫ്രണ്ട് ഡെസ്ക് സ്റ്റാഫിലേക്ക് കോൾ ട്രാൻസ്ഫർ ചെയ്യാം. ദയവായി ലൈനിൽ തുടരുക."
        : "Certainly, I am transferring your call to our hospital reception staff. Please hold the line.";
      this.history.push({ role: "assistant", content: reply, timestamp: Date.now() });
      if (onSentenceChunk) onSentenceChunk(reply, 0);
      return {
        replyText: reply,
        firstSentenceText: reply,
        intent: "STAFF_TRANSFER",
        shouldTransfer: true,
        transferDestination: "201",
        llmTimestamps: immediateTimestamps,
      };
    }

    // Background entity extraction for appointment tracking
    this.extractAppointmentEntities(text);

    // ----------------------------------------------------
    // 3. SARVAM-NATIVE CONVERSATIONAL REASONING (SARVAM-105B)
    // ----------------------------------------------------
    if (this.sarvamConfig.isConfigured) {
      const llmResult = await this.querySarvamLlm(text, onSentenceChunk);
      let replyText = llmResult.fullText.trim();
      let firstSentenceText = llmResult.firstSentence.trim();

      let intent: ConversationResult["intent"] = "GENERAL";
      let shouldTransfer = false;
      let transferDestination: string | undefined;

      // Parse structured action tags if returned by Sarvam LLM
      if (replyText.includes("[TRANSFER_STAFF]")) {
        intent = "STAFF_TRANSFER";
        shouldTransfer = true;
        transferDestination = "201";
        replyText = replyText.replace(/\[TRANSFER_STAFF\]/g, "").trim();
        firstSentenceText = firstSentenceText.replace(/\[TRANSFER_STAFF\]/g, "").trim();
      } else if (replyText.includes("[EMERGENCY_DETECTED]") || replyText.includes("[CASUALTY]")) {
        intent = "CASUALTY";
        const isConfirmed = process.env.HOSPITAL_DESTINATIONS_CONFIRMED === "true";
        shouldTransfer = isConfirmed;
        transferDestination = isConfirmed ? this.hospitalConfig.routing.casualtyDirectNumber : undefined;
        replyText = replyText.replace(/\[EMERGENCY_DETECTED\]|\[CASUALTY\]/g, "").trim();
        firstSentenceText = firstSentenceText.replace(/\[EMERGENCY_DETECTED\]|\[CASUALTY\]/g, "").trim();
      } else if (this.isAppointmentIntent(lower) || replyText.includes("[APPOINTMENT]")) {
        intent = "APPOINTMENT";
        replyText = replyText.replace(/\[APPOINTMENT\]/g, "").trim();
        firstSentenceText = firstSentenceText.replace(/\[APPOINTMENT\]/g, "").trim();
      } else if (this.isDoctorInfoInquiry(lower)) {
        intent = "DOCTOR_INFO";
      } else if (this.isFeesInquiry(lower)) {
        intent = "FEES";
      }

      if (replyText) {
        this.history.push({ role: "assistant", content: replyText, timestamp: llmResult.llmResponseReadyMs });
        return {
          replyText,
          firstSentenceText: firstSentenceText || replyText,
          intent,
          shouldTransfer,
          transferDestination,
          appointmentData: { ...this.collectedAppointment },
          llmTimestamps: {
            llmStartMs: llmResult.llmStartMs,
            llmFirstTokenMs: llmResult.llmFirstTokenMs,
            llmFirstSentenceMs: llmResult.llmFirstSentenceMs,
            llmResponseReadyMs: llmResult.llmResponseReadyMs,
          },
        };
      }
    }

    // ----------------------------------------------------
    // 4. OFFLINE / TEST MOCK FALLBACK
    // ----------------------------------------------------
    let fallbackReply = "";
    let fallbackIntent: ConversationResult["intent"] = "GENERAL";

    if (this.isAppointmentIntent(lower)) {
      const apptResult = this.handleAppointmentStep(text, lang);
      fallbackReply = apptResult.replyText;
      fallbackIntent = "APPOINTMENT";
    } else if (this.isFeesInquiry(lower)) {
      fallbackReply = lang === "ml-IN"
        ? "ദയ ഹോസ്പിറ്റലിൽ പുതിയ പേഷ്യന്റ് രജിസ്ട്രേഷന് 100 രൂപയും, ജനറൽ ഒപി കൺസൾട്ടേഷന് 250 രൂപയുമാണ്. സ്പെഷ്യലിസ്റ്റ് കൺസൾട്ടേഷൻ ഫീസ് 450 രൂപയും സൂപ്പർ സ്പെഷ്യാലിറ്റി ഒപി ഫീസ് 600 രൂപയുമാണ്."
        : "At our hospital, new patient registration is Rs 100, and general medicine OP consultation is Rs 250. Specialist consultation is Rs 450, and super-specialty OP is Rs 600.";
      fallbackIntent = "FEES";
    } else if (this.isDoctorInfoInquiry(lower)) {
      fallbackReply = lang === "ml-IN"
        ? "ദയ ഹോസ്പിറ്റലിൽ കാർഡിയോളജി, ഓർത്തോപീഡിക്സ്, ജനറൽ മെഡിസിൻ, പീഡിയാട്രിക്സ്, ഇഎൻടി എന്നീ വിഭാഗങ്ങൾ പ്രവർത്തിക്കുന്നുണ്ട്. രാവിലെ 9 മണി മുതൽ വൈകുന്നേരം 5 മണി വരെയാണ് ഒപി കൺസൾട്ടേഷൻ സമയം."
        : "Our hospital has Cardiology, Orthopaedics, General Medicine, Paediatrics, and ENT departments. Outpatient consultations are open Monday to Saturday from 9 AM to 5 PM.";
      fallbackIntent = "DOCTOR_INFO";
    } else {
      fallbackReply = lang === "ml-IN"
        ? "തീർച്ചയായും. ഡോക്ടറെ കാണുന്നതിനായുള്ള അപ്പോയിന്റ്മെന്റ് അല്ലെങ്കിൽ ഹോസ്പിറ്റൽ സേവനങ്ങളെക്കുറിച്ചുള്ള വിവരങ്ങൾക്ക് സഹായിക്കാം. ഏത് വിഭാഗത്തിലാണ് സഹായം വേണ്ടത്?"
        : "Certainly! I can assist you with doctor appointments or hospital services. Which department would you like help with?";
    }

    this.history.push({ role: "assistant", content: fallbackReply, timestamp: Date.now() });
    if (onSentenceChunk) onSentenceChunk(fallbackReply, 0);

    return {
      replyText: fallbackReply,
      firstSentenceText: fallbackReply,
      intent: fallbackIntent,
      shouldTransfer: false,
      appointmentData: { ...this.collectedAppointment },
      llmTimestamps: immediateTimestamps,
    };
  }

  // --------------------------------------------------------------------------
  // HEURISTIC HELPERS & ENTITY EXTRACTION
  // --------------------------------------------------------------------------

  private isEmergency(text: string): boolean {
    return EmergencyDetector.isEmergency(text);
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
      "സമയം ഉണ്ടോ",
      "doctor list",
      "department",
    ];
    return doctorKeywords.some((kw) => text.includes(kw));
  }

  private extractAppointmentEntities(text: string): void {
    const lower = text.toLowerCase();
    if (text.includes("കാർഡിയോളജി") || lower.includes("cardio")) {
      this.collectedAppointment.department = "Cardiology";
    } else if (text.includes("ഓർത്തോ") || lower.includes("ortho")) {
      this.collectedAppointment.department = "Orthopaedics";
    } else if (text.includes("കുട്ടികളുടെ") || lower.includes("pediatric")) {
      this.collectedAppointment.department = "Paediatrics";
    } else if (text.includes("ജനറൽ മെഡിസിൻ") || lower.includes("general medicine")) {
      this.collectedAppointment.department = "General Medicine";
    } else if (text.includes("ഗൈനക്കോളജി") || lower.includes("gynae")) {
      this.collectedAppointment.department = "Obstetrics & Gynaecology";
    }

    if (text.includes("നാളെ") || lower.includes("tomorrow")) {
      this.collectedAppointment.preferredDate = "Tomorrow";
    } else if (text.includes("ഇന്ന്") || lower.includes("today")) {
      this.collectedAppointment.preferredDate = "Today";
    }
  }

  private handleAppointmentStep(text: string, lang: string = "ml-IN"): ConversationResult {
    this.extractAppointmentEntities(text);

    if (!this.collectedAppointment.department) {
      const replyText = lang === "ml-IN"
        ? "തീർച്ചയായും. ഏത് വിഭാഗത്തിലെ ഡോക്ടറെയാണ് കാണേണ്ടത്? കാർഡിയോളജി, ഓർത്തോപീഡിക്സ്, ജനറൽ മെഡിസിൻ, പീഡിയാട്രിക്സ് എന്നിവ ലഭ്യമാണ്."
        : "Certainly. Which department would you like to consult? We have Cardiology, Orthopaedics, General Medicine, and Paediatrics available.";
      return {
        replyText,
        intent: "APPOINTMENT",
        shouldTransfer: false,
        appointmentData: { ...this.collectedAppointment },
      };
    }

    if (!this.collectedAppointment.preferredDate) {
      const replyText = lang === "ml-IN"
        ? `ശരി, ${this.collectedAppointment.department} വിഭാഗത്തിൽ അപ്പോയിന്റ്മെന്റ് എടുക്കാം. താങ്കൾക്ക് സൗകര്യപ്രദമായ തീയതിയും സമയവും എപ്പോഴാണ്? നാളെ രാവിലെയോ വൈകുന്നേരമോ?`
        : `Sure, let's schedule an appointment with ${this.collectedAppointment.department}. What date and time would suit you best? Tomorrow morning or afternoon?`;
      return {
        replyText,
        intent: "APPOINTMENT",
        shouldTransfer: false,
        appointmentData: { ...this.collectedAppointment },
      };
    }

    const replyText = lang === "ml-IN"
      ? "നന്ദി. താങ്കളുടെ അപ്പോയിന്റ്മെന്റ് വിവരങ്ങൾ രേഖപ്പെടുത്തിയിട്ടുണ്ട്. ഒപി വിഭാഗത്തിൽ നിന്ന് കൺഫർമേഷനായി ബന്ധപ്പെടുന്നതാണ്."
      : "Thank you. Your appointment details have been noted. Our hospital OPD desk will contact you shortly to confirm the slot.";

    return {
      replyText,
      intent: "APPOINTMENT",
      shouldTransfer: false,
      appointmentData: { ...this.collectedAppointment },
    };
  }

  /**
   * Generates dynamic Malayalam conversation using Sarvam's 105B conversation model.
   * Feeds full approved hospital knowledge into system prompt and streams tokens with
   * early sentence boundary detection for pipelined TTS.
   */
  private async querySarvamLlm(
    userPrompt: string,
    onSentenceChunk?: (sentence: string, sentenceIndex: number) => void
  ): Promise<{
    fullText: string;
    firstSentence: string;
    llmStartMs: number;
    llmFirstTokenMs?: number;
    llmFirstSentenceMs?: number;
    llmResponseReadyMs: number;
  }> {
    const llmStartMs = Date.now();
    let llmFirstTokenMs: number | undefined;
    let llmFirstSentenceMs: number | undefined;

    try {
      const casualtyDirectNumber = this.hospitalConfig.routing.casualtyDirectNumber || "0487 2475100";
      const systemPrompt = `You are the polite, warm, and highly efficient AI Voice Receptionist at ${this.hospitalConfig.hospitalName}, ${this.hospitalConfig.city}, Kerala.

APPROVED HOSPITAL KNOWLEDGE:
- Profile: NABH-accredited 300-bed multi-specialty hospital located near State Bank of India, Shornur Road, Thrissur.
- Emergency / Casualty: 24/7 Casualty & Trauma Care. If the caller has a medical emergency (severe chest pain, breathing difficulty, heavy bleeding, accident, loss of consciousness), direct them immediately to Casualty (${casualtyDirectNumber}) or ambulance 108 and append tag [EMERGENCY_DETECTED].
- OPD Timings: Morning OPD 8:30 AM to 1:00 PM (Mon-Sat); Evening OPD 4:00 PM to 7:00 PM (select specialties); Sunday OPD 9:00 AM to 1:00 PM (General Medicine & Paediatrics).
- Visiting Hours: General Wards 11:30 AM - 1:00 PM & 4:30 PM - 6:30 PM; ICU 12:00 PM - 1:00 PM & 5:00 PM - 6:00 PM (1 visitor only).
- Doctors & Schedule:
  * Cardiology: Dr. K. R. Balakrishnan (Mon, Wed, Fri 9 AM - 1 PM); Dr. Mathew Joseph (Tue, Thu, Sat 10 AM - 2 PM).
  * Orthopaedics: Dr. Suresh Kumar (Mon-Sat 9:30 AM - 1 PM); Dr. Praveen Menon (Mon-Fri 2 PM - 5 PM).
  * Paediatrics: Dr. Radhika Nair (Mon-Sat 9 AM - 2 PM); Evening clinic daily 4:30 PM - 7 PM.
  * Obstetrics & Gynaecology: Dr. Lakshmi Nambiar (Mon-Sat 9 AM - 1 PM); Dr. Sneha Thomas (Mon, Wed, Fri 2 PM - 6 PM).
  * General Medicine: Dr. Anitha Varghese (Mon-Sat 9 AM - 1 PM & 4 PM - 7 PM).
  * Also active: Neurology, Nephrology (24/7 Dialysis), ENT, Pulmonology, Surgery.
- Consultation Fees: Lifetime UHID registration ₹100, General Medicine OP ₹250 (valid for 1 free revisit within 7 days), Specialist ₹450, Super-Specialty ₹600, Casualty ₹500. Payment by UPI, Card, Cash, TPA cashless.
- Facilities: 1.5T MRI, 128-slice CT, 4D Ultrasound, Digital X-Ray, 24/7 NABL Lab, 24/7 Pharmacy.
- Appointment Policies: Book up to 14 days in advance. Patients should arrive 20 minutes before slot. Free cancellation up to 1 hour prior. Tell caller details are noted and the OPD desk will contact them to confirm.
- Staff Transfer: If caller asks for a human operator, staff, or front desk, say a polite transfer sentence and append [TRANSFER_STAFF].

VOICE TELEPHONY RULES:
1. Always respond in the language used by the caller: spoken Malayalam (സ്വാഭാവിക മലയാളം), English, or Manglish.
2. BREVITY IS ESSENTIAL: Keep every response to 1 or 2 concise, spoken sentences (maximum 25 words). Never give long lists or bullet points.
3. Be courteous, respectful, and welcoming.
4. Strictly NEVER diagnose illnesses or recommend medications/prescriptions.`;

      const messages = [
        { role: "system", content: systemPrompt },
        ...this.history.slice(-6).map((h) => ({ role: h.role, content: h.content })),
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
          max_tokens: 120,
          stream: true,
        }),
      });

      if (res.ok && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";
        let firstSentence = "";
        let sentenceCount = 0;
        let lastEmittedIndex = 0;

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

                  // Stream sentence detection
                  const candidateSentences = this.splitSentences(fullText.substring(lastEmittedIndex));
                  if (candidateSentences.length > 1) {
                    // We have at least one completed sentence
                    for (let sIdx = 0; sIdx < candidateSentences.length - 1; sIdx++) {
                      const completedSentence = candidateSentences[sIdx].trim();
                      if (completedSentence) {
                        if (sentenceCount === 0) {
                          firstSentence = completedSentence;
                          llmFirstSentenceMs = Date.now();
                        }
                        if (onSentenceChunk) {
                          onSentenceChunk(completedSentence, sentenceCount);
                        }
                        sentenceCount++;
                      }
                    }
                    // Retain the unfinished trailing segment
                    const lastSentence = candidateSentences[candidateSentences.length - 1];
                    lastEmittedIndex = fullText.length - lastSentence.length;
                  }
                }
              } catch {}
            }
          }
        }

        // Emit any remaining trailing text
        const remaining = fullText.substring(lastEmittedIndex).trim();
        if (remaining) {
          if (sentenceCount === 0) {
            firstSentence = remaining;
            llmFirstSentenceMs = Date.now();
          }
          if (onSentenceChunk) {
            onSentenceChunk(remaining, sentenceCount);
          }
          sentenceCount++;
        }

        const llmResponseReadyMs = Date.now();
        const finalFullText = fullText.trim();
        return {
          fullText: finalFullText,
          firstSentence: firstSentence || finalFullText,
          llmStartMs,
          llmFirstTokenMs: llmFirstTokenMs || llmResponseReadyMs,
          llmFirstSentenceMs: llmFirstSentenceMs || llmResponseReadyMs,
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
      llmFirstSentenceMs: fallbackTime,
      llmResponseReadyMs: fallbackTime,
    };
  }

  /**
   * Splits text into natural spoken sentences while protecting abbreviations,
   * single-letter initials (e.g. Dr., ഡോ., K., ആർ.), and numbers from premature splitting.
   */
  public splitSentences(str: string): string[] {
    const isAbbrev = (sub: string) => {
      const lastWord = sub.split(/\s+/).pop() || "";
      const cleanWord = lastWord.replace(/^[(\[]|[)\]]$/g, "");
      if (/^(ഡോ|ഡോക്ടർ|dr|mr|mrs|ms|prof|op|opd|rs|no|st)$/i.test(cleanWord.replace(/\.$/, ""))) return true;
      if (/^[A-Z]\.$/.test(cleanWord)) return true;
      if (/^[\u0D00-\u0D7F]{1,3}\.$/.test(cleanWord)) return true;
      if (/\d+\.\d*$/.test(cleanWord)) return true;
      return false;
    };

    const regex = /([.!?।\n]+)(\s+|$)/gu;
    let match: RegExpExecArray | null;
    let lastIndex = 0;
    const sentences: string[] = [];

    while ((match = regex.exec(str)) !== null) {
      const end = match.index + match[1].length;
      const candidate = str.substring(lastIndex, end).trim();
      if (match[1].includes(".") && isAbbrev(candidate)) {
        continue;
      }
      if (candidate.length >= 6) {
        sentences.push(candidate);
        lastIndex = match.index + match[0].length;
      }
    }

    if (lastIndex < str.length) {
      const rem = str.substring(lastIndex).trim();
      if (rem) sentences.push(rem);
    }

    return sentences;
  }

  public getHistory(): ConversationTurn[] {
    return [...this.history];
  }
}
