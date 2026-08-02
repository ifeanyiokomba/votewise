# VoteWise — Deployment Guide

> Spec: "Blue-Green Deployment", "Canary Releases", "Zero-Downtime Deployments"

## Deployment Strategies

VoteWise supports three deployment strategies, selectable per release:

### 1. Blue-Green (default for major releases)
- The current live version is "blue". The new version is deployed as "green"
  alongside it, behind the load balancer but receiving no traffic.
- Health checks run against green. If they pass, traffic is switched.
- If issues occur, traffic is switched back to blue instantly (rollback).
- See `scripts/blue-green-deploy.sh`.

### 2. Canary (default for risky changes)
- New version is deployed alongside the live version.
- Traffic is shifted in stages: 25% → 50% → 100%.
- At each stage, error rate and latency are monitored.
- If error rate exceeds 1%, the canary is auto-rolled-back.
- See the "Deployments" tab in `/admin/infrastructure` for the promote UI.

### 3. Rolling (default for low-risk patches)
- Pods are replaced one at a time (`maxUnavailable: 0`, `maxSurge: 1`).
- The load balancer health-checks each new pod before sending traffic.
- Zero-downtime because `maxUnavailable` is always 0.

## Zero-Downtime Guarantees

1. **Existing users stay connected** — the `preStop` hook sleeps 15 seconds
   so the load balancer deregisters the pod before it exits.
2. **Active voting sessions continue uninterrupted** — vote recording is
   transactional; in-flight votes commit to the database before the pod exits.
3. **No ongoing vote is lost** — the `terminationGracePeriodSeconds: 60`
   gives in-flight requests time to complete.
4. **Database migrations are backward compatible** — see
   `docs/DATABASE_MIGRATIONS.md` (additive-only migrations; column drops
   are deferred until the old version is fully retired).

## CI/CD Pipeline

```
Developer Push
  → Linting (ESLint)
  → Type Check (tsc --noEmit)
  → Unit Tests
  → Integration Tests
  → Security Scan (npm audit + secret detection)
  → Build (next build)
  → Deploy to Staging (auto)
  → Smoke Test (health check)
  → Manual Approval
  → Deploy to Production (blue-green or canary)
  → Post-Deploy Health Check
  → Monitoring (Sentry + CloudWatch)
```

No direct production deployments. Every change flows through the pipeline.

## Rollback

- **Blue-green**: instant — switch traffic back to blue.
- **Canary**: instant — shift canary traffic to 0%.
- **Rolling**: re-deploy the previous image tag.
- The "Deployments" tab in `/admin/infrastructure` exposes a one-click
  rollback with a reason field for the audit trail.

## Database Migrations

Migrations are run by the scheduler service before each deployment is
promoted to receive traffic. They are:

1. **Additive only** — new columns are nullable or have defaults.
2. **Backward compatible** — the old version must keep working.
3. **Two-phase** — column drops happen in a separate release, after the
   old version is retired.

This ensures zero-downtime during migrations.
