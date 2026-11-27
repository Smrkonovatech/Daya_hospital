# 17 — First-Day Checklist for Incoming Software Developer

This actionable checklist is designed to guide a software engineer through their first 4–8 hours on **Smrkomed / Daya Hospital**.

---

## Developer First-Day Punchlist

### Phase 1: Repository & Documentation Onboarding (Hour 1)
- [ ] **Clone Codebase:** Clone `https://github.com/Smrkonovatech/Daya_hospital.git` to your local machine.
- [ ] **Verify Git Branch:** Run `git status` and `git log -1`. Confirm you are on branch `main` at commit `ec40a9e` with a clean working tree.
- [ ] **Read Project Overview:** Read [01-project-overview.md](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/docs/developer-handover/01-project-overview.md) to understand Smrkomed's business mission, caller journeys, and pilot hospital scope.
- [ ] **Review Executive Status:** Read [PROJECT_STATUS.md](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/docs/developer-handover/PROJECT_STATUS.md) to identify what is live and what is currently blocked.

---

### Phase 2: Local Environment Configuration (Hour 2)
- [ ] **Check Node.js Version:** Run `node -v`. Confirm Node.js is `v22.x` (or `v20.x` minimum).
- [ ] **Install Dependencies:** Run `npm install` and verify Prisma Client generates without errors.
- [ ] **Create Local Environment File:** Copy `.env.example` to `.env.local`.
- [ ] **Configure Offline Sandbox Flags:** In `.env.local`, set:
  ```env
  HMS_ENVIRONMENT="simulation"
  DAYA_HMS_SIMULATION="true"
  ```
  *(This allows running tests and features locally without requiring hospital VPN credentials).*

---

### Phase 3: Database & Code Quality Validation (Hour 3)
- [ ] **Configure Database Connection:** Add development PostgreSQL / Neon connection strings to `DATABASE_URL` and `DIRECT_URL`.
- [ ] **Check Migration Status:** Run `npx prisma migrate status`. Verify all 7 migrations are applied.
- [ ] **Run TypeScript Validation:** Run `npx tsc --noEmit`. Verify output reports `0 errors`.
- [ ] **Execute Automated Tests:** Run `npm test`. Verify all 31 automated tests pass across recording streams, fail-closed HMS, and voice agent actions.
- [ ] **Execute Production Build:** Run `npm run build`. Confirm Turbopack compiles all 113 routes with exit code `0`.

---

### Phase 4: Local Application Exploration (Hour 4)
- [ ] **Start Next.js App:** Run `npm run dev` and navigate to `http://localhost:3000`.
- [ ] **Inspect Calls Log:** Open `http://localhost:3000/calls` and test audio playback on existing records.
- [ ] **Inspect IVR Flow Builder:** Open `http://localhost:3000/ivr` to view visual DTMF routing trees.
- [ ] **Inspect Knowledge Base:** Open `http://localhost:3000/knowledge` to review clinical FAQ entries.
- [ ] **Start Persistent Media Gateway (Optional):** Run `npm run gateway:start` in a separate terminal and probe `http://localhost:8080/health`.

---

### Phase 5: Cloud Deployment & Architecture Verification (Hour 5)
- [ ] **Probe Live Railway Health:**
  ```bash
  curl https://dayahospital-production-467a7d31.up.railway.app/health
  # Confirm readiness is "READY" and database is "connected"
  ```
- [ ] **Probe Live Railway Status:**
  ```bash
  curl https://dayahospital-production-467a7d31.up.railway.app/status
  # Confirm status is "ONLINE" and mockModeBlocked is true
  ```
- [ ] **Execute Synthetic Dynamic Routing Probe:**
  ```bash
  npx tsx scripts/validation/verify_phase_10_12_contracts.ts
  # Confirm primary Connect URL returns HTTP 200 with dynamic receptionist destination
  ```

---

### Phase 6: Understand Core Blockers & Technical Debt (Hour 6)
- [ ] **Review HMS VPN Status:** Read [08-grandis-hms-integration.md](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/docs/developer-handover/08-grandis-hms-integration.md). Understand why the system currently fails closed with HTTP 503 on live hospital bookings.
- [ ] **Review Carrier Recording Upstream:** Read [13-current-status-and-known-issues.md](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/docs/developer-handover/13-current-status-and-known-issues.md#issue-1). Understand why the 5 legacy recordings point to unreachable domains and what is needed to retrieve live carrier audio.
- [ ] **Review Developer Roadmap:** Read [16-developer-roadmap.md](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/docs/developer-handover/16-developer-roadmap.md) to align on your tasks for Week 1.
