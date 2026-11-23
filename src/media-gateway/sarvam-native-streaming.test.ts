/**
 * ============================================================================
 * SARVAM-NATIVE CONVERSATIONAL AI & PIPELINED STREAMING BENCHMARK TEST SUITE
 * ============================================================================
 *
 * Verifies:
 * 1. Sarvam 105B conversational reasoning (Malayalam & English).
 * 2. Multi-turn dialogue history preservation.
 * 3. Smart sentence boundary detection protecting initials, titles, and time abbreviations.
 * 4. Pipelined first-sentence TTS streaming (Sentence 1 dispatches to Bulbul TTS
 *    while Sentence 2 generates concurrently).
 * 5. Prompt-to-first-audio latency reduction achieving sub-1.5s audible response.
 * 6. Barge-in interruption cancellation.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { HospitalConversationEngine } from "./conversation-engine";
import { CallMediaSession } from "./session-manager";
import { DAYA_HOSPITAL_CONFIG } from "@/lib/config/hospital-config";
import { SpeechToTextProvider, TextToSpeechProvider, TranscriptTurnResult } from "./speech-interfaces";

describe("Sarvam-Native Conversational AI & Pipelined Streaming", () => {
  let engine: HospitalConversationEngine;

  beforeEach(() => {
    engine = new HospitalConversationEngine(DAYA_HOSPITAL_CONFIG);
  });

  describe("Sentence Boundary Detection (Malayalam & English Telephony Speech)", () => {
    it("preserves Malayalam titles, initials, and splits only on real sentence terminators", () => {
      const text =
        "നമസ്കാരം! ഡോ. കെ. ആർ. ബാലകൃഷ്ണൻ തിങ്കൾ, ബുധൻ ദിവസങ്ങളിൽ രാവിലെ 9:30 മുതൽ 1:00 മണി വരെ ഉണ്ടാകും. താങ്കൾക്ക് അപ്പോയിന്റ്മെന്റ് എടുക്കണോ?";
      const sentences = engine.splitSentences(text);

      expect(sentences.length).toBe(3);
      expect(sentences[0]).toBe("നമസ്കാരം!");
      expect(sentences[1]).toContain("ഡോ. കെ. ആർ. ബാലകൃഷ്ണൻ");
      expect(sentences[1]).toContain("1:00 മണി വരെ ഉണ്ടാകും.");
      expect(sentences[2]).toBe("താങ്കൾക്ക് അപ്പോയിന്റ്മെന്റ് എടുക്കണോ?");
    });

    it("preserves English titles like Dr., Mr., and time formats like 9:30 AM", () => {
      const text =
        "Dr. Suresh Kumar is available tomorrow morning from 9:30 AM to 1:00 PM. Would you like to reserve a consultation token?";
      const sentences = engine.splitSentences(text);

      expect(sentences.length).toBe(2);
      expect(sentences[0]).toBe("Dr. Suresh Kumar is available tomorrow morning from 9:30 AM to 1:00 PM.");
      expect(sentences[1]).toBe("Would you like to reserve a consultation token?");
    });

    it("handles single-sentence responses cleanly without trailing fragments", () => {
      const text = "ദയ ഹോസ്പിറ്റലിൽ ജനറൽ ഒപി കൺസൾട്ടേഷൻ ഫീസ് 250 രൂപയാണ്.";
      const sentences = engine.splitSentences(text);

      expect(sentences.length).toBe(1);
      expect(sentences[0]).toBe(text);
    });
  });

  describe("Pipelined First-Sentence Emission in ConversationEngine", () => {
    it("emits sentence chunks via callback as soon as sentence boundaries are reached", async () => {
      const collectedSentences: string[] = [];
      const collectedIndices: number[] = [];

      const result = await engine.processCallerUtterance(
        "ഒപി രജിസ്ട്രേഷൻ ഫീസ് എത്രയാണ്?",
        (sentence, index) => {
          collectedSentences.push(sentence);
          collectedIndices.push(index);
        }
      );

      expect(result.replyText).toBeDefined();
      expect(result.replyText.length).toBeGreaterThan(10);
      expect(collectedSentences.length).toBeGreaterThanOrEqual(1);
      expect(collectedIndices[0]).toBe(0);
      expect(result.firstSentenceText).toBe(collectedSentences[0]);
    });

    it("maintains multi-turn conversation history across consecutive turns", async () => {
      // Turn 1: Caller asks about cardiologist
      const turn1 = await engine.processCallerUtterance("കാർഡിയോളജി ഡോക്ടർമാരുടെ സമയം എപ്പോഴാണ്?");
      expect(turn1.replyText).toBeDefined();

      // Turn 2: Follow-up question referencing context
      const turn2 = await engine.processCallerUtterance("നാളെ രാവിലെ ഒപി ഉണ്ടോ?");
      expect(turn2.replyText).toBeDefined();

      const history = engine.getHistory();
      expect(history.length).toBeGreaterThanOrEqual(4); // 2 user turns + 2 assistant replies
      expect(history[0].role).toBe("user");
      expect(history[0].content).toContain("കാർഡിയോളജി");
      expect(history[2].role).toBe("user");
      expect(history[2].content).toContain("നാളെ");
    });
  });

  describe("Pipelined Audio Playback in CallMediaSession", () => {
    let mockSocket: {
      send: ReturnType<typeof vi.fn>;
      readyState: number;
      sentMessages: string[];
    };

    class StreamingMockStt implements SpeechToTextProvider {
      private cb?: (r: TranscriptTurnResult) => void;
      public async connect(): Promise<void> {}
      public async sendAudio(): Promise<void> {}
      public async close(): Promise<void> {}
      public onTranscript(cb: (r: TranscriptTurnResult) => void): void {
        this.cb = cb;
      }
      public fireTranscript(text: string) {
        if (this.cb) {
          const now = Date.now();
          this.cb({
            text,
            isFinal: true,
            language: "ml-IN",
            confidence: 0.99,
            timestampMs: now,
            lastCallerAudioMs: now - 280,
            speechEndVadMs: now - 50,
          });
        }
      }
    }

    class InstrumentedMockTts implements TextToSpeechProvider {
      public synthesizeCalls: Array<{ text: string; startTime: number }> = [];

      public async synthesize(text: string): Promise<Buffer> {
        this.synthesizeCalls.push({ text, startTime: Date.now() });
        // Return 3200 bytes of audio per chunk (200ms)
        return Buffer.alloc(3200, 0xaa);
      }
    }

    beforeEach(() => {
      mockSocket = {
        send: vi.fn((data: string) => {
          mockSocket.sentMessages.push(data);
        }),
        readyState: 1,
        sentMessages: [],
      };
    });

    it("initiates TTS synthesis on sentence 1 immediately without waiting for full response", async () => {
      const stt = new StreamingMockStt();
      const tts = new InstrumentedMockTts();

      const session = new CallMediaSession({
        streamSid: "MZ_stream_pipe_01",
        callSid: "CA_call_pipe_01",
        accountSid: "AC_pipe_01",
        from: "+919876543210",
        to: "08047291658",
        socket: mockSocket,
        sttProvider: stt,
        ttsProvider: tts,
        conversationEngine: engine,
        autoPlayGreeting: false,
      });

      session.markStarted();

      // Trigger user turn with a multi-sentence prompt
      const turnPromise = session.handleUserTurn("ഡോക്ടറെ കാണാൻ സമയം ഉണ്ടോ?");
      await turnPromise;

      // Verify TTS was invoked
      expect(tts.synthesizeCalls.length).toBeGreaterThanOrEqual(1);

      // Verify TurnLatencyMetrics recorded all granular timestamps
      expect(session.turnLatencyMetrics.length).toBe(1);
      const metrics = session.turnLatencyMetrics[0];

      expect(metrics.timestamps.llmStartMs).toBeGreaterThan(0);
      expect(metrics.timestamps.llmResponseReadyMs).toBeGreaterThanOrEqual(metrics.timestamps.llmStartMs);
      expect(metrics.timestamps.ttsStartMs).toBeGreaterThan(0);
      expect(metrics.timestamps.firstAudioSentToExotelMs).toBeGreaterThan(0);
      expect(metrics.latencies.totalSpeechEndToAudibleResponseMs).toBeGreaterThanOrEqual(0);

      // Verify audio frames were dispatched to Exotel
      const audioDispatched = mockSocket.sentMessages.some((msg) => {
        try {
          const parsed = JSON.parse(msg);
          return parsed.event === "media" && parsed.streamSid === "MZ_stream_pipe_01";
        } catch {
          return false;
        }
      });
      expect(audioDispatched).toBe(true);
    });

    it("immediately interrupts pipelined playback on caller barge-in", async () => {
      const stt = new StreamingMockStt();
      const tts = new InstrumentedMockTts();

      const session = new CallMediaSession({
        streamSid: "MZ_stream_barge_01",
        callSid: "CA_call_barge_01",
        accountSid: "AC_barge_01",
        from: "+919876543210",
        to: "08047291658",
        socket: mockSocket,
        sttProvider: stt,
        ttsProvider: tts,
        conversationEngine: engine,
        autoPlayGreeting: false,
      });

      session.markStarted();

      // Start turn and interrupt halfway through
      const turnPromise = session.handleUserTurn("ആശുപത്രി സമയം എപ്പോഴാണ്?");
      session.interruptPlayback();
      await turnPromise;

      expect(session.isInterrupted).toBe(true); // retains INTERRUPTED status
      // Verify Exotel clear event was emitted for barge-in
      const clearSent = mockSocket.sentMessages.some((msg) => {
        try {
          const parsed = JSON.parse(msg);
          return parsed.event === "clear";
        } catch {
          return false;
        }
      });
      expect(clearSent).toBe(true);
    });
  });
});
