/**
 * ============================================================================
 * SMRKOMED AI PROVIDER INTERFACE
 * ============================================================================
 *
 * Pluggable contract for AI Voice & Speech providers (Sarvam AI, ElevenLabs, OpenAI).
 * Defines models, voices, speakers, speech synthesis, and transcription contracts.
 */

export interface ModelCapabilityItem {
  id: string;
  name: string;
  type: "STT" | "LLM" | "TTS";
  description: string;
  supportedLanguages: string[];
  streamingSupported: boolean;
  sampleRates: number[];
  audioFormats: string[];
  isVerified: boolean;
  notes?: string;
}

export interface SpeakerCapabilityItem {
  id: string;
  name: string;
  gender: "FEMALE" | "MALE";
  compatibleTtsModels: string[];
  primaryLanguages: string[];
  supportedLanguages: string[];
  sampleAudioUrl?: string;
  isVerified: boolean;
  isAvailable?: boolean;
  unavailabilityReason?: string;
  description: string;
}

export interface AiCapabilities {
  provider: string;
  sttModels: ModelCapabilityItem[];
  llmModels: ModelCapabilityItem[];
  ttsModels: ModelCapabilityItem[];
  speakers: SpeakerCapabilityItem[];
  supportedLanguages: Array<{ code: string; name: string; nativeName: string }>;
  retrievedAt: string;
  isStale: boolean;
}

export interface SpeechSynthesisParams {
  text: string;
  languageCode: string;
  model: string;
  speaker: string;
  pace?: number;
  sampleRate?: number;
  outputFormat?: "wav" | "mp3" | "linear16";
}

export interface SpeechSynthesisResult {
  success: boolean;
  audioBuffer?: Buffer;
  audioBase64?: string;
  mimeType: string;
  durationSeconds?: number;
  sampleRate: number;
  latencyMs: number;
  error?: string;
}

export interface SpeechTranscriptionParams {
  audioBuffer: Buffer;
  languageCode: string;
  model: string;
  sampleRate?: number;
}

export interface SpeechTranscriptionResult {
  success: boolean;
  transcript: string;
  detectedLanguage?: string;
  confidence?: number;
  latencyMs: number;
  error?: string;
}

export interface IAiProvider {
  readonly providerName: string;

  /**
   * Retrieves available STT, LLM, and TTS models.
   */
  getAvailableModels(): Promise<ModelCapabilityItem[]>;

  /**
   * Retrieves available voice speakers filtered by model and language.
   */
  getAvailableVoices(model?: string, languageCode?: string): Promise<SpeakerCapabilityItem[]>;

  /**
   * Returns list of officially supported Indian languages.
   */
  getSupportedLanguages(): Array<{ code: string; name: string; nativeName: string }>;

  /**
   * Synthesizes text into high-quality speech audio (e.g. for voice preview).
   */
  generateSpeech(params: SpeechSynthesisParams): Promise<SpeechSynthesisResult>;

  /**
   * Transcribes speech audio buffer into text.
   */
  transcribeSpeech(params: SpeechTranscriptionParams): Promise<SpeechTranscriptionResult>;

  /**
   * Returns comprehensive cached capabilities report.
   */
  getCapabilities(forceRefresh?: boolean): Promise<AiCapabilities>;

  /**
   * Validates provider configuration parameters.
   */
  validateConfiguration(config: Record<string, unknown>): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }>;
}
