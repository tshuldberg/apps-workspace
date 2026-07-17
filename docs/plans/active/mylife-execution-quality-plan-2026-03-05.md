# MyLife Execution Quality & Consolidation Plan

**Date:** 2026-03-05
**Status:** Active
**Scope:** First 8-10 launch modules, module consolidation strategy, quality benchmarks, competitive differentiation

---

## 1. Current State Assessment

### Codebase Post-Merge

The merge of `chore/cleanup-performance-artifacts` brought MyLife to a significantly more mature state:

- **14 modules** registered in the hub (books, budget, car, fast, habits, health, homes, meds, recipes, rsvp, surf, words, workouts)
- **11 packages** in the shared layer (auth, billing-config, db, entitlements, eslint-config, migration, module-registry, subscription, sync, typescript-config, ui)
- **~2,400 test files** across the monorepo
- **3-tier sync** fully typed: LocalOnly (default), P2P via WebRTC (free), Cloud via PowerSync + Supabase (paid tiers)
- **Entitlement system** wired: $19.99 hub unlock, $4.99 standalone, $9.99/yr updates, cloud storage tiers
- **Dual-auth** package: local SQLite auth (default) + Supabase cloud auth (opt-in for sync users)
- **PurchaseGate modal** with PRO badge and lock overlay on premium modules
- **ModuleErrorBoundary** wrapping all module route groups for crash isolation

### What's Working Well (Validated by Code Review)

- Module registration pattern with `safeRegister()` + Zod validation prevents malformed modules from crashing the app
- Cross-prefix table reading established (health reads `ft_*`, `md_*`, `cy_*`)
- Single SQLite file with table prefixes keeps data portable and backup-simple
- EntitlementsProvider + AuthProvider layered correctly in root layout
- 5-layer provider stack: ErrorBoundary > Registry > Database > Auth > Entitlements
- **Sync tier model is clean and complete.** Five tiers behind one `SyncProvider` interface with exhaustive `never` check on the tier switch. 83 tests across 8 files
- **Entitlements are purely functional.** `resolveEntitlements(purchases, nowMs)` has no side effects, no platform dependencies, no async
- **Billing config enforces completeness at compile time.** `satisfies Record<Exclude<ModuleId, 'fast'>, StandaloneModuleConfig>` ensures every premium module has a configured price
- **All three new packages (sync, entitlements, subscription) use dependency injection.** Zero real SDKs required to run the test suite. Mock factories are well-typed (`PowerSyncLike`, `RTCPeerConnectionLike`, etc.)
- **MyMeds sets the test quality bar.** 10 test files covering adherence, correlation, export, interactions, measurements, mood, refill, reminders

### What Needs Attention (Code Review Findings)

#### Critical (Blocking Launch)

1. **56 TypeScript errors in `pnpm typecheck`:**
   - 33x TS2307 "Cannot find module" -- MySurf standalone uses `@/lib/mock-data`, `@/lib/supabase`, `@/components/spot/*` path aliases that only resolve inside MySurf's Next.js workspace. Hub's `apps/web` tsconfig pulls these in transitively
   - 14x TS7006 implicit `any` -- MyHabits standalone web pages have untyped callback parameters (`h`, `day`, `i`, `habit`)
   - 1x TS5076 -- MyWorkouts `workout/[id]/page.tsx:856` mixes `??` and `||` without parens (operator precedence bug)
   - 1x TS2304 -- MyWorkouts `exercise/[id]/page.tsx:134` references `createClient` without import
   - 1x TS2353 -- MyHabits `habits/page.tsx:530` passes `unit` field that doesn't exist in Habit creation schema

2. **4 failing tests (Node ABI mismatch):**
   - `modules/books/src/db/__tests__/reader.test.ts` and `sharing.test.ts` -- `better-sqlite3` compiled for Node 141, test runner is Node 127
   - Fix: `pnpm rebuild better-sqlite3` from MyLife root
   - Preventive fix: add `engines: { "node": ">=20.x <21.x" }` to root `package.json` and `.nvmrc`

3. **Duplicate macOS route directories:** `apps/mobile/app/(books) 2/`, `(budget) 2/`, `(hub) 2/` -- Finder copy artifacts that may confuse Expo Router's file-based routing scan. Must delete

#### Significant (Pre-Launch Fixes)

