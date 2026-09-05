# MyLife Implementation Roadmap

**Date:** 2026-03-04
**Author:** TheDawg
**Structure:** Dependency-ordered feature blocks with parallelization guidance

---

## Execution Model

Work is organized into **feature blocks** -- atomic units of completable work. Each block has explicit prerequisites, outputs, and verification criteria. Blocks at the same depth in the dependency graph can run concurrently via parallel agent spawns.

---

## Phase 0: Unblock CI (Sequential -- Must Complete First)

Everything downstream depends on a green main branch. These three fixes are independent of each other and can run in parallel.

### Block 0A: Fix MyWorkouts Typecheck Errors

**Prerequisites:** None
**Scope:** 19 TypeScript errors in MyWorkouts standalone submodule (missing type declarations for react, next/navigation, better-sqlite3, zustand; implicit any parameters)
**Approach:** Add missing @types packages to MyWorkouts devDependencies, fix implicit any parameters in builder/player/subscription stores
**Output:** `pnpm typecheck` passes (0 errors)
**Verification:** `pnpm typecheck` exits 0
**Estimated complexity:** Low -- type stub additions + 6-8 parameter annotations
**Agent profile:** Single coding agent, MyWorkouts directory scope

### Block 0B: Fix Meds Adherence Test

**Prerequisites:** None
**Scope:** `modules/meds/src/__tests__/adherence.test.ts:202` -- `getAdherenceStats` returns `totalTaken=3`, test expects `4`
**Approach:** Investigate whether the bug is in the test fixture (missing dose record) or in the `getAdherenceStats` query logic. Fix whichever is wrong.
**Output:** `pnpm --filter @mylife/meds test` passes (0 failures)
**Verification:** `pnpm test` exits 0
**Estimated complexity:** Low -- single test/function fix
**Agent profile:** Single coding agent, modules/meds scope

### Block 0C: Fix MyHealth Standalone Git Entry

**Prerequisites:** None
**Scope:** MyHealth directory exists but is missing its `.git` entry, causing `check:standalone` to fail
**Approach:** Initialize MyHealth as a proper git submodule or standalone repo matching the pattern of other standalone directories
**Output:** `pnpm check:standalone` passes
**Verification:** `pnpm check:parity` exits 0
**Estimated complexity:** Low -- git submodule setup
**Agent profile:** Single agent with git access

```
Block 0A ──┐
Block 0B ──┼── All must pass before any Phase 1 work merges
Block 0C ──┘
```

---

## Phase 1: Core Hardening (Parallelizable)

All blocks in this phase depend only on Phase 0 completion. They are independent of each other and can run concurrently.

### Block 1A: Web Error Boundaries

**Prerequisites:** Phase 0 complete
**Scope:** Web app has no React error boundary around module routes. Mobile has `ModuleErrorBoundary` -- web needs equivalent.
**Tasks:**
1. Create `components/ModuleErrorBoundary.tsx` for web (class component, catches render errors)
2. Wrap each module route layout or page group with the boundary
3. Error UI: show module name, error message, "Try Again" and "Back to Hub" actions
4. Wire into Sentry when Block 1B is complete (can be a follow-up PR)
**Output:** Any module rendering crash on web shows recovery UI instead of white screen
**Verification:** Manually throw in a module component -- boundary catches it. Existing tests pass.
**Estimated complexity:** Low-medium
**Agent profile:** Single coding agent, apps/web scope

### Block 1B: Observability (Sentry Integration)

**Prerequisites:** Phase 0 complete
**Decision required:** Sentry DSN (Trey must create Sentry project or approve free tier)
**Tasks:**
1. Add @sentry/react-native (or expo-sentry) to mobile app
2. Add @sentry/nextjs to web app
3. Configure source map uploads for both
4. Replace `console.error` calls in critical paths with `Sentry.captureException`:
   - `ModuleErrorBoundary.componentDidCatch` (mobile)
   - `DatabaseProvider` error handler (mobile)
   - Web API route catch blocks
   - Self-host server.js global error handler
5. Add Sentry context: module ID, hub mode, enabled modules
**Output:** Errors appear in Sentry dashboard with module context
**Verification:** Trigger test error on both platforms, confirm Sentry receipt
**Estimated complexity:** Medium
**Agent profile:** Single coding agent, cross-cutting (mobile + web)
**Blocker:** Sentry DSN must be provided before work begins

### Block 1C: CSP Hardening

