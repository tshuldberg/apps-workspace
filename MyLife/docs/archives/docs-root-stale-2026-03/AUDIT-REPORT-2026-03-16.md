# MyLife Monorepo Audit Report
**Date:** 2026-03-16
**Auditor:** Claude Sonnet 4.6 (automated source audit)

---

## Section 1: CI & Health Status

### Typecheck

**Status: FAILING — 1 error**

```
apps/mobile/app/(hub)/discover.tsx(16,10): error TS2305:
  Module '"@mylife/entitlements"' has no exported member 'isEntitlementExpired'.
```

**Root cause:** `discover.tsx` imports `isEntitlementExpired` from `@mylife/entitlements`, but that function does not exist in the package. `packages/entitlements/src/index.ts` exports only: `isModuleUnlocked`, `getUnlockedModules`, `isHubUnlocked`, `getStorageTier`, `isUpdateEntitled`, and `resolveEntitlements`.

**Fix:** Either add `isEntitlementExpired` to `packages/entitlements/src/gates.ts` and re-export it, or replace the usage in `discover.tsx` with the appropriate existing gate (`isUpdateEntitled` plus an expiry timestamp check is the likely intent).

---

### Tests

**Status: FAILING — 5 web test files, 21 tests**

Failing test suites in `apps/web`:

1. **`app/__tests__/hub-dashboard.test.tsx` (3 tests)** — `useEntitlements must be used within an EntitlementsProvider`. The `HubDashboard` renders `<UpdatePrompt>` which calls `useEntitlements`, but the test renders the page without wrapping it in `EntitlementsProvider`. Fix: add `EntitlementsProvider` to the test render wrapper.

2. **`app/car/__tests__/car-page.test.tsx`** — `Failed to resolve import "@mycar-web/app/page"`. The `MyCar` standalone submodule directory (`MyLife/MyCar/`) exists in `.gitmodules` but is empty (no code checked out). The passthrough alias resolves to an empty directory. Fix: implement `MyCar` standalone app (see Section 3) or change car web hub to an adapter implementation until the standalone is built.

3. **`app/fast/__tests__/fast-page.test.tsx`** — Same pattern: `@myfast-web/app/page` not resolvable because `MyFast/` standalone directory is empty.

4. **`lib/billing/__tests__/entitlement-issuer.test.ts`** — Import of `BILLING_SKUS` from `@mylife/billing-config` fails at runtime. `packages/billing-config/src/index.ts` does not export `BILLING_SKUS`. The package exports `PRODUCTS`, `ALL_PRODUCT_IDS`, `BILLING_EVENT_TYPES`, and related types, but there is no `BILLING_SKUS` constant. Fix: add `export const BILLING_SKUS = PRODUCTS` (or a flat map of IDs) to `billing-config`.

5. **`test/parity/standalone-passthrough-matrix.test.ts` (18 tests)** — See Parity section below.

---

### Parity

**Status: FAILING**

#### Standalone repo integrity (`pnpm check:standalone`)

- **FAIL (1):** `MyHealth` — missing `.git` entry. The submodule is listed in `.gitmodules` but has no `.git` file in the `MyHealth/` directory. This means `git submodule update --init MyHealth` was never run, or the `.git` file was deleted. Fix: run `git submodule update --init --remote MyHealth` from the repo root.

- **WARN (9):** Local HEAD differs from remote HEAD for: `MyBooks`, `MyCar`, `MyFast`, `MyRSVP`, `MySurf`, `MyVoice`, `MyWorkouts`, `MyHomes`, `MyMail`. These submodules are behind their remote. This is not a build blocker but indicates the pinned commits are not current. Fix: run `git submodule update --remote <name>` for each, review changes, and commit updated `.gitmodules` pointers.

#### Passthrough parity (`pnpm check:passthrough-parity`) — 18 failing

The passthrough parity tests enforce that hub web routes are thin re-export wrappers pointing to standalone app pages, AND that those standalone pages actually exist.

