# VoteWise Backend Architecture & Security Audit — Part 4

> **Enterprise Technical Audit Part 4 — Backend Architecture, API Design,
> Authentication, RBAC & Security**
>
| Category                | Score    | Status |
| ----------------------- | --------: | ------ |
| API Design              | 9.0/10  | ✅ Keep |
| Authentication          | 9.2/10  | ✅ Keep |
| RBAC / Authorization    | 9.5/10  | ✅ Keep |
| Input Validation        | 7.0/10  | ✅ Enhanced (Zod) |
| Audit Logging           | 9.0/10  | ✅ Keep |
| Encryption              | 9.8/10  | ✅ Keep |
| Rate Limiting           | 8.5/10  | ✅ Keep |
| Secret Management       | 9.0/10  | ✅ Keep |
| Security Headers        | 9.5/10  | ✅ Keep |
| API Versioning          | 8.0/10  | ✅ Keep |
| **Overall**             | **8.9/10** | **Production-grade** |

---

## 1. API Design (9.0/10)

### Architecture

```
Client Request
    ↓
Next.js Proxy (src/proxy.ts)
    → Tenant resolution (Host → Organization)
    → Security headers (HSTS, X-Frame-Options, CSP, etc.)
    → CORS handling
    ↓
API Route (src/app/api/...)
    → Rate limiting (src/lib/ratelimit.ts)
    → Authentication (verifyAccessToken)
    → Authorization (requireOfficial + RBAC can())
    → Input validation (Zod schemas)
    → Business logic (src/lib/domains/)
    → Database query (Prisma, tenant-scoped)
    → Audit log (writeAudit)
    ↓
JSON Response
```

### API Organization

```
src/app/api/
  auth/               — Authentication (login, logout, refresh, me)
  voter/              — Voter-facing (verify-matric, send-otp, verify-otp)
  admin/              — Admin-only (health, voters, candidates, positions)
  workspace/          — Org-scoped (elections, structure, settings)
  pihed/              — Infrastructure (health, readiness, status, metrics)
  tqasgr/             — Testing & certification
  ch16a/              — OTVP delivery, support chat
  domains/            — Enterprise domain services
  aidp/               — API keys, webhooks, integrations
  bspcm/              — Billing, pricing, payments
  paoem/              — Platform admin operations
  eifdirs/            — Fraud detection, incidents
  portal/             — Public org portal data
  receipt/            — Receipt verification
  results/            — Live results
  organizations/      — Org listing/management
```

### Design Principles

1. **RESTful** — GET for reads, POST for creates, PATCH for updates, DELETE for deletes
2. **Tenant-scoped** — every query includes `WHERE organizationId = ?`
3. **Consistent response shape** — `{ ok: true, data }` or `{ error: "message" }`
4. **HTTP status codes** — 200, 201, 400, 401, 403, 404, 429, 500
5. **Rate-limited** — per-endpoint limits (vote: 10/min, OTP: 5/5min, login: 10/min)
6. **Audited** — every privileged action logged via `writeAudit()`

---

## 2. Authentication (9.2/10)

### Token-Based Auth

| Component | Implementation |
|-----------|---------------|
| Access token | JWT (HS256), 15-minute TTL |
| Refresh token | Opaque random string (40 chars), 7-day TTL |
| Storage | HttpOnly cookies (Secure + SameSite=Lax) |
| Rotation | Refresh token rotated on every use |
| Revocation | Refresh token hash stored in DB; revocable |

### Auth Flow

```
Login (email + password)
    ↓
Verify password (bcrypt + PEPPER)
    ↓
Check MFA (if enabled — TOTP)
    ↓
Sign access token (JWT HS256, 15min)
    ↓
Generate refresh token (random, hash stored in DB)
    ↓
Set HttpOnly cookies
    ↓
Return { official: {...} }
```

### MFA

- TOTP-based (Google Authenticator compatible)
- Required for: PLATFORM_SUPER_ADMIN, ORG_OWNER, SUPPORT_AGENT
- Optional for: ORG_ADMIN, OBSERVER
- Backup codes generated on enrollment

### Session Management

Per the Enterprise Audit Part 2, sessions are separated by type:
- `LoginSession` — admin/official logins
- `VotingSession` — voter voting sessions
- `AdminSession` — admin action sessions
- `ObserverSession` — observer monitoring sessions

**Rule:** "Never mix them." (Part 2 spec)

---

## 3. RBAC / Authorization (9.5/10)

### Permission Engine

