/**
 * ============================================================================
 * SMRKOMED MEDIA SESSION MANAGER — CONCURRENT CALL STATE & AUDIO ORCHESTRATION
 * ============================================================================
 *
 * Manages active Exotel AgentStream sessions, buffers, DTMF, playback markers,
 * audio queues, Sarvam STT speech streaming, Hospital Conversation Engine,
 * and Sarvam TTS audio synthesis across concurrent hospital telephone calls.
 */

import { EventEmitter } from "events";
import {
  AggregateLatencyStats,
  ExotelMediaChunk,
  ExotelMediaFormat,
  ExotelOutboundClearMessage,
  ExotelOutboundMarkMessage,
  ExotelOutboundMediaMessage,
  SessionState,
  TurnLatencyMetrics,
} from "./types";
import { AudioEngine, AudioPlaybackQueue, defaultAudioEngine } from "./audio-engine";
import { tenantResolver, TenantResolutionResult } from "./tenant-resolver";
import { getHospitalConfig, HospitalConfig } from "@/lib/config/hospital-config";
import { SpeechToTextProvider, TextToSpeechProvider, TranscriptTurnResult } from "./speech-interfaces";
import { SarvamSpeechToTextProvider } from "./sarvam-stt";
import { SarvamTextToSpeechProvider } from "./sarvam-tts";
import { HospitalConversationEngine } from "./conversation-engine";
import { IvrFlowExecutionEngine, StepInputEvent } from "@/lib/services/ivr-flow-engine";
import { ivrFlowService, IvrFlowService } from "@/lib/services/ivr-flow-service";
import { IvrFlowData, FlowExecutionContext, FlowExecutionStepResult } from "@/lib/types/ivr-flow";
import { exotelTelephonyService } from "@/lib/services/exotel-telephony-service";
import { EmergencyDetector } from "@/lib/services/emergency-detector";
import { LanguageDetector } from "@/lib/services/language-detector";

export interface SocketSender {
  send(data: string, cb?: (err?: Error) => void): void;
  readyState: number;
}

export interface CallSessionInitOptions {
  streamSid: string;
  callSid: string;
  accountSid: string;
  from: string;
  to: string;
  customField?: string;
  mediaFormat?: ExotelMediaFormat;
  socket: SocketSender;
  audioEngine?: AudioEngine;
  sttProvider?: SpeechToTextProvider;
  ttsProvider?: TextToSpeechProvider;
  conversationEngine?: HospitalConversationEngine;
  hospitalConfig?: HospitalConfig;
  autoPlayGreeting?: boolean;
  echoMode?: boolean;
  silenceTimeoutMs?: number;
  ttsPace?: number;
  ivrFlow?: IvrFlowData;
  ivrVersion?: number;
  ivrService?: IvrFlowService;
  enableIvrFlow?: boolean;
}

export class CallMediaSession extends EventEmitter {
  public readonly streamSid: string;
  public readonly callSid: string;
  public readonly accountSid: string;
  public readonly fromNumber: string;
  public readonly toNumber: string;
  public readonly customField?: string;
  public readonly mediaFormat: ExotelMediaFormat;
  public readonly tenantResult: TenantResolutionResult;
  public readonly hospitalId: string;
  public readonly hospitalConfig: HospitalConfig;
  public readonly echoMode: boolean;

  public state: SessionState = "INITIALIZING";
  public readonly createdAt: Date = new Date();
  public startedAt?: Date;
  public stoppedAt?: Date;

  public audioChunksReceived = 0;
  public totalIncomingBytes = 0;
  public totalOutgoingBytes = 0;
  public dtmfDigits: string[] = [];
  public acknowledgedMarks: string[] = [];
  public bargeInEvents: Array<{ timestamp: number }> = [];
  public transferAttempt: {
    destinationRedacted: string;
    timestamp: number;
    success: boolean;
    error?: string;
  } | null = null;

  // Phase 2: Live AI Speech & Conversation State
  public sttStatus: "IDLE" | "CONNECTED" | "STREAMING" | "ERROR" = "IDLE";
  public ttsStatus: "IDLE" | "SYNTHESIZING" | "PLAYING" | "INTERRUPTED" = "IDLE";
  public lastCallerTranscript?: string;
  public lastAiResponse?: string;
  public conversationTurns: Array<{ speaker: "caller" | "ai"; text: string; timestampMs: number }> = [];
  public turnLatencyMetrics: TurnLatencyMetrics[] = [];
  private turnCounter = 0;
  private lastCallerAudioReceivedMs = 0;
  private callerSpeechStartMs?: number;

  public readonly sttProvider: SpeechToTextProvider;
  public readonly ttsProvider: TextToSpeechProvider;
  public readonly conversationEngine: HospitalConversationEngine;

  // Phase 4.1: Live IVR Flow Execution State
  public ivrFlow?: IvrFlowData;
  public ivrVersion?: number;
  public ivrContext?: FlowExecutionContext;
  public isExecutingIvrFlow = false;
  public waitingForDtmf = false;
  public expectedDigits = 1;
  public collectedDtmfBuffer = "";
  public lastStepResult?: FlowExecutionStepResult;
  public enableIvrFlow = true;
  public initPromise?: Promise<void>;
  public emergencyTriggered = false;
  public greetingPlayed = false;

  private dtmfTimeoutTimer?: NodeJS.Timeout;
  private isExecutingStep = false;
  private executionSessionId?: string;
  private ivrService: IvrFlowService;

  private socket: SocketSender;
  private audioEngine: AudioEngine;
  private playbackQueue: AudioPlaybackQueue;
  private autoPlayGreeting: boolean;