**Root cause (applies to all 7 passthrough failures below):** The standalone app directories (`MyCar/`, `MyFast/`, `MyHabits/`, `MyHomes/`, `MyRecipes/`, `MySurf/`, `MyWords/`) are empty — they are registered as git submodules but none contain any runtime TypeScript code. The hub web routes correctly point to passthrough aliases, but the aliases resolve to empty directories.

Failing passthrough modules: `car`, `fast`, `habits`, `homes`, `recipes`, `surf`, `words`

Additionally, the parity matrix fails for: `rsvp` (no standalone app code), `health` (design-only, missing DESIGN.md in standalone), and `meds` (design-only, missing DESIGN.md in standalone).

**Additional issue:** `apps/web/package.json` has a duplicate `"@mylife/auth": "workspace:*"` key (lines 20 and 33). This generates a build warning from esbuild. Fix: remove the duplicate entry.

---

## Section 2: Module Status Table

| Module | Hub Web | Hub Mobile | Standalone Web | Standalone Mobile | Completion % | Blocker |
|--------|---------|------------|----------------|-------------------|-------------|---------|
| MyBooks | Passthrough (real) | Full adapter | Real (146 TS files) | Real (Expo tabs) | 85% | Submodule HEAD drift |
| MyBudget | Passthrough (real) | Full adapter | Real (245 TS files) | Real (Expo tabs) | 80% | Bank sync not live |
| MyCar | Passthrough wrapper (broken) | Adapter (8 screens) | Empty submodule | None | 40% | Standalone not built |
| MyFast | Passthrough wrapper (broken) | Adapter (6 screens) | Empty submodule | None | 45% | Standalone not built |
| MyHabits | Passthrough wrapper (broken) | Adapter (9 screens) | Empty submodule | None | 45% | Standalone not built |
| MyHealth | Hub only (17 mobile, 9 web) | Full adapter | Missing .git | None | 35% | No standalone at all |
| MyHomes | Passthrough wrapper (broken) | Stub (1 screen) | Empty submodule | None | 25% | Standalone not built; mobile stub |
| MyMeds | Hub only (9 mobile, 7 web) | Full adapter | Empty submodule | None | 50% | No standalone app code |
| MyRecipes | Passthrough wrapper (broken) | Full adapter (12 screens) | Empty submodule | None | 40% | Standalone not built |
| MyRSVP | Adapter (real) | Full adapter (real) | Empty submodule | None | 55% | No standalone app code |
| MySurf | Passthrough wrapper (broken) | Full adapter (8 screens) | Empty submodule | None | 40% | Standalone not built |
| MyWords | Passthrough wrapper (broken) | Full adapter (real) | Empty submodule | None | 40% | Standalone not built |
| MyWorkouts | Passthrough (real) | Full adapter | Real (163 TS files) | Real (Expo tabs) | 80% | Submodule HEAD drift |
| MyCloset | No hub | No hub | Empty submodule | None | 5% | Standalone-only, no code |
| MyCycle | No hub | No hub | Empty submodule | None | 5% | Standalone-only, no code |
| MyFlash | No hub | No hub | Empty submodule | None | 5% | Standalone-only, no code |
| MyGarden | No hub | No hub | Empty submodule | None | 5% | Standalone-only, no code |
| MyJournal | No hub | No hub | Empty submodule | None | 5% | Standalone-only, no code |
| MyMail | No hub | No hub | Empty submodule | None | 5% | Standalone-only (HEAD drift) |
| MyMood | No hub | No hub | Empty submodule | None | 5% | Standalone-only, no code |
| MyNotes | No hub | No hub | Empty submodule | None | 5% | Standalone-only, no code |
| MyPets | No hub | No hub | Empty submodule | None | 5% | Standalone-only, no code |
| MyStars | No hub | No hub | Empty submodule | None | 5% | Standalone-only, no code |
| MySubs | No hub | No hub | Empty submodule | None | 5% | Standalone-only, no code |
| MyTrails | No hub | No hub | Empty submodule | None | 5% | Standalone-only, no code |
| MyVoice | No hub | No hub | Empty submodule | None | 5% | Standalone-only (HEAD drift) |

