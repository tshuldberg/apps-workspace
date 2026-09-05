---
status: ACTIVE
date: 2026-04-20
phase: 3b + barrel-splits
parent: docs/plans/consolidation/README.md
predecessor: docs/plans/consolidation/phase-3a-today-surface.md
---

# Phase 3b Handoff — Onboarding Flow + Anchor Barrel Splits

**Context for a fresh agent:** Phase 3a (commits `6d18220c2`, `84eec07c8`, `07dc92218`) shipped the aggregator + mobile Today surface + web Today surface. Two independent tracks follow, running in parallel:

**Track X — Barrel splits.** Unblock web contribution from `@mylife/health`, `@mylife/rsvp`, `@mylife/trails` so all 7 anchor modules can surface Today cards on web (mobile already has all 7).

**Track Y — Goal-based onboarding.** Implement the Phase 3b onboarding flow from `docs/plans/consolidation/04-onboarding-goal-based.md`. Pledge → Goal question → Kit preview → First action. Writes `hub_preferences['today.primary_clusters']` which the Today surface already consumes.

The two tracks are fully independent and can run concurrently.

---

## Track X — Barrel splits for 3 anchor modules

### Problem

`@mylife/health`, `@mylife/rsvp`, `@mylife/trails` re-export RN components (SectionHeader, GlassCard, etc.) directly from `src/index.ts`. When imported into `apps/web/app/actions.ts`, Rollup walks the transitive import graph and breaks on `react-native`'s Flow-typed internals. Phase 3a documented this and excluded them from the web TODAY_MODULES array.

### Fix pattern (established in commit `0b98638a8` for workouts/cycle/forums)

1. Split the barrel:
   - `src/index.ts` — keep everything EXCEPT direct RN component re-exports
   - `src/index.native.ts` — `export * from './index'` + RN component re-exports
2. Update `package.json` exports to use conditional resolution:
   ```json
   "exports": {
     ".": {
       "react-native": "./src/index.native.ts",
       "default": "./src/index.ts"
     },
     "./ui": "./src/ui/index.ts"
   }
   ```
3. Verify `@mylife/module-registry`, `@mylife/db`, and other consumers import from the package name (not deep import) so the conditional works.
4. Mobile Metro resolves `react-native` condition → gets the full barrel.
5. Web Next.js uses `default` condition → gets the web-safe barrel without RN.

### Apply to each of the 3 modules

**`modules/health/`:** move these lines from `src/index.ts` to a new `src/index.native.ts`:
```ts
export * from './ui/typography';
export * from './ui/tokens';
export { SectionHeader } from './ui/SectionHeader';
export { GlassCard } from './ui/GlassCard';
export { VitalCard } from './ui/VitalCard';
export { ActivityRing } from './ui/ActivityRing';
export { GoalProgressCard } from './ui/GoalProgressCard';
export { SleepStageBar } from './ui/SleepStageBar';
export { StatBadge } from './ui/StatBadge';
export { GradientButton } from './ui/GradientButton';
export { QuickActionButton } from './ui/QuickActionButton';
```
The `./ui/typography` and `./ui/tokens` may be web-safe (pure tokens, no RN imports) — if so, keep them in `src/index.ts`. Read each file; if it has no `react-native` / `react-native-svg` / `expo-blur` import, it's web-safe.

Prepend to the new `src/index.native.ts`:
```ts
export * from './index';
```

**`modules/rsvp/`:** read `src/index.ts`, identify any RN component re-export, apply the same split.

**`modules/trails/`:** same.

### Update `apps/web/app/actions.ts`

Restore the three anchors to the TODAY_MODULES array:
```ts
import { HEALTH_MODULE } from '@mylife/health';
import { RSVP_MODULE } from '@mylife/rsvp';
import { TRAILS_MODULE } from '@mylife/trails';

const TODAY_MODULES: ModuleDefinition[] = [
  HEALTH_MODULE,
  JOURNAL_MODULE,
  HOMES_MODULE,
  BUDGET_MODULE,
  RSVP_MODULE,
  TRAILS_MODULE,
  BOOKS_MODULE,
];
```

