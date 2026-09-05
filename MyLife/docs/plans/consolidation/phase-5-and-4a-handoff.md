---
status: ACTIVE
date: 2026-04-20
tracks: phase-5-core-rules-2-3-4 + phase-4a-insights-scaffold
parent: docs/plans/consolidation/README.md
predecessor: docs/plans/consolidation/phase-5-core-handoff.md
---

# Phase 5-core Rules 2-4 + Phase 4a Insights Scaffold

**Context:** Phase 5-core shipped the receipt-to-budget rule + `@mylife/automations` engine + Settings UI + preview sheet/card on both platforms (commits `074032583`, `219f02a07`, `dd03704bc`, `c35a17cf5`). The engine pattern is proven. This session ships three more rules on the same pattern plus the Phase 4 Insights screen scaffolding — four fully independent parallel tracks.

## Track 1 — Recipe → Nutrition rule

File-only. No UI changes needed. The receipt-to-budget preview sheet/card pattern handles any rule whose `previewCard()` output is a title + subtitle + apply/dismiss.

**Scope:** when user marks a recipe as cooked, offer to auto-log the meal into nutrition + decrement pantry ingredients.

**Files:**
- `modules/recipes/src/automations/recipe-to-nutrition.ts` — the rule definition (mirrors `modules/budget/src/automations/receipt-to-budget.ts` structure)
- `modules/recipes/src/automations/__tests__/recipe-to-nutrition.test.ts` — integration tests
- `modules/recipes/src/index.ts` — re-export the rule
- `modules/recipes/package.json` — add `@mylife/automations: workspace:*` as workspace dep

**Trigger input:**
```ts
interface RecipeCookedInput {
  recipeId: string;
  servingsCooked: number;
  cookedAt: string; // ISO
}
```

**Check:** return `null` if recipe doesn't exist OR has no linked nutrition data yet (recipes module tracks this per-recipe). Otherwise return preview state with:
- Ingredient list + quantities to decrement from `rc_pantry`
- Macro totals (calories, protein, carbs, fat) from the recipe's nutrition estimate, scaled by `servingsCooked`

**Preview card:** title `"Log this meal?"`, subtitle `"<N> calories, <P>g protein. Decrements X pantry items."`

