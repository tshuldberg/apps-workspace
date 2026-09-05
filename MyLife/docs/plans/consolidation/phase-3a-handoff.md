---
status: ACTIVE
date: 2026-04-20
phase: 3a
parent: docs/plans/consolidation/README.md
predecessor: docs/plans/consolidation/phase-2-anchor-handoff.md
---

# Phase 3a Handoff — Today Surface Aggregator + Mobile/Web UI Shell

**Context for a fresh agent:** The Phase 2 anchor commits shipped on 2026-04-20 (`80f270296`, `209968634`, `4ad9eb364`). Seven modules (health, journal, homes, budget, rsvp, trails, books) now implement `getTodayCards(db, ctx): TodayCard[]`. `TodayCard` + `TodayCardContext` live in `@mylife/module-registry`. Nothing yet consumes these contributions — the hub's home screen is still a module grid.

This session wires the producers into a **ranked Today view** on mobile + web, delivering the master strategy's flagship experience outcome.

## Scope for this session

Four tracks, parallelizable:

### Track A — Aggregator + ranker in `@mylife/module-registry`

New function in `packages/module-registry/src/dashboard.ts`:

```ts
export interface AggregateTodayCardsOptions {
  now: Date;
  primaryClusters?: string[];
  dismissedIds?: Set<string>;        // read from hub_preferences['today.dismissed.<cardId>']
  maxCards?: number;                  // default 7 visible
}

export function aggregateTodayCards(
  db: unknown,
  enabledModules: readonly ModuleDefinition[],
  options: AggregateTodayCardsOptions,
): TodayCard[];
```

Algorithm:
1. For each enabled module whose `crossModule?.getTodayCards` is defined, call it with `{ now, primaryClusters }`. Catch errors per-module (log + skip the module so one broken module doesn't blank the whole surface).
2. Concatenate all cards.
3. Filter out cards whose `expiresAt <= now` or whose `id` is in `dismissedIds`.
4. Apply cluster-weighted priority adjustment: `+15` for cards whose `moduleId` is in the user's `primaryClusters` mapping. Define the cluster→module map inline (the seven clusters from the strategy).
5. Sort by adjusted priority desc, stable.
6. Take top `maxCards` (default 7).
7. Return.

Plus a convenience:

```ts
export function getDismissedCardIds(db: unknown, now: Date): Set<string>;
```

Reads `hub_preferences` rows with key prefix `today.dismissed.`, returns the set of ids whose dismissal is still within today's UTC date window (today's dismissals expire at midnight).

Plus:

```ts
export function dismissCardToday(db: unknown, cardId: string, now: Date): void;
```

Writes `hub_preferences['today.dismissed.<cardId>'] = now.toISOString()`.

Unit tests: empty enabled-modules list returns `[]`; seven-module fixture with 3 cards each returns top-7 by priority; dismissed id filtered; expiresAt in past filtered; cluster-weight correctly boosts matching modules; module whose getTodayCards throws is skipped + other modules still surface.

### Track B — Mobile Today surface

Replace the content of `apps/mobile/app/(hub)/index.tsx` with a Today view that:

1. Reads enabled modules from the ModuleRegistryProvider.
2. Reads `hub_preferences['today.primary_clusters']` (may be null) to determine user's primary clusters. Fall back to all 7 clusters if unset.
3. Calls `aggregateTodayCards(db, enabledModules, { now, primaryClusters, dismissedIds })` in an effect.
4. Renders a ranked card list with three sections: "Your day" (cards with `kind: 'action' | 'reminder' | 'event'`), "This week" (cards with `kind: 'progress' | 'insight'`), and a "Quick" row of cluster-appropriate add actions.
5. Each card has title, subtitle, dismissible swipe-to-dismiss or tap-to-dismiss gesture (call `dismissCardToday`).
6. Tapping a card with a `cta` navigates to `cta.route`.

Preserve the existing module grid by moving it to `apps/mobile/app/(hub)/all.tsx`. Update the tab layout if needed.

Keep the visual treatment aligned with the Cool Obsidian design tokens from `@mylife/ui`. Use existing `GlassCard` patterns for the cards (see `modules/books` UIUX for reference).

### Track C — Web Today surface

Mirror Track B for Next.js:

1. Replace `apps/web/app/page.tsx` with a Today view that renders the same three sections.
2. Aggregate via a server action (`apps/web/app/actions.ts` — add `fetchTodayCards()` that wraps `aggregateTodayCards`).
3. Dismissal action: `dismissTodayCardAction(cardId)` calls `dismissCardToday` and revalidates.
4. Move the old module-grid dashboard to `apps/web/app/all/page.tsx`.
5. Use the web design tokens.

### Track D — Per-cluster Quick Actions

Add a small `QuickActions` component (mobile + web) that renders 3-5 CTA buttons based on the user's primary clusters. Cluster → actions map defined inline. Example:

- Body cluster → `[+ Mood, + Weight, + Meal, + Med, + Workout]`
- Mind cluster → `[+ Note, + Voice, + Journal]`
- Home cluster → `[+ Maintenance, + Receipt, + Chore]`
- Money cluster → `[+ Expense, + Income, + Sub]`
- Social cluster → `[+ Event, + RSVP]`
- Outdoor cluster → `[+ Hike, + Surf session, + Sky check]`
- Knowledge cluster → `[+ Note, + Word, + Card review, + Book]`

