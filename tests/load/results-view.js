/* eslint-disable import/no-anonymous-default-export */
// VoteWise — k6 Load Test: Results Page (read-heavy path)
//
// Simulates voters + observers watching live results. This is the read
// path that must scale independently of the write path (spec: "Reporting
// should never slow down voting").
//
// Usage:
//   k6 run --vus 50000 --duration 10m tests/load/results-view.js

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend, Counter } from 'k6/metrics'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

const resultsLatency = new Trend('results_latency', true)
const wsErrors = new Counter('ws_errors')

export const options = {
  stages: [
    { duration: '30s', target: parseInt(__ENV.VUS || '50000') },
    { duration: __ENV.DURATION || '10m', target: parseInt(__ENV.VUS || '50000') },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    'results_latency': ['p(95)<200', 'p(99)<500'],
    'http_req_failed': ['rate<0.001'],
  },
}

export default function () {
  // 1. Poll results endpoint (every 5s, like the live-results dashboard)
  const start = Date.now()
  const res = http.get(`${BASE_URL}/api/results?electionId=demo-election`)
  resultsLatency.add(Date.now() - start)

  check(res, {
    'results 200': (r) => r.status === 200,
    'has positions': (r) => r.json('positions') !== undefined,
  })

  sleep(5)

  // 2. Hit the public status page
  http.get(`${BASE_URL}/api/pihed/status`)

  sleep(5)
}
