# TODOS

Active work items tracked from reviews and planning sessions. Each TODO has context so anyone picking it up in 3 months understands the motivation and where to start.

## Document Ecosystem (how it all connects)

These documents form a system. Keep them in sync as work progresses.

```
BUSINESS-PLAN-MyLife-2026.md        ← Strategic vision, financials, GTM
     │
     ├── COMPETITIVE-MATRIX.md      ← 267 built + 217 needed features (THE living tracker)
     │        │                        Goal: 0 features remaining
     │        ▼
     │   feature-scoring-framework.md  ← How to rank the 217 features
     │        │
     │        ▼
     │   scored-feature-backlog.md     ← Ranked list (TODO: create by scoring all 217)
     │        │
     │        ▼
     │   feature-execution-pipeline.md ← Score → Spec → Build → QA → Ship process
     │        │
     │        ▼
     │   docs/plans/features/          ← Individual agent specs per feature
     │
     ├── launch-module-tiers.md     ← 17 Launch / 7 Beta / 5 Hidden
     │
     ├── full-product-strategic-review.md ← CEO review decisions
     │
     └── DECK-MyLife-2026.md        ← Investor pitch deck

DESIGN.md                           ← Cool Obsidian design system bible
TODOS.md (this file)                ← Active work items with full context
memory.md                           ← Session log
```

**The North Star:** COMPETITIVE-MATRIX.md tracks every feature across every module. When all 217 "Features Needed" checkboxes are checked, we have full competitive parity. Every sprint moves features from "needed" to "built." This document is never "done" until the checkboxes are all filled.

## P0 -- Pre-Launch Blockers

### Implement SQLite backup mechanism
**What:** Automatic daily local backup of the .sqlite file + one-tap manual backup + optional encrypted backup to iCloud/local storage.
**Why:** If the single SQLite file corrupts, ALL user data across ALL modules is permanently lost. For a privacy-first app that stores everything locally, this is existential. No cloud backup means no recovery.
**Where to start:** `packages/db/` -- add backup module that copies the .sqlite file to a timestamped backup directory. Mobile: use expo-file-system. Web: use File System API.
**Effort:** M (human: 3 days / CC: 30 min)
**Depends on:** Nothing.

## P1 -- Launch Sprint

### Rebrand exploration
**What:** "MyLife" undersells the product vision. Explore 5-10 candidate names that convey sovereignty, power, privacy, and comprehensiveness. Check domain availability, App Store naming conflicts, and trademark viability for each candidate. Produce a shortlist with rationale.
**Why:** Name blocks ALL downstream work: App Store listing, domain, marketing materials, investor pitch, social accounts. Every day this is unresolved, artifacts are built on a name that may change.
**Where to start:** Brainstorm names around themes: personal data sovereignty, anti-enshittification, unified personal OS. Check domains via registrar. Check App Store for conflicts. Present top 5 with pros/cons.
**Effort:** M (human: 3 days / CC: 1 hour)
**Depends on:** Nothing. Start immediately alongside P0 bug fixes.

### Draft Anti-Enshittification Pledge + User Bill of Rights
**What:** Formalize the product philosophy as a legal + product document. Covers: no ads ever, no data selling ever, user data ownership, free speech with opt-in content filters, data export always available, delete-all-my-data button. Design the onboarding screen that presents this pledge.
**Why:** This is the core product differentiator. Not marketing copy -- a binding commitment that builds trust. The enshittificator transcript is the manifesto for what we're fighting against.
**Where to start:** Draft the pledge document. Review with legal counsel for enforceability. Design the onboarding screen. Add "Privacy Dashboard" to Settings showing pledge compliance in real-time.
**Effort:** M (human: 3 days / CC: 1 hour for draft, legal review is human-only)
**Depends on:** Nothing.