**Apply (atomic, single `db.transaction`):**
1. INSERT a `nu_food_log` row for each unique ingredient with per-serving macros × servingsCooked
2. UPDATE `rc_pantry` rows: decrement quantity by recipe-per-serving × servingsCooked; rows going to zero stay (don't delete)
3. INSERT `hub_automation_log` row outcome='applied'

If the nutrition module or pantry table doesn't exist on fresh install, `tableExists` guards return null from check (consistent with budget rule).

**Register** in `apps/mobile/lib/automations-setup.ts` and `apps/web/app/actions.ts`'s `ensureAutomationRulesRegistered()` by adding `registerRule(recipeToNutritionRule)` alongside the receipt rule. Guard with try/catch so "already registered" from HMR is tolerated.

**Acceptance:**
- ≥6 integration tests (happy path, missing nutrition data returns null, pantry decrement correct, rollback on error, missing tables handled, previewCard text format)
- `pnpm --filter @mylife/recipes test` green
- `pnpm typecheck` clean

---

## Track 2 — Mail ICS → hub_events rule

Trigger: user receives or forwards an email with a `.ics` calendar attachment. When the mail module parses the attachment, offer to create a `hub_events` row.

**Files:**
- `modules/mail/src/automations/mail-ics-to-events.ts`
- `modules/mail/src/automations/__tests__/mail-ics-to-events.test.ts`
- `modules/mail/src/index.ts` — re-export
- `modules/mail/package.json` — add `@mylife/automations` dep

**Trigger input:**
```ts
interface MailIcsInput {
  icsText: string;        // raw VCALENDAR body
  sourceMessageId: string; // ml_messages.id for provenance
}
```

**Check:** parse `icsText` with a minimal hand-rolled VEVENT parser (no new deps). Extract `SUMMARY`, `DTSTART`, `DTEND`, `LOCATION`, `DESCRIPTION`. Return null if no VEVENT block or if DTSTART is malformed. Otherwise return preview state with the parsed fields + formatted human dates.

**Preview card:** title `"Add event: <SUMMARY>?"`, subtitle `"<start formatted> · <location or 'No location'>"`.

**Apply (atomic):**
1. INSERT `hub_events` row (title, starts_at, ends_at, kind='appointment', module_id='mail', entity_ref=sourceMessageId, place_id=null for v1)
2. INSERT `hub_automation_log` outcome='applied'

For v1, skip creating a `hub_places` row from the LOCATION string (geocoding is out of scope). Just store the location in the event's `title` or add a column-less notes field if one exists.

**Acceptance:**
- ≥7 tests (valid single-event ICS, missing SUMMARY handled, malformed DTSTART returns null, multi-VEVENT parses first event, DTEND defaults to DTSTART+1h if absent, all-day event handling, rollback)
- `pnpm --filter @mylife/mail test` green
- Register in mobile + web automation setup

---

## Track 3 — Book highlight → Flash card rule

Trigger: user adds a highlight in the books module (or imports one from Kindle / CSV). Offer to turn it into a flash card deck entry.

**Files:**
- `modules/books/src/automations/highlight-to-flash.ts`
- `modules/books/src/automations/__tests__/highlight-to-flash.test.ts`
- `modules/books/src/index.ts` — re-export
- `modules/books/package.json` — `@mylife/automations` dep (may already be present from receipt rule; verify)

**Trigger input:**
```ts
interface HighlightToFlashInput {
  bookId: string;
  highlightText: string;
  pageOrLocation?: string;
}
```

**Check:** validate `highlightText` is 10-1000 chars (shorter is likely accidental, longer is a passage not a card). Return null if book doesn't exist. Otherwise preview state contains:
- Suggested deckId: look up or propose a deck named `"<Book title> — highlights"` for this book
- Card front/back: front = first sentence of the highlight (≤120 chars) + book title; back = full highlightText + page ref

**Preview card:** title `"Make flashcard from highlight?"`, subtitle `<front preview truncated to 60 chars>`.

**Apply (atomic):**
1. getOrCreate deck in `fl_decks` keyed by `(book_id=bookId)` (add a `source_book_id` column if it doesn't exist — check schema; if column missing, skip the dedup and always create a fresh deck). If adding a column, do it in the rule's tests via a schema-v? migration. For v1, simpler: just look up decks by name; create if absent.
2. INSERT `fl_cards` row with front/back/deckId
3. INSERT `hub_automation_log` outcome='applied'

**Acceptance:**
- ≥6 tests (creates deck first time, reuses existing deck for same book, rejects empty/too-long highlight, rollback, front truncation, previewCard format)
- `pnpm --filter @mylife/books test` green
- Register in mobile + web automation setup

---

## Track 4 — Phase 4a Insights screen (scaffold only)

Scope deliberately narrow: ship the first AI-adjacent UI surface using the already-built `@mylife/intelligence` engine. NO LLM chat, NO tool calling, NO local model wiring. That's Phase 4b+.

**What ships:** a new screen at `/insights` on mobile + web that renders the output of `engine.queryCorrelation()`, `engine.queryTrends()`, and `engine.discoverInsights()`. Three tabs or sections:

1. **Correlations** — picker for metric A × metric B from an allowlist (e.g., "mood_score", "sleep_hours", "steps", "weight") scoped to enabled modules only. Calls `queryCorrelation(db, seriesA, seriesB)`; shows the Pearson coefficient, direction, strength label, and a simple scatterplot (mobile) or bar chart (web — use inline SVG, no new chart lib).
2. **Trends** — single-metric picker; calls `queryTrends(db, metric, { window: 'last_30_days' })`; shows the values as a sparkline.
3. **Discoveries** — calls `engine.discoverInsights(db)`; renders each insight as a card with title + body text. No interactions; this is read-only.

Gate the whole screen with a "Requires opt-in" banner if `hub_ai_permissions` has no row with `can_read=1` for the current user. Per Phase 0+1, user_id defaults to `'local'`. Banner CTA goes to `/settings/ai` which may not exist yet — if missing, route to `/settings/automations` as a placeholder.

**Files:**
- `apps/mobile/app/(hub)/insights/index.tsx` — root of the insights stack (or `(hub)/insights.tsx` if hub prefers flat routes; check existing layout)
- `apps/mobile/app/(hub)/insights/_layout.tsx` — optional; include only if you create sub-tabs
- `apps/mobile/components/insights/` — CorrelationPanel.tsx, TrendsPanel.tsx, DiscoveriesPanel.tsx
- `apps/web/app/insights/page.tsx` — server component
- `apps/web/app/insights/CorrelationPanel.tsx` (client), similar for trends + discoveries
- `apps/web/app/actions.ts` — add `fetchInsightsAction()`, `fetchCorrelationAction(seriesA, seriesB)`, `fetchTrendsAction(metric)`

**Per-platform smoke tests**: one test each that the screen renders empty state (no AI permission → banner shown) and one that renders a seeded correlation result.

**Acceptance:**
- Both platforms typecheck clean
- Mobile test suite stays ≥160
- Web test suite stays ≥347 + the two new tests (so ≥349)
- Screen reachable from a nav entry (add to the existing hub settings page or Today surface as a small link — put it somewhere)
- No LLM chat, no tool calling — flag explicitly in commit body

---

## Agent team composition

| Role | Agent | Track |
|------|-------|-------|
| Impl 1 | module-dev | Recipe → nutrition rule |
| Impl 2 | module-dev | Mail ICS → events rule |
| Impl 3 | module-dev | Book highlight → flash rule |
| Impl 4 | hub-shell-dev | Phase 4a Insights screen scaffold (mobile + web) |
| Registration glue (inline after impl 1-3 land) | none (I'll do) | Add `registerRule()` calls to `apps/mobile/lib/automations-setup.ts` and `apps/web/app/actions.ts` `ensureAutomationRulesRegistered()` |
| Review | feature-dev:code-reviewer | Diff review: atomicity, silent-failure hunt, per-rule idempotence, insights screen renders empty state without crashing |
| Parity + ship | parity-checker + inline | All gates + 5-6 per-concern commits + push |

All four impl tracks run fully in parallel — file-disjoint.

## Constraints

- **All rules ship off by default** (`hub_automation_rules.enabled = 0`). Users enable from Settings > Automations.
- Preview-before-apply pattern is mandatory. No silent automation.
- Every `apply()` wraps writes in `db.transaction()`. Rollback on any sub-write failure.
- Loud failure: no try/catch swallowing real SQL errors.
- Phase 4a: NO LLM. NO tool calling. Just render engine output that already exists.
- No new npm deps. If chart rendering needs lib, use inline SVG instead.
- `--no-verify` permitted on commits per established precedent.

## Commit boundary (target)

6 commits:
1. `feat(recipes): recipe-to-nutrition automation rule`
2. `feat(mail): mail-ics-to-events automation rule`
3. `feat(books): highlight-to-flash automation rule`
4. `feat(mobile,web): register Phase 5-core rules 2-4 on both platforms` (may fold into commits 1-3 if agents add registration themselves)
5. `feat(insights): Phase 4a correlation + trends + discoveries panels (mobile + web)`
6. `docs(consolidation): Phase 5-core rules 2-4 + Phase 4a session log`

## Cold-start reading

1. `docs/plans/consolidation/README.md`
2. `docs/plans/consolidation/phase-5-core-handoff.md`
3. `docs/plans/consolidation/phase-3a-today-surface.md`
4. `modules/budget/src/automations/receipt-to-budget.ts` — template for rules
5. `packages/intelligence/src/` — existing engine functions for Phase 4a
6. This file
