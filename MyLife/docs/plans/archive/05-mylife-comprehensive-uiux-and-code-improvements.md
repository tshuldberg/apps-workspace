# MyLife Comprehensive UIUX & Code Improvements Plan

**Created:** 2026-04-16
**Scope:** All 30 modules + hub shell + shared packages
**Method:** 7 parallel Explore agents audited each cluster against current code, memory, session logs, and in-flight unified-nav refactor.
**Signal quality:** High — audits returned concrete file paths, priorities, and rationale.

## Executive Summary

MyLife has largely shipped its 30-module UIUX rebuild and just completed the unified-module-navigation refactor. The remaining work falls into four buckets:

1. **Ship blockers (P0)** — 5 items. Copy gaps, silent failures, broken skeleton animation.
2. **High-impact gaps (P1)** — 42 items. Missing features, unshipped functionality, dangerous silent error handling, incomplete cloud sync.
3. **Polish (P2)** — 38 items. Loading/empty states, visual urgency, parity touchups, documentation.
4. **Nice-to-have (P3)** — 15 items. Feature wiring for engines that exist but aren't surfaced.

No production crashes detected. Test suite stable (306 web + 118 mobile).

---

## Priority 0 — Ship Blockers

These are visible, immediate UX defects or dangerous silent failures.

| # | Area | Issue | File | Fix |
|---|------|-------|------|-----|
| P0.1 | Hub (mobile) | Settings `heroSubtitlePro` blank when user is Pro | `apps/mobile/app/(hub)/settings.tsx` | Supply Pro hero copy |
| P0.2 | Hub (mobile) | HamburgerMenu silently shows "No modules available" on registry fetch error | `apps/mobile/components/HamburgerMenu.tsx` | Surface error state + retry |
| P0.3 | Hub (web) | Dashboard skeleton animation has gradient but no `@keyframes` — skeletons appear static | `apps/web/app/page.tsx` + CSS | Add keyframes + animation property |
| P0.4 | Hub (web) | Dashboard async fetch has no error boundary — hangs forever on slow API | `apps/web/app/page.tsx` | Wrap in ErrorBoundary + add AbortController |
| P0.5 | Infra | No function gate for shared packages (db, ui, module-registry) — breaking changes slip through | `package.json` + husky | Extend `gate:function` with shared-pkg schema/type check |

**Estimated time:** 1 day.

---

## Priority 1 — High-Impact Gaps (organized by cluster)

### 1A. Health & Wellness cluster

| # | Module | Issue | Files |
|---|--------|-------|-------|
| 1A.1 | Mood | Suggestion engine disabled (`enabledModules: []` hardcoded line 137) — cross-module suggestions never populate | `apps/mobile/app/(mood)/index.tsx` |
| 1A.2 | Mood | Dashboard `try/catch` silently returns empty — no error toast to user | mood dashboard loader |
| 1A.3 | Health | HealthKit sync has no real-time status indicator; users don't know if sync is active | `apps/mobile/app/(health)/` |
| 1A.4 | Health | Migration absorb (`absorb.ts`) untested — risk of data loss if cycle/meds tables already populated | `modules/health/src/absorb.ts` |
| 1A.5 | Health | Doctor report promised in module tagline but no generate button on mobile | mobile health screens |
| 1A.6 | Fast | Timer race: `setNow` can fire after unmount when fast ends during interval tick | `apps/mobile/app/(fast)/index.tsx:105-115` |
| 1A.7 | Habits | Cycle-tracking tables (`hb_periods`, `hb_period_symptoms`) still in habits schema — should be deprecated to `@mylife/cycle` | `modules/habits/src/db/schema.ts:85` |
| 1A.8 | Habits | Location reminders require geofence permissions but silently disabled if denied | habits reminder engine |
| 1A.9 | Meds | Drug database stub at `index.ts:406` — autocomplete disabled, users type drug names manually | `modules/meds/src/db/index.ts` |
| 1A.10 | Meds | CGM data syncs silently but mobile has no CGM tab (web has `/meds/cgm/`) | mobile meds tabs |
| 1A.11 | Meds | Caregiver alert weekly summary generated but never delivered | meds notification |
| 1A.12 | Cycle | Pregnancy week-by-week data (baby size, milestones) all defined but mobile only shows week number | `apps/mobile/app/(cycle)/` |
| 1A.13 | Nutrition | Barcode scanner exists but mobile upload has no barcode button | `modules/nutrition/src/scanner.ts` |
| 1A.14 | Nutrition | AI photo-log feature in schema but mobile has no camera+LLM workflow | nutrition mobile |
| 1A.15 | Nutrition | Web has `/nutrition/community/` and `/nutrition/insights/` — mobile has neither | nutrition mobile tabs |

