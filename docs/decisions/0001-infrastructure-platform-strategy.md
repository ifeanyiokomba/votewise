# ADR-0001: Infrastructure Platform Strategy

**Status:** Proposed — needs Ifeanyi's decision before Chapter 2 starts
**Date:** 2026-08-05

## Context

The new directive (Section 5) specifies: Vercel for deployment, Supabase for managed Postgres +
auth + storage, and Cloudflare for DNS/edge/rate-limiting. It also specifies PostgreSQL Row Level
Security as one of three required tenant-isolation layers.

The existing codebase (`current-state-assessment.md`, Section 5) is built against a different
target: AWS EKS via Terraform, Kubernetes manifests, GuardDuty/Shield/Macie, a Caddy edge layer,
Redis, a ClamAV sidecar, and six separately deployed mini-services. It uses Prisma against a
Postgres/SQLite datastore with no Supabase client and no RLS found anywhere.

Nothing after this point — the schema design, the isolation strategy, the deployment runbook, the
CI/CD pipeline — can be written correctly without knowing which of these two operating models this
project is actually going to run on. This has to be resolved first.

## Why it matters beyond "which cloud"

The directive's stack isn't arbitrary — a solo founder running AWS EKS, Terraform, GuardDuty,
Shield Advanced, and a Kubernetes cluster correctly and securely, indefinitely, on top of building
the product itself, is a lot of ongoing operational surface for one person to carry. That's likely
*why* the directive specifies managed services: Vercel/Supabase/Cloudflare push most of the
infrastructure-security burden onto vendors whose entire job is running that infrastructure
correctly, leaving the tenant-isolation and election-integrity logic — the part that actually needs
bespoke engineering attention — as the main thing left to get right.

## Options

### Option A — Adopt the directive's stack as specified
Migrate the data layer to Supabase-managed Postgres with RLS policies, deploy the Next.js app to
Vercel, move DNS/edge/rate-limiting to Cloudflare, retire the Kubernetes/Terraform/AWS-security
layer, and fold the six mini-services into packages within the monorepo (most of what they do —
scheduled jobs, notification dispatch, result computation — can run as background jobs or edge
functions rather than separately deployed services).

- **Keeps:** the Next.js frontend, the RBAC design, the OTVP flow design, the domain thinking
  embedded in the Prisma schema (used as a reference during the SQL migration design, not carried
  over mechanically).
- **Drops:** AWS/Kubernetes/Terraform, Prisma as the data-access layer (Supabase's tooling expects
  SQL migrations + generated types, not Prisma specifically, though Prisma can still point at a
  Supabase Postgres instance if preferred — worth a narrower follow-up decision if this option is
  chosen), the six mini-services as separate deployments, NextAuth (Supabase Auth would be the
  natural replacement, though this is also a narrower decision that doesn't have to be settled here).
- **Cost:** the largest of the three options — real replatforming work, concentrated in Chapters 2
  and 3.
- **Benefit:** matches the directive exactly, and meaningfully lowers what a solo founder has to
  personally operate and secure on an ongoing basis.

### Option B — Keep the current stack, meet the same principles a different way
Stay on Prisma + self-hosted/managed Postgres + the current deployment model. Row Level Security is
a native Postgres feature, not a Supabase-exclusive one — it can be enabled and policy-written
directly against whatever Postgres instance is in use, without adopting Supabase itself. Treat the
directive's *principles* (tenant isolation enforced at the database layer, not just in application
code; audit architecture; ballot secrecy; multi-person authorization) as the binding requirements,
and treat "Supabase specifically" as one implementation of those requirements rather than the only
one.

- **Keeps:** everything currently built, including the AWS/Kubernetes investment.
- **Drops:** nothing structurally, but requires closing the RLS gap, the nullable-tenant-ID gap, and
  the real-testing gap identified in `current-state-assessment.md` on the current stack.
- **Cost:** lower migration cost, but the ongoing operational burden of running EKS/Terraform/
  GuardDuty/Shield correctly stays with Ifeanyi indefinitely, which is a real, recurring cost even
  though it doesn't show up as a one-time migration line item.
- **Benefit:** preserves the largest share of existing work.

### Option C — Hybrid
Keep the Next.js application, the domain/business logic, and Prisma as the ORM, but move hosting to
Vercel and DNS/edge to Cloudflare, add real Postgres RLS policies directly (on whichever managed
Postgres provider is chosen — this could be Supabase used only for its Postgres hosting rather than
its full platform, or another managed Postgres provider), and retire the Kubernetes/Terraform/AWS-
security-tooling layer in favor of the lighter-weight Cloudflare + Vercel + provider-managed-Postgres
model. Fold the mini-services into the monorepo as in Option A.

- **Keeps:** Prisma, the application code, most of the schema (once the vote-storage consolidation
  in ADR-0002 is done), the domain logic.
- **Drops:** AWS/Kubernetes/Terraform and the six separately-deployed mini-services; keeps the
  application-layer stack largely intact.
- **Cost:** moderate — mostly an infrastructure and deployment change, not an application rewrite.
- **Benefit:** removes the heaviest operational burden (self-run Kubernetes + AWS security tooling)
  while preserving the most application code and requiring the least rework of business logic
  already written.

## Recommendation

**Option C**, with a path to Option A later if it turns out the full Supabase platform (managed
auth, storage, realtime) is worth adopting once the migration is underway. The reasoning: the
heaviest, least product-differentiated burden in the current architecture is the AWS/Kubernetes
operational layer — that's what a solo founder benefits most from shedding. The Prisma-based
application and domain logic, by contrast, represents real engineering investment (590 files, a
carefully considered OTVP flow, a mostly-sound RBAC model) that doesn't need to be thrown away to
satisfy the directive's actual underlying principles, as opposed to its specific vendor names.

This is a recommendation, not a decision — it's Ifeanyi's call, and it changes what Chapter 2 looks
like depending on the answer.

## What's needed to proceed

A confirmed choice of A, B, or C before Chapter 2 (Database and tenant isolation) begins. Everything
else delivered in this chapter — the PRD, threat model, role matrix, and open-questions document —
holds regardless of the answer.