  constructor(options: CallSessionInitOptions) {
    super();
    this.streamSid = options.streamSid;
    this.callSid = options.callSid;
    this.accountSid = options.accountSid;
    this.fromNumber = options.from;
    this.toNumber = options.to;
    this.customField = options.customField;
    this.socket = options.socket;
    this.audioEngine = options.audioEngine || defaultAudioEngine;
    this.playbackQueue = new AudioPlaybackQueue(options.streamSid);
    this.echoMode =
      options.echoMode ??
      (process.env.MEDIA_GATEWAY_ECHO_MODE === "true" ||
        process.env.EXOTEL_ECHO_MODE === "true");

    this.autoPlayGreeting = options.autoPlayGreeting ?? false;
    this.enableIvrFlow = options.enableIvrFlow ?? Boolean(options.ivrFlow);
    this.ivrService = options.ivrService || ivrFlowService;

    this.mediaFormat = options.mediaFormat || {
      encoding: "audio/x-l16",
      sampleRate: 8000,
      channels: 1,
    };

    // Server-side trusted tenant resolution
    this.tenantResult = tenantResolver.resolveTenant({
      streamSid: options.streamSid,
      callSid: options.callSid,
      accountSid: options.accountSid,
      to: options.to,
      from: options.from,
      customField: options.customField,
    });
    this.hospitalId = this.tenantResult.hospitalId;
    this.hospitalConfig = options.hospitalConfig || getHospitalConfig(this.hospitalId);

    if (options.ivrFlow) {
      this.ivrFlow = options.ivrFlow;
      this.ivrVersion = options.ivrVersion || options.ivrFlow.currentVersion;
      this.isExecutingIvrFlow = true;
      this.ivrContext = IvrFlowExecutionEngine.initializeContext(
        this.ivrFlow,
        this.callSid,
        this.fromNumber,
        this.hospitalId,
        "ml-IN"
      );
    }

    // AI Components Initialization with low-latency VAD (400ms) & brisk Malayalam TTS pace (1.15)
    this.conversationEngine =
      options.conversationEngine || new HospitalConversationEngine(this.hospitalConfig);
    this.sttProvider =
      options.sttProvider ||
      new SarvamSpeechToTextProvider({
        sampleRate: 8000,
        languageCode: "ml-IN",
        silenceTimeoutMs: options.silenceTimeoutMs ?? 400,
      });
    const resolvedAgent = this.tenantResult.assignedAgent;
    this.ttsProvider =
      options.ttsProvider ||
      new SarvamTextToSpeechProvider({
        ttsPace: options.ttsPace ?? resolvedAgent?.speakingPace,
        ttsSpeaker: resolvedAgent?.speaker,
        ttsModel: resolvedAgent?.ttsModel,
      });

    this.setupSpeechListeners();
    this.state = "CONNECTED";
  }

  private setupSpeechListeners(): void {
    this.sttProvider.onTranscript(async (turn: TranscriptTurnResult) => {
      this.lastCallerTranscript = turn.text;
      this.emit("transcript", turn);

      // Continuous background emergency monitoring on every incoming transcript chunk (interim or final)
      if (turn.text && turn.text.trim() && !this.emergencyTriggered) {
        const chunkText = turn.text.trim();
        const emMatch = EmergencyDetector.evaluate(chunkText, 0.70);
        if (emMatch.isEmergency && emMatch.requiresImmediateInterruption) {
          this.emergencyTriggered = true;
          console.warn(`[CallSession ${this.callSid}] [CONTINUOUS EMERGENCY] Detected '${emMatch.matchedPhrase}' (confidence: ${emMatch.confidenceScore.toFixed(2)}). Immediate interruption triggered.`);
          this.interruptPlayback();
          if (this.ivrContext) {
            this.ivrContext.isEmergency = true;
            this.ivrContext.executionPriority = "EMERGENCY";
          }
          ivrFlowService.logEmergencyEvent({
            hospitalId: this.hospitalId,
            callSid: this.callSid,
            flowId: this.ivrFlow?.id || "flow_main",
            flowVersion: this.ivrVersion || 1,
            triggerPhrase: chunkText,
            targetDestination: (this.ivrContext?.variables?.casualtyHotline as string) || "EMERGENCY_TRIAGE",
            callerNumber: this.fromNumber,
          }).catch((err) => console.warn(`[CallSession ${this.callSid}] Failed to log emergency event:`, err));

          if (this.isExecutingIvrFlow) {
            this.executeIvrStep({ type: "EMERGENCY_DETECTED", value: chunkText }).catch(() => {});
          }
        }
      }

      if (turn.isFinal && turn.text.trim()) {
        const text = turn.text.trim();
        this.conversationTurns.push({
          speaker: "caller",
          text,
          timestampMs: turn.timestampMs,
        });

        // 1. Emergency intent check across speech turns (Malayalam, English, and mixed)
        if (!this.emergencyTriggered && IvrFlowExecutionEngine.detectEmergencyIntent(text)) {
          this.emergencyTriggered = true;
          console.log(`[CallSession ${this.callSid}] Emergency keyword detected in caller utterance: "${text}"`);
          this.interruptPlayback();

          ivrFlowService.logEmergencyEvent({
            hospitalId: this.hospitalId,
            callSid: this.callSid,
            flowId: this.ivrFlow?.id || "flow_main",
            flowVersion: this.ivrVersion || 1,
            triggerPhrase: text,
            targetDestination: (this.ivrContext?.variables?.casualtyHotline as string) || "EMERGENCY_TRIAGE",
            callerNumber: this.fromNumber,
          }).catch((err) => console.warn(`[CallSession ${this.callSid}] Failed to log emergency event:`, err));

          if (this.isExecutingIvrFlow) {
            await this.executeIvrStep({ type: "EMERGENCY_DETECTED", value: text });
            return;
          }
        }

        // Automatic Language Detection: adapt to caller speech in real time
        const detected = LanguageDetector.detectLanguage(text, this.ivrContext?.currentLanguage || "en-IN");
        if (detected.isSupported && this.ivrContext) {
          this.ivrContext.currentLanguage = detected.languageCode;
        }

        // 2. If waiting for DTMF, check for spoken digits as accessibility fallback
        if (this.isExecutingIvrFlow && this.waitingForDtmf) {
          const lower = text.toLowerCase();
          let recognizedDigit: string | undefined;
          if (lower.includes("ഒന്ന്") || lower.includes("one") || lower.includes("1")) recognizedDigit = "1";
          else if (lower.includes("രണ്ട്") || lower.includes("two") || lower.includes("2")) recognizedDigit = "2";
          else if (lower.includes("മൂന്ന്") || lower.includes("three") || lower.includes("3")) recognizedDigit = "3";
          else if (lower.includes("നാല്") || lower.includes("four") || lower.includes("4")) recognizedDigit = "4";

          if (recognizedDigit) {
            this.handleDtmf(recognizedDigit);
            return;
          }
        }

        await this.handleUserTurn(text, turn);
      }
    });

    if ("onSpeechStart" in this.sttProvider) {
      (this.sttProvider as unknown as { onSpeechStart: (cb: () => void) => void }).onSpeechStart(
        () => {
          this.callerSpeechStartMs = Date.now();
          if (this.ttsStatus === "PLAYING" || this.playbackQueue.hasPending()) {
            this.interruptPlayback();
          }
        }
      );
    }
  }

