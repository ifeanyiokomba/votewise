-- Chapter 2: Row Level Security for the core tenant-owned tables.
--
-- Scope: Organization, ElectionSession, Position, Candidate, Voter. This is a
-- deliberately bounded first slice (Section 35: smallest coherent change) —
-- not all 157 models. Ballot/VoteRecord/EncryptedVote are excluded here on
-- purpose: their schema is still being consolidated per ADR-0002, and adding
-- RLS to a table whose columns are about to change is wasted, possibly
-- misleading work. They get RLS as part of that consolidation, not here.
--
-- How the app supplies tenant context: Prisma does not have a native
-- per-request Postgres session identity the way Supabase's PostgREST/JS
-- client does (that model expects auth.uid()/auth.jwt() from a per-user
-- connection). The working pattern for a Prisma-based app is to run each
-- request's queries inside a transaction that begins with
-- `SET LOCAL app.current_org_id = '<uuid>'`, set from the org already
-- resolved server-side by requireOrganization() — never from a client-
-- supplied value. That application-layer wiring (a Prisma $extends/
-- middleware wrapper) is the next piece of this chapter, tracked
-- separately — this migration is the database side of that contract.
--
-- Fails closed: if app.current_org_id is never set (forgotten SET LOCAL,
-- a raw psql session, a misconfigured connection), current_setting(...) 
-- returns NULL, "organizationId" = NULL is never true, and every policy
-- below hides every row. That's the correct failure direction.

-- A dedicated, non-superuser application role. RLS does not apply to table
-- owners or superusers by default — running the app as `postgres` would
-- make every policy below a no-op. This is the role the app's DATABASE_URL
-- should actually connect as.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN PASSWORD 'CHANGE_ME_IN_EACH_ENVIRONMENT';
  END IF;
END
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  "Organization", "ElectionSession", "Position", "Candidate", "Voter"
  TO app_user;

ALTER TABLE "Organization"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ElectionSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Position"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Candidate"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Voter"           ENABLE ROW LEVEL SECURITY;

ALTER TABLE "Organization"    FORCE ROW LEVEL SECURITY;
ALTER TABLE "ElectionSession" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Position"        FORCE ROW LEVEL SECURITY;
ALTER TABLE "Candidate"       FORCE ROW LEVEL SECURITY;
ALTER TABLE "Voter"           FORCE ROW LEVEL SECURITY;

-- Organization is its own tenant boundary: id, not organizationId.
CREATE POLICY tenant_isolation ON "Organization"
  USING (id = current_setting('app.current_org_id', true))
  WITH CHECK (id = current_setting('app.current_org_id', true));

CREATE POLICY tenant_isolation ON "ElectionSession"
  USING ("organizationId" = current_setting('app.current_org_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', true));

CREATE POLICY tenant_isolation ON "Position"
  USING ("organizationId" = current_setting('app.current_org_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', true));

CREATE POLICY tenant_isolation ON "Candidate"
  USING ("organizationId" = current_setting('app.current_org_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', true));

CREATE POLICY tenant_isolation ON "Voter"
  USING ("organizationId" = current_setting('app.current_org_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_org_id', true));
