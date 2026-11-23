import * as fs from "fs";
import { SarvamSpeechToTextProvider } from "../../src/media-gateway/sarvam-stt";
import { SarvamTextToSpeechProvider } from "../../src/media-gateway/sarvam-tts";

function calculateRms(buffer: Buffer): number {
  if (buffer.length < 2) return 0;
  let sum = 0;
  const numSamples = Math.floor(buffer.length / 2);
  for (let i = 0; i < numSamples; i++) {
    const sample = buffer.readInt16LE(i * 2);
    sum += sample * sample;
  }
  return Math.round(Math.sqrt(sum / numSamples));
}

function addNoise(cleanPcm: Buffer, noiseType: "fan_ac" | "reception_chatter" | "telephony_quantized", snrDb: number): Buffer {
  const noisy = Buffer.alloc(cleanPcm.length);
  const cleanRms = calculateRms(cleanPcm) || 800;
  const targetNoiseRms = cleanRms / Math.pow(10, snrDb / 20);

  const numSamples = Math.floor(cleanPcm.length / 2);
  for (let i = 0; i < numSamples; i++) {
    let cleanSample = cleanPcm.readInt16LE(i * 2);
    let noiseSample = 0;

    if (noiseType === "fan_ac") {
      const t = i / 8000;
      const hum = Math.sin(2 * Math.PI * 50 * t) * 0.7 + Math.sin(2 * Math.PI * 100 * t) * 0.3;
      const hiss = (Math.random() * 2 - 1) * 0.2;
      noiseSample = (hum + hiss) * targetNoiseRms * Math.SQRT2;
    } else if (noiseType === "reception_chatter") {
      const t = i / 8000;
      const babble = (Math.sin(2 * Math.PI * 250 * t) * Math.sin(2 * Math.PI * 5 * t) +
                      Math.sin(2 * Math.PI * 450 * t) * Math.sin(2 * Math.PI * 8 * t) +
                      (Math.random() * 2 - 1) * 0.3) / 1.5;
      noiseSample = babble * targetNoiseRms * Math.SQRT2;
    } else if (noiseType === "telephony_quantized") {
      cleanSample = Math.round(cleanSample / 64) * 64;
      noiseSample = (Math.random() * 2 - 1) * targetNoiseRms;
    }

    let mixed = Math.round(cleanSample + noiseSample);
    mixed = Math.max(-32768, Math.min(32767, mixed));
    noisy.writeInt16LE(mixed, i * 2);
  }
  return noisy;
}

function calculateWordOverlap(expected: string, actual: string): number {
  const norm = (s: string) => s.toLowerCase().replace(/[^\w\s\u0D00-\u0D7F]/g, "").split(/\s+/).filter(Boolean);
  const wordsA = new Set(norm(expected));
  const wordsB = new Set(norm(actual));
  if (wordsA.size === 0) return 0;
  let matches = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) matches++;
  }
  return Math.round((matches / wordsA.size) * 100);
}