The RBAC system is centralized in `src/lib/rbac.ts`:

- **9 roles**: PLATFORM_SUPER_ADMIN, ORG_OWNER, ORG_ADMIN, OBSERVER, READONLY_AUDITOR, SUPPORT_AGENT, CANDIDATE, VOTER, GUEST
- **25 capabilities**: election.manage, voter.manage, results.certify, support.chat, otvp.resend, etc.
- **`can(ctx, capability)`** — the single function every permission check flows through
- **`requireOfficial(capability)`** — the guard every privileged endpoint uses
- **`MATRIX`** — the single source of truth for role → capability mapping

### Authorization Flow

```
Request arrives
    ↓
verifyAccessToken(token) → AccessPayload { sub, role, ... }
    ↓
requireOfficial(req, capability)
    → Loads ElectionOfficial from DB
    → Builds PermissionContext { role, organizationId, scope }
    → can(ctx, capability) → boolean
    → If false: 403 Forbidden
    ↓
Business logic (scoped by organizationId)
```

### Tenant Isolation

Every query is scoped by `organizationId`:
```typescript
const data = await db.electionSession.findMany({
  where: { organizationId: org.id }  // ← tenant scoping
})
```

The `requireOrganization()` helper resolves the tenant from the request and
returns a 403 if the caller doesn't belong to that organization.

---

## 4. Input Validation (7.0/10 → Enhanced with Zod)

### Before Audit

Many API routes used `req.json().catch(() => ({}))` without validating the
input shape — a security risk (unexpected input) and reliability risk
(runtime errors).

### After Audit

Created `src/lib/validation.ts` with shared Zod schemas:

```typescript
import { z } from 'zod'

export const schemas = {
  login: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
  voteCast: z.object({
    electionId: z.string().min(1),
    selections: z.array(z.object({
      positionId: z.string().min(1),
      candidateId: z.string().min(1),
    })).min(1),
    receipt: z.boolean().optional(),
  }),
  createElection: z.object({
    name: z.string().min(1).max(200),
    organizationId: z.string().min(1),
    startTime: z.string().datetime().or(z.date()),
    endTime: z.string().datetime().or(z.date()),
  }),
  // ... more schemas
}

export function validate<T>(schema: z.ZodSchema<T>, data: unknown):
  { success: true; data: T } | { success: false; error: string }
```

Applied to critical routes: login, vote casting, election creation, payment.

---

## 5. Audit Logging (9.0/10)

### Hash-Chained Audit Log

Every privileged action is logged via `writeAudit()`:

```typescript
await writeAudit({
  actorId: official.id,
  actorRole: official.role,
  actorName: official.name,
  action: 'ELECTION_UPDATED',
  details: { organizationId, electionId, fields },
  ip: getClientIp(req),
})
```

Each audit entry includes:
- Actor (who), Role (what role), Action (what they did)
- Details (JSON), IP address, Timestamp
- Hash chain (each entry links to the previous — tampering breaks the chain)

### Centralized Logging (Chapter 17)

The `LogEntry` model + `src/lib/infra/logger.ts` provides 6 categories:
- Application, Audit, Security, Infrastructure, API, Deployment

Every service (app, worker, scheduler, fraud-engine, analytics-engine) logs
to the same searchable store.

---

## 6. Encryption (9.8/10)

| Layer | Algorithm | Usage |
|-------|-----------|-------|
| Vote encryption | AES-256-GCM | Ballot encryption before storage |
| Signatures | HMAC-SHA256 | Ballot integrity, certification seals |
| Password hashing | bcrypt + PEPPER | Voter/admin password hashing |
| Transport | TLS 1.3 | All HTTP connections (Caddy + next.config) |
| At rest | AES-256 | Database, S3, backups |
| Voter identity | SHA-256 + PEPPER | Anonymized voter hashing |

### Required Secrets (5)

1. `VOTE_ENC_KEY` — AES-256 vote encryption key
2. `VOTER_HASH_PEPPER` — Voter identity hashing pepper
3. `HMAC_SECRET` — HMAC signature secret
4. `SVE_BALLOT_PEPPER` — Ballot anonymization pepper
5. `SVE_VOTER_PEPPER` — Voter record anonymization pepper

All loaded from AWS Secrets Manager in production (`src/lib/infra/secrets.ts`).
The readiness checker verifies all 5 are present and blocks Go Live if any
are missing.

---

## 7. Rate Limiting (8.5/10)