---

## Section 3: Per-Module Deep Dive

### MyBooks

**Current state:** Most complete module pair in the repo. Standalone has 146 TypeScript files across `apps/mobile`, `apps/web`, `packages/shared`, `packages/ui`, `packages/eslint-config`, `packages/typescript-config`. Hub module `modules/books/src/` has 13 directories covering db, models, reader, stats, challenges, journal, discovery, progress, import, export, and API. Mobile hub has 12 screens including book detail, shelf, reader, scan, search, stats, and year review. Web hub uses passthrough to standalone. Submodule is checked out but 1 commit behind remote.

**Gap analysis:**
- Submodule HEAD is behind remote (`7184dd77` vs `048cbad1`). Any upstream standalone changes are not reflected.
- Mobile is in adapter mode, not passthrough — parity maintenance burden.
- Challenges, journal, and discovery features exist in module src but need verification they are surfaced in mobile screens.

**Feature plan:**
1. Run `git submodule update --remote MyBooks` and commit updated pointer.
2. Verify mobile hub screens expose challenges, book journal, and reading discovery features.
3. Add mobile passthrough architecture (future phase) to reduce adapter maintenance.

**Estimated effort:** S (submodule sync), M (screen coverage audit)

---

### MyBudget

**Current state:** Second most complete pair. Standalone has 245 TypeScript files. Hub module `modules/budget/src/` has bank-sync infrastructure (`connector-service.ts`, `cloud-adapters.ts`, `provider-router.ts`, `providers/`, `token-vault.ts`, `webhook-security.ts`, `audit-log.ts`). Mobile hub has 14 screens covering accounts, transactions, goals, reports, subscriptions. Web hub uses passthrough.

**Gap analysis:**
- Bank sync is fully architected in module src but requires live OAuth provider credentials (Plaid/MX) to function.
- The `bank-sync/providers/` directory exists but provider implementations are not verified as complete.
- Subscription renewal calendar screen exists in mobile standalone but parity to hub mobile needs verification.

**Feature plan:**
1. Audit `modules/budget/src/bank-sync/` providers for implementation completeness.
2. Add environment variable documentation for bank sync credentials.
3. Verify mobile hub subscription renewal calendar matches standalone.
4. Sync submodule to remote HEAD.

**Estimated effort:** M (bank sync audit), S (submodule sync)

---

### MyCar

**Current state:** Hub module is built (`modules/car/src/` with db, definition, index, types). Mobile hub has 8 screens (garage, expenses, reminders, settings, vehicle detail). Web hub has passthrough wrappers pointing to `@mycar-web/app/...`, but the `MyCar/` submodule directory is completely empty — no apps, no packages, no code. The passthrough alias chain is broken. Tests fail at import resolution.

**Gap analysis:**
- `MyCar/` standalone does not exist as runtime code — the submodule registers as a git pointer but no files are present.
- Web tests fail because `@mycar-web/app/page` cannot be resolved.
- The parity test for "hub route roots both contain runtime screens" fails because there is no standalone.

**Feature plan:**
1. Build `MyCar/` standalone app with at minimum: `apps/web/app/page.tsx`, `apps/web/app/expenses/page.tsx`, `apps/web/app/garage/page.tsx`, `apps/web/app/reminders/page.tsx`, `apps/web/app/settings/page.tsx`, `packages/shared/src/index.ts`.
2. Build `MyCar/apps/mobile/` with Expo tab structure matching hub mobile.
3. Wire `packages/shared` to reuse `@mylife/car` module logic.
4. Run parity check after each step.

**Estimated effort:** L (standalone web + mobile app creation)

---

### MyFast

**Current state:** Hub module is well built (`modules/fast/src/` has db, timer, protocols, stats, zones, export). Mobile hub has 6 screens (fasting timer, history, stats, settings). Web hub has passthrough wrapper to `@myfast-web/app/page` but the `MyFast/` submodule directory is empty. Same failure pattern as MyCar.