### 1B. Productivity cluster

| # | Module | Issue | Files |
|---|--------|-------|-------|
| 1B.1 | Flash | FLASH-01 "Jump Back In" session resumption card missing | `apps/mobile/app/(flash)/` |
| 1B.2 | Flash | FLASH-02 carousel + swipe (mobile has carousel; web stuck on single-card) | `apps/web/app/flash/page.tsx` |
| 1B.3 | Flash | Quizlet P1 tasks FLASH-07 through FLASH-13 pending (stats dashboard, match game UI, practice tests, conversation practice UIs) | `docs/plans/active/quizlet-tasks.md` |
| 1B.4 | Mail | Compose/draft UI incomplete (thread conversation view not wired) | `apps/mobile/app/(mail)/` + web |
| 1B.5 | Mail | Attachments (V2 tables) exist but no preview/download UI | mail attachment screens |
| 1B.6 | Mail | Account credentials stored without visible encryption | `modules/mail/src/db/` |
| 1B.7 | Notes | Canvas (V3) exists in schema but no web canvas routes | `apps/web/app/notes/` |
| 1B.8 | Notes | Knowledge graph engines exist but no UI to display graph/orphan/bridge notes | notes mobile+web |
| 1B.9 | Voice | Transcription catches errors silently; audio files orphaned after deletion | `modules/voice/src/` |
| 1B.10 | Words | Cache has no TTL enforcement; stale results after 5+ min | `modules/words/src/cache/` |
| 1B.11 | Words | Saved-words list not surfaced from main lookup flow | words web+mobile |

### 1C. Lifestyle cluster

| # | Module | Issue | Files |
|---|--------|-------|-------|
| 1C.1 | Books | `rate-books.tsx` + `shelf/[id].tsx` P4-E completion (rating feedback, view-mode toggle state, empty-state CTAs) | `apps/mobile/app/(books)/rate-books.tsx`, `shelf/[id].tsx` |
| 1C.2 | Books | Web has no reader route; mobile has `reader/[id].tsx` | `apps/web/app/books/` |
| 1C.3 | Garden | Migration status field issue per memory.md — silent returns on query error mask schema bugs | `modules/garden/src/db/` |
| 1C.4 | Garden | Overdue plants filtered but no visual badge/highlight in list | `apps/mobile/app/(garden)/index.tsx:76-80` |
| 1C.5 | Garden | Watering action has no error handling; `db.waterPlant()` exceptions bubble uncaught | garden index mobile |
| 1C.6 | Pets | Multiple `listDue*` calls with no error boundaries — single query failure crashes reminders view | `apps/mobile/app/(pets)/reminders.tsx:18-47` |
| 1C.7 | Pets | Emergency contacts fetched but not rendered — dead feature | `apps/mobile/app/(pets)/reminders.tsx:37` |
| 1C.8 | Closet | `splitTags` naive `.split(',')` — no trim on edge cases, creates dirty tags | `apps/mobile/app/(closet)/wardrobe.tsx:30-34` |

### 1D. Fitness/Outdoor cluster

| # | Module | Issue | Files |
|---|--------|-------|-------|
| 1D.1 | Surf | Cloud adapters have **zero** try/catch across 8 files; all `SupabaseClient` calls throw uncaught | `modules/surf/src/cloud/` (spots.ts, etc.) |
| 1D.2 | Surf | Supabase consolidation incomplete — no sync conflict resolution between local SQLite and cloud | `modules/surf/src/` |
| 1D.3 | Trails | `expo-location` and `expo-keep-awake` not yet added; GPS recording uses simulator fallback | `apps/mobile/app/(trails)/record.tsx` |
| 1D.4 | Trails | Recording notes + privacy metadata (V13) in schema but no UI to edit privacy post-recording | trails mobile |
| 1D.5 | Workouts | Progressive overload rule trigger has no offline queue for rule changes | `modules/workouts/src/` |
| 1D.6 | Stars | Tarot spreads defined but no UI to create custom spreads | `modules/stars/src/tarot-spreads.ts` |

### 1E. Financial/Admin cluster

