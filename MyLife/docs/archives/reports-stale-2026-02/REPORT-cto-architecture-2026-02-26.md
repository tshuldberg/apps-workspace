# CTO Architecture Review -- MyLife Hub

**Date:** 2026-02-26
**Author:** CTO Agent (Architecture Synthesis)
**Scope:** Full monorepo technical architecture, debt inventory, parity assessment, cloud readiness, testing/CI, and 3-month implementation plan.

---

## Executive Summary

MyLife is an ambitious 13-module privacy-first personal app hub built on a Turborepo monorepo with TypeScript, Expo (mobile), Next.js 15 (web), and SQLite (local-first storage). The project has made impressive progress in roughly 3 days of intensive development, going from zero to a working hub with 13 registered modules, passthrough parity for 4+ standalone apps, a full CI pipeline, 175+ web tests, 79+ mobile tests, self-host deployment infrastructure, and an entitlements/billing foundation.

The architecture is fundamentally sound. The module registry pattern, shared SQLite with table prefixes, and passthrough parity system are well-designed and scaling appropriately. However, the velocity of development has introduced technical debt that needs structured resolution before launch. Key concerns include: storage backend inconsistency across cloud modules, the RSVP module's broken build, incomplete mobile passthrough conversion, and the self-host/federation layer's rapid expansion outpacing test coverage.

---

## 1. Architecture Health

### 1.1 Monorepo Structure -- HEALTHY

The Turborepo monorepo is well-organized with clear separation:

```
apps/     -- Platform shells (mobile, web)
modules/  -- Per-module business logic (13 modules)
packages/ -- Shared infrastructure (db, module-registry, ui, auth, entitlements, billing-config, migration, subscription)
```

**Strengths:**
- Clean `pnpm-workspace.yaml` with three workspace roots (`apps/*`, `packages/*`, `modules/*`).
- `turbo.json` properly declares task dependencies (`^build` for test/lint/typecheck).
- Package naming is consistent (`@mylife/<name>` for all packages/modules).
- Each module is a first-class workspace package with its own `package.json`, `tsconfig.json`, and test config.

**Concerns:**
- `packages/` has grown to 10 packages including infrastructure that may be premature (`auth/`, `subscription/` are stubs for Phase 3). This is acceptable as scaffolding but should not accumulate real complexity until needed.
- Some duplicate directories exist in the web app (e.g., `__tests__ 2`, `api 2`, `books 2`) -- these appear to be filesystem artifacts and should be cleaned up.

### 1.2 Module Registry Pattern -- STRONG

The `ModuleDefinition` interface (`packages/module-registry/src/types.ts`) is the architectural keystone. It provides:

- **Type-safe module IDs** via `ModuleId` union type (13 values).
- **Runtime validation** via Zod schema (`ModuleDefinitionSchema`).
- **Complete metadata** in `MODULE_METADATA` constant (all 13 modules fully specified).
- **Lifecycle hooks** for enable/disable/migrate flows.

The registry pattern scales well. Adding a module requires:
1. Add ID to `ModuleId` union and `ModuleIdSchema`.
2. Add metadata to `MODULE_METADATA`.
3. Create `modules/<name>/` with `definition.ts` exporting `ModuleDefinition`.
4. Wire into `apps/web/lib/db.ts` and `apps/mobile/components/DatabaseProvider.tsx`.

**Risk:** Steps 3-4 are manual and error-prone. The passthrough parity system catches drift, but a module scaffolding generator would reduce friction.

### 1.3 Database Layer -- SOUND with caveats

**SQLite adapter pattern:**
- `DatabaseAdapter` interface (`packages/db/src/adapter.ts`) abstracts `execute`, `query`, `transaction`.
- `better-sqlite3` (web) and `expo-sqlite` (mobile) implement the same interface.
- Single `.sqlite` file with per-module table prefixes prevents collision.
- Migration runner (`packages/db/src/migration-runner.ts`) tracks versions in `hub_schema_versions`.

**Hub schema is feature-rich:**
The `hub-schema.ts` defines 13 tables including enabled modules, preferences, subscriptions, entitlements, friend profiles, friend invites, friendships, friend messages, message outbox, revoked entitlements, aggregate counters, and schema versions. This is substantial infrastructure that has been well-tested (48 DB tests passing).

**Table prefix allocation:**

| Module | Prefix | Status |
|--------|--------|--------|
| Hub | `hub_` | Active, 13 tables |
| Books | `bk_` | Active, 3 schema versions |
| Budget | `bg_` | Active, 2 schema versions (core + bank sync) |
| Workouts | `wk_` | Active, 2 schema versions (legacy + v2 feature architecture) |
| Fast | `ft_` | Scaffolded |
| Recipes | `rc_` | Scaffolded |
| Car | `cr_` | Scaffolded |
| Habits | `hb_` | Scaffolded |
| Meds | `md_` | Scaffolded |
| Subs | `sb_` | Scaffolded |
| Words | `wd_` | Declared but empty (no tables, API-only) |
| Surf | `sf_` | Active, 1 schema version |
| Homes | `hm_` | Active, 1 schema version |
| RSVP | `rv_` | Active, newly scaffolded |

### 1.4 Passthrough Parity System -- INNOVATIVE

The passthrough system is the project's most distinctive architectural pattern. It enforces that hub web routes are thin wrappers re-exporting standalone app pages:

```typescript
// apps/web/app/books/page.tsx
export { default } from '@mybooks-web/app/books/page';
```

This is enforced by:
- `scripts/check-passthrough-parity.mjs` (strict file content assertions)
- `apps/web/test/parity/standalone-passthrough-matrix.test.ts` (82 test cases)
- `pnpm check:parity` gate (runs in CI)

**Current passthrough status:**

| Module | Web Mode | Mobile Mode |
|--------|----------|-------------|
| Books | passthrough | adapter |
| Budget | passthrough | adapter |
| Words | duplicate (needs passthrough) | adapter |
| Workouts | passthrough | adapter |
| Habits | passthrough | adapter |
| All others | adapter | adapter |

**Concern:** Mobile is entirely adapter-mode. Passthrough conversion for mobile should follow the web pattern but is blocked by platform differences (Expo Router vs Next.js App Router).

---

## 2. Technical Debt Inventory

### 2.1 Critical Debt

**D1: RSVP module has broken build.**
`@mylife/rsvp#test` fails because `node_modules` are missing (`vitest: command not found`). The module's `package.json` specifies `vitest` as a peer dependency of `@mylife/db` but does not have it as a dev dependency directly, and the workspace package is not properly linked. This breaks the full `pnpm test` run.
- **Fix:** Add `vitest` dev dependency to `modules/rsvp/package.json` and run `pnpm install`.
- **Effort:** 10 minutes.

