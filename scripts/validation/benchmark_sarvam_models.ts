import * as fs from "fs";

async function runModelDiscovery() {
  console.log("=================================================================");
  console.log("PART B: SARVAM MODEL DISCOVERY & BENCHMARKING");
  console.log("=================================================================");

  const env = fs.readFileSync(".env", "utf8");
  let apiKey = "";
  for (const line of env.split("\n")) {
    if (line.trim().startsWith("SARVAM_API_KEY=")) {
      apiKey = line.trim().slice("SARVAM_API_KEY=".length).replace(/^["']|["']$/g, "");
    }
  }

  if (!apiKey) {
    console.error("FATAL: SARVAM_API_KEY not found in .env");
    return;
  }

  // 1. Probe Sarvam Model List API (GET /v1/models)
  console.log("\n--- [1/4] Probing Sarvam /v1/models Catalogue ---");
  try {
    const res = await fetch("https://api.sarvam.ai/v1/models", {
      headers: { "api-subscription-key": apiKey },
    });
    console.log(`GET /v1/models Status: HTTP ${res.status}`);
    if (res.ok) {
      const data = await res.json();
      console.log("Available Models in Catalogue:", JSON.stringify(data, null, 2));
    } else {
      const err = await res.text();
      console.log("GET /v1/models response:", err);
    }
  } catch (e: any) {
    console.log("GET /v1/models error:", e.message);
  }

  // 2. LLM Benchmark: sarvam-105b-conversations vs alternatives
  console.log("\n--- [2/4] Benchmarking LLM Candidates ---");
  const llmCandidates = [
    "sarvam-105b-conversations",
    "sarvam-105b",
    "sarvam-2b",
    "sarvam-8b",
  ];

  const testPrompts = [
    { lang: "Malayalam", prompt: "എനിക്ക് നാളെ ഡോക്ടറെ കാണാൻ ഒരു അപ്പോയിന്റ്മെന്റ് വേണം." },
    { lang: "English", prompt: "I would like to book a consultation with the cardiologist tomorrow." },
    { lang: "Manglish", prompt: "Cardiology doctor available aano naale morning?" },
  ];

  const llmResults: Record<string, any> = {};

  for (const model of llmCandidates) {
    console.log(`\nTesting LLM Model: "${model}"...`);
    llmResults[model] = { supported: false, tests: [] };

    for (const tp of testPrompts) {
      const t0 = Date.now();
      let firstTokenMs = 0;
      let fullText = "";

      try {
        const res = await fetch("https://api.sarvam.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "api-subscription-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "system",
                content: "You are the hospital receptionist at Daya Hospital, Thrissur. Keep answer concise (1-2 sentences).",
              },
              { role: "user", content: tp.prompt },
            ],
            max_tokens: 60,
            temperature: 0.2,
            stream: true,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.log(`  [${tp.lang}] HTTP ${res.status}: ${errText.slice(0, 120)}`);
          llmResults[model].tests.push({ lang: tp.lang, status: res.status, error: errText });
          continue;
        }

        llmResults[model].supported = true;
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        if (reader) {
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
                    if (!firstTokenMs) {
                      firstTokenMs = Date.now() - t0;
                    }
                    fullText += delta;
                  }
                } catch {}
              }
            }
          }
        }

        const totalMs = Date.now() - t0;
        console.log(`  [${tp.lang}] PASS | TTFT: ${firstTokenMs}ms | Total: ${totalMs}ms | Response: "${fullText.trim()}"`);
        llmResults[model].tests.push({
          lang: tp.lang,
          status: 200,
          ttftMs: firstTokenMs,
          totalMs,
          response: fullText.trim(),
        });
      } catch (err: any) {
        console.log(`  [${tp.lang}] EXCEPTION: ${err.message}`);
        llmResults[model].tests.push({ lang: tp.lang, error: err.message });
      }
    }
  }

  // 3. TTS Benchmark: bulbul:v3 vs bulbul:v4-flash vs other models/voices
  console.log("\n--- [3/4] Benchmarking TTS Candidates ---");
  const ttsConfigs = [
    { model: "bulbul:v3", speaker: "kavitha", lang: "ml-IN", text: "ദയാ ജനറൽ ഹോസ്പിറ്റലിലേക്ക് സ്വാഗതം. നിങ്ങൾക്ക് എങ്ങനെ സഹായിക്കാനാകും?" },
    { model: "bulbul:v3", speaker: "ratan", lang: "en-IN", text: "Welcome to Daya Hospital. How may I assist you today?" },
    { model: "bulbul:v4-flash", speaker: "kavitha", lang: "ml-IN", text: "ദയാ ജനറൽ ഹോസ്പിറ്റലിലേക്ക് സ്വാഗതം." },
    { model: "bulbul:v4-flash", speaker: "ratan", lang: "en-IN", text: "Welcome to Daya Hospital." },
    { model: "bulbul:v4", speaker: "kavitha", lang: "ml-IN", text: "ദയാ ജനറൽ ഹോസ്പിറ്റലിലേക്ക് സ്വാഗതം." },
    { model: "bulbul:v3", speaker: "anushka", lang: "ml-IN", text: "ദയാ ജനറൽ ഹോസ്പിറ്റലിലേക്ക് സ്വാഗതം." },
    { model: "bulbul:v3", speaker: "vidya", lang: "ml-IN", text: "ദയാ ജനറൽ ഹോസ്പിറ്റലിലേക്ക് സ്വാഗതം." },
    { model: "bulbul:v3", speaker: "shreya", lang: "ml-IN", text: "ദയാ ജനറൽ ഹോസ്പിറ്റലിലേക്ക് സ്വാഗതം." },
  ];

  const ttsResults: any[] = [];

  for (const cfg of ttsConfigs) {
    const t0 = Date.now();
    try {
      const res = await fetch("https://api.sarvam.ai/text-to-speech", {
        method: "POST",
        headers: {
          "api-subscription-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: [cfg.text],
          target_language_code: cfg.lang,
          speaker: cfg.speaker,
          speech_sample_rate: 8000,
          model: cfg.model,
          enable_preprocessing: true,
          pace: 1.15,
        }),
      });

      const totalMs = Date.now() - t0;
      if (res.ok) {
        const data: any = await res.json();
        const audioLen = data.audios?.[0]?.length || 0;
        console.log(`  [TTS ${cfg.model} | ${cfg.speaker} (${cfg.lang})] PASS | Time: ${totalMs}ms | Audio bytes: ${audioLen}`);
        ttsResults.push({ ...cfg, status: 200, timeMs: totalMs, audioLen, supported: true });
      } else {
        const errData = await res.json().catch(() => ({}));
        console.log(`  [TTS ${cfg.model} | ${cfg.speaker} (${cfg.lang})] FAIL (HTTP ${res.status}): ${(errData as any)?.error?.message || res.statusText}`);
        ttsResults.push({ ...cfg, status: res.status, error: (errData as any)?.error?.message, supported: false });
      }
    } catch (err: any) {
      console.log(`  [TTS ${cfg.model} | ${cfg.speaker} (${cfg.lang})] EXCEPTION: ${err.message}`);
      ttsResults.push({ ...cfg, error: err.message, supported: false });
    }
  }

  // 4. Save results to JSON
  fs.writeFileSync(
    "scripts/validation/sarvam_model_benchmark_results.json",
    JSON.stringify({ llmResults, ttsResults, timestamp: new Date().toISOString() }, null, 2)
  );
  console.log("\nBenchmark complete. Results saved to scripts/validation/sarvam_model_benchmark_results.json");
}

runModelDiscovery();

