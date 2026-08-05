# VoteWise — Threat Model

**Status:** Draft for review. **No high or critical residual risk here is silently accepted — see
Section 5.**
**Methodology:** STRIDE. Likelihood ratings below reflect actual findings from
`current-state-assessment.md` where evidence exists, not generic defaults — this is what makes a
threat model worth reading instead of a template. **L**ow / **M**edium / **H**igh throughout.

## 1. Actors modeled

Legitimate voter · Ineligible student · Voter attempting to vote twice · Candidate · Candidate agent
· Electoral officer · Malicious electoral officer · Compromised administrator · Faculty-management
observer · VoteWise platform administrator · External attacker · Bot operator · Insider with
database access · OTP provider · Hosting provider · Support agent.

## 2. Assets

Voter identity and eligibility records · ballot content and voter-to-ballot linkage · election
configuration and schedule · candidate list integrity · result totals and certification records ·
audit trail integrity · credential/OTP secrets · tenant boundary itself · platform availability
during voting windows.

## 3. Identity and credential threats

| Threat | Actor(s) | Attack path | L | I | Preventive control | Detective control | Recovery control | Owner |
|---|---|---|---|---|---|---|---|---|
| Credential theft | External attacker, phisher | Stolen matric number + OTP via phishing site | M | H | Domain verification education, no OTP shown to admins | Login-anomaly alerts | Session revocation, forced re-verification | Technical election officer |
| OTP interception | External attacker, SIM swap actor | Intercept SMS/WhatsApp OTP in transit | L | H | Short TTL (5 min, confirmed built), one-time use | Delivery-provider anomaly logs | Immediate invalidation on reissue (confirmed built) | Technical election officer |
| SIM swap | External attacker | Port victim's number, receive OTP | L | H | Multi-channel OTP reduces single-point reliance (confirmed built: email/SMS/WhatsApp) | Provider-side swap alerts (not confirmed present) | Help-desk override with two-person approval | Help-desk operator |
| Brute-force matric enumeration | Bot operator, external attacker | Iterate matric numbers against eligibility-check endpoint | M | M | Rate limiting (confirmed: per-endpoint limits exist), generic failure responses | Repeated-failure alerting | Temporary IP block | Technical election officer |
| Phishing | External attacker | Fake tenant-subdomain lookalike | M | H | Verified custom domains only, security awareness messaging | User reports | Domain takedown request | Platform security administrator |
| Session theft | External attacker, insider | Stolen session token reused | L | H | Secure cookies, session rotation (target design, not yet verified built) | Concurrent-session anomaly detection | Global session revocation | Technical election officer |

## 4. Tenant and authorization threats

| Threat | Actor(s) | Attack path | L | I | Preventive control | Detective control | Recovery control | Owner |
|---|---|---|---|---|---|---|---|---|
| **Tenant crossover** | External attacker, malicious officer of another tenant | Modified request body/URL param referencing another tenant's resource ID | **H** | **H** | RLS + server-side authorization (target; **not currently found in codebase — see current-state-assessment.md §4**) | Tenant-isolation test suite (target; **currently no real test runner — see §3**) | Incident response, forced re-audit of affected tenant's data | Platform security administrator |
| Voter-register leakage | Insider, compromised admin | Bulk export of voter PII without authorization gate | M | H | Export authorization + audit logging | Export-volume anomaly alerts | Notify affected tenant, breach assessment per NDPA | Organization owner |
| Privilege escalation | Compromised admin, insider | Role/permission manipulation via a route lacking a server-side check | M | H | Centralized authorization function, default-deny (target design) | Permission-change audit log | Session revocation, role reset | Platform security administrator |
| Broken object authorization | External attacker | Direct object reference to another voter's/election's record | M | H | Server-side ownership checks on every route (289 routes — needs systematic audit, not spot checks) | Anomalous access-pattern alerts | Patch + audit affected records | Technical election officer |

## 5. Election-integrity threats