  public markStarted(): void {
    this.startedAt = new Date();
    this.state = "STREAMING";
    this.sttStatus = "CONNECTED";

    this.sttProvider.connect().catch((err) => {
      console.warn(`[CallSession ${this.callSid}] STT connect error:`, err);
      this.sttStatus = "ERROR";
    });

    this.emit("started", { streamSid: this.streamSid, callSid: this.callSid });

    if (this.enableIvrFlow) {
      this.initPromise = this.initiateCallSession().catch((err) => {
        console.error(`[CallSession ${this.callSid}] IVR initialization error:`, err);
        if (this.autoPlayGreeting) {
          this.playInitialGreeting().catch(() => {});
        }
      });
    } else if (this.autoPlayGreeting) {
      this.initPromise = this.playInitialGreeting().catch(() => {});
    }
  }

  public async waitForInitialization(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  public get isStopped(): boolean {
    return (this.state as string) === "STOPPED";
  }

  public get isInterrupted(): boolean {
    return (this.ttsStatus as string) === "INTERRUPTED";
  }

  /**
   * Resolves the hospital's published IVR flow and initializes turn-by-turn execution.
   * If no published flow exists for this hospital, safely falls back to direct conversational AI.
   */
  public async initiateCallSession(): Promise<void> {
    if (this.isStopped) return;

    if (!this.ivrFlow) {
      const published = await this.ivrService.getActivePublishedFlow(
        this.hospitalId,
        this.tenantResult.hospitalConfig.telephony.exotel?.defaultAppId
      );

      if (published && published.flow) {
        this.isExecutingIvrFlow = true;
        this.ivrFlow = published.flow;
        this.ivrVersion = published.version.versionNumber;
        this.ivrContext = IvrFlowExecutionEngine.initializeContext(
          published.flow,
          this.callSid,
          this.fromNumber,
          this.hospitalId,
          "ml-IN"
        );
      }
    } else {
      this.isExecutingIvrFlow = true;
      this.ivrVersion = this.ivrVersion || this.ivrFlow.currentVersion;
      this.ivrContext = IvrFlowExecutionEngine.initializeContext(
        this.ivrFlow,
        this.callSid,
        this.fromNumber,
        this.hospitalId,
        "ml-IN"
      );
    }

    if (this.isExecutingIvrFlow && this.ivrFlow && this.ivrContext) {
      console.log(
        `[CallSession ${this.callSid}] Locked to published IVR flow '${this.ivrFlow.name}' (v${this.ivrVersion}) for tenant '${this.hospitalId}'.`
      );
      await this.executeIvrStep({ type: "START_CALL" });
    } else {
      this.isExecutingIvrFlow = false;
      console.log(
        `[CallSession ${this.callSid}] No published IVR flow found for tenant '${this.hospitalId}'. Executing direct AI conversation fallback.`
      );
      if (this.autoPlayGreeting) {
        await this.playInitialGreeting();
      }
    }
  }

  /**
   * Executes a step in the active IVR flow graph.
   */
  public async executeIvrStep(input: StepInputEvent): Promise<FlowExecutionStepResult | null> {
    if (!this.ivrFlow || !this.ivrContext || this.isStopped) return null;

    if (this.isExecutingStep) {
      await new Promise((r) => setTimeout(r, 60));
    }
    this.isExecutingStep = true;

    try {
      const stepResult = IvrFlowExecutionEngine.executeStep(
        this.ivrFlow,
        this.ivrContext,
        input,
        new Date()
      );

      this.lastStepResult = stepResult;
      this.emit("ivrStep", {
        callSid: this.callSid,
        action: stepResult.action,
        nodeId: this.ivrContext.currentNodeId,
        logMessage: stepResult.logMessage,
      });

      this.persistExecutionState(stepResult).catch(() => {});
      await this.processIvrAction(stepResult);
      return stepResult;
    } catch (err) {
      console.error(`[CallSession ${this.callSid}] IVR step execution error:`, err);
      return null;
    } finally {
      this.isExecutingStep = false;
    }
  }

  /**
   * Processes the telephony action returned by the IVR execution engine.
   */
  public async processIvrAction(stepResult: FlowExecutionStepResult): Promise<void> {
    if (this.isStopped) return;

    switch (stepResult.action) {
      case "PLAY_AUDIO": {
        this.waitingForDtmf = false;
        if (stepResult.audioText) {
          this.greetingPlayed = true;
          this.conversationTurns.push({
            speaker: "ai",
            text: stepResult.audioText,
            timestampMs: Date.now(),
          });
          const lang = stepResult.audioLanguage || this.ivrContext?.currentLanguage || "ml-IN";
          const voiceId = stepResult.ttsSpeaker || (lang === "en-IN" ? "ratan" : "kavitha");
          this.ttsStatus = "SYNTHESIZING";
          try {
            const pcm = await this.ttsProvider.synthesize(stepResult.audioText, {
              language: lang,
              voiceId,
            });
            if (pcm && pcm.length > 0 && !this.isStopped) {
              await this.streamPcmAudio(pcm);
            }
          } catch (err) {
            console.warn(`[CallSession ${this.callSid}] Audio synthesis error:`, err);
          } finally {
            this.ttsStatus = "IDLE";
          }
        }

        // Auto-advance if nextNodeId exists and current node is not terminal
        if (stepResult.nextNodeId && !stepResult.isTerminal && !this.isStopped) {
          await this.executeIvrStep({ type: "START_CALL" });
        }
        break;
      }

      case "COLLECT_DTMF": {
        if (stepResult.dtmfPrompt) {
          this.conversationTurns.push({
            speaker: "ai",
            text: stepResult.dtmfPrompt,
            timestampMs: Date.now(),
          });
          const lang = this.ivrContext?.currentLanguage || "ml-IN";
          const voiceId = lang === "en-IN" ? "ratan" : "kavitha";
          this.ttsStatus = "SYNTHESIZING";
          try {
            const pcm = await this.ttsProvider.synthesize(stepResult.dtmfPrompt, {
              language: lang,
              voiceId,
            });
            if (pcm && pcm.length > 0 && !this.isStopped) {
              await this.streamPcmAudio(pcm);
            }
          } catch (err) {
            console.warn(`[CallSession ${this.callSid}] DTMF prompt synthesis error:`, err);
          } finally {
            this.ttsStatus = "IDLE";
          }
        }

        if (this.isStopped) return;

        this.waitingForDtmf = true;
        this.expectedDigits = stepResult.dtmfExpectedDigits || 1;
        this.collectedDtmfBuffer = "";

        if (this.dtmfTimeoutTimer) {
          clearTimeout(this.dtmfTimeoutTimer);
        }

        this.dtmfTimeoutTimer = setTimeout(async () => {
          if (this.waitingForDtmf && !this.isStopped) {
            console.log(`[CallSession ${this.callSid}] DTMF input timeout triggered.`);
            this.waitingForDtmf = false;
            await this.executeIvrStep({ type: "TIMEOUT" });
          }
        }, 7000);
        break;
      }

      case "STREAM_AI_AGENT": {
        this.waitingForDtmf = false;
        if (this.dtmfTimeoutTimer) {
          clearTimeout(this.dtmfTimeoutTimer);
          this.dtmfTimeoutTimer = undefined;
        }

        console.log(
          `[CallSession ${this.callSid}] Entering AI Voice Agent node '${stepResult.aiAgentConfig?.agentName || "Hospital AI Receptionist"}'`
        );
        break;
      }

      case "TRANSFER_CALL": {
        this.waitingForDtmf = false;
        if (this.dtmfTimeoutTimer) {
          clearTimeout(this.dtmfTimeoutTimer);
          this.dtmfTimeoutTimer = undefined;
        }

        const destination =
          stepResult.transferDestination ||
          this.hospitalConfig.telephony.incomingHospitalNumber ||
          "";

        if (stepResult.audioText) {
          this.conversationTurns.push({
            speaker: "ai",
            text: stepResult.audioText,
            timestampMs: Date.now(),
          });
          const lang = this.ivrContext?.currentLanguage || "ml-IN";
          try {
            const pcm = await this.ttsProvider.synthesize(stepResult.audioText, {
              language: lang,
              voiceId: lang === "en-IN" ? "ratan" : "kavitha",
            });
            if (pcm && pcm.length > 0 && !this.isStopped) {
              await this.streamPcmAudio(pcm);
            }
          } catch {}
        }

        console.log(
          `[CallSession ${this.callSid}] Initiating call transfer to ${destination} via ExotelTelephonyService`
        );

        try {
          const res = await exotelTelephonyService.transferCall(
            this.callSid,
            destination,
            this.hospitalId
          );
          this.transferAttempt = {
            destinationRedacted: this.maskPhoneNumber(destination),
            timestamp: Date.now(),
            success: res.success,
            error: res.error,
          };
          if (!res.success) {
            console.warn(
              `[CallSession ${this.callSid}] Exotel transfer failed: ${res.error}. Routing to fallback.`
            );
            await this.executeIvrStep({ type: "TRANSFER_FAILED", value: res.error || "Transfer failed" });
          } else {
            this.state = "STOPPED";
          }
        } catch (err) {
          console.error(`[CallSession ${this.callSid}] Exotel transfer exception:`, err);
          await this.executeIvrStep({ type: "TRANSFER_FAILED", value: "Transfer exception" });
        }
        break;
      }

      case "EMERGENCY_ESCALATE": {
        this.waitingForDtmf = false;
        if (this.dtmfTimeoutTimer) {
          clearTimeout(this.dtmfTimeoutTimer);
          this.dtmfTimeoutTimer = undefined;
        }

        this.interruptPlayback();

        const emConfig = await this.ivrService.getEmergencyRoutingConfig(this.hospitalId);
        const casualtyDestination =
          (emConfig?.isVerified && emConfig?.casualtyNumber) ||
          stepResult.transferDestination ||
          this.hospitalConfig.routing.casualtyDirectNumber ||
          "";

        const isTransferAllowed = Boolean(
          emConfig?.allowLiveTransfer &&
          emConfig?.isVerified &&
          casualtyDestination &&
          process.env.HOSPITAL_DESTINATIONS_CONFIRMED === "true"
        );

        console.log(
          `[CallSession ${this.callSid}] [EMERGENCY PROTOCOL] Fast-tracking call to Casualty (destination: ${casualtyDestination || "NONE"}, allowLiveTransfer: ${isTransferAllowed})`
        );

        if (stepResult.audioText) {
          this.conversationTurns.push({
            speaker: "ai",
            text: stepResult.audioText,
            timestampMs: Date.now(),
          });
          const lang = this.ivrContext?.currentLanguage || "ml-IN";
          const cap = LanguageDetector.getCapability(lang);
          try {
            const pcm = await this.ttsProvider.synthesize(stepResult.audioText, {
              language: cap.code,
              voiceId: cap.ttsVoice,
            });
            if (pcm && pcm.length > 0 && !this.isStopped) {
              await this.streamPcmAudio(pcm);
            }
          } catch {}
        }

        if (!isTransferAllowed) {
          console.warn(
            `[CallSession ${this.callSid}] Emergency auto-transfer is DISABLED for hospital '${this.hospitalId}' (unconfirmed destination). Entering safe guidance fallback.`
          );
          const lang = this.ivrContext?.currentLanguage || "ml-IN";
          const fallbackMsg =
            lang === "en-IN"
              ? "This has been identified as an urgent medical emergency. Since automated telephone transfer is currently disabled pending hospital destination confirmation, please proceed immediately to the nearest hospital casualty or dial emergency services at 108 or 112."
              : "ഇതൊരു അടിയന്തിര സാഹചര്യമാണെന്ന് മനസ്സിലാക്കുന്നു. അടിയന്തിര ഫോൺ ട്രാൻസ്ഫർ നിലവിൽ ലഭ്യമാക്കിയിട്ടില്ലാത്തതിനാൽ ദയവായി തൊട്ടടുത്ത ആശുപത്രി കാഷ്വാലിറ്റിയിൽ നേരിട്ടെത്തുകയോ 108 അല്ലെങ്കിൽ 112 ലേക്ക് ഉടൻ വിളിക്കുകയോ ചെയ്യുക.";
          const cap = LanguageDetector.getCapability(lang);
          try {
            const pcm = await this.ttsProvider.synthesize(fallbackMsg, {
              language: cap.code,
              voiceId: cap.ttsVoice,
            });
            if (pcm && pcm.length > 0 && !this.isStopped) {
              await this.streamPcmAudio(pcm);
            }
          } catch {}

          this.transferAttempt = {
            destinationRedacted: casualtyDestination ? this.maskPhoneNumber(casualtyDestination) : "[UNCONFIRMED_DESTINATION]",
            timestamp: Date.now(),
            success: false,
            error: "Emergency auto-transfer disabled pending authorized destination confirmation",
          };

          await this.ivrService.logEmergencyEvent({
            hospitalId: this.hospitalId,
            callSid: this.callSid,
            flowId: this.ivrFlow?.id || "flow_main",
            flowVersion: this.ivrVersion || 1,
            triggerPhrase: stepResult.audioText || "Emergency protocol triggered",
            targetDestination: "SAFE_FALLBACK_UNCONFIRMED",
            callerNumber: this.fromNumber,
          }).catch(() => {});

          break;
        }

        try {
          const res = await exotelTelephonyService.transferCall(
            this.callSid,
            casualtyDestination,
            this.hospitalId
          );
          this.transferAttempt = {
            destinationRedacted: this.maskPhoneNumber(casualtyDestination),
            timestamp: Date.now(),
            success: res.success,
            error: res.error,
          };
          if (!res.success) {
            const lang = this.ivrContext?.currentLanguage || "ml-IN";
            const fallbackMsg =
              lang === "en-IN"
                ? `Emergency transfer failed. Please call our 24/7 Casualty desk directly at ${casualtyDestination}.`
                : `കാഷ്വാലിറ്റിയിലേക്ക് ബന്ധിപ്പിക്കാൻ സാധിച്ചില്ല. ദയവായി ഈ നമ്പറിലേക്ക് നേരിട്ട് വിളിക്കുക: ${casualtyDestination}.`;
            const cap = LanguageDetector.getCapability(lang);
            const pcm = await this.ttsProvider.synthesize(fallbackMsg, {
              language: cap.code,
              voiceId: cap.ttsVoice,
            });
            if (pcm && pcm.length > 0 && !this.isStopped) {
              await this.streamPcmAudio(pcm);
            }
          }
        } catch {
          // Fallback instructions
        }
        break;
      }

      case "HANGUP": {
        this.waitingForDtmf = false;
        if (this.dtmfTimeoutTimer) {
          clearTimeout(this.dtmfTimeoutTimer);
          this.dtmfTimeoutTimer = undefined;
        }

        if (stepResult.audioText) {
          this.conversationTurns.push({
            speaker: "ai",
            text: stepResult.audioText,
            timestampMs: Date.now(),
          });
          const lang = this.ivrContext?.currentLanguage || "ml-IN";
          try {
            const pcm = await this.ttsProvider.synthesize(stepResult.audioText, {
              language: lang,
              voiceId: lang === "en-IN" ? "ratan" : "kavitha",
            });
            if (pcm && pcm.length > 0 && !this.isStopped) {
              await this.streamPcmAudio(pcm);
            }
          } catch {}
        }

        this.close();
        break;
      }
    }
  }

  private async persistExecutionState(stepResult?: FlowExecutionStepResult, finalStatus?: string): Promise<void> {
    if (!this.ivrFlow || !this.ivrContext) return;
    try {
      this.executionSessionId = await this.ivrService.persistExecutionSession({
        sessionId: this.executionSessionId,
        flowId: this.ivrFlow.id,
        versionNumber: this.ivrVersion || this.ivrFlow.currentVersion,
        callSid: this.callSid,
        callerNumber: this.fromNumber,
        hospitalId: this.hospitalId,
        currentNodeId: this.ivrContext.currentNodeId,
        variables: this.ivrContext.variables,
        status: finalStatus || (this.isStopped ? "COMPLETED" : "ACTIVE"),
        executionLog: this.ivrContext.history,
      });
    } catch {
      // Non-blocking
    }
  }

  /**
   * Plays the initial hospital welcome greeting to the caller.
   */
  public async playInitialGreeting(): Promise<void> {
    if (this.isStopped || this.greetingPlayed) return;
    this.greetingPlayed = true;

    const initialLang = this.ivrContext?.currentLanguage || "en-IN";
    const greeting = this.conversationEngine.getInitialGreeting(initialLang);
    this.lastAiResponse = greeting;
    this.ttsStatus = "SYNTHESIZING";

    this.conversationTurns.push({
      speaker: "ai",
      text: greeting,
      timestampMs: Date.now(),
    });

    try {
      const cap = LanguageDetector.getCapability(initialLang);
      const pcm = await this.ttsProvider.synthesize(greeting, {
        language: cap.code,
        voiceId: cap.ttsVoice,
      });

      if (pcm && pcm.length > 0 && !this.isStopped) {
        await this.streamPcmAudio(pcm);
      } else {
        this.ttsStatus = "IDLE";
      }
    } catch (err) {
      console.warn(`[CallSession ${this.callSid}] Greeting synthesis error:`, err);
      this.ttsStatus = "IDLE";
    }
  }

  /**
   * Processes caller's transcribed utterance, queries Conversation Engine, and speaks response.
   * Records precise turn-by-turn latency metrics across STT VAD, LLM generation, and TTS synthesis.
   */
  public async handleUserTurn(text: string, turnInfo?: TranscriptTurnResult): Promise<void> {
    if (this.isStopped) return;

    this.turnCounter++;
    const turnId = this.turnCounter;
    const finalTranscriptMs = turnInfo?.timestampMs || Date.now();
    const lastCallerAudioMs =
      turnInfo?.lastCallerAudioMs || this.lastCallerAudioReceivedMs || finalTranscriptMs - 400;
    const speechEndVadMs =
      turnInfo?.speechEndVadMs || (this.lastCallerAudioReceivedMs ? this.lastCallerAudioReceivedMs + 400 : finalTranscriptMs);

    this.ttsStatus = "SYNTHESIZING";
    const llmStartMs = Date.now();
    let llmFirstTokenMs: number | undefined;

    const result = await this.conversationEngine.processCallerUtterance(text, () => {
      if (!llmFirstTokenMs) {
        llmFirstTokenMs = Date.now();
      }
    });

    if (this.isExecutingIvrFlow && result.shouldTransfer) {
      console.log(
        `[CallSession ${this.callSid}] AI conversation requested staff handoff (intent=${result.intent}). Routing to IVR handoff.`
      );
      await this.executeIvrStep({ type: "AI_HANDOFF", value: text });
      return;
    }

    llmFirstTokenMs = result.llmTimestamps?.llmFirstTokenMs || llmFirstTokenMs || Date.now();
    const llmResponseReadyMs = result.llmTimestamps?.llmResponseReadyMs || Date.now();

    this.lastAiResponse = result.replyText;

    this.conversationTurns.push({
      speaker: "ai",
      text: result.replyText,
      timestampMs: Date.now(),
    });

    this.emit("aiResponse", {
      streamSid: this.streamSid,
      text: result.replyText,
      intent: result.intent,
      shouldTransfer: result.shouldTransfer,
      transferDestination: result.transferDestination,
    });

    const ttsStartMs = Date.now();
    let ttsFirstAudioMs = 0;
    let firstAudioSentToExotelMs = 0;
    let lastAudioSentToExotelMs = 0;

    try {
      const lang = this.ivrContext?.currentLanguage || "en-IN";
      const cap = LanguageDetector.getCapability(lang);
      const pcmAudio = await this.ttsProvider.synthesize(result.replyText, {
        language: cap.code,
        voiceId: cap.ttsVoice,
      });

      ttsFirstAudioMs = Date.now();

      if (pcmAudio && pcmAudio.length > 0 && !this.isStopped) {
        await this.streamPcmAudio(pcmAudio, () => {
          if (!firstAudioSentToExotelMs) {
            firstAudioSentToExotelMs = Date.now();
          }
        });
        lastAudioSentToExotelMs = Date.now();
      } else {
        this.ttsStatus = "IDLE";
      }
    } catch (err) {
      console.warn(`[CallSession ${this.callSid}] Response synthesis error:`, err);
      this.ttsStatus = "IDLE";
    }

    const speechEndToTranscriptMs = Math.max(0, finalTranscriptMs - speechEndVadMs);
    const transcriptToLlmFirstTokenMs = Math.max(0, (llmFirstTokenMs || llmResponseReadyMs) - finalTranscriptMs);
    const llmFirstTokenToTtsAudioMs = Math.max(0, (ttsFirstAudioMs || Date.now()) - (llmFirstTokenMs || llmStartMs));
    const ttsFirstAudioDurationMs = Math.max(0, (ttsFirstAudioMs || Date.now()) - ttsStartMs);
    const totalSpeechEndToAudibleResponseMs = firstAudioSentToExotelMs > 0
      ? Math.max(0, firstAudioSentToExotelMs - speechEndVadMs)
      : Math.max(0, (ttsFirstAudioMs || Date.now()) - speechEndVadMs);

    const turnMetrics: TurnLatencyMetrics = {
      turnId,
      callSid: this.callSid,
      streamSid: this.streamSid,
      callerTranscript: text,
      aiResponseText: result.replyText,
      timestamps: {
        lastCallerAudioMs,
        speechEndVadMs,
        finalTranscriptMs,
        llmStartMs,
        llmFirstTokenMs,
        llmResponseReadyMs,
        ttsStartMs,
        ttsFirstAudioMs: ttsFirstAudioMs || ttsStartMs,
        firstAudioSentToExotelMs: firstAudioSentToExotelMs || ttsFirstAudioMs || ttsStartMs,
        lastAudioSentToExotelMs: lastAudioSentToExotelMs || firstAudioSentToExotelMs || ttsFirstAudioMs,
      },
      latencies: {
        speechEndToTranscriptMs,
        transcriptToLlmFirstTokenMs,
        llmFirstTokenToTtsAudioMs,
        ttsFirstAudioMs: ttsFirstAudioDurationMs,
        totalSpeechEndToAudibleResponseMs,
      },
      timestamp: new Date().toISOString(),
    };

    this.turnLatencyMetrics.push(turnMetrics);
    mediaSessionManager.recordTurnMetrics(turnMetrics);

    console.log(
      `[CallSession ${this.callSid}] Turn ${turnId} Latency Breakdown: Total=${totalSpeechEndToAudibleResponseMs}ms ` +
      `(VAD->STT: ${speechEndToTranscriptMs}ms, STT->LLM: ${transcriptToLlmFirstTokenMs}ms, ` +
      `LLM->TTS: ${llmFirstTokenToTtsAudioMs}ms, TTS: ${ttsFirstAudioDurationMs}ms) | ` +
      `Caller: "${text}" -> AI: "${result.replyText.substring(0, 40)}..."`
    );
  }

  /**
   * Streams a PCM audio buffer to Exotel in compliant chunks (3200 bytes, multiples of 320).
   */
  public async streamPcmAudio(pcmBuffer: Buffer, onFirstChunkSent?: () => void): Promise<void> {
    this.ttsStatus = "PLAYING";
    this.playbackQueue.resetInterruption();

    const chunks = this.audioEngine.splitIntoExotelChunks(pcmBuffer, 3200);

    for (let i = 0; i < chunks.length; i++) {
      if (this.isStopped || this.isInterrupted) {
        break;
      }
      this.sendOutboundAudio(chunks[i]);
      if (i === 0 && onFirstChunkSent) {
        onFirstChunkSent();
      }
      // Progressive pacing for 200ms audio chunks
      await new Promise((r) => setTimeout(r, 180));
    }

    if (this.ttsStatus === "PLAYING") {
      this.ttsStatus = "IDLE";
    }
  }

  /**
   * Processes incoming audio chunk from Exotel.
   * Decodes Base64 into PCM, checks VAD for barge-in, and streams to Sarvam STT.
   */
  public handleIncomingMedia(chunk: ExotelMediaChunk): Buffer {
    const pcm = this.audioEngine.decodeBase64Audio(chunk.payload);
    this.audioChunksReceived++;
    this.totalIncomingBytes += pcm.length;
    this.lastCallerAudioReceivedMs = Date.now();

    // Diagnostic Echo Mode: if enabled, immediately reflect audio back to caller
    if (this.echoMode) {
      this.sendOutboundAudio(pcm);
    }

    // Immediate caller barge-in detection: if caller speaks while bot is playing audio
    if (this.ttsStatus === "PLAYING" || this.playbackQueue.hasPending()) {
      const rms = this.calculateRms(pcm);
      if (rms > 400) {
        this.interruptPlayback();
      }
    }

    // Stream PCM to Sarvam STT
    if (this.sttProvider) {
      this.sttStatus = "STREAMING";
      this.sttProvider.sendAudio(pcm).catch(() => {});
    }

    this.emit("media", {
      streamSid: this.streamSid,
      pcm,
      timestamp: chunk.timestamp,
      sequence: this.audioChunksReceived,
    });

    return pcm;
  }

  /**
   * Sends synthesized PCM audio back to Exotel to be heard by the caller.
   * Includes both stream_sid (Exotel standard) and streamSid for maximum compatibility.
   */
  public sendOutboundAudio(pcmChunk: Buffer): boolean {
    if (this.state === "STOPPED" || this.socket.readyState !== 1) {
      return false;
    }

    // Align chunk to 320-byte boundary
    const alignedPcm = this.audioEngine.alignPcmToFrame(pcmChunk, 320);
    const base64Payload = this.audioEngine.encodeBase64Audio(alignedPcm);

    const msg: ExotelOutboundMediaMessage = {
      event: "media",
      streamSid: this.streamSid,
      stream_sid: this.streamSid,
      media: {
        payload: base64Payload,
      },
    };

    try {
      this.socket.send(JSON.stringify(msg));
      this.totalOutgoingBytes += alignedPcm.length;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Sends a marker event to Exotel to track when a phrase finishes playing.
   */
  public sendMark(name: string): void {
    if (this.socket.readyState !== 1) return;

    const msg: ExotelOutboundMarkMessage = {
      event: "mark",
      streamSid: this.streamSid,
      stream_sid: this.streamSid,
      mark: { name },
    };

    try {
      this.socket.send(JSON.stringify(msg));
    } catch {
      // Ignored if socket is closing
    }
  }

  /**
   * Immediately interrupts/flushes Exotel's playback buffer (caller barge-in).
   */
  public interruptPlayback(): void {
    this.bargeInEvents.push({ timestamp: Date.now() });
    this.playbackQueue.clear();
    this.ttsStatus = "INTERRUPTED";
    this.state = "INTERRUPTED";

    if (this.socket.readyState === 1) {
      const clearMsg: ExotelOutboundClearMessage = {
        event: "clear",
        streamSid: this.streamSid,
        stream_sid: this.streamSid,
      };
      try {
        this.socket.send(JSON.stringify(clearMsg));
      } catch {
        // Ignored
      }
    }

    this.emit("interrupted", { streamSid: this.streamSid });
    this.state = "STREAMING";
  }

  public handleDtmf(digit: string): void {
    this.dtmfDigits.push(digit);
    this.emit("dtmf", { streamSid: this.streamSid, digit });

    if (this.isExecutingIvrFlow && this.waitingForDtmf) {
      if (this.dtmfTimeoutTimer) {
        clearTimeout(this.dtmfTimeoutTimer);
        this.dtmfTimeoutTimer = undefined;
      }

      if (this.expectedDigits > 1) {
        this.collectedDtmfBuffer += digit;
        if (digit === "#" || this.collectedDtmfBuffer.length >= this.expectedDigits) {
          const finalDigits = this.collectedDtmfBuffer.replace(/#/g, "");
          this.collectedDtmfBuffer = "";
          this.waitingForDtmf = false;
          this.executeIvrStep({ type: "DTMF_DIGITS", value: finalDigits }).catch((err) => {
            console.error(`[CallSession ${this.callSid}] DTMF digits processing error:`, err);
          });
        }
      } else {
        this.waitingForDtmf = false;
        this.executeIvrStep({ type: "DTMF_KEY", value: digit }).catch((err) => {
          console.error(`[CallSession ${this.callSid}] DTMF key processing error:`, err);
        });
      }
    }
  }

  public handleMark(name: string): void {
    this.acknowledgedMarks.push(name);
    this.emit("mark", { streamSid: this.streamSid, name });
  }

  public close(): void {
    if (this.dtmfTimeoutTimer) {
      clearTimeout(this.dtmfTimeoutTimer);
      this.dtmfTimeoutTimer = undefined;
    }
    this.waitingForDtmf = false;
    this.state = "STOPPED";
    this.stoppedAt = new Date();
    this.ttsStatus = "IDLE";
    this.sttStatus = "IDLE";
    this.playbackQueue.clear();

    if (this.isExecutingIvrFlow && this.ivrContext) {
      this.persistExecutionState(undefined, "COMPLETED").catch(() => {});
    }

    if (this.sttProvider) {
      this.sttProvider.close().catch(() => {});
    }

    this.emit("stopped", {
      streamSid: this.streamSid,
      callSid: this.callSid,
      durationMs: this.startedAt ? Date.now() - this.startedAt.getTime() : 0,
      totalIncomingBytes: this.totalIncomingBytes,
      totalOutgoingBytes: this.totalOutgoingBytes,
    });
  }

  private calculateRms(buffer: Buffer): number {
    const sampleCount = Math.floor(buffer.length / 2);
    if (sampleCount === 0) return 0;
    let sumSquares = 0;
    for (let i = 0; i < sampleCount; i++) {
      const s = buffer.readInt16LE(i * 2);
      sumSquares += s * s;
    }
    return Math.sqrt(sumSquares / sampleCount);
  }

  public getSummary() {
    return {
      streamSid: this.streamSid,
      callSid: this.callSid,
      hospitalId: this.hospitalId,
      fromNumber: this.fromNumber,
      toNumber: this.toNumber,
      state: this.state,
      echoMode: this.echoMode,
      durationSeconds: this.startedAt
        ? Math.round((Date.now() - this.startedAt.getTime()) / 1000)
        : 0,
      incomingBytes: this.totalIncomingBytes,
      outgoingBytes: this.totalOutgoingBytes,
      chunksReceived: this.audioChunksReceived,
      dtmfCount: this.dtmfDigits.length,
      detectedLanguage: this.ivrContext?.currentLanguage || "ml-IN",
      sttStatus: this.sttStatus,
      ttsStatus: this.ttsStatus,
      lastCallerTranscript: this.lastCallerTranscript || null,
      lastAiResponse: this.lastAiResponse || null,
      turnCount: this.conversationTurns.length,
      recentTurnMetrics: this.turnLatencyMetrics.slice(-5),
      lastTurnLatencyMs:
        this.turnLatencyMetrics[this.turnLatencyMetrics.length - 1]?.latencies
          .totalSpeechEndToAudibleResponseMs ?? null,
      ivrRuntime: {
        isExecutingIvrFlow: this.isExecutingIvrFlow,
        flowId: this.ivrFlow?.id || null,
        flowName: this.ivrFlow?.name || null,
        flowVersion: this.ivrVersion || null,
        currentNodeId: this.ivrContext?.currentNodeId || null,
        isEmergency: this.ivrContext?.isEmergency || false,
        language: this.ivrContext?.currentLanguage || "ml-IN",
      },
    };
  }

  /**
   * Produces a sanitized, redacted evidence record for controlled test calls.
   * Strips raw PHI while capturing exact node sequences, latency, and provider outcomes.
   */
  public getRedactedEvidenceRecord(): RedactedCallEvidenceRecord {
    const executedNodeSequence = this.ivrContext
      ? this.ivrContext.history.map((h) => h.nodeId)
      : [];

    return {
      testTimestamp: (this.startedAt || new Date()).toISOString(),
      callSidRedacted: this.maskCallSid(this.callSid),
      correlationId: `corr_${this.streamSid.slice(-8)}_${this.callSid.slice(-6)}`,
      tenantId: this.hospitalId,
      resolvedExoPhone: this.toNumber,
      callerNumberRedacted: this.maskPhoneNumber(this.fromNumber),
      publishedFlowId: this.ivrFlow?.id || null,
      publishedFlowVersion: this.ivrVersion || null,
      executedNodeSequence,
      dtmfEvents: this.dtmfDigits.map((d, i) => ({ digit: d, index: i + 1 })),
      sarvamMetrics: {
        turnCount: this.turnLatencyMetrics.length,
        averageSpeechEndToResponseMs:
          this.turnLatencyMetrics.length > 0
            ? Math.round(
                this.turnLatencyMetrics.reduce(
                  (acc, t) => acc + t.latencies.totalSpeechEndToAudibleResponseMs,
                  0
                ) / this.turnLatencyMetrics.length
              )
            : null,
        lastTurnLatencyMs:
          this.turnLatencyMetrics[this.turnLatencyMetrics.length - 1]?.latencies
            .totalSpeechEndToAudibleResponseMs ?? null,
        sttStatus: this.sttStatus,
        ttsStatus: this.ttsStatus,
      },
      bargeInCount: this.bargeInEvents.length,
      transferAttempt: this.transferAttempt,
      callTerminationStatus: this.state,
      persistenceStatus: this.ivrService.getPersistenceHealth().status,
    };
  }

  private maskCallSid(sid: string): string {
    if (!sid) return "UNKNOWN";
    if (sid.length <= 8) return sid;
    return `${sid.slice(0, 4)}...${sid.slice(-4)}`;
  }

  private maskPhoneNumber(num: string): string {
    if (!num) return "UNKNOWN";
    const cleaned = num.replace(/\s+/g, "");
    if (cleaned.length <= 5) return "***";
    return `${cleaned.slice(0, 3)}****${cleaned.slice(-2)}`;
  }
}

export interface RedactedCallEvidenceRecord {
  testTimestamp: string;
  callSidRedacted: string;
  correlationId: string;
  tenantId: string;
  resolvedExoPhone: string;
  callerNumberRedacted: string;
  publishedFlowId: string | null;
  publishedFlowVersion: number | null;
  executedNodeSequence: string[];
  dtmfEvents: Array<{ digit: string; index: number }>;
  sarvamMetrics: {
    turnCount: number;
    averageSpeechEndToResponseMs: number | null;
    lastTurnLatencyMs: number | null;
    sttStatus: string;
    ttsStatus: string;
  };
  bargeInCount: number;
  transferAttempt: { destinationRedacted: string; success: boolean; error?: string } | null;
  callTerminationStatus: string;
  persistenceStatus: "HEALTHY" | "DEGRADED";
}

export interface CompletedSessionSummary {
  streamSid: string;
  callSid: string;
  hospitalId: string;
  fromNumber: string;
  toNumber: string;
  state: string;
  echoMode: boolean;
  durationSeconds: number;
  incomingBytes: number;
  outgoingBytes: number;
  chunksReceived: number;
  turnCount: number;
  lastCallerTranscript: string | null;
  lastAiResponse: string | null;
  startedAt: string;
  stoppedAt: string;
  timestamp: string;
  averageTurnLatencyMs?: number | null;
  turnLatencyMetrics?: TurnLatencyMetrics[];
  evidenceRecord?: RedactedCallEvidenceRecord;
  ivrRuntime?: {
    isExecutingIvrFlow: boolean;
    flowId: string | null;
    flowName: string | null;
    flowVersion: number | null;
    currentNodeId: string | null;
    isEmergency: boolean;
    language: string;
  };
}

export class MediaSessionManager extends EventEmitter {
  private sessionsByStream: Map<string, CallMediaSession> = new Map();
  private sessionsByCall: Map<string, CallMediaSession> = new Map();
  private completedSessions: CompletedSessionSummary[] = [];
  private recentTurnMetrics: TurnLatencyMetrics[] = [];

  public recordTurnMetrics(metrics: TurnLatencyMetrics): void {
    this.recentTurnMetrics.push(metrics);
    if (this.recentTurnMetrics.length > 50) {
      this.recentTurnMetrics.shift();
    }
  }

  public getRecentTurnMetrics(limit = 20): TurnLatencyMetrics[] {
    return this.recentTurnMetrics.slice(-limit);
  }

  public getAggregateLatencyStats(): AggregateLatencyStats {
    const turns = this.recentTurnMetrics;
    if (turns.length === 0) {
      return {
        totalTurns: 0,
        medianTotalLatencyMs: 0,
        p95TotalLatencyMs: 0,
        medianSttLatencyMs: 0,
        medianLlmLatencyMs: 0,
        medianTtsLatencyMs: 0,
      };
    }

    const totals = turns
      .map((t) => t.latencies.totalSpeechEndToAudibleResponseMs)
      .sort((a, b) => a - b);
    const stts = turns
      .map((t) => t.latencies.speechEndToTranscriptMs)
      .sort((a, b) => a - b);
    const llms = turns
      .map((t) => t.latencies.transcriptToLlmFirstTokenMs)
      .sort((a, b) => a - b);
    const ttss = turns
      .map((t) => t.latencies.ttsFirstAudioMs)
      .sort((a, b) => a - b);

    const median = (arr: number[]) => arr[Math.floor(arr.length / 2)] || 0;
    const p95 = (arr: number[]) =>
      arr[Math.floor(arr.length * 0.95)] || arr[arr.length - 1] || 0;

    return {
      totalTurns: turns.length,
      medianTotalLatencyMs: median(totals),
      p95TotalLatencyMs: p95(totals),
      medianSttLatencyMs: median(stts),
      medianLlmLatencyMs: median(llms),
      medianTtsLatencyMs: median(ttss),
    };
  }

  public registerSession(session: CallMediaSession): void {
    this.sessionsByStream.set(session.streamSid, session);
    this.sessionsByCall.set(session.callSid, session);

    session.on("stopped", () => {
      this.sessionsByStream.delete(session.streamSid);
      this.sessionsByCall.delete(session.callSid);

      const summary = session.getSummary();
      const turnMetrics = session.turnLatencyMetrics;
      const averageTurnLatencyMs =
        turnMetrics.length > 0
          ? Math.round(
              turnMetrics.reduce(
                (acc, t) => acc + t.latencies.totalSpeechEndToAudibleResponseMs,
                0
              ) / turnMetrics.length
            )
          : null;

      this.completedSessions.push({
        ...summary,
        startedAt: session.startedAt?.toISOString() || new Date().toISOString(),
        stoppedAt: session.stoppedAt?.toISOString() || new Date().toISOString(),
        timestamp: new Date().toISOString(),
        averageTurnLatencyMs,
        turnLatencyMetrics: session.turnLatencyMetrics,
        evidenceRecord: session.getRedactedEvidenceRecord(),
      });
      if (this.completedSessions.length > 30) {
        this.completedSessions.shift();
      }

      this.emit("sessionClosed", session);
    });

    this.emit("sessionCreated", session);
  }

  public getSessionByStream(streamSid: string): CallMediaSession | undefined {
    return this.sessionsByStream.get(streamSid);
  }

  public getSessionByCallSid(callSid: string): CallMediaSession | undefined {
    return this.sessionsByCall.get(callSid);
  }

  public getActiveSessionCount(): number {
    return this.sessionsByStream.size;
  }

  public getAllActiveSessions(): CallMediaSession[] {
    return Array.from(this.sessionsByStream.values());
  }

  public getRecentCompletedSessions(): CompletedSessionSummary[] {
    return [...this.completedSessions];
  }

  public closeAll(): void {
    for (const session of this.sessionsByStream.values()) {
      session.close();
    }
    this.sessionsByStream.clear();
    this.sessionsByCall.clear();
  }
}

export const mediaSessionManager = new MediaSessionManager();