| # | Module | Issue | Files |
|---|--------|-------|-------|
| 1E.1 | Car | Vehicle selector has no visual feedback (dead-button feel) when changing active car | `apps/mobile/app/(car)/` |
| 1E.2 | Car | Service reminders empty stub at `reminders/`; fuel cost input lacks decimal validation | car web + mobile |
| 1E.3 | Homes | Web missing appliance and project management tabs (mobile has them) | `apps/web/app/homes/` |
| 1E.4 | Homes | tRPC errors silently swallowed in `crud.ts`; no error propagation to UI | `modules/homes/src/db/crud.ts` |
| 1E.5 | RSVP | Poll voting updates silently (no success toast); past events on web not visually distinguished | `apps/mobile/app/(rsvp)/` + web |
| 1E.6 | RSVP | Comments/announcements fetch has no loading state | rsvp event detail |
| 1E.7 | Market | Payment webhook silent catch — failures aren't retried or surfaced | `modules/market/src/payments/` |

### 1F. Social cluster + Unified-Nav

| # | Area | Issue | Files |
|---|------|-------|-------|
| 1F.1 | Social | `(social)/_layout.tsx` still hardcodes inline `tabBarStyle` — NOT refactored to ModuleLayoutWrapper (only layout that escaped) | `apps/mobile/app/(social)/_layout.tsx` |
| 1F.2 | Unified-nav | No CI lint to verify all modules use ModuleLayoutWrapper; regression risk | CI config |
| 1F.3 | Unified-nav | Web parity incomplete — `WebModuleLayoutWrapper` is 49 lines vs 136 mobile; no web HamburgerMenu equivalent | `apps/web/components/WebModuleLayoutWrapper.tsx` |
| 1F.4 | Forums | Vote controls have no disabled-state UX when user lacks verification; text clipping on thread body | `modules/forums/src/ui/VoteControls.tsx`, `ThreadCard.tsx` |
| 1F.5 | Forums | FTS `search_vector` schema present but search UI missing | `modules/forums/src/ui/` |
| 1F.6 | Presence | Insights + recommendations engines exist but no UI screens consuming them | `modules/presence/src/engines/insights.ts`, `recommendations.ts` |

### 1G. Infrastructure

| # | Area | Issue | Files |
|---|------|-------|-------|
| 1G.1 | packages/ui | Books domain tokens (`bookTitle`, `bookAuthor`, `bookReview`) leak into shared typography tokens | `packages/ui/src/tokens/typography.ts:81-99` |
| 1G.2 | packages/db | Migration array contiguity unchecked — deleting a middle migration silently skips it | `packages/db/src/migration-runner.ts:98` |
| 1G.3 | packages/db | No init-time mutex on `prepareMigrationInfrastructure()` — concurrent calls can race | `packages/db/src/migration-runner.ts:43-46` |
| 1G.4 | packages/module-registry | `MODULE_METADATA` missing `satisfies Record<ModuleId, ModuleDefinition>` assertion — typos aren't caught at compile time | `packages/module-registry/src/constants.ts` |
| 1G.5 | packages/module-registry | `MODULE_RELEASE_STATES` duplicated across arrays and object — adding a module requires 2+ updates, no TS guard | `packages/module-registry/src/release-states.ts` |
| 1G.6 | packages/auth + subscription | No error enum — clients can't discriminate retryable network errors from fatal auth failures | `packages/auth/src/service.ts`, `packages/subscription/src/service.ts` |
| 1G.7 | Repo-wide | No centralized error package (`@mylife/errors`) for retry logic + classification | new package |

**Estimated P1 time:** 3–4 weeks.

---

## Priority 2 — Polish

### 2A. Universal fixes (apply across all modules)

| # | Theme | Action |
|---|-------|--------|
| 2A.1 | Loading skeletons | Every dashboard/list currently flickers content in. Add `<Skeleton>` rows during first load. Affected: nearly every module. |
| 2A.2 | Empty states | Standardize: icon + one-line hint + optional CTA. Affected: books/shelf, mood/experiments, notes/notes-list, voice/history, words/saved, mail/inbox, garden/overdue, pets/reminders, closet/wardrobe, rsvp/past. |
| 2A.3 | Error toasts | Surface db/network errors instead of silent `try/catch` that returns `[]`. Audit found silent catches in: mood, health, fast, habits, meds, cycle, nutrition, surf, trails, stars, car, homes, rsvp, market, mail. |
| 2A.4 | Urgency color coding | Pets reminders, meds refill alerts, garden overdue, rsvp upcoming all show plain text — add danger/warn colors. |
| 2A.5 | Visual feedback on taps | Car vehicle selector, closet menu, books rate stars, flash rate buttons all have no active/selected state styling. |
| 2A.6 | Refresh-on-focus | Only mood uses `useFocusEffect` — fast, health, nutrition, meds all show stale data after navigation back. |

### 2B. Module-specific polish