**Gap analysis:**
- `MyFast/` standalone is empty.
- Web passthrough broken, tests fail.
- Fast is the only free-tier module — high visibility.

**Feature plan:**
1. Build `MyFast/` standalone: web app with pages (index, history, stats, settings), mobile app (Expo tabs).
2. Share `@mylife/fast` engine for all data operations.
3. Add `MyFast/packages/shared/src/index.ts` as the canonical type export.
4. Wire tsconfig alias `@myfast-web/*` (already present in web tsconfig).

**Estimated effort:** L — priority: HIGH (free tier, high visibility)

---

### MyHabits

**Current state:** Hub module has full engine (`modules/habits/src/` with db, cycle, heatmap, stats, export). Mobile hub has 9 screens. Web hub has passthrough wrapper to `@myhabits-web/app/...` but `MyHabits/` standalone is empty. Web tsconfig has `@myhabits-web/*` alias pointing to `../../MyHabits/apps/web/*` which does not exist.

**Gap analysis:**
- Standalone app is a registered submodule with no code.
- Passthrough broken.

**Feature plan:**
1. Scaffold `MyHabits/apps/web/app/` with at minimum index page, habit detail, cycle, stats.
2. Scaffold `MyHabits/apps/mobile/` with Expo tab structure.
3. Use `@mylife/habits` engine for all persistence.
4. Ensure habits hub mobile screens match standalone screens.

**Estimated effort:** L

---

### MyHealth

**Current state:** Hub module is the most feature-complete non-passthrough module in the hub. `modules/health/src/` has 11 directories: db, definition, documents, emergency, goals, migration, settings, sleep, vitals, and `__tests__`. Mobile hub has 17 screens including vault, vitals, fasting, emergency info, health sync settings, mood check-in, med detail, measurements. Web hub has 9 routes (vitals, mood, sleep, goals, emergency, export). MyHealth is also listed in `.gitmodules` but `MyHealth/.git` does not exist — submodule was never initialized.

**Gap analysis:**
- Standalone submodule missing `.git` — parity test fails hard.
- No standalone app exists at all (empty dir, no DESIGN.md either).
- The parity matrix expects either a `DESIGN.md` (design-deferred) or a `.git` file plus runtime code. Neither is present.
- Health is effectively hub-only with no canonical standalone product.
- MyFast fasting functionality partially duplicated in MyHealth `fasting.tsx` mobile screen — potential parity conflict with standalone MyFast.

**Feature plan:**
1. Run `git submodule update --init MyHealth` OR add MyHealth to the explicit design-deferred list with a `DESIGN.md`.
2. Decide: is MyHealth a standalone product or only a hub module? Document this.
3. If standalone-first: scaffold `MyHealth/` with basic app structure.
4. Resolve fasting overlap with MyFast module (the health module has a `fasting.tsx` screen and `freeSections: ['fasting']` in definition — this should delegate to `@mylife/fast`, not duplicate it).

**Estimated effort:** S (submodule init + DESIGN.md decision), XL (full standalone app)

---

### MyHomes

**Current state:** Hub module `modules/homes/src/` has db, definition, index, types. Mobile hub has a single real screen (`index.tsx`) that uses `@mylife/homes` for listing management. Web hub has 5 routes (page, actions, messages, profile, sell). The `storageType` is set to `'drizzle'` in the definition, but there is no tRPC server, no actual Drizzle adapter wired, and `modules/homes/src/db/` uses SQLite patterns consistent with the rest of the hub (not Drizzle). `MyHomes/` submodule is empty.

**Gap analysis:**
- Mobile is a single-screen stub — none of the navigation tabs defined in the module definition (`search`, `map`, `saved`, etc.) are implemented.
- `storageType: 'drizzle'` in definition does not match the actual SQLite implementation in `modules/homes/src/db/`.
- No standalone app.
- Real estate features (map view, listing search, market metrics) need significant work.

