# VoteWise — Disaster Recovery Plan

> Spec: "Recovery objectives: Minimal downtime, No vote loss, Fast restoration.
> Maintain documented recovery procedures and test them regularly."

## Recovery Objectives

| Objective | Target | Basis |
|-----------|--------|-------|
| **RTO** (Recovery Time Objective) | < 30 minutes | Election-day tolerance |
| **RPO** (Recovery Point Objective) | < 5 minutes | PITR + WAL streaming |
| **Vote Loss** | 0 | Votes are written transactionally + receipt-anchored |

## Backup Strategy

| Type     | Frequency | Retention | Storage                          |
|----------|-----------|-----------|----------------------------------|
| Hourly   | every hour at :05 | 24 hours | S3 `backups` bucket (region A) |
| Daily    | 02:00 daily | 7 days   | S3 `backups` + cross-region DR  |
| Weekly   | Sun 03:00   | 4 weeks  | S3 `backups` + Glacier lifecycle |
| Monthly  | 1st 04:00   | 12 months| S3 `backups` + Glacier Deep Archive |

All backups are AES-256 encrypted at rest and TLS-encrypted in transit.
The `backups` bucket replicates to `eu-central-1` (Frankfurt) for
cross-region disaster recovery.

## RDS Point-in-Time Recovery

RDS is configured with:
- `backup_retention_period = 30` (production) / `7` (staging)
- `multi_az = true` (production) — synchronous standby in a second AZ
- Automated daily snapshots during the 02:00–03:00 backup window
- 5-minute transaction log backup enables PITR to any second in the
  retention window

To restore to a point in time:

```bash
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier votewise-db-production \
  --target-db-instance-identifier votewise-db-restore \
  --restore-time 2025-08-02T14:30:00Z \
  --db-subnet-group-name votewise-production
```

## Failover Procedures

### Database failover (Multi-AZ)
RDS Multi-AZ failover is automatic: the standby is promoted in < 60 seconds.
No operator action required. The application's connection pooler (PgBouncer)
reconnects automatically.

### Application failover (multi-region)
1. The Route53 record for `votewise.com.ng` is repointed to the DR region's
   ALB via a weighted policy or failover policy.
2. DNS TTL is 60 seconds, so global failover completes in < 5 minutes.
3. The DR region runs the same Terraform stack with the latest AMI.

### Redis failover
ElastiCache automatic failover promotes a read replica in < 10 seconds.
The application reconnects via the primary endpoint (DNS is updated by AWS).

## Recovery Test Schedule

> Spec: "test them regularly"

- **Monthly**: restore the latest daily backup to a scratch RDS instance,
  verify row counts, run integrity queries, tear down. Documented in
  `scripts/dr-test.sh`.
- **Quarterly**: full failover drill — promote the DR region, run smoke
  tests, fail back. Documented in `scripts/dr-failover-drill.sh`.
- **Annually**: full cold-start from backups only (no infra) to validate
  the Terraform + restore path end-to-end.

## Runbooks

### Runbook: Database corruption detected
1. Trigger `ElectionLock` to freeze all active elections (prevents new votes).
2. Snapshot the corrupted instance (for forensics).
3. Restore from the most recent hourly backup via PITR.
4. Verify the restored instance with `scripts/verify-backup.sh`.
5. Repoint the application to the restored instance.
6. Release the `ElectionLock`.
7. File an incident report.

### Runbook: Region failure
1. Trigger `ElectionLock` globally.
2. Run `scripts/dr-failover.sh` — promotes the DR region.
3. Verify `https://votewise.com.ng/api/pihed/health` returns `ready: true`.
4. Release the `ElectionLock`.
5. Once the primary region recovers, fail back with `scripts/dr-failback.sh`.

### Runbook: Vote loss suspected
1. Trigger `ElectionLock`.
2. Query `VoteRecord` count vs `CandidateTally` sum — they must match.
3. If mismatch: restore from PITR to a scratch instance, diff the tables,
   identify the missing records.
4. Re-apply missing records from the audit log (`AuditEvent` table).
5. Release the `ElectionLock`.

## Verification Scripts

```bash
# Verify the latest backup is restorable
./scripts/dr-test.sh

# Run a full failover drill
./scripts/dr-failover-drill.sh

# Restore a specific backup
./scripts/restore-backup.sh <backup-id>
```
