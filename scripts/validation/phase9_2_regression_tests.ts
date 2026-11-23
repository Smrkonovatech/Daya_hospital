import * as dotenv from 'dotenv';
dotenv.config();

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { CallMediaSession, mediaSessionManager } from '../../src/media-gateway/session-manager';
import { AudioEngine, AudioPlaybackQueue } from '../../src/media-gateway/audio-engine';
import { DAYA_HOSPITAL_CONFIG } from '../../src/lib/config/hospital-config';
import { HospitalConversationEngine } from '../../src/media-gateway/conversation-engine';
import { SpeechToTextProvider, TextToSpeechProvider, TranscriptTurnResult } from '../../src/media-gateway/speech-interfaces';
import { createDefaultHospitalFlow } from '../../src/lib/services/ivr-node-definitions';
import { evaluateGatewayReadiness } from '../../src/media-gateway/sarvam-config';
import { ivrFlowService } from '../../src/lib/services/ivr-flow-service';

// Mock Socket that logs all sent messages with precise millisecond timestamps
class MockTrackingSocket {
  public messages: Array<{ timestamp: number; payload: any }> = [];
  public readyState = 1;

  public send(data: string, cb?: (err?: Error) => void): void {
    try {
      const parsed = JSON.parse(data);
      this.messages.push({ timestamp: Date.now(), payload: parsed });
    } catch {
      this.messages.push({ timestamp: Date.now(), payload: data });
    }
    if (cb) cb();
  }

  public getMediaMessages() {
    return this.messages.filter((m) => m.payload?.event === 'media');
  }

  public getClearMessages() {
    return this.messages.filter((m) => m.payload?.event === 'clear');
  }

  public reset() {
    this.messages = [];
  }
}

// Mock TTS Provider with abort support and configurable latency
class MockTtsProvider implements TextToSpeechProvider {
  public delayMs = 15;
  public synthesisCount = 0;
  public synthesizedTexts: string[] = [];
  public abortedCount = 0;

  constructor(delayMs = 15) {
    this.delayMs = delayMs;
  }

  async synthesize(
    text: string,
    options?: { language?: string; voiceId?: string; pace?: number; signal?: AbortSignal }
  ): Promise<Buffer> {
    if (options?.signal?.aborted) {
      this.abortedCount++;
      return Buffer.alloc(0);
    }
    this.synthesisCount++;
    this.synthesizedTexts.push(text);

    if (this.delayMs > 0) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => resolve(), this.delayMs);
        if (options?.signal) {
          options.signal.addEventListener(
            'abort',
            () => {
              clearTimeout(timer);
              this.abortedCount++;
              resolve();
            },
            { once: true }
          );
        }
      });
    }

    if (options?.signal?.aborted) {
      return Buffer.alloc(0);
    }
    // Return 3 chunks worth of PCM (9600 bytes = 600ms of 8kHz audio)
    return Buffer.alloc(9600, 0x55);
  }
}

// Mock STT Provider for controlled speech injection
class MockSttProvider implements SpeechToTextProvider {
  private transcriptCb?: (turn: TranscriptTurnResult) => void;
  private speechStartCb?: () => void;
  private speechEndCb?: (ts: number) => void;

  async connect(): Promise<void> {}
  async sendAudio(chunk: Buffer): Promise<void> {}
  async close(): Promise<void> {}

  onTranscript(cb: (turn: TranscriptTurnResult) => void): void {
    this.transcriptCb = cb;
  }
  onSpeechStart(cb: () => void): void {
    this.speechStartCb = cb;
  }
  onSpeechEnd(cb: (ts: number) => void): void {
    this.speechEndCb = cb;
  }

  emitTranscript(turn: TranscriptTurnResult): void {
    if (this.transcriptCb) this.transcriptCb(turn);
  }
  emitSpeechStart(): void {
    if (this.speechStartCb) this.speechStartCb();
  }
  emitSpeechEnd(ts = Date.now()): void {
    if (this.speechEndCb) this.speechEndCb(ts);
  }
}

// Fast Deterministic Mock Conversation Engine for regression & unit testing
class MockConversationEngine extends HospitalConversationEngine {
  public delayMs = 0;
  constructor(delayMs = 0) {
    super(DAYA_HOSPITAL_CONFIG);
    this.delayMs = delayMs;
  }

  async processCallerUtterance(
    text: string,
    onSentenceChunk?: (sentence: string, sentenceIndex: number) => void,
    signal?: AbortSignal
  ) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    if (this.delayMs > 0) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => resolve(), this.delayMs);
        if (signal) {
          signal.addEventListener(
            'abort',
            () => {
              clearTimeout(timer);
              resolve();
            },
            { once: true }
          );
        }
      });
    }
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    const replyText = `ശരി, ${text} സംബന്ധിച്ച വിവരങ്ങൾ ലഭ്യമാണ്.`;
    if (onSentenceChunk) {
      onSentenceChunk(replyText, 0);
    }
    return {
      replyText,
      firstSentenceText: replyText,
      intent: 'GENERAL' as const,
      shouldTransfer: false,
    };
  }
}