**D2: Storage backend inconsistency across cloud modules.**
The `MODULE_METADATA` constant declares `surf.storageType: 'supabase'` and `homes.storageType: 'drizzle'`, but both modules now have SQLite schemas with table prefixes (`sf_`, `hm_`) and use the standard `DatabaseAdapter` pattern. Workouts was originally `supabase` but was changed to `sqlite` in `MODULE_METADATA` while keeping `storageType: 'supabase'` in `SURF_MODULE.definition.ts`. This creates a confusing mixed signal.
- The `storageType` field has three values (`sqlite | supabase | drizzle`) but the actual implementation for all 13 modules is SQLite via the hub adapter.
- No Supabase client code exists in `modules/surf/` or `modules/homes/`.
- No Drizzle schema exists in `modules/homes/`.
- **Fix:** Either (a) align `storageType` to `sqlite` for all modules that currently use SQLite, or (b) document this field as "target storage" vs "current storage" and add a `currentStorage` field.
- **Effort:** 30 minutes for option (a), 2 hours for option (b).

**D3: Duplicate/artifact directories in web app.**
Several `* 2` directories exist (`__tests__ 2`, `api 2`, `books 2`, `budget 2`, `car 2`, `fast 2`, `habits 2`, `meds 2`, `ops 2`, `recipes 2`, `subs 2`). These are likely filesystem copy artifacts.
- **Fix:** Remove all `* 2` directories.
- **Effort:** 5 minutes.

### 2.2 Significant Debt

**D4: Hub schema exports have stale type references.**
`packages/db/src/index.ts` exports 88 symbols from `hub-queries.ts`. The timeline notes that stale friend-message exports previously blocked typechecks and had to be pruned. This export surface is large and may drift again.
- **Fix:** Auto-generate barrel exports or reduce the public surface.
- **Effort:** 1-2 hours.

**D5: Web bootstrap key version bumping is fragile.**
The web app uses preference keys like `web.bootstrap.enabled_modules.v4` to trigger re-bootstrap when new modules are added. This has already required 4 bumps (v1 through v4). Each new module addition requires a manual key bump.
- **Fix:** Derive the bootstrap key from the sorted module list hash instead of a manual version number.
- **Effort:** 1 hour.

**D6: Legacy workout tables coexist with v2 schema.**
`wk_workout_logs` and `wk_programs` (v1) coexist with `wk_exercises`, `wk_workouts`, `wk_workout_sessions`, `wk_form_recordings` (v2). The CRUD layer exports both old and new APIs with the old ones marked `// legacy`. This doubles the API surface and maintenance burden.
- **Fix:** Deprecate and plan migration from v1 tables to v2 architecture.
- **Effort:** 4-6 hours.

**D7: Inline styles used throughout web UI.**
The Sidebar and most web components use inline `React.CSSProperties` objects instead of CSS modules, Tailwind, or a style system. Tailwind is installed as a dev dependency but not consistently used.
- **Fix:** Standardize on Tailwind (already in `devDependencies`) or CSS variables. Not urgent for functionality but affects maintainability.
- **Effort:** 8-16 hours for full migration.

**D8: Self-host/federation layer expanding without test coverage.**
The `deploy/self-host/api/src/server.js` is a single vanilla Node.js file implementing REST API, friend management, direct messaging, HMAC federation, and actor identity. It has no automated tests -- validation is limited to `node --check` syntax checks.
- **Fix:** Add integration tests for self-host API endpoints.
- **Effort:** 8-12 hours.

### 2.3 Minor Debt

**D9: Mobile React version mismatch.** Web uses React 19 (`^19.0.0`), mobile uses React 18 (`18.3.1`). This is constrained by Expo SDK 52's React Native compatibility, not a bug, but creates type mismatches requiring bridge workarounds.

**D10: Missing `--passWithNoTests` on some modules.** Several modules had to add `--passWithNoTests` to prevent `pnpm test` failures when no test files exist. This is symptomatic of insufficient test coverage for newer modules.

**D11: Unresolved `recipes` typecheck error.** Timeline notes a pre-existing `apps/web/app/recipes/page.tsx` type mismatch (`is_favorite` number vs boolean) that was noted but not fixed.

---

## 3. Parity Assessment

### 3.1 Standalone Repositories

The following standalone app repositories exist as git submodules:

| Standalone | Hub Module | Web Parity | Mobile Parity | Data Parity |
|-----------|-----------|------------|---------------|-------------|
| MyBooks | `modules/books` | passthrough | adapter | Strong |
| MyBudget | `modules/budget` | passthrough | adapter | Strong |
| MyWorkouts | `modules/workouts` | passthrough (fragile -- Supabase runtime risk) | adapter | Moderate (dual-storage, no shared adapter) |
| MyWords | `modules/words` | duplicate (not passthrough) | adapter | Weak (no persistence, API-only) |
| MySurf | `modules/surf` | adapter (rich) | adapter | Different model |
| MyFast | `modules/fast` | no hub screens wired | no hub screens wired | Strong (logic parity, no UI routes) |
| MyRecipes | `modules/recipes` | adapter | adapter | Scaffolded |
| MyCar | `modules/car` | adapter | adapter | Scaffolded |
| MyVoice | N/A (submodule only) | N/A | N/A | N/A |
| MyHomes | `modules/homes` | adapter | adapter | Scaffolded |
| MyHabits | `modules/habits` | adapter | adapter | Scaffolded |

### 3.2 Parity Enforcement Quality

The parity enforcement system is comprehensive:
- `pnpm check:standalone` verifies submodule integrity.
- `pnpm check:module-parity` validates standalone-to-hub module inventory.
- `pnpm check:passthrough-parity` enforces strict wrapper file content + host wiring for passthrough modules.
- `pnpm check:workouts-parity` runs specific MyWorkouts parity checks.
- All gates run in CI (`parity` job in `.github/workflows/ci.yml`).

**Gap:** Parity enforcement is strong for web passthrough modules but has no mobile equivalent. Mobile routes are all adapter-mode implementations that could drift from standalone without detection.

### 3.3 MySurf Parity Anomaly

MySurf is architecturally unique: the standalone app uses Supabase (PostGIS, Edge Functions, real-time), but the hub module implements a fully local SQLite-based experience with deterministic forecast generation, local auth sessions, and hub preferences for persistence. This is not parity -- it is a parallel implementation. The `storageType: 'supabase'` declaration is aspirational, not current.

---

## 4. Cloud Module Readiness

### 4.1 Current State

| Module | Declared Backend | Actual Backend | Cloud Ready? |
|--------|-----------------|----------------|--------------|
| Surf | Supabase | SQLite (local simulation) | No |
| Workouts | SQLite (was Supabase) | SQLite | No (Supabase in standalone) |
| Homes | Drizzle + tRPC | SQLite | No |