### Per-Endpoint Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| Vote casting | 10 | per minute |
| OTP request | 5 | per 5 minutes |
| Login | 10 | per minute |
| Password reset | 3 | per hour |
| API (general) | 60 | per minute |
| Receipt verify | 30 | per minute |
| Read (general) | 200 | per minute |
| Write (general) | 30 | per minute |

### Implementation

- In-memory token bucket (`src/lib/ratelimit.ts`) in sandbox
- Redis-backed (`src/lib/infra/rate-limit.ts`) in production
- Returns 429 with `Retry-After` header when exceeded

### Edge Rate Limiting

- Caddy: 50 req/s per IP, burst 100 (`Caddyfile`)
- NGINX ingress: `limit-rps: 50` (`k8s/ingress.yaml`)
- AWS WAF: rate-based rules (production)

---

## 8. Secret Management (9.0/10)

### Production

- AWS Secrets Manager (`src/lib/infra/secrets.ts`)
- `loadSecrets()` fetches at boot, populates `process.env`
- `verifySecrets()` checks all 5 required secrets are present
- `requireSecret(key)` throws if missing
- `getSecret(key)` returns undefined if missing (for optional secrets)

### Development

- `.env` file (gitignored)
- Sandbox secrets are synthetic (not real keys)

### CI/CD

- Secret detection in CI (`! grep -rn "ghp_\|sk_live_\|AKIA"`)
- Trivy filesystem scan
- npm audit (high+ severity)

---

## 9. Security Headers (9.5/10)

### Defense-in-Depth Layers

1. **Caddy/ALB** (edge) — TLS 1.3, HSTS, WAF, rate limiting
2. **Next.js proxy** (`src/proxy.ts`) — HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
3. **Next.js config** (`next.config.ts`) — CSP, all headers on every response

### Headers Set

| Header | Value |
|--------|-------|
| Strict-Transport-Security | max-age=63072000; includeSubDomains; preload |
| X-Content-Type-Options | nosniff |
| X-Frame-Options | DENY |
| X-XSS-Protection | 1; mode=block |
| Referrer-Policy | strict-origin-when-cross-origin |
| Permissions-Policy | geolocation=(), microphone=(), camera=() |
| Content-Security-Policy | default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; ... |
| -Server | (removed — don't advertise stack) |

---

## 10. API Versioning (8.0/10)

### Current Strategy

- URL-based versioning for public API: `/api/aidp/v1/elections`
- Accept header: `Accept: application/vnd.votewise.v1+json`
- Changelog at `/api/aidp/changelog`
- No breaking changes within a major version

### Deprecation Policy

- Deprecated endpoints return `Sunset` header
- 6-month deprecation period before removal
- Migration guide published with each major version

---

## Security Testing (Chapter 18)

The TQASGR module includes 27 test suites covering:
- Authentication security (MFA, session expiration, account lockout, token expiration, role permissions)
- API security (key auth, scope enforcement, rate limiting, CORS, SQL injection, XSS)
- Election integrity (no duplicate voting, vote secrecy, vote immutability, accurate tallying, audit completeness, observer restrictions)
- Fraud simulation (8 attack scenarios)
- Chaos engineering (Redis failure, SMS outage, DB failover, network latency)

---

## Final Verdict

### Keep
- ✅ JWT auth with HttpOnly cookies + refresh token rotation
- ✅ RBAC permission engine (9 roles, 25 capabilities, centralized in rbac.ts)
- ✅ Hash-chained audit log
- ✅ AES-256-GCM vote encryption
- ✅ Per-endpoint rate limiting
- ✅ Security headers (defense-in-depth: Caddy + proxy + next.config)
- ✅ Secret management (AWS Secrets Manager in prod)
- ✅ Tenant isolation (every query scoped by organizationId)

### Enhanced
- ✅ Zod input validation on critical routes (login, vote cast, election create)
- ✅ Shared validation schemas in `src/lib/validation.ts`
- ✅ Session separation (LoginSession, VotingSession, AdminSession, ObserverSession)
- ✅ Trusted device management
- ✅ Fraud evidence + decision audit trail

### Future Hardening
- [ ] CSRF tokens for state-changing operations (currently SameSite=Lax provides baseline protection)
- [ ] API request signing (HMAC) for webhook endpoints
- [ ] IP allowlisting for platform admin endpoints
- [ ] Certificate pinning for mobile apps
- [ ] Hardware security module (HSM) for key management in government deployments

The backend is **production-grade** — secure, auditable, and hardened against
the threats specified in the Enterprise Technical Audit.
