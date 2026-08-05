# VoteWise — Current State Assessment

**Date:** 2026-08-05
**Prepared under:** VoteWise Production Architecture and Implementation Directive, Section 35
("Inspect the existing repository. Document the current state. Identify gaps and risks.")
**Method:** Direct inspection of `github.com/ifeanyiokomba/votewise` (cloned at commit `cc9c448`),
its Prisma schema, its own audit docs, and its worklog — not a rewrite of what those docs already
claim. Where this document disagrees with an existing audit's self-rating, the disagreement is
stated explicitly and the reasoning is shown.

This document exists because Section 35 and the non-negotiable principles both require it: *"Do
not rush into interface development before establishing the product requirements, threat model,
data model, tenant boundaries, election integrity model and acceptance criteria."* Before any new
chapter starts, this project needs an honest picture of where it already stands.

---

## 1. What exists

| Metric | Value |
|---|---|
| Commits | 207 |
| First commit | 2026-07-30 |
| Latest commit | 2026-08-03 |
| TS/TSX source files | 590 |
| API route handlers (`route.ts`) | 289 |
| Prisma models | 157 |
| Existing docs | `MASTER_BLUEPRINT.md` (18-chapter architecture spec, v1.0), plus `BACKEND_AUDIT.md`, `DATABASE_AUDIT.md`, `FRONTEND_AUDIT.md`, `ELECTION_ENGINE_AUDIT.md`, `SECURITY_HARDENING.md`, `ENTERPRISE_ARCHITECTURE.md`, `TECHNICAL_DEBT.md`, `DEPLOYMENT.md`, `DISASTER_RECOVERY.md`, `ENVIRONMENT_STRATEGY.md`, `ZERO_COST_HOSTING.md`, `DATABASE_ARCHITECTURE.md` |
| Worklog | 716 KB, chronicling prior build stages by an autonomous/semi-autonomous agent workflow |

This is a real, substantial system — not a prototype in the small sense the word usually implies.
The scale of what's here changes what "Chapter 1" needs to do. It is not a blank-slate governance
exercise; it's a reconciliation between what's built and what the new directive requires.

**Important:** `TECHNICAL_DEBT.md` itself is stale — it describes the schema as "2900+ lines with
80+ models," but direct inspection finds 157 models today. Treat every existing doc's specific
numbers as a starting point to re-verify, not as current fact. That habit is the main lesson of
this whole assessment.

---

## 2. What's genuinely solid

To be fair to the prior work, several things hold up under direct inspection, not just self-report:

- **OTVP (OTP) flow** — multi-channel (email/SMS/WhatsApp) with defined fallback order, 5-minute
  TTL, 5 requests/hour rate limit, masked destinations, and a specific, correct design note: *"OTVP
  value is NEVER displayed to admins/observers."* This matches the new directive's credential
  requirements closely.
- **`EncryptedVote.candidateId` is nullable until after certification** — the field is deliberately
  left empty during live voting and only backfilled from the ciphertext once results are certified,
  specifically so a database query during the live election can't reveal a plaintext choice. That's
  a genuinely good idea worth carrying forward regardless of which infrastructure path is chosen.
- **Idempotency keys** on vote records (`sha256(voterId + electionId + positionId)`) directly address
  the non-negotiable principle *"a network retry must never cause duplicate voting."*
- **Rate limiting is specific and sensible per endpoint** (vote casting 10/min, OTP 5/5min, login
  10/min, password reset 3/hour) rather than one blanket number.
- **Observer RBAC is scoped correctly in intent**: observers hold `election.view`, `analytics.view`,
  `results.view`, etc., but explicitly not `election.manage`, `voter.manage`, or `candidate.screen`.
- Receipt verification is designed to confirm a vote exists without ever surfacing the candidate
  selected — correct per the ballot-secrecy principle.

---

## 3. Where claims outrun verification