**Feature plan:**
1. Fix `storageType` in definition to `'sqlite'` unless Drizzle migration is imminent.
2. Add mobile screens for map, saved listings, profile.
3. Build `MyHomes/` standalone app.
4. If Drizzle/tRPC path is chosen, add `packages/homes-server/` with Drizzle schema and tRPC router.

**Estimated effort:** XL

---

### MyMeds

**Current state:** Hub module is extensive (`modules/meds/src/` has 13 directories: analytics, db, interactions, measurements, medication, models, mood, reminders, export). Mobile hub has 9 screens including add-med, history, mood, mood check-in, medications list, settings. Web hub has 7 routes including mood, measurements, history, export. `MyMeds/` standalone directory is empty (no code, no DESIGN.md). Parity test expects `DESIGN.md` in standalone since it is marked design-deferred, but the file is absent.

**Gap analysis:**
- Standalone is empty and parity test fails because `DESIGN.md` is missing.
- Mood tracking in MyMeds duplicates mood functionality in MyHealth — consolidation decision needed.
- Drug interaction engine (`interactions/`) and reminder scheduler (`reminders/`) exist in module src but are not confirmed wired to UI.

**Feature plan:**
1. Add `MyMeds/DESIGN.md` to unblock parity test (mark as design-deferred).
2. Audit whether `interactions/` and `reminders/` are surfaced in mobile/web screens.
3. Resolve mood tracking overlap with MyHealth.
4. Build standalone app when scope is finalized.

**Estimated effort:** S (DESIGN.md), M (audit), XL (standalone)

---

### MyRecipes

**Current state:** Hub module has db, definition, index, types. Mobile hub has 12 screens including add-recipe, cooking mode, events, garden, meal-plan, recipe detail. Web hub has 9 routes (add, events, garden, grocery, import, library, meal-planner, pantry). Both are real implementations. `MyRecipes/` standalone is empty — passthrough wrappers point to `@myrecipes-web/app/...` which does not resolve.

**Gap analysis:**
- Standalone app is empty.
- The hub has a garden feature (`garden.tsx` in mobile, `/garden` in web) — this overlaps with the planned MyGarden standalone app.
- Web is passthrough-mode but the source doesn't exist.

**Feature plan:**
1. Build `MyRecipes/` standalone app (web + mobile).
2. Share hub engine (`@mylife/recipes`) for all data logic.
3. Evaluate garden feature overlap with MyGarden standalone.

**Estimated effort:** L

---

### MyRSVP

**Current state:** Hub module has real engine (db with full schema: events, invites, RSVPs, polls, questions, announcements, photos, links). Mobile hub has real full-featured screen (`index.tsx` imports 20+ functions from `@mylife/rsvp`). Web hub has real full-featured page (`page.tsx` imports all RSVP actions). Both web and mobile are real implementations, not stubs. `MyRSVP/` standalone directory is empty — no code, no git content (submodule HEAD differs from remote).

**Gap analysis:**
- Standalone app is empty. Parity test fails because no standalone runtime screens exist.
- The hub implementation is solid and could be used as the template for building the standalone.
- Submodule HEAD is behind remote.

**Feature plan:**
1. Build `MyRSVP/` standalone app using hub screens as source of truth.
2. Run `git submodule update --remote MyRSVP`.
3. Wire `@myrsvp-web/*` alias in web tsconfig and switch web to passthrough mode.

**Estimated effort:** L (standalone app creation)

---

### MySurf

**Current state:** Hub module has db, definition, index, types. Mobile hub has 8 screens including map, sessions, favorites, account, spot detail. Web hub has 7 routes (map, sessions, favorites, account, spot). Passthrough wrappers point to `@mysurf-web/app/...` but `MySurf/` standalone is empty. Submodule HEAD differs from remote.

**Gap analysis:**
- Standalone app is empty.
- Surf is defined as `storageType: 'supabase'` — requires Supabase tables and real-time sync, which is more complex than SQLite modules.

**Feature plan:**
1. Build `MySurf/` standalone app.
2. Set up Supabase migrations in `supabase/` for surf tables.
3. Wire map (MapLibre/Mapbox) in standalone.