### 4.2 Assessment

**No cloud modules are operational in the hub.** All 13 modules run on local SQLite. This is not necessarily a problem -- the privacy-first, offline-first positioning actually benefits from this. However:

1. **MySurf standalone** has a full Supabase backend with PostGIS geospatial queries, NOAA/NDBC data pipeline, and real-time updates. The hub version generates deterministic forecasts locally, which is a fundamentally different product. Cloud integration would require the hub to initialize and manage a Supabase client conditionally, which the current `DatabaseAdapter` interface does not support.

2. **MyWorkouts standalone** uses Supabase for exercise data and auth. The hub version has been migrated to SQLite with a built-in fallback exercise catalog. The standalone web app has a resilient loader that tries Supabase first, then falls back. This is a reasonable bridge pattern.

3. **MyHomes** declares `drizzle` storage but implements SQLite tables. No Drizzle schema or tRPC router exists in the module. This is design-doc-only for the cloud layer.

### 4.3 Recommendations

- **Short term (0-1 month):** Do not pursue cloud integration. The SQLite-local pattern is working and matches the privacy-first brand.
- **Medium term (1-3 months):** If cloud features are needed for surf/workouts, introduce a `CloudAdapter` interface alongside `DatabaseAdapter` rather than replacing it. Modules should support both local-only and cloud-enhanced modes.
- **Long term:** Use the entitlements system to gate cloud features as premium capabilities.

---

## 5. Testing and CI Status

### 5.1 Test Coverage

| Package | Tests | Coverage | Status |
|---------|-------|----------|--------|
| `@mylife/db` | 48 | Full coverage gates | Passing |
| `@mylife/module-registry` | 100% enforced | 100% lines/statements/functions/branches | Passing |
| `@mylife/entitlements` | 9 | 100% coverage (runtime files) | Passing |
| `@mylife/books` | Multiple | 50% lines, 95% functions, 65% branches | Passing |
| `@mylife/budget` | Multiple | Passing | Passing |
| `@mylife/words` | Multiple | Passing | Passing |
| `@mylife/web` | 133-175 | 47% lines, 56% functions, 70% branches | Passing |
| `@mylife/mobile` | 65-79 | 53% lines, 80% functions, 74% branches | Passing |
| `@mylife/rsvp` | 0 | N/A | **FAILING** (missing deps) |
| Cloud modules (surf, homes) | 0 | passWithNoTests | N/A |
| Scaffold modules (fast, recipes, car, habits, meds, subs) | Varying | passWithNoTests for some | N/A |

### 5.2 CI Pipeline

The `.github/workflows/ci.yml` is well-structured:

1. **Changes detection** (path-filter for conditional e2e).
2. **Parity** (runs `pnpm check:parity` with recursive submodule checkout).
3. **Lint** (depends on parity).
4. **Typecheck** (independent).
5. **Test** (independent, deterministic seed via `VITEST_SEED`).
6. **Coverage** (independent).
7. **E2E** (conditional, Playwright with Chromium, depends on lint+typecheck+test).

**Strengths:**
- Concurrency groups prevent duplicate CI runs.
- Parity runs first and blocks lint (fail-fast on parity regression).
- E2E is conditionally triggered only when relevant paths change.
- Coverage is a separate job, not blocking.

**Concerns:**
- CI does not cache Turborepo outputs (`cache: pnpm` only caches npm packages, not build artifacts).
- E2E uses Playwright but only installs Chromium; cross-browser testing is absent.
- The RSVP test failure would break CI right now.

### 5.3 E2E Test Quality

Playwright specs exist for:
- `books-user-flows.spec.ts`
- `budget-user-flows.spec.ts`
- `hub-and-settings.spec.ts`
- `local-module-crud.spec.ts`

These use behavior-first, section-scoped selectors. The timeline notes intermittent SIGTERM issues with aggregated Playwright runs, mitigated by per-spec execution in `run-full-behavior-suite.sh`.

---

## 6. Recommended Technical Implementation Plan (Next 3 Months)

### Month 1: Stabilize and Harden (Weeks 1-4)

**Week 1: Fix Critical Debt**
| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| Fix RSVP module build (D1) | P0 | 10 min | None |
| Remove duplicate `* 2` directories (D3) | P0 | 5 min | None |
| Align `storageType` field across all modules (D2) | P1 | 30 min | None |
| Fix recipes typecheck error (D11) | P1 | 15 min | None |

**Week 2: Test Coverage Expansion**
| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| Add RSVP module tests | P1 | 4 hrs | D1 fix |
| Add tests for modules with `passWithNoTests` (surf, homes, fast, recipes, car, habits, meds, subs) | P1 | 16 hrs | None |
| Add self-host API integration tests (D8) | P2 | 12 hrs | None |

**Week 3: Parity Completion (Web)**
| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| Convert remaining adapter-mode web modules to passthrough (fast, recipes, car, habits, meds, subs, surf, homes) | P1 | 16 hrs | Standalone apps must have web routes |
| Update parity matrix tests for new passthroughs | P1 | 4 hrs | Passthrough conversion |

**Week 4: Infrastructure Hardening**
| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| Replace manual bootstrap key bumping with hash-based derivation (D5) | P2 | 1 hr | None |
| Add Turborepo remote caching to CI | P2 | 2 hrs | None |
| Deprecation plan for legacy workout tables (D6) | P2 | 2 hrs | None |
| Prune oversized `hub-queries.ts` exports (D4) | P3 | 2 hrs | None |

### Month 2: Module Maturity Push (Weeks 5-8)

**Week 5-6: Core Module Completion**
| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| Complete MyBudget standalone features (reporting, recurring transactions) | P1 | 16 hrs | None |
| Complete MyFast standalone features (timer, history, stats) | P1 | 12 hrs | None |
| Complete MySubs standalone features (dashboard, catalog, calendar) | P1 | 12 hrs | None |

**Week 7-8: Secondary Module Completion**
| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| Complete MyRecipes standalone features (CRUD, import, meal plan) | P2 | 16 hrs | None |
| Complete MyCar standalone features (maintenance tracker, fuel log) | P2 | 12 hrs | None |
| Complete MyHabits standalone features (today view, streaks, stats) | P2 | 12 hrs | None |
| Complete MyMeds standalone features (schedule, reminders, history) | P2 | 12 hrs | None |

### Month 3: Cloud Integration + Pre-Launch (Weeks 9-12)

**Week 9-10: Auth + Subscription (Phase 3)**
| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| Implement Supabase Auth in `packages/auth/` | P1 | 16 hrs | None |
| Implement RevenueCat integration in `packages/subscription/` | P1 | 16 hrs | Auth |
| Add paywall gate to premium modules | P1 | 8 hrs | Subscription |
| Wire entitlement verification into module enable flow | P1 | 4 hrs | Auth + Subscription |