`ELECTION_ENGINE_AUDIT.md` opens with its own warning, added by a previous careful pass: *"These
audit scores are self-assessed claims, not independently verified. Treat every '✅ Keep, 9.x/10' as
a claim to verify against actual code, not as a fact."* That warning turns out to be load-bearing.

The same document closes with: *"The election engine is production-ready. Every component... is
implemented, tested (27 TQASGR test suites), and verified."*

`TECHNICAL_DEBT.md`, in the same repository, rates its own testing gap 🔴 **High**: *"27 test suites
defined, runner not yet wired... the runner simulates execution. Real tests need to be wired to
vitest/jest."*

Put together, these two documents contradict each other. The "tested and verified" claim for vote
casting, tally reconciliation, and certification signature checks rests on a test runner that, by
the codebase's own admission, does not actually run the tests — it simulates execution. That means:

- The claim *"the sum of `CandidateTally.count`... must equal the count of `VoteRecord` entries...
  This is verified in the TQASGR test suite"* is currently **unverified**, not verified.
- "Production-ready" is not a safe characterization of the election engine as it stands today.

This isn't a criticism of the underlying design work, much of which is thoughtful (Section 2). It's
the single most important finding in this assessment, because it's exactly the failure mode the new
directive names directly: *"Never report a feature as completed when it is a placeholder, mocked
production dependency or untested interface."* Wiring the real test runner (vitest/jest) and
re-running the suite for real is a precondition for trusting any of the "✅ Complete" ratings in the
existing audits — including this project's own Chapter 11 (Testing and independent review), but
really starting much sooner than that, because nothing else can be safely marked done until it's
known whether the current claims are true.

---

## 4. Specific gaps against the non-negotiable principles

| Principle | Current state | Gap |
|---|---|---|
| *"Ballot choices must be logically separated from voter identity"* | Three overlapping models touch vote data: `VoteRecord` (has both `voterHash` and `encryptedChoice` on the same row), `Ballot` (has a **direct, non-hashed `voterId` foreign key**, plus a `content` field and an `integrityToken`), and `EncryptedVote` (closest to spec — `voterHash` is explicitly "opaque, not a FK"). `VoteRecord.ballotId` references `Ballot.id`, which carries `voterId`. If that join path is live, it's a traceable route from an accepted vote back to the voter who cast it. | This needs to be resolved before Chapter 2, not deferred into it. See ADR-0002. |
| *"Tenant data must never be accessible to another tenant"* | No PostgreSQL Row Level Security found anywhere in the codebase. `organizationId` is **nullable** on `VoteRecord`, `Ballot`, and `EncryptedVote` — the three tables that matter most. No tenant-scoping middleware or guard function was found by direct search. | This is the central gap Chapter 2 (Database and tenant isolation) needs to close — not incrementally, but as the chapter's actual subject matter. |
| *"Security controls must be tested automatically and manually"* | Simulated test runner (Section 3). | High severity per the project's own tracker. |
| *"No vote may be created through an ordinary administrative interface"* | Not directly verified in this pass — flagged because an earlier product description of this project (before this directive existed) described admins being able to "manually enter a vote if a voter has issues." That capability, if it still exists anywhere in the admin surface, directly violates this principle and needs to be found and removed, not just avoided going forward. | Needs an explicit code search in Chapter 3/6, not assumed absent. |
| *"The platform must not expose how an identifiable student voted"* | The Election Ops Console includes a **live voter activity feed** (10-second refresh, 21 action types) alongside **live per-candidate tally updates** over the same WebSocket. Individually defensible; combined, in a population as small as ~200 students per level, timing correlation between "voter X just acted" and "a vote was just tallied" is a real deanonymization risk in a way it wouldn't be at national-election scale. | Needs a deliberate design decision: aggregate-only observer views during live voting, per Phase 10's own instruction that observer dashboards should show turnout, not activity. |
| *"The platform must never be described as unhackable, perfectly secure or impossible to manipulate"* | The existing design includes an *"Integrity Score (0-100)"* on certification records and a `FraudScore` (0-100) per voter. Neither is wrong to compute, but both invite exactly the kind of false-precision confidence the directive prohibits if surfaced without heavy caveats about what they do and don't measure. | Needs explicit documentation of what the score is (and isn't) before it appears anywhere user-facing. |
| *"Critical election actions must require multi-person authorization"* | Fraud detection includes an **automatic `ElectionLock`** triggered by a CRITICAL fraud score, with no described second-party approval before the lock takes effect. | An automated lock is defensible as an emergency circuit-breaker, but it should be reviewed against the multi-person-authorization principle explicitly, not assumed to be exempt because it's automated for safety reasons. |

