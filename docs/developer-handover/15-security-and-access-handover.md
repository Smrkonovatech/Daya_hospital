# 15 — Security Governance & Access Handover

This document outlines the security architecture, credential governance, access management, and patient privacy standards for **Smrkomed / Daya Hospital**.

---

## 1. Cloud Provider Access Requirements

The incoming software engineering lead or development team will require access to the following platforms:

| Platform / Service | Environment Role | Appropriate Permission Level | Why Access Is Required |
|---|---|---|---|
| **GitHub** | Code Repository | `Maintainer` / `Write` | Pushing features and bug fixes to `main` branch on `Smrkonovatech/Daya_hospital`. |
| **Railway PaaS** | Compute & Deployment | `Developer` / `Admin` | Managing environment variables, monitoring container runtime logs, inspecting `/health` metrics, and executing rollback actions on project `ravi-rebirth`. |
| **Neon Console** | Database Host | `Developer` / `Admin` | Managing Postgres 16 branches, reviewing slow queries, inspecting PgBouncer connection pooling, and provisioning dev DBs. |
| **Exotel Console** | Cloud Telephony | `Admin` / `Developer` | Managing account `smrkonova1`, configuring Connect Applet URLs, auditing ExoPhone `08047291658`, and reviewing carrier Call Detail Records (CDRs). |
| **Sarvam AI Console** | Speech & AI Agents | `Developer` | Managing API subscriptions (`api.sarvam.ai`), configuring Voice Agent deployments (`apps.sarvam.ai`), and updating clinical knowledge syncs. |
| **DNS / Domain Registrar** | Ingress Routing | `DNS Manager` | Configuring CNAME and SSL records for custom domains (e.g., `voice.smrkomed.com`, `daya.smrkomed.com`). |

> [!IMPORTANT]
> **Credential Delivery Method:** Never transmit passwords, API keys, or database connection strings over plain email, chat, or GitHub issues. Use an encrypted enterprise password manager (such as **1Password**, **Bitwarden**, or native provider IAM invitations).

---

## 2. Recommended Secret Rotation Protocol

During a developer or team transition, the following production credentials should be systematically rotated:

| Secret Identifier | Impacted Service | Rotation Procedure |
|---|---|---|
| **`NEXTAUTH_SECRET`** | Web Dashboard Session Signer | Generate new 32-byte secret (`openssl rand -base64 32`) and update in Railway variables. (Users will need to log in again). |
| **`EXOTEL_API_TOKEN`** | Cloud Telephony Carrier | Generate new API Token in Exotel Dashboard -> Update in Railway variables -> Test outbound call stub. |
| **`SARVAM_API_KEY`** | Core Speech APIs (STT / TTS) | Generate new key in Sarvam Console -> Update in Railway variables -> Probe `/health`. |
| **`SARVAM_WEBHOOK_SECRET`** | Voice Agent Signature Signer | Update secret in Sarvam Samvaad webhook panel -> Update in Railway variables. |
| **`DAYA_HMS_API_KEY`** | Hospital Information Gateway | Coordinate with Daya Hospital IT to issue a new client token before going live. |
| **Neon Database Password** | PostgreSQL Storage | Reset user password in Neon Console -> Update both `DATABASE_URL` and `DIRECT_URL` in Railway. |

---

## 3. Patient Data Privacy & Telephony Security

Healthcare voice systems process sensitive patient data. Smrkomed enforces several protective architectural measures:

### 3.1 Masked Telephone Numbers
In clinical dashboard views ([src/app/calls/page.tsx](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/app/calls/page.tsx)), patient phone numbers are partially redacted (e.g., `+91 98461 •••••`) to prevent casual data harvesting by desk staff while retaining identification capabilities for clinical supervisors.

### 3.2 Recording Access Control (RBAC)
Audio recordings of patient phone calls are protected by cryptographic session checks in [src/app/api/calls/[callId]/recording/route.ts](file:///c:/Users/mohit/Downloads/daya/Daya_hospital/src/app/api/calls/[callId]/recording/route.ts):
- Requests require a valid `daya_auth_session` cookie or `Authorization: Bearer <token>`.
- Users must hold the `HOSPITAL_ADMIN` role or have `canAccessRecordings: true` explicitly granted on their user profile.
- Unauthenticated or unauthorized requests fail with HTTP 401 / 403.

### 3.3 Webhook Cryptographic Verification
Carrier and AI callbacks are protected against unauthorized injection:
- **Sarvam Webhooks (`/api/webhooks/sarvam`):** Verified using **timing-safe HMAC-SHA256** signatures (`X-Sarvam-Signature`).
- **Exotel Webhooks (`/api/webhooks/exotel`):** Verified using shared account secrets and IP origin checks.

### 3.4 Multi-Tenant Boundary Enforcement
The application strictly prevents cross-tenant data leaks:
- All database queries filter by tenant `hospitalId`.
- Inbound telephony queries cross-verify dialed ExoPhones (`CallTo`) against the requested tenant. Mismatched queries fail closed with HTTP 403 `TENANT_MISMATCH_FORBIDDEN`.
- Demo sandbox tenants (e.g., Aster Medcity, KIMS) fail closed on live carrier calls.