**Prerequisites:** Phase 0 complete
**Scope:** Remove `unsafe-eval` from Content-Security-Policy in `apps/web/middleware.ts`
**Tasks:**
1. Remove `'unsafe-eval'` from script-src directive
2. Test that Next.js dev and prod modes still function
3. If Next.js requires eval for dev mode, conditionally apply stricter CSP in production only
4. Consider nonce-based approach for inline scripts if needed
**Output:** Production CSP no longer includes unsafe-eval
**Verification:** `curl -I` the deployed/dev app, inspect CSP header. App renders correctly.
**Estimated complexity:** Low
**Agent profile:** Single coding agent, apps/web/middleware.ts scope

### Block 1D: Data Export MVP

**Prerequisites:** Phase 0 complete
**Tasks:**
1. Define export interface: each module CRUD layer implements `exportAll(db: DatabaseAdapter): Record<string, unknown[]>` returning all table data as arrays of objects
2. Implement `exportAll` for modules with CRUD: books, budget, fast, car, habits, meds, health, recipes, words, rsvp
3. Hub-level export function: iterates enabled modules, calls exportAll, assembles JSON
4. Add "Export My Data" to web settings page (downloads .json file)
5. Add "Export My Data" to mobile settings screen (shares via system share sheet)
6. Unit test: export produces valid JSON with expected table keys
**Output:** Users can export all local data as a single JSON file
**Verification:** Enable 3+ modules, add sample data, export, validate JSON structure
**Decision required:** JSON only for now, or also CSV? (Recommend JSON-only for this block)
**Estimated complexity:** Medium
**Agent profile:** 1 lead agent + potentially 1 parallel agent splitting mobile/web UI work

### Block 1E: UI Package Cleanup

**Prerequisites:** Phase 0 complete
**Scope:** Books-specific components (BookCover, ReadingGoalRing, ShelfBadge) live in @mylife/ui instead of @mylife/books
**Tasks:**
1. Move BookCover, ReadingGoalRing, ShelfBadge from packages/ui to modules/books
2. Update all imports across apps/mobile and apps/web
3. Verify no other module-specific components remain in @mylife/ui
4. Run typecheck + tests to confirm no breakage
**Output:** @mylife/ui contains only generic components
**Verification:** `pnpm typecheck && pnpm test` pass. grep confirms no Books imports from @mylife/ui.
**Estimated complexity:** Low
**Agent profile:** Single coding agent

```
              ┌── Block 1A (web error boundaries)
              ├── Block 1B (Sentry) [BLOCKED on DSN]
Phase 0 ─────┼── Block 1C (CSP hardening)
              ├── Block 1D (data export)
              └── Block 1E (UI cleanup)
```

---

## Phase 2: Auth and Entitlements (Sequential Core, Parallel Periphery)

Auth is the critical path. Subscription depends on auth. These blocks have a strict ordering.

### Block 2A: Auth Package Implementation

**Prerequisites:** Phase 0 complete (Phase 1 blocks are independent -- 2A can start in parallel with Phase 1)
**Decision required:** Supabase hosted vs self-host? Project must be created.
**Tasks:**
1. Replace @mylife/auth stub with real Supabase Auth client
2. Implement: signUp(email, password), signIn(email, password), signOut(), getSession(), onAuthStateChange()
3. Platform-specific session storage: AsyncStorage (mobile), cookies (web)
4. Create `AuthProvider` React context for both platforms
5. Implement anonymous/guest mode: local-only users skip auth entirely
6. Unit tests for all auth state transitions
**Output:** Functional auth package with sign-up/sign-in/sign-out
**Verification:** Auth flow works against Supabase project on both platforms
**Estimated complexity:** High
**Agent profile:** Senior coding agent, packages/auth + integration scope
**Blocker:** Supabase project credentials

### Block 2B: Auth Integration

**Prerequisites:** Block 2A complete
**Tasks:**
1. Integrate AuthProvider into mobile `_layout.tsx` (wraps below RegistryProvider)
2. Integrate AuthProvider into web `layout.tsx`
3. Hub mode selection drives auth requirement: local_only = no auth, hosted/self_host = auth required
4. Add sign-in/sign-up screens to mobile (hub settings or dedicated auth flow)
5. Add sign-in/sign-up UI to web (settings page or modal)
6. Ensure all existing functionality works unchanged in local_only mode
**Output:** Auth UI integrated, local-only mode unaffected
**Verification:** `pnpm test` passes. Local-only mode works without auth. Hosted mode prompts sign-in.
**Estimated complexity:** Medium-high
**Agent profile:** Single coding agent, cross-cutting

