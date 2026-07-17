# App Architecture Comparison Report: MyLife vs iOS-Hub vs rork Native

**Date:** 2026-03-07
**Scope:** Full architectural, code quality, and feature comparison across three implementation approaches for the MyLife product suite
**Report Type:** Strategic decision document

---

## 1. Executive Summary

This report compares three codebases that each represent a different approach to building the same product vision: a 22-module personal life management suite called MyLife.

**The three approaches:**

| Approach | Repo | What It Is | Maturity |
|----------|------|-----------|----------|
| **MyLife Monorepo** | `/Users/trey/Desktop/Apps/MyLife/` | Turborepo monorepo with Expo (mobile) + Next.js 15 (web), shared TypeScript packages, SQLite, 42 workspace packages | Production-grade foundation with 10 functional modules |
| **iOS-Hub** | `/Users/trey/Desktop/Apps/iOS-Hub/` | Rork-generated Expo launcher shell with iPhone-style icon grid for 22 modules | Visual prototype only, zero functionality |
| **rork-my-recipes** | `/Users/trey/Desktop/Apps/rork-my-recipes-module/` | Rork-generated native Swift/SwiftUI recipe app with SwiftData | Feature-complete MVP for one module (MyRecipes), iOS only |

**Key findings:**

1. **MyLife is the clear production codebase.** It has 10 functional modules, 319 test files, cross-platform support (iOS + Android + Web), a proven build system, and a comprehensive plugin architecture. No other approach comes close in completeness or maturity.

2. **iOS-Hub is a hollow visual shell.** It renders a polished iPhone-style launcher grid but contains zero functional code. Every module tap shows a "coming soon" preview page. Six npm dependencies are installed but never used. Its primary value is the `SPEC-mylife-simple.md` reference document and the visual design language.

3. **rork-my-recipes demonstrates the promise and limits of AI-generated native code.** Its Swift service layer (IngredientParser, WebImportService, AllergenDetection) is surprisingly sophisticated, and SwiftData is used correctly. However, it has zero tests, no cross-platform support, no integration path to a hub, and vendor lock-in to Rork's platform.

4. **The recommendation is Option D (Hybrid): restructure MyLife modules as standalone-capable apps within the monorepo**, absorbing the best insights from rork's native code patterns and iOS-Hub's visual design. This preserves MyLife's cross-platform architecture while reducing the dual-codebase parity burden that is the monorepo's biggest weakness.

---

## 2. Architecture Comparison

### 2.1 Structural Overview

| Dimension | MyLife Monorepo | iOS-Hub (Rork/Expo) | rork-my-recipes (Rork/Swift) |
|-----------|----------------|--------------------|-----------------------------|
| **Generation method** | Hand-crafted + AI-assisted (Claude Code) | AI-generated (Rork platform) | AI-generated (Rork platform) |
| **Framework** | Turborepo + Expo + Next.js 15 | Expo (React Native) | SwiftUI (iOS only) |
| **Language** | TypeScript (strict mode) | TypeScript (strict mode) | Swift 5.x |
| **Platforms** | iOS + Android + Web | iOS + Android + Web (in theory) | iOS only |
| **Data persistence** | SQLite (expo-sqlite / better-sqlite3) | None | SwiftData (on-device) |
| **Module system** | `ModuleDefinition` contract + `ModuleRegistry` class with Zod validation | Static `HubApp` interface, flat array | None (standalone app) |
| **Code sharing** | `packages/shared/`, `packages/ui/`, `packages/db/` | None | None |
| **Build system** | Turborepo + pnpm + Metro + Turbopack | Rork CLI wrapping Metro | Xcode |
| **Testing** | Vitest (319 test files), Playwright E2E | None | Effectively none (placeholder files) |
| **Package count** | 42 workspace packages | 1 app | 1 app |
| **Source lines** | ~50,000+ (modules + packages + apps) | ~830 | ~4,700 |

### 2.2 Hub Architecture Pattern

**MyLife** uses a monorepo-based plugin architecture. Each module is an independent `@mylife/<name>` package that exports a `ModuleDefinition`. The hub registers modules at runtime, runs SQLite migrations when modules are enabled, and dynamically wires navigation routes. This is a real, functional plugin system.

**iOS-Hub** uses a "launcher" pattern: one Expo app renders all 22 module icons as a 4-column grid, and tapping any icon navigates to a static preview page. There is no module loading mechanism, no data layer, and no navigation to real screens. The "Open" button logs to console.

