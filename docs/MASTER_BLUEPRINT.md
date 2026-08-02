# VoteWise Master Blueprint v1.0

> **The single source of truth for the VoteWise Election Management Platform.**
>
> This document consolidates the complete specification from Chapters 1–18 into
> one structured reference for developers, designers, QA engineers, DevOps
> engineers, AI coding agents, and project managers.
>
> **Status:** Production-Ready · **Version:** 1.0 · **Last Updated:** August 2026

---

## Table of Contents

1. [Product Vision and Business Goals](#1-product-vision-and-business-goals)
2. [Functional Requirements](#2-functional-requirements)
3. [System Architecture](#3-system-architecture)
4. [Database Design](#4-database-design)
5. [UI/UX Flows](#5-uiux-flows)
6. [Security Architecture](#6-security-architecture)
7. [Fraud Prevention Model](#7-fraud-prevention-model)
8. [Multi-Tenant Architecture](#8-multi-tenant-architecture)
9. [Organization Hierarchy](#9-organization-hierarchy)
10. [Communication System](#10-communication-system)
11. [Reporting and Analytics](#11-reporting-and-analytics)
12. [Billing and Subscriptions](#12-billing-and-subscriptions)
13. [Platform Administration](#13-platform-administration)
14. [API Specifications](#14-api-specifications)
15. [Infrastructure and Deployment](#15-infrastructure-and-deployment)
16. [Testing and Certification](#16-testing-and-certification)
17. [Glossary](#17-glossary)
18. [Implementation Roadmap](#18-implementation-roadmap)

---

## 1. Product Vision and Business Goals

### Vision

VoteWise is Africa's most trusted election management platform — a cloud-native, multi-tenant SaaS that enables any organization (universities, companies, churches, NGOs, cooperatives, trade unions, government agencies) to conduct secure, transparent, and real-time elections.

### Mission Statement

> Democracy should be accessible to everyone. VoteWise makes trusted elections possible for every organization, from a 200-member club to a 60,000-student university.

### Business Goals

| Goal | Metric | Target |
|------|--------|--------|
| Reliability | Uptime | 99.99% |
| Scale | Concurrent voters | 1,000,000 |
| Integrity | Vote loss | 0 |
| Trust | Certification | ISO 27001 + SOC 2 |
| Accessibility | WCAG compliance | 2.1 AA |
| Performance | p95 latency | < 500ms |

### Core Values

1. **Integrity** — every vote is encrypted, signed, and auditable
2. **Transparency** — observers monitor every step; results are verifiable
3. **Accessibility** — democracy must be accessible to all
4. **Reliability** — the platform must survive election day
5. **Trust** — certification seals prove the election was fair

---

## 2. Functional Requirements

### Core Modules (18 Chapters)

| Ch. | Module | Code | Description |
|-----|--------|------|-------------|
| 1 | Multi-Tenant Foundation | — | Organization hierarchy, RBAC, workspace |
| 2 | Election Configuration | — | Election creation, positions, candidates, rules |
| 3 | Voter Registry | — | Import, eligibility, verification |
| 4 | Voter Authentication | — | OTVP (One-Time Vote Password), MFA |
| 5 | Ballot Design | — | Dynamic ballot builder, randomization |
| 6 | Vote Casting & Receipts | — | Encrypted voting, receipt generation |
| 7 | Live Results & Transparency | — | Real-time tally, public results |
| 8 | Observer & Audit System | — | Observer monitoring, audit trails |
| 9 | Result Collation & Certification | — | Collation, risk-limiting audit, certification |
| 10 | Secure Voting Engine (SVE) | `sve` | AES-256-GCM, HMAC, tally, receipts |
| 11 | Election Integrity & Fraud Detection (EIFDIRS) | `eifdirs` | 8 detectors, risk scorer, incident lifecycle |
| 12 | Communication & Notifications (CNSE) | `cnse` | Multi-channel (Email/SMS/WhatsApp), templates |
| 13 | Reporting & Analytics (RAEI) | `raei` | 8 report types, AI insights, replay studio |
| 14 | Billing & Subscriptions (BSPCM) | `bspcm` | Pricing engine, Paystack/Flutterwave, invoices |
| 15 | Platform Administration (PAOEM) | `paoem` | Org management, feature flags, maintenance |
| 16 | API & Developer Platform (AIDP) | `aidp` | API keys, webhooks, OAuth, integrations |
| 17 | Production Infrastructure (PIHD) | `pihed` | Docker, K8s, Terraform, CI/CD, monitoring |
| 18 | Testing & Certification (TQASGR) | `tqasgr` | Test suites, checklists, compliance, seals |

### User Roles

| Role | Scope | Capabilities |
|------|-------|-------------|
| `PLATFORM_SUPER_ADMIN` | Platform | Everything — all orgs, all elections |
| `SUPER_ADMIN` | Organization | Manage org elections, officials, voters |
| `ELECTORAL_COMMITTEE` | Organization | Manage elections, candidates, positions |
| `FACULTY_OFFICER` | Faculty | Faculty-scoped election management |
| `DEPARTMENT_OFFICER` | Department | Department-scoped election management |
| `OBSERVER` | Assigned elections | Monitor, review events, submit reports |
| `VOTER` | Self only | Vote once, verify receipt |

---

## 3. System Architecture

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS 4, shadcn/ui, Framer Motion |
| Backend | Next.js API Routes, Prisma ORM |
| Database | PostgreSQL 16 (SQLite in sandbox) |
| Cache | Redis 7 (in-memory fallback) |
| Real-time | Socket.io (results-service, port 3030) |
| Auth | NextAuth.js v4, JWT (HS256), HttpOnly cookies |
| Encryption | AES-256-GCM (votes), HMAC-SHA256 (signatures), SHA-256 (hashing) |
| Container | Docker (multi-stage builds) |
| Orchestration | Kubernetes (EKS/AKS/GKE) or Docker Compose |
| IaC | Terraform |
| CI/CD | GitHub Actions |
| Monitoring | Sentry, CloudWatch, SLO tracking |
| CDN | Cloudflare |
| Load Balancer | Caddy / AWS ALB / NGINX ingress |

### Service Decomposition

```
┌─────────────────────────────────────────────────────────────┐
│                     Cloudflare CDN + WAF                     │
├─────────────────────────────────────────────────────────────┤
│                    Load Balancer (Caddy/ALB)                 │
├──────────────┬──────────────┬──────────────┬────────────────┤
│   App (×3)   │ Results (×2) │ Worker (×2)  │ Scheduler (×1) │
│  Next.js     │  Socket.io   │  Job queue   │  Cron jobs     │
├──────────────┴──────────────┴──────────────┴────────────────┤
│  Notification (×2)  │  Fraud Engine (×1)  │  Analytics (×1) │
├─────────────────────────────────────────────────────────────┤
│              PostgreSQL (Multi-AZ) + Read Replica            │
├─────────────────────────────────────────────────────────────┤
│         Redis (Multi-AZ)    │    S3 Object Storage           │
├─────────────────────────────────────────────────────────────┤
│           Monitoring · Logging · Alerting · SLOs             │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Database Design

### Schema Overview

The Prisma schema (`prisma/schema.prisma`) contains **80+ models** organized by chapter:

| Domain | Models | Key Tables |
|--------|--------|-----------|
| Organization | 8 | `Organization`, `OrganizationMember`, `OrganizationBrand`, `OrganizationSubscription` |
| Election | 12 | `ElectionSession`, `Position`, `Candidate`, `Voter`, `VoteRecord`, `CandidateTally` |
| Security (SVE) | 6 | `VoteRecord`, `VoteReceipt`, `Ballot`, `CandidateTally` |
| Integrity (EIFDIRS) | 4 | `IntegrityEvent`, `FraudIncident`, `ElectionLock`, `IntegrityCertificate` |
| Communication (CNSE) | 4 | `MessageTemplate`, `MessageQueue`, `Announcement`, `KnowledgeBaseArticle` |
| Analytics (RAEI) | 2 | `ObserverReport`, `DataRetentionPolicy` |
| Billing (BSPCM) | 9 | `PricingPlan`, `Quote`, `Invoice`, `Payment`, `Coupon`, `Refund` |
| Platform (PAOEM) | 3 | `FeatureFlag`, `MaintenanceMode`, `PlatformBroadcast` |
| API (AIDP) | 6 | `ApiKey`, `OAuthClient`, `Webhook`, `WebhookDelivery`, `Integration`, `ApiLog` |
| Infrastructure (PIHD) | 10 | `ReadinessRun`, `SystemMetric`, `BackupRecord`, `DeploymentRecord`, `CustomDomain`, `UptimeRecord`, `LogEntry`, `AlertRule`, `AlertEvent`, `CostRecord`, `SloDefinition`, `SloSample`, `Postmortem`, `ScheduledMaintenance` |
| Testing (TQASGR) | 10 | `TestSuite`, `TestCase`, `TestRun`, `ReleaseChecklist`, `GoLiveChecklist`, `PilotElection`, `ComplianceFramework`, `CertificationSeal`, `UatSession`, `ReleaseTrack`, `DocValidation` |

### Key Design Decisions

1. **Multi-tenancy**: Every table has `organizationId` for tenant isolation
2. **Soft deletes**: Critical records (votes, audit logs) are never deleted
3. **Audit trail**: `AuditEvent` records every state change
4. **Encryption at rest**: Votes encrypted with AES-256-GCM before storage
5. **WAL mode**: SQLite WAL for concurrent reads (PostgreSQL in production)
6. **Connection pooling**: RDS Proxy in production

---

## 5. UI/UX Flows

### Key User Journeys

**Organization Admin Journey:**
```
Register → Create Org → Configure Branding → Import Voters →
Create Election → Add Candidates → Pay → Go Live (readiness gate)
```

**Voter Journey:**
```
Login → Receive OTVP → Verify Identity → View Ballot →
Cast Vote → Receive Receipt → Verify Receipt
```

**Observer Journey:**
```
Login → Monitor Election → Review Integrity Events →
Flag Incidents → Submit Report → Sign Final Report
```

### Design System

- **Palette**: Emerald (primary), Gold (accent), Amber (warning), Zinc (neutral), Red (danger)
- **No indigo/blue** (brand differentiation)
- **Dark theme** default
- **`votewise-card-glow`** utility for prominent cards
- **Mobile-first** responsive
- **Framer Motion** for animations
- **shadcn/ui** (New York style) components

### Key Pages

| Route | Purpose |
|-------|---------|
| `/` | Homepage (marketing) |
| `/status` | Public platform status (90-day uptime, incidents) |
| `/workspace?org=` | Organization workspace dashboard |
| `/workspace/elections/[id]` | Election management |
| `/admin` | Admin dashboard |
| `/admin/operations` | Platform operations center (6 tabs) |
| `/admin/infrastructure` | Infrastructure console (12 tabs) |
| `/admin/quality` | QA console (6 tabs) |
| `/certify/[id]` | Public certification verification |

---

## 6. Security Architecture

### Encryption

| Layer | Algorithm | Usage |
|-------|-----------|-------|
| Vote encryption | AES-256-GCM | Ballot encryption before storage |
| Signatures | HMAC-SHA256 | Ballot integrity, certification seals |
| Password hashing | bcrypt + PEPPER | Voter password hashing |
| Transport | TLS 1.3 | All HTTP connections |
| At rest | AES-256 | Database, S3, backups |

### Required Secrets (5)

1. `VOTE_ENC_KEY` — AES-256 vote encryption key
2. `VOTER_HASH_PEPPER` — Voter identity hashing pepper
3. `HMAC_SECRET` — HMAC signature secret
4. `SVE_BALLOT_PEPPER` — Ballot anonymization pepper
5. `SVE_VOTER_PEPPER` — Voter record anonymization pepper

All secrets loaded from AWS Secrets Manager in production (never in code).

### Authentication

- JWT access tokens (15-minute TTL, HS256)
- Refresh tokens (7-day TTL, rotated on use)
- HttpOnly cookies (Secure + SameSite=Lax)
- MFA via TOTP (optional, recommended for admins)
- Account lockout after 5 failed attempts

### Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| Vote casting | 10 | per minute |
| OTP request | 5 | per 5 minutes |
| Login | 10 | per minute |
| Password reset | 3 | per hour |
| API (general) | 60 | per minute |

### Security Headers

- HSTS (max-age=63072000, includeSubDomains, preload)
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- CSP (strict allowlist)
- Permissions-Policy (geolocation/microphone/camera disabled)

---

## 7. Fraud Prevention Model

### 8 EIFDIRS Detectors

1. **Vote Flooding** — too many votes from same IP/session in short window
2. **Geo-Anomaly** — impossible travel between consecutive votes
3. **Device Fingerprint Reuse** — same device used by multiple voters
4. **Velocity Check** — voting faster than humanly possible
5. **OTVP Abuse** — brute-force OTP attempts
6. **Session Hijack** — token reuse from different fingerprint
7. **Ballot Stuffing** — pattern detection in vote distribution
8. **Coordinated Attack** — clustering of suspicious events across accounts

### Incident Lifecycle

```
Detect → Alert → Investigate → Contain → Resolve → Postmortem → Improve
```

- **Risk Scorer**: 0-100 score per event based on detector signals
- **Auto-Responder**: automatic ElectionLock for CRITICAL incidents
- **Postmortem**: blameless review with timeline, root cause, action items

---

## 8. Multi-Tenant Architecture

### Tenant Resolution

1. Custom domain (`vote.university.edu.ng` → `CustomDomain` table)
2. Subdomain (`mouau.verifyvotes.com` → `Organization.subdomain`)
3. Main subdomain (`org.votewise.com.ng`)
4. Header (`x-vw-org`) for API clients
5. Query (`?x-vw-org=`) for explicit override

### Tenant Isolation

- Every database query is scoped by `organizationId`
- `requireOrganization()` helper enforces isolation on every API route
- Redis keys are prefixed with `org:{id}:`
- S3 storage is partitioned by `org/{id}/`

### Custom Domains

- DNS verification (TXT record)
- Automatic SSL (Let's Encrypt via Caddy/cert-manager)
- Domain ownership validation
- Renewal monitoring (14-day expiry alerts)

---

## 9. Organization Hierarchy

```
Organization
  └── Workspace
       └── Election Session
            ├── Position
            │    └── Candidate
            ├── Voter (Eligibility: faculty/department/level)
            ├── Vote Record (encrypted)
            ├── Observer Assignment
            └── Audit Event Trail
```

### Generic Hierarchy

The hierarchy is **generic** — works for any organization type:
- University: Faculty → Department → Level
- Company: Division → Team → Role
- Church: Diocese → Parish → Group
- NGO: Chapter → Committee → Member

---

## 10. Communication System

### Channels

| Channel | Provider | Fallback |
|---------|----------|----------|
| Email | Resend | Console log (sandbox) |
| SMS | Termii | — |
| WhatsApp | Termii | — |

### Channel Fallback

Automatic fallback: WhatsApp → SMS → Email (per the CNSE spec).

### Templates

- Multi-language (JSON-based)
- Variable substitution (`{{voterName}}`, `{{electionName}}`, `{{otp}}`)
- Category-based (OTVP, welcome, reminder, results, incident)

---

## 11. Reporting and Analytics

### 8 Report Types

1. Election Summary Report
2. Voter Turnout Report
3. Results Certification Report
4. Audit Trail Report
5. Observer Report
6. Integrity Report
7. Financial Report
8. Post-Election Analytics

### AI Insights

- LLM-powered analysis of election patterns
- Anomaly detection summaries
- Natural-language turnout explanations
- Comparative analysis across elections

### Election Replay Studio

- Forensic timeline reconstruction
- Event-by-event playback
- Filter by position/candidate/voter-group

---

## 12. Billing and Subscriptions

### Pricing Plans

| Plan | Cost | Best For |
|------|------|----------|
| PAYG | ₦500/voter | One-off elections |
| Tiered | ₦350/voter (10k+) | Mid-size orgs |
| Enterprise | Custom | Large institutions |
| White-Label | Custom + setup | Resellers |

### Payment Gateways

- **Paystack** (primary, Nigeria)
- **Flutterwave** (backup, pan-Africa)
- **Stripe** (international, future)

### Invoice Lifecycle

```
Quote → Invoice (DRAFT) → Send → Payment (PENDING → PAID) → Receipt
```

---

## 13. Platform Administration

### Platform Operations Center (`/admin/operations`)

6 tabs:
1. **Dashboard** — platform-wide stats
2. **Organizations** — manage all orgs, suspend/activate
3. **Feature Flags** — toggle features per org/environment
4. **Maintenance** — active + scheduled maintenance windows
5. **Broadcasts** — platform-wide announcements
6. **Command Center** — war-room view for election day

### Health Scoring

Each org has a health score: Configuration + Security + Support + Compliance.

---

## 14. API Specifications

### REST API

- Base URL: `https://votewise.com.ng/api`
- Auth: Bearer token (API key or JWT)
- Rate limit: 60 req/min (default)
- Versioning: `Accept: application/vnd.votewise.v1+json`

### 24 Permission Scopes

`read:elections`, `write:elections`, `read:voters`, `write:voters`, `manage:officials`, `read:results`, `read:audit`, `write:webhooks`, etc.

### 12 Webhook Events

`election.created`, `election.started`, `election.completed`, `vote.cast`, `incident.detected`, `payment.received`, `voter.imported`, `result.published`, `certificate.issued`, `official.invited`, `election.paused`, `election.resumed`

### API Documentation

- Interactive docs at `/workspace/developer`
- OpenAPI spec at `/api/aidp/docs`
- Postman collection at `/api/aidp/postman`
- Changelog at `/api/aidp/changelog`

---

## 15. Infrastructure and Deployment

### Environments

| Env | Purpose | Domain | DB |
|-----|---------|--------|----|
| Development | Local dev | localhost:3000 | SQLite |
| Testing | CI | ephemeral | SQLite (temp) |
| Staging | Pre-prod UAT | staging.votewise.com.ng | PostgreSQL (small) |
| Production | Live | votewise.com.ng | PostgreSQL (Multi-AZ) |

### Deployment Strategies

- **Blue-Green**: zero-downtime, instant rollback (major releases)
- **Canary**: 25% → 50% → 100% (risky changes)
- **Rolling**: maxUnavailable=0 (low-risk patches)

### High Availability

- Multi-AZ RDS (primary + read replica)
- Multi-AZ ElastiCache Redis
- 3-AZ VPC with pod anti-affinity
- HPA: 3-20 app replicas, 2-10 workers

### Backup Strategy

| Type | Frequency | Retention | Storage |
|------|-----------|-----------|--------|
| Hourly | every hour | 24h | S3 (region A) |
| Daily | 02:00 | 7 days | S3 + cross-region DR |
| Weekly | Sun 03:00 | 4 weeks | S3 + Glacier |
| Monthly | 1st 04:00 | 12 months | S3 + Glacier Deep Archive |

### Disaster Recovery

- **RTO** < 30 minutes
- **RPO** < 5 minutes
- **0 vote loss** (transactional writes + audit trail)
- Cross-region replication (eu-west-1 → eu-central-1)
- Monthly DR tests + quarterly failover drills

---

## 16. Testing and Certification

### Test Pyramid

```
            E2E Tests (broad, few)
         Integration Tests
       Component Tests
     Unit Tests (many, fast)
```

### 24 Test Suites (180+ test cases)

| Type | Suites | Coverage |
|------|--------|----------|
| Unit | 6 | SVE, OTVP, Eligibility, Fraud, Pricing, Permissions |
| Integration | 7 | Registration, Import, Notification, Audit, Payment, Regression |
| E2E | 5 | Org/Voter/Observer journeys, Election Integrity |
| Security | 3 | Auth, API, Backup Recovery |
| Fraud Sim | 2 | Attack scenarios, Chaos engineering |
| Performance | 2 | Load (10k-1M), Soak (sustained) |
| Accessibility | 2 | WCAG 2.1 AA, Localization |
| Browser | 1 | Chrome/Firefox/Safari/Edge + responsive |

### Release Readiness Checklist (20 items)

All automated tests passed · Code review completed · Security scan passed · Performance benchmarks met · Accessibility verified · Documentation updated · Backups successful · Monitoring configured · Rollback plan ready · Deployment approved · + 10 more

### Production Go-Live Checklist (16 items)

Organization configured · Election validated · Candidates approved · Voters imported · OTVP channels operational · Infrastructure healthy · Monitoring active · Backup verified · SSL valid · Domain verified · Support team available · + 5 more

### Compliance Frameworks

| Framework | Status | Controls |
|-----------|--------|----------|
| ISO 27001 | In Progress | 89/114 |
| SOC 2 Type II | In Progress | 48/64 |
| GDPR | In Progress | 22/30 |
| NDPR (Nigeria) | **Certified** | 28/28 |

### Certification Seal

Every completed election receives a digitally-signed certification with a verifiable ID (e.g., `VW-2026-751601`). Verifiable at `votewise.com.ng/certify/[id]`.

---

## 17. Glossary

| Term | Definition |
|------|-----------|
| **OTVP** | One-Time Vote Password — 6-digit code delivered to voter |
| **SVE** | Secure Voting Engine — Ch.10 cryptographic core |
| **EIFDIRS** | Election Integrity, Fraud Detection & Incident Response System — Ch.11 |
| **CNSE** | Communication, Notification & Support Ecosystem — Ch.12 |
| **RAEI** | Reporting, Analytics & Election Intelligence — Ch.13 |
| **BSPCM** | Billing, Subscriptions, Payment & Commercial Management — Ch.14 |
| **PAOEM** | Platform Administration, Operations & Ecosystem Management — Ch.15 |
| **AIDP** | API, Integrations & Developer Platform — Ch.16 |
| **PIHD** | Production Infrastructure, Hosting & Deployment — Ch.17 |
| **TQASGR** | Testing, QA, Security Certification & Go-Live Readiness — Ch.18 |
| **RTO** | Recovery Time Objective — max downtime (30 min) |
| **RPO** | Recovery Point Objective — max data loss (5 min) |
| **SLO** | Service Level Objective — e.g., 99.9% uptime |
| **SLI** | Service Level Indicator — measured value |
| **RBAC** | Role-Based Access Control |
| **MFA** | Multi-Factor Authentication |
| **WAF** | Web Application Firewall |
| **PITR** | Point-in-Time Recovery |
| **HPA** | Horizontal Pod Autoscaler |
| **WCAG** | Web Content Accessibility Guidelines |

---

## 18. Implementation Roadmap

### Completed (v1.0 — August 2026)

| Chapter | Status | Key Deliverable |
|---------|--------|----------------|
| 1–9 | ✅ Complete | Core election platform |
| 10 (SVE) | ✅ Complete | AES-256-GCM encryption, HMAC signatures |
| 11 (EIFDIRS) | ✅ Complete | 8 fraud detectors, incident lifecycle |
| 12 (CNSE) | ✅ Complete | Multi-channel comms, templates |
| 13 (RAEI) | ✅ Complete | 8 report types, AI insights, replay studio |
| 14 (BSPCM) | ✅ Complete | Pricing engine, 3 payment gateways |
| 15 (PAOEM) | ✅ Complete | Platform ops center, feature flags |
| 16 (AIDP) | ✅ Complete | API keys, webhooks, OAuth, 24 scopes |
| 17 (PIHD) | ✅ Complete | Docker, K8s, Terraform, CI/CD, 12-tab console |
| 18 (TQASGR) | ✅ Complete | 24 test suites, checklists, compliance, seals |

### Future Roadmap (v2.0+)

| Feature | Priority | ETA |
|---------|----------|-----|
| Mobile apps (iOS/Android) | High | Q4 2026 |
| Biometric voter verification | Medium | Q1 2027 |
| Blockchain-anchored audit trail | Medium | Q1 2027 |
| Multi-language UI (Hausa, Yoruba, Igbo, French) | High | Q4 2026 |
| Voter education portal | Medium | Q4 2026 |
| White-label reseller portal | Medium | Q1 2027 |
| Government-scale deployment (10M+ voters) | High | Q2 2027 |
| AI-powered fraud prediction | Medium | Q2 2027 |

---

## Document Control

| Field | Value |
|-------|-------|
| Document | VoteWise Master Blueprint |
| Version | 1.0 |
| Status | Production-Ready |
| Date | August 2026 |
| Owner | VoteWise Platform Team |
| Reviewers | CTO, Head of Engineering, Head of Security |
| Classification | Internal — Shared with authorized partners |

> This document is the single source of truth for the VoteWise platform.
> All development, testing, deployment, and operational decisions must
> align with this blueprint. Changes require review by the platform team.