4. **MyFast migration V2 semantically incorrect:** V2's `up` array re-runs all V1 DDL (`...ALL_TABLES, ...CREATE_INDEXES`) plus seeds. Safe at runtime due to `IF NOT EXISTS`, but creates confusion for rollback debugging and future migration authors

5. **Health module lacks formal dependency declaration:** `absorb.ts` reads `md_*`, `ft_*`, `cy_*` tables from other modules with no declared dependency. If meds is disabled, health's absorb logic silently returns 0. Need a `dependsOn` field in `ModuleDefinition`

6. **Auth rate limiting missing:** `local-auth.ts` `loginUser()` has no rate limiting on failed attempts. Need a simple lockout (5 failed attempts -> 15-minute lockout)

7. **Session tokens stored as plaintext UUIDs:** `hub_auth_sessions.id` is a raw UUID. Should store `hash(sessionId)` and compare on lookup

8. **P2P sync factory passes unusable stub defaults:** `_createProvider` P2P case passes `deviceId: ''` and `createPeerConnection: () => { throw }`. Footgun for anyone wiring real WebRTC. Refactor to either no-arg factory or document all stubs must be overridden

9. **Web health/meds pages bypass design system:** `apps/web/app/health/page.tsx` and `meds/page.tsx` use inline CSS with hardcoded hex values instead of `@mylife/ui` tokens

#### Minor

10. **`pnpm-lock.yaml` needs regeneration** after merge
11. **Auth `--jsx` not set error** for provider.tsx re-exports
12. **`useDatabase` error message lacks recovery guidance** for users
13. **Sync hooks.ts global state not cleaned up in tests** -- `_activeProvider` and `_providerVersion` leak between tests
14. **`getActivePurchases()` web path missing try/catch** -- `purchaseStore()` should gracefully return `[]` on failure

### Module Readiness Matrix (Code Review)

| Module | Status | Tests | Web UI | Mobile UI | Migrations | Key Issue |
|--------|--------|-------|--------|-----------|------------|-----------|
| **MyBooks** | YELLOW | 8 files (4 failing) | Passthrough | Full | v1-v5 | Node ABI mismatch, not code bugs |
| **MyBudget** | YELLOW | 1 file | Passthrough | Full | v1-v2 | Light test coverage |
| **MyFast** | YELLOW | 1 file | Passthrough | Full | v1-v2 | V2 migration re-runs ALL_TABLES |
| **MyHabits** | YELLOW | 1 file | Passthrough | Full | v1-v2 | 14 implicit `any` TS errors |
| **MyCar** | GREEN | 1 file | Full native | Full | v1 | Solid, all 5 screens wired |
| **MyMeds** | GREEN | 10 files | Full native | Full | v1-v2 | Best-tested new module |
| **MyHealth** | GREEN | 3 files | Full native | Full | v1 | Absorb pattern is clean |
| **MyRecipes** | YELLOW | 2 files | Passthrough | Partial | v1-v2 | Missing garden sub-route tests |
| **MySurf** | RED | None | Passthrough | Layout only | Supabase | 20+ TS errors, zero tests |
| **MyWorkouts** | RED | Dist only | Passthrough | Layout only | Supabase | Missing `createClient` import |
| **MyHomes** | RED | Dist only | Passthrough | Layout only | Drizzle | No source-level tests |
| **MyWords** | YELLOW | 1 file | Passthrough | Layout only | v1 | Web route not wired |
| **MyRSVP** | YELLOW | 1 file | Partial | Layout only | v1 | Stub-level implementation |

### Test Coverage Gaps (Code Review)

| Gap | Impact |
|-----|--------|
| MySurf, MyWorkouts, MyHomes: zero source tests | Cannot verify cloud-backed data layers before launch |
| Auth package: only password-validation tested | `registerUser`, `loginUser`, `getSessionUser`, `updatePassword`, `deleteAccount` have zero coverage |
| DatabaseProvider: untested | Core app initialization (migration runner, integrity check, mode detection) has no test |
| Mobile UI screens: shallow coverage | Tests are mock-heavy, no integration tests wiring DB + UI |
| `packages/db/migration-runner.ts`: untested | Rollback/down paths, partial migration failure, version tracking not exercised |
| Sync `applyChangeset` transaction rollback: untested | No test for mid-batch failure behavior |

---

## 2. Module Consolidation Strategy

### Approved Consolidations