**Week 11: Cloud Module Bridge (Phase 4, partial)**
| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| Design `CloudAdapter` interface for dual-mode modules | P2 | 4 hrs | Auth |
| MySurf cloud bridge (Supabase client for spot data, retain local fallback) | P2 | 16 hrs | CloudAdapter |
| MyWorkouts cloud bridge (Supabase for exercise sync) | P3 | 8 hrs | CloudAdapter |

**Week 12: Polish + Launch Prep (Phase 6, partial)**
| Task | Priority | Effort | Dependencies |
|------|----------|--------|--------------|
| Performance audit (bundle size, SQLite query performance, cold start) | P1 | 8 hrs | None |
| App Store metadata preparation (screenshots, descriptions, privacy policy) | P1 | 8 hrs | None |
| TestFlight beta distribution setup | P1 | 4 hrs | None |
| Vercel production deployment for web | P1 | 4 hrs | None |

---

## 7. Key Architectural Recommendations

### 7.1 Do Not Overinvest in Cloud Integration

The privacy-first, offline-first positioning is a genuine differentiator. Most personal app suites require accounts and cloud sync. MyLife's local-only approach is a feature, not a limitation. Cloud features (surf forecasts, workout sync) should be additive, not required.

### 7.2 Standardize the Style System

Pick one approach (Tailwind is already installed) and migrate incrementally. Inline styles make theming and responsive design difficult as the UI matures.

### 7.3 Invest in Module Scaffolding Automation

A `pnpm create:module <name>` generator that creates:
- `modules/<name>/` with definition, types, schema, index, tests
- Hub wiring (db.ts, Sidebar, Providers, DatabaseProvider)
- Parity test entries

Would reduce the per-module setup from 30+ manual edits to a single command.

### 7.4 Plan the Self-Host Story Carefully

The self-host deployment layer (Docker Compose, federation, actor identity) is architecturally ambitious. It has expanded to a 500+ line server with HMAC federation, message queuing, and signed actor tokens -- all in a single `.js` file with no tests. This should either be promoted to a proper package with tests and types, or scoped back until after initial launch.

### 7.5 Mobile Passthrough Strategy

Web passthrough works because Next.js App Router supports path aliases to external source. Expo Router does not have the same mechanism. The mobile parity strategy should shift from "passthrough" to "shared components" -- extract UI components to shared packages that both standalone and hub mobile apps consume.

---

## 8. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Parity burden exceeds capacity (13 modules x 2 platforms x standalone) | High | High | Prioritize 5-6 core modules for launch, defer others |
| Self-host federation complexity delays core product | Medium | High | Defer federation to post-launch; ship local-only first |
| Storage backend confusion (sqlite vs supabase vs drizzle) | Medium | Medium | Align all modules to SQLite now, add cloud as optional layer |
| Plain-text password storage in MySurf hub simulation | High | High | Replace with hashed storage immediately (D16); security issue even in dev |
| MySurf simulation-to-real data transition breaks UX expectations | Medium | Medium | Document simulation boundaries; design graceful migration path |
| MyCar parity gap blocks launch (largest in suite) | High | High | Prioritize shared-package extraction or scope car out of initial launch |
| Dead dependencies in surf/homes cause version conflicts | Medium | Low | Remove unused deps (supabase-js, drizzle-orm, trpc/client) |
| Single SQLite file scaling (lock contention, migration complexity) | Medium | Medium | Monitor; evaluate per-module sharding at 15+ modules or perf issues |
| Bootstrap key bumping overrides user module disable choices | High | Medium | Replace with hash-based derivation or "new modules available" UX |
| Budget engine missing from hub (core value prop gap) | High | High | Port standalone `packages/shared/src/engine/` to hub module |
| Unauthenticated bank sync API routes | High | High | Add auth guards before any real bank provider integration |
| React 18/19 mismatch causes runtime bugs | Low | Medium | Pin both to React 18 until Expo supports React 19 |
| CI pipeline breaks due to RSVP test failure | High | Low | Fix immediately (10-minute task) |
| MyWords duplicate logic drifts from standalone | High | Medium | Convert to passthrough pattern; extract shared dictionary service |
| MyBooks social layer ruled a parity violation | Medium | High | Document decision now; if violation, plan standalone social or remove from hub |
| MyBooks schema drift breaks passthrough pages | Medium | High | Unify migration source or add schema compatibility assertions to parity tests |
| MyWorkouts passthrough pages throw at runtime (no Supabase client) | High | High | Configure Supabase client for passthrough or replace with hub-native pages |
| MyWorkouts dual-mode decision blocks Phase 4 | High | High | Make architectural decision before further cloud integration work |
| MyFast invisible to users (screens not wired) | High | Medium | Wire route groups in both app shells; module logic is ready |
| JSON-in-SQLite silent corruption in workouts | Medium | Medium | Add JSON validation on write; monitor for data integrity issues |
| 10+ design-doc-only submodules inflate CI/checkout | Medium | Low | Convert to planning doc entries; remove non-runtime submodules |

---

## 9. Scoring Summary

| Dimension | Score (1-10) | Notes |
|-----------|-------------|-------|
| Architecture Design | 8 | Module registry + SQLite adapter + passthrough parity are strong patterns |
| Code Quality | 7 | TypeScript strict, Zod validation throughout, but inline styles and some legacy code |
| Test Coverage | 6 | Good for core packages (100% on registry/entitlements), thin on newer modules |
| CI/CD | 7 | Comprehensive pipeline with parity gates, but missing Turbo caching |
| Documentation | 8 | Exceptional CLAUDE.md, timeline, and parity docs |
| Scalability | 7 | Pattern scales well; execution bandwidth is the constraint |
| Technical Debt | 5 | Manageable but growing; critical items (RSVP, storage inconsistency) need immediate attention |
| Launch Readiness | 4 | Core infrastructure is solid; module feature depth and auth/payments are gaps |

**Overall Architecture Health: 6.5/10** -- Strong foundation with clear path to 8+ through structured debt resolution and module completion.

---

## Appendix A: Reviewer Findings Summary

### A.1 MyRecipes, MyCar, MyVoice (recipes-car-voice-reviewer)

**MyRecipes:** Standalone has 3 business logic engines (ingredient parser, recipe scaler, grocery engine) in `packages/shared/`. Hub module is a clean-room CRUD adapter with only 4 of 11 tables implemented. Missing: steps, tags, collections, recipe_collections, grocery_lists, grocery_items, pantry_staples. Zero code sharing between standalone and hub. Hub definition declares 5 tabs but standalone has 3. No UI screens in either app shell -- backend-only.

