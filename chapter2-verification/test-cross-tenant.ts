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

  console.log(`\n--- ${failures === 0 ? 'ALL PASSED' : `${failures} FAILURE(S)`} ---`)
  process.exit(failures === 0 ? 0 : 1)
}

main()
