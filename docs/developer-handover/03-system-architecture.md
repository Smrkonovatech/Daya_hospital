# 03 — Complete System Architecture & Workflows

This document details the software architecture, runtime orchestration, communication protocols, and control flows of **Smrkomed / SMRKO VOICE**, supported by 8 source-code-verified Mermaid diagrams.

---

## 1. Overall System Architecture

The platform consists of five interconnected subsystems:
1. **Cloud Telephony Carrier (Exotel):** Ingests PSTN phone calls on virtual hospital DIDs (ExoPhones), runs IVR logic, and bridges audio streams.
2. **Real-Time Persistent Media Gateway:** Persistent Node.js container handling bidirectional WebSocket audio (`/exotel/voicebot`), low-latency connect queries (`/exotel/connect-destination`), and speech pipeline coordination.
3. **Application & Management Portal (Next.js 16):** Serves the hospital management dashboard, clinical review player, configuration versioning, and secure RESTful tool endpoints.
4. **AI Speech & Dialogue Intelligence (Sarvam AI):** Multilingual Indian AI providing STT, conversational LLM reasoning, and TTS synthesis.
5. **Hospital Systems & Storage:** Neon Serverless PostgreSQL and Daya Hospital's Grandis HMS gateway.

```mermaid
graph TD
    subgraph "External Telephony & Users"
        Caller["Inbound Patient / Caller<br/>(PSTN / Mobile)"]
        DeskPhone["Receptionist / Casualty Phone<br/>(PSTN / SIP Extension)"]
        AdminUser["Hospital Staff / Administrator<br/>(Web Browser)"]
    end

    subgraph "Carrier Layer (Exotel Singapore)"
        ExoDID["Daya Hospital ExoPhone<br/>08047291658"]
        ExoApplet["IVR Flow Applet 1399357<br/>Connect Applet & AgentStream"]
    end

    subgraph "Smrkomed Unified Compute (Railway Linux Container)"
        subgraph "Persistent Media Gateway (Port 8080)"
            NativeHTTP["Native HTTP Server<br/>/health, /status, /connect-destination"]
            WSServer["WebSocket Server<br/>/exotel/voicebot"]
            AudioEngine["Audio Engine & Buffer Drain<br/>Linear PCM 8kHz 16-bit Mono"]
            ConvEngine["Conversation Orchestrator<br/>Barge-in & Silence Detector"]
        end

        subgraph "Next.js 16 Web Application"
            NextApp["Dashboard & Settings UI<br/>/settings, /calls, /ivr"]
            ToolAPIs["SMRKO VOICE Tool Endpoints<br/>/api/v1/voice-agent/*"]
            AuthSystem["Session & RBAC Engine<br/>daya_auth_session Token"]
        end
    end

    subgraph "AI Intelligence Layer (Sarvam AI)"
        SarvamCore["Sarvam Core APIs<br/>Saaras STT, 105B LLM, Bulbul TTS"]
        SarvamVoiceAgents["Sarvam Voice Agents Platform<br/>Managed Samvaad Agent Engine"]
    end

    subgraph "Data & Hospital Persistence"
        NeonDB[("Neon Serverless PostgreSQL<br/>29 Tables (PgBouncer Pool)")]
        GrandisHMS["Daya Grandis HMS Gateway<br/>(IPSec VPN / Fail-Closed)"]
    end

    Caller -->|"Dial Inbound"| ExoDID
    ExoDID --> ExoApplet
    ExoApplet -->|"HTTP GET /exotel/connect-destination"| NativeHTTP
    ExoApplet <-->|"Bidirectional AgentStream WS"| WSServer
    ExoApplet -->|"PSTN Transfer"| DeskPhone

    AdminUser <-->|"HTTPS"| NextApp
    WSServer <-->|"Audio Streams"| AudioEngine
    AudioEngine <--> ConvEngine
    ConvEngine <-->|"Speech APIs"| SarvamCore
    ExoApplet <-->|"Direct SIP/WS"| SarvamVoiceAgents
    SarvamVoiceAgents -->|"Webhook Tool Execution"| ToolAPIs

    NativeHTTP -->|"Query Routing"| NeonDB
    NextApp -->|"Prisma ORM"| NeonDB
    ToolAPIs -->|"Prisma & Audit Logs"| NeonDB
    ToolAPIs <-->|"Clinical Tool Calls"| GrandisHMS
```

