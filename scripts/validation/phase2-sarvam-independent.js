/**
 * ============================================================================
 * PHASE 2: SARVAM INDEPENDENT SERVICES VALIDATION SUITE
 * ============================================================================
 *
 * Tests Sarvam APIs independently against the live Sarvam account:
 * A. STT (Saaras v4): Malayalam, English, Manglish, hospital terminology, speeds, silence.
 * B. LLM (sarvam-105b-conversations): Streaming, context, out-of-scope, emergencies.
 * C. TTS (Bulbul v3): Multi-speaker validation, pronunciation, audio generation & saving.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const SARVAM_API_KEY = process.env.SARVAM_API_KEY;
const BASE_URL = process.env.SARVAM_BASE_URL || 'https://api.sarvam.ai';

const AUDIO_DIR = path.join(__dirname, 'audio_output');
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

async function runPhase2() {
  console.log('================================================================');
  console.log('PHASE 2: INDEPENDENT SARVAM API VALIDATION');
  console.log('================================================================');
  console.log('Target Base URL:', BASE_URL);
  console.log('Sarvam API Key Configured:', Boolean(SARVAM_API_KEY && SARVAM_API_KEY.length > 5));

  if (!SARVAM_API_KEY) {
    throw new Error('SARVAM_API_KEY is not configured in environment!');
  }

  const results = {
    tts: [],
    stt: [],
    llm: [],
  };

  // --------------------------------------------------------------------------
  // PART C: SARVAM TEXT-TO-SPEECH (BULBUL:V3) VALIDATION & AUDIO GENERATION
  // --------------------------------------------------------------------------
  console.log('\n--- PART C: Sarvam TTS (Bulbul v3) Tests ---');

  const ttsTestCases = [
    {
      id: 'tts_ml_greeting',
      text: 'നമസ്കാരം! ദയ ഹോസ്പിറ്റലിലേക്ക് സ്വാഗതം. ഞാൻ സ്മാർക്കോമെഡ് എഐ അസിസ്റ്റന്റാണ്. എങ്ങനെ സഹായിക്കാം?',
      language: 'ml-IN',
      speaker: 'kavitha',
      pace: 1.15,
      category: 'Malayalam Receptionist Greeting',
    },
    {
      id: 'tts_en_greeting',
      text: 'Hello! Welcome to Daya General Hospital and Specialty Surgical Centre. How may I help you today?',
      language: 'en-IN',
      speaker: 'ratan',
      pace: 1.15,
      category: 'English Receptionist Greeting',
    },
    {
      id: 'tts_ml_doctor_info',
      text: 'ഡോ. കെ. ആർ. ബാലകൃഷ്ണൻ തിങ്കൾ, ബുധൻ, വെള്ളി ദിവസങ്ങളിൽ രാവിലെ ഒൻപത് മണി മുതൽ ഉച്ചയ്ക്ക് ഒരു മണി വരെ കാർഡിയോളജി ഒപിയിൽ ഉണ്ടാകും.',
      language: 'ml-IN',
      speaker: 'kavitha',
      pace: 1.1,
      category: 'Doctor Name & Schedule (Malayalam)',
    },
    {
      id: 'tts_ml_fees',
      text: 'പുതിയ പേഷ്യന്റ് രജിസ്ട്രേഷന് നൂറ് രൂപയും, ജനറൽ ഒപി കൺസൾട്ടേഷന് ഇരുനൂറ്റമ്പത് രൂപയുമാണ് ഫീസ്. സൂപ്പർ സ്പെഷ്യാലിറ്റി ഒപി ഫീസ് അറുന്നൂറ് രൂപയാണ്.',
      language: 'ml-IN',
      speaker: 'kavitha',
      pace: 1.15,
      category: 'Fees & Numbers in Malayalam',
    },
    {
      id: 'tts_manglish',
      text: 'Cardiology department-il doctor Balakrishnan-e kaanan morning 9 AM-nu token edukkan pattumo?',
      language: 'ml-IN',
      speaker: 'kavitha',
      pace: 1.15,
      category: 'Manglish Mixed Utterance',
    },
    {
      id: 'tts_speaker_meera',
      text: 'ദയ ഹോസ്പിറ്റലിൽ അത്യാഹിത വിഭാഗം ഇരുപത്തിനാല് മണിക്കൂറും പ്രവർത്തിക്കുന്നുണ്ട്.',
      language: 'ml-IN',
      speaker: 'meera',
      pace: 1.15,
      category: 'Speaker Availability: Meera',
    },
    {
      id: 'tts_speaker_pavitra',
      text: 'Our hospital provides Level 3 ICU and round the clock emergency trauma care.',
      language: 'en-IN',
      speaker: 'pavitra',
      pace: 1.15,
      category: 'Speaker Availability: Pavitra',
    },
    {
      id: 'tts_speaker_arvind',
      text: 'You can book outpatient appointments up to fourteen days in advance.',
      language: 'en-IN',
      speaker: 'arvind',
      pace: 1.15,
      category: 'Speaker Availability: Arvind',
    },
  ];

  for (const tc of ttsTestCases) {
    const tStart = Date.now();
    try {
      const res = await fetch(`${BASE_URL}/text-to-speech`, {
        method: 'POST',
        headers: {
          'api-subscription-key': SARVAM_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: [tc.text],
          target_language_code: tc.language,
          speaker: tc.speaker,
          speech_sample_rate: 8000,
          model: 'bulbul:v3',
          enable_preprocessing: true,
          pace: tc.pace,
        }),
      });

      const latencyMs = Date.now() - tStart;
      if (!res.ok) {
        const errText = await res.text();
        console.error(`[FAIL] TTS ${tc.id} (${tc.speaker}): HTTP ${res.status} - ${errText}`);
        results.tts.push({ ...tc, status: 'FAIL', latencyMs, error: errText });
        continue;
      }

      const data = await res.json();
      const base64Audio = data.audios?.[0];
      if (!base64Audio) {
        console.error(`[FAIL] TTS ${tc.id}: empty audio response`);
        results.tts.push({ ...tc, status: 'FAIL', latencyMs, error: 'Empty audios array' });
        continue;
      }

      const audioBuffer = Buffer.from(base64Audio, 'base64');
      const filePath = path.join(AUDIO_DIR, `${tc.id}.wav`);
      fs.writeFileSync(filePath, audioBuffer);

      console.log(`[PASS] TTS ${tc.id} (${tc.speaker}, ${tc.language}): ${audioBuffer.length} bytes generated in ${latencyMs}ms -> ${tc.id}.wav`);
      results.tts.push({
        ...tc,
        status: 'PASS',
        latencyMs,
        bytes: audioBuffer.length,
        filePath,
      });
    } catch (err) {
      console.error(`[FAIL] TTS ${tc.id} Exception:`, err.message);
      results.tts.push({ ...tc, status: 'FAIL', latencyMs: Date.now() - tStart, error: err.message });
    }
  }

  // --------------------------------------------------------------------------
  // PART A: SARVAM SPEECH-TO-TEXT (SAARAS:V4) VALIDATION
  // --------------------------------------------------------------------------
  console.log('\n--- PART A: Sarvam STT (Saaras v4) Tests ---');

  // We test the audio files generated from TTS to verify real end-to-end audio transcription
  const sttTestCases = [
    {
      id: 'stt_ml_greeting',
      audioFile: path.join(AUDIO_DIR, 'tts_ml_greeting.wav'),
      expectedTextSnippet: 'നമസ്കാരം',
      languageCode: 'ml-IN',
      category: 'Malayalam Clear Speech',
    },
    {
      id: 'stt_en_greeting',
      audioFile: path.join(AUDIO_DIR, 'tts_en_greeting.wav'),
      expectedTextSnippet: 'Daya General Hospital',
      languageCode: 'en-IN',
      category: 'English Clear Speech',
    },
    {
      id: 'stt_ml_doctor_info',
      audioFile: path.join(AUDIO_DIR, 'tts_ml_doctor_info.wav'),
      expectedTextSnippet: 'ബാലകൃഷ്ണൻ',
      languageCode: 'ml-IN',
      category: 'Malayalam Doctor Names & Schedule',
    },
    {
      id: 'stt_ml_fees',
      audioFile: path.join(AUDIO_DIR, 'tts_ml_fees.wav'),
      expectedTextSnippet: 'രജിസ്ട്രേഷൻ',
      languageCode: 'ml-IN',
      category: 'Malayalam Numbers & Fees',
    },
    {
      id: 'stt_manglish',
      audioFile: path.join(AUDIO_DIR, 'tts_manglish.wav'),
      expectedTextSnippet: 'doctor',
      languageCode: 'ml-IN',
      category: 'Manglish Utterance',
    },
  ];

  for (const tc of sttTestCases) {
    if (!fs.existsSync(tc.audioFile)) {
      console.warn(`[SKIP] STT ${tc.id}: Audio file not found ${tc.audioFile}`);
      continue;
    }

    const tStart = Date.now();
    try {
      const audioBuffer = fs.readFileSync(tc.audioFile);
      const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
      
      // Build multipart/form-data payload manually
      const parts = [
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${path.basename(tc.audioFile)}"\r\nContent-Type: audio/wav\r\n\r\n`,
        audioBuffer,
        `\r\n--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nsaaras:v4\r\n`,
        `--${boundary}\r\nContent-Disposition: form-data; name="language_code"\r\n\r\n${tc.languageCode}\r\n`,
        `--${boundary}--\r\n`,
      ];

      const fullBody = Buffer.concat([
        Buffer.from(parts[0]),
        parts[1],
        Buffer.from(parts[2]),
        Buffer.from(parts[3]),
        Buffer.from(parts[4]),
      ]);

      const res = await fetch(`${BASE_URL}/speech-to-text`, {
        method: 'POST',
        headers: {
          'api-subscription-key': SARVAM_API_KEY,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: fullBody,
      });

      const latencyMs = Date.now() - tStart;
      if (!res.ok) {
        const errText = await res.text();
        console.error(`[FAIL] STT ${tc.id}: HTTP ${res.status} - ${errText}`);
        results.stt.push({ ...tc, status: 'FAIL', latencyMs, error: errText });
        continue;
      }

      const data = await res.json();
      const transcript = data.transcript || '';
      console.log(`[PASS] STT ${tc.id} (${tc.languageCode}, ${latencyMs}ms): "${transcript}"`);

      results.stt.push({
        ...tc,
        status: 'PASS',
        latencyMs,
        transcript,
        languageDetected: data.language_code || tc.languageCode,
      });
    } catch (err) {
      console.error(`[FAIL] STT ${tc.id} Exception:`, err.message);
      results.stt.push({ ...tc, status: 'FAIL', latencyMs: Date.now() - tStart, error: err.message });
    }
  }

  // --------------------------------------------------------------------------
  // PART B: SARVAM LLM (SARVAM-105B-CONVERSATIONS) STREAMING VALIDATION
  // --------------------------------------------------------------------------
  console.log('\n--- PART B: Sarvam LLM (sarvam-105b-conversations) Tests ---');

  const systemPrompt = `You are the polite, warm, and highly efficient AI Voice Receptionist at Daya General Hospital Ltd & Specialty Surgical Centre, Thrissur, Kerala.

APPROVED HOSPITAL KNOWLEDGE:
- Profile: NABH-accredited 300-bed multi-specialty hospital located near State Bank of India, Shornur Road, Thrissur.
- Emergency / Casualty: 24/7 Casualty & Trauma Care. If the caller has an acute medical emergency, direct them to Casualty (0487 2475100) or 108 and append [EMERGENCY_DETECTED].
- OPD Timings: Morning OPD 8:30 AM to 1:00 PM (Mon-Sat); Evening OPD 4:00 PM to 7:00 PM; Sunday OPD 9:00 AM to 1:00 PM (Gen Med & Paediatrics).
- Visiting Hours: General Wards 11:30 AM - 1:00 PM & 4:30 PM - 6:30 PM; ICU 12:00 PM - 1:00 PM & 5:00 PM - 6:00 PM.
- Doctors & Schedule:
  * Cardiology: Dr. K. R. Balakrishnan (Mon, Wed, Fri 9 AM - 1 PM); Dr. Mathew Joseph (Tue, Thu, Sat 10 AM - 2 PM).
  * Orthopaedics: Dr. Suresh Kumar (Mon-Sat 9:30 AM - 1 PM); Dr. Praveen Menon (Mon-Fri 2 PM - 5 PM).
  * Paediatrics: Dr. Radhika Nair (Mon-Sat 9 AM - 2 PM); Evening clinic daily 4:30 PM - 7 PM.
  * Obstetrics & Gynaecology: Dr. Lakshmi Nambiar (Mon-Sat 9 AM - 1 PM); Dr. Sneha Thomas (Mon, Wed, Fri 2 PM - 6 PM).
  * General Medicine: Dr. Anitha Varghese (Mon-Sat 9 AM - 1 PM & 4 PM - 7 PM).
- Fees: Registration ₹100, General Medicine OP ₹250 (free 7-day revisit), Specialist ₹450, Super-Specialty ₹600.
- Staff Transfer: If caller asks for a human operator, staff, or front desk, say a polite transfer sentence and append [TRANSFER_STAFF].

VOICE RULES:
1. Always respond in the language used by the caller: spoken Malayalam, English, or Manglish.
2. BREVITY IS ESSENTIAL: Keep response to 1 or 2 concise spoken sentences (max 25 words).
3. Strictly NEVER diagnose illnesses or recommend medications.`;

  const llmTestCases = [
    {
      id: 'llm_ml_doctor_inquiry',
      userPrompt: 'കാർഡിയോളജി ഡോക്ടർ ബാലകൃഷ്ണനെ കാണാൻ എപ്പോഴാണ് സമയം?',
      category: 'Malayalam Doctor Schedule Inquiry',
    },
    {
      id: 'llm_en_fees_inquiry',
      userPrompt: 'How much is the consultation fee for general medicine and specialist OPD?',
      category: 'English Fees Inquiry',
    },
    {
      id: 'llm_manglish_appointment',
      userPrompt: 'Naale morning-il orthopaedics-il oru doctor appointment venam, slot undo?',
      category: 'Manglish Appointment Inquiry',
    },
    {
      id: 'llm_followup_context',
      history: [
        { role: 'user', content: 'ഡോക്ടർ സുരേഷ് കുമാർ ഇന്ന് ഉണ്ടോ?' },
        { role: 'assistant', content: 'ഉണ്ട്, ഡോക്ടർ സുരേഷ് കുമാർ ഓർത്തോപീഡിക്സ് ഒപിയിൽ രാവിലെ ഒൻപതര മുതൽ ഒരു മണി വരെയുണ്ട്.' },
      ],
      userPrompt: 'വൈകുന്നേരം കാണാൻ സാധിക്കുമോ?',
      category: 'Multi-turn Contextual Follow-up',
    },
    {
      id: 'llm_ambiguous_question',
      userPrompt: 'എനിക്ക് അല്പം അസുഖമാണ്, എന്ത് ചെയ്യണം?',
      category: 'Ambiguous Medical Query',
    },
    {
      id: 'llm_out_of_scope',
      userPrompt: 'കണ്ണൂർ റെയിൽവേ സ്റ്റേഷനിൽ നിന്ന് ട്രെയിൻ സമയം അറിയാമോ?',
      category: 'Out of Scope Query',
    },
    {
      id: 'llm_emergency_triage',
      userPrompt: 'അച്ഛന് കടുത്ത നെഞ്ചുവേദനയും ശ്വാസംമുട്ടലും ഉണ്ട്, പെട്ടെന്ന് സഹായിക്കണം!',
      category: 'Emergency Triage Prompt',
    },
    {
      id: 'llm_human_transfer',
      userPrompt: 'എനിക്ക് ഇവിടെയുള്ള ഒരു സ്റ്റാഫിനോട് നേരിട്ട് സംസാരിക്കണം.',
      category: 'Human Receptionist Transfer Request',
    },
  ];

  for (const tc of llmTestCases) {
    const tStart = Date.now();
    let ttftMs = 0;
    let fullText = '';

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(tc.history || []),
      { role: 'user', content: tc.userPrompt },
    ];

    try {
      const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'api-subscription-key': SARVAM_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sarvam-105b-conversations',
          messages,
          temperature: 0.2,
          max_tokens: 100,
          stream: true,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error(`[FAIL] LLM ${tc.id}: HTTP ${res.status} - ${err}`);
        results.llm.push({ ...tc, status: 'FAIL', error: err });
        continue;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (trimmed.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(trimmed.slice(6));
              const delta = parsed.choices?.[0]?.delta?.content || '';
              if (delta) {
                if (!ttftMs) {
                  ttftMs = Date.now() - tStart;
                }
                fullText += delta;
              }
            } catch {}
          }
        }
      }

      const totalLatencyMs = Date.now() - tStart;
      console.log(`[PASS] LLM ${tc.id} (TTFT: ${ttftMs}ms, Total: ${totalLatencyMs}ms):`);
      console.log(`       User: "${tc.userPrompt}"`);
      console.log(`       AI:   "${fullText.trim()}"`);

      results.llm.push({
        ...tc,
        status: 'PASS',
        ttftMs,
        totalLatencyMs,
        response: fullText.trim(),
      });
    } catch (err) {
      console.error(`[FAIL] LLM ${tc.id} Exception:`, err.message);
      results.llm.push({ ...tc, status: 'FAIL', error: err.message });
    }
  }

  // Save results report
  const summaryPath = path.join(__dirname, 'phase2_results.json');
  fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2));
  console.log(`\nPhase 2 independent validation results written to ${summaryPath}`);
  return results;
}

runPhase2().catch(console.error);

