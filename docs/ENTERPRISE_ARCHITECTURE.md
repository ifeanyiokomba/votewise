# VoteWise Enterprise Architecture v1.0

> **Response to Enterprise Technical Audit Part 1**
>
| Area                      | Audit Score | Status |
| ------------------------- | ----------: | ------ |
| Technology Stack          |      9.8/10 | ✅ Keep |
| Folder Organization       |      8.5/10 | ✅ Evolving |
| Scalability Potential     |      9.5/10 | ✅ Keep |
| Enterprise Readiness      |      8.7/10 | ✅ Evolving |
| Multi-tenancy Foundation  |      9.3/10 | ✅ Keep |
| Long-term Maintainability |      8.8/10 | ✅ Evolving |
| Production Readiness      |      7.9/10 | ✅ Evolving |
| **Overall**               |  **8.9/10** | **Strong foundation** |

> **Verdict:** The platform does NOT need to be rewritten. It needs to be
> **evolved** into a modular, production-grade platform. This document
> defines the target architecture and the evolution path.

---

## 1. Current Architecture

### Technology Stack (9.8/10 — Keep)

| Layer | Technology | Status |
|-------|-----------|--------|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS 4, shadcn/ui | ✅ |
| Backend | Next.js API Routes, Prisma ORM | ✅ |
| Database | PostgreSQL 16 (SQLite in sandbox) | ✅ |
| Cache | Redis 7 (in-memory fallback) | ✅ |
| Real-time | Socket.io (results-service, port 3030) | ✅ |
| Auth | NextAuth.js v4, JWT (HS256), HttpOnly cookies | ✅ |
| State | Zustand (client), TanStack Query (server) | ✅ |
| Encryption | AES-256-GCM, HMAC-SHA256, SHA-256 | ✅ |
| Container | Docker (multi-stage) | ✅ |
| Orchestration | Kubernetes / Docker Compose | ✅ |
| IaC | Terraform | ✅ |
| CI/CD | GitHub Actions | ✅ |
| Monitoring | Sentry, CloudWatch, SLO tracking | ✅ |

### Current Folder Structure

```
src/
  app/                    # Next.js App Router (routes)
    admin/                # Platform admin pages
    api/                  # API routes (organized by module)
    o/[subdomain]/        # Public org portals
    workspace/            # Org workspace pages
  components/
    ui/                   # shadcn/ui primitives
    votewise/             # Domain components
  lib/                    # Business logic (organized by chapter)
    aidp/                 # Ch.16: API & Developer Platform
    bspcm/                # Ch.14: Billing
    ch16a/                # Ch.16A: OTVP & Support
    cnse/                 # Ch.12: Communication
    eifdirs/              # Ch.11: Fraud Detection
    infra/                # Ch.17: Infrastructure
    pihed/                # Ch.17: Production Infra
    raei/                 # Ch.13: Analytics
    sve/                  # Ch.10: Secure Voting Engine
    tqasgr/               # Ch.18: Testing & Certification
  prisma/                 # Database schema
  mini-services/          # Worker, scheduler, notification, fraud, analytics
  k8s/                    # Kubernetes manifests
  infrastructure/         # Terraform IaC
  docs/                   # Documentation
  scripts/                # Operational scripts
  tests/                  # Load tests
```

### Multi-Tenancy (9.3/10 — Keep)

The multi-tenant foundation is one of the strongest areas:

- ✅ `Organization` model with `subdomain` + `customDomain`
- ✅ `OrganizationBrand` for white-label branding
- ✅ `CustomDomain` model with DNS verification + SSL
- ✅ Tenant resolution via `resolveTenantContext()` (Host → Subdomain → Header → Query → Cookie)
- ✅ `requireOrganization()` helper enforces tenant isolation on every API route
- ✅ Every database table has `organizationId` for tenant scoping

---

## 2. Target Architecture (Evolution, Not Rewrite)

### Domain-Driven Structure

The audit recommends organizing around **business capabilities** rather than technical types. The current `src/lib/` is already partially domain-organized (by chapter). The target is to formalize this:

```
src/lib/
  domains/                    # Domain-driven business logic
    organizations/            # Org management, branding, domains
    elections/                # Election configuration, lifecycle
    voters/                   # Voter registry, eligibility, OTVP
    candidates/               # Candidate profiles, screening
    observers/                # Observer assignment, monitoring
    results/                  # Tally, live results, certification
    payments/                 # Billing, invoices, payment gateways
    support/                  # Live chat, tickets, SLA, escalation
    fraud/                    # Detection, incidents, postmortems
    notifications/            # Email, SMS, WhatsApp, templates
    analytics/                # Reports, insights, replay
    infrastructure/           # Deployments, backups, monitoring
    testing/                  # Test suites, checklists, compliance
  shared/                     # Cross-cutting concerns
    auth/                     # Authentication, RBAC, sessions
    crypto/                   # Encryption, hashing, signatures
    db/                       # Prisma client, read replica
    cache/                    # Redis client, in-memory fallback
    logger/                   # Structured logging
    rate-limit/               # Rate limiting
    storage/                  # S3 / local object storage
  config/                     # App configuration
```

**Evolution path:** The current `src/lib/{sve,eifdirs,cnse,...}` folders are already domain-organized. The rename is:
- `sve/` → `domains/voters/` + `domains/elections/` (vote engine spans both)
- `eifdirs/` → `domains/fraud/`
- `cnse/` → `domains/notifications/`
- `raei/` → `domains/analytics/`
- `bspcm/` → `domains/payments/`
- `ch16a/` → `domains/support/` + `domains/voters/` (OTVP delivery spans both)
- `pihed/` + `infra/` → `domains/infrastructure/`
- `tqasgr/` → `domains/testing/`

This is a **rename + reorganize**, not a rewrite. The business logic stays the same.

### Tenant Context Model (Formalized)

The audit recommends a strict tenant context model. This is now formalized in `src/lib/tenant-context.ts`:

```
Incoming Request
      ↓
  Host Header
      ↓
  resolveTenantContext()   ← src/lib/tenant-context.ts
      ↓
  TenantContext { organizationId, subdomain, source }
      ↓
  Authorization (RBAC can() check)
      ↓
  Business Logic (scoped by organizationId)
      ↓
  Database Query (WHERE organizationId = ?)
```

**Rule:** No service should query tenant data without a resolved `TenantContext`. This is enforced by the `requireOrganization()` guard on every API route.

### Permission Engine (Centralized)

The audit recommends centralizing permissions. This is already implemented in `src/lib/rbac.ts`:

- **9 roles** (expanded from 6 to include `READONLY_AUDITOR`, `SUPPORT_AGENT`, `CANDIDATE`)
- **25 capabilities** (granular permissions)
- **`can(ctx, capability)`** — the single function every permission check flows through
- **`requireOfficial(capability)`** — the guard every privileged endpoint uses
- **`MATRIX`** — the single source of truth for role → capability mapping
- **`ROLE_METADATA`** — UI display metadata for each role

No role check is scattered through business logic. All permission decisions flow through the RBAC matrix.

### Dashboard Strategy (Role-Separated)

The audit recommends separate dashboards per role. The current implementation:

| Dashboard | Route | Roles |
|-----------|-------|-------|
| Platform Operations | `/admin/operations` | PLATFORM_SUPER_ADMIN |
| Infrastructure Console | `/admin/infrastructure` | PLATFORM_SUPER_ADMIN |
| QA Console | `/admin/quality` | PLATFORM_SUPER_ADMIN |
| Organization Workspace | `/workspace?org=` | ORG_OWNER, ORG_ADMIN |
| Election Operations | `/workspace/election-ops` | ORG_OWNER, ORG_ADMIN, OBSERVER |
| Command Center | `/workspace/command-center` | ORG_OWNER, ORG_ADMIN |
| Developer Portal | `/workspace/developer` | ORG_OWNER, ORG_ADMIN |
| Voter Portal | `/workspace/elections/[id]/vote` | VOTER |
| Public Org Portal | `/o/[subdomain]` | Public (all roles) |
| Certification Verify | `/certify/[id]` | Public |

Each dashboard exposes only the functionality relevant to that role, gated by the RBAC `can()` check.

### University Hierarchy (Multi-Election)

The audit recommends an explicit hierarchy. This is implemented:

```
Organization (University)
  ├── Faculty Elections
  ├── Department Elections
  ├── Student Union Election
  ├── Hostel Elections
  └── Club Elections
```

All elections run under the same subdomain (`unilag.verifyvotes.com`), each with its own admin team, observers, candidates, results, and rules. This is a major differentiator.

### Organization Portal

Each organization functions like a standalone SaaS site at `/o/[subdomain]`:

- ✅ Fully branded homepage (logo, colors, banner, welcome message)
- ✅ Dynamic — adapts to election lifecycle (before/during/after)
- ✅ Separate navigation (Home, Candidates, Cast Vote, Verify Eligibility, Receipt, Results, Support, Committee, Timetable)
- ✅ Custom domains supported (`vote.university.edu.ng`)