---

## 2. Inbound Call Lifecycle

Every inbound phone call follows an authoritative lifecycle managed through Exotel webhooks, Smrkomed routing adapters, and media sessions.

```mermaid
sequenceDiagram
    autonumber
    actor Caller as Inbound Caller
    participant Exotel as Exotel Telephony Trunk
    participant Gateway as Smrkomed Media Gateway
    participant Routing as Hospital Routing Service
    participant Neon as Neon PostgreSQL
    participant Reception as Hospital Reception Desk
    participant VoiceAI as SMRKO VOICE (Sarvam)

    Caller->>Exotel: Dial Daya ExoPhone (08047291658)
    Exotel->>Gateway: GET /exotel/connect-destination (CallSid, CallTo, From, type=HUMAN_TRANSFER)
    Gateway->>Routing: resolveLiveDestination("hosp_daya_thrissur", CallSid)
    Routing->>Neon: Fetch Active Published Routing Version
    Neon-->>Routing: Active Config v1 (Timeout: 20s, Dest: +919606654032)
    Routing-->>Gateway: ResolutionResult (Destination: +919606654032, max_ringing: 20)
    Gateway-->>Exotel: HTTP 200 JSON { destination: ["+919606654032"], max_ringing_duration: 20 }
    
    alt Receptionist Answers within 20s
        Exotel->>Reception: Ring Reception Desk Phone
        Reception-->>Caller: Call Connected to Human Staff
    else Receptionist Busy / No Answer after 20s
        Exotel->>Exotel: Take Connect "Failed / Busy / No-Answer" Branch
        Exotel->>VoiceAI: Transfer to SMRKO VOICE (Applet 1393240)
        VoiceAI-->>Caller: "Namaskaram! Daya Hospital-ilekku swagatham..." (Malayalam Greeting)
    end
```

---

## 3. Exotel-to-SMRKO VOICE Integration (AgentStream vs Managed Agent)

Smrkomed implements two distinct AI voice mechanisms:
- **Architecture A (Persistent WebSocket Media Gateway):** Raw linear PCM audio chunks (320 bytes / 20ms) stream over WebSocket to [src/media-gateway/server.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/media-gateway/server.ts).
- **Architecture B (Managed Voice Agent):** Exotel routes directly to Sarvam Voice Agents (`apps.sarvam.ai`), which invokes Smrkomed REST webhooks.

```mermaid
sequenceDiagram
    autonumber
    participant Exotel as Exotel AgentStream
    participant Socket as Gateway WS Server (/exotel/voicebot)
    participant AudioEng as Audio Engine
    participant SarvamSTT as Sarvam STT (Saaras:v4)
    participant LLM as Sarvam Conversational Engine
    participant SarvamTTS as Sarvam TTS (Bulbul:v3)

    Exotel->>Socket: WS Connect { event: "connected" }
    Exotel->>Socket: { event: "start", start: { streamSid: "str_123", callSid: "call_456" } }
    Socket->>AudioEng: Initialize Media Session (8kHz Mono)
    
    loop Real-time Audio Ingestion (Caller Speaking)
        Exotel->>Socket: { event: "media", media: { payload: "<base64_pcm>" } }
        Socket->>AudioEng: Decode Base64 & Buffer PCM
        AudioEng->>SarvamSTT: Stream 3200-byte PCM chunks
        SarvamSTT-->>AudioEng: Partial & Final Transcripts ("Doctor availability...")
    end

    AudioEng->>LLM: Generate Response (Prompt + Intent Context)
    LLM-->>SarvamTTS: Stream Text ("Dr. Suresh Kumar naale labhyamanu...")
    SarvamTTS-->>AudioEng: Stream Audio Buffer
    
    loop Audio Delivery to Caller
        AudioEng->>Socket: { event: "media", streamSid: "str_123", media: { payload: "<base64_pcm>" } }
        Socket->>Exotel: Deliver Synthesized Voice to Caller
    end

    opt Caller Interrupts (Barge-In)
        Exotel->>Socket: { event: "media" } (Caller Speech Energy Detected)
        AudioEng->>Socket: { event: "clear", streamSid: "str_123" }
        Note over Socket,Exotel: Carrier Flushes In-Flight Speaker Audio Instantly
    end
```

---

## 4. Human Receptionist Fallback & Overflow Management