| Consolidation | Absorbed Modules | New Name | Table Prefixes | Rationale |
|---------------|-----------------|----------|----------------|-----------|
| MyFast + MyMeds | `fast`, `meds` | **MyHealth** | `hl_` (new), reads `ft_*`, `md_*` | Already implemented. Health is the natural umbrella for fasting + medication tracking |
| MyJournal + MyWords + MyNotes | `words` + new | **MyBooks** (expanded) | `bk_` (existing), `wd_*` (words) | Books already tracks reading. Journal entries, vocabulary, and note-taking are all "written word" activities. Single app for everything text/reading |
| MyTrails + MySurf | `surf` + new trails | **MySport** (new) | `sp_` (new), reads `sf_*` | Outdoor activity tracking. Add MySnow and MyGolf as sub-sections, not separate modules |
| MyBudget | `budget` | **MyFinance** (expanded) | `bg_` (existing) | Expand beyond envelopes: net worth tracker, investment overview, tax receipt tagging |
| New | -- | **MyDocuments** | `dc_` | Local encrypted document vault with data segmentation and password protection |

### Consolidation Implementation Pattern

The MyHealth consolidation is the proven pattern. Each consolidation follows:

```
modules/<consolidated>/
  src/
    index.ts          # ModuleDefinition with freeSections for free tier
    absorb.ts         # Settings migration from absorbed modules
    schema.ts         # New prefix tables + cross-prefix reads
    migrations.ts     # Migration to consolidated schema
```

**Key rules:**
- Absorbed modules stay in `modules/` but are marked `deprecated: true` in MODULE_METADATA
- Consolidated module's `freeSections` array preserves free-tier access to any absorbed feature that was previously free (e.g., MyFast is free tier, so fasting stays free inside MyHealth)
- Data is never deleted during consolidation -- only read patterns change
- Cross-prefix table reading allows gradual migration without data loss

### MyDocuments: New Module Design

**Purpose:** Local encrypted document vault with strict data segmentation. Documents stored in MyDocuments are isolated from all other modules and internet-connected features.

**Core requirements:**
- AES-256 encryption at rest for all stored documents
- Password/biometric gate on module entry (separate from hub auth)
- No network access whatsoever -- fully air-gapped from Supabase, sync, and cloud features
- Data segmentation: MyDocuments SQLite tables (`dc_*`) are in a **separate** SQLite file, not the shared hub database
- Document types: PDF, images, text notes, scanned documents
- Categories: Medical, Financial, Legal, Personal, Insurance, Tax
- Full-text search over document metadata (not content, to avoid decryption overhead)
- Export: encrypted zip with password, or plaintext to Files app

**Why separate SQLite file:** The shared hub database is accessible to the sync layer and all modules. MyDocuments' privacy guarantee requires physical isolation. A separate `documents.sqlite` file encrypted with SQLCipher ensures no other module or sync provider can access document data.

---

## 3. Launch Module Priority & Readiness

### Tier 1: Launch Day (8 modules)

| # | Module | Standalone Parity? | Hub Status | Test Coverage | Launch Blocker? |
|---|--------|--------------------|------------|---------------|-----------------|
| 1 | **MyHealth** (fast+meds) | Fast: standalone exists. Meds: design only | Hub code complete | Moderate | No -- free tier, gets installs |
| 2 | **MyBooks** | Standalone exists | Hub code complete | Good | No |
| 3 | **MyBudget/MyFinance** | Standalone exists | Hub code complete | Good | No |
| 4 | **MyRecipes** | Design only | Hub has 5-tab layout | Low | Needs screen implementation |
| 5 | **MyHabits** | Design only | Hub scaffold | Low | Needs screen implementation |
| 6 | **MyCar** | Design only | Hub scaffold | Low | Needs screen implementation |
| 7 | **MyWorkouts** | Standalone exists | Hub code exists | Moderate | Supabase dependency |
| 8 | **MyRSVP** | Design only | Hub scaffold | Low | Needs screen implementation |

### Tier 2: Fast Follow (3-4 months post-launch)

| Module | Notes |
|--------|-------|
| **MySport** (surf+trails) | MySurf has standalone code. Trails needs new development |
| **MyHomes** | Drizzle + tRPC backend, more complex |
| **MyWords** | Gets absorbed into MyBooks expansion |
| **MyDocuments** | New module, requires SQLCipher integration |

