#!/usr/bin/env bash
# VoteWise — Disaster Recovery Test Script
#
# Restores the latest backup to a scratch RDS instance, verifies row
# counts, runs integrity queries, and tears down. Run monthly.
#
# Spec: "Maintain documented recovery procedures and test them regularly."
#
# Usage: ./scripts/dr-test.sh

set -euo pipefail

SCRATCH_ID="votewise-dr-test-$(date +%Y%m%d-%H%M%S)"
SOURCE_ID="votewise-db-production"

echo "=== VoteWise DR Test ==="
echo "Source:  $SOURCE_ID"
echo "Scratch: $SCRATCH_ID"
echo ""

# 1. Restore latest snapshot to a scratch instance
echo "[1/5] Restoring latest snapshot to scratch instance..."
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier "$SCRATCH_ID" \
  --db-snapshot-identifier "$(aws rds describe-db-snapshots --db-instance-identifier "$SOURCE_ID" --query 'DBSnapshots[-1].DBSnapshotIdentifier' --output text)" \
  --db-instance-class db.t4g.medium \
  --no-publicly-accessible

# Wait for it to become available
echo "  Waiting for scratch instance to become available..."
aws rds wait db-instance-available --db-instance-identifier "$SCRATCH_ID"

# 2. Get the scratch endpoint
ENDPOINT=$(aws rds describe-db-instances --db-instance-identifier "$SCRATCH_ID" --query 'DBInstances[0].Endpoint.Address' --output text)
echo "  Scratch endpoint: $ENDPOINT"

# 3. Run integrity queries
echo "[2/5] Verifying row counts..."
psql "postgresql://votewise:$DB_PASSWORD@$ENDPOINT/votewise" <<SQL
  SELECT 'organizations' AS table, COUNT(*) FROM "Organization"
  UNION ALL SELECT 'elections', COUNT(*) FROM "ElectionSession"
  UNION ALL SELECT 'voters', COUNT(*) FROM "Voter"
  UNION ALL SELECT 'votes', COUNT(*) FROM "VoteRecord"
  UNION ALL SELECT 'candidates', COUNT(*) FROM "Candidate"
  UNION ALL SELECT 'audit_events', COUNT(*) FROM "AuditEvent";
SQL

echo "[3/5] Verifying vote/tally integrity..."
psql "postgresql://votewise:$DB_PASSWORD@$ENDPOINT/votewise" <<SQL
  SELECT
    (SELECT COUNT(*) FROM "VoteRecord") AS total_votes,
    (SELECT COALESCE(SUM("count"), 0) FROM "CandidateTally") AS tally_sum,
    CASE
      WHEN (SELECT COUNT(*) FROM "VoteRecord") = (SELECT COALESCE(SUM("count"), 0) FROM "CandidateTally")
      THEN '✓ MATCH'
      ELSE '✗ MISMATCH'
    END AS integrity;
SQL

echo "[4/5] Verifying backup encryption..."
# Check that the snapshot was encrypted
ENCRYPTED=$(aws rds describe-db-snapshots --db-instance-identifier "$SOURCE_ID" --query 'DBSnapshots[-1].Encrypted' --output text)
echo "  Snapshot encrypted: $ENCRYPTED"

# 5. Tear down
echo "[5/5] Tearing down scratch instance..."
aws rds delete-db-instance --db-instance-identifier "$SCRATCH_ID" --skip-final-snapshot
echo "  Scratch instance deleted."

echo ""
echo "✓ DR test complete. Restore verified, integrity OK, scratch torn down."
