# VoteWise — Stakeholder and Role Matrix

**Status:** Draft for review

Two role sets, kept separate per the directive: platform roles (Okomba Analytics staff) and tenant
roles (people inside each organization running an election). Platform staff must not automatically
gain access to identifiable ballots or organization records just by holding a platform role.

## 1. Platform roles

| Role | Responsibility |
|---|---|
| Platform owner | Final authority over the platform itself, not over any tenant's election |
| Platform security administrator | Security configuration, incident response at the platform layer |
| Platform support operator | Tenant support, does not touch election configuration or results |
| Platform billing operator | Subscriptions and invoicing only |
| Platform auditor | Read access to platform-level audit logs, no operational access |

## 2. Tenant roles

| Role | Responsibility |
|---|---|
| Organization owner | Owns the tenant account; creates elections or delegates that power |
| Election chairman | Senior authority over a specific election's lifecycle |
| Returning officer | Co-authorizes critical transitions alongside the chairman |
| Electoral secretary | Administrative record-keeping for the election |
| Voter-register officer | Imports and maintains the voter register (submits, does not approve) |
| Candidate-verification officer | Verifies candidate eligibility and documents |
| Technical election officer | Configuration and technical setup, not vote-count authority |
| Faculty-management observer | Aggregate visibility into the election, no ballot-level access |
| Departmental observer | Same as above, scoped to one department unless granted more |
| Candidate agent | Represents a specific candidate's interest, observer-level access |
| Help-desk operator | Handles voter support requests, including OTP-resend under audit |
| Independent auditor | Read access to audit trail, outside the organization's own hierarchy |
| Voter | Casts a ballot, verifies their own receipt, requests corrections |

## 3. What's already built, and where it maps

The existing RBAC implementation (`src/lib/rbac.ts`) has real, working role logic — this isn't a
from-scratch design. What's there today:

- Legacy role names in the database (`SUPER_ADMIN`, `ELECTORAL_COMMITTEE`, `FACULTY_OFFICER`,
  `DEPARTMENT_OFFICER`), normalized at read time via `normalizeRole()`. `TECHNICAL_DEBT.md` already
  tracks migrating the underlying data to the new names directly and retiring the normalization
  layer — low priority, already correctly triaged.
- A confirmed, specific `OBSERVER` permission set: `election.view`, `analytics.view`, `voter.search`,
  `ticket.triage`, `support.chat`, `support.assign`, `results.export`, `results.view`,
  `candidate.view` — and confirmed *absence* of `election.manage`, `voter.manage`, and
  `candidate.screen`. This is a real, correctly-scoped example of the isolation principle in
  practice.

What isn't yet confirmed by direct inspection: whether the finer-grained tenant roles above
(Election chairman vs. Returning officer vs. Electoral secretary vs. Technical election officer,
specifically) exist as distinct roles today, or whether the current implementation collapses several
of them into `ELECTORAL_COMMITTEE`. If the latter, the multi-person-authorization principle (two
people from *different* roles approving a critical transition) is harder to enforce meaningfully,
since "the electoral committee approved it twice" isn't the same guarantee as "the chairman and the
returning officer, who hold genuinely different responsibilities, both signed off." This needs a
direct read of the current role-assignment code in Chapter 3, not assumed either way here.

## 4. What Chapter 3 needs to resolve

- Whether the 13 tenant roles above need to exist as literally distinct database roles, or whether
  some can be modeled as permission bundles on top of fewer underlying roles — a design choice, not
  answered by the directive itself.
- The full permission-to-role grid (the ~25 sensitive permissions the directive lists —
  `election.open.approve`, `result.certify`, `voter.freeze`, and so on) — deliberately not built out
  here, since it belongs with the authorization engine itself, not the stakeholder overview.
- Confirmation of which two (or more) roles are required to co-approve each critical transition,
  specifically enough that "multi-person authorization" means two people with genuinely different
  authority, not two people who both happen to hold the same title.
