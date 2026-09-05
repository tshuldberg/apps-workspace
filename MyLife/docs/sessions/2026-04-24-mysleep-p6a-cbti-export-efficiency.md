# MySleep P6-A CBT-I Export And Sleep Efficiency

Date: 2026-04-24

## Scope

Implemented MySleep Phase P6-A: CBT-I diary export, sleep efficiency helpers, and sleep restriction tracking.

## Files Changed

- `modules/sleep/src/engine/cbti.ts`
- `modules/sleep/src/engine/export.ts`
- `modules/sleep/src/index.ts`
- `modules/sleep/src/__tests__/cbti.test.ts`
- `modules/sleep/src/__tests__/export.test.ts`
- `modules/sleep/src/engine/__tests__/cbti.function-gate.test.ts`
- `modules/sleep/src/engine/__tests__/export.function-gate.test.ts`
- `apps/mobile/app/(sleep)/settings.tsx`
- `apps/mobile/app/(sleep)/insights.tsx`
- `apps/mobile/app/(sleep)/__tests__/settings.test.tsx`
- `apps/mobile/app/(sleep)/__tests__/insights.test.tsx`
- `apps/web/app/sleep/settings/page.tsx`
- `apps/web/app/sleep/actions.ts`
- `apps/web/app/sleep/insights/page.tsx`
- `apps/web/app/sleep/settings/__tests__/page.test.tsx`
- `apps/web/app/sleep/insights/__tests__/page.test.tsx`
- `docs/plans/mysleep-mission-control.html`
- `memory.md`
- `errors_log.md`

## Implementation Notes

- Added pure CBT-I helpers for sleep efficiency, efficiency trend points, therapist diary rows, and sleep restriction window recommendations.
- Sleep restriction now follows the P6-A safety contract: below target efficiency, recommend actual sleep time plus 30 minutes; never recommend less than 5.5 hours in bed; at 90%+ efficiency, expand by 15 minutes.
- Added CSV export helpers for the CBT-I diary format and a generic all-sleep-data export.
- Exported the new helpers and types from `@mylife/sleep`.
- Added a mobile settings CBT-I export button using `expo-file-system/legacy` and `expo-sharing`.
- Added a web settings CBT-I CSV download link.
- Added sleep restriction tracking toggles and preview cards to mobile and web settings, with therapist-guidance warning copy.
- Added sleep efficiency to the mobile and web insights summary cards.

## Verification

- `pnpm --filter @mylife/sleep typecheck` passed.
- `pnpm --filter @mylife/sleep test -- src/__tests__/cbti.test.ts src/__tests__/export.test.ts src/engine/__tests__/cbti.function-gate.test.ts src/engine/__tests__/export.function-gate.test.ts` passed.
- `pnpm --dir apps/mobile test -- app/(sleep)/__tests__/settings.test.tsx app/(sleep)/__tests__/insights.test.tsx` passed.
- `pnpm --dir apps/web test -- app/sleep/settings/__tests__/page.test.tsx app/sleep/insights/__tests__/page.test.tsx` passed.
- `pnpm --dir apps/mobile run typecheck` passed.
- `pnpm --dir apps/web run typecheck` passed.
- File-scoped quiet ESLint passed for touched MySleep mobile files.
- File-scoped quiet ESLint passed for touched MySleep web files.
- `pnpm gate:function --file modules/sleep/src/engine/cbti.ts --tests src/__tests__/cbti.test.ts --tests src/engine/__tests__/cbti.function-gate.test.ts` passed.
- `pnpm gate:function --file modules/sleep/src/engine/export.ts --tests src/__tests__/export.test.ts --tests src/engine/__tests__/export.function-gate.test.ts` passed.

## Known Blockers

- `pnpm gate:function:changed` still stops on the unrelated duplicate Notes route at `apps/mobile/app/(notes)/discovery 2.tsx:48` with `react-hooks/rules-of-hooks`. The BestChef subgate passed before the mobile lint wrapper failed.
- `pnpm --dir apps/mobile run lint --quiet` still reports the same single Notes error.
- Targeted web file-scoped ESLint for the touched MySleep files passes. App-level web function gates remain documented as blocked by the unrelated shop `@next/next/no-img-element` rule-resolution issue.
- Full `pnpm --filter @mylife/sleep test` was not rerun in P6-A because the package-wide run is already documented as non-green outside this phase from timing-sensitive dream and nap function-gate checks. The new CBT-I/export tests and file-scoped function gates passed.

## Status

P6-A is complete and marked done in `docs/plans/mysleep-mission-control.html`. Next MySleep phase is `P6-B` chronotype + circadian rhythm + jet lag + shift work.

