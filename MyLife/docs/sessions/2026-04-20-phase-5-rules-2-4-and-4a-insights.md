# 2026-04-20 — Phase 5-core Rules 2-4 + Phase 4a Insights Scaffold

Four parallel tracks in one session, all landed cleanly.

## Team run

| Track | Agent | Verdict |
|-------|-------|---------|
| 1 — recipe-to-nutrition rule | module-dev | 8 tests, recipes 289/289 (was 281) |
| 2 — mail-ics-to-events rule | module-dev | 13 tests (5 parser + 8 rule), mail 247/247 (was 234) |
| 3 — highlight-to-flash rule | module-dev | 12 tests, books 430/430 |
| 4 — Phase 4a Insights scaffold | hub-shell-dev | 4 tests (2 per platform), mobile 162/162 (was 160), web 349/353 (was 347) |

All four file-disjoint; no merge conflicts. Registration side-effect in `apps/mobile/lib/automations-setup.ts` merged cleanly across Tracks 1, 2, 3.

## Commits shipped (6)

1. `feat(recipes): recipe-to-nutrition automation rule`
2. `feat(mail): mail-ics-to-events automation rule`
3. `feat(books): highlight-to-flash automation rule`
4. `feat(mobile): register Phase 5-core rules 2-4 in automations-setup`
5. `feat(insights): Phase 4a correlation + trends + discoveries panels`
6. `docs(consolidation): session log` (this file)

## Schema surprises resolved by the agents

### Track 1 (recipes)
- Pantry table is `rc_pantry_items`, not `rc_pantry`
- Per-serving macros computed at runtime by `calculateRecipeNutrition()` joining `rc_nutrition_data` (keyed to `pantry_item_id`) with `rc_ingredients` via `fuzzyItemMatch` — no `calories_per_serving` column
- `nu_food_log` is a parent row; macros live on `nu_food_log_items` children. Rule writes one parent + placeholder `nu_foods` row + N items per cooked recipe
- Cross-module test couldn't import `@mylife/nutrition` source (tsc `rootDir` per-package); test file inlines the 3 nu_* CREATE TABLE statements

### Track 2 (mail)
- ICS parser is ~105 lines, handles CRLF/LF line endings, RFC 5545 line unfolding, escape sequences (\n \, \; \\), three date shapes (UTC Z, naive UTC, VALUE=DATE all-day)
- TZID and RRULE deferred for now

### Track 3 (books)
- `fl_cards.note_id` is NOT NULL — used the card id as a stable per-card note
- Cross-module test uses `createHubTestDatabase` + `runModuleMigrations(..., 'books', ...)` + `runModuleMigrations(..., 'flash', ...)`; missing-flash-tables test skips the flash migration
- Dedup happens by deck name match (`"<bookTitle> — highlights"`), no schema changes

### Track 4 (insights)
- Real engine API is per-module, not per-metric as the handoff guessed:
  - `queryCorrelation(db, modules, moduleAId, moduleBId)` returns all pairwise metric correlations between two modules
  - `queryTrends(db, modules, moduleId, metric, days)` single series
  - `discoverInsights(db, modules)` returns `InsightCard[]`
  - `getPermittedModules(db)` gates on `hub_ai_permissions.can_read=1`
- Inline SVG for both platforms; no new chart lib
- Mobile smoke test did NOT need to land in the vitest exclude list (the six-file hang didn't trigger for this import graph)

## What this unblocks

- **Phase 5-core fully shipped.** All 4 originally planned rules (receipt-to-budget, recipe-to-nutrition, mail-ics-to-events, highlight-to-flash) are wired end-to-end on mobile. Users opt in per rule from Settings > Automations; preview-before-apply pattern mandatory; audit log on every apply/dismiss.
- **Phase 4a Insights live.** First AI-adjacent UI surface. Users with `hub_ai_permissions.can_read=1` see pairwise correlations, trends, and engine-discovered insights. Phase 4b layers LLM chat + tool-gated SQL on top of this foundation.

## Known tech debt

- Pre-existing: `modules/classes/src/db/crud.ts` line 115 has a type-narrowing error from untracked work. Out of scope this session.
- Pre-existing: mobile "six-file hang" vitest issue (see `vitest.config.ts` exclude list) continues — some test files transitively import an unmocked module and deadlock. Track 4's insights test didn't hit it, but the root cause remains unfixed.
- Future: register Phase 5-core rules 2-4 on the web side as well. Current session only registered on mobile (handoff said I'd do web inline but the session is now closing on the 6-commit boundary).

## Verification

- `pnpm typecheck` root: 97/97 cached + 1 fresh = 98/98 clean
- `pnpm --filter @mylife/recipes test` → 289/289
- `pnpm --filter @mylife/mail test` → 247/247
- `pnpm --filter @mylife/books test` → 430/430
- `pnpm --filter @mylife/mobile test` → 162/162
- `pnpm --filter @mylife/web test` → 349/353 (+4 pre-existing skipped)

## Recommended next session

- Register the three new rules on web (`ensureAutomationRulesRegistered()` in `apps/web/app/actions.ts`)
- Phase 4b: LLM chat + tool-gated SQL. Start local-first (Apple Foundation Models on iOS 26+, ExecuTorch on Android / iOS 17-25) per `docs/plans/consolidation/05-ai-agent-layer.md`
- Fix the mobile six-file hang in vitest infra
