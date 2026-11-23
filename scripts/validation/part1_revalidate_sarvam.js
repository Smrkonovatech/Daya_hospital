const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
dotenv.config();

async function runPart1Revalidation() {
  const key = process.env.SARVAM_API_KEY;
  const results = {
    timestamp: new Date().toISOString(),
    apiKeyConfigured: !!key,
    keyLength: key ? key.length : 0,
    llm: {},
    stt: {},
    tts: {},
  };

  console.log('=== PART 1: SARVAM LIVE API REVALIDATION ===');

  // 1. LLM Malayalam
  try {
    const t0 = Date.now();
    const res = await fetch('https://api.sarvam.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'api-subscription-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'sarvam-105b-conversations',
        messages: [{ role: 'user', content: 'നമസ്കാരം, ദയ ഹോസ്പിറ്റലിൽ കാർഡിയോളജി ഡോക്ടർ ഉണ്ടോ?' }],
        max_tokens: 150,
      }),
    });
    const t1 = Date.now();
    const data = await res.json();
    results.llm.malayalam = {
      status: res.status,
      latencyMs: t1 - t0,
      requestId: data.id,
      response: data.choices?.[0]?.message?.content,
      usage: data.usage,
    };
    console.log(`LLM (ML): status ${res.status}, latency ${t1 - t0}ms`);
  } catch (err) {
    results.llm.malayalam = { error: err.message };
    console.error('LLM (ML) error:', err.message);
  }

  // 2. LLM English
  try {
    const t0 = Date.now();
    const res = await fetch('https://api.sarvam.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'api-subscription-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'sarvam-105b-conversations',
        messages: [{ role: 'user', content: 'Hello, what are the visiting hours for the hospital?' }],
        max_tokens: 150,
      }),
    });
    const t1 = Date.now();
    const data = await res.json();
    results.llm.english = {
      status: res.status,
      latencyMs: t1 - t0,
      requestId: data.id,
      response: data.choices?.[0]?.message?.content,
      usage: data.usage,
    };
    console.log(`LLM (EN): status ${res.status}, latency ${t1 - t0}ms`);
  } catch (err) {
    results.llm.english = { error: err.message };
    console.error('LLM (EN) error:', err.message);
  }

  // 3. TTS Malayalam (kavitha)
  let ttsMlAudioBase64 = null;
  try {
    const t0 = Date.now();
    const res = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: { 'api-subscription-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputs: ['ദയ ഹോസ്പിറ്റലിലേക്ക് സ്വാഗതം. നിങ്ങൾക്ക് എങ്ങനെ സഹായിക്കാനാകും?'],
        target_language_code: 'ml-IN',
        speaker: 'kavitha',
      }),
    });
    const t1 = Date.now();
    const data = await res.json();
    ttsMlAudioBase64 = data.audios?.[0];
    results.tts.malayalam = {
      status: res.status,
      latencyMs: t1 - t0,
      requestId: data.request_id,
      audioBytes: ttsMlAudioBase64 ? Buffer.from(ttsMlAudioBase64, 'base64').length : 0,
      speaker: 'kavitha',
    };
    console.log(`TTS (ML): status ${res.status}, latency ${t1 - t0}ms, bytes ${results.tts.malayalam.audioBytes}`);
  } catch (err) {
    results.tts.malayalam = { error: err.message };
    console.error('TTS (ML) error:', err.message);
  }

  // 4. TTS English (ratan)
  let ttsEnAudioBase64 = null;
  try {
    const t0 = Date.now();
    const res = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: { 'api-subscription-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputs: ['Welcome to Daya Hospital. How may I assist you today?'],
        target_language_code: 'en-IN',
        speaker: 'ratan',
      }),
    });
    const t1 = Date.now();
    const data = await res.json();
    ttsEnAudioBase64 = data.audios?.[0];
    results.tts.english = {
      status: res.status,
      latencyMs: t1 - t0,
      requestId: data.request_id,
      audioBytes: ttsEnAudioBase64 ? Buffer.from(ttsEnAudioBase64, 'base64').length : 0,
      speaker: 'ratan',
    };
    console.log(`TTS (EN): status ${res.status}, latency ${t1 - t0}ms, bytes ${results.tts.english.audioBytes}`);
  } catch (err) {
    results.tts.english = { error: err.message };
    console.error('TTS (EN) error:', err.message);
  }

  // 5. STT Malayalam
  try {
    const t0 = Date.now();
    const wavBuffer = ttsMlAudioBase64
      ? Buffer.from(ttsMlAudioBase64, 'base64')
      : fs.readFileSync(path.join(__dirname, 'e2e_audio', 'input_sc_01_ml_greeting.wav'));
    const boundary = '----WebKitFormBoundaryPart1ML';
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio_ml.wav"\r\nContent-Type: audio/wav\r\n\r\n`),
      wavBuffer,
      Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nsaaras:v4\r\n--${boundary}\r\nContent-Disposition: form-data; name="language_code"\r\n\r\nml-IN\r\n--${boundary}--\r\n`),
    ]);
    const res = await fetch('https://api.sarvam.ai/speech-to-text', {
      method: 'POST',
      headers: { 'api-subscription-key': key, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    });
    const t1 = Date.now();
    const data = await res.json();
    results.stt.malayalam = {
      status: res.status,
      latencyMs: t1 - t0,
      requestId: data.request_id,
      transcript: data.transcript,
      languageCode: data.language_code,
    };
    console.log(`STT (ML): status ${res.status}, latency ${t1 - t0}ms, transcript: "${data.transcript}"`);
  } catch (err) {
    results.stt.malayalam = { error: err.message };
    console.error('STT (ML) error:', err.message);
  }

  // 6. STT English
  try {
    const t0 = Date.now();
    const wavBuffer = ttsEnAudioBase64 ? Buffer.from(ttsEnAudioBase64, 'base64') : null;
    if (wavBuffer) {
      const boundary = '----WebKitFormBoundaryPart1EN';
      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio_en.wav"\r\nContent-Type: audio/wav\r\n\r\n`),
        wavBuffer,
        Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nsaaras:v4\r\n--${boundary}\r\nContent-Disposition: form-data; name="language_code"\r\n\r\nen-IN\r\n--${boundary}--\r\n`),
      ]);
      const res = await fetch('https://api.sarvam.ai/speech-to-text', {
        method: 'POST',
        headers: { 'api-subscription-key': key, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
        body,
      });
      const t1 = Date.now();
      const data = await res.json();
      results.stt.english = {
        status: res.status,
        latencyMs: t1 - t0,
        requestId: data.request_id,
        transcript: data.transcript,
        languageCode: data.language_code,
      };
      console.log(`STT (EN): status ${res.status}, latency ${t1 - t0}ms, transcript: "${data.transcript}"`);
    }
  } catch (err) {
    results.stt.english = { error: err.message };
    console.error('STT (EN) error:', err.message);
  }

  const outPath = path.join(__dirname, 'part1_revalidation_results.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`Results saved to ${outPath}`);
}

runPart1Revalidation();

