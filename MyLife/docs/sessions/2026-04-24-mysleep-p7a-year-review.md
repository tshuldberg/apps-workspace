# MySleep P7-A Year Review

Date: 2026-04-24

## Summary

Implemented P7-A year-in-review and shareable aggregate card support for MySleep.

- Added the pure annual review engine:
  - `modules/sleep/src/engine/year-review.ts`
  - `generateYearReview(year, input?)`
- Exported the year-review engine and types from `modules/sleep/src/index.ts`.
- Added focused engine and function-gate tests:
  - `modules/sleep/src/__tests__/year-review.test.ts`
  - `modules/sleep/src/engine/__tests__/year-review.function-gate.test.ts`
- Added mobile review routes:
  - `apps/mobile/app/(sleep)/review/[year].tsx`
  - `apps/mobile/app/(sleep)/review/share.tsx`
- Added web parity:
  - `apps/web/app/sleep/review/[year]/page.tsx`
  - review nav item in `apps/web/app/sleep/layout.tsx`
- Added mobile and web tests for the review surfaces.
- Marked P7-A complete in `docs/plans/mysleep-mission-control.html`.

## Product Notes

- The engine is pure and deterministic. `generateYearReview(year)` returns an empty full-year review, and app surfaces pass entries, dreams, naps, streak history, and target hours explicitly.
- The review aggregates total hours, total nights, average duration, average quality, best/worst month, longest streak, consistency score, sleep debt, dream stats, improvement trend, total naps, monthly heatmap data, fun facts, and prior-year comparison when enough prior-year entries exist.
- Mobile and web DB loaders cap current-year queries at today's date so the existing sleep list schemas do not reject future `endDate` values. The review output itself still represents the selected full year.
- The share card shows aggregate stats only: total hours, average quality, best streak, and dream count. It does not render dream content or notes.

## Verification

- Passed: `pnpm scaffold:function-test --file modules/sleep/src/engine/year-review.ts --function generateYearReview`
- Passed: `pnpm --filter @mylife/sleep typecheck`
- Passed: `pnpm --filter @mylife/sleep test -- src/__tests__/year-review.test.ts src/engine/__tests__/year-review.function-gate.test.ts`
- Passed: `pnpm gate:function --file modules/sleep/src/engine/year-review.ts --tests src/__tests__/year-review.test.ts,src/engine/__tests__/year-review.function-gate.test.ts`
- Passed: `pnpm --filter @mylife/mobile test -- 'app/(sleep)/__tests__/settings.test.tsx' 'app/(sleep)/__tests__/year-review.test.tsx'`
- Passed: `pnpm --filter @mylife/web test -- app/sleep/review/__tests__/page.test.tsx`
- Passed: `pnpm --filter @mylife/mobile typecheck`
- Passed: `pnpm --filter @mylife/web typecheck`
- Passed: file-scoped mobile ESLint for touched MySleep review/settings files.
- Passed: file-scoped web ESLint for touched MySleep review/layout files.
- Passed: `pnpm --dir apps/mobile run lint --quiet`
- Passed: `pnpm gate:function:changed`

## Notes

- The generated function-gate test initially imported the repo-level function-quality helper outside the sleep package `rootDir`. The gate test now uses the package-local helper.
- The first mobile review test found a real current-year query bug: `SleepEntryListOptionsSchema` rejects future dates, so the route loaders now cap query end dates at the current date.
- The previously expected duplicate Notes route blocker did not reproduce. `pnpm --dir apps/mobile run lint --quiet` and `pnpm gate:function:changed` both passed in this session.
- Full package `pnpm --filter @mylife/sleep test` was not rerun because focused P7-A tests and file-scoped function gates cover this phase, and package-wide timing-sensitive function-gate history remains tracked separately.

## Continuation Prompt

Continue MySleep with Phase P7-B in `/Users/trey/Desktop/Apps/MyLife`.

Current date: 2026-04-24.

Read `AGENTS.md` and `CLAUDE.md` before substantial edits. Follow repo rules: TypeScript-first, use `apply_patch` for manual edits, update `memory.md`, `errors_log.md`, `docs/plans/mysleep-mission-control.html`, and a dated session log, and run the function quality gate for new or changed function logic.

Current MySleep state:

- P0-A through P7-A are complete.
- P7-A shipped:
  - `modules/sleep/src/engine/year-review.ts`
  - `generateYearReview(year, input?)`
  - exports from `modules/sleep/src/index.ts`
  - mobile review routes under `apps/mobile/app/(sleep)/review/`
  - web review page at `apps/web/app/sleep/review/[year]/page.tsx`
  - focused engine, function-gate, mobile, and web review tests

Known notes:

- `pnpm gate:function:changed` passed on 2026-04-24. The old duplicate Notes hook-order blocker did not reproduce.
- `pnpm --dir apps/mobile run lint --quiet` passed on 2026-04-24.
- Full package `pnpm --filter @mylife/sleep test` was not rerun. Existing package-wide timing-sensitive function-gate history for dream and nap CRUD remains tracked in `errors_log.md`.

Next task from `docs/plans/mysleep-mission-control.html`:

P7-B - Nap tracking UI + sleep hygiene checklist.

Files to create:

- `apps/mobile/app/(sleep)/nap/log.tsx`
- `apps/mobile/app/(sleep)/nap/history.tsx`
- `apps/mobile/app/(sleep)/hygiene.tsx`
- `apps/web/app/sleep/naps/page.tsx`
- `apps/web/app/sleep/naps/log/page.tsx`
- `apps/web/app/sleep/hygiene/page.tsx`

Required product scope:

- Quick nap logging in under 15 seconds.
- Support "I just napped" duration/time entry and "I'm about to nap" timer-style setup if feasible.
- Intentional vs accidental nap flag.
- Optional quality rating.
- Nap history with duration trends.
- Nap impact insight: whether napping affects tonight's sleep quality.
- Sleep hygiene checklist with configurable daily practices:
  - No caffeine after 2pm
  - No screens 1 hour before bed
  - Same bedtime within 30 minutes
  - Cool, dark room
  - No alcohol within 3 hours of bed
  - Exercise, but not within 2 hours of bed
  - Relaxation routine
  - No heavy meals within 2 hours of bed
- Auto-fill checklist items from factor data where existing factor fields support it.
- Weekly adherence score.
- Correlate hygiene score with sleep quality.
- Settings additions only if needed and consistent with existing settings.
- Mobile and web parity.

Recommended read-first files:

- `modules/sleep/src/db/crud/naps.ts`
- `modules/sleep/src/models/schemas.ts`
- `modules/sleep/src/engine/correlations.ts`
- `modules/sleep/src/engine/factor-log.ts`
- `modules/sleep/src/engine/year-review.ts`
- `apps/mobile/app/(sleep)/review/[year].tsx`
- `apps/mobile/app/(sleep)/settings.tsx`
- `apps/web/app/sleep/review/[year]/page.tsx`
- `apps/web/app/sleep/settings/page.tsx`

Required verification:

- Focused tests for nap UI and hygiene checklist logic.
- `pnpm --filter @mylife/sleep typecheck` if shared sleep types or engines change.
- `pnpm --filter @mylife/mobile typecheck` and focused mobile tests for touched sleep routes.
- `pnpm --filter @mylife/web typecheck` and focused web tests for touched sleep pages.
- `pnpm scaffold:function-test --file <changed engine file> --function <name>` for any new shared function logic.
- `pnpm gate:function --file <changed engine file> --tests <relevant tests>` where applicable.
- `pnpm gate:function:changed`.