Each button routes to the module's "new" screen. If that route doesn't exist, omit the button (don't link to 404s).

## Files the team will touch

### Track A (aggregator)
- `packages/module-registry/src/dashboard.ts` — add `aggregateTodayCards` + dismissal helpers
- `packages/module-registry/src/index.ts` — re-export
- `packages/module-registry/src/__tests__/aggregate-today-cards.test.ts` — new

### Track B (mobile)
- `apps/mobile/app/(hub)/index.tsx` — replace with Today view
- `apps/mobile/app/(hub)/all.tsx` — new, relocates the old module grid
- `apps/mobile/app/(hub)/_layout.tsx` — add tab entry if grid relocates (check existing layout)
- `apps/mobile/components/today/` — new dir with `TodayCard.tsx`, `TodaySection.tsx`, `QuickActions.tsx`
- `apps/mobile/app/(hub)/__tests__/today.test.tsx` — smoke test

### Track C (web)
- `apps/web/app/page.tsx` — replace with Today view (server component)
- `apps/web/app/all/page.tsx` — new, relocates the module grid
- `apps/web/app/actions.ts` — add `fetchTodayCards` + `dismissTodayCardAction`
- `apps/web/components/today/` — `TodayCard.tsx`, `TodaySection.tsx`, `QuickActions.tsx`
- `apps/web/app/__tests__/today.test.tsx` — smoke test

### Track D (quick actions)
- Handled within Tracks B + C; both reference a shared cluster→actions map. Put the map in `packages/module-registry/src/today-quick-actions.ts` so mobile + web share the source.

## Acceptance

### Track A
- `aggregateTodayCards` returns top-N cards sorted by adjusted priority
- Per-module errors are caught (one broken module does NOT blank the surface)
- `getDismissedCardIds` / `dismissCardToday` correctly round-trip via `hub_preferences`
- Cluster weight adds exactly +15 to matching modules
- Expired cards filtered
- ~8-10 unit tests

### Tracks B + C
- Today tab/page renders without errors with zero enabled modules (empty state)
- Today renders correctly with all 7 anchors enabled (seeded test DB)
- Dismiss gesture removes card for the rest of today
- `/all` shows the old grid unchanged
- Smoke test per platform
- Tokens from `@mylife/ui` used consistently

### Track D
- `today-quick-actions.ts` defines a typed `CLUSTER_QUICK_ACTIONS` map
- Actions routing to nonexistent screens are filtered at render time

### Package level
- `pnpm --filter @mylife/module-registry test` green
- `pnpm --filter @mylife/mobile test` green (smoke test added)
- `pnpm --filter @mylife/web test` green
- `pnpm typecheck` clean
- All 6 parity gates pass

## Agent team composition

| Role | Agent | Task |
|------|-------|------|
| Track A — aggregator | module-dev | Build `aggregateTodayCards`, dismissal helpers, 8-10 unit tests. Blocks Tracks B/C on type surface. |
| Track B — mobile Today | hub-shell-dev | New Today UI, QuickActions, relocate grid to /all. Use existing design tokens. |
| Track C — web Today | hub-shell-dev | Same for Next.js. Server action wrap. |
| Track D — quick-actions map | (folded into A) | Define `CLUSTER_QUICK_ACTIONS` in module-registry so B/C share source. |
| Review | feature-dev:code-reviewer | Focus: ranker correctness, per-module error isolation, SQL safety in dismissal, empty-state renders, CTA route-existence checks. |
| Parity | parity-checker | All gates + per-package test counts. |

**Run order:** Track A + Track D map in parallel first (small, mechanical). When Track A's types land, start Tracks B + C in parallel. Review + parity + commit + push at the end.

## Constraints

- Do NOT add new database tables. `hub_preferences` is the only storage.
- Do NOT modify any module's `cross-module.ts` in this session.
- Keep ranker pure — no side effects inside `aggregateTodayCards` (dismissal happens via a separate helper the UI calls).
- Empty states must render without errors (no enabled modules, no cards returned, db empty).
- Tests that seed data must use `createHubTestDatabase` or equivalent.
- Preserve the Cool Obsidian design language from `@mylife/ui`.
- `--no-verify` permitted per established precedent.

## Commit boundary (target)

Four commits:

1. `feat(module-registry): aggregateTodayCards + dismissal helpers + quick-actions map`
2. `feat(mobile): unified Today surface + module grid relocated to /all`
3. `feat(web): unified Today surface + module grid relocated to /all`
4. `docs(consolidation): Phase 3a session log + memory`

## What Phase 3a does NOT include

- Onboarding flow (Phase 3b — cluster picker writes to `hub_preferences['today.primary_clusters']`)
- AI chat / insights integration (Phase 4)
- Automation rules (Phase 5-core)
- Broader Phase 2b contracts for 23 non-anchor modules
- Reader migrations for the 3 Wave A modules (already shipped in Phase 2 session)

## Quick cold-start context

1. `docs/plans/consolidation/README.md` — strategy
2. `docs/plans/consolidation/03-unified-today-surface.md` — UX spec (ranking algorithm + card sections + cluster actions)
3. `docs/plans/consolidation/phase-review-report.md` — why this phase is the priority
4. This file — scope + acceptance
5. `packages/module-registry/src/cross-module-types.ts` — `TodayCard` + `TodayCardContext`
6. `modules/health/src/cross-module.ts` or any of the 7 anchors — example contributor
7. `apps/mobile/app/(hub)/index.tsx` — current hub home (to replace)
8. `apps/web/app/page.tsx` — current web home (to replace)

Then execute the acceptance criteria. Ship.
