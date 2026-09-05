# MyLife Code Review Report

**Date:** 2026-03-04
**Reviewer:** TheDawg
**Scope:** Full codebase audit of ~/Apps/MyLife/

---

## Executive Summary

MyLife is a well-architected Turborepo monorepo with strong foundational patterns. Phase 0 (hub foundation) and Phase 1 (MyBooks migration) are complete. The module system, database layer, and parity enforcement tooling are production-quality for their scope. However, the project is firmly in **early alpha** territory with significant gaps in auth, subscription, observability, and multi-module parity that must be addressed before any external user testing.

**Codebase stats:**
- ~1,008 source files (excluding tests, dist, node_modules)
- ~185 test files
- 13 modules registered (books, budget, fast, health, recipes, rsvp, surf, workouts, homes, car, habits, meds, words)
- 3 standalone repos with runtime code (MyBooks: 146 files, MyBudget: 245 files, MyWorkouts: 163 files)
- 22 remaining standalone repos are design-doc-only (no runtime code)

---

## Architecture Assessment

### Strengths

1. **Module system is well-designed.** The `ModuleDefinition` contract with Zod validation, the `ModuleRegistry` pub/sub pattern, and the migration runner are clean and extensible. Each module is isolated with its own table prefix, migrations, and navigation definition.

2. **SQLite-local architecture is sound.** Single-file database with prefixed tables per module, WAL mode enabled, foreign keys enforced. The `DatabaseAdapter` interface abstracts over expo-sqlite (mobile) and better-sqlite3 (web) cleanly.

3. **Parity enforcement is tooled.** Multiple parity check scripts (`check:parity`, `check:module-parity`, `check:passthrough-parity`, `check:workouts-parity`) plus CI integration. This is rare and valuable for a multi-form-factor project.

4. **CI pipeline exists and is comprehensive.** GitHub Actions runs parity, lint, typecheck, test, coverage, and conditional E2E. Concurrency groups with cancel-in-progress. Path filtering for E2E to avoid unnecessary runs.

5. **Error boundaries are implemented.** Mobile `ModuleErrorBoundary` catches rendering crashes per-module and provides recovery UX. `DatabaseProvider` handles init failures with retry. This is production-grade resilience.

6. **Security headers on web.** Middleware sets X-Frame-Options, CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy. Good baseline.

7. **Self-host infrastructure is substantial.** Docker Compose with Postgres, MinIO, Express API. Session tokens, rate limiting, HMAC-signed federation, actor identity tokens, scrypt password hashing. This is surprisingly mature for the project's stage.

8. **Function quality gate tooling.** Scaffolding and gate scripts for function-level testing. Not common in projects this size.

### Issues and Technical Debt

#### Critical

1. **Auth and subscription packages are stubs.** `@mylife/auth` and `@mylife/subscription` export only a constant string. No Supabase Auth, no RevenueCat, no Stripe integration exists. These are Phase 3 blockers and represent the largest gap to production.

2. **TypeScript errors in CI.** `pnpm typecheck` fails with 19 errors, all in MyWorkouts standalone submodule (missing `react`, `next/navigation`, `better-sqlite3`, `zustand` type declarations; implicit `any` parameters). This is a release blocker and CI is red on main.

3. **Test failure on main.** `@mylife/meds` has 1 failing test (`adherence.test.ts` -- `getAdherenceStats` expects `totalTaken=4` but gets `3`). This means CI test job fails on main.

4. **Parity check fails.** `MyHealth` standalone submodule is missing its `.git` entry, causing `check:standalone` to fail. Since `check:parity` gates on this, the full parity suite cannot pass.

#### High

5. **No observability stack.** Error handling is `console.error` only. No Sentry, no structured logging, no error reporting service, no performance monitoring. Module crashes are logged but not reported anywhere actionable.

6. **Web CSP allows unsafe-inline and unsafe-eval.** The CSP header includes `'unsafe-inline' 'unsafe-eval'` for scripts, which significantly weakens XSS protection. Next.js requires some inline styles but `unsafe-eval` should be removable.

7. **Self-host API is a single JavaScript file (server.js).** At ~900+ lines, this is a monolith that mixes auth, federation, messaging, social sharing, and health checks. No TypeScript, no modular routing, no request validation library.