### Document pricing strategy alternatives
**What:** Analyze 3-4 pricing strategies and document pros/cons in the business plan. Default stays $5/yr. Alternatives: $12-24/yr, freemium + per-module-cluster pricing, lifetime + annual hybrid. Model each against user psychology, unit economics, and competitor positioning.
**Why:** Investors will ask "why $5?" -- the business plan needs structured analysis showing alternatives were considered and $5/yr was chosen deliberately as a market-disruption weapon, not a guess.
**Where to start:** Add a "Pricing Strategy Analysis" section to `docs/business-plan/BUSINESS-PLAN-MyLife-2026.md`. Model each alternative with revenue projections.
**Effort:** M (human: 2 days / CC: 45 min)
**Depends on:** Nothing.

### Add crossModule interface to ModuleDefinition
**What:** Extend the ModuleDefinition type in `packages/module-registry/src/types.ts` with an optional `crossModule` interface: `getSearchableContent()`, `getDataSummary()`, `getActivityFeed()`, `getCorrelationData()`. Implement for 3-5 modules as proof of concept.
**Why:** This is the foundation that packages/search, packages/intelligence, and packages/engagement all depend on. Without it, cross-module features can't query module data cleanly.
**Where to start:** `packages/module-registry/src/types.ts` -- add the interface. Then implement in books, budget, and meds modules as proof of concept.
**Effort:** M (human: 3 days / CC: 30 min)
**Depends on:** Nothing. Enables all P2 cross-module packages.

### Score all 217 features using the scoring framework
**What:** Apply the 5-factor scoring formula from `docs/designs/feature-scoring-framework.md` to every feature in `docs/business-plan/COMPETITIVE-MATRIX.md`. Produces a ranked backlog with S/A/B/C/D tiers.
**Why:** Without scored features, agents don't know what to build first. This is the single highest-leverage TODO -- it unlocks all sprint planning.
**Where to start:** Read `COMPETITIVE-MATRIX.md` feature-by-feature, score each using the framework, output a sorted list.
**Effort:** L (human: 1 week / CC: 2 hours)
**Depends on:** Feature scoring framework (DONE -- `docs/designs/feature-scoring-framework.md`)

### Write 3-5 sample agent feature specs
**What:** Use the agent feature spec template (`docs/plans/templates/agent-feature-spec-template.md`) to write real specs for the highest-priority features: rest timer (workouts), HealthKit integration (health), calendar sync (RSVP), reports dashboard (budget), and offline maps (trails).
**Why:** Validates the template works in practice and produces ready-to-execute specs for S-Tier features. Also serves as examples for agents writing future specs.
**Where to start:** Score the features first (above TODO), pick the top 5, write specs using the template.
**Effort:** M (human: 2 days / CC: 45 min)
**Depends on:** Feature scoring (above)

### Build real web UI for 5 Launch-tier modules
**What:** Replace ModuleWebFallback stubs with functional web pages for Budget, Workouts, Recipes, RSVP, and Surf.
**Why:** Launch tier requires functional web UI. Currently these 5 modules show "coming soon" fallback pages on web.
**Where to start:** Follow the pattern from existing functional web modules (e.g., `apps/web/app/books/page.tsx`). Each module is an independent task -- can be parallelized across 5 agents.
**Effort per module:** M (human: 3 days / CC: 30 min each)
**Priority order:** Budget > Workouts > Recipes > RSVP > Surf
**Depends on:** Nothing. Each module is independent.

### Extract Pearson correlation engine to packages/intelligence
**What:** Move the correlation engine from `modules/meds/src/analytics/correlation.ts` to a shared `packages/intelligence/src/analytics/correlation.ts`. Update meds to import from the shared package.
**Why:** Cross-module intelligence engine needs this correlation engine. Currently locked inside the meds module. DRY: one source of truth.
**Where to start:** Create `packages/intelligence/` package following existing package patterns. Move correlation.ts and its tests. Update meds imports.
**Effort:** S (human: 4 hours / CC: 15 min)
**Depends on:** Nothing.