| # | Module | Polish |
|---|--------|--------|
| 2B.1 | Mood | Pet evolution stages on web dashboard; insights refresh button |
| 2B.2 | Health | Tier badge on fasting (free vs paid); vitals data-source legend |
| 2B.3 | Fast | Grace-period carveout visible in progress bar; water tracker cup-count progress |
| 2B.4 | Habits | Multi-reminder UI (V7 schema already supports it); RPG XP progress bar |
| 2B.5 | Meds | Visual heatmap for pain map (currently plain list) |
| 2B.6 | Cycle | Color-coded phase ring on mobile (parity with web); copy-to-clipboard on partner code |
| 2B.7 | Nutrition | Water progress bar; macro ring empty state; "show more" on micronutrients |
| 2B.8 | Flash | Deck search/filter; New/Learning/Review queue breakdown |
| 2B.9 | Notes | Knowledge graph viz; canvas onboarding; save button loading state |
| 2B.10 | Voice | Recording timer + level meter; copy-to-clipboard; quality selector wiring |
| 2B.11 | Words | Language search (270+ options); network-offline prompt |
| 2B.12 | Mail | Skeleton rows; unread highlight; pull-to-refresh on web |
| 2B.13 | Books | Celebration UX on done-rating; grid/list toggle on web |
| 2B.14 | Recipes | Meal insights module on home; pantry quick-add; list timestamps |
| 2B.15 | Garden | Companion-plant guide in add-flow; bulk season actions; frost window visualization |
| 2B.16 | Pets | Health alert CTAs ("Schedule vet visit"); medication "Mark taken" button; monthly spend breakdown |
| 2B.17 | Closet | Home-screen outfit builder; CPW alerts/projections; laundry care notifications; wear ↔ calendar sync |
| 2B.18 | Workouts | Bar-chart empty bar handling (ratio divide-by-zero → Infinity); mobile touch feedback |
| 2B.19 | Surf | "Last updated" timestamp on spot cards; photo gallery placeholder |
| 2B.20 | Trails | Elevation profile empty state; offline region download progress; GPS placeholder clarity |
| 2B.21 | Stars | Transits empty state; tarot shuffle disabled state; compatibility history loading |
| 2B.22 | Budget | Envelope icon-picker modal; decimal truncation on web targets |
| 2B.23 | Subs | Plan removal of redundant MySubs shell (retired; merged into budget) |
| 2B.24 | Car | Input validation (odometer non-negative, cost decimal) |
| 2B.25 | Homes | Cost card spacing; overdue badge clipping on small fonts; property inventory photos |
| 2B.26 | RSVP | Waitlist capacity UI; pre-event reminder scheduling UI |
| 2B.27 | Market | Remaining quantity indicator; estimated delivery date in checkout |
| 2B.28 | Forums | Community loading skeleton; bookmark UI in ThreadCard |
| 2B.29 | Presence | GoalRing performance audit on older devices; category chip color sync with AppRow gradient |

### 2C. Infrastructure polish

| # | Area | Polish |
|---|------|--------|
| 2C.1 | packages/ui | Split glass tokens into `glass.native.ts` + `glass.web.ts`; document spacing xl→xxl jump |
| 2C.2 | packages/db | Deadlock timeout on `db.transaction()`; document hub_schema_versions schema |
| 2C.3 | module-registry | Sync memory.md "10/11 beta" → "11" |
| 2C.4 | subscription | Add state machine (pending→active→expired→cancelled) for renewal UI |
| 2C.5 | migration | Add progress callbacks for long CSV imports; document offline-first auth flow |
| 2C.6 | Unified-nav | HamburgerMenu unit test; screenOptions merge precedence JSDoc; tabBar FAB magic-number constant |
| 2C.7 | Tooling | Linter rule forbidding inline `fontSize`/`tabBarStyle` values in module layouts |
| 2C.8 | Docs | Update mission-control HTML trackers for mood, health, recipes, garden, cycle, nutrition, books (drift noted in memory.md) |

**Estimated P2 time:** 4–6 weeks.

---

## Priority 3 — Nice-to-have

| # | Item |
|---|------|
| 3.1 | Journal: CBT distortion progress dashboard, writing-challenge notifications, vision-board grid |
| 3.2 | Stars: tarot spread custom creation UI; journal-compose attachments upload |
| 3.3 | Voice: summarization + keyword extraction UIs |
| 3.4 | Nutrition: meal template picker/create; TDEE calorie-goal adjust button |
| 3.5 | Budget: seasonal rotation "Apply all" bulk; planning ahead view |
| 3.6 | Market: seller verification progress indicator |
| 3.7 | Forums: "Humans Only" community toggle UI |
| 3.8 | Presence: data export UI; schedule-notification preferences |
| 3.9 | Closet: outfit wear-history → calendar integration |
| 3.10 | Typography: second pass on small 11–13px labels for accessibility |
| 3.11 | Docs: extract ModuleErrorBoundary + ModuleLockGuard as named composition HOC pattern |
| 3.12 | Docs: "onboarding journey" per module (first-run experience documentation) |
| 3.13 | Infra: feature-flag package for module visibility (currently built-time HIDDEN_MODULE_IDS only) |
| 3.14 | packages/subscription: document RevenueCat vs Stripe routing decision tree |
| 3.15 | Repo-wide: pre-commit rollback safety net if gate fails after stash apply |

