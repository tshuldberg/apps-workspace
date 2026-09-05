# MyCycle Phase 1 — Core Tabs (P1-A through P1-E)

Date: 2026-04-07
Plan: `docs/plans/mycycle-uiux-mission-control.html`
Source designs: `/Users/trey/Downloads/MyCycleUIUX/`

## Summary

Rebuilt all 5 MyCycle tab screens on mobile to the Obsidian Noir + dual-accent
design system (gold chrome + 4 phase-semantic colors) established in Phase 0.
Everything wires into the live cycle prediction, insight, and CRUD engines.

## Files changed

- `apps/mobile/app/(cycle)/(tabs)/index.tsx` — Home dashboard (PhaseRing hero
  + PhaseLegend + 4-card bento: Next Period, Fertile Window, phase-aware tip
  grid). Uses `loadHomeData` to fetch cycles, compute weighted cycle length,
  prediction, current phase, and fertility confidence. Empty state when no
  cycles exist. Pull-to-refresh. Error boundary via try/catch.
- `apps/mobile/app/(cycle)/(tabs)/calendar.tsx` — New Calendar tab (replaces
  the P0-B placeholder). 7-column Mon-first month grid with phase coloring,
  menstrual fills, fertile outlines, ovulation gold-ring glow, dashed
  predicted next period, today highlight, and symptom-log dot indicators.
  Prev/next month chevrons, tap to select day, inline day detail card
  (logged data or "log entry" CTA).
- `apps/mobile/app/(cycle)/(tabs)/history.tsx` — New History tab (replaces the
  P0-B placeholder). Hero title + 3 StatPills (avg length, regularity,
  last period). Vertical cycle timeline with date pill, length badge,
  period-length chip, regularity badge, symptom count. `getCycleDaysByCycle`
  + `getSymptomsForDay` tally drives the symptom count. "Show all N cycles"
  pagination. Empty state pushes the user into log-day. Tap row opens
  compare.tsx with `?cycleId=`.
- `apps/mobile/app/(cycle)/(tabs)/insights.tsx` — Rebuilt Insights tab. SVG
  regularity circle (react-native-svg Circle rings) at 192px, derived from
  `detectCycleTrend().regularity`. Trend card with SVG Polyline over the last
  6 chronological cycle lengths. 4 nav tiles (Predictions, Symptom Analysis,
  Cycle Analytics, BBT Tracking) wired to existing routes until P2 delivers
  dedicated detail screens. Recent Insights list driven by
  `generateCycleInsights`.
- `apps/mobile/app/(cycle)/(tabs)/settings.tsx` — Rebuilt Settings tab. 6
  grouped GlassCard sections: Tracking (cycle length stepper, period length
  stepper, tracking mode cycle, temp unit toggle), Predictions (enable +
  period reminder + fertile alerts), Pregnancy (row → pregnancy.tsx), Partner
  Sharing (row → sharing.tsx), Data (export + clear all with destructive
  Alert), About (version, privacy, support). Internal Stepper/Toggle/Choice/
  Row helper components. In-memory state only for now (AsyncStorage
  persistence is tech debt).
- `modules/cycle/src/index.ts` — Re-exported the 7 P0-C shared components
  (GlassCard, PhaseBadge, PhaseLegend, PhaseRing, LogTodayFAB,
  SectionDivider, StatPill) plus `GlassCardVariant` and `PhaseRingProps`
  types from the main `@mylife/cycle` barrel. Previously only the tokens
  and typography were re-exported, forcing deeper subpath imports.

## Design decisions

- **Live-data driven.** Every tab pulls real state through `useDatabase()`
  + cycle engine helpers (`getCycles`, `getCycleStats`, `predictNextPeriod`,
  `getCurrentPhase`, `calculateAverageCycleLength`, `detectCycleTrend`,
  `generateCycleInsights`). No hardcoded mock values.
- **Error containment.** Each tab wraps its `loadXData` call in a
  `useMemo` try/catch and renders a local error state instead of letting
  the DB layer blow up. Matches the "web pages must try/catch server
  actions" feedback rule.
- **No-line rule.** All sectioning uses surface tone shifts
  (`CYCLE_SURFACES.base/low/high/highest`) instead of 1px hairlines.
  Settings intentionally uses a 1px rgba(255,255,255,0.04) inner divider
  between rows because the design explicitly calls for subtle row breaks,
  not outer section lines.
- **Dual accent.** Gold chrome (`CYCLE_ACCENT` / `CYCLE_ACCENT_LIGHT`)
  drives CTAs, trend ring, and LogTodayFAB. Phase colors drive data
  visualization on the ring, calendar cells, predictions icon, fertility
  dots, and symptom chips.
- **Calendar classification.** Pure function `classifyDate` maps each
  visible cell to `menstrual | fertile | ovulation | predicted | null`
  using stored cycles first, falling back to `predictNextPeriod` for
  forward-looking days. Keeps the grid deterministic and testable.
- **History symptom tally.** Iterates `getCycleDaysByCycle` + loops
  `getSymptomsForDay` per day. Not the cheapest query pattern, but it
  avoids adding new CRUD surface area in P1.
- **Log routing.** All 5 tabs route to the existing `/(cycle)/log-day`
  modal via `LogTodayFAB`. P2-A will redesign the modal and add date
  prefill support; until then, P1 does not pass a date param.

## Verification

- `pnpm --filter @mylife/mobile typecheck` clean
- `pnpm --filter @mylife/cycle typecheck` clean
- `pnpm --filter @mylife/cycle test` — 7 test files, 203/203 pass
- `pnpm exec eslint` (apps/mobile) on the 5 edited tab files —
  0 errors, 0 warnings

The full `pnpm gate:function:changed` run was interrupted mid-vitest;
`tsc --noEmit` passed for both mobile and cycle and ESLint was clean,
so compile + static analysis status is verified.

## Remaining Phase 1 work

None. All 5 P1 prompts are complete. Mission Control HTML statuses
for P1-A..E can be flipped to done once Phase 2 starts.

## Tech debt created

- Settings toggles/steppers are in-memory only. No `AsyncStorage` wired
  yet (package isn't installed in `apps/mobile`). Persistence is a Phase
  2/3 follow-up.
- Calendar symptom dots iterate per-day via `getCycleDayByDate`; a
  batched query would be cheaper at scale.
- Insights nav tiles all route to existing screens
  (`insights-detail.tsx`, `compare.tsx`, `temperature.tsx`) until P2 adds
  dedicated Predictions Detail / Symptom Analysis / Cycle Analytics
  screens.
- Export CSV + Clear-all-data in Settings show "coming soon" Alerts;
  real wiring lands with the P3 data tools.

## Key patterns

- **Barrel exposure before shell wiring.** P0-C landed the 7 shared
  components inside `modules/cycle/src/ui/` but didn't re-export them
  from the main package index. P1 needed a one-line fix to make
  `import { PhaseRing } from '@mylife/cycle'` work. Worth a pattern:
  whenever P0 introduces shared UI, expose it in the main barrel the
  same session.
- **`useMemo` error boundary.** Returning a discriminated `{ ok, data }
  | { ok: false, message }` from `useMemo` and branching in the render
  lets each tab absorb DB failures without crashing the hub shell —
  simpler than a full ErrorBoundary tree and keeps the try/catch rule
  intact.
