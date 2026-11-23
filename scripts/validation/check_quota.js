const dotenv = require('dotenv');
dotenv.config();

async function checkQuota() {
  const key = process.env.SARVAM_API_KEY;
  console.log('Checking endpoints with key length:', key ? key.length : 0);

  // Check LLM
  try {
    const resLlm = await fetch('https://api.sarvam.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'api-subscription-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'sarvam-105b-conversations',
        messages: [{ role: 'user', content: 'Hello' }],
      }),
    });
    console.log('LLM Status:', resLlm.status, await resLlm.text());
  } catch (e) {
    console.log('LLM Err:', e.message);
  }

  // Check STT
  try {
    const fs = require('fs');
    const path = require('path');
    const wavFile = path.join(__dirname, 'e2e_audio', 'input_sc_01_ml_greeting.wav');
    if (fs.existsSync(wavFile)) {
      const audioBuffer = fs.readFileSync(wavFile);
      const boundary = '----WebKitFormBoundaryCheck';
      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.wav"\r\nContent-Type: audio/wav\r\n\r\n`),
        audioBuffer,
        Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nsaaras:v4\r\n--${boundary}\r\nContent-Disposition: form-data; name="language_code"\r\n\r\nml-IN\r\n--${boundary}--\r\n`),
      ]);
      const resStt = await fetch('https://api.sarvam.ai/speech-to-text', {
        method: 'POST',
        headers: { 'api-subscription-key': key, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
        body,
      });
      console.log('STT Status:', resStt.status, await resStt.text());
    } else {
      console.log('STT: test wav file not found');
    }
  } catch (e) {
    console.log('STT Err:', e.message);
  }

  // Check TTS
  try {
    const resTts = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: { 'api-subscription-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputs: ['Test'],
        target_language_code: 'ml-IN',
        speaker: 'kavitha',
      }),
    });
    console.log('TTS Status:', resTts.status, await resTts.text());
  } catch (e) {
    console.log('TTS Err:', e.message);
  }
}

checkQuota();
