# VoteWise — Database Architecture & Provider Swap

> Spec: "Primary database: PostgreSQL. Features: Connection pooling, Read
> replicas, Automatic backups, Point-in-time recovery, High availability."
> Spec: "Database Scaling: Primary → Read Replica → Analytics Database →
> Archive Database. Reporting should never slow down voting."

## SQLite (Sandbox) vs PostgreSQL (Production)

The Prisma schema (`prisma/schema.prisma`) uses **SQLite** for the sandbox
so the app runs with zero infrastructure. For production, swap the
provider to **PostgreSQL** — no schema changes required (Prisma abstracts
the SQL dialect).

### Swap procedure

```bash
# 1. Change the provider in prisma/schema.prisma:
#    datasource db {
#      provider = "postgresql"   # was "sqlite"
#      url      = env("DATABASE_URL")
#    }

# 2. Set DATABASE_URL to the PostgreSQL connection string:
export DATABASE_URL="postgresql://votewise:password@db.internal:5432/votewise"

# 3. Optionally set DATABASE_REPLICA_URL for read-replica routing:
export DATABASE_REPLICA_URL="postgresql://votewise:password@replica.internal:5432/votewise"

# 4. Push the schema:
npx prisma db push
# or npx prisma migrate deploy (for migration-based workflows)
```

### Automated swap script

```bash
# For CI/CD: swap the provider before build
sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma
npx prisma generate
```

The Dockerfile already sets `DATABASE_URL` to a PostgreSQL connection
string (see `docker-compose.yml`). The only remaining step is the provider
swap in `schema.prisma`, which is done by the CI/CD pipeline before the
production build.

## Connection Pooling

**RDS Proxy** (provisioned in `infrastructure/main.tf`) sits between the
app and the primary RDS instance. It pools connections so that traffic
spikes don't exhaust the database's connection limit.

- App connects to: `DATABASE_URL` → RDS Proxy endpoint
- RDS Proxy connects to: RDS primary
- Pool size: auto-managed (default 90% of max_connections)
- TLS required between app and proxy

## Read Replica Routing

All **read-heavy analytics/reporting** queries use `dbReplica` instead of
`db`:

```typescript
// Writing votes → primary (never the replica)
import { db } from '@/lib/db'
await db.voteRecord.create({ ... })

// Reading for reports → replica (never slows down voting)
import { dbReplica } from '@/lib/infra/db-replica'
const results = await dbReplica.voteRecord.findMany({ ... })
```

Already wired:
- `src/lib/raei/analytics-engine.ts` → uses `dbReplica`
- `src/lib/raei/report-generator.ts` → uses `dbReplica`

In the sandbox (no `DATABASE_REPLICA_URL`), `dbReplica` falls back to the
primary. In production, it routes to the read replica.

## Database Tiers

| Tier | Purpose | Config |
|------|---------|--------|
| Primary | Vote recording, writes, real-time reads | `DATABASE_URL` (RDS Multi-AZ) |
| Read Replica | Reporting, analytics, exports | `DATABASE_REPLICA_URL` (RDS replica) |
| Analytics DB | Heavy aggregations, AI insights | (future: separate Redshift/Athena) |
| Archive DB | Completed elections, audit trails | (future: S3 + Athena for cold storage) |

## Backup & Recovery

- **Automated backups**: RDS daily snapshots, 30-day retention (production)
- **Point-in-time recovery**: 5-minute transaction log backups → restore
  to any second in the retention window
- **Cross-region**: backup bucket replicates to eu-central-1 (Frankfurt)
- **Manual**: `POST /api/pihed/backups/trigger` or `scripts/backup-cron.sh`

See `docs/DISASTER_RECOVERY.md` for the full DR plan.