**MyCar:** **Largest parity gap in the entire suite.** Standalone is at Week 9-10 maturity (7+ entity types, MPG cascade computation, due-state evaluator, expense summaries, CSV/PDF export, mobile notifications, E2E tests). Hub module covers only 3 of 7+ entity types with basic CRUD, no update operations for maintenance/fuel, no computation engines. Standalone uses its own async repository contract incompatible with hub's `DatabaseAdapter`. Parity bridging is a multi-session effort.

**MyVoice:** macOS-only Electron app with Objective-C native addons (N-API). Completely different stack (AVAudioEngine, NSEvent, CGEvent). No hub module exists and none planned -- correctly scoped as standalone-only. Only 4 tests covering transcript formatter; no tests for native bridges, dictation controller, or IPC.

**Key Concern:** Zero code sharing between standalone and hub for recipes and car. Every standalone feature must be reimplemented. This is unsustainable as standalones mature.

### A.2 Parity Gap Summary (Cross-Module)

The reviewer findings across all modules confirm a consistent pattern:

| Parity Tier | Modules | Strategy |
|-------------|---------|----------|
| **Strong** (passthrough, shared code) | Books, Budget | Web passthrough wrappers + shared packages |
| **Strong** (logic parity, no hub screens) | Fast | Business logic complete, needs UI route wiring |
| **Moderate** (passthrough, fragile runtime) | Workouts | Passthrough pages expect Supabase; hub uses SQLite; latent runtime risk |
| **Moderate** (duplicate logic, needs passthrough) | Words | Hub duplicates standalone services; convert to passthrough |
| **Moderate** (adapter, partial coverage) | Surf, Subs | Adapter-mode with local re-implementation |
| **Weak** (adapter, significant gaps) | Recipes, Habits, Meds | Hub has scaffolded schema only |
| **Critical** (adapter, massive gap) | Car | Standalone is near-complete; hub is Phase 0 |
| **N/A** (standalone-only) | Voice | macOS-only, no hub integration planned |
| **Deferred** (design-doc-only standalones) | Homes, RSVP | Standalone runtime code does not exist yet |

### A.3 Additional Technical Debt Items from Reviewers

**D12: MyCar parity is a release blocker** per CLAUDE.md rules. The standalone has 4+ entity types, computation engines, and export features that the hub module does not implement. Bridging requires either (a) shared package extraction or (b) passthrough conversion, both of which are multi-session efforts.

**D13: MyRecipes schema divergence.** Hub's 4-table schema cannot represent standalone's 11-table model. Any future data import/migration requires schema alignment first.

**D14: Hub modules for car and recipes lack update operations.** Car has no `updateMaintenance` or `updateFuelLog`. Recipes tags have no update-in-place. These are CRUD completeness gaps that would be user-visible.

**D15: MyVoice has near-zero test coverage.** Only 4 tests for transcript formatting. Native addon, dictation controller state machine, overlay rendering, and IPC channels are all untested. No CI pipeline.

### A.4 MySurf and MyHomes (surf-homes-reviewer)

**MySurf:** Standalone is a mature Turborepo monorepo (Bun 1.2.4) with 4 packages + 3 apps, Supabase (PostgreSQL + PostGIS) backend with 9 tables, Edge Functions, NOAA/NDBC data pipeline, Claude AI narrative generation, and 251 tests passing. Hub module declares `storageType: 'supabase'` but actually uses local SQLite with only 2 tables (`sf_spots`, `sf_sessions`). The hub `apps/web/app/surf/actions.ts` is an **839-line simulation layer** recreating forecasts, narratives, live conditions, and auth using seeded deterministic math and local storage. This is a functional mockup, not a real Supabase adapter. Hub web routes are independent implementations (not passthrough). The hub auth stores **passwords in plain text** in SQLite preferences (security concern, even for dev). `@supabase/supabase-js` dependency is unused. `requiresNetwork` contradicts between definition.ts (`false`) and constants.ts (`true`).

**MyHomes:** Standalone ("HumanHomes") is a Turborepo monorepo with Drizzle ORM + tRPC + Fastify backend, Clerk auth. Phase 1 of an 8-phase, 72-week roadmap. Hub module declares `storageType: 'drizzle'` but uses raw SQLite with 2 tables. `drizzle-orm` and `@trpc/client` listed as dependencies but **neither is imported anywhere** in the module code. Registry defines 5 tabs + 3 screens; implementation has 1 screen. Naming inconsistency: standalone is "HumanHomes", hub registers as "MyHomes".

**Key Concerns:**
- **No Supabase bridge architecture defined.** No design exists for how the hub will connect to MySurf's Supabase backend (use standalone `packages/api/`? direct client?). This needs decision before Phase 4.
- **No Drizzle/tRPC bridge architecture defined.** Same question for MyHomes: will the hub call the standalone's Fastify API server, or use Drizzle directly?
- **Dead dependencies** in both modules add install size and version conflict risk.
- **MySurf simulation layer risk:** 839 lines of deterministic simulation create user expectations that will change significantly when real data arrives.
- **MyHomes is the longest-horizon module** in the suite, gated on standalone progress through an 8-phase roadmap.

### A.5 Additional Technical Debt from Surf/Homes Review

**D16: MySurf hub stores passwords in plain text** in SQLite hub preferences. Even for development/demo purposes, this should use at minimum a hash.

**D17: `requiresNetwork` field inconsistency.** Surf definition.ts says `false`, constants.ts says `true`. This creates conflicting runtime behavior depending on which is read.

**D18: Dead dependencies in surf and homes modules.** `@supabase/supabase-js` (surf), `drizzle-orm` and `@trpc/client` (homes) are declared but unused. These should be removed until actually needed.

**D19: Navigation definition/implementation mismatch in homes.** Registry metadata declares 5 tabs + 3 screens but only 1 page exists. Mobile uses Stack nav instead of declared Tabs nav.

### A.6 MyBudget and MySubs (budget-subs-reviewer)

**MyBudget Standalone:** Clean Turborepo monorepo with framework-agnostic `packages/shared/` (no React dependency, portable to hub). 18-table SQLite schema with proper integer-cents currency math. Implements YNAB-style envelope budgeting engine (allocation, carry-forward, overspend, Ready to Assign). Subscription engine deeply integrated with budget via `categories.id` FK and `recurring_templates` auto-creation. Bank sync uses well-designed adapter pattern: `BankSyncProviderRouter`, `HmacWebhookVerifier` with constant-time comparison, `BankSyncAuditLogger` with pluggable sinks. CSV parser uses profile-based column mapping with 4 date format auto-detection. 231 tests passing.

