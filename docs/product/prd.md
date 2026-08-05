# VoteWise — Product Requirements Document

**Status:** Draft for review
**Supersedes:** `docs/MASTER_BLUEPRINT.md` v1.0 where the two conflict. Where they don't conflict,
the Blueprint's detail still stands — this document doesn't repeat everything it already covers well.

## 1. Product identity

- **Name:** VoteWise
- **Descriptor:** Secure Digital Election Management
- **Built by:** Okomba Analytics
- **Footer attribution:** "VoteWise is built and maintained by Okomba Analytics" (full), "Powered by
  Okomba Analytics" (small spaces), "Technology platform designed, developed and maintained by
  Okomba Analytics" (formal reports). Never inside the ballot itself.
- **Domains:** `votewise.com.ng` (apex), `app.`, `admin.`, `docs.`, `status.`, `api.`, and
  `*.votewise.com.ng` for tenant subdomains (e.g. `biosciences.votewise.com.ng`).

## 2. Who this is for, starting now

The first real deployment target is a specific faculty election: 4 departments, 4 academic levels
per department, roughly 200 students per level, ~3,200 eligible voters, one general faculty
election with multiple positions, plus the electoral committee, faculty-management observers,
departmental observers, and candidate agents around it. This isn't a hypothetical scenario — it's
tied to real institutions Ifeanyi has a direct relationship with, which is part of why the rigor bar
here is real and not aspirational.

The architecture is not scoped to that one election. It needs to generalize to universities,
associations, companies, churches, unions, cooperatives, NGOs, and professional bodies without
rework — but "generalize without rework" is a constraint on the *first* implementation, not a
license to build every one of those use cases now.

## 3. Non-negotiable principles (binding, not aspirational)

These are the directive's, reproduced here because every later chapter has to be checked against
them, not just the security chapter:

1. A voter may vote only once in an election.
2. The platform must not expose how an identifiable student voted.
3. Ballot choices must be logically separated from voter identity.
4. Tenant data must never be accessible to another tenant.
5. Administrative privilege must be narrowly scoped.
6. Critical election actions must require multi-person authorization.
7. Election configuration must be locked before voting begins.
8. All sensitive actions must produce append-only audit events.
9. Results must be reproducible from accepted ballots.
10. Every election must have a documented lifecycle.
11. No administrator may directly edit vote totals.
12. No vote may be created through an ordinary administrative interface.
13. A network retry must never cause duplicate voting.
14. Failed, disputed, and successful ballot submissions must have unambiguous states.
15. The system must remain usable on low-end mobile devices and unstable networks.
16. Security controls must be tested automatically and manually.
17. Production secrets must never appear in source code, client bundles, logs, or repositories.
18. Real student data must never be used in development or preview environments.
19. Backups must be encrypted, tested, and access-controlled.
20. Results must not be described as certified until the authorized electoral process completes
    certification.

Per `current-state-assessment.md`, principles 3, 4, 12, and 16 have open gaps against the current
build. Those gaps are the actual work of the next several chapters, not something to route around.

## 4. Product pillars (what "good" means here)

Secure by design · Private by design · Auditable · Resilient · Transparent · Accessible ·
Professionally operated · Independently testable · Suitable for low-bandwidth mobile users ·
Scalable to multiple institutions.

The platform must never be described as unhackable, perfectly secure, or impossible to manipulate —
that framing is prohibited in product copy, marketing, and internal documentation alike.

## 5. What's explicitly out of scope for the first release

- **Cryptographic end-to-end verifiability.** The directive is explicit that this requires a
  qualified cryptographer's independent review before it can be claimed. For v1: a secure, auditable
  conventional model with documented trust assumptions, not an E2E-verifiable protocol.
- **Legal or compliance certification claims** of any kind until the relevant professional review has
  actually happened (Nigerian data-protection counsel for privacy claims, an independent security
  firm for penetration testing).
- Anything in `current-state-assessment.md` Section 6 (fraud-engine sophistication, full billing
  negotiation flows, webhook/OAuth platform) that isn't needed for the first faculty election —
  these are candidates to simplify or defer, not commitments to build out further right now.

## 6. Success criteria for the first binding election

Taken directly from the directive's final acceptance standard — this is the bar, not a subset of it:
correct tenant isolation, correct voter eligibility, one accepted ballot per eligible voter,
separation of voter identity and ballot selections, atomic and idempotent ballot submission,
deterministic result computation, controlled election-state transitions, multi-person approval for
critical actions, tamper-evident audit records, tested backup and recovery, tested incident
procedures, strong privileged authentication, accessible mobile voting, acceptable performance under
simulated peak load, independent security review, stakeholder rehearsal, and complete operational
documentation.

None of these are currently verifiable as met — see `current-state-assessment.md` Section 3 on why
"tested" claims specifically need to be re-earned before they're trusted again.