| Threat | Actor(s) | Attack path | L | I | Preventive control | Detective control | Recovery control | Owner |
|---|---|---|---|---|---|---|---|---|
| Unauthorized candidate changes | Malicious officer | Edit candidate list after lock | L | H | Election-state machine blocks edits post-lock (confirmed: 12-state machine exists) | Election-change audit event | Revert from audit log, notify observers | Election chairman |
| Election schedule manipulation | Malicious officer, compromised admin | Change open/close time without approval | L | H | Multi-person approval for schedule changes (target — needs Q6 in governance-assumptions.md resolved) | Schedule-change audit event | Revert, notify, extend dispute window | Returning officer |
| Vote replay | External attacker | Resubmit a captured, valid ballot request | L | M | Idempotency keys (confirmed built) | Duplicate-idempotency-key alert | Reject duplicate automatically | Technical election officer |
| Duplicate submissions | Legitimate voter (accidental), attacker | Double-click, retry after timeout | L | M | Idempotency keys + client-side submission lock (confirmed: idempotency built; client lock not verified) | Duplicate-attempt logging | N/A — prevented, not recovered | Technical election officer |
| Ballot stuffing | Malicious officer, compromised admin | Direct DB insert bypassing the vote-casting API | M | H | No direct table access from admin surface (target — **"no vote via ordinary admin interface" not yet confirmed absent, see current-state-assessment.md §4**) | Reconciliation: eligible-count vs. accepted-ballot-count mismatch | Election lock, forensic reconciliation | Election chairman + Returning officer jointly |
| Vote deletion | Compromised admin, insider with DB access | Direct deletion of a `VoteRecord`/ballot row | L | H | Immutable accepted-ballot records (target — soft-delete via `isArchived` confirmed present, hard-delete prevention not confirmed) | Row-count reconciliation against audit trail | Restore from backup, forensic review | Platform security administrator |
| **Result tampering** | Compromised admin, insider | Edit a tally or result snapshot directly | L | **H** | No admin-editable result totals (target — **verification currently rests on the simulated TQASGR runner, so this is unverified, not confirmed absent**) | Independent repeat-tally comparison | Recompute from accepted ballots, re-certify | Election chairman |
| **Audit-log alteration** | Insider with DB access, compromised admin | Modify or delete an audit event | L | **H** | Append-only design, hash-chaining (`previous_event_hash`/`event_hash` per directive spec — **not confirmed implemented in current schema**) | Hash-chain verification job | Restore from backup, treat as active incident | Platform security administrator |

## 6. Application security threats

| Threat | Actor(s) | Attack path | L | I | Preventive control | Detective control | Recovery control | Owner |
|---|---|---|---|---|---|---|---|---|
| CSV formula injection | Malicious officer with import access | Formula payload in an exported CSV opened in Excel | M | M | Formula-prefix sanitization on export (target — not confirmed built) | N/A (client-side risk) | User education, sanitize retroactively | Technical election officer |
| Malicious file upload | External attacker, compromised officer account | Upload disguised executable as a candidate photo | L | M | File-type/size validation, storage isolation | Antivirus scan on upload (existing `SECURITY_HARDENING.md` describes a ClamAV sidecar — **tied to the AWS/K8s stack; needs an equivalent if ADR-0001 moves off it**) | Quarantine + delete | Technical election officer |
| **SQL injection** | External attacker | Unsanitized input reaching a raw query | L | H | Parameterized queries by default via Prisma — **but `TECHNICAL_DEBT.md`'s own paid-off-debt log confirms at least one prior use of `$executeRawUnsafe`/`$queryRawUnsafe` in the codebase; every raw-query call site needs a manual audit, not an assumption that Prisma's default safety covers everything** | Query-pattern anomaly detection | Patch + audit affected data | Technical election officer |
| Cross-site scripting | External attacker | Unescaped user input (e.g. candidate manifesto) rendered to other users | L | M | React's default output escaping, CSP (target — not confirmed configured) | CSP violation reports | Patch, audit stored content | Technical election officer |
| Cross-site request forgery | External attacker | Forged state-changing request from an authenticated session | L | M | CSRF tokens or SameSite cookies (not confirmed configured) | Anomalous-origin request logging | Session revocation | Technical election officer |
| Server-side request forgery | External attacker | Induce the server to fetch an attacker-controlled internal URL | L | M | URL allowlisting on any server-side fetch | Outbound-request anomaly detection | Patch, rotate any exposed internal secrets | Technical election officer |