## Continuation Prompt

Continue MySleep with Phase P6-B in `/Users/trey/Desktop/Apps/MyLife`.

Read `AGENTS.md`, `CLAUDE.md`, `.claude/settings.local.json`, `.claude/skills-available.md`, and `.claude/plugins.md` before substantial edits. Follow repo rules: TypeScript-first, use `apply_patch` for manual edits, update `memory.md`, `errors_log.md`, `docs/plans/mysleep-mission-control.html`, and a dated session log, and run the function quality gate for new or changed function logic.

Current MySleep state:
- P0-A through P6-A are complete.
- P6-A shipped pure CBT-I helpers in `modules/sleep/src/engine/cbti.ts`, CSV export helpers in `modules/sleep/src/engine/export.ts`, mobile/web CBT-I export controls, sleep restriction toggles/previews, and sleep efficiency cards in insights.
- Required docs were updated:
  - `docs/plans/mysleep-mission-control.html` marks P6-A done
  - `docs/sessions/2026-04-24-mysleep-p6a-cbti-export-efficiency.md`
  - `memory.md`
  - `errors_log.md`

Known unrelated blockers:
- `pnpm gate:function:changed` still fails outside MySleep on `apps/mobile/app/(notes)/discovery 2.tsx:48` with `react-hooks/rules-of-hooks`. Latest reconfirmation on 2026-04-24: BestChef app subgate passed, `pnpm gate:function:changed` stopped on mobile lint with `✖ 831 problems (1 error, 830 warnings)`, and `pnpm --dir apps/mobile run lint --quiet` reported the same single Notes error.
- `pnpm --filter @mylife/sleep test` remains non-green outside current phase because existing function-gate slope checks are timing-sensitive in package-wide runs. Latest full run remains the P5-B run: 179/181 tests passed, with failures in `dreams.function-gate.test.ts` and `naps.function-gate.test.ts`.
- Targeted web function gates remain documented as blocked elsewhere by the existing `@next/next/no-img-element` ESLint rule-resolution issue on `apps/web/app/shop/purchases/[id]/page.tsx`, while file-scoped ESLint for touched MySleep web files passed in P6-A.

Next task from `docs/plans/mysleep-mission-control.html`:
P6-B - Chronotype + circadian rhythm + jet lag + shift work

Read first:
- `docs/plans/mysleep-mission-control.html` P6-B
- `modules/sleep/src/engine/analytics.ts`
- `modules/sleep/src/engine/optimal-window.ts`
- `modules/sleep/src/engine/cbti.ts`
- `modules/sleep/src/engine/export.ts`
- `apps/mobile/app/(sleep)/insights.tsx`
- `apps/web/app/sleep/insights/page.tsx`
- existing sleep settings/routes for mobile and web styling patterns

Required product scope:
- Create `modules/sleep/src/engine/chronotype.ts`
  - `assessChronotype(entries: SleepEntry[]): 'early_bird' | 'moderate_morning' | 'intermediate' | 'moderate_evening' | 'night_owl'`
  - Base assessment on median natural bedtime and wake time on free days, using weekends or days off as available.
  - Require 14+ free-day entries for a confident assessment.
  - `getCircadianProfile(entries)` with hourly energy/alertness estimates based on wake time.
  - Use the simplified model from mission control: peak alertness 2-4 hours after wake, dip around 7 hours after wake, secondary peak around 10 hours after wake.
- Create `modules/sleep/src/engine/jet-lag.ts`
  - `createJetLagTracker(originTZ, destTZ, arrivalDate)`
  - `getAdjustmentProgress(tracker, currentEntries)`
  - `getRecommendation(tracker, day)`
  - Use the rule of thumb from mission control: about 1 hour per day eastward and 1.5 hours per day westward.
- Add shift work support as scoped by P6-B mission-control details.
- Keep mobile and web parity for any added route/surface.
- Reuse existing analytics/optimal-window/CBT-I helpers where applicable.
- Do not touch unrelated dirty-worktree files.

Required verification:
- Focused module tests for chronotype, circadian profile, jet lag, and shift-work logic.
- Targeted mobile/web tests if P6-B adds or changes surfaces and existing test setup supports them.
- `pnpm --filter @mylife/sleep typecheck`
- Relevant mobile/web typechecks if touched surfaces require them.
- `pnpm gate:function --file <main touched file> --tests <relevant tests>` for new or changed function logic.
- `pnpm gate:function:changed`, expected to still fail on the known duplicate Notes route unless something else regresses.