**rork-my-recipes** is not a hub at all. It is a standalone native app for one module (MyRecipes). It has no mechanism to connect to or be launched from a hub. It would need to be rebuilt from scratch to integrate with any hub pattern.

### 2.3 Data Architecture

**MyLife** uses a single-file SQLite database with table name prefixes per module (`bk_` for books, `bg_` for budget, `hub_` for hub tables). This is pragmatic: it avoids the complexity of multiple databases while preventing table name collisions. A `DatabaseAdapter` interface abstracts the difference between `expo-sqlite` (mobile) and `better-sqlite3` (web). Each module declares versioned migrations in its `ModuleDefinition`.

The system supports three storage backends:
- **sqlite** (default, local-first)
- **supabase** (cloud, used by MySurf and MyWorkouts)
- **drizzle** (cloud, used by MyHomes)

**iOS-Hub** has no data layer at all.

**rork-my-recipes** uses SwiftData (Apple's modern replacement for Core Data). 15 model classes with proper relationships, cascade delete rules, indexes, and uniqueness constraints. The data model is well-structured but iOS-only and not portable.

### 2.4 Dependency and Build Graph

**MyLife** has a well-defined dependency graph:
- `apps/mobile` and `apps/web` depend on `@mylife/module-registry`, `@mylife/db`, `@mylife/ui`, and all module packages
- Modules depend on `@mylife/db` and `@mylife/module-registry` via peer dependencies (not direct)
- `@mylife/module-registry` is the most depended-upon package (changes cascade to all 28 modules)
- Turborepo's `^build` dependency ensures packages compile before dependents test or lint

**iOS-Hub** has a flat dependency graph: one app, no packages, minimal dependencies. However, it depends on `@rork-ai/toolkit-sdk` (a black-box vendor dependency that wraps Metro config), creating vendor lock-in to Rork's platform.

**rork-my-recipes** has no dependency graph beyond Apple's system frameworks and Xcode.

---

## 3. Code Quality Comparison

### 3.1 Ratings Summary

| Dimension | MyLife Monorepo | iOS-Hub | rork-my-recipes |
|-----------|:--------------:|:-------:|:---------------:|
| **TypeScript/Swift strictness** | A | B+ | A- |
| **Code patterns** | A- | B | A- |
| **Testing** | B+ | F | F |
| **Error handling** | B | C | B+ |
| **Linting/formatting** | B- | C | N/A |
| **Dependency health** | B+ | C+ | A |
| **Documentation** | A+ | C | C |
| **Overall** | **B+** | **C+** | **B** |

### 3.2 MyLife Monorepo Strengths

- **TypeScript strict mode** with `composite: true`, `isolatedModules: true`, `bundler` module resolution. Modern, correct configuration.
- **Clean module contract**: `ModuleDefinition` is well-typed with Zod runtime validation at registration. The contract covers identity, storage, navigation, subscription tier, and lifecycle requirements.
- **Consistent CRUD pattern** across all modules: every module follows the same structure (`definition.ts`, `types.ts`, `db/schema.ts`, `db/crud.ts`, `index.ts`).
- **Database adapter abstraction**: platform-specific entry points (`index.ts` vs `index.native.ts`) cleanly handle expo-sqlite vs better-sqlite3.
- **319 test files** across modules, packages, and apps. Vitest everywhere with coverage thresholds. Playwright E2E specs for the web app.
- **Comprehensive documentation**: CLAUDE.md is among the most thorough project instruction files in the workspace. Agent-aware with file ownership zones, team compositions, and Context7 library IDs.

### 3.3 MyLife Monorepo Weaknesses

- **Basic ESLint config**: extends only `eslint:recommended`, missing `@typescript-eslint/strict`, `react-hooks`, and import ordering rules.
- **No custom error types**: uses plain `Error` or Zod errors. No `BookNotFoundError`, `MigrationError`, or `SyncConflictError`.
- **Silent catch blocks**: several `catch {}` blocks swallow errors without logging.
- **CRUD functions don't runtime-validate**: typed parameters are trusted at compile time but not checked at runtime.
- **No CI/CD pipeline**: no GitHub Actions, no automated deployment.
- **Missing `inputs` in `turbo.json`**: without explicit input globs, Turborepo rehashes all files for every task.

### 3.4 iOS-Hub Quality Notes

- TypeScript strict mode is enabled and the `HubApp` interface is well-typed.
- Good animation patterns (memoized metrics, `useNativeDriver: true`).
- **6 unused dependencies** (zustand, react-query, expo-haptics, expo-image-picker, expo-location, expo-symbols).
- Hardcoded date ("Monday, March 7") and time ("9:41") that never update.
- Duplicate `app/` directory structure (root template + real app in `expo/`).
- No state management, no data fetching, no persistence.

### 3.5 rork-my-recipes Quality Notes

- Clean, idiomatic Swift. No force unwraps, consistent `guard let` usage.
- **Strong service layer**: IngredientParser handles unicode fractions, word numbers, ranges, and 40+ unit patterns. WebImportService implements real JSON-LD schema.org parsing. AllergenDetectionService covers the FDA Big Nine allergens.
- Proper Swift concurrency annotations (`nonisolated`, `Sendable`).
- SwiftData used correctly with indexes, uniqueness constraints, and cascade delete rules.
- **Zero actual tests** despite having highly testable pure-function services.
- Double-UUID-generation bug in all model inits (default value generates UUID #1, init body generates UUID #2, discarding #1).
- No error handling on SwiftData `insert()`/`delete()` operations.

---

## 4. Feature Matrix

### 4.1 Module Implementation Status (All 22+ Modules)

| # | Module | MyLife Status | MyLife Src Files | iOS-Hub Status | rork Status | Spec Exists |
|---|--------|-------------|-----------------|---------------|------------|-------------|
| 1 | MyBooks | **FULL** | 72 + 10 tests | Preview only | N/A | Yes (32 features) |
| 2 | MyBudget | **FULL** | 31 + 10 tests | Preview only | N/A | Yes (32 features) |
| 3 | MyMeds | **FULL** | 50 + 10 tests | Preview only | N/A | Yes (30 features) |
| 4 | MyNutrition | **FULL** | 46 + 8 tests | Preview only | N/A | Yes (31 features) |
| 5 | MyHealth | **FULL** | 19 + 3 tests | Preview only | N/A | Yes (30 features) |
| 6 | MyFast | **FULL** | 18 + 1 test | Preview only | N/A | Yes (23 features) |
| 7 | MyHabits | **FULL** | 18 + 2 tests | Preview only | N/A | Yes (30 features) |
| 8 | MyRecipes | **FULL** | 9 (module) + 120+ (standalone) | Preview only | **Full MVP** (41 Swift files) | Yes (39 features) |
| 9 | MyCar | **FULL** | 7 + 1 test | Preview only | N/A | Yes (32 features) |
| 10 | MyWorkouts | **FULL** | 6 (module) + 215 (standalone) | Preview only | N/A | Yes (30 features) |
| 11 | MyWords | **PARTIAL** | 8 + 1 test | N/A | N/A | No |
| 12 | MySurf | **PARTIAL** | 6 (module) + 213 (standalone) | N/A | N/A | No |
| 13 | MyHomes | **PARTIAL** | 6 (module) + 126 (standalone) | N/A | N/A | No |
| 14 | MyRSVP | **PARTIAL** | 7 + 1 test | Preview only | N/A | Yes (26 features) |
| 15 | MyCloset | Scaffold | 3 | Preview only | N/A | Yes (19 features) |
| 16 | MyCycle | Scaffold | 3 | N/A | N/A | In habits spec |
| 17 | MyFlash | Scaffold | 3 | Preview only | N/A | Yes (27 features) |
| 18 | MyGarden | Scaffold | 3 | Preview only | N/A | Yes (25 features) |
| 19 | MyJournal | Scaffold | 3 | Preview only | N/A | Yes (27 features) |
| 20 | MyMail | Scaffold | 3 | N/A | N/A | No |
| 21 | MyMood | Scaffold | 3 | Preview only | N/A | Yes (24 features) |
| 22 | MyNotes | Scaffold | 3 | Preview only | N/A | Yes (24 features) |
| 23 | MyPets | Scaffold | 3 | Preview only | N/A | Yes (18 features) |
| 24 | MyStars | Scaffold | 3 | Preview only | N/A | Yes (22 features) |
| 25 | MySubs | Scaffold | 3 | N/A | N/A | No |
| 26 | MyTrails | Scaffold | 3 | Preview only | N/A | Yes (20 features) |
| 27 | MyVoice | Scaffold | 3 | N/A | N/A | No |
| 28 | MyBaby | N/A | N/A | Preview only | N/A | Yes (22 features) |
| 29 | MyFilms | N/A | N/A | Preview only | N/A | Yes (21 features) |

### 4.2 Platform Coverage

| Platform | MyLife | iOS-Hub | rork-my-recipes |
|----------|:-----:|:-------:|:---------------:|
| iOS | Yes (Expo) | Yes (Expo) | Yes (native SwiftUI) |
| Android | Yes (Expo) | Yes (Expo) | No |
| Web | Yes (Next.js 15) | No (web build possible but untested) | No |
| macOS | Planned (Phase 5, SwiftUI) | No | No |

### 4.3 MyRecipes Feature Comparison (Most Directly Comparable)

| Feature | rork (Swift) | MyLife MyRecipes (TS) | Winner |
|---------|:-----------:|:--------------------:|:------:|
| Recipe CRUD | Yes | Yes | Tie |
| Ingredient parser (NLP) | Yes (40+ units, unicode, word numbers) | Yes (40+ units, unicode, sections) | Tie |
| Web recipe import | Yes (JSON-LD) | Yes (cheerio + schema.org) | Tie |
| Text recipe import | No | Yes | MyLife |
| Recipe scaling | Yes | Yes | Tie |
| Allergen detection | Yes (9 allergens, 5 diets) | Specified but unverified | rork |
| Cooking mode + timers | Yes | Yes | Tie |
| Meal planner | Yes | Yes | Tie |
| Shopping list | Yes (auto from meal plan) | Yes (with merge + categorize) | MyLife |
| Pantry tracker | Basic (name, qty, expiry) | Advanced (storage, barcode, photo, nutrition) | MyLife |
| Barcode scanning | No | Yes (camera + Open Food Facts) | MyLife |
| Nutrition data | No | Yes (Open Food Facts API) | MyLife |
| Garden tracking | Yes (plants, care, harvest, layout) | Yes (plants, care, harvest, layout + journal) | MyLife |
| Event hosting + RSVP | Yes | Yes + potluck coordination | MyLife |
| Print layout | No | Yes | MyLife |
| Recipe collections | No | Yes | MyLife |
| Cross-platform web | No | Yes (Next.js 15, 14 pages) | MyLife |
| Test coverage | 0 tests | 18 files, ~2,951 lines | MyLife |

### 4.4 Hub Infrastructure Features (MyLife Only)

These features exist only in the MyLife monorepo:

| Feature | Status | Package |
|---------|--------|---------|
| Module registry with Zod-validated `ModuleDefinition` | Functional | `@mylife/module-registry` |
| SQLite adapter with platform-specific entry points | Functional | `@mylife/db` |
| Supabase Auth wrapper + local auth mode | Functional | `@mylife/auth` |
| RevenueCat (mobile) + Stripe (web) subscription | Functional | `@mylife/subscription` |
| Module entitlements and access gating | Functional | `@mylife/entitlements` |
| Three-tier data sync (local, P2P via WebRTC, cloud via Supabase) | Functional | `@mylife/sync` |
| Social features (activity feed, share cards, friend invites) | Scaffolded | `@mylife/social` |
| Standalone-to-hub data importers (books, budget, fast, recipes) | Functional | `@mylife/migration` |
| Self-hosted deployment (Docker: Postgres + MinIO + API) | Functional | `deploy/self-host/` |
| Parity enforcement scripts (4 validators) | Functional | `scripts/` |
| Unified dark theme tokens (colors, spacing, typography, shadows) | Functional | `@mylife/ui` |

---

## 5. Pros and Cons Analysis

### 5.1 MyLife Monorepo

| Angle | Pros | Cons |
|-------|------|------|
| **Technical debt** | Clean module contract prevents wild divergence. Turborepo + pnpm handle dependency management well. | 25 git submodules create significant overhead. Dual-codebase parity (53 codebases total) is the largest debt risk. |
| **UX quality** | 110+ mobile screens, 100+ web pages across 10 functional modules. Real CRUD, real persistence, real navigation flows. | 13 scaffold-only modules (48%) have zero UX. The gap between "fully built" and "just a definition.ts" is stark. |
| **Maintainability** | Three-tier directory layout (apps/packages/modules) is textbook. Module contract enforces consistency. Agent-aware docs enable AI-assisted maintenance. | Parity scripts cannot catch semantic drift. Adding a new module requires 6 manual steps. `ModuleId` union type must be hand-updated. |
| **Scalability** | Turborepo parallelizes builds. Vitest parallelizes tests. Module isolation via table prefixes handles 100+ tables. | Missing `inputs` in turbo.json. No lazy loading (all modules imported eagerly at startup). Single SQLite writer lock for all modules. |
| **Developer experience** | Comprehensive CLAUDE.md with Context7 IDs. File ownership zones. Agent team definitions. Function quality gates. | 25 git submodules need `--recursive` clone. React 18/19 split between mobile and web. No CI/CD pipeline. |
| **Time to ship** | 10 modules already functional. Spec documents exist for 22 modules totaling 86,497 lines. Build system is proven. | 13 scaffold modules need full build-out. Phase 2-6 represent significant remaining work. Standalone-to-module parity gaps are large for some modules. |
| **Native performance** | Expo's New Architecture + React Native 0.76 provide reasonable native performance. | JS bridge overhead compared to native Swift/Kotlin. No native SwiftUI/Jetpack Compose components. |
| **Cross-platform reach** | iOS + Android + Web from one codebase. Shared business logic in `packages/shared/`. | Web and mobile diverge in some UI patterns. Mobile uses React 18, web uses React 19. |

### 5.2 iOS-Hub (Rork/Expo)

| Angle | Pros | Cons |
|-------|------|------|
| **Technical debt** | Almost zero code, so almost zero debt. | But also zero value. You cannot accrue debt on something that does not exist. |
| **UX quality** | Polished glassmorphic launcher design. Notification badges, press animations, dock bar. | All visual, no interaction. "Open" buttons do nothing. Search is non-functional. |
| **Maintainability** | Simple: 10 files, ~830 lines. | Duplicate `app/` directory. Hardcoded date/time strings. 6 unused dependencies. |
| **Scalability** | N/A (nothing to scale). | Flat file structure won't scale to 22 modules. No module loading mechanism. |
| **Developer experience** | Fast to generate from a spec. Quick visual feedback. | Vendor lock-in to `@rork-ai/toolkit-sdk`. `bunx rork start` instead of standard Expo CLI. |
| **Time to ship** | Minutes to generate a launcher. | Years to build actual module functionality. The launcher is 0.1% of the real work. |
| **Native performance** | Expo provides decent cross-platform performance. | No native modules leveraged. Standard Animated API (not Reanimated). |
| **Cross-platform reach** | In theory: iOS + Android + Web via Expo. | In practice: untested beyond iOS simulator. No web build evidence. |

### 5.3 rork-my-recipes (Rork/Swift)

| Angle | Pros | Cons |
|-------|------|------|
| **Technical debt** | Clean, focused codebase. No framework bloat. | Double-UUID-generation bug in all models. String-typed enums lose compile-time safety. No migration strategy. |
| **UX quality** | Native SwiftUI feel. Proper use of `@Query`, `.searchable()`, `.contextMenu`. Cooking mode with haptics and keep-awake. | iOS only. No web. No Android. |
| **Maintainability** | Clean MVC: Models/Views/Services. 42 files. | No tests. No documentation. No error handling patterns for persistence. |
| **Scalability** | SwiftData handles growth well for a single module. | Cannot add new modules without building entirely new apps. No shared infrastructure. |
| **Developer experience** | Pure Swift/SwiftUI with Apple's latest frameworks. Xcode is the only tool needed. | iOS/macOS only development. No shared logic with web or Android. |
| **Time to ship** | One module MVP generated in a single Rork session. | Each additional module requires a separate app. No code sharing between modules. 22 standalone apps would need 22 separate codebases. |
| **Native performance** | Excellent. No JS bridge. SwiftData is compiled and optimized. SwiftUI uses native rendering. | iOS-only means no Android or web performance is possible. |
| **Cross-platform reach** | Zero. iOS only. | This is the fundamental limitation. Every line of Swift is iOS-locked. |

---

## 6. Strategic Options Analysis

### Option A: Keep MyLife Monorepo, Merge iOS-Hub/rork Features Into It

**What this means:** Continue with the existing MyLife Turborepo monorepo as the production codebase. Extract valuable artifacts from iOS-Hub (spec doc, visual design language) and rork (Swift service patterns) as reference material, but build all new code within MyLife's architecture.

**Pros:**
- Preserves 50,000+ lines of working code, 319 tests, and 10 functional modules
- Maintains cross-platform reach (iOS + Android + Web)
- Leverages proven build system (Turborepo + pnpm)
- No migration cost, the codebase is already production-grade
- The 22-module spec documents (86,497 lines) were designed for this architecture
- Infrastructure packages (auth, subscription, sync, entitlements) are already built
- Self-hosted deployment option already exists

**Cons:**
- The dual-codebase parity burden (25 standalone repos + 28 hub modules = 53 codebases) remains the biggest risk
- 13 scaffold-only modules still need to be built from scratch
- No native iOS/Android performance (always behind SwiftUI/Jetpack Compose for feel)
- Adding modules requires 6 manual steps with no automation
- The parity scripts cannot catch semantic drift between standalone and hub versions

**Effort estimate:** Low incremental cost. Continue Phase 2-6 roadmap as planned.

---

### Option B: Rebuild MyLife Using iOS-Hub as the Hub/Launcher Pattern

**What this means:** Replace the MyLife monorepo's hub dashboard with an iOS-Hub-style launcher (icon grid home screen), generating individual module apps via Rork or similar AI tools and connecting them through the launcher.

**Pros:**
- Polished, familiar iPhone-style launcher UX
- Fast module prototyping via AI generation
- Each module is independent (no monorepo coupling)

**Cons:**
- iOS-Hub has zero functional code. The launcher is 0.1% of the work.
- Would discard 50,000+ lines of working MyLife code
- No code sharing between modules (each becomes a silo)
- Rork vendor lock-in via `@rork-ai/toolkit-sdk`
- No web platform support
- Would need to rebuild auth, subscription, sync, entitlements, migration, and all hub infrastructure from scratch
- No testing infrastructure
- "22 independent apps" model means 22x the maintenance burden vs shared packages

**Effort estimate:** Massive. Effectively starting over while losing most existing value.

**Verdict:** Not recommended. The launcher UX can be added as a screen within MyLife without rebuilding anything.

---

### Option C: Keep Standalone Native Apps (rork Approach), MyLife as Web Companion

**What this means:** Build each module as a standalone native app (Swift for iOS, Kotlin for Android) using AI generation tools like Rork. MyLife becomes a web-only companion dashboard (Next.js) that provides cross-module views and sync.

**Pros:**
- Best possible native performance per module
- Each app has laser focus on one domain
- SwiftUI/Jetpack Compose gives platform-native UX
- Simpler per-app codebases (no monorepo complexity)
- AI tools like Rork can generate strong native MVPs quickly

**Cons:**
- 22 standalone apps means 22 separate codebases, 22 App Store listings, 22 deployment pipelines
- Zero code sharing between apps (IngredientParser reimplemented in Swift, Kotlin, and TypeScript)
- No unified data layer (each app has its own storage, no cross-module queries)
- No unified subscription (each app would need its own IAP or external subscription management)
- The rork module has zero tests, so every generated app needs a full test suite built manually
- Android coverage requires Kotlin equivalents of every Swift app (2x the native work)
- Web app becomes a separate, disconnected product
- Sync between 22 apps and a web dashboard is an enormous infrastructure challenge
- iOS-only for native (Android would need completely separate development)

**Effort estimate:** Enormous. 22 apps x 2 platforms + web = 45+ codebases to maintain.

**Verdict:** Not recommended for the full suite. May make sense for 1-2 flagship modules (MyBooks, MyBudget) if native feel becomes a competitive differentiator, but the economics don't work for 22 modules.

---

### Option D: Hybrid - Restructure MyLife Modules as Standalone-Capable Apps Within the Monorepo

**What this means:** Keep the Turborepo monorepo but evolve the architecture so that each module can be both a hub module AND a standalone app, built from the same source code. Eliminate the separate 25 standalone git submodule repositories. The module package (`modules/books/`) becomes the single source of truth for both standalone and hub builds.

**Pros:**
- Eliminates the dual-codebase problem (53 codebases -> 28 module packages)
- Removes 25 git submodules and the parity enforcement burden
- Each module can still be published as a standalone app (via Expo config variants or separate app entries)
- Preserves all shared packages (auth, subscription, sync, db, ui)
- Preserves cross-platform support (iOS + Android + Web)
- One place to make changes, one place to test
- Simplifies the 6-step "add new module" process
- Parity scripts become unnecessary (there's only one codebase per module)

**Cons:**
- Significant restructuring effort to merge standalone repos into module packages
- Standalone apps lose their independent git history
- Build configuration complexity: need conditional compilation for "standalone mode" vs "hub mode"
- Expo's multi-app support (one monorepo, multiple app configs) has limitations
- Some standalone apps (MySurf, MyWorkouts) have significantly more code than their hub modules. Merging would be a large effort.
- Risk of disrupting the 10 currently functional modules during restructuring

**Effort estimate:** Medium. 2-3 weeks of focused restructuring for the 7 standalone apps with real code, then incremental for future modules.

**Verdict: Recommended.** This addresses the single biggest architectural weakness (dual-codebase parity) while preserving all of MyLife's strengths. The restructuring can be done module-by-module, starting with the simplest (MyFast, MyCar) and progressing to the most complex (MyBooks, MySurf).

---

### Option E: Full Rebuild With New Architecture Incorporating Best From All Three

**What this means:** Start a new codebase from scratch that combines MyLife's shared packages, iOS-Hub's launcher UX, and rork's native code patterns into a new architecture.

**Pros:**
- Clean slate, no technical debt
- Could design the perfect module system from day one
- Could adopt newer tools (Expo 54, React Native 0.81, Swift 6)
- Could build native + cross-platform hybrid from the start

**Cons:**
- Would discard 50,000+ lines of working code
- 319 test files would need to be rewritten
- 10 functional modules would need to be rebuilt
- Hub infrastructure (auth, subscription, sync, entitlements, migration) would need reimplementation
- Estimated 6-12 months to return to current functionality
- "We'll do it right this time" rewrites historically take 2-3x longer than expected
- The existing architecture is fundamentally sound. The main issues (parity burden, missing CI, eager loading) can all be fixed incrementally.

**Effort estimate:** Very large. 6-12+ months to reach feature parity with current MyLife.

**Verdict:** Not recommended. The existing codebase is solid. A full rewrite is only justified when the current architecture is fundamentally broken, and MyLife's architecture is not broken. Its issues are operational (CI/CD, lazy loading, parity scripts) rather than structural.

---

## 7. Recommendation

**Recommended approach: Option D (Hybrid Restructuring)**

The MyLife Turborepo monorepo is the clear winner architecturally. It has the most code, the most features, the most tests, and the only viable cross-platform strategy. The recommendation is to evolve it by addressing its one critical weakness: the dual-codebase parity burden.

### Why Option D

1. **It solves the biggest problem.** The 25 git submodules + 28 hub modules = 53 codebases are a maintenance time bomb. Option D reduces this to 28 module packages, each serving as both standalone and hub.

2. **It preserves everything valuable.** All 50,000+ lines of code, 319 tests, 10 functional modules, hub infrastructure packages, and the proven Turborepo build system remain intact.

3. **It absorbs the best of iOS-Hub and rork.**
   - iOS-Hub's `SPEC-mylife-simple.md` becomes the reference for building module home screens.
   - rork's Swift service patterns (IngredientParser, WebImportService, AllergenDetection) inform TypeScript implementations.
   - iOS-Hub's glassmorphic launcher design inspires the hub's Discover screen.

4. **It can be done incrementally.** There is no big-bang migration. Each standalone repo can be merged into its module package one at a time, starting with the simplest. The 13 scaffold-only modules never had standalone repos, so they're already in the right structure.

5. **It simplifies the roadmap.** Phase 2 (Core Module Migration) and Phase 8 (Tier 3 Build-Out) become simpler when there's only one codebase per module to build and test.

### Complementary Recommendations

In addition to the Option D restructuring, these improvements should be made:

| Priority | Improvement | Rationale |
|----------|------------|-----------|
| P0 | Add `inputs` globs to `turbo.json` | Improves cache hit rate for 42-package workspace |
| P0 | Add GitHub Actions CI | Automated `turbo test`, `turbo typecheck`, `pnpm check:parity` on every PR |
| P1 | Implement module lazy loading | Use `React.lazy` (mobile) and `dynamic()` (web) to reduce initial bundle size |
| P1 | Upgrade ESLint config to extend `@typescript-eslint/strict` + `react-hooks` | Catches bugs that the basic config misses |
| P1 | Add custom error classes for domain-specific failures | Improves debugging and error handling quality |
| P2 | Generate `ModuleId` from a YAML/JSON manifest | Single source of truth prevents manual sync issues |
| P2 | Add pre-commit hooks via husky/lint-staged | Enforces formatting and type checks before commit |
| P2 | Enable WAL mode for SQLite | Allows concurrent reads during writes, reduces contention |
| P3 | Port rork's IngredientParser test cases to MyLife's Vitest suite | Free test coverage from the rork prototype |
| P3 | Design native SwiftUI shell for Phase 5 using rork patterns as reference | When macOS app time comes, rork's SwiftData patterns are a useful starting point |

---

## 8. Implementation Roadmap for Option D

### Phase D1: Foundation (Week 1-2)

**Goal:** Set up the build infrastructure for dual-mode modules (standalone + hub).

- [ ] Add Expo multi-app config support (or Expo "config variants") to enable building individual modules as standalone apps
- [ ] Create a `standalone.config.ts` template that wraps a module package as a standalone Expo app
- [ ] Add a `pnpm build:standalone <module>` command that produces a standalone app binary from a module package
- [ ] Add `inputs` globs to `turbo.json` for all tasks
- [ ] Set up GitHub Actions CI with `turbo test`, `turbo typecheck`, `pnpm check:parity`

### Phase D2: Simple Module Merges (Week 2-3)

**Goal:** Merge the simplest standalone repos into their module packages.

Start with modules where the standalone repo has the smallest code delta from the hub module:

1. **MyFast** (standalone: 17 src files, module: 18 src files, closest parity)
2. **MyCar** (standalone: 161 TS files, module: 7 src files, moderate gap)
3. **MyWords** (standalone: code exists, module: 8 src files)

For each:
- Copy standalone-specific code (screens, hooks, components) into the module package under a `standalone/` subdirectory
- Update module `package.json` with any additional dependencies
- Verify the standalone build works from the module package
- Remove the git submodule
- Run full test suite to confirm no regressions

### Phase D3: Complex Module Merges (Week 3-5)

**Goal:** Merge the larger standalone repos.

4. **MyRecipes** (standalone: 264 TS files, module: 9 src files, large gap)
5. **MyBudget** (standalone: 363 TS files, module: 31 src files, large gap)
6. **MyBooks** (standalone: 226 TS files, module: 72 src files, moderate gap)

These require more careful merging because the standalone apps have significantly more features than their hub modules.

### Phase D4: Cloud Module Merges (Week 5-6)

**Goal:** Merge standalone repos with non-SQLite backends.

7. **MySurf** (Supabase backend, standalone: 213 TS files)
8. **MyWorkouts** (Supabase backend, standalone: 215 TS files)
9. **MyHomes** (Drizzle + tRPC backend, standalone: 126 TS files)

### Phase D5: Cleanup and Validation (Week 6-7)

**Goal:** Remove legacy infrastructure and validate the new structure.

- [ ] Remove all 25 git submodules from `.gitmodules`
- [ ] Remove parity enforcement scripts (`check:standalone`, `check:module-parity`, `check:passthrough-parity`, `check:workouts-parity`) as they are no longer needed
- [ ] Update CLAUDE.md and AGENTS.md to reflect the new single-codebase-per-module structure
- [ ] Update README.md and timeline.md
- [ ] Run full `pnpm test`, `pnpm typecheck`, and `pnpm build` to confirm everything works
- [ ] Tag the completion as a milestone release

### Phase D6: Resume Normal Roadmap (Week 7+)

With the restructuring complete, resume the existing MyLife roadmap:

- **Phase 2:** Build out the 13 scaffold-only modules, now without parity burden
- **Phase 3:** Auth + Subscription (packages already scaffolded)
- **Phase 4:** Cloud Modules (MySurf, MyWorkouts, MyHomes full integration)
- **Phase 5:** macOS SwiftUI app (reference rork patterns for SwiftData)
- **Phase 6:** Polish + App Store Launch

---

*Report synthesized from 6 parallel review agents analyzing approximately 150,000 lines of code across 3 codebases, plus 86,497 lines of spec documents. Source review files available at `/tmp/mylife-architecture-review.md`, `/tmp/mylife-code-quality-review.md`, `/tmp/mylife-features-review.md`, `/tmp/ios-hub-architecture-review.md`, `/tmp/ios-rork-code-quality-review.md`, `/tmp/ios-rork-features-review.md`.*