### Acceptance (Track X)

- Each of the 3 modules has `src/index.native.ts` and a conditional `.` export in `package.json`
- `pnpm --filter @mylife/health test`, `--filter @mylife/rsvp test`, `--filter @mylife/trails test` — all green (mobile unaffected)
- `pnpm --filter @mylife/web test` — green with the 3 restored imports; no Rollup react-native errors
- `pnpm --filter @mylife/mobile test` — still green (no regression)
- `pnpm typecheck` — 89/89 clean
- `pnpm check:parity --quiet` — pass

---

## Track Y — Goal-based onboarding

### What ships

Per `04-onboarding-goal-based.md`, a 4-screen flow before first real action:

1. **Pledge** — 7 commitments (no ads, no data sale, free stays free, export anytime, delete anytime, content filters user's choice, exit door open). Accept / Read-full-pledge.
2. **Goal question** — multi-select (1-3) of 7 clusters: Body, Mind, Home, Money, Social, Outdoor, Knowledge. Each has icon, label, 1-line description.
3. **Kit preview** — shows the merged module list for the selected clusters with add/remove toggles. User can remove modules they don't want, add modules they do. "Continue" enables selected modules.
4. **First action** — deep-link into the chosen cluster's primary module "new" screen (e.g., body → `/mood/log`, mind → `/journal/new`).

Writes on completion:
- `hub_preferences['today.primary_clusters']` — JSON array of cluster ids the user selected. The Today surface already reads this.
- `hub_preferences['onboarding.completed_at']` — ISO timestamp so the flow doesn't re-run.
- Enables each selected module via `enableModule` from `@mylife/db`.

### Post-first-value banners (not blocking the first action)

After the user hits the Today surface, show dismissable banners for:
- "Import from Goodreads / YNAB / Habitify / Cronometer?" (stub routing to `/import` even if import UI isn't built yet — creating a stub route is out of scope for Phase 3b if the route doesn't exist, in which case omit the banner)
- "Turn on AI assist?" (routes to `/settings/ai` — if the settings screen doesn't have an AI section, omit)
- "Verify biometric for social features?" (only if Forums or Market were enabled; routes to `/settings/biometric`)

Skip any banner whose target route doesn't exist. No 404 banners.

### Starter kits (merge on multi-cluster selection)

| Cluster | Modules |
|---------|---------|
| Body | health, workouts, nutrition, fast, mood, cycle, meds |
| Mind | journal, notes, mood, voice, books, flash, words |
| Home | homes, car, garden, pets, closet |
| Money | budget, subs, market |
| Social | rsvp, forums, presence, mail |
| Outdoor | trails, surf, stars, garden |
| Knowledge | books, flash, words, notes, habits |

Use the cluster→module map already in `packages/module-registry/src/dashboard.ts` (from Phase 3a) as the source of truth. If not exported, export it.

### Routes to build

**Mobile (`apps/mobile/app/(onboarding)/`):**
- Existing: `_layout.tsx`, `index.tsx`. Replace or augment.
- New: `pledge.tsx`, `goal.tsx`, `kit.tsx`. Final screen routes to the first-action screen via `router.replace`.
- The `_layout.tsx` becomes a Stack that routes through pledge → goal → kit.
- Entry: `apps/mobile/app/_layout.tsx` should redirect to `(onboarding)/pledge` on first run (check hub_preferences['onboarding.completed_at']; if null, redirect).

**Web (`apps/web/app/onboarding/`):**
- Existing: `mode/`, `privacy/`, `setup/`. Leave alone (those are the existing privacy/mode/self-host setup — different flow).
- New: `apps/web/app/onboarding/pledge/page.tsx`, `goal/page.tsx`, `kit/page.tsx`.
- Entry: middleware or root `apps/web/app/page.tsx` checks if onboarding completed; if not, redirect to `/onboarding/pledge`. Use the existing `getPreference` action pattern.

### UI treatment

Use the Cool Obsidian tokens from Phase 3a's Today components. Pledge and Goal screens are vertically centered with generous whitespace. Kit preview uses card-per-module rows with a toggle. Consistent with the Phase 3a visual language.

### Server/client boundary (web)

- `pledge/page.tsx` — server component with a form-action that records acceptance and forwards to `/onboarding/goal`.
- `goal/page.tsx` — client component (multi-select state). On submit, calls a server action that writes `today.primary_clusters` and forwards to `/onboarding/kit`.
- `kit/page.tsx` — client component (toggle state initialized from cluster selection). On submit, server action enables the modules + sets `onboarding.completed_at` + returns redirect URL.

Use `next/navigation` `redirect` and `useRouter` appropriately.

### Acceptance (Track Y)

- Three onboarding screens built on both mobile and web
- Goal question stores primary clusters in `hub_preferences`
- Kit preview correctly merges modules across multi-cluster selection and dedupes
- Enabling modules via `enableModule` runs each module's migrations as needed
- First-action routing works for every cluster choice (no 404s — if a target screen is missing, fall back to the Today surface)
- Redirect logic: users without `onboarding.completed_at` go through onboarding on first app launch; users with it land on Today
- Tests: one smoke test per platform covering the goal-selection → kit → completion path
- `pnpm --filter @mylife/mobile test` and `--filter @mylife/web test` — green, no regression

### NOT in scope for Track Y

- The import wizard screens (pipeline stubs for Goodreads/YNAB/etc. already exist in `packages/onboarding/`; wiring them into the flow is a follow-on)
- AI preferences screen
- Biometric verification (Settings screen / `hub_human_verification` — separate phase)
- Content-filtering settings (moved to Settings per the Phase 0 decision doc)

---

## Agent team composition

| Role | Agent | Track |
|------|-------|-------|
| Track X — barrel splits | module-dev | Split 3 module barrels; restore imports in `apps/web/app/actions.ts`; run web + mobile + per-module tests. |
| Track Y1 — mobile onboarding | hub-shell-dev | Build pledge/goal/kit screens on Expo. Redirect entry. Smoke test. |
| Track Y2 — web onboarding | hub-shell-dev | Build pledge/goal/kit pages on Next.js. Root redirect. Server actions. Smoke test. |
| Review | feature-dev:code-reviewer | Focus: redirect logic, multi-cluster merge correctness, server/client boundary correctness, no swallowed errors. |
| Parity + ship | parity-checker + inline | All gates + 5 per-concern commits + push. |

All 3 impl tracks run fully in parallel (non-overlapping files: Track X edits `modules/*` + one line in `apps/web/app/actions.ts`; Track Y1 edits `apps/mobile/app/(onboarding)/`; Track Y2 edits `apps/web/app/onboarding/`).

## Commit boundary (target)

5 commits:

1. `fix(modules): split RN barrels for health/rsvp/trails so web can consume`
2. `feat(web): restore all 7 Today anchors after barrel split`
3. `feat(mobile): goal-based onboarding flow (pledge/goal/kit/first-action)`
4. `feat(web): goal-based onboarding flow (pledge/goal/kit/first-action)`
5. `docs(consolidation): Phase 3b session log + memory`

If Track Y mobile + web land in parallel they can optionally be one commit each.

## Cold-start context

1. `docs/plans/consolidation/README.md` — strategy
2. `docs/plans/consolidation/04-onboarding-goal-based.md` — full onboarding spec
3. `docs/plans/consolidation/03-unified-today-surface.md` — Today consumer of primary_clusters
4. `docs/plans/consolidation/phase-3a-today-surface.md` — what just shipped
5. This file — scope + acceptance
6. `packages/module-registry/src/dashboard.ts` — cluster→module map
7. `modules/workouts/src/index.ts` — web-safe barrel reference
8. `modules/health/src/index.ts` — example of what needs splitting

Then execute.