### Tier 3: Community-Driven

Any module the community requests. The "we will add whatever people want" model means:
- Public roadmap (GitHub Discussions or similar)
- Community voting on next modules
- Monthly "module of the month" development sprints
- Open to external contributors for module proposals

---

## 4. Quality Benchmarks & Standards

### App Store Quality Gates

These are non-negotiable minimums. Apps below these thresholds get buried in search results and trigger negative review spirals.

| Metric | Target | Industry Context |
|--------|--------|-----------------|
| **Crash-free rate** | >= 99.95% | Apple/Google both surface crash rates. Below 99.5% triggers review flags |
| **App Store rating** | >= 4.5 stars | 4.5+ is table stakes for discovery. 4.7+ is elite. Below 4.0 is death |
| **Cold launch time** | < 400ms to first meaningful paint | Users abandon after 3s. Sub-400ms feels "instant" |
| **Frame rate** | 60fps sustained, no drops below 45fps | Jank is the #1 "feels cheap" signal |
| **App size** | < 50MB initial download | Each 10MB over 50MB loses ~1% of potential installs |
| **Memory usage** | < 150MB steady state | iOS kills background apps aggressively over 200MB |
| **Battery impact** | No background drain when modules are idle | "This app drains my battery" is a 1-star review generator |

### Test Coverage Targets

| Layer | Target | Tool | Rationale |
|-------|--------|------|-----------|
| **Shared packages** (db, module-registry, entitlements, sync) | 90% line coverage | Vitest | These are the foundation. Bugs here cascade to all modules |
| **Module business logic** (schema, migrations, engines) | 85% line coverage | Vitest | Core value proposition per module |
| **React components** | 70% line coverage | Jest + jest-expo (mobile), Vitest (web) | Focus on interaction logic, not pixel-perfect rendering |
| **E2E critical paths** | 100% of happy paths | Maestro (mobile), Playwright (web) | Every user-facing flow must have a smoke test |
| **Edge cases** | Fuzz testing for parsers, importers, financial calculations | Vitest with property-based testing | Budget math, date parsing, CSV import are high-risk |

### Testing Stack (Validated)

| Context | Tool | Why |
|---------|------|-----|
| **Mobile unit/component** | Jest + jest-expo | React Native's test runner. Vitest does not work with RN's module resolution |
| **Web unit/component** | Vitest + Testing Library | Faster, native ESM, better TypeScript support |
| **Shared packages** | Vitest | No React Native dependency, pure TypeScript |
| **Mobile E2E** | Maestro | YAML-based, no flaky selectors, records real device flows. Detox is fragile and heavy |
| **Web E2E** | Playwright | Best-in-class web E2E. Built-in screenshot comparison |
| **Performance** | Flashlight (mobile), Lighthouse CI (web) | Automated perf regression detection |
| **Accessibility** | axe-core (web), manual VoiceOver testing (iOS) | Accessibility is a legal requirement and a competitive advantage |

### Pre-Release Checklist

Every module must pass this gate before shipping:

- [ ] All tests pass (`pnpm test`)
- [ ] Type check clean (`pnpm typecheck`)
- [ ] No lint errors (`pnpm lint`)
- [ ] Parity check passes (`pnpm check:parity`) for modules with standalone repos
- [ ] Function quality gate passes (`pnpm gate:function:changed`)
- [ ] E2E smoke tests pass on iOS Simulator + Android Emulator
- [ ] Cold launch under 400ms measured with Flashlight
- [ ] Memory profile under 150MB steady state
- [ ] VoiceOver navigation works for all interactive elements
- [ ] Dark mode renders correctly (all modules use MyLife dark theme)
- [ ] Offline mode works -- airplane mode toggle, verify no crashes
- [ ] Data persistence verified -- kill app, reopen, data intact
- [ ] Module enable/disable cycle works -- enable, use, disable, re-enable, data preserved
- [ ] Import/export works if applicable (CSV, JSON)
- [ ] No console.error or console.warn in production builds

---

## 5. What Sets MyLife Apart

### Privacy-First Architecture (Primary Differentiator)

MyLife's privacy model is not a marketing claim backed by a privacy policy. It's an architectural guarantee:

| Claim | How It's Enforced |
|-------|-------------------|
| **No analytics, no telemetry** | Zero analytics SDKs in dependencies. No Firebase, no Amplitude, no Mixpanel. Verified by dependency audit |
| **No data harvesting** | No network calls except Open Library (book metadata) and optional Supabase sync. All other data is SQLite on-device |
| **No AI in the tool** | No ML models, no on-device inference, no server-side AI processing of user data |
| **Offline-first** | Every module works fully offline. Cloud sync is opt-in, not required |
| **Data portability** | Every module supports export (CSV, JSON, Markdown). Users own their data and can leave anytime |
| **MyDocuments isolation** | Separate encrypted SQLite file, no sync layer access, password-gated entry |

**Competitive context:** Every competitor in the personal productivity space (Notion, Todoist, Any.do, Day One) requires an account and syncs data to their servers by default. MyLife is the anti-cloud personal app suite. This positioning wins whenever a competitor has a data breach, changes their privacy policy, or gets acquired.

**Historical precedent:** Signal grew from 10M to 40M users in January 2021 after WhatsApp's privacy policy change. Bitwarden saw 4x growth after LastPass's breach. Proton grew from 20M to 100M users during 2022-2023 privacy concerns. Privacy apps don't win through advertising -- they win through trust crises at competitors.

### One-Time Purchase in a Subscription World