### Implement biometric human verification for social features
**What:** Face ID / Touch ID gate for Forums posting and Market listings. Uses LAContext (iOS) and BiometricPrompt (Android). App receives only a boolean -- never biometric data. Web users verify on mobile first or use WebAuthn/Passkeys.
**Why:** Social features need real humans to succeed. Bot accounts destroy communities and marketplaces. Biometric verification is frictionless (users already use it 100x/day), private (we get a boolean, not a face scan), and hard to bot at scale.
**Where to start:** Create `hub_human_verification` table. Implement LAContext call on iOS, BiometricPrompt on Android. Gate Forum post/comment and Market create-listing behind verified status. Allow read-only browsing without verification.
**Effort:** M (human: 3 days / CC: 30 min)
**Depends on:** Nothing. Can be built independently.

### Implement social data sharing controls
**What:** Explicit opt-in for any data shared socially. Users select which data is visible. All shared data anonymized. Never sold. Delete button in Settings removes all shared data.
**Why:** Social features need data sharing, but our privacy promise requires user control over what's shared. This is the trust architecture that makes social features work without enshittification.
**Where to start:** `hub_sharing_preferences` table (module_id, data_type, shared boolean). Sharing consent flow during first social action. Settings page for reviewing/revoking. Anonymization layer in packages/social.
**Effort:** M (human: 3 days / CC: 30 min)
**Depends on:** Biometric verification (above)

### Build unified dashboard with personalized cards
**What:** Replace the current hub dashboard with a personalized home screen: greeting + life streak, 4 primary module cards (smart default + drag-to-reorder), quick action row, weekly digest card, "This Day Last Year" card, and remaining module grid.
**Why:** The dashboard is THE home screen. Currently it's a basic launcher. The dashboard needs to make 29 modules feel like ONE app, not 29 apps in a trenchcoat. Users should see their life summarized in one glance.
**Where to start:** `apps/mobile/app/(hub)/index.tsx` and `apps/web/app/page.tsx`. Implement dashboard card components that call module `getDataSummary()`. Add `hub_dashboard_layout` table for card ordering. Skeleton loading states for all cards.
**Effort:** L (human: 1 week / CC: 1 hour)
**Depends on:** crossModule interface (above). Can start layout before interface is ready.

### Build Replace My Apps import wizard
**What:** Unified onboarding flow: "What apps are you replacing?" -> per-competitor import flow. Covers: Goodreads CSV (books), YNAB CSV (budget), MyFitnessPal CSV (nutrition), Day One JSON (journal), and more. Also includes universal data export (all modules, standard formats).
**Why:** Every competitor import reduces switching friction. This is a conversion multiplier. Combined with module selection during onboarding, this creates the "this is MY app" moment.
**Where to start:** `packages/onboarding/src/import/` -- create import adapter registry. Each adapter: detect format, parse, validate, transform, insert, report. Existing patterns: books (Goodreads/StoryGraph CSV), budget (CSV).
**Effort:** L (human: 1 week / CC: 1.5 hours for 5 importers)
**Depends on:** packages/onboarding structure.

### Implement Command Palette (Cmd+K) for web
**What:** Linear/Raycast-style command palette for web. Cmd+K opens a search/action modal. Type to search across modules, navigate to any screen, or trigger quick actions (log mood, start fast, etc.).
**Why:** Central to the chosen web aesthetic (Linear/Raycast/Arc). Primary navigation for power users. How users efficiently navigate 29 modules on desktop.
**Where to start:** `apps/web/components/CommandPalette.tsx`. Uses cross-module search (packages/search). Fuzzy match module names, screen names, recent items.
**Effort:** M (human: 3 days / CC: 30 min)
**Depends on:** packages/search (P2)

### Stars: Fix moon sign computation (prerequisite for UI)
**What:** `getZodiacSign(date)` returns the sun's zodiac position, but is used as `moonSign` in journal.ts:33, lunar.ts:56, solar-return.ts:55, and progressions.ts:82. The Moon changes signs every ~2.5 days vs the Sun's ~30 days. Every astrology user will notice "Why is my Moon in Aries when it should be in Scorpio?"
**Why:** Factual error that destroys credibility. Must fix before building any Stars UI screens.
**Where to start:** Add `getMoonSign(date)` to `modules/stars/src/engine/astro.ts` using ecliptic longitude approximation from the synodic period math already in the codebase (`getMoonPhase` computes the phase angle). Update all 4 engine files to use the new function. Add tests for known moon sign dates.
**Effort:** S (human: 4 hours / CC: 30 min)
**Depends on:** Nothing. Must complete before Stars UI build.
**Source:** /plan-eng-review 2026-03-23, Architecture Issue #1