**Hub Budget Module:** Uses `DatabaseAdapter` interface properly with `bg_` prefix. 10 tables (5 core + 5 bank sync) vs standalone's 18. **Missing 8 tables:** `budget_allocations`, `transaction_splits`, `recurring_templates`, `payee_cache`, `csv_profiles`, and others. **No budget engine in hub** -- the `calculateMonthBudget`, `allocateToCategory`, `moveAllocation` functions exist only in standalone. Without the allocation/carry-forward/overspend logic, the hub module is essentially a transaction ledger, not a budgeting app. This is the **single largest functional gap** for a core module. Web passthrough working (thin wrapper validated by parity test). 47 tests passing.

**Bank Sync:** Provider router, webhook verifier, and audit logger are well-designed but scaffolding-only. Plaid provider uses in-memory token/connector stores. Missing: Plaid JWT verification (uses shared-secret HMAC placeholder), auth/authorization on all 3 API routes, persistent encrypted token storage, webhook idempotency keys. No real bank data flows end-to-end.

**MySubs Hub Module:** Self-contained cost normalization engine, renewal engine with anchor-day clamping, 200+ entry catalog with relevance-ranked search. ~36 tests passing. Standalone has only `DESIGN.md` (730-line spec, zero runtime code). **This is an inverted parity situation** -- hub is ahead of standalone, violating the canonical "standalone is source of truth" pattern. When standalone gets built, it should derive from hub code rather than building independently.

**Critical Architecture Decision Needed:** Subscription integration model. Standalone MyBudget treats subscriptions as a budget subsystem (integrated via `recurring_templates`). Hub treats them as a separate free-tier module. These are **fundamentally different architectures**. Options: (a) hub `modules/subs` bridges to `modules/budget` when both are enabled, (b) hub budget module includes its own subscription handling matching standalone, (c) accept the split as intentional hub differentiation. This must be resolved before more work is done.

### A.7 Additional Technical Debt from Budget/Subs Review

**D20: Budget engine is missing from hub.** The core value proposition of MyBudget (YNAB-style envelope allocation, carry-forward, overspend) exists only in standalone `packages/shared/src/engine/`. The hub module is a transaction ledger without budgeting logic.

**D21: Hub budget schema gap -- 8 missing tables.** Moving from 10 to 18 tables requires a v3 migration for the `bg_` namespace. Tables needed: `budget_allocations`, `transaction_splits`, `recurring_templates`, `payee_cache`, `csv_profiles`, and 3 others.

**D22: Bank sync API routes have no authentication.** `/api/bank/link-token`, `/exchange`, and `/webhook` have zero auth guards. Must be resolved before connecting to any real bank provider.

**D23: Subscription-budget cross-module bridge missing.** Hub `BUDGET_MODULE.navigation.tabs` includes a "Subscriptions" tab, but no implementation connects `modules/subs/` to `modules/budget/`. Standalone bridges these via `recurring_templates` and auto-transactions on renewal.

**D24: MySubs inverted parity.** Hub module has working runtime; standalone has only a design spec. This inverts the canonical flow and needs explicit handling to avoid divergence when standalone is built.

### A.8 Hub-Level Review (hub-reviewer)

**Module System:** 13 modules registered with uniform `ModuleDefinition` contract (Zod-validated). `ModuleRegistry` class handles enable/disable lifecycle, migration orchestration, and exposes React context hooks (`useModuleRegistry`, `useEnabledModules`, `useModule`). Single SQLite file with per-module table prefixes -- no per-module database isolation. Lifecycle: Enable -> migrations run -> nav routes activate -> dashboard card appears. Disable -> routes removed, card hidden, data preserved (not deleted).

**Dual-Model Architecture:** Hosted (Supabase/cloud) and self-host (Docker Compose + Express API + Postgres + MinIO) coexist. Mode-aware sync adapters switch transport based on user's chosen mode. Self-host API contract at v0.5.0 with endpoints for health, auth, sync, friends, share, messages, federation, actor identity. Federation transport: HMAC-signed inter-instance messaging with outbox queue, replay-safe receipts, timestamp skew checks.

**App Shell Architecture:** Web uses Next.js 15 App Router with server-side `getEnabledModuleIds()`, persistent `Sidebar` rendering enabled modules dynamically, `Providers` wrapping `ModuleRegistryContext`. Mobile uses Expo Stack navigator with 14 screen groups, `DatabaseProvider` wrapping migration execution. Web auto-bootstrap: preference-keyed one-time enable of all supported modules (key `v4`), bumped each time new modules are added.

**Unfinished Infrastructure:** Phase 3 (Auth + Subscription) entirely unstarted. Phase 4 (Cloud Module migration) unstarted. Phase 5 (macOS SwiftUI app) entirely future. Actor identity rollout has strict/fallback-window policy but no deprecation deadline for legacy fallback.

**Key Risks Identified:**
1. **Single SQLite file scaling** -- All 10+ local modules sharing one database file could create migration complexity, lock contention on mobile, and makes per-module data export/deletion harder.
2. **Bootstrap key bumping overrides user preferences** -- Each bump re-enables all modules, overriding any user disable choices. Needs a proper "new modules available" notification flow.
3. **Self-host scope creep** -- Federation, actor identity, messaging, connection methods represent significant infrastructure not on the original phase plan. Impressive but could delay core module completion.
4. **Bank sync in-memory state** -- Connector/token state in memory will be lost on restart.

### A.9 Additional Technical Debt from Hub Review

**D25: Single SQLite file scaling risk.** All local modules share one `.sqlite` file. As module count grows, migration complexity increases, mobile lock contention becomes a concern, and per-module data export/deletion is harder. Consider per-module WAL mode tuning or investigate module-level database sharding for Phase 6 polish.

**D26: Bootstrap key bumping overrides user module preferences.** Current pattern (`web.bootstrap.enabled_modules.v4`) force-enables all modules on each bump. Users who deliberately disabled modules will have them re-enabled. Replace with hash-based derivation or "new modules available" notification.

**D27: Self-host scope creep.** Federation transport, actor identity, connection method wizard, and decentralized messaging are ambitious infrastructure not in the original phase plan. This work should be frozen until core modules and auth/subscription are complete.

**D28: No deprecation timeline for actor identity legacy fallback.** DM-051 strict/fallback-window policy was implemented but no deadline set for removing the legacy fallback path. Open-ended backward compatibility windows accumulate maintenance burden.

### A.10 MyBooks and MyWords (books-words-reviewer)

**MyBooks:** Most mature hub module with 14+ tables across 3 schema migrations. Web uses passthrough pattern correctly. Hub adds a social layer (friends, messaging, share events) that does not exist in the standalone app. Per CLAUDE.md parity rules, "optional networked capabilities" are allowed if availability and behavior match, but this needs an explicit architectural decision documenting whether the social layer qualifies. The `apps/web/app/books/actions.ts` is 799 lines with tight hub coupling (hub preferences, friend queries, share events). Schema drift risk: hub runs 3 migrations independently from standalone's own schema; changes to either side can create mismatches that passthrough wrappers will surface as runtime errors.