**Estimated effort:** XL (Supabase integration + map)

---

### MyWords

**Current state:** Hub module has api, definition, index, service, types (`service.ts` handles dictionary API calls). Mobile hub has real dictionary lookup screen with language selection. Web hub has passthrough wrapper to `@mywords-web/app/page` but `MyWords/` standalone is empty. `@mywords-web/*` alias is in web tsconfig but resolves to empty directory.

**Gap analysis:**
- Standalone app empty.
- Words is API-only (no persistent data store), which makes standalone scaffolding simpler than other modules.

**Feature plan:**
1. Build `MyWords/` standalone — primarily a web app with dictionary search UI.
2. Mobile standalone (Expo app) reusing hub screen as reference.
3. Wire `@mywords-web/*` passthrough.

**Estimated effort:** M (lighter than other standalones — no DB)

---

### MyWorkouts

**Current state:** Second most complete trio. Standalone has 163 TypeScript files with extensive `apps/web/app/` structure (20+ routes including plans, progress, recordings, social, templates, tools, measurements, photos). Hub mobile has 9 screens. Hub web uses passthrough to `@myworkouts-web/*`. Submodule HEAD behind remote.

**Gap analysis:**
- Submodule HEAD differs from remote (`aab49f6e` vs `10d4beb9`).
- Hub mobile does not have passthrough screens for social, templates, tools, photos — these exist only in standalone.
- Supabase-backed (requires `supabase/` migrations).

**Feature plan:**
1. Run `git submodule update --remote MyWorkouts`.
2. Audit hub mobile screens vs standalone web feature set for parity gaps.
3. Implement missing mobile screens (social, tools, template builder, photos).

**Estimated effort:** M (submodule sync + mobile screen additions)

---

### Standalone-only apps (no hub module)

The following 11 standalone directories are registered as git submodules and pass the `check:standalone` integrity check (have valid `.git` entries), but none contain any TypeScript code:

| App | .git present | Code present | Notes |
|-----|-------------|--------------|-------|
| MyCloset | Yes | No | Fashion/wardrobe tracking |
| MyCycle | Yes | No | Menstrual/health cycle |
| MyFlash | Yes | No | Flashcard/spaced repetition |
| MyGarden | Yes | No | Garden planning |
| MyJournal | Yes | No | Personal journal |
| MyMood | Yes | No | Mood tracking |
| MyNotes | Yes | No | Note-taking |
| MyPets | Yes | No | Pet health/care |
| MyStars | Yes | No | Stargazing/astronomy |
| MySubs | Yes | No | Subscription tracker |
| MyTrails | Yes | No | Hiking/trail logging |

Additionally, `MyMail` and `MyVoice` are standalone-only with HEAD drift warnings.

---

## Section 4: Priority Build Order

### Week 1-2: Fix CI, Unblock Tests

**Goal:** Get CI green. All tests passing. Parity gate not blocking on trivial issues.

**Tasks:**
1. Add `isEntitlementExpired` to `packages/entitlements/src/gates.ts` — checks if entitlement has a past `expiresAt` date — and re-export it from `src/index.ts`. (Fix mobile typecheck.)
2. Add `BILLING_SKUS` export to `packages/billing-config/src/index.ts` as a flat map of SKU strings. (Fix entitlement-issuer test.)
3. Remove duplicate `"@mylife/auth"` from `apps/web/package.json`. (Fix build warning.)
4. Add `EntitlementsProvider` wrapper to the hub dashboard test render in `apps/web/app/__tests__/hub-dashboard.test.tsx`. (Fix 3 dashboard tests.)
5. Run `git submodule update --init MyHealth` and add `MyHealth/DESIGN.md`. (Fix FAIL in parity check.)
6. Add `MyMeds/DESIGN.md`. (Fix meds parity WARN.)
7. Address submodule HEAD drifts: run `git submodule update --remote` for `MyBooks`, `MyCar`, `MyFast`, `MyRSVP`, `MySurf`, `MyVoice`, `MyWorkouts`, `MyHomes`, `MyMail` and commit updated pointers.

