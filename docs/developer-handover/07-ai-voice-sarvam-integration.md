# 07 — AI Voice Integration (SMRKO VOICE & Sarvam AI)

This document details the Artificial Intelligence speech and conversational architecture powering **SMRKO VOICE**, built on **Sarvam AI**.

---

## 1. Architectural Distinction: Core APIs vs. Managed Voice Agents

A crucial architectural distinction exists within the codebase. The incoming developer must understand that two complementary Sarvam integrations exist:

```
                            SMRKO VOICE
                                 │
         ┌───────────────────────┴───────────────────────┐
         │                                               │
         ▼                                               ▼
[SARVAM_CORE_CUSTOM]                         [SARVAM_VOICE_AGENTS]
(Custom Speech Pipeline)                     (Managed Samvaad Platform)
Persistent Media Gateway                     Cloud Voicebot Platform
src/media-gateway/*                          src/lib/integrations/sarvam/*
         │                                               │
         ├── STT: Saaras:v4 (Streaming WS)              ├── Managed Telephony Bridge
         ├── LLM: sarvam-105b-conversations             ├── Native Barge-In & State
         └── TTS: Bulbul:v3 (Pipelined PCM)             └── Webhook Tools to Smrkomed
```

### 1.1 `SARVAM_CORE_CUSTOM` (Custom Gateway Audio Engine)
- **Location:** [src/media-gateway/](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/media-gateway/) (`server.ts`, `audio-engine.ts`, `conversation-engine.ts`, `sarvam-stt.ts`, `sarvam-tts.ts`).
- **How It Works:** The media gateway receives raw 8kHz linear PCM audio chunks from Exotel AgentStream (`/exotel/voicebot`). It maintains an internal audio buffer, performs silence detection, streams audio chunks to Sarvam STT WebSocket, passes completed user utterances to the conversational LLM, and pipes synthesized TTS audio back to Exotel.
- **When It Is Used:** Direct WebSocket streaming deployments where Smrkomed maintains full low-level control over audio buffers, turn-taking, barge-in, and local audio fallback caching.

### 1.2 `SARVAM_VOICE_AGENTS` (Sarvam Samvaad Platform)
- **Location:** [src/lib/integrations/sarvam/](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/lib/integrations/sarvam/) (`voice-agent-client.ts`, `daya-agent-config.ts`, `voice-agent-config.ts`).
- **How It Works:** The voicebot conversation runs entirely on Sarvam's managed cloud platform (`apps.sarvam.ai`). Exotel connects via SIP or WebSocket trunk directly to Sarvam. When the caller asks to book an appointment or check doctor availability, Sarvam's dialogue engine dispatches HTTP POST webhooks to Smrkomed's tool endpoints (`/api/v1/voice-agent/*`).
- **When It Is Used:** Standard telephone voice agent deployments where Sarvam handles telephony audio mixing, and Smrkomed acts as the clinical data and hospital backend.

---

## 2. Speech Models & Technical Specifications

| Speech Stage | Model Name | Endpoint / API | Specifications |
|---|---|---|---|
| **Speech-to-Text (STT)** | `saaras:v4` | `wss://api.sarvam.ai/speech-to-text` | 8000 Hz, 16-bit linear PCM, mono. Optimized for Indian accents, regional dialects, and Malayalam-English code-mixing ("Manglish"). |
| **Conversational LLM** | `sarvam-105b-conversations` | `https://api.sarvam.ai/v1/chat/completions` | Context-aware dialogue model prompt-tuned for clinical front-desk triage and OPD scheduling. |
| **Text-to-Speech (TTS)** | `bulbul:v3` | `https://api.sarvam.ai/text-to-speech` | Multilingual neural speech synthesis. Configured for Malayalam female speaker (`speaker: "meera"`), sample rate 8000 Hz, pacing `1.15x`. |

---

## 3. Daya Hospital Voice Agent Deployment Configuration

The authoritative configuration for Daya Hospital's voice agent is defined in [src/lib/integrations/sarvam/daya-agent-config.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/lib/integrations/sarvam/daya-agent-config.ts):

