# 02 — Technology Stack & Dependencies

This document provides a verified, comprehensive catalog of every technology, runtime, framework, and dependency in the **Smrkomed / Daya Hospital** codebase, verified directly from [package.json](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/package.json), [next.config.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/next.config.ts), [prisma/schema.prisma](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/prisma/schema.prisma), and deployment manifests.

---

## 1. Core Runtime & Language

| Technology | Verified Version | Purpose & Architecture Location |
|---|---|---|
| **Node.js** | `v22.x` (LTS) | Runtime engine for both the Next.js server and the persistent WebSocket media gateway. Verified on Alpine Linux container (`node:22-alpine`). |
| **TypeScript** | `^5.x` | Strongly-typed language across all client UI components, API route handlers, telephony adapters, and media gateway engines. Configuration in [tsconfig.json](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/tsconfig.json). |
| **tsx** | `^4.23.15` | Fast TypeScript execution engine used to run the standalone media gateway server (`tsx src/media-gateway/server.ts`), Prisma seeds, and validation scripts without precompilation. |

---

## 2. Frontend Framework & UI Architecture

| Technology | Verified Version | Usage & Rationale |
|---|---|---|
| **Next.js** | `16.4.6` | Modern full-stack framework utilizing App Router (`src/app`). Employs Turbopack compiler, component caching (`experimental.cacheComponents: true`), and Partial Prerendering (`partialPrefetching: true`). |
| **React** | `19.3.0` | Latest React engine powering server-side components (RSC) and interactive dashboard widgets. |
| **React DOM** | `19.3.0` | DOM rendering layer for React 19. |
| **Tailwind CSS** | `^4.0.0` | Next-generation utility-first styling engine integrated via `@tailwindcss/turbopack`. Provides high-performance CSS compilation without legacy PostCSS overhead. |
| **Lucide React** | `^1.62.0` | Modern, consistent icon library used across navigation, call indicators, and status chips. |
| **Recharts** | `^3.10.1` | Declarative SVG charting library powering telephony analytics, call abandonment curves, and IVR traffic visualizations. |
| **React Hook Form** | `^7.91.0` | Lightweight form validation engine powering hospital settings, IVR flow configurations, and agent editing screens. |
| **Zod** | `^4.6.7` | TypeScript-first schema declaration and runtime data validation for forms, environment variables, and webhook payloads. |
| **CVA & Merge** | `class-variance-authority ^0.7.1`, `tailwind-merge ^3.7.0`, `clsx ^2.1.1` | Utilities for constructing composable, deterministic Tailwind UI variants. |

---

## 3. Backend & Gateway Architecture

Smrkomed employs a **dual-engine backend architecture**:
1. **Next.js HTTP Route Handlers:** Serves REST APIs (`/api/*`), hospital settings, dashboard views, and webhook handlers (`src/app/api/*`).
2. **Persistent WebSocket Media Gateway:** A dedicated Node.js service ([src/media-gateway/server.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/media-gateway/server.ts)) listening on port `8080` (or dynamic `$PORT`). It terminates Exotel Voicebot / AgentStream connections, processes raw PCM audio, and coordinates speech pipelines.

| Technology | Verified Version | Usage & Location |
|---|---|---|
| **`ws`** | `^8.23.0` | High-performance native WebSocket library powering bidirectional streaming audio between Exotel AgentStream and SMRKO VOICE (`/exotel/voicebot`). |
| **Native HTTP** | Node.js Built-in | Used in [src/media-gateway/server.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/media-gateway/server.ts) to provide low-latency health endpoints (`/health`, `/status`) and synchronous carrier connect routing (`/exotel/connect-destination`). |

---

## 4. Database & ORM

| Technology | Specification | Details |
|---|---|---|
| **Database** | PostgreSQL 16 (Neon Serverless) | Hosted in AWS `ap-southeast-1` (Singapore) for sub-25ms latency with Exotel Singapore and Sarvam. |
| **Connection Pooler** | PgBouncer | Port `6543` pooled connection string (`DATABASE_URL`) with SSL mode required. Direct unpooled connection on port `5432` (`DIRECT_URL`) for migrations. |
| **ORM** | Prisma `6.19.3` | Type-safe ORM defining 29 models, handling migrations ([prisma/schema.prisma](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/prisma/schema.prisma)), relation mapping, and typed database client generation. |

---

## 5. Telephony Integration (Carrier Layer)

| Component | Provider / Standard | Details |
|---|---|---|
| **Cloud Carrier** | **Exotel Telephony Cloud** | Singapore region (`api.exotel.com`). Account SID: `smrkonova1`. ExoPhone: `08047291658`. |
| **Applet Flow** | Programmable Connect & Passthru | Staging Voicebot Applet `1393240`; Pilot IVR Applet `1399357`. |
| **Audio Format** | Linear PCM / WAV | 8000 Hz, 16-bit Mono (telephony standard `audio/x-l16`). |
| **Streaming Protocol** | Exotel AgentStream (WebSocket) | Bidirectional binary JSON events (`start`, `media`, `dtmf`, `stop`). |

---

## 6. AI Voice & Speech Intelligence (SMRKO VOICE)

| Component | Model / Engine | Details |
|---|---|---|
| **Speech-to-Text (STT)** | `saaras:v4` / `saaras:v2` | Sarvam AI streaming Indian accent & multilingual Malayalam/English speech recognition. |
| **Conversational LLM** | `sarvam-105b-conversations` | Context-aware regional dialogue model with medical system prompting. |
| **Text-to-Speech (TTS)** | `bulbul:v3` / `bulbul:v1` | Natural multilingual speech synthesis with controllable speaker pacing (`1.15x`). |
| **Agent Platform** | Sarvam Voice Agents (Samvaad) | Managed voicebot orchestrator (`apps.sarvam.ai`) interacting via webhook tools. |

---

## 7. Hospital Information System (HMS)

| Component | Specification | Details |
|---|---|---|
| **Production Target** | **Grandis HMS** | Daya Hospital's internal hospital management software. |
| **Connectivity** | IPSec / Site-to-Site VPN | Requires dedicated hospital VPN gateway; fail-closed behavior active when offline. |
| **Adapter Contract** | `IHmsConnector` | [src/lib/integrations/hms/standard-hms-types.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/lib/integrations/hms/standard-hms-types.ts) defining doctor, slot, and booking contracts. |
| **Testing Sandbox** | `MockDayaHmsAdapter` | Isolated memory fixture used strictly for unit testing and offline development. |

---

## 8. Testing & Quality Assurance

| Framework | Verified Version | Purpose |
|---|---|---|
| **Vitest** | `^5.0.5` | Blazing-fast Vite-native test runner executing unit tests, synthetic telephony contracts, and fail-closed HMS tests. Configuration in [vitest.config.mjs](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/vitest.config.mjs). |
| **Testing Library** | `@testing-library/react ^16.3.3`, `@testing-library/jest-dom ^7.0.1` | Component testing and DOM assertions. |
| **JSDOM** | `^30.1.3` | Headless browser environment simulating client window and DOM APIs for tests. |

---

## 9. Build, Package Management & Overrides

| Tool | Version / Spec | Notes |
|---|---|---|
| **Package Manager** | `npm` (v10.9.x+) | Standard dependency resolution via `package-lock.json`. |
| **Dependency Overrides** | `deepmerge-ts: ^8.0.2`, `effect: ^3.22.5` | Declared in `package.json` to resolve transitive dependency typing conflicts in Next.js 16. |
| **Linter** | ESLint 9 (`eslint-config-next 16.4.6`) | Static code analysis and linting ([eslint.config.mjs](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/eslint.config.mjs)). |
