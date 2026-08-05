# VoteWise — Security Requirements Traceability Matrix

**Status:** Living document — update as each chapter closes, not just at the end.

Status values used honestly, not optimistically: **Verified** (real test or direct code confirmation
exists) · **Claimed, unverified** (an existing doc says done, but rests on the simulated test runner
or wasn't independently checked) · **Partial** · **Gap** · **Not started**.

| Requirement | Source | Current status | Target chapter |
|---|---|---|---|
| One accepted ballot per voter per election | Non-negotiable principle 1 | Partial — idempotency keys exist; full authorization-consumption atomicity per ADR-0002 not yet built | Ch. 6 (Anonymous ballot engine) |
| Ballot choices separated from voter identity | Non-negotiable principle 3 | **Gap** — traceable join path found (`current-state-assessment.md` §4) | Ch. 6, per ADR-0002 |
| Tenant data isolation | Non-negotiable principle 4 | **Gap** — no RLS found, nullable tenant IDs | Ch. 2 (Database and tenant isolation) |
| Multi-person authorization on critical actions | Non-negotiable principle 6 | Partial — some flows exist; role-granularity needs confirming per `roles-and-permissions.md` §3 | Ch. 3 (Auth and authorization) |
| Election locked before voting | Non-negotiable principle 7 | Claimed, unverified — state machine exists; enforcement not independently tested | Ch. 5 (Election configuration) |
| Append-only audit events | Non-negotiable principle 8 | Partial — audit models exist; hash-chaining (`previous_event_hash`) not confirmed implemented | Ch. 8 (Results, certification and audit) |
| Results reproducible from accepted ballots | Non-negotiable principle 9 | Claimed, unverified — reconciliation logic exists; verification rests on the simulated test runner | Ch. 8 |
| No admin-editable vote totals | Non-negotiable principle 11 | Claimed, unverified | Ch. 6, Ch. 8 |
| No vote creation via ordinary admin interface | Non-negotiable principle 12 | **Needs direct verification** — flagged from a prior product description, not confirmed present or absent in current code | Ch. 3, Ch. 6 |
| Idempotent ballot submission | Non-negotiable principle 13 | Verified — idempotency-key pattern confirmed present in schema | Ch. 6 (confirm end-to-end, not just schema) |
| Automated + manual security testing | Non-negotiable principle 16 | **Gap** — test runner simulates execution rather than running real tests | Ch. 11 (Testing and independent review) — but blocks trusting any other "verified" row above until fixed |
| Secrets never in source/logs/client bundles | Non-negotiable principle 17 | Not started (this pass didn't audit for this specifically) | Ch. 10 (Security hardening) |
| Real student data never in dev/preview | Non-negotiable principle 18 | Not started | Ch. 12 (Deployment) |
| Encrypted, tested, access-controlled backups | Non-negotiable principle 19 | **Gap** — directive requires a backup be proven via actual restore before "working" is claimed; no restore test found | Ch. 12 |
| Row Level Security on tenant-owned tables | Tech baseline, Section 5 | **Gap** | Ch. 2, pending ADR-0001 |
| Centralized, default-deny authorization function | Phase 3 | Not started | Ch. 3 |
| MFA for privileged users | Phase 3 | Not started | Ch. 3, Ch. 10 |
| OTVP: short-lived, single-use, rate-limited | Phase 8 | Verified — confirmed built with sensible parameters | — |
| CSV formula-injection protection | Phase 7 | Not started | Ch. 4 (Voter-register management) |
| Voter register versioning (never silent overwrite) | Phase 7 | Partial — `VoterImportBatch`-style models exist; version-immutability not confirmed | Ch. 4 |
| Deterministic, independently-repeated tally | Phase 11 | Claimed, unverified | Ch. 8 |
| Hash-chained, tamper-evident audit log | Phase 12 | **Gap** | Ch. 8 |
| DCPMI registration assessment (education sector) | NDPA, current regulatory research | Not started | Ch. 10, alongside legal review |
| Cross-border transfer safeguards (DPAs with Vercel/Cloudflare/Supabase/OTP providers) | NDPA S.43 | Not started | Ch. 10 |
| Change-freeze enforcement before/during live elections | Phase 23 | **Gap** — in direct tension with the confirmed autonomous cron-commit process | Ch. 12 |

This table is intentionally uncomfortable in places — several rows that earlier project docs marked
"✅ Complete" appear here as "Claimed, unverified" or "Gap." That's the point of writing it down
before more is built on top.
