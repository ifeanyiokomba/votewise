# ADR-0002: Vote Storage Consolidation

**Status:** Accepted — trace complete, immediate exposure closed, schema consolidation still pending
**Date:** 2026-08-05, updated 2026-08-06

## Context

Three Prisma models currently touch cast-vote data: `VoteRecord`, `Ballot`, and `EncryptedVote`.
Comments in the schema attribute them to different build stages ("Chapter 3," "Chapter 10 — SVE"),
which suggests each was added by a different pass of work rather than one being a deliberate
evolution of another. Full detail is in `current-state-assessment.md`, Section 4.

The concrete problem: `Ballot.voterId` is a direct foreign key to the voter, and `VoteRecord.ballotId`
references `Ballot.id`. If both are populated after a vote is cast and neither is cleared, there is a
traceable join path from an accepted ballot back to the identity of the voter who cast it — which is
exactly what the ballot-secrecy principle forbids.

This ADR does not resolve which specific rows in production (if any) currently have this join
populated — that requires tracing the actual vote-casting route handler, which is Chapter 2/6 work.
What it does is fix the target design so that work has a clear destination.

## Decision

Consolidate to a single ballot-secrecy model that matches the directive's Phase 5 structure:

1. **An eligibility/participation table** — voter identity, department, level, election eligibility,
   whether a ballot authorization was consumed, and a participation timestamp. No selection data.
2. **A ballot table** — a random ballot identifier, election ID, accepted timestamp, receipt
   commitment, and the encrypted selection payload. **No voter ID, matric number, email, or phone
   number in this table, and no foreign key back to the eligibility table that could be joined to
   recover identity.**
3. **A short-lived, single-use ballot authorization** issued after authentication, consumed exactly
   once, atomically, in the same transaction that creates the ballot record.

From what's already built, this keeps:
- `EncryptedVote`'s approach of leaving the decrypted choice unpopulated until after certification.
- The idempotency-key pattern from `VoteRecord`.
- AES-256-GCM + HMAC signing from the existing `crypto.ts`, which is a reasonable primitive choice
  and doesn't need to change.

From what's already built, this retires:
- `Ballot.voterId` as a field that persists past the point a ballot is issued — if a "ballot content
  handed to the voter" concept is still needed (it's reasonable to want one, to render the form), it
  should not be the same table as the cast, accepted vote, and it should not be retained with an
  identity link after submission.
- Having three parallel models doing overlapping jobs. One canonical table for eligibility/
  participation, one canonical table for accepted ballots.

## Trace results (2026-08-06)

There were three vote-casting entry points, not one, and they were not equally dead:

- **`POST /api/vote/cast`** — already formally deprecated before this session, returns 410. Its own
  comment correctly identifies it as the old `EncryptedVote`-writing path and points to the real one.
- **`POST /api/workspace/ballot/submit`** — the real, current path. Goes through
  `src/lib/sve/vote-recorder.ts`, part of a genuinely careful module (`src/lib/sve/`: crypto,
  validation-pipeline, ballot-builder, receipt, rla, tally, live-counter). This is the one to build
  on, not replace.
- **`POST /api/v1/voting/cast`** — **live, reachable, and not referenced by any current frontend
  page**, meaning nothing in the app currently links to it, but nothing stopped it from accepting a
  direct request either. It wrote `candidateId` and `voterId` as **plain-text fields on the same
  `VoteRecord` row**, with no encryption (its own code comment even said *"in production: encrypt
  with AES-256-GCM first"* — meaning it knew it wasn't production-ready and shipped anyway) and no
  check that the authenticated voter's organization matched the election's organization.

This is now fixed: `/api/v1/voting/cast` has been disabled (410, same pattern as the other
deprecated route), committed separately from the rest of this chapter's work so it's easy to review
on its own. See the commit "Disable unencrypted, identity-linked vote-casting endpoint."

This closes the immediate exposure. It does not close ADR-0002 itself — `Ballot.voterId` and the
general three-model overlap (Section "Decision" above) still need the schema consolidation once
ADR-0001's infrastructure question is being executed against.

## Consequences

Existing vote data (if any real votes have been cast against this schema) would need a one-time,
carefully audited migration into the consolidated model, with the migration itself logged as an
audit event. If no real election has used this schema yet, this is a clean schema change rather than
a data migration — worth confirming which situation applies before Chapter 2 starts.