async function runNoiseAndVadBenchmark() {
  console.log("=================================================================");
  console.log("PART B (Cont): NOISE-HANDLING & VAD BENCHMARK");
  console.log("=================================================================");

  const tts = new SarvamTextToSpeechProvider();

  const testPhrases = [
    { id: "clean_ml", text: "എനിക്ക് കാർഡിയോളജി ഡോക്ടറെ കാണാൻ ഒരു അപ്പോയിന്റ്മെന്റ് വേണം", lang: "ml-IN", speaker: "kavitha" },
    { id: "manglish", text: "Doctor Radhika Nair appointment morning 10 am kittumo", lang: "en-IN", speaker: "ratan" },
  ];

  console.log("\nSynthesizing test audio phrases...");
  const rawAudioMap: Record<string, Buffer> = {};
  for (const tp of testPhrases) {
    const pcm = await tts.synthesize(tp.text, { language: tp.lang, voiceId: tp.speaker });
    rawAudioMap[tp.id] = pcm;
    const rms = calculateRms(pcm);
    console.log(`  Synthesized ${tp.id} (${pcm.length} bytes, RMS: ${rms})`);
  }

  const noiseScenarios = [
    { name: "Quiet (Clean Audio)", type: null, snr: 99 },
    { name: "Fan & AC Hum (Moderate, 20dB SNR)", type: "fan_ac", snr: 20 },
    { name: "Reception Desk Chatter (15dB SNR)", type: "reception_chatter", snr: 15 },
    { name: "Telephony Bandwidth Quantization (18dB SNR)", type: "telephony_quantized", snr: 18 },
  ];

  const vadThresholds = [250, 400, 600, 800];
  const benchmarkResults: any[] = [];

  for (const tp of testPhrases) {
    console.log(`\n-------------------------------------------------------------`);
    console.log(`Test Phrase (${tp.lang}): "${tp.text}"`);
    console.log(`-------------------------------------------------------------`);

    for (const scenario of noiseScenarios) {
      const cleanPcm = rawAudioMap[tp.id];
      const audioToTest = scenario.type
        ? addNoise(cleanPcm, scenario.type as any, scenario.snr)
        : cleanPcm;

      const stt = new SarvamSpeechToTextProvider({
        languageCode: tp.lang,
        model: "saaras:v4",
        sampleRate: 8000,
        vadThreshold: 400,
        silenceTimeoutMs: 400,
      });

      await stt.connect();

      let transcript = "";
      let speechStarted = false;
      let speechEnded = false;
      let finalReceived = false;

      stt.onSpeechStart(() => { speechStarted = true; });
      stt.onSpeechEnd(() => { speechEnded = true; });

      const t0 = Date.now();
      await new Promise<void>((resolve) => {
        stt.onTranscript((res) => {
          if (res.isFinal) {
            transcript = res.text;
            finalReceived = true;
            resolve();
          }
        });

        const chunkSize = 320;
        let offset = 0;
        const interval = setInterval(async () => {
          if (offset < audioToTest.length) {
            const chunk = audioToTest.subarray(offset, offset + chunkSize);
            await stt.sendAudio(chunk);
            offset += chunkSize;
          } else {
            clearInterval(interval);
            const silenceChunk = Buffer.alloc(chunkSize);
            for (let s = 0; s < 25; s++) {
              await stt.sendAudio(silenceChunk);
            }
            setTimeout(resolve, 2500);
          }
        }, 20);
      });

      const latencyMs = Date.now() - t0;
      await stt.close();

      const wordMatch = calculateWordOverlap(tp.text, transcript);
      console.log(`  Scenario: ${scenario.name}`);
      console.log(`    Result: ${wordMatch >= 50 ? "PASS" : "DEGRADED"} | Match: ${wordMatch}% | Latency: ${latencyMs}ms`);
      console.log(`    Transcript: "${transcript}"`);

      benchmarkResults.push({
        phraseId: tp.id,
        scenario: scenario.name,
        wordMatch,
        latencyMs,
        transcript,
        speechStarted,
        speechEnded,
        finalReceived,
      });
    }
  }

  // VAD Threshold Tuning
  console.log(`\n-------------------------------------------------------------`);
  console.log(`VAD ENERGY THRESHOLD TUNING (Evaluating False Barge-In vs Speech Detection)`);
  console.log(`-------------------------------------------------------------`);
  
  const samplePcm = rawAudioMap["clean_ml"] || Buffer.alloc(16000);
  const pureFanNoise = addNoise(Buffer.alloc(samplePcm.length), "fan_ac", 18);
  const fanRms = calculateRms(pureFanNoise);
  console.log(`Pure Fan/AC Noise RMS: ${fanRms}`);

  for (const vThresh of vadThresholds) {
    let falseTrigger = false;
    const stt = new SarvamSpeechToTextProvider({ vadThreshold: vThresh });
    stt.onSpeechStart(() => { falseTrigger = true; });

    for (let i = 0; i < pureFanNoise.length; i += 320) {
      await stt.sendAudio(pureFanNoise.subarray(i, i + 320));
    }

    console.log(`  VAD Threshold = ${vThresh} | False Barge-in on Fan Noise: ${falseTrigger ? "YES (Too Sensitive!)" : "NO (Clean/Robust)"}`);
  }

  fs.writeFileSync(
    "scripts/validation/noise_vad_benchmark_results.json",
    JSON.stringify(benchmarkResults, null, 2)
  );
  console.log("\nNoise & VAD Benchmark Complete. Saved to scripts/validation/noise_vad_benchmark_results.json");
}

runNoiseAndVadBenchmark();