The org shouldn't feel like a tenant inside another product — it should feel like it owns its own election platform. ✅ Achieved.

---

## 3. Shared Component Boundaries

The audit recommends classifying every shared component:

| Category | Location | Examples |
|----------|----------|---------|
| Generic UI | `src/components/ui/` | Button, Input, Card, Dialog, Badge, Select |
| Domain UI | `src/components/votewise/` | election-card, candidate-card, voter-picker |
| Layouts | `src/components/votewise/shared.tsx` | NavBar, Footer, PageWrapper |
| Data Viz | `src/components/votewise/` | donut.tsx, faculty-turnout.tsx, live-results.tsx |
| Branding | `src/components/votewise/` | logo-loader, theme-toggle |

**Rule:** Generic UI components (shadcn/ui) must NOT contain business logic. Domain UI components may contain presentation logic but NOT data-fetching logic (that belongs in hooks/services).

---

## 4. State Management

| Store | Technology | Usage |
|-------|-----------|-------|
| Client state | Zustand (`src/lib/store.ts`) | Auth state, UI preferences, theme, notifications |
| Server state | TanStack Query | Remote data fetching, caching, mutations |

**Rule:** Do NOT store server data in Zustand. Use TanStack Query for all remote data. Zustand is for client-only state (theme, UI toggles, auth session).

---

## 5. Technical Debt Tracker

| Debt Item | Severity | Status | Mitigation |
|-----------|----------|--------|-----------|
| Large "god" components (>3000 lines) | Medium | Tracked | infrastructure-console.tsx (5969), qa-console.tsx (3042), platform-operations-center.tsx (2415) — candidates for splitting by tab |
| Circular imports | Low | Monitored | None currently detected |
| Inconsistent naming | Low | Tracked | Legacy role names normalized via `normalizeRole()` |
| Mixed business logic in UI | Medium | Tracked | Some API calls in components — extract to hooks |
| Missing unit tests | High | Acknowledged | 27 test suites defined in TQASGR, runner not yet wired to vitest |
| Weak validation | Medium | Tracked | Some API routes lack Zod validation — add progressively |
| Duplicate utility functions | Low | Tracked | timeAgo/formatDateTime duplicated across components — extract to shared |

---

## 6. Deployment Readiness

| Requirement | Status |
|-------------|--------|
| Environment separation (dev/staging/prod) | ✅ `.env` + `.env.staging.example` + `.env.production.example` |
| Secret management | ✅ `src/lib/infra/secrets.ts` (AWS Secrets Manager) |
| Health endpoints | ✅ `GET /api/pihed/health` |
| Structured logging | ✅ `src/lib/infra/logger.ts` (6 categories) |
| Metrics | ✅ `src/lib/pihed/index.ts` (SystemMetric capture) |
| Alerting | ✅ `src/lib/infra/alerting.ts` (7 rules, 5 channels) |
| Backup automation | ✅ Scheduler + `scripts/backup-cron.sh` |
| Rollback procedures | ✅ `scripts/rollback.sh` + blue-green + canary |

---

## 7. Evolution Roadmap

### Phase 1 (Completed — v1.0)
- ✅ Core platform (Chapters 1–18)
- ✅ Multi-tenant foundation
- ✅ RBAC permission engine (9 roles, 25 capabilities)
- ✅ Tenant context formalization
- ✅ Domain-organized lib structure
- ✅ Role-separated dashboards
- ✅ Dynamic org portals

### Phase 2 (Next — v1.1)
- [ ] Rename `src/lib/{sve,eifdirs,...}` → `src/lib/domains/{voters,fraud,...}`
- [ ] Split god components by tab (infrastructure-console → 12 files)
- [ ] Add Zod validation to all API routes
- [ ] Extract shared utilities (timeAgo, formatDateTime) to `src/lib/shared/`
- [ ] Wire TQASGR test runner to vitest/jest

### Phase 3 (Future — v2.0)
- [ ] Monorepo (Turborepo) with `apps/web`, `apps/admin`, `apps/docs`
- [ ] Shared packages: `packages/auth`, `packages/elections`, `packages/ui`
- [ ] Mobile apps (React Native)
- [ ] Multi-language UI (Hausa, Yoruba, Igbo, French)

---

## Summary

The platform is **not** a throwaway MVP. It's a strong foundation moving toward enterprise scale. The audit's 8.9/10 score reflects this.

The goal is **evolution, not rewrite**. Each business capability is being progressively isolated into its own domain, with clear boundaries, centralized permissions, and formalized tenant isolation. The architecture supports scaling from a 200-member club to a 1,000,000-voter national election without fundamental changes.