| Aspect | MyLife | Competitors |
|--------|--------|-------------|
| **Pricing model** | $19.99 one-time for everything, or $4.99 per app | $5-$15/month subscriptions |
| **What you get** | All features, all modules, forever | Feature-gated tiers, annual renewals |
| **Updates** | Free Year 1, optional $9.99/yr after | Included in subscription (because you're paying monthly) |
| **Cloud storage** | 1GB free, pay only if you want more | Usually bundled, required, used for lock-in |

**Why this works:** Subscription fatigue is real and growing. The average American has 6.7 app subscriptions costing $31.50/month (2025 data). A $19.99 one-time purchase is an emotional relief compared to adding another monthly charge. The value proposition is: "Pay once, own it, no strings."

### Portfolio Strategy (Multi-Category App Store Presence)

Most indie apps compete in a single App Store category. MyLife competes in 8-10 categories simultaneously:

- Health & Fitness (MyHealth/MyFast, MyWorkouts)
- Finance (MyFinance/MyBudget)
- Books (MyBooks)
- Food & Drink (MyRecipes)
- Productivity (MyHabits, MyDocuments)
- Lifestyle (MyCar, MyRSVP, MyHomes)
- Sports (MySport/MySurf)

**Each standalone app gets its own App Store listing** in its category, which:
- Competes against category-specific apps with category-specific keywords
- Cross-promotes the hub ("Part of the MyLife suite")
- Generates reviews in multiple categories (more total social proof)
- Creates a discovery funnel: find one app, discover the whole suite

**Comparable model:** The Obsidian approach -- 1.5M monthly active users, ~$25M ARR, 18 employees, zero VC. Privacy-first, local-first, one-time purchase + optional sync. This is the proven playbook.

### Community-Driven Development

The "we will add whatever people want" model:

- **Public roadmap** with community voting (GitHub Discussions or dedicated forum)
- **Module request system** -- users propose new modules, community upvotes
- **Monthly development sprints** focused on the highest-voted module
- **Open module API** -- the ModuleDefinition contract is documented and stable, enabling community contributors to build modules
- **No feature gates** -- every module included in the $19.99 price. New modules are free additions, not upsells

This creates a flywheel: more users -> more module requests -> more modules -> more users. The subscription model can't do this because adding modules means "now you're paying more." One-time purchase means every new module is a free gift that increases the value of the original purchase.

---

## 6. Testing Strategy: Deep Dive

### Testing Pyramid

```
         /‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
        /  E2E (Maestro/   \         5-10 per module
       /   Playwright)      \        Critical happy paths only
      /─────────────────────-\
     /  Integration Tests     \      20-30 per module
    /  (Jest/Vitest + mocks)   \     Cross-module, DB, providers
   /───────────────────────────-\
  /  Unit Tests (Vitest/Jest)    \   50-100+ per module
 /  Pure logic, schemas, engines  \  Fast, isolated, comprehensive
/─────────────────────────────────-\
```

### Per-Module Test Inventory (Launch Modules)

**MyHealth (fast + meds):**
- Unit: Timer logic, fasting window calculations, medication schedule engine, dose tracking math
- Integration: SQLite read/write cycles, cross-prefix reads (ft_*, md_*), settings migration from absorbed modules
- E2E: Start fast -> complete fast -> view history. Add medication -> set schedule -> receive reminder

**MyBooks:**
- Unit: Open Library API response parsing, ISBN validation, rating calculations, reading progress math, import CSV parsing (Goodreads, StoryGraph)
- Integration: Book CRUD, shelf management, tag system, FTS5 search, export (CSV/JSON/Markdown)
- E2E: Search book -> add to library -> update progress -> rate -> view stats

**MyFinance (budget):**
- Unit: Envelope math (allocation, spending, rollover), subscription cost calculations (monthly/yearly normalization), category aggregation, goal progress
- Integration: Transaction CRUD, envelope transfers, subscription renewal scheduling, reports generation
- E2E: Create envelope -> add transaction -> view balance. Add subscription -> view calendar -> see cost dashboard
- **Fuzz testing required:** Financial calculations must handle edge cases (rounding, currency precision, leap year billing cycles, timezone-aware renewal dates)

**MyRecipes:**
- Unit: Ingredient parser (quantity/unit/name), serving size scaler, nutritional math, cooking timer logic
- Integration: Recipe CRUD, meal plan assignment, garden integration, event linking
- E2E: Add recipe -> scale servings -> start cooking mode -> complete

**MyHabits:**
- Unit: Streak calculations, frequency patterns (daily/weekly/custom), completion rate statistics, chain-don't-break logic
- Integration: Habit CRUD, history tracking, widget data provider
- E2E: Create habit -> complete today -> view streak -> miss a day -> verify streak behavior

**MyCar:**
- Unit: Fuel economy calculations, maintenance schedule predictions, cost-per-mile math, insurance renewal logic
- Integration: Vehicle CRUD, service record history, fuel log aggregation
- E2E: Add vehicle -> log fillup -> view mpg trend -> schedule maintenance

**MyWorkouts:**
- Unit: Volume calculations (sets x reps x weight), personal record detection, rest timer logic
- Integration: Supabase CRUD (cloud module), workout template system, exercise library
- E2E: Start workout from template -> log sets -> complete -> view PR notifications

**MyRSVP:**
- Unit: Guest count aggregation, dietary restriction tallying, seating chart algorithms, timeline generation
- Integration: Event CRUD, guest management, vendor tracking
- E2E: Create event -> add guests -> send invites -> track responses -> view dashboard

### Critical Test Scenarios (Cross-Module)

These scenarios test the hub itself, not individual modules:

1. **Module lifecycle:** Enable module -> migrations run -> data created -> disable module -> data preserved -> re-enable -> data accessible
2. **Entitlement gating:** Free module accessible without purchase. Premium module shows PurchaseGate. After purchase, premium module accessible
3. **Multi-module data:** Health reads from fast + meds tables. Verify cross-prefix queries work after module enable/disable cycles
4. **Offline resilience:** Airplane mode -> use any module -> kill app -> restore connectivity -> verify no data loss
5. **Sync tier transitions:** Local-only -> enable P2P -> connect peer -> sync -> upgrade to cloud -> verify data integrity
6. **Auth transitions:** Anonymous user -> create local account -> upgrade to Supabase auth -> verify data carries over
7. **Import/export round-trip:** Export data from module A -> factory reset -> import data -> verify identical state

---

## 7. Competitive Moat Analysis

### Where MyLife Wins

| Dimension | MyLife | Notion | Todoist | Day One | YNAB |
|-----------|--------|--------|---------|---------|------|
| **Privacy** | Zero telemetry, local-first | Cloud-required, analytics | Cloud-required | Cloud-required, E2EE option | Cloud-required |
| **Pricing** | $19.99 one-time | $10/mo or $96/yr | $5/mo or $48/yr | $35/yr | $14.99/mo |
| **Offline** | Full offline, every module | Partial offline | Partial offline | Offline with sync | Online-only |
| **Breadth** | 8-10+ modules, one purchase | Flexible but DIY | Tasks only | Journal only | Budget only |
| **Data portability** | CSV/JSON/MD export everywhere | Limited export | Limited export | Limited export | Limited export |
| **Open development** | Community module requests | Closed roadmap | Closed roadmap | Closed roadmap | Closed roadmap |

### Where MyLife Must Improve to Win

1. **Polish over features:** Ship 8 excellent modules rather than 15 mediocre ones. Every screen must feel native, responsive, and intentional. The #1 reason privacy apps fail is they feel like "developer tools" rather than consumer products.

2. **Onboarding experience:** The hub dashboard is the first impression. It must immediately communicate value. Show what each module does with a 3-second animation or screenshot, not just a name and emoji.

3. **Data import:** Users switching from competitors need a seamless import path. Goodreads CSV for MyBooks, YNAB export for MyFinance, Apple Health for MyHealth. Each import must handle messy real-world data gracefully.

4. **Screenshots and preview:** 90% of users don't scroll past screenshot 3 in the App Store. The first three screenshots must show: (a) the hub dashboard, (b) the most visually impressive module screen, (c) the privacy promise. The App Store listing is as important as the code.

5. **Review velocity:** Getting to 50+ reviews in the first month is critical. Under 20 reviews triggers the "is this app even real?" filter. Strategies: in-app review prompt after positive interaction (rated a book, completed a fast, balanced a budget), TestFlight beta community, ProductHunt launch.

---

## 8. Risk Mitigation

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Apple Guideline 4.3 (spam):** Multiple similar apps rejected as spam | Medium | Critical | Submit hub first, then standalones 2-3 weeks apart. Each standalone must have unique features and branding. Never submit more than 2 apps in the same review cycle |
| **SQLite migration failures:** Bad migration corrupts user data | Low | Critical | Every migration must be wrapped in a transaction with rollback. Automated migration tests run against production-like schemas. Export-before-migrate safety net |
| **React Native performance:** Complex modules drop below 60fps | Medium | High | Profile early with Flashlight. Use FlatList (not ScrollView) for all lists. Memoize expensive renders. Avoid bridge-heavy operations in scroll handlers |
| **Expo SDK breaking changes:** Major Expo update breaks modules | Medium | Medium | Pin Expo SDK version, test upgrades in a worktree before merging. Keep modules loosely coupled from Expo-specific APIs |

### Business Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Cold start review death spiral:** 0 reviews -> low ranking -> no downloads -> no reviews | High | Critical | TestFlight beta program with 50+ testers before launch. In-app review prompts. ProductHunt launch day. Early influencer outreach |
| **Paid upfront barrier:** $19.99 upfront scares away browsers | High | High | Free tier (MyFast/MyHealth) gets users in the door. Standalone $4.99 apps lower the entry point. Consider a time-limited free trial of all modules |
| **One-developer bus factor:** All code by one person | High | High | Comprehensive test coverage, documentation, and type safety reduce the impact. Community contributors through open module API lower long-term risk |
| **Feature creep from community requests:** Saying yes to everything dilutes quality | Medium | Medium | Quarterly module cadence (max 1 new module per quarter). Community votes prioritize but don't obligate. Quality gate must pass before any new module ships |

---

## 9. 90-Day Execution Timeline

### Days 1-30: Foundation Hardening

**Week 1: Critical blockers (code review findings)**
- [ ] Delete duplicate route directories: `apps/mobile/app/(books) 2/`, `(budget) 2/`, `(hub) 2/`
- [ ] Run `pnpm rebuild better-sqlite3` to fix 4 failing tests (Node ABI mismatch)
- [ ] Add `.nvmrc` and `engines: { "node": ">=20.x <21.x" }` to root `package.json`
- [ ] Regenerate `pnpm-lock.yaml` via clean `pnpm install`
- [ ] Isolate standalone submodule tsconfigs from hub typecheck scope (fixes 33 TS2307 errors)
- [ ] Type 14 implicit `any` parameters in MyHabits standalone web pages
- [ ] Fix operator precedence bug in MyWorkouts `workout/[id]/page.tsx:856` (add parens around `??`/`||`)
- [ ] Fix missing `createClient` import in MyWorkouts `exercise/[id]/page.tsx:134`
- [ ] Fix `unit` field type mismatch in MyHabits `habits/page.tsx:530`

**Week 2: Security and data integrity**
- [ ] Add auth rate limiting: 5 failed attempts -> 15-minute lockout in `loginUser()`
- [ ] Hash session tokens in `hub_auth_sessions` (store `hash(sessionId)`, compare on lookup)
- [ ] Fix MyFast migration V2: replace re-run of ALL_TABLES with only additive DDL
- [ ] Add `dependsOn` field to `ModuleDefinition` interface; declare health depends on meds + fast
- [ ] Refactor P2P sync factory to remove unusable stub defaults (no-arg factory pattern)
- [ ] Replace hardcoded hex values in web health/meds pages with `@mylife/ui` tokens

**Weeks 3-4: Test coverage and CI**
- [ ] Write unit tests for auth package: `registerUser`, `loginUser`, `getSessionUser`, `updatePassword`, `deleteAccount`
- [ ] Write tests for `packages/db/migration-runner.ts` (rollback, partial failure, version tracking)
- [ ] Write tests for `DatabaseProvider` (initialization, migration runner, integrity check)
- [ ] Add sync `applyChangeset` transaction rollback test
- [ ] Add `afterEach` cleanup for sync hooks.ts global state in tests
- [ ] Add try/catch to `getActivePurchases()` web path for `purchaseStore()` failures
- [ ] Achieve 85% test coverage on `packages/db`, `packages/entitlements`, `packages/module-registry`
- [ ] Achieve 70% test coverage on `packages/sync`, `packages/subscription`
- [ ] Write Maestro E2E tests for: hub dashboard, module enable/disable, MyFast (free tier happy path)
- [ ] Set up Flashlight CI for cold-launch performance regression
- [ ] Set up Playwright CI for web app smoke tests

### Days 31-60: Module Completion

- [ ] Complete MyRecipes screen implementation (5 tabs: Home, Recipes, Meal Plan, Garden, Events)
- [ ] Complete MyHabits screen implementation
- [ ] Complete MyCar screen implementation
- [ ] Complete MyRSVP screen implementation
- [ ] Expand MyBooks to absorb MyWords features (vocabulary, journal)
- [ ] Expand MyBudget to MyFinance (subscription tracker, reports)
- [ ] Write Jest + jest-expo component tests for all completed screens
- [ ] Write Maestro E2E tests for each completed module (1 happy path minimum)
- [ ] Conduct memory profiling and optimize to stay under 150MB steady state

### Days 61-90: Polish & Launch Prep

- [ ] Onboarding flow: first-launch experience showing value of each module
- [ ] App Store assets: 10 screenshots per device size, preview video, description copy
- [ ] TestFlight beta distribution to 50+ testers
- [ ] Collect and act on beta feedback (2 feedback cycles minimum)
- [ ] Apple Small Business Program enrollment (15% commission)
- [ ] RevenueCat integration: $19.99 hub IAP, $4.99 standalone IAPs, verify purchase flow
- [ ] Stripe integration: web payment flow for hub unlock
- [ ] Final parity audit: all modules with standalone repos pass `pnpm check:parity`
- [ ] Final performance audit: all launch modules meet quality benchmarks
- [ ] Submit to App Store + Play Store

---

## 10. Success Metrics (First 6 Months)

| Metric | Minimum Viable | Good | Great |
|--------|---------------|------|-------|
| **Downloads** | 500 | 2,000 | 10,000 |
| **Revenue** | $2,000 | $10,000 | $50,000 |
| **App Store Rating** | 4.3 | 4.6 | 4.8 |
| **Reviews** | 20 | 75 | 200 |
| **Crash-free rate** | 99.5% | 99.9% | 99.95% |
| **DAU/MAU ratio** | 15% | 25% | 35% |
| **Hub conversion** (standalone -> hub) | 5% | 15% | 25% |
| **Cloud sync adoption** | 5% | 15% | 30% |

---

## 11. Key Insight: Quality Is the Strategy

The financial projections show that the difference between the pessimistic scenario ($4,200 Y1) and the realistic scenario ($25,000 Y1) is not marketing budget or feature count. It's **execution quality.**

Users who download a privacy-first app and find it polished, fast, and reliable become evangelists. Users who find crashes, jank, or missing features become 1-star reviewers. There is no middle ground in the App Store.

The path to the realistic scenario:
1. Ship 8 modules that are each individually competitive with the best single-purpose app in their category
2. Make the hub feel like a native iOS/Android app, not a web wrapper
3. Get to 50+ genuine reviews in the first month
4. Wait for a competitor trust crisis (it will come -- it always does)

The entire quality strategy reduces to one principle: **every module must be good enough that a user would happily pay $4.99 for it as a standalone app.** If it's not worth $4.99 on its own, it's not ready for the hub.