---

## 5. Infrastructure: the directive specifies something different from what's built

This is covered in full in **ADR-0001**, but the headline: `SECURITY_HARDENING.md` and
`infrastructure/main.tf` describe an **AWS EKS + Terraform + GuardDuty + Shield + Macie** stack,
with Kubernetes manifests (`k8s/`), a `Caddyfile`, `docker-compose.yml`, and six separately deployed
"mini-services" (analytics-engine, fraud-engine, notification-service, results-service, scheduler,
worker). The new directive specifies **Vercel + Supabase + Cloudflare** — a managed-services model
with no Kubernetes, no Terraform, no self-run intrusion detection stack, and application logic
living in a single Next.js app plus packages, not separate deployed services.

These are not close variations of the same plan. They are two different operating models with very
different ongoing burden for a solo founder to run correctly. This is the one decision in this
report that blocks real progress on Chapter 2 onward, because the database and tenant-isolation
design is different depending on the answer. See ADR-0001 for the options and a recommendation.

---

## 6. Scope beyond the directive

The existing schema includes substantial functionality the new directive doesn't ask for: an 8-11
detector fraud-scoring engine, a full webhook/OAuth/API-key platform, extensive billing/negotiation
modeling (`Quote`, `Negotiation`, `Coupon`, `AddOnPurchase`), and operational telemetry modeled as
database tables (`SloDefinition`, `SloSample`, `Postmortem`, `AlertRule`, `TestSuite`,
`GoLiveChecklist`, `ComplianceFramework`, `CertificationSeal` as a queryable model rather than a
generated artifact). None of this is necessarily wrong to have built. But it's scope the directive
doesn't request, it's more surface area to secure and maintain, and modeling things like release
checklists and compliance frameworks as application database tables is an unusual choice worth a
deliberate keep/simplify/defer decision rather than silently carrying all of it forward. This is
flagged, not resolved, here — it belongs in the Chapter 4/6 data-model conversation once the
infrastructure question is settled.

---

## 7. Two operational notes

- **Automated commits.** The worklog references a *"15-minute cron job"* that continues to push UI
  changes autonomously. A `.github/workflows/ci-cd.yml` exists, but the directive's change-control
  requirements — protected branches, required review, and explicitly *"freeze non-emergency
  production changes before and during a live election"* — are in real tension with any process that
  commits to the repository on a timer without a review step. Worth resolving before this platform
  is anywhere near a live election, not after.
- **A demo credential** (`admin@votewise.com.ng` / `admin123`) appears in plain text in the checked-in
  `worklog.md`. Almost certainly harmless as a local seed account, but the pattern is worth breaking
  now — real-looking credentials shouldn't sit in a committed file even for demo data, and this is
  worth confirming was never reused anywhere that matters.

---

## 8. What this means for sequencing

Chapter 2 (Database and tenant isolation) cannot be done well until **ADR-0001** (infrastructure
platform) has an answer, because the schema and isolation strategy differ materially between paths.
Everything else in this Chapter 1 delivery — the PRD, role matrix, threat model, and open-questions
document — is written to hold regardless of which path is chosen, so none of that work is wasted
either way.