- **Agent Name:** Daya Hospital OPD Voice Assistant (`SMRKO VOICE`)
- **Agent ID:** `37a5beaa-50b5-4428-b996-857502e6c5ee`
- **Active Version ID:** `a93165b5-12cf-4b68-b80c-03d3ceb43cb6`
- **Primary Language:** Malayalam (`ml-IN`)
- **Fallback / Secondary Language:** Indian English (`en-IN`)
- **Pacing:** `1.15x`
- **Greeting Message:**
  ```text
  Namaskaram! Daya General Hospital-ilekku swagatham. Njan SMRKO VOICE assistant aanu. 
  Doctor appointment book cheyyano, atho matenthenkilum vivarangal ariyano?
  ```

---

## 4. SMRKO VOICE Webhook Tool Endpoints

When operating under `SARVAM_VOICE_AGENTS`, Sarvam calls the following authenticated tools hosted on Smrkomed:

| Tool Name | Endpoint | Method | Key Parameters | Response Details |
|---|---|:---:|---|---|
| **`get-doctors`** | `/api/v1/voice-agent/doctors` | `GET` | `department`, `query` | List of doctors with consultation fees and room numbers. |
| **`check-availability`** | `/api/v1/voice-agent/check-availability` | `POST` | `doctorId`, `doctorName`, `date` | Available OPD slot times. Fails closed (503) if HMS is down. |
| **`book-appointment`** | `/api/v1/voice-agent/book-appointment` | `POST` | `doctorId`, `slot`, `patientName`, `patientPhone` | Generates booking reference (e.g. `DAYA-HMS-OPD-42294`) and OPD token number. |
| **`reschedule-appointment`** | `/api/v1/voice-agent/reschedule-appointment` | `POST` | `bookingRef`, `targetDate`, `targetSlotTime` | Confirms rescheduled slot and updates HMS. |
| **`cancel-appointment`** | `/api/v1/voice-agent/cancel-appointment` | `POST` | `bookingRef`, `reason` | Releases reserved slot and cancels booking in HMS. |
| **`get-appointment`** | `/api/v1/voice-agent/get-appointment` | `GET` | `bookingRef`, `patientPhone` | Returns existing booking details. |
| **`emergency-escalate`** | `/api/v1/voice-agent/emergency-escalate` | `POST` | `callSid`, `symptom`, `triageLevel` | Records emergency triage decision and triggers immediate casualty transfer. |

---

## 5. Security & Webhook Signature Verification

All incoming webhooks from Sarvam (`/api/webhooks/sarvam`) are cryptographically verified using **timing-safe HMAC-SHA256**:
- **Header:** `X-Sarvam-Signature`
- **Signing Secret:** `SARVAM_WEBHOOK_SECRET`
- **Algorithm:**
  ```typescript
  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawPayloadString)
    .digest("hex");
  const isValid = crypto.timingSafeEqual(
    Buffer.from(signatureHeader),
    Buffer.from(expectedSignature)
  );
  ```
Unsigned or invalid payloads are rejected with HTTP 401 Unauthorized before any business logic executes.

---

## 6. Language & Audio Processing Details

1. **Manglish Understanding:** Sarvam's models are specifically fine-tuned for code-mixed speech common in Kerala, recognizing colloquial phonetic words (e.g., *"Doctor-ine kaanan pattuvan"* -> Doctor consultation request).
2. **Barge-In (Interruption Handling):** When caller speaks while SMRKO VOICE is speaking, the media gateway's audio engine detects energy in the input stream, immediately cancels speech generation, and sends `{ event: "clear" }` to Exotel to silence the telephony bridge within < 120ms.
3. **Fail-Closed Fallback:** If the Sarvam API key is missing or calls fail, the gateway logs `SARVAM_CONNECTION_FAILED` and falls back to playing local clinical audio prompts ([scripts/validation/audio_output/](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/scripts/validation/audio_output/)) or initiating human receptionist transfer.
