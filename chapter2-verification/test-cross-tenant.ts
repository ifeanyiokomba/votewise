// Chapter 2 verification test — real assertions against the real, unmodified
// src/lib/sve/ballot-builder.ts, with @/lib/db mocked (see tsconfig.test.json
// and mock-db.ts). Run with:
//   npx tsx --tsconfig tsconfig.test.json chapter2-verification/test-cross-tenant.ts
//
// This is NOT the same shape of thing as the project's own TQASGR suite
// (which TECHNICAL_DEBT.md confirms simulates execution). This script
// actually imports and calls the real function and actually fails loudly
// if the assertions don't hold — try/catch around a real call, not a
// hardcoded "passed" result.

process.env.VOTE_ENC_KEY = 'a'.repeat(64)
process.env.VOTER_HASH_PEPPER = 'b'.repeat(32)
process.env.HMAC_SECRET = 'c'.repeat(32)
process.env.SVE_BALLOT_PEPPER = 'd'.repeat(32)
process.env.SVE_VOTER_PEPPER = 'e'.repeat(32)

import { buildBallot } from '../src/lib/sve/ballot-builder'
import { startVotingSession, validateSession } from '../src/lib/sve/session'

let failures = 0

async function expectThrows(label: string, fn: () => Promise<any>, expectedMessage: string) {
  try {
    await fn()
    console.error(`FAIL: ${label} — expected it to throw "${expectedMessage}", but it did not throw at all.`)
    failures++
  } catch (e: any) {
    if (e.message === expectedMessage) {
      console.log(`PASS: ${label} — threw "${expectedMessage}" as expected.`)
    } else {
      console.error(`FAIL: ${label} — expected "${expectedMessage}", got "${e.message}".`)
      failures++
    }
  }
}

async function expectSucceeds(label: string, fn: () => Promise<any>) {
  try {
    const result = await fn()
    if (result?.ballot?.content?.positions?.length > 0) {
      console.log(`PASS: ${label} — ballot built successfully with ${result.ballot.content.positions.length} position(s).`)
    } else {
      console.error(`FAIL: ${label} — call succeeded but returned no positions: ${JSON.stringify(result)}`)
      failures++
    }
  } catch (e: any) {
    console.error(`FAIL: ${label} — expected success, but it threw "${e.message}".`)
    failures++
  }
}

async function main() {
  console.log('--- Chapter 2 cross-tenant verification (real buildBallot, mocked db) ---\n')

  // The actual attack this closes: a voter registered under org-b requesting
  // a ballot for an election that belongs to org-a.
  await expectThrows(
    'Cross-tenant: voter-org-b requesting election-org-a',
    () => buildBallot({ electionId: 'election-org-a', voterId: 'voter-org-b' }),
    'VOTER_ORGANIZATION_MISMATCH',
  )

  // The same request, but with a voter who actually belongs to org-a, must
  // still succeed — the fix must not be so broad it blocks legitimate voters.
  await expectSucceeds(
    'Same-tenant: voter-org-a requesting election-org-a',
    () => buildBallot({ electionId: 'election-org-a', voterId: 'voter-org-a' }),
  )

  // Simulations intentionally bypass the voter check (no real voter involved)
  // — confirming that's still true and wasn't accidentally broken.
  await expectSucceeds(
    'Simulation: no voterId, isSimulation=true',
    () => buildBallot({ electionId: 'election-org-a', isSimulation: true }),
  )

  // startVotingSession: voter belongs to org-b, but org-a is claimed.
  await expectThrows(
    'startVotingSession: voter-org-b, organizationId=org-a',
    () => startVotingSession({ electionId: 'election-org-a', voterId: 'voter-org-b', organizationId: 'org-a' }),
    'VOTER_ORGANIZATION_MISMATCH',
  )

  // startVotingSession: election belongs to org-a, but org-b is claimed
  // (using voter-org-b so the voter check passes and this isolates the
  // election check specifically).
  await expectThrows(
    'startVotingSession: election-org-a, organizationId=org-b',
    () => startVotingSession({ electionId: 'election-org-a', voterId: 'voter-org-b', organizationId: 'org-b' }),
    'ELECTION_ORGANIZATION_MISMATCH',
  )

  // startVotingSession: everything actually matches — must still succeed.
  await expectSucceeds(
    'startVotingSession: voter-org-a, election-org-a, organizationId=org-a',
    async () => {
      const s = await startVotingSession({ electionId: 'election-org-a', voterId: 'voter-org-a', organizationId: 'org-a' })
      return { ballot: { content: { positions: [{}] } }, _sessionId: s.sessionId } // reuse the pass/fail shape
    },
  )

  // validateSession: token is real, but the caller's resolved org doesn't match.
  const mismatchedSession = await validateSession('valid-token-org-a', 'org-b')
  if (mismatchedSession === null) {
    console.log('PASS: validateSession — org-a token rejected when caller resolved to org-b.')
  } else {
    console.error('FAIL: validateSession — org-a token was accepted for org-b.')
    failures++
  }

  // validateSession: token and caller's org actually match.
  const matchedSession = await validateSession('valid-token-org-a', 'org-a')
  if (matchedSession?.voterId === 'voter-org-a') {
    console.log('PASS: validateSession — org-a token accepted for org-a.')
  } else {
    console.error(`FAIL: validateSession — expected a valid session, got ${JSON.stringify(matchedSession)}`)
    failures++
  }

  console.log(`\n--- ${failures === 0 ? 'ALL PASSED' : `${failures} FAILURE(S)`} ---`)
  process.exit(failures === 0 ? 0 : 1)
}

main()