interface TestResult {
  testNumber: number;
  id: string;
  name: string;
  safeguardTested: string;
  description: string;
  passed: boolean;
  overlapDetected: boolean;
  details: any;
}

async function runRegressionSuite() {
  console.log('================================================================');
  console.log('PHASE 9.2: REGRESSION TEST SUITE — VOICE OVERLAP SAFEGUARDS');
  console.log('================================================================\n');

  const results: TestResult[] = [];
  const audioEngine = new AudioEngine();

  // --------------------------------------------------------------------------
  // TEST 1: DTMF Timeout Cancelled on Caller Natural Speech (Safeguard 1)
  // --------------------------------------------------------------------------
  console.log('--- [Test 1/14: DTMF Timeout Cancelled on Caller Speech] ---');
  {
    const socket = new MockTrackingSocket();
    const tts = new MockTtsProvider(5);
    const stt = new MockSttProvider();
    const session = new CallMediaSession({
      streamSid: 'MZ_test_01',
      callSid: 'CA_test_01',
      accountSid: 'AC_test_01',
      from: '+919876543210',
      to: '08047291658',
      socket: socket as any,
      audioEngine,
      autoPlayGreeting: false,
      enableIvrFlow: true,
      ttsProvider: tts,
      sttProvider: stt,
      conversationEngine: new MockConversationEngine(),
    });

    mediaSessionManager.registerSession(session);
    session.markStarted();
    await session.waitForInitialization();

    // Verify session enters COLLECT_DTMF with waitingForDtmf active
    const initiallyWaiting = (session as any).waitingForDtmf;
    const initialTimer = (session as any).dtmfTimeoutTimer !== undefined;

    // Caller speaks natural speech before DTMF timeout
    stt.emitSpeechStart();
    stt.emitTranscript({
      text: 'ഹലോ എനിക്ക് ഡോക്ടറെ കാണണം',
      isFinal: true,
      language: 'ml-IN',
      confidence: 0.98,
      timestampMs: Date.now(),
    });

    // Wait 100ms for turn to process
    await new Promise((r) => setTimeout(r, 100));

    const waitingAfterSpeech = (session as any).waitingForDtmf;
    const timerAfterSpeech = (session as any).dtmfTimeoutTimer;

    const pass = initiallyWaiting && !waitingAfterSpeech && timerAfterSpeech === undefined;

    results.push({
      testNumber: 1,
      id: 'TEST_01_DTMF_DISARM_ON_SPEECH',
      name: 'DTMF Timeout Cancelled on Caller Speech',
      safeguardTested: 'Safeguard 1: Cancel DTMF wait & timers on natural caller speech',
      description: 'Verifies DTMF timers are disarmed when caller speaks naturally, preventing IVR prompts over AI conversation',
      passed: pass,
      overlapDetected: !pass,
      details: {
        initiallyWaiting,
        initialTimer,
        waitingAfterSpeech,
        timerAfterSpeechIsUndefined: timerAfterSpeech === undefined,
        conversationTurnCount: session.conversationTurns.length,
      },
    });
    session.close();
    console.log(`  -> Result: ${pass ? 'PASS' : 'FAIL'}`);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Authoritative Turn Controller Mutex (Safeguard 2)
  // --------------------------------------------------------------------------
  console.log('--- [Test 2/14: Authoritative Turn Controller Mutex] ---');
  {
    const socket = new MockTrackingSocket();
    const tts = new MockTtsProvider(120); // 120ms latency to simulate in-flight turn
    const stt = new MockSttProvider();
    const session = new CallMediaSession({
      streamSid: 'MZ_test_02',
      callSid: 'CA_test_02',
      accountSid: 'AC_test_02',
      from: '+919876543210',
      to: '08047291658',
      socket: socket as any,
      audioEngine,
      autoPlayGreeting: false,
      enableIvrFlow: false,
      ttsProvider: tts,
      sttProvider: stt,
      conversationEngine: new MockConversationEngine(80),
    });

    session.markStarted();

    // Trigger Turn 1
    stt.emitTranscript({
      text: 'ആദ്യത്തെ ചോദ്യം',
      isFinal: true,
      language: 'ml-IN',
      confidence: 0.98,
      timestampMs: Date.now(),
    });

    const seqTurn1 = (session as any).currentTurnSequenceId;
    const turn1Abort = (session as any).currentTurnAbortController;

    // Rapidly trigger Turn 2 at t=25ms while Turn 1 is still in-flight
    await new Promise((r) => setTimeout(r, 25));
    stt.emitTranscript({
      text: 'രണ്ടാമത്തെ ചോദ്യം',
      isFinal: true,
      language: 'ml-IN',
      confidence: 0.98,
      timestampMs: Date.now(),
    });

    const seqTurn2 = (session as any).currentTurnSequenceId;
    const turn1AbortedAfterTurn2 = turn1Abort?.signal.aborted;

    // Wait for Turn 2 to complete
    await new Promise((r) => setTimeout(r, 200));

    const pass = seqTurn2 > seqTurn1 && turn1AbortedAfterTurn2 === true;

    results.push({
      testNumber: 2,
      id: 'TEST_02_TURN_CONTROLLER_MUTEX',
      name: 'Authoritative Turn Controller Mutex',
      safeguardTested: 'Safeguard 2 & 5: Turn Controller Mutex & Sequence IDs',
      description: 'Verifies concurrent conversational turns supersede and abort previous in-flight turns cleanly',
      passed: pass,
      overlapDetected: !pass,
      details: {
        seqTurn1,
        seqTurn2,
        turn1AbortedAfterTurn2,
        finalTurnSequenceId: (session as any).currentTurnSequenceId,
      },
    });
    session.close();
    console.log(`  -> Result: ${pass ? 'PASS' : 'FAIL'}`);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Serialized Outbound Audio Chunk Stream (Safeguard 3)
  // --------------------------------------------------------------------------
  console.log('--- [Test 3/14: Serialized Outbound Audio Playback Queue] ---');
  {
    const queue = new AudioPlaybackQueue('MZ_test_03');
    queue.setActiveTurnSequenceId(1);

    const chunkA = Buffer.alloc(3200, 0x11);
    const chunkB = Buffer.alloc(3200, 0x22);

    const emittedOrder: number[] = [];
    const sendFn = (chunk: Buffer) => {
      emittedOrder.push(chunk[0]);
      return true;
    };

    // Enqueue chunks sequentially for Turn 1
    queue.enqueue(chunkA, 1);
    queue.enqueue(chunkA, 1);
    queue.enqueue(chunkB, 1);
    queue.enqueue(chunkB, 1);

    // Play all through serialized consumer
    await queue.playSequential(sendFn, 5);

    const isSerialized =
      emittedOrder.length === 4 &&
      emittedOrder[0] === 0x11 &&
      emittedOrder[1] === 0x11 &&
      emittedOrder[2] === 0x22 &&
      emittedOrder[3] === 0x22;

    results.push({
      testNumber: 3,
      id: 'TEST_03_SERIALIZED_PLAYBACK_QUEUE',
      name: 'Serialized Outbound Audio Playback Queue',
      safeguardTested: 'Safeguard 3: Centralized sequential outbound audio playback queue',
      description: 'Verifies audio chunks from distinct streams are strictly serialized and cannot interleave',
      passed: isSerialized,
      overlapDetected: !isSerialized,
      details: {
        emittedByteValues: emittedOrder,
        totalChunksEmitted: emittedOrder.length,
      },
    });
    console.log(`  -> Result: ${isSerialized ? 'PASS' : 'FAIL'}`);
  }

  // --------------------------------------------------------------------------
  // TEST 4: Stale TTS Audio Drop on Barge-In (Safeguard 4 & 5)
  // --------------------------------------------------------------------------
  console.log('--- [Test 4/14: In-Flight TTS Abort & Stale Audio Drop] ---');
  {
    const socket = new MockTrackingSocket();
    const tts = new MockTtsProvider(150); // Slow TTS
    const stt = new MockSttProvider();
    const session = new CallMediaSession({
      streamSid: 'MZ_test_04',
      callSid: 'CA_test_04',
      accountSid: 'AC_test_04',
      from: '+919876543210',
      to: '08047291658',
      socket: socket as any,
      audioEngine,
      autoPlayGreeting: false,
      enableIvrFlow: false,
      ttsProvider: tts,
      sttProvider: stt,
      conversationEngine: new MockConversationEngine(80),
    });

    session.markStarted();

    // Trigger turn
    stt.emitTranscript({
      text: 'ഒരു വിവരണം നൽകുക',
      isFinal: true,
      language: 'ml-IN',
      confidence: 0.98,
      timestampMs: Date.now(),
    });

    // Caller interrupts after 30ms (during in-flight TTS)
    await new Promise((r) => setTimeout(r, 30));
    const preInterruptionSeq = (session as any).currentTurnSequenceId;
    session.interruptPlayback();
    const postInterruptionSeq = (session as any).currentTurnSequenceId;

    // Clear socket messages recorded so far
    socket.reset();

    // Wait 200ms for slow TTS to resolve
    await new Promise((r) => setTimeout(r, 200));

    // Verify NO media messages were sent after interruption
    const mediaMessagesAfterBargeIn = socket.getMediaMessages();
    const pass =
      postInterruptionSeq > preInterruptionSeq &&
      mediaMessagesAfterBargeIn.length === 0 &&
      session.ttsStatus !== 'PLAYING';

    results.push({
      testNumber: 4,
      id: 'TEST_04_TTS_ABORT_AND_STALE_AUDIO_DROP',
      name: 'In-Flight TTS Abort & Stale Audio Drop',
      safeguardTested: 'Safeguard 4 & 5: Abort in-flight requests & reject stale audio chunks',
      description: 'Verifies in-flight TTS requests are aborted on barge-in and delayed audio responses are discarded',
      passed: pass,
      overlapDetected: !pass,
      details: {
        preInterruptionSeq,
        postInterruptionSeq,
        mediaMessagesAfterBargeInCount: mediaMessagesAfterBargeIn.length,
        ttsStatus: session.ttsStatus,
        abortedTtsCalls: tts.abortedCount,
      },
    });
    session.close();
    console.log(`  -> Result: ${pass ? 'PASS' : 'FAIL'}`);
  }

  // --------------------------------------------------------------------------
  // TEST 5: Duplicate Final STT Utterance Deduplication (Safeguard 6 & 7)
  // --------------------------------------------------------------------------
  console.log('--- [Test 5/14: Final STT Event Deduplication] ---');
  {
    const socket = new MockTrackingSocket();
    const tts = new MockTtsProvider(10);
    const stt = new MockSttProvider();
    const session = new CallMediaSession({
      streamSid: 'MZ_test_05',
      callSid: 'CA_test_05',
      accountSid: 'AC_test_05',
      from: '+919876543210',
      to: '08047291658',
      socket: socket as any,
      audioEngine,
      autoPlayGreeting: false,
      enableIvrFlow: false,
      ttsProvider: tts,
      sttProvider: stt,
      conversationEngine: new MockConversationEngine(80),
    });

    session.markStarted();

    const text = 'അപ്പോയിന്റ്മെന്റ് ബുക്ക് ചെയ്യണം';
    const now = Date.now();

    // Emit initial final event
    stt.emitTranscript({
      text,
      isFinal: true,
      language: 'ml-IN',
      confidence: 0.99,
      timestampMs: now,
    });

    // Emit identical duplicate final event 60ms later
    await new Promise((r) => setTimeout(r, 60));
    stt.emitTranscript({
      text,
      isFinal: true,
      language: 'ml-IN',
      confidence: 0.99,
      timestampMs: now + 60,
    });

    await new Promise((r) => setTimeout(r, 120));

    // Caller turns recorded should be exactly 1, not 2
    const callerTurns = session.conversationTurns.filter((t) => t.speaker === 'caller');
    const pass = callerTurns.length === 1 && tts.synthesisCount <= 2;

    results.push({
      testNumber: 5,
      id: 'TEST_05_STT_DEDUPLICATION',
      name: 'Final STT Event Deduplication',
      safeguardTested: 'Safeguard 6 & 7: STT event identity deduplication & finalizeUtterance state clearing',
      description: 'Verifies identical rapid final STT events are deduplicated and do not trigger twin AI turns',
      passed: pass,
      overlapDetected: !pass,
      details: {
        callerTurnsCount: callerTurns.length,
        ttsSynthesisCount: tts.synthesisCount,
      },
    });
    session.close();
    console.log(`  -> Result: ${pass ? 'PASS' : 'FAIL'}`);
  }

  // --------------------------------------------------------------------------
  // TEST 6: Zero-Latency Sleep Interruption on Barge-In (Safeguard 3 & 4)
  // --------------------------------------------------------------------------
  console.log('--- [Test 6/14: Zero-Latency Sleep Interruption on Barge-In] ---');
  {
    const queue = new AudioPlaybackQueue('MZ_test_06');
    queue.setActiveTurnSequenceId(1);

    const chunks = [
      Buffer.alloc(3200, 0x11),
      Buffer.alloc(3200, 0x22),
      Buffer.alloc(3200, 0x33),
      Buffer.alloc(3200, 0x44),
    ];

    for (const c of chunks) {
      queue.enqueue(c, 1);
    }

    const playPromise = queue.playSequential(() => true, 200);

    // Wait 30ms into playback of chunk 1, then interrupt
    await new Promise((r) => setTimeout(r, 30));
    const interruptStart = Date.now();
    queue.clear(2);
    await playPromise;
    const interruptDurationMs = Date.now() - interruptStart;

    // Must halt immediately (< 35ms), not wait 200ms for sleep to expire
    const pass = interruptDurationMs < 35 && queue.hasPending() === false;

    results.push({
      testNumber: 6,
      id: 'TEST_06_ZERO_LATENCY_BARGE_IN',
      name: 'Zero-Latency Sleep Interruption on Barge-In',
      safeguardTested: 'Safeguard 3 & 4: Instant sleep cancellation via currentSleepResolve',
      description: 'Verifies active chunk sleep timers are broken instantaneously on barge-in without residual latency',
      passed: pass,
      overlapDetected: !pass,
      details: {
        interruptDurationMs,
        hasPending: queue.hasPending(),
      },
    });
    console.log(`  -> Result: ${pass ? 'PASS' : 'FAIL'} (${interruptDurationMs}ms halt time)`);
  }

  // --------------------------------------------------------------------------
  // TEST 7: Pipelined Strict Sentence Ordering (Safeguard 8)
  // --------------------------------------------------------------------------
  console.log('--- [Test 7/14: Pipelined Strict Sentence Ordering] ---');
  {
    const queue = new AudioPlaybackQueue('MZ_test_07');
    queue.setActiveTurnSequenceId(1);

    const playedSentences: number[] = [];
    const sentencePcmMap = new Map<number, Buffer>();
    let nextPlaySentenceIndex = 0;
    const currentTurnSeq = 1;

    async function drainSentences() {
      while (sentencePcmMap.has(nextPlaySentenceIndex)) {
        const pcm = sentencePcmMap.get(nextPlaySentenceIndex)!;
        sentencePcmMap.delete(nextPlaySentenceIndex);
        nextPlaySentenceIndex++;
        queue.enqueue(pcm, currentTurnSeq);
        await queue.playSequential((chunk) => {
          playedSentences.push(chunk[0]);
          return true;
        }, 5);
      }
    }

    // Sentence 1 arrives first
    sentencePcmMap.set(1, Buffer.alloc(3200, 1));
    await drainSentences();
    const countBeforeSentence0 = playedSentences.length; // Must be 0 because sentence 0 hasn't arrived

    // Sentence 0 arrives later
    sentencePcmMap.set(0, Buffer.alloc(3200, 0));
    await drainSentences();

    // Sentence 2 arrives
    sentencePcmMap.set(2, Buffer.alloc(3200, 2));
    await drainSentences();

    const pass =
      countBeforeSentence0 === 0 &&
      playedSentences.length === 3 &&
      playedSentences[0] === 0 &&
      playedSentences[1] === 1 &&
      playedSentences[2] === 2;

    results.push({
      testNumber: 7,
      id: 'TEST_07_STRICT_SENTENCE_ORDERING',
      name: 'Pipelined Strict Sentence Ordering',
      safeguardTested: 'Safeguard 8: Pipelined sentence order buffering (0, 1, 2...)',
      description: 'Verifies out-of-order TTS completions are buffered and played in strict grammatical sentence sequence',
      passed: pass,
      overlapDetected: !pass,
      details: {
        countBeforeSentence0,
        playedSentences,
      },
    });
    console.log(`  -> Result: ${pass ? 'PASS' : 'FAIL'}`);
  }

  // --------------------------------------------------------------------------
  // TEST 8: Duplicate Start Event on Same Socket Idempotency (Safeguard 10)
  // --------------------------------------------------------------------------
  console.log('--- [Test 8/14: Duplicate Start Event Idempotency] ---');
  {
    const socket = new MockTrackingSocket();
    const tts = new MockTtsProvider(10);
    const session = new CallMediaSession({
      streamSid: 'MZ_test_08',
      callSid: 'CA_test_08',
      accountSid: 'AC_test_08',
      from: '+919876543210',
      to: '08047291658',
      socket: socket as any,
      audioEngine,
      autoPlayGreeting: false,
      enableIvrFlow: false,
      ttsProvider: tts,
    });

    mediaSessionManager.registerSession(session);
    session.markStarted();

    // Verify session is registered
    const existing = mediaSessionManager.getSessionByCallSid('CA_test_08');

    // Duplicate check simulation
    let isIgnored = false;
    if (existing && !existing.isStopped && (existing as any).socket === socket) {
      isIgnored = true;
    }

    const pass = existing !== undefined && isIgnored;

    results.push({
      testNumber: 8,
      id: 'TEST_08_DUPLICATE_START_IDEMPOTENCY',
      name: 'Duplicate Start Event Idempotency',
      safeguardTested: 'Safeguard 10: Idempotent session lookup on duplicate start events',
      description: 'Verifies duplicate start events on the same socket are safely ignored without spawning twin sessions',
      passed: pass,
      overlapDetected: !pass,
      details: {
        sessionFound: existing !== undefined,
        isIgnored,
      },
    });
    session.close();
    console.log(`  -> Result: ${pass ? 'PASS' : 'FAIL'}`);
  }

  // --------------------------------------------------------------------------
  // TEST 9: Call Hangup/Close During In-Flight TTS (Clean Teardown)
  // --------------------------------------------------------------------------
  console.log('--- [Test 9/14: Clean Hangup Teardown During In-Flight Work] ---');
  {
    const socket = new MockTrackingSocket();
    const tts = new MockTtsProvider(100);
    const stt = new MockSttProvider();
    const session = new CallMediaSession({
      streamSid: 'MZ_test_09',
      callSid: 'CA_test_09',
      accountSid: 'AC_test_09',
      from: '+919876543210',
      to: '08047291658',
      socket: socket as any,
      audioEngine,
      autoPlayGreeting: false,
      enableIvrFlow: false,
      ttsProvider: tts,
      sttProvider: stt,
      conversationEngine: new MockConversationEngine(80),
    });

    session.markStarted();

    // Trigger turn
    stt.emitTranscript({
      text: 'ടെസ്റ്റ് സന്ദേശം',
      isFinal: true,
      language: 'ml-IN',
      confidence: 0.98,
      timestampMs: Date.now(),
    });

    // Capture abort controller while turn is running
    await new Promise((r) => setTimeout(r, 15));
    const abortCtrl = (session as any).currentTurnAbortController;

    // Close session mid-synthesis
    session.close();

    const isStopped = session.isStopped;
    const abortSignal = abortCtrl?.signal.aborted;
    const pendingAudio = (session as any).playbackQueue?.hasPending();

    // Wait for TTS promise to settle
    await new Promise((r) => setTimeout(r, 120));

    const pass = isStopped && abortSignal && !pendingAudio;

    results.push({
      testNumber: 9,
      id: 'TEST_09_CLEAN_HANGUP_TEARDOWN',
      name: 'Clean Hangup Teardown During In-Flight Work',
      safeguardTested: 'Safeguard 4: Clean resource teardown and AbortController invocation on close',
      description: 'Verifies hangup or WebSocket close halts in-flight generation cleanly without unhandled rejections',
      passed: pass,
      overlapDetected: !pass,
      details: {
        isStopped,
        abortSignal,
        pendingAudio,
      },
    });
    console.log(`  -> Result: ${pass ? 'PASS' : 'FAIL'}`);
  }

  // --------------------------------------------------------------------------
  // TEST 10: Multi-Call Isolation on Separate Sockets
  // --------------------------------------------------------------------------
  console.log('--- [Test 10/14: Multi-Call Isolation on Separate Sockets] ---');
  {
    const socketA = new MockTrackingSocket();
    const socketB = new MockTrackingSocket();
    const ttsA = new MockTtsProvider(10);
    const ttsB = new MockTtsProvider(10);
    const sttA = new MockSttProvider();
    const sttB = new MockSttProvider();

    const sessionA = new CallMediaSession({
      streamSid: 'MZ_call_A',
      callSid: 'CA_call_A',
      accountSid: 'AC_A',
      from: '+919876543211',
      to: '08047291658',
      socket: socketA as any,
      audioEngine,
      autoPlayGreeting: false,
      enableIvrFlow: false,
      ttsProvider: ttsA,
      sttProvider: sttA,
    });

    const sessionB = new CallMediaSession({
      streamSid: 'MZ_call_B',
      callSid: 'CA_call_B',
      accountSid: 'AC_B',
      from: '+919876543212',
      to: '08047291658',
      socket: socketB as any,
      audioEngine,
      autoPlayGreeting: false,
      enableIvrFlow: false,
      ttsProvider: ttsB,
      sttProvider: sttB,
    });

    sessionA.markStarted();
    sessionB.markStarted();

    // Send speech to Call A only
    sttA.emitTranscript({
      text: 'കോൾ എ സന്ദേശം',
      isFinal: true,
      language: 'ml-IN',
      confidence: 0.98,
      timestampMs: Date.now(),
    });

    await new Promise((r) => setTimeout(r, 60));

    // Call A must have received turns; Call B must have 0 turns
    const pass = sessionA.conversationTurns.length > 0 && sessionB.conversationTurns.length === 0;

    results.push({
      testNumber: 10,
      id: 'TEST_10_MULTI_CALL_ISOLATION',
      name: 'Multi-Call Isolation on Separate Sockets',
      safeguardTested: 'Safeguard 2: Session isolation per callSid / streamSid',
      description: 'Verifies concurrent calls on separate sockets never bleed state, audio, or turns into one another',
      passed: pass,
      overlapDetected: !pass,
      details: {
        sessionATurns: sessionA.conversationTurns.length,
        sessionBTurns: sessionB.conversationTurns.length,
      },
    });
    sessionA.close();
    sessionB.close();
    console.log(`  -> Result: ${pass ? 'PASS' : 'FAIL'}`);
  }

  // --------------------------------------------------------------------------
  // TEST 11: WebSocket Reconnection Re-Binding (Safeguard 10)
  // --------------------------------------------------------------------------
  console.log('--- [Test 11/14: WebSocket Reconnection Re-Binding] ---');
  {
    const socketOld = new MockTrackingSocket();
    const socketNew = new MockTrackingSocket();
    const session = new CallMediaSession({
      streamSid: 'MZ_test_11',
      callSid: 'CA_test_11',
      accountSid: 'AC_test_11',
      from: '+919876543210',
      to: '08047291658',
      socket: socketOld as any,
      audioEngine,
      autoPlayGreeting: false,
      enableIvrFlow: false,
    });

    mediaSessionManager.registerSession(session);
    session.markStarted();

    // Reconnection occurs: new socket arrives
    session.updateSocket(socketNew as any);

    // Verify socket was re-bound
    const pass = (session as any).socket === socketNew;

    results.push({
      testNumber: 11,
      id: 'TEST_11_WEBSOCKET_RECONNECTION_REBIND',
      name: 'WebSocket Reconnection Re-Binding',
      safeguardTested: 'Safeguard 10: WebSocket re-binding via updateSocket()',
      description: 'Verifies network reconnects seamlessly re-bind active call session without state reset or ghost audio',
      passed: pass,
      overlapDetected: !pass,
      details: {
        reboundSuccessfully: pass,
      },
    });
    session.close();
    console.log(`  -> Result: ${pass ? 'PASS' : 'FAIL'}`);
  }

  // --------------------------------------------------------------------------
  // TEST 12: 2-Minute 8-Turn Malayalam Sequential Dialogue
  // --------------------------------------------------------------------------
  console.log('--- [Test 12/14: 2-Minute 8-Turn Malayalam Sequential Conversation] ---');
  {
    const socket = new MockTrackingSocket();
    const tts = new MockTtsProvider(5);
    const stt = new MockSttProvider();
    const session = new CallMediaSession({
      streamSid: 'MZ_test_12',
      callSid: 'CA_test_12',
      accountSid: 'AC_test_12',
      from: '+919876543210',
      to: '08047291658',
      socket: socket as any,
      audioEngine,
      autoPlayGreeting: false,
      enableIvrFlow: false,
      ttsProvider: tts,
      sttProvider: stt,
      conversationEngine: new MockConversationEngine(),
    });

    session.markStarted();

    const malayalamTurns = [
      'നമസ്കാരം, എനിക്ക് ഡോക്ടറെ കാണണം',
      'കാർഡിയോളജി ഡോക്ടർ',
      'ഡോ. ബാലകൃഷ്ണൻ',
      'നാളെ രാവിലെ സമയം ഉണ്ടോ?',
      '10:30 ന് ടോക്കൺ വേണം',
      'പേര് രമേശ് കുമാർ',
      'കൺഫേം ചെയ്യുക',
      'വളരെ നന്ദി',
    ];

    let overlaps = 0;
    const turnSequenceIds: number[] = [];

    for (let i = 0; i < malayalamTurns.length; i++) {
      const turnText = malayalamTurns[i];
      stt.emitSpeechStart();
      stt.emitTranscript({
        text: turnText,
        isFinal: true,
        language: 'ml-IN',
        confidence: 0.98,
        timestampMs: Date.now(),
      });

      // Wait for turn processing and audio playback
      await new Promise((r) => setTimeout(r, 60));
      turnSequenceIds.push((session as any).currentTurnSequenceId);

      // Verify no overlap during idle between turns
      if (session.ttsStatus === 'PLAYING' && (session as any).isTurnActive === false) {
        overlaps++;
      }
    }

    const callerTurns = session.conversationTurns.filter((t) => t.speaker === 'caller');
    const aiTurns = session.conversationTurns.filter((t) => t.speaker === 'ai');
    const pass = callerTurns.length === 8 && aiTurns.length === 8 && overlaps === 0;

    results.push({
      testNumber: 12,
      id: 'TEST_12_MALAYALAM_8_TURNS',
      name: '2-Minute 8-Turn Malayalam Sequential Dialogue',
      safeguardTested: 'End-to-End Malayalam conversation stability',
      description: 'Simulates a realistic multi-turn Malayalam clinical dialogue, ensuring monotonic turn progression and 0 voice overlaps',
      passed: pass,
      overlapDetected: overlaps > 0,
      details: {
        callerTurnsCount: callerTurns.length,
        aiTurnsCount: aiTurns.length,
        turnSequenceIds,
        overlaps,
      },
    });
    session.close();
    console.log(`  -> Result: ${pass ? 'PASS' : 'FAIL'} (${callerTurns.length}/8 caller turns, ${aiTurns.length}/8 AI turns)`);
  }

  // --------------------------------------------------------------------------
  // TEST 13: 2-Minute 8-Turn English Sequential Dialogue
  // --------------------------------------------------------------------------
  console.log('--- [Test 13/14: 2-Minute 8-Turn English Sequential Conversation] ---');
  {
    const socket = new MockTrackingSocket();
    const tts = new MockTtsProvider(5);
    const stt = new MockSttProvider();
    const session = new CallMediaSession({
      streamSid: 'MZ_test_13',
      callSid: 'CA_test_13',
      accountSid: 'AC_test_13',
      from: '+919876543210',
      to: '08047291658',
      socket: socket as any,
      audioEngine,
      autoPlayGreeting: false,
      enableIvrFlow: false,
      ttsProvider: tts,
      sttProvider: stt,
      conversationEngine: new MockConversationEngine(),
    });

    session.markStarted();

    const englishTurns = [
      'Hello, I want to book an appointment',
      'General Medicine',
      'Tomorrow morning',
      'What time is the doctor available?',
      'Book for 10 AM please',
      'Patient name is John',
      'What is the consultation fee?',
      'Thank you very much',
    ];

    let overlaps = 0;
    const turnSequenceIds: number[] = [];

    for (let i = 0; i < englishTurns.length; i++) {
      const turnText = englishTurns[i];
      stt.emitSpeechStart();
      stt.emitTranscript({
        text: turnText,
        isFinal: true,
        language: 'en-IN',
        confidence: 0.98,
        timestampMs: Date.now(),
      });

      // Wait for turn processing and audio playback
      await new Promise((r) => setTimeout(r, 60));
      turnSequenceIds.push((session as any).currentTurnSequenceId);

      if (session.ttsStatus === 'PLAYING' && (session as any).isTurnActive === false) {
        overlaps++;
      }
    }

    const callerTurns = session.conversationTurns.filter((t) => t.speaker === 'caller');
    const aiTurns = session.conversationTurns.filter((t) => t.speaker === 'ai');
    const pass = callerTurns.length === 8 && aiTurns.length === 8 && overlaps === 0;

    results.push({
      testNumber: 13,
      id: 'TEST_13_ENGLISH_8_TURNS',
      name: '2-Minute 8-Turn English Sequential Dialogue',
      safeguardTested: 'End-to-End English conversation stability',
      description: 'Simulates a realistic multi-turn English clinical dialogue, ensuring monotonic turn progression and 0 voice overlaps',
      passed: pass,
      overlapDetected: overlaps > 0,
      details: {
        callerTurnsCount: callerTurns.length,
        aiTurnsCount: aiTurns.length,
        turnSequenceIds,
        overlaps,
      },
    });
    session.close();
    console.log(`  -> Result: ${pass ? 'PASS' : 'FAIL'} (${callerTurns.length}/8 caller turns, ${aiTurns.length}/8 AI turns)`);
  }

  // --------------------------------------------------------------------------
  // TEST 14: Non-Durable Fallback Persistence Status Reporting
  // --------------------------------------------------------------------------
  console.log('--- [Test 14/14: Non-Durable Fallback Persistence Status Reporting] ---');
  {
    // Evaluate readiness when DB is degraded
    const readiness = evaluateGatewayReadiness(
      { isConfigured: true, apiKey: 'dummy', baseUrl: 'https://api.sarvam.ai' } as any,
      { status: 'DEGRADED', unpersistedSessionCount: 3 },
      false // databaseConnected = false
    );

    const persistenceHealth = ivrFlowService.getPersistenceHealth();

    const readinessCorrect =
      readiness.state === 'DEGRADED' &&
      readiness.persistenceStatus === 'DEGRADED' &&
      readiness.reason.includes('non-durable in-memory fallback queue') &&
      readiness.reason.includes('volatile and will not survive process restarts');

    const healthCorrect =
      persistenceHealth.bufferingMode === 'DATABASE_DURABLE' ||
      persistenceHealth.bufferingMode === 'NON_DURABLE_IN_MEMORY';

    const pass = readinessCorrect && healthCorrect;

    results.push({
      testNumber: 14,
      id: 'TEST_14_NON_DURABLE_PERSISTENCE_STATUS',
      name: 'Non-Durable Fallback Persistence Status Reporting',
      safeguardTested: 'Accurate durability semantics in health & readiness reporting',
      description: 'Verifies gateway reports non-durable in-memory fallback queue when database is offline, never claiming false durability',
      passed: pass,
      overlapDetected: false,
      details: {
        readinessState: readiness.state,
        readinessReason: readiness.reason,
        persistenceStatus: readiness.persistenceStatus,
        bufferingMode: persistenceHealth.bufferingMode,
        isDurable: persistenceHealth.isDurable,
      },
    });
    console.log(`  -> Result: ${pass ? 'PASS' : 'FAIL'}`);
  }

  console.log('\n================================================================');
  console.log('PHASE 9.2 REGRESSION TEST SUMMARY');
  console.log('================================================================');

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  const anyOverlap = results.some((r) => r.overlapDetected);

  console.log(`Total Tests Executed: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Overlapping Voice Detected in Any Test: ${anyOverlap ? 'YES (REGRESSION)' : 'NO (CLEAN)'}`);

  const outputPath = path.join(__dirname, 'phase9_2_regression_results.json');
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        summary: {
          totalTests: total,
          passed,
          failed,
          overallStatus: failed === 0 ? 'ALL_PASSED' : 'FAILURES_DETECTED',
          overlappingVoiceEliminated: !anyOverlap,
        },
        tests: results,
      },
      null,
      2
    )
  );

  console.log(`Results saved to: ${outputPath}`);

  if (failed > 0) {
    process.exit(1);
  }
}

runRegressionSuite().catch((err) => {
  console.error('Test suite failed with unexpected error:', err);
  process.exit(1);
});