When human staff are occupied, calls automatically overflow to AI without dropping. Every overflow event is logged with full clinical context.

```mermaid
sequenceDiagram
    autonumber
    actor Caller as Caller
    participant Exotel as Exotel Connect
    participant Presence as Receptionist Presence Service
    participant Overflow as AI Overflow Service
    participant VoiceAI as SMRKO VOICE
    participant DB as Neon Database

    Caller->>Exotel: Call Hospital Number
    Exotel->>Presence: Check Receptionist Status
    alt Receptionist Marked OFFLINE or ON_BREAK
        Presence-->>Exotel: Skip Ringing Desk -> Immediate Overflow
    else Receptionist Available
        Exotel->>Caller: Ringing Receptionist (20s)
        Note over Exotel: Timeout or Line Busy
    end

    Exotel->>Overflow: Log Overflow Trigger (CallSid, WaitTime: 20s, Reason: NO_ANSWER)
    Overflow->>DB: INSERT INTO AiOverflowLog (tenantId, callSid, triggerReason)
    Exotel->>VoiceAI: Connect Caller to SMRKO VOICE
    VoiceAI->>Caller: Conversational Assistance & Booking
    VoiceAI->>DB: Save Transcript & Follow-Up Tasks
```

---

## 5. Emergency Escalation Workflow & Safety Guards

Emergency safety operates under strict clinical fail-closed rules.

```mermaid
flowchart TD
    StartCall(["Inbound Call Arrives"]) --> CheckType{"How is Emergency Triggered?"}
    
    CheckType -->|"DTMF Press 1"| DTMF1["IVR Menu Press 1<br/>(EMERGENCY_TRANSFER)"]
    CheckType -->|"Voice AI Triage"| NLPDetect["SMRKO VOICE NLP Detects<br/>Critical Symptoms (Chest Pain, Stroke)"]

    DTMF1 --> CheckFlag{"Is emergencyPstnTransferEnabled<br/>TRUE in Published Config?"}
    NLPDetect --> CheckFlag

    CheckFlag -->|"YES (Verified Production Trunk)"| ResolveDest["Resolve Verified Casualty Number<br/>(+919740662046)"]
    ResolveDest --> DialPSTN["Exotel Dials Casualty Direct Line<br/>(Zero Delay, Bypass All AI)"]
    DialPSTN --> StaffConnect["Casualty Nurse / Doctor Answers"]

    CheckFlag -->|"NO (Development / Temporary Receiver)"| FailClosed["TRIGGER FAIL-CLOSED SAFETY GUARD<br/>(Phase 10.14 Contract)"]
    FailClosed --> Return403["Gateway returns HTTP 403 Forbidden<br/>EMERGENCY_PSTN_TRANSFER_DISABLED_FAIL_CLOSED"]
    Return403 --> ExotelFailed["Exotel executes Applet 'Failed' Branch<br/>(Plays Recorded Emergency Broadcast)"]
    Return403 --> AuditLog["Log Urgent Audit Record in DB<br/>'CRITICAL_EMERGENCY_ESCALATION_ATTEMPT'"]
```

---

## 6. Real-Time Appointment Booking Workflow (Grandis HMS)

Clinical tool execution enforces server-side validation and fail-closed handling when real HMS connectivity is unavailable.

```mermaid
sequenceDiagram
    autonumber
    actor Caller as Patient
    participant Agent as SMRKO VOICE Agent
    participant Route as /api/v1/voice-agent/book-appointment
    participant Actions as Actions Service
    participant Client as Daya HMS Client
    participant Grandis as Grandis HMS Gateway
    participant DB as Neon Database

    Caller->>Agent: "Book slot with Dr. Suresh Kumar at 10:30 AM"
    Agent->>Route: POST { doctorId: "doc_101", date: "2026-11-28", slot: "10:30 AM", patientName: "Gopalan Nair" }
    Route->>Actions: executeAction("BOOK_APPOINTMENT", payload)
    
    Actions->>Client: bookAppointment(params)
    alt HMS VPN Connected (Production)
        Client->>Grandis: POST /api/v1/appointments
        Grandis-->>Client: HTTP 201 { bookingRef: "DAYA-HMS-OPD-42294", token: 14 }
        Client-->>Actions: StandardBookingResponse (Verified)
        Actions->>DB: INSERT INTO AiAction & CallRecord
        Actions-->>Route: HTTP 200 { success: true, bookingReference: "DAYA-HMS-OPD-42294" }
        Route-->>Agent: Confirm Booking
        Agent-->>Caller: "Booking confirmed! Reference DAYA-HMS-OPD-42294, Token 14."
    else HMS VPN Offline / Unreachable (Development Testing)
        Client-->>Client: Fetch Fails (ENOTFOUND / Timeout)
        Client-->>Actions: Throw HMS_UNAVAILABLE (Mock Fallback Blocked)
        Actions-->>Route: HTTP 503 Service Unavailable { code: "HMS_UNAVAILABLE" }
        Route-->>Agent: Action Error: Integration Unavailable
        Agent-->>Caller: "Kshemikkanam, hospital appointment system ippol labhyamalla. Receptionistodu connect cheyyam."
    end
```