### Block 2C: Subscription Package Implementation

**Prerequisites:** Block 2A complete (needs auth for user identity)
**Decision required:** Which modules are free vs premium? (Current: MyFast is free, rest premium at $4.99/mo)
**Tasks:**
1. Replace @mylife/subscription stub with RevenueCat SDK (mobile)
2. Implement Stripe integration for web
3. Wire to entitlements package for access gating
4. Create paywall component: shows when user tries to access premium module without subscription
5. Implement entitlement caching for offline access
6. Add subscription management UI (view plan, cancel)
7. Test sandbox purchase flow end-to-end
**Output:** Premium modules gated, free modules accessible, subscription purchasable in sandbox
**Verification:** Free module accessible without sub. Premium module shows paywall. Test purchase grants access.
**Estimated complexity:** High
**Agent profile:** Senior coding agent, packages/subscription + both apps
**Blocker:** RevenueCat account, Stripe account

### Block 2D: Subscription Integration

**Prerequisites:** Block 2B + 2C complete
**Tasks:**
1. Module discovery page shows pricing accurately
2. Hub dashboard indicates locked/unlocked state per module
3. Subscription status persists and syncs on app restart
4. Cross-platform entitlement sync (same user, mobile + web)
**Output:** End-to-end subscription experience functional
**Verification:** Full flow: sign up -> browse modules -> hit paywall -> subscribe -> module unlocks
**Estimated complexity:** Medium
**Agent profile:** Single coding agent

```
Block 2A (auth pkg) ── Block 2B (auth integration) ──┐
                    └── Block 2C (subscription pkg) ───┼── Block 2D (sub integration)
```

---

## Phase 3: Self-Host Modernization (Parallelizable with Phase 2)

This work is independent of auth/subscription and can run concurrently.

### Block 3A: Self-Host API TypeScript Migration

**Prerequisites:** Phase 0 complete
**Tasks:**
1. Convert `deploy/self-host/api/src/server.js` to TypeScript
2. Extract into modular route files: auth.ts, friends.ts, messages.ts, federation.ts, entitlements.ts, share-events.ts, health.ts
3. Add Zod request validation schemas for all endpoints
4. Add structured JSON logging (pino)
5. Maintain all existing API behavior exactly
**Output:** Modular TypeScript API with validation and structured logs
**Verification:** All existing self-host E2E behavior unchanged. `docker compose up` still works. Health check passes.
**Estimated complexity:** High (large file, many endpoints)
**Agent profile:** Senior coding agent, deploy/self-host scope

### Block 3B: Self-Host Persistent Sessions

**Prerequisites:** Block 3A complete
**Tasks:**
1. Move session token store from in-memory Map to Postgres table
2. Add session expiry cleanup via scheduled query instead of setInterval
3. Session survives API process restarts
**Output:** Sessions persist across deploys
**Verification:** Log in, restart API container, session still valid
**Estimated complexity:** Low-medium
**Agent profile:** Single coding agent

```
Block 3A (TS migration) ── Block 3B (persistent sessions)
```

---

## Phase 4: Test Coverage and Quality (Parallelizable with Phase 2-3)

### Block 4A: Module Test Coverage Gap Fill

**Prerequisites:** Phase 0 complete
**Tasks:**
1. Add hub-level tests for modules with zero: workouts, surf, homes
2. Add web E2E specs for meds, car, habits module flows
3. Add mobile unit tests for hub navigation (module switching, enable/disable)
4. Target: 200+ test files, all passing
**Output:** Test coverage improvement across undertested modules
**Verification:** `pnpm test` passes, test file count > 200
**Estimated complexity:** Medium
**Agent profile:** 2-3 parallel coding agents, each owning different module test scopes

### Block 4B: Dependency Audit

**Prerequisites:** Phase 0 complete
**Tasks:**
1. Run `pnpm audit` and document findings
2. Fix or accept all critical/high severity vulnerabilities
3. Add `pnpm audit --audit-level high` to CI pipeline
**Output:** No critical/high dependency vulnerabilities; audit in CI
**Verification:** `pnpm audit --audit-level high` exits 0
**Estimated complexity:** Low
**Agent profile:** Single agent

```
Phase 0 ──┬── Block 4A (test coverage)
           └── Block 4B (dependency audit)
```

---