8. **22 of 25 standalone repos are empty.** They have design docs but no runtime code. The parity system tracks them but they represent significant unrealized scope.

9. **No data backup/restore strategy for mobile.** SQLite file on device with no export, iCloud sync, or backup mechanism. Data loss on device failure is a user risk.

#### Medium

10. **Web database is a file on disk (better-sqlite3).** `mylife-hub.db` is created in `process.cwd()` with no backup, rotation, or corruption recovery. Fine for dev/self-host but not for multi-user hosted deployment.

11. **Session tokens stored in-memory (self-host API).** The `sessionTokens` Map is wiped on process restart. No persistent session store.

12. **No input validation on web API routes.** The self-host server.js has manual parsing functions but no Zod or similar validation. The Next.js API routes use server actions with manual checks.

13. **No rate limiting on Next.js web app.** The self-host Express API has rate limiting, but the Next.js app has none.

14. **Missing web error boundary.** Mobile has `ModuleErrorBoundary` but the web app has no equivalent React error boundary wrapping module routes.

15. **Entitlements package uses WebCrypto only.** The `verify.ts` HMAC signing requires `globalThis.crypto.subtle`, which may not be available in all Node.js versions without explicit import.

#### Low

16. **No code splitting markers.** Module routes load eagerly. No dynamic import boundaries for code splitting in the web app.

17. **UI package has Books-specific components.** `BookCover`, `ReadingGoalRing`, `ShelfBadge` are in `@mylife/ui` rather than in `@mylife/books`. This is a layering violation.

18. **Mixed import patterns in self-host API.** Uses both `require` (implicit via .js) and modern `fetch`. Should be ESM or have explicit require statements.

---

## Module Maturity Matrix

| Module | Definition | Migrations | CRUD | Tests | Web Routes | Mobile Routes | Standalone Code |
|--------|-----------|------------|------|-------|------------|---------------|-----------------|
| books | Full | v1 | Yes | 7 files | Full | Full | MyBooks (146 files) |
| budget | Full | v1-v2 | Yes | 1+12 files | Partial | Yes | MyBudget (245 files) |
| fast | Full | v1 | Yes | 1 file | Full | Full | Design docs only |
| health | Full | v1 | Yes | 3 files | Full | N/A | Design docs only |
| recipes | Full | v1 | Yes | 2 files | Partial | Yes | Design docs only |
| meds | Full | v1 | Yes | 10 files (1 failing) | Full | Yes | Design docs only |
| car | Full | v1 | Yes | 1 file | Full | Yes | Design docs only |
| habits | Full | v1 | Yes | 1 file | Full | Yes | Design docs only |
| words | Full | v1 | Yes | 1 file | Yes | Yes | Design docs only |
| workouts | Full | v1 | Yes | 0 hub tests | Full | Yes | MyWorkouts (163 files) |
| surf | Partial | N/A | Via Supabase | 0 | Full | Yes | Design docs only |
| homes | Partial | N/A | Via Drizzle | 0 | Partial | Yes | Design docs only |
| rsvp | Full | v1 | Yes | 1 file | Planned | Planned | Design docs only |

---

## Code Quality Observations

**Positive patterns:**
- Consistent use of TypeScript strict mode
- Zod schemas for runtime validation in core packages
- Clean separation of module business logic from app shell
- Conventional commits in git history
- Test factories and test utilities in `@mylife/db`

**Patterns needing attention:**
- `console.error` as the only error reporting mechanism
- No structured error types (custom Error subclasses) across modules
- Server actions in web app lack consistent error handling patterns
- No loading states or skeleton screens documented as patterns
- Database queries use raw SQL strings (no query builder outside of Drizzle for homes)

---

## Recommendations (Priority Order)

1. Fix CI: Resolve MyWorkouts typecheck errors and meds test failure. Green main is non-negotiable.
2. Fix parity: Initialize MyHealth git entry.
3. Add Sentry or equivalent for mobile and web error reporting.
4. Begin Phase 3 (auth + subscription) -- this is the critical path to revenue.
5. Break self-host server.js into modular TypeScript files.
6. Add web error boundaries matching mobile pattern.
7. Remove `unsafe-eval` from CSP.
8. Plan data export/backup for mobile users.