---

## Phased Rollout

### Phase 1 — P0 Ship Blockers (Week 1)
- P0.1 through P0.5
- Single focused sprint
- Verify: hub settings, hamburger menu, web dashboard, CI gate

### Phase 2 — Infrastructure Hardening (Weeks 2–3)
- 1G.1–1G.7 (types, migrations, error handling, registry safety)
- Creates `@mylife/errors` package
- Unblocks module-level error UX in subsequent phases

### Phase 3 — High-Impact Module Fixes (Weeks 4–7)
Split by owner/team:
- **Health cluster team:** 1A.1–1A.15 (mood suggestions, habits cycle-table cleanup, meds drug DB, nutrition barcode, cycle pregnancy content)
- **Productivity team:** 1B.1–1B.11 (Flash Quizlet gap closure, mail compose/attachment UIs, notes canvas, voice error handling)
- **Lifestyle team:** 1C.1–1C.8 (books P4-E, garden migration + overdue UX, pets error boundary, closet tags)
- **Fitness/Outdoor team:** 1D.1–1D.6 (surf cloud try/catch, trails expo-location add, tarot spreads)
- **Financial/Admin team:** 1E.1–1E.7 (car reminders, homes web appliance/project, rsvp polls, market webhook retry)
- **Social/Unified-nav team:** 1F.1–1F.6 (social layout refactor, CI lint, web HamburgerMenu, forums search)

Each team owns file zones per CLAUDE.md. Use Agent Teams mode.

### Phase 4 — Universal Polish (Weeks 8–10)
- 2A.1–2A.6 first (loading states, empty states, error toasts apply everywhere)
- 2B.* in parallel per-module team
- 2C.* as time allows

### Phase 5 — Feature Completeness (Weeks 11+)
- P3 items
- Each becomes its own feature spec under `.kiro/specs/`

---

## Acceptance Criteria

- All P0 resolved, verified manually on mobile + web
- `pnpm check:parity` green
- Mobile test count ≥ 118, web ≥ 306 (no regression)
- New CI lint: zero modules with inline `tabBarStyle` or `headerStyle`
- memory.md Known Tech Debt section reduced by at least 50%
- Each team produces session log under `docs/sessions/` per CLAUDE.md rules

---

## Risks & Watch-Items

1. **Parallel edits on `ModuleLayoutWrapper`** — one team centralizing social refactor could conflict with another adding FAB config. Serialize via Agent Team lead.
2. **Migration contiguity fix (1G.2)** — if we discover existing gaps in deployed data, we may need a repair migration before enforcing the check.
3. **Drug database (1A.9)** — requires external data source decision (OpenFDA? RxNorm?). Adds P1 scope.
4. **expo-location / expo-keep-awake (1D.3)** — native packages; EAS build exposure. Test on TestFlight first.
5. **MySubs removal (2B.23)** — budget already owns subscription logic but user flows may deep-link to `/subs/*`. Add redirects first.
6. **Open Brain MCP disconnected** — session memory rule says all captures use context `"personal, mylife"`. Reconnect before starting Phase 1 to avoid losing cross-device session context.

---

## Open Questions

1. Do we want the social module merged back into a single hub tab, or keep as a separate top-level route? (Currently `(social)/_layout.tsx` is the one unrefactored layout — intentional?)
2. Quizlet competitor closure (FLASH-07 through FLASH-13): still a priority given Flash isn't in GA tier? Delay or accelerate?
3. MySubs retirement: is there a committed deprecation date, or does it live in limbo indefinitely?
4. @mylife/errors new package: does it belong in `packages/` or as part of `@mylife/ui`?

---

## References

- `memory.md` — Project state, known tech debt, session history
- `.kiro/specs/unified-module-navigation/{requirements,tasks}.md` — Just-shipped refactor
- `.kiro/specs/production-release-readiness/` — Phases 1–4 DONE
- `packages/module-registry/src/{release-states,constants}.ts` — Source of truth for IDs + metadata
- `docs/sessions/2026-04-07-mission-control-completion-review.md` — Latest mission-control reconciliation
