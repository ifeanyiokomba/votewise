# VoteWise — Abuse-Case Catalogue

**Status:** Draft for review

Concrete scenarios, each tied back to a threat in `threat-model.md`. Each includes the expected
system behavior — what should happen, which isn't always the same as what's currently verified to
happen (noted where that gap exists).

**AC-1 — Double voting via two devices.** A voter completes voting on their phone, then opens the
link on a friend's laptop and tries again using the same credentials. *Expected:* the second attempt
is rejected because the ballot authorization was already consumed in the first transaction. *Status:*
depends on ADR-0002's atomic authorization-consumption design being implemented; not yet built.

**AC-2 — A compromised electoral officer tries to alter the candidate list after lock.** An officer's
session is compromised (phishing) and the attacker attempts to add a candidate after the register is
locked. *Expected:* the election-state machine rejects the write outright, independent of the
officer's permissions, because the election is past `candidate_review`. *Status:* the 12-state
machine exists; whether it's enforced server-side on every relevant write path (not just the UI) is
unverified.

**AC-3 — An external attacker probes for valid matric numbers.** A bot iterates sequential or
plausible matric numbers against the eligibility-check endpoint to build a target list for a later
phishing campaign. *Expected:* generic responses regardless of whether the number exists, plus rate
limiting. *Status:* rate limiting is confirmed built; response-genericness needs a direct check.

**AC-4 — A voter loses network mid-submission and retries.** A voter on a low-end phone submits a
ballot, the connection drops before a response arrives, and the app retries automatically. *Expected:*
the retry is recognized as the same submission via idempotency key and does not create a second
ballot or fail confusingly. *Status:* the idempotency-key pattern is confirmed built at the data
layer; the client-side retry/offline handling described in Phase 9 of the directive isn't confirmed
built yet.

**AC-5 — An observer tries to infer an individual's vote from the live dashboard.** A departmental
observer watches the live activity feed and the live tally simultaneously, in a department small
enough that a single voter's action is distinguishable in the timing pattern. *Expected:* this
shouldn't be possible even in principle — observer views should show aggregates only during live
voting. *Status:* currently possible given the live per-voter activity feed found in the existing
build; this is the specific finding in `current-state-assessment.md` Section 4 that needs a design
change, not just a permissions tweak.

**AC-6 — A tenant administrator tries to view another tenant's voter register.** An admin at
Institution A modifies a URL parameter or request body to reference Institution B's register ID.
*Expected:* rejected at the database layer even if the application-layer check has a bug, because
Row Level Security (or equivalent) enforces the boundary independently. *Status:* this is the
central open gap — see ADR-0001 and `threat-model.md` Section 4.

**AC-7 — A help-desk operator resends OTPs excessively for one voter.** Either through error or
intent, an operator triggers repeated OTP resends for the same voter well beyond a normal support
interaction. *Expected:* a per-voter resend cap independent of the operator's own rate limit, plus an
audit trail showing the pattern. *Status:* per-voter rate limiting is confirmed at the OTP-issuance
layer; whether it also caps operator-triggered resends specifically needs confirmation.

**AC-8 — Someone tries to certify results before voting has actually closed.** A user with
certification permission attempts to trigger certification while the election state is still `live`.
*Expected:* blocked by the state machine — certification requires `closed` → `reconciliation` →
`certification_pending` first, in order. *Status:* the state machine's states exist; the specific
precondition enforcement for this transition needs a direct check.

**AC-9 — A malicious actor submits a CSV with a formula payload disguised as a name field.** A voter-
register import contains a cell like `=HYPERLINK(...)` in a name field, intended to execute when a
later export is opened in Excel by an administrator. *Expected:* sanitized on both import and export.
*Status:* not confirmed built — flagged in `threat-model.md` Section 6.

**AC-10 — An autonomous process pushes a change during what should be a change freeze.** The
confirmed 15-minute cron-based commit process pushes a UI change during a window that should be
frozen ahead of a live election. *Expected:* this shouldn't be possible — non-emergency changes are
blocked during the freeze window regardless of what triggered them. *Status:* currently possible,
since no freeze-window enforcement was found tied to the automated commit process. This is the
practical, concrete version of the governance question in
`governance-assumptions-and-open-questions.md`, Question 11.