**MyWords:** API-only module with **no persistence despite declaring `storageType: 'sqlite'`**. Zero migrations, zero schema tables. The definition in `modules/words/src/definition.ts` claims SQLite storage but `migrations` array is empty and no `wd_` prefixed tables exist. Hub web routes are **not passthrough** -- they contain duplicate service logic (dictionary API calls, word processing) independent of the standalone app. This is the opposite of the passthrough pattern used by books, budget, and workouts. 3 of 5 declared navigation tabs (Saved Words, Word Helper, Languages) are unimplemented in both app shells. Hub has 4+ features the standalone lacks (Word Helper tool, browse/trending, Saved Words persistence via hub preferences, Languages reference). Standalone has features the hub lacks (voice input, pronunciation audio). The duplicate service logic means bug fixes or API changes must be applied in two places.

**Key Concerns:**
- **MyWords violates the passthrough pattern.** Books, Budget, and Workouts use thin passthrough wrappers. Words has independent hub implementations that duplicate standalone logic. This creates drift risk and doubles maintenance.
- **MyWords storage type declaration is misleading.** Declaring `storageType: 'sqlite'` with zero migrations and zero tables is architecturally confusing. It should either implement SQLite persistence or declare itself as `api-only` (which would require a new storage type value or a documentation convention).
- **MyBooks social layer needs a parity decision.** The hub-only friends/messaging/sharing features are significant functionality not available in the standalone app. CLAUDE.md says "optional networked capabilities" are allowed, but the social layer is a core UX feature, not an optional enhancement. This needs a documented architectural decision.
- **Schema version drift between hub and standalone.** MyBooks hub runs its own 3-migration sequence. If standalone adds tables or columns that differ from hub's migration history, passthrough pages will break at runtime.
- **Unimplemented nav declarations.** 3 tabs declared in MyWords module metadata (Saved Words, Word Helper, Languages) have no corresponding screens. Users see empty or broken navigation entries.

### A.11 Additional Technical Debt from Books/Words Review

**D29: MyWords `storageType` declaration is misleading.** Module declares `storageType: 'sqlite'` but has zero migrations, zero schema tables, and no `wd_` prefixed tables. All data is fetched from external dictionary APIs or stored in hub preferences. Fix: change to a truthful declaration or implement actual SQLite persistence.

**D30: MyWords duplicate service logic drift risk.** Hub and standalone both implement dictionary API calls, word processing, and display logic independently. Neither imports from the other. Any API change (rate limits, response format, endpoint deprecation) must be fixed in two places. Fix: convert to passthrough pattern or extract shared service package.

**D31: MyWords unimplemented navigation tab declarations.** Module metadata declares 5 tabs but only 2 are implemented. Saved Words, Word Helper, and Languages tabs are defined in the module definition but have no corresponding screen components. Fix: either implement the screens or remove them from the declaration.

**D32: MyBooks social layer parity decision needed.** Hub adds friends, messaging, and share events that standalone does not have. CLAUDE.md allows "optional networked capabilities" but requires "option availability and behavior must match between standalone and module versions." The social features are not available in standalone at all. Fix: document an explicit architectural decision -- either classify social as an allowed hub-only capability or plan standalone social implementation.

**D33: MyBooks schema version drift risk.** Hub runs 3 independent migrations for `bk_` tables. Standalone has its own migration history. If either side adds or modifies columns, passthrough pages may encounter runtime schema mismatches. Fix: unify migration source (standalone owns schema, hub consumes it) or add schema compatibility assertions to parity tests.

**D34: MyBooks actions.ts hub coupling.** The 799-line `actions.ts` mixes book CRUD with hub-specific logic (preferences, friend queries, share events, aggregate counters). This tight coupling means the file cannot be extracted to a shared package. Fix: separate pure book operations from hub social/preference operations into distinct modules.

### A.12 MyWorkouts and MyFast (workouts-fast-reviewer)

**MyWorkouts:** Dual storage architecture with no shared adapter. Standalone uses Supabase (PostgreSQL + Auth + Storage + Realtime) as primary backend; hub module re-implements the entire data layer on local SQLite with `wk_` prefixed tables. These are two independent implementations of the same data model. Web passthrough pages (`apps/web/app/workouts/**`) are thin re-exports from `@myworkouts-web/...`, but the standalone pages expect Supabase infrastructure. **The hub does not configure a Supabase client for workouts**, so passthrough pages that call Supabase methods will throw at runtime -- this is a latent bug. Mobile uses the hub module correctly via `useDatabase()` from DatabaseProvider.

Schema is at version 2 with two migrations: V1 (legacy workout_logs, programs) and V2 (full standalone-equivalent: exercises, workouts, sessions, form_recordings). Legacy APIs are retained alongside new ones, doubling the exported API surface. The 726-line CRUD layer (`modules/workouts/src/db/crud.ts`) has **no dedicated unit tests** -- tests exist only at the UI level in `apps/mobile` and `apps/web`. State management differs: standalone uses Zustand stores for builder/subscription/player state; hub uses React state + useEffect with direct SQLite calls. Coach Portal exists in standalone (`apps/coach-portal/`) with no hub equivalent.

Multiple columns store JSON strings (`muscle_groups_json`, `exercises_json`, `exercises_completed_json`, `voice_commands_used_json`, `pace_adjustments_json`, `coach_feedback_json`, `audio_cues_json`) parsed via `parseJson()` helper with silent fallback. Calorie estimation uses a hardcoded heuristic (`totalMinutes * 8.2`) when no log data exists. Passthrough import paths are inconsistent: some use `@myworkouts-web/app/workouts/builder/page` (with `/workouts/` prefix) while others use `@myworkouts-web/app/explore/page` (without).

**MyFast:** Clean SQLite-native architecture in both standalone and hub. The hub module is a well-structured port of `packages/shared/` from the standalone. Timer uses timestamp-based `computeTimerState()` that derives elapsed/remaining/progress from `startedAt` ISO timestamp and current time -- app-kill safe, not a foreground counter. `ft_active_fast` table enforces at most one active fast at a time with transactional start/end operations.

Module exports are comprehensive (definition, types, DB CRUD, timer, protocols, stats, export utilities). Near-full business logic parity with standalone. However: **no hub screens are wired** -- no route groups exist in `apps/mobile/app/` or `apps/web/app/` for rendering MyFast screens, so the module is registered and migrated but invisible to users. Weight CRUD is missing from the module despite `ft_weight_entries` table and `WeightEntry` type existing. Streak cache has no automatic invalidation on fast start/end.