**Acceptance:** `pnpm typecheck` passes, `pnpm test` passes all non-parity tests, `pnpm check:standalone` has 0 FAILs.

---

### Week 3-4: Standalone Scaffolding for High-Priority Modules

**Goal:** Unblock passthrough parity for the free-tier module (MyFast) and the two highest-usage modules (MyWords, MyRSVP).

**Tasks:**
1. **MyFast standalone** — Build `MyFast/apps/web/app/` (index, history, stats, settings pages) and `MyFast/apps/mobile/` Expo app. Wire `@mylife/fast` engine. Wire `@myfast-web/*` passthrough. *Priority: HIGH (free tier)*
2. **MyWords standalone** — Build `MyWords/apps/web/app/` (dictionary search page) and mobile app. No DB needed — API-only.
3. **MyRSVP standalone** — Extract hub screens into standalone `MyRSVP/apps/web/app/` and `MyRSVP/apps/mobile/`. Wire tRPC or SQLite engine.
4. Run `pnpm check:passthrough-parity` — target: MyFast, MyWords, MyRSVP green.

---

### Week 5-6: Core Module Standalones (Habits, Recipes, Meds)

**Goal:** Give the 3 adapter-mode hub-only modules real standalone counterparts.

**Tasks:**
1. **MyHabits standalone** — Build web + mobile app using `@mylife/habits` engine. Wire passthrough.
2. **MyRecipes standalone** — Build web + mobile app using `@mylife/recipes` engine. Wire passthrough. Clarify garden feature scope.
3. **MyMeds standalone** — Build web + mobile app using `@mylife/meds` engine. Decide mood tracking split with MyHealth.
4. Fix `MyHomes` mobile stub — add map, saved, search screens.
5. Fix `MyHomes` definition: change `storageType` from `'drizzle'` to `'sqlite'` unless Drizzle migration is planned this sprint.

---

### Week 7-8: Cloud Modules + Polish

**Goal:** MySurf, MyWorkouts, MyCar, MyHomes — complete passthrough wiring. Polish hub shell.

**Tasks:**
1. **MyCar standalone** — Build web + mobile. Wire `@mycar-web/*` passthrough.
2. **MySurf standalone** — Build web + mobile with Supabase. Set up `supabase/` migrations for surf tables.
3. **MyWorkouts** — Sync submodule, add missing mobile screens (social, tools, templates, photos) for parity.
4. Run full `pnpm check:parity` gate — target: all modules green.
5. Review auth flow: ensure `AuthProvider` wraps all protected module screens on both mobile and web.
6. Review subscription paywall: test RevenueCat integration on iOS simulator, Stripe checkout on web.

---

## Section 5: Standalone-Only Apps Roadmap

These 11 apps have no hub integration and no code yet. They are registered submodules pointing to empty repos.

### Integration approach (shared pattern)

Each standalone app that gets integrated into the hub requires:
- A module directory: `modules/<name>/src/` with `definition.ts`, `db/schema.ts`, `index.ts`, `types.ts`
- Mobile screens: `apps/mobile/app/(<name>)/` with `_layout.tsx` and at least one tab screen
- Web routes: `apps/web/app/<name>/page.tsx` (passthrough) or adapter
- Module registration in `apps/mobile/app/_layout.tsx` and `packages/module-registry/src/constants.ts`
- Standalone app code for passthrough: `<AppName>/apps/web/app/` and `<AppName>/apps/mobile/`

### Priority ranking and estimates