### Stars: Add FTS5 virtual table for journal search
**What:** Spec claims FTS5 full-text search for journal entries, but `searchJournalEntries()` uses `LIKE '%query%'` and no FTS5 virtual table exists in the schema. Need V3 migration adding FTS5 virtual table + sync triggers + updated CRUD.
**Why:** LIKE search is O(n) and will lag with 100+ journal entries. FTS5 enables sub-100ms search required for real-time filtering UX.
**Where to start:** Add V3 migration to `modules/stars/src/db/schema.ts` creating `st_journal_entries_fts` virtual table. Add insert/update/delete triggers to keep FTS in sync. Update `searchJournalEntries()` in crud.ts to use `MATCH` instead of `LIKE`. Test on both expo-sqlite and better-sqlite3.
**Effort:** S (human: 4 hours / CC: 20 min)
**Depends on:** Nothing.
**Source:** /plan-eng-review 2026-03-23, Codex outside voice finding #3

### Stars: Red banner variant + batch moon calendar cache
**What:** Two small engine fixes: (1) Add 'red' to BannerColor type and condition in `computeRetrogradeBanner()` for 3+ simultaneous retrogrades. (2) Add `cacheMoonCalendarMonth(db, days[])` that wraps 31 inserts in a single SQLite transaction to prevent jank during fast month swiping.
**Why:** Red banner adds visual urgency for rare cosmic events. Batch cache prevents jank when users swipe through months quickly on Moon Calendar.
**Where to start:** `modules/stars/src/engine/retrograde.ts` (add 'red' to type + 3-line condition). `modules/stars/src/db/crud.ts` (add batch insert function wrapping in `BEGIN/COMMIT`).
**Effort:** S (human: 2 hours / CC: 10 min)
**Depends on:** Nothing.
**Source:** /plan-eng-review 2026-03-23, Architecture #2 + Performance #1

### Unify audio recording abstractions across journal and voice
**What:** Journal (`modules/journal/src/voice/`) and Voice (`modules/voice/`) both implement audio recording with different abstractions. Journal defines `RecordingConfig` (AAC, 44.1kHz, 10min max) and a `Transcriber` interface. Voice will build its own for multi-speaker/multi-language recordings. Eventually extract a shared `@mylife/audio` package with common recording config, platform-specific adapters, and shared audio utilities.
**Why:** DRY across modules. When a third module needs audio (e.g., forums voice channels), having a shared abstraction prevents three independent implementations. Not blocking now because journal and voice have fundamentally different requirements (short entries vs. long multi-speaker recordings).
**Where to start:** After voice mobile UI ships, compare both implementations. Extract common patterns into `packages/audio/`. Keep module-specific configs (max duration, speaker detection) in each module.
**Effort:** S (human: 1 day / CC: 20 min)
**Depends on:** Voice mobile UI implementation complete.
**Source:** /plan-eng-review 2026-03-23, Architecture #3

### Voice UI edge case guards (command toggle, speaker merge, default profile deletion)
**What:** Three failure modes identified during eng review that need error handling: (1) command enable/disable toggle can fail silently if DB write errors, (2) speaker merge has no protection against concurrent operations on the same speaker, (3) deleting the default language profile leaves no default selected.
**Why:** Silent failures cause user confusion. Command toggle failing means the user thinks they disabled a command but it's still active. Speaker merge corruption means segments are assigned to a deleted speaker. No-default profile means new recordings use no language detection.
**Where to start:** During voice UI implementation: wrap command toggle in try/catch with error toast, add optimistic locking or serialization to speaker merge, prevent deletion of default profile (force user to set a new default first).
**Effort:** S (human: 2 hours / CC: 15 min)
**Depends on:** Voice mobile UI implementation in progress.
**Source:** /plan-eng-review 2026-03-23, Failure Mode Analysis

## P2 -- Post-Launch