**MyWorkouts Parity Detail:**

| Layer | Status |
|-------|--------|
| Data model (types, Zod schemas) | Good match |
| SQLite schema | Good - V2 mirrors standalone Supabase tables |
| CRUD operations | Good - exercises, workouts, sessions, recordings |
| Web routes | Passthrough but fragile (Supabase runtime dependency) |
| Mobile screens | Good - full screen set with hub navigation |
| Auth | Missing - hub says `requiresAuth: false` |
| Cloud storage (form recordings) | CRUD shell exists, no upload infrastructure |
| Coach portal | Missing entirely |
| Workout player (state machine) | Via passthrough only, not in module |
| Voice commands | Via passthrough only, not in module |
| Workout plans (advanced) | Partial - legacy programs only |

**MyFast Parity Detail:**

| Layer | Status |
|-------|--------|
| Timer state machine | Full parity |
| CRUD (start/end/list/delete) | Full parity |
| Protocols (6 presets) | Full parity |
| Streaks + stats + aggregation | Full parity |
| CSV export | Full parity |
| Settings persistence | Full parity |
| Hub screens | **Not wired** - no routes in hub apps |
| Weight tracking CRUD | Missing from module |
| iOS widget | Standalone only |
| Notifications | Standalone only |

### A.13 Additional Technical Debt from Workouts/Fast Review

**D35: MyWorkouts passthrough pages have latent Supabase runtime failure.** Web passthrough pages import standalone components that call Supabase client methods. The hub does not configure a Supabase client for workouts (`requiresNetwork: false`). These pages will throw at runtime when Supabase-dependent code paths execute. Fix: either configure a Supabase client in the hub for workouts passthrough, or replace Supabase-dependent standalone pages with hub-native implementations.

**D36: MyWorkouts CRUD layer has no module-level tests.** The 726-line `modules/workouts/src/db/crud.ts` has zero dedicated unit tests. All existing tests are UI-level in `apps/mobile` and `apps/web`. MyFast's module has 18 unit tests as a reference pattern. Fix: add CRUD unit tests following the MyFast testing pattern.

**D37: MyWorkouts JSON-in-SQLite columns risk silent data corruption.** 7 columns store serialized JSON strings parsed via `parseJson()` with silent fallback to empty arrays/objects. Corrupt JSON produces no error, just empty data. No SQL-level querying or indexing on these fields is possible. Fix: add JSON validation on write, consider structured storage for critical fields.

**D38: MyWorkouts calorie estimation uses undocumented hardcoded heuristic.** `getWorkoutMetrics()` estimates calories as `totalMinutes * 8.2` with no documentation of the source or applicability of this number. Fix: document the basis, make configurable per exercise type, or remove and display "no data" instead.

**D39: MyWorkouts passthrough import path inconsistency.** Some wrappers import with `/workouts/` prefix (`@myworkouts-web/app/workouts/builder/page`) while others omit it (`@myworkouts-web/app/explore/page`). This indicates the standalone web app's route structure does not align cleanly with the hub's `/workouts/` prefix. Fix: normalize import paths or document the mapping.

**D40: MyWorkouts Supabase dual-mode decision is a Phase 4 blocker.** Before full hub integration, an architectural decision is needed: (a) hub uses Supabase directly (network-dependent), (b) dual-mode adapter syncs SQLite to Supabase, or (c) SQLite-only in hub with cloud features as standalone-exclusive. This decision gates all further workouts cloud integration.

**D41: MyFast hub screens not wired.** Module is registered, business logic is complete (near-full parity), but zero route groups exist in `apps/mobile/app/` or `apps/web/app/` for rendering MyFast screens. Users cannot access the module despite it being enabled. Fix: create route groups for both app shells.

**D42: MyFast weight CRUD not ported.** Schema has `ft_weight_entries` table and types have `WeightEntry` interface, but no weight CRUD functions are exported from the module. Standalone has weight operations in `packages/shared` that were not included in the hub port. Fix: port weight CRUD functions from standalone.

### A.14 CPO Report Cross-Reference (cpo-agent)

The CPO strategy report (`/Users/trey/Desktop/Apps/MyLife/docs/reports/REPORT-cpo-strategy-2026-02-26.md`) provides the product perspective on the same codebase. Key findings that reinforce or extend the CTO analysis:

**Alignment with CTO findings:**
- **6-module launch bundle** (MyBooks, MyBudget, MyWorkouts, MyWords, MyFast, MySubs) matches the CTO Month 1 stabilization targets. CPO explicitly recommends freezing module scope at 6 for launch.
- **Auth + subscription is critical path** (DM-013 through DM-017). CPO grades this as the single highest priority, ahead of any new module features. CTO Month 3 plan allocates Weeks 9-10 to this.
- **Self-host < 5% of users expected.** Reinforces CTO debt item D27 (self-host scope creep). CPO recommends shipping self-host as a "power user" offering, not the primary path.
- **Cloud module fragmentation** confirmed as operational risk. CPO recommends deferring MySurf/MyHomes to Phase 4 and launching with SQLite-only modules.
- **Parity burden multiplies effort 2x.** CPO identifies this as the highest-severity product risk, consistent with the CTO risk register's top entry.

**New observations from CPO report:**
- **23 total submodules** in the workspace, of which 10+ are design-doc-only or empty scaffolds (MyCloset, MyCycle, MyFlash, MyGarden, MyJournal, MyMood, MyNotes, MyPets, MyStars, MyTrails). These inflate git checkout time, CI submodule resolution, and maintenance overhead without contributing runtime code.
- **Self-host license underpriced at $5 one-time.** CPO recommends $9.99. Not a technical concern but relevant for the entitlements/billing-config packages.
- **Lifetime hosted option at $79.99** is a strong early-adopter play, already in CLAUDE.md but not yet implemented in billing-config SKUs.
- **Module maturity tiers** differ slightly from CTO parity assessment: CPO rates MyWords at 70% completeness ("functional"), which conflicts with CTO finding that Words has duplicate logic and no persistence. CPO may not have had the books-words-reviewer's detailed findings when scoring.

### A.15 Additional Technical Debt from CPO Cross-Reference

**D43: Design-doc-only submodules inflate CI and checkout.** 10+ git submodules (MyCloset, MyCycle, MyFlash, MyGarden, MyJournal, MyMood, MyNotes, MyPets, MyStars, MyTrails) contain only design documents or empty scaffolds. Each adds to `git submodule update --recursive` time in CI and local checkouts. Fix: convert design-doc-only repos to entries in a planning document (e.g., `docs/plans/future-modules.md`) and remove them as submodules. Keep only submodules with runtime code that participates in parity enforcement.
