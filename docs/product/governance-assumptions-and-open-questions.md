# VoteWise — Governance Assumptions and Open Questions

**Status:** Needs Ifeanyi's confirmation or correction before Phase 0 is considered closed.

The directive is explicit: *"Do not proceed to implementation until every unanswered question is
either resolved or formally documented as an assumption."* This document is that record. Each item
below is either something already answered by the existing product's design, or a proposal marked
for confirmation. None of these are final — they're the working assumptions that unblock the next
chapters, written down so they can be checked rather than left implicit.

## 1. Who creates an organization?

**Proposal:** Self-service registration, but the tenant stays in `pending` status until a platform
operator reviews and activates it — a manual gate, given the realistic near-term volume is a handful
of institutions, not open self-serve at scale. **Needs confirmation.**

## 2. Who legally or operationally owns uploaded voter data?

**Proposal:** The tenant organization is the data controller for its own voters' data; Okomba
Analytics acts as data processor providing the platform. This is the default posture under NDPA
S.29 (the party determining the purpose and manner of processing is the controller; the party
processing on the controller's behalf and instruction is the processor) — but the directive is
explicit this should be documented per processing activity, not assumed universally, and it should
be confirmed by a Nigerian data-protection professional before it's relied on contractually. **Needs
confirmation and legal review**, not just a product decision.

One finding worth flagging directly: the NDPC's registration framework treats **education as one of
the specifically named sectors** that can trigger Data Controller/Processor of Major Importance
(DCPMI) registration obligations regardless of subject-count thresholds (sources disagree on the
exact subject-count threshold itself — one puts it at 200 data subjects in six months, another at
5,000; that discrepancy itself is a reason to get a direct read from an NDPC-registered compliance
professional rather than relying on either number here). Since VoteWise processes education-sector
personal data, DCPMI registration is worth investigating sooner rather than later, particularly once
the platform serves more than one institution. Registration fees found range roughly ₦25,000 (small
business, <40 staff and <₦50m turnover) to ₦100,000–₦250,000 (regular/major) — figures worth
re-confirming directly with NDPC before budgeting, not treated as final here.

## 3. Who may create an election?

**Proposal:** Organization owner, or Election chairman if the owner delegates. **Needs confirmation.**

## 4. Who approves the voter register?

**Proposal:** Voter-register officer submits an import; Election chairman or Returning officer
approves it. Importer and approver must be different people — this is where "approval uniqueness"
(directive, Phase 4 data constraints) actually earns its keep. **Needs confirmation.**

## 5. Who approves candidates?

**Proposal:** Candidate-verification officer verifies eligibility and documents; Returning officer or
Election chairman approves the final list. **Needs confirmation.**

## 6. Who opens, pauses, extends, and closes voting?

**Proposal:** Election chairman and Returning officer, jointly — this is the clearest instance of the
"critical election actions must require multi-person authorization" principle. **Needs confirmation**,
and needs Chapter 3 to resolve whether the current role model can actually distinguish these two
people meaningfully (see `roles-and-permissions.md`, Section 3).

## 7. Who sees turnout?

**Proposal:** Electoral officials see full detail; faculty-management observers see aggregate turnout
only; departmental observers see their own department's aggregate only, unless explicitly granted
more. This directly follows from `current-state-assessment.md`'s flag about the existing live
per-voter activity feed — turnout aggregates are fine for observers; live per-voter activity is not.
**Needs confirmation.**

## 8. Who sees provisional results?

**Proposal:** Officials and certifying roles only, until certification. Whether observers see
provisional results at all is a per-election publication-policy setting (the directive's "Observer-
only results" option), not a fixed platform rule. **Needs confirmation.**

## 9. Who certifies final results?

**Proposal:** A minimum of two of three (Election chairman, Returning officer, Electoral secretary),
matching the multi-person-authorization principle and the existing `CertificationSeal` model's intent.
**Needs confirmation** of the exact minimum and which roles count.

## 10. How are disputes submitted?

**Proposal:** Through the tenant public portal's help/incident page, creating an `ObserverReport` or
incident record — a model that already exists in the schema. **Needs confirmation** of who triages
disputes and the SLA for a first response.

## 11. How are emergency changes authorized?

**Proposal:** Two-person documented approval, immediate audit event, automatic notification to
affected stakeholders, and — per the directive — a freeze on *non-emergency* changes in the window
immediately before and during a live election. This is also where the current "15-minute cron job"
autonomous-commit pattern (`current-state-assessment.md`, Section 7) needs an explicit answer: it
cannot be running against a live-election-adjacent environment under this rule. **Needs confirmation.**

## 12. How long is personal data retained?

**This is the most consequential open item and genuinely Ifeanyi's call, not a default I should set
unilaterally.** A reasonable starting proposal — voter PII retained for the academic session plus a
defined post-election window for dispute resolution (commonly 6–12 months in similar contexts), then
anonymized or deleted; ballots (already free of identity, once ADR-0002 is implemented) retained
longer as historical election records since they carry no personal-data burden once genuinely
anonymized. **Needs Ifeanyi's decision, then legal confirmation that the chosen period satisfies
NDPA's data-minimization and storage-limitation principles** rather than just being operationally
convenient.

## 13. How are ballots retained?

**Proposal:** Indefinitely, or per a long retention policy, since — once ADR-0002's consolidation is
in place — accepted ballots carry no identity linkage and aren't personal data in the same sense
voter records are. **Needs confirmation** this framing is accurate once the schema change lands (it
depends on ADR-0002 actually being implemented correctly, not just intended).

## 14. How are tenants deleted or archived?

**Proposal:** Tenant-requested deletion → a grace period (e.g. 30 days) with an offered data export →
hard deletion of PII → retained anonymized aggregate statistics only, if any. **Needs confirmation.**

## 15. How are election records exported?

**Proposal:** Certified results and reports are exportable by authorized officials and independent
auditors; raw voter-register or ballot-level exports are restricted, logged, and require a
documented reason. **Needs confirmation.**

## 16. How is a compromised administrator account handled?

**Proposal:** Immediate session revocation across all that admin's sessions, forced credential reset,
security-event logging, and a mandatory audit review of that account's actions since the estimated
compromise window — feeding into the incident-response plan being built out in Chapter 10. **Needs
confirmation** of who has authority to trigger this without waiting on the compromised account holder.

---

## Infrastructure and hosting: a related, NDPA-relevant note

Independent of which option is chosen in ADR-0001, Vercel, Cloudflare, and (if adopted) Supabase are
all foreign-hosted infrastructure. Under NDPA Section 43, any transfer of personal data outside
Nigeria needs a documented lawful basis — in practice, a Data Processing Agreement with each vendor
containing Standard Contractual Clauses or an equivalent safeguard, since the NDPC has not yet
designated any country as offering adequate protection by default. This applies regardless of the
ADR-0001 outcome, since even Option B's AWS-based stack is also foreign-hosted. It's a "needs a DPA
on file with each vendor" item, not a blocker, but it should be tracked as a real compliance task
rather than assumed away — and, per the same sources, cross-border transfer is one of the specific
triggers for a mandatory DPIA filing with the NDPC, which is worth confirming with a compliance
professional given the penalties involved (fines up to ₦10 million or 2% of annual gross revenue,
whichever is higher, for unlawful transfers).