| App | Priority | Reason | Hub Complexity | Estimated Effort |
|-----|----------|--------|----------------|-----------------|
| MyJournal | HIGH | High utility, simple storage model | Low (text entries + tags) | M |
| MyNotes | HIGH | Core productivity, simple model | Low (Markdown notes, search) | M |
| MySubs | HIGH | Subscription tracking, no external deps | Low (local CRUD) | S-M |
| MyMood | MEDIUM | Standalone mood (without health module overlap) | Low (daily check-ins) | M |
| MyPets | MEDIUM | Niche but self-contained | Low (pet profiles, vet visits) | M |
| MyTrails | MEDIUM | Requires GPS/map integration | Medium (MapLibre, location) | L |
| MyFlash | MEDIUM | Spaced repetition algorithm | Medium (SRS engine) | L |
| MyGarden | LOW | Overlaps with Recipes garden feature | Medium (planting calendar) | L |
| MyCloset | LOW | Image-heavy, needs file storage | High (photo management) | XL |
| MyCycle | LOW | Sensitive health data, complex algorithm | High (cycle prediction, privacy) | XL |
| MyStars | LOW | Requires astronomy data APIs | High (sky map, ephemeris API) | XL |

### MyJournal integration sketch

- Engine: SQLite with `jn_` prefix, entries with date/tags/mood, FTS search
- Mobile: 3 tabs (Today, Timeline, Search)
- Web: passthrough
- Effort: M (1 week standalone + 2 days hub wiring)

### MyNotes integration sketch

- Engine: SQLite with `nt_` prefix, Markdown storage, folder hierarchy, FTS
- Mobile: 2 tabs (Notes list, Quick capture)
- Web: passthrough
- Effort: M (similar to MyWords — relatively simple data model)

### MySubs integration sketch

- Engine: SQLite with `sb_` prefix, subscription name/price/renewal date/category
- Mobile: 3 tabs (Active, Calendar, Stats)
- Web: passthrough
- No external API dependencies
- Effort: S-M (1 week total)

---

## Section 6: Quick Wins

10 tasks completable in under 2 hours each that meaningfully improve the product:

1. **Fix the typecheck error** (`isEntitlementExpired` in `discover.tsx`) — Add the missing function to `packages/entitlements/src/gates.ts`. This unblocks CI and is a ~15-minute change.

2. **Fix the duplicate `@mylife/auth` key** in `apps/web/package.json` line 33 — Delete the duplicate line. Eliminates a persistent esbuild warning.

3. **Add `BILLING_SKUS` export to billing-config** — Add `export const BILLING_SKUS = { ...PRODUCTS }` or a flat ID map. Fixes the entitlement-issuer test.

4. **Fix hub-dashboard test** — Wrap the rendered component in `EntitlementsProvider` in `apps/web/app/__tests__/hub-dashboard.test.tsx`. Fixes 3 failing tests.

5. **Add `MyHealth/DESIGN.md` and `MyMeds/DESIGN.md`** — Two markdown files marking these as design-deferred. Fixes 2 parity test failures and correctly documents the status.

6. **Fix `MyHomes` `storageType`** — Change `storageType: 'drizzle'` to `storageType: 'sqlite'` in `modules/homes/src/definition.ts`. The actual implementation uses SQLite; `'drizzle'` is incorrect and misleading.

7. **Sync all submodule HEAD pointers** — Run `git submodule update --remote` for the 9 drifted submodules and commit. Eliminates all 9 WARN entries from `pnpm check:standalone`.

8. **Add `MyHomes` mobile map/search/saved screens** — The homes module definition declares `search`, `map`, `saved` tabs but only a single index screen exists. Adding even placeholder screens with basic navigation unblocks the homes module tab structure and makes mobile usable.

9. **Fix web app tsconfig `@myhabits-web/*` alias** — It currently points to `../../MyHabits/apps/web/*`. Add a corresponding `@myhabits/shared` and `@myhabits/ui` alias pair to match the pattern used by all other passthrough modules. (The aliases exist for `@myhabits-web/*` but the companion shared/ui aliases are missing.)

10. **Add `EntitlementsProvider` to mobile `_layout.tsx`** — Verify that `EntitlementsProvider` (from `apps/mobile/components/EntitlementsProvider.tsx`) is properly nested inside `AuthProvider` and `DatabaseProvider` in `apps/mobile/app/_layout.tsx`. The component exists and is imported, but confirming the provider order is correct prevents runtime errors like the one seen in web tests.

---

*End of audit. Generated from source file analysis on 2026-03-16.*