### Extract shared scheduler package from MyCar reminder-engine
**What:** MyCar's `reminder-engine` implements interval-based scheduling (by mileage OR time, with snooze support and auto-linking to completed actions). This exact pattern is needed by Homes (appliance maintenance schedules), Pets (vet appointment reminders), and Meds (refill scheduling). Extract to a shared `@mylife/scheduler` package.
**Why:** DRY across 4+ modules. The reminder-engine is well-tested and production-quality. Rather than each module reimplementing interval scheduling, extract the core logic (configurable interval types, due-date calculation, snooze management, completion linking) to a shared package. Module-specific details (mileage vs. time vs. dosage count) stay in each module.
**Where to start:** `modules/car/src/engines/reminder-engine.ts` and its test file. Create `packages/scheduler/` following existing package patterns. Generalize the interval calculation to accept pluggable interval types. Update MyCar to import from the shared package.
**Effort:** M (human: 3 days / CC: 30 min)
**Depends on:** Nothing. Can be done anytime. Most valuable when Homes or Pets are building their scheduling features.
**Source:** /plan-ceo-review 2026-03-24, Cherry-pick #3

### Split trails crud.ts into domain files
**What:** Split the 80-function 1,775-line `modules/trails/src/db/crud.ts` into domain-specific files: `trail-crud.ts`, `recording-crud.ts`, `packing-crud.ts`, `trip-crud.ts`, `segment-crud.ts`, `review-crud.ts`, `offline-crud.ts`, `route-crud.ts`.
**Why:** Largest single file in any MyLife module. Smaller files are easier to navigate, review, and maintain. No functional change -- barrel export in `index.ts` re-exports everything.
**Where to start:** `modules/trails/src/db/crud.ts` -- group functions by domain, extract to separate files, update `db/index.ts` barrel. All existing tests import from barrel so they won't break.
**Effort:** S (human: 3 hours / CC: 10 min)
**Depends on:** Nothing. Can be done anytime. Recommended before Phase 2 trails UI adds more complexity.

### Build packages/search (cross-module FTS5)
**What:** Unified FTS5 search index across all enabled module tables. Background incremental index. Each module exports `getSearchableContent()` via the crossModule interface.
**Why:** Cross-module search is a core dashboard feature. Users need to search across journal entries, book titles, recipes, notes, etc. from one search bar.
**Where to start:** `packages/search/` -- create package, define hub_search_index table, implement indexer that calls module getSearchableContent().
**Effort:** L (human: 1 week / CC: 1 hour)
**Depends on:** ModuleDefinition crossModule interface addition

### Build packages/onboarding
**What:** First-run flow state machine: welcome, content preferences, module selection, import wizard, AI preferences, dashboard reveal.
**Why:** First impression IS the product. No onboarding = users see a blank dashboard and leave.
**Where to start:** `packages/onboarding/` -- state machine, persistence (resume after force-quit), content preference schema. Then wire into apps/mobile and apps/web.
**Effort:** L (human: 1 week / CC: 1 hour)
**Depends on:** Launch tier classification (DONE)

### Build packages/engagement
**What:** Weekly digest aggregation, life engagement streak, "This Day Last Year" cross-module memory. All opt-in.
**Why:** Retention without manipulation. Celebrates user engagement across modules.
**Where to start:** `packages/engagement/` -- define streak calculation, weekly digest data aggregation, notification scheduling.
**Effort:** M (human: 3 days / CC: 30 min)
**Depends on:** ModuleDefinition crossModule interface (getActivityFeed)

### Build packages/intelligence (AI engine)
**What:** Cross-module query engine with per-module opt-in privacy permissions. On-device statistical analytics as default. Optional user-provided API key for LLM insights.
**Why:** The killer feature that makes 29 modules in one app more valuable than 29 separate apps.
**Where to start:** `packages/intelligence/` -- permission tables (hub_ai_permissions, hub_ai_table_permissions), correlation engine (extracted from meds), on-device analytics.
**Effort:** XL (human: 2 weeks / CC: 3 hours)
**Depends on:** Pearson extraction (P1), ModuleDefinition crossModule interface
