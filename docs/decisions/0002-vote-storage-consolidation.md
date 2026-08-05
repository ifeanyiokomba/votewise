# ADR-0002: Vote Storage Consolidation

**Status:** Proposed — target design decided, migration path pending Chapter 2/6
**Date:** 2026-08-05

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

## What's needed to proceed

Before Chapter 2 writes the actual migration: a trace of which of the three existing models the live
vote-casting API route (`POST /api/v1/voting/*` or equivalent) actually writes to today, and whether
the other two are dead code, migration remnants, or — the concerning case — still active and
inconsistent with each other. That trace is Chapter 2 work, not resolved here.

## Consequences

Existing vote data (if any real votes have been cast against this schema) would need a one-time,
carefully audited migration into the consolidated model, with the migration itself logged as an
audit event. If no real election has used this schema yet, this is a clean schema change rather than
a data migration — worth confirming which situation applies before Chapter 2 starts.
