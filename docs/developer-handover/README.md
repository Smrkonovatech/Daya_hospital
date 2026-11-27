# Smrkomed / Daya Hospital — Technical Developer Handover

**Welcome to Smrkomed.**

This directory contains the authoritative, production-grade technical handover documentation for the **Smrkomed** hospital telephony, IVR, and AI voice automation platform (featuring **SMRKO VOICE**), pilot-deployed for **Daya General Hospital & Specialty Surgical Centre**, Thrissur, Kerala.

This documentation is written for an incoming senior software engineer, architect, or development team taking over engineering ownership of the repository.

---

## Handover Package Structure

| # | Document | Primary Scope |
|---|---|---|
| **00** | [PROJECT_STATUS.md](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/docs/developer-handover/PROJECT_STATUS.md) | **Executive Summary**: Working vs pending features, blockers, and deployment status |
| **01** | [01-project-overview.md](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/docs/developer-handover/01-project-overview.md) | **Product Overview**: Mission, business problem, caller journey, users, and multi-tenant vision |
| **02** | [02-technology-stack.md](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/docs/developer-handover/02-technology-stack.md) | **Tech Stack**: Frameworks, versions, libraries, runtime environments, and rationale |
| **03** | [03-system-architecture.md](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/docs/developer-handover/03-system-architecture.md) | **Architecture & Workflows**: 8 complete Mermaid diagrams covering call lifecycles, failovers, and streaming |
| **04** | [04-codebase-directory-guide.md](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/docs/developer-handover/04-codebase-directory-guide.md) | **Directory Map**: File-by-file responsibilities across `src/app`, `src/lib`, and `src/media-gateway` |
| **05** | [05-database-and-data-model.md](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/docs/developer-handover/05-database-and-data-model.md) | **Database & Data Model**: 29 Prisma models, Mermaid ER diagram, Neon PostgreSQL setup, and migrations |
| **06** | [06-telephony-exotel-integration.md](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/docs/developer-handover/06-telephony-exotel-integration.md) | **Carrier Telephony**: Exotel Singapore trunk, Connect applets, Passthru routing, AgentStream, and recordings |
| **07** | [07-ai-voice-sarvam-integration.md](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/docs/developer-handover/07-ai-voice-sarvam-integration.md) | **AI Voice (SMRKO VOICE)**: Sarvam Core (STT/TTS/LLM) vs Sarvam Voice Agents (Samvaad) platform |
| **08** | [08-grandis-hms-integration.md](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/docs/developer-handover/08-grandis-hms-integration.md) | **Hospital System (HMS)**: Grandis HMS adapter, VPN requirements, fail-closed contracts, and simulation sandbox |
| **09** | [09-environment-variables.md](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/docs/developer-handover/09-environment-variables.md) | **Configuration Reference**: Complete environment catalog (variables, usage, requirements, no secrets) |
| **10** | [10-local-development-setup.md](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/docs/developer-handover/10-local-development-setup.md) | **Local Setup**: Step-by-step onboarding, offline development, database connection, and build validation |
| **11** | [11-testing-and-qa.md](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/docs/developer-handover/11-testing-and-qa.md) | **Testing & QA**: Vitest test suites, synthetic carrier probes, HMS tests, and regression commands |
| **12** | [12-deployment-and-infrastructure.md](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/docs/developer-handover/12-deployment-and-infrastructure.md) | **Cloud Infrastructure**: Railway persistent container, Nixpacks/Docker builds, Neon pool, and DNS |
| **13** | [13-current-status-and-known-issues.md](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/docs/developer-handover/13-current-status-and-known-issues.md) | **Audit & Known Issues**: Prioritized audit of technical debt, blocked carrier recordings, and VPN dependencies |
| **14** | [14-git-history-and-development-timeline.md](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/docs/developer-handover/14-git-history-and-development-timeline.md) | **Development Timeline**: Chronological commit log, major phase milestones, and Git working state |
| **15** | [15-security-and-access-handover.md](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/docs/developer-handover/15-security-and-access-handover.md) | **Security & Access**: Access permissions checklist, secret rotation advice, HIPAA/data privacy, and tenant isolation |
| **16** | [16-developer-roadmap.md](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/docs/developer-handover/16-developer-roadmap.md) | **Implementation Roadmap**: Prioritized deliverables from Day 1 to Production rollout |
| **17** | [17-first-day-checklist.md](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/docs/developer-handover/17-first-day-checklist.md) | **First-Day Checklist**: Quick-start execution punchlist for the incoming developer |

---

## Essential Orientation for the Incoming Developer

1. **Official White-Label Branding:**
   - **Company / Platform:** Smrkonova / Smrkomed
   - **AI Intelligence Suite:** Smrko AI
   - **Voice Product:** **SMRKO VOICE** (featuring multilingual Saarathi & Samvaad models)
   - **Pilot Customer / Tenant:** Daya General Hospital & Specialty Surgical Centre (`hosp_daya_thrissur`).

2. **Repository & Active Branch:**
   - **GitHub:** `Smrkonovatech/Daya_hospital`
   - **Active Branch:** `main`
   - **Working Tree:** Clean, fully committed, and in sync with `origin/main`.
   - **Latest Commit:** `ec40a9e` (*"fix: resolve Next.js cacheComponents route build error"*).

3. **Active Cloud Services:**
   - **Persistent Web & Gateway Host:** `https://dayahospital-production-467a7d31.up.railway.app`
   - **Database:** Serverless PostgreSQL on Neon (`ap-southeast-1` Singapore pool).
   - **Telephony Provider:** Exotel Singapore (`smrkonova1`, virtual number `08047291658`).
   - **AI Voice Provider:** Sarvam AI (Core speech models + Samvaad Voice Agents platform).

---

> [!IMPORTANT]
> **Safety Notice:** Do not make PSTN calls or modify live carrier applets during exploration. The platform enforces fail-closed routing for unverified tenants and unauthenticated callers. Always consult [10-local-development-setup.md](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/docs/developer-handover/10-local-development-setup.md) to develop safely against local or synthetic stubs.