## Phase 5: Distribution and Performance (Depends on Phase 1-2)

### Block 5A: EAS Build Setup

**Prerequisites:** Phase 1 complete (clean codebase), Phase 2A ideally complete (auth in binary)
**Tasks:**
1. Configure eas.json with development, preview, and production profiles
2. Run first EAS Build for iOS (development profile)
3. Run first EAS Build for Android (development profile)
4. Install on test devices, verify app launches
**Output:** Reproducible mobile builds via EAS
**Verification:** App installs and runs on physical device
**Estimated complexity:** Medium (native config tuning)
**Agent profile:** Single agent with EAS CLI access
**Blocker:** Expo/EAS account must be configured

### Block 5B: Performance Baseline

**Prerequisites:** Block 5A complete (need device build to measure)
**Tasks:**
1. Lighthouse audit on web app (record LCP, FID, CLS, scores)
2. Mobile cold start measurement on test device
3. Database benchmark: 1000-row insert/query timing per module
4. Bundle size analysis (next-bundle-analyzer for web)
5. Document all baselines in docs/performance/BASELINE.md
**Output:** Quantified performance baseline with numbers
**Verification:** BASELINE.md exists with measured data
**Estimated complexity:** Low-medium
**Agent profile:** Single agent

### Block 5C: TestFlight Distribution

**Prerequisites:** Block 5A complete, Block 2B complete (auth integrated)
**Tasks:**
1. EAS Build with preview profile
2. Submit to TestFlight
3. Distribute to internal test group
**Output:** App on TestFlight for testers
**Verification:** Tester installs from TestFlight, app functions
**Blocker:** Apple Developer account, TestFlight group setup
**Estimated complexity:** Low (once EAS Build works)
**Agent profile:** Single agent

---

## Full Dependency Graph

```
Phase 0 (CI Fix)
├── 0A (typecheck) ─────────┐
├── 0B (meds test) ─────────┤
└── 0C (MyHealth git) ──────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                     │
   Phase 1 (Harden)    Phase 2 (Auth)       Phase 3 (Self-Host)
   ├── 1A (web EB)     ├── 2A (auth pkg)    ├── 3A (TS migration)
   ├── 1B (Sentry)*    │    ├── 2B (auth     │    └── 3B (sessions)
   ├── 1C (CSP)        │    │   integration)  │
   ├── 1D (export)     │    └── 2C (sub pkg)  Phase 4 (Tests)
   └── 1E (UI cleanup) │         └── 2D       ├── 4A (coverage)
                        │          (sub integ) └── 4B (audit)
                        │
                   Phase 5 (Distribution)
                   ├── 5A (EAS Build)
                   │    ├── 5B (perf baseline)
                   │    └── 5C (TestFlight)
                   └────────────────────────

* = blocked on external input (Sentry DSN)
```

---

## Maximum Parallelism Opportunities

At peak, after Phase 0 completes, up to **10 independent blocks** can execute concurrently:

1. Block 1A (web error boundaries)
2. Block 1B (Sentry) -- if DSN available
3. Block 1C (CSP hardening)
4. Block 1D (data export)
5. Block 1E (UI cleanup)
6. Block 2A (auth package)
7. Block 3A (self-host TS migration)
8. Block 4A (test coverage -- can split across 2-3 agents)
9. Block 4B (dependency audit)

**Recommended concurrent agent count:** 4-5 (balancing throughput against merge conflict risk)

**Conflict-safe groupings for parallel execution:**
- Group A: 1A + 1C (both in apps/web, but different files -- middleware vs components)
- Group B: 1D (cross-cutting but module CRUD + settings pages)
- Group C: 2A (packages/auth -- isolated)
- Group D: 3A (deploy/self-host -- fully isolated)
- Group E: 4A (test files only -- no source edits)

---

## External Blockers (Decisions/Actions Required from Trey)

| Blocker | Blocks | Action Required |
|---------|--------|-----------------|
| Sentry DSN | 1B | Create Sentry project (free tier ok), provide DSN |
| Supabase project | 2A, 2B | Create Supabase project, provide URL + anon key |
| RevenueCat account | 2C | Create RevenueCat app, provide API key |
| Stripe account | 2C | Create/configure Stripe account, provide keys |
| EAS/Expo account | 5A, 5C | Configure EAS project, ensure Apple certs |
| Free vs premium tiers | 2C | Confirm: MyFast free, rest premium at $4.99/mo? |
| Data export format | 1D | JSON only, or also CSV? |