---

## 7. Database & Multi-Tenant Relationship Overview

The schema is partitioned across multi-tenant configuration, telephony sessions, clinical knowledge, and staff presence.

```mermaid
erDiagram
    Hospital ||--o{ HospitalSetting : "has configuration"
    Hospital ||--o{ HospitalConfigVersion : "publishes versions"
    Hospital ||--o{ User : "employs staff"
    Hospital ||--o{ CallRecord : "records calls"
    Hospital ||--o{ AiAgent : "configures agents"
    Hospital ||--o{ IvrFlow : "owns IVR trees"
    Hospital ||--o{ StaffPresence : "tracks presence"
    Hospital ||--o{ AiOverflowLog : "tracks overflow"

    CallRecord ||--o{ TranscriptEntry : "contains dialog"
    CallRecord ||--o| RecordingMetadata : "stores audio link"
    CallRecord ||--o{ AiAction : "triggers tools"
    CallRecord ||--o{ FollowUpTask : "generates tasks"

    AiAction ||--o{ ActionEvent : "logs audit steps"

    IvrFlow ||--o{ IvrFlowVersion : "version control"
    IvrFlow ||--o{ IvrFlowExecutionSession : "executes calls"

    AiAgent ||--o{ AiAgentVersion : "version control"

    StaffPresence ||--o{ StaffPresenceAuditLog : "tracks shifts"
```

---

## 8. Deployment & Hosting Architecture

The system runs on Railway persistent compute with automated Docker/Nixpacks builds from GitHub.

```mermaid
graph TD
    subgraph "Source Control (GitHub)"
        Repo["GitHub: Smrkonovatech/Daya_hospital<br/>Branch: main (Commit ec40a9e)"]
    end

    subgraph "Railway PaaS Infrastructure"
        Webhook["Railway GitHub Webhook Trigger"]
        Builder["Docker Engine / Nixpacks Builder"]
        
        subgraph "Persistent Linux Container (Daya_hospital)"
            Entrypoint["Entrypoint: Dockerfile / npm start"]
            MediaGateway["Node.js 22 Runtime<br/>Standalone Media Gateway (Port 8080)"]
            NextServer["Next.js 16 Production Server<br/>Dynamic Route Handlers & UI"]
        end

        RailwayProxy["Railway Edge Proxy<br/>(TLS 1.3, Global Ingress)"]
        RailwayDomain["dayahospital-production-467a7d31.up.railway.app"]
    end

    subgraph "External Cloud Services"
        NeonPostgres[("Neon Serverless PostgreSQL 16<br/>AWS ap-southeast-1")]
        ExotelCloud["Exotel Telephony Cloud<br/>Singapore (api.exotel.com)"]
        SarvamCloud["Sarvam AI Platform<br/>(api.sarvam.ai / apps.sarvam.ai)"]
    end

    Repo -->|"git push origin main"| Webhook
    Webhook --> Builder
    Builder --> Entrypoint
    Entrypoint --> MediaGateway
    Entrypoint --> NextServer
    
    RailwayDomain --> RailwayProxy
    RailwayProxy -->|"Port 8080"| Entrypoint
    
    MediaGateway <-->|"PgBouncer Pool (Port 6543)"| NeonPostgres
    NextServer <-->|"Direct DB (Port 5432)"| NeonPostgres
    MediaGateway <-->|"AgentStream WebSocket"| ExotelCloud
    MediaGateway <-->|"gRPC / HTTPS STT/TTS"| SarvamCloud
```
