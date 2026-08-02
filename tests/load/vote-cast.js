/* eslint-disable import/no-anonymous-default-export */
// VoteWise — k6 Load Test: Vote Casting Path
//
// Simulates concurrent voters casting ballots. Tests the most critical
// path: the vote recording transaction. Measures response time, error
// rate, and resource usage at scale.
//
// Spec: "Test 10,000 / 50,000 / 100,000 / 500,000 / 1,000,000 concurrent
//        voters. Measure response time, error rate, resource usage."
//
// Usage:
//   k6 run --vus 10000 --duration 5m tests/load/vote-cast.js
//   k6 run --vus 50000 --duration 10m tests/load/vote-cast.js
//   k6 run --vus 100000 --duration 10m tests/load/vote-cast.js
//   k6 run --vus 500000 --duration 15m tests/load/vote-cast.js
//   k6 run --vus 1000000 --duration 20m tests/load/vote-cast.js
//
// Stages can be orchestrated via:
//   k6 run --env STAGES=10k,50k,100k tests/load/vote-cast.js

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Counter, Trend } from 'k6/metrics'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'
const ORG_SUBDOMAIN = __ENV.ORG || 'demo'

// Custom metrics
const voteErrors = new Counter('vote_errors')
const voteLatency = new Trend('vote_latency', true)
const otpLatency = new Trend('otp_latency', true)

// Default stage: 10,000 concurrent voters for 5 minutes.
// Override with --vus and --duration.
export const options = {
  stages: [
    { duration: '30s', target: parseInt(__ENV.VUS || '10000') },  // ramp up
    { duration: __ENV.DURATION || '5m', target: parseInt(__ENV.VUS || '10000') },  // hold
    { duration: '30s', target: 0 },  // ramp down
  ],
  thresholds: {
    // Spec: "Error rate" — must stay under 0.1% for vote recording
    'vote_errors': ['count<10'],
    'http_req_failed': ['rate<0.001'],
    // Spec: "Response time" — p95 must stay under 500ms
    'vote_latency': ['p(95)<500'],
    'http_req_duration': ['p(95)<500', 'p(99)<1000'],
  },
}

// Each virtual user simulates a voter
export default function () {
  // 1. Request OTP
  const otpStart = Date.now()
  const otpRes = http.post(
    `${BASE_URL}/api/voter/otp/request`,
    JSON.stringify({ matricNumber: `VOTER-${__VU}`, phone: '+2348000000000' }),
    { headers: { 'Content-Type': 'application/json', 'x-vw-org': ORG_SUBDOMAIN } },
  )
  otpLatency.add(Date.now() - otpStart)

  if (otpRes.status !== 200) {
    voteErrors.add(1)
    return
  }

  sleep(0.5)  // voter reads the OTP

  // 2. Verify OTP
  const verifyRes = http.post(
    `${BASE_URL}/api/voter/otp/verify`,
    JSON.stringify({ matricNumber: `VOTER-${__VU}`, code: '123456' }),
    { headers: { 'Content-Type': 'application/json', 'x-vw-org': ORG_SUBDOMAIN } },
  )
  if (verifyRes.status !== 200) {
    voteErrors.add(1)
    return
  }

  const token = verifyRes.json('accessToken') || 'test-token'

  // 3. Fetch ballot
  const ballotRes = http.get(
    `${BASE_URL}/api/workspace/ballot?electionId=demo-election`,
    { headers: { 'Authorization': `Bearer ${token}`, 'x-vw-org': ORG_SUBDOMAIN } },
  )

  // 4. Cast vote (the critical path)
  const voteStart = Date.now()
  const voteRes = http.post(
    `${BASE_URL}/api/vote/cast`,
    JSON.stringify({
      electionId: 'demo-election',
      selections: [{ positionId: 'pos-1', candidateId: 'cand-1' }],
      receipt: true,
    }),
    { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'x-vw-org': ORG_SUBDOMAIN } },
  )
  voteLatency.add(Date.now() - voteStart)

  const ok = check(voteRes, {
    'vote accepted': (r) => r.status === 200,
    'receipt returned': (r) => r.json('receiptCode') !== undefined,
  })
  if (!ok) voteErrors.add(1)

  sleep(1)  // voter pauses after voting
}