## 7. Availability threats

| Threat | Actor(s) | Attack path | L | I | Preventive control | Detective control | Recovery control | Owner |
|---|---|---|---|---|---|---|---|---|
| Denial of service | External attacker, bot operator | Volumetric or application-layer flood during opening/closing minutes | M | H | Cloudflare DDoS mitigation (available either way per ADR-0001) | Real-time traffic anomaly monitoring | Cloudflare "under attack" mode, scale up | Platform security administrator |
| Database outage | Hosting provider, misconfiguration | Managed-Postgres incident | L | H | Managed provider SLA + connection pooling | Uptime monitoring | Failover per disaster-recovery plan (Chapter 12) | Platform security administrator |
| OTP provider outage | OTP provider | Termii/equivalent service disruption | M | M | Multi-channel fallback (confirmed built: SMS → WhatsApp → Email) | Provider health monitoring (`ProviderHealth` model exists) | Manual help-desk override with two-person approval | Help-desk operator |

## 8. Insider and supply-chain threats

| Threat | Actor(s) | Attack path | L | I | Preventive control | Detective control | Recovery control | Owner |
|---|---|---|---|---|---|---|---|---|
| Insider collusion | Two or more compromised/malicious officers | Coordinated abuse of legitimate multi-person approval | L | H | Independent auditor role, external observer visibility | Cross-referencing officer action patterns | Investigation, credential revocation, legal referral | Organization owner |
| Log leakage | Insider, misconfigured storage | Logs containing sensitive data exposed via misconfigured bucket/endpoint | M | M | Sensitive-data redaction in logs (target — not confirmed implemented) | Access-pattern monitoring on log storage | Rotate exposed secrets, notify if PII involved | Platform security administrator |
| Backup exposure | Insider, misconfigured storage | Unencrypted or over-permissioned backup accessed | L | H | Encrypted backups, restricted access (target — not confirmed tested; directive requires restore-tested before "working" can be claimed) | Backup-access audit logging | Rotate credentials, re-encrypt, notify | Platform security administrator |
| **Automated commit pipeline as a supply-chain vector** *(specific to this codebase, added beyond the directive's generic list)* | Compromised CI credential, or the autonomous cron process itself misbehaving | Unreviewed automated commit introduces a vulnerability directly to a branch feeding production | **M** | **H** | Protected branches, required review — **currently in tension with the confirmed 15-minute autonomous cron-commit pattern; see current-state-assessment.md §7** | Commit-review audit trail | Revert, disable the automation, manual review of recent auto-commits | Platform owner |
| Dependency compromise | Supply-chain attacker | Malicious package version pulled via `bun.lock` | L | H | Dependency scanning, lockfile pinning (existing `SECURITY_HARDENING.md` describes npm audit + Dependabot — confirm these still apply if the runtime/package manager changes under ADR-0001) | Dependency-audit CI gate | Rollback, patch | Technical election officer |
| CI/CD credential compromise | External attacker, insider | Stolen deployment credential used to push a malicious build | L | H | Least-privilege CI credentials, secret rotation | Deployment-anomaly alerting | Revoke credential, rebuild from known-good commit | Platform owner |

## 9. Reading this table honestly

Three threats are marked **H** likelihood or carry a bolded caveat above because they map directly
to confirmed gaps, not hypothetical ones: **tenant crossover** (no RLS found), **result tampering**
and **audit-log alteration** (verification currently rests on a simulated test runner, so "prevented"
claims are unverified rather than false — the honest state is *unknown*, which for a security-
critical system should be treated with the same urgency as *known-bad* until proven otherwise).

This table will need a full pass once ADR-0001 is resolved and Chapter 2 actually implements
tenant isolation — ratings here reflect the codebase as inspected on 2026-08-05, not a future state.
