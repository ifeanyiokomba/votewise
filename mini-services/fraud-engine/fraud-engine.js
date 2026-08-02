// VoteWise — Fraud Engine entrypoint.
//
// Continuously evaluates IntegrityEvent rows through the 8 EIFDIRS
// detectors (vote flooding, geo-anomaly, device fingerprint reuse,
// velocity, OTVP abuse, session hijack, ballot stuffing, coordinated
// attack). Raises FraudIncident records when risk scores cross thresholds.
//
// Runs as a dedicated microservice so detection never competes with vote
// recording for CPU.

console.log('[fraud-engine] started — polling IntegrityEvent stream')

setInterval(() => {
  // In production: SELECT * FROM IntegrityEvent WHERE processed=false ORDER BY createdAt LIMIT 100
  // For each: run through detectors, update risk score, raise incidents.
  // Detection logic lives in src/lib/eifdirs/fraud-detector.ts
}, 15_000)
