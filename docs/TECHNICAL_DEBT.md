# VoteWise Technical Debt Tracker

> Living document tracking known technical debt items, their severity, and
> mitigation plans. Updated as debt is introduced or paid down.

## Severity Levels

| Level | Meaning | Action |
|-------|---------|--------|
| 🔴 High | Affects production readiness or security | Fix before next release |
| 🟡 Medium | Affects maintainability or developer experience | Fix in next sprint |
| 🟢 Low | Cosmetic or minor | Fix when convenient |

---

## Active Debt Items

### 1. Large "God" Components 🟡

**Status:** Tracked — candidates for splitting

| Component | Lines | Recommendation |
|-----------|-------|----------------|
| `infrastructure-console.tsx` | 5,969 | Split by tab (12 tabs → 12 files) |
| `qa-console.tsx` | 3,042 | Split by tab (6 tabs → 6 files) |
| `platform-operations-center.tsx` | 2,415 | Split by tab (6 tabs → 6 files) |
| `communication-center.tsx` | 2,081 | Split by tab |
| `billing-center.tsx` | 1,913 | Split by tab |
| `official.tsx` | 1,686 | Extract sub-views |
| `intelligence-dashboard.tsx` | 1,670 | Split by section |
| `home.tsx` | 1,627 | Extract sections |
| `election-ops-console.tsx` | 1,618 | Split by widget |

**Mitigation:** Each tab/section should be its own file in a folder:
`infrastructure-console/{pre-flight-tab.tsx, live-services-tab.tsx, ...}`

**Priority:** Medium — the components work, but are hard to navigate.

---

### 2. Missing Unit Tests 🔴

**Status:** Acknowledged — 27 test suites defined, runner not yet wired

The TQASGR module defines 27 test suites with 180+ test cases, but the
runner simulates execution. Real tests need to be wired to vitest/jest.

**Mitigation:**
1. Install vitest + @testing-library/react
2. Write real unit tests for critical modules (SVE crypto, tally, eligibility)
3. Wire the TQASGR runner to call vitest instead of simulating
4. Add to CI/CD pipeline

**Priority:** High — the spec requires 90% coverage for critical modules.

---

### 3. API Validation Gaps 🟡

**Status:** Tracked — some API routes lack Zod validation

Many API routes use `req.json().catch(() => ({}))` without validating the
input shape. This is a security risk (unexpected input) and a reliability
risk (runtime errors).

**Mitigation:**
1. Install Zod (if not already)
2. Create input schemas for each API route
3. Validate before processing
4. Return 400 with helpful error messages

**Priority:** Medium — add progressively, starting with the most critical
routes (vote casting, payment, authentication).

---

### 4. Duplicate Utility Functions 🟢

**Status:** Tracked — timeAgo, formatDateTime duplicated across components

Several components define their own `timeAgo()` and `formatDateTime()`
helpers instead of importing from a shared location.

**Mitigation:**
1. Create `src/lib/shared/format.ts` with canonical implementations
2. Update all components to import from there
3. Remove duplicates

**Priority:** Low — cosmetic, but improves consistency.

---

### 5. Mixed Business Logic in UI Components 🟡

**Status:** Tracked — some components make API calls directly

Some components call `fetch()` or `api.*` directly in event handlers
instead of going through a hook or service layer.

**Mitigation:**
1. Extract data-fetching into custom hooks (`useElectionData`, `useVoterData`)
2. Use TanStack Query for caching + invalidation
3. Components should only render, not fetch

**Priority:** Medium — improves testability and reusability.

---

### 6. Legacy Role Names 🟢

**Status:** Tracked — normalized via `normalizeRole()`

The database still has legacy role names (`SUPER_ADMIN`,
`ELECTORAL_COMMITTEE`, `FACULTY_OFFICER`, `DEPARTMENT_OFFICER`). These are
normalized to the new names via `normalizeRole()` in `src/lib/rbac.ts`.

**Mitigation:**
1. Run a migration to update all `ElectionOfficial.role` values
2. Update all seed scripts to use new role names
3. Remove the normalization layer

**Priority:** Low — the normalization layer handles it transparently.

---

### 7. Prisma Schema Size 🟡

**Status:** Tracked — schema is 2900+ lines with 80+ models

The single `prisma/schema.prisma` file is large. As more domains are added,
it will become harder to navigate.

**Mitigation:**
1. Prisma 6 supports multi-file schemas via the `prismaSchemaFolder` preview feature
2. Split into `prisma/models/organizations.prisma`, `prisma/models/elections.prisma`, etc.
3. Or keep as-is with clear section comments (current approach)

**Priority:** Medium — consider splitting when schema exceeds 5000 lines.

---

## Paid-Off Debt

| Item | Resolved In | How |
|------|------------|-----|
| Duplicate `getElection` API function | Ch.17 audit | Renamed legacy to `getLegacyElection()` |
| WAL pragma error ($executeRawUnsafe) | Ch.17 audit | Switched to `$queryRawUnsafe` |
| `elections/undefined` 404s | Ch.17 audit | Fixed duplicate key in api.ts |
| SLO NaN divide-by-zero | Ch.17 ext | Guarded with denominator > 0 check |
| Certification signature mismatch | Ch.18 audit | Rounded timestamp to nearest second |

---

## Debt Prevention Rules

1. **New components must be < 500 lines.** Split by tab/section if larger.
2. **New API routes must validate input.** Use Zod schemas.
3. **No duplicate utilities.** Check `src/lib/shared/` before creating a helper.
4. **No business logic in UI components.** Use hooks/services.
5. **New roles go in the RBAC matrix.** Never check roles with `if` statements.
