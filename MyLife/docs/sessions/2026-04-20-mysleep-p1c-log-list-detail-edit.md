# MySleep P1-C: weekly log list, detail, and edit

Date: 2026-04-20

## Summary

Built the P1-C browsing surface for MySleep on top of the existing P1-A CRUD layer and the P1-B quick-log flow:

- added shared sleep timeline helpers for week grouping, wake-feeling metadata, duration target tones, and list labels
- extended the shared morning-log helper so edit flows can stay anchored to a fixed wake date instead of incorrectly rebuilding old entries relative to "now"
- replaced the mobile sleep landing screen with a paged weekly timeline, added entry detail, and reused a shared stepper component for both create and edit
- mirrored the same list, detail, edit, and delete flow on web, including server actions and paged browsing

This completes P1-C in the MySleep mission control.

## Files changed

Shared MySleep logic:

- `modules/sleep/src/engine/morning-log.ts`
- `modules/sleep/src/engine/timeline.ts`
- `modules/sleep/src/__tests__/morning-log.test.ts`
- `modules/sleep/src/__tests__/timeline.test.ts`
- `modules/sleep/src/engine/__tests__/morning-log.function-gate.test.ts`
- `modules/sleep/src/engine/__tests__/timeline.function-gate.test.ts`
- `modules/sleep/src/index.ts`

Mobile:

- `apps/mobile/app/(sleep)/_layout.tsx`
- `apps/mobile/app/(sleep)/_ui.tsx`
- `apps/mobile/app/(sleep)/SleepEntryWizard.tsx`
- `apps/mobile/app/(sleep)/index.tsx`
- `apps/mobile/app/(sleep)/log.tsx`
- `apps/mobile/app/(sleep)/entry/[id].tsx`
- `apps/mobile/app/(sleep)/entry/edit/[id].tsx`

Web:

- `apps/web/app/sleep/actions.ts`
- `apps/web/app/sleep/presentation.ts`
- `apps/web/app/sleep/page.tsx`
- `apps/web/app/sleep/log/page.tsx`
- `apps/web/app/sleep/log/SleepMorningLogForm.tsx`
- `apps/web/app/sleep/entry/[id]/page.tsx`
- `apps/web/app/sleep/entry/[id]/SleepEntryActions.tsx`
- `apps/web/app/sleep/entry/[id]/edit/page.tsx`

Tracking:

- `docs/plans/mysleep-mission-control.html`
- `memory.md`
- `errors_log.md`

## Notes

- `buildMorningLogEntryInputForDate` and `getMorningLogSummaryForDate` were added specifically so old entries can be edited without remapping them onto the current day. The original "infer from now" behavior still powers the quick-log create flow.
- The mobile list uses a 50-row page size with lazy loading and rebuilds week sections from the loaded slice, which keeps the route simple while meeting the P1-C pagination requirement.
- The web list uses `?page=` pagination with the same 50-row page size and the same shared week-grouping helper so section labels stay aligned across hosts.
- Detail pages surface the P2 and P3 placeholders now so dreams and factors can slot into the existing entry shell instead of forcing another structural rewrite later.

## Verification

Passed:

- `pnpm --filter @mylife/sleep test`
- `pnpm --filter @mylife/sleep typecheck`
- `pnpm --filter @mylife/mobile typecheck`
- `pnpm --filter @mylife/web typecheck`
- `pnpm scaffold:function-test --file modules/sleep/src/engine/timeline.ts --function buildSleepTimelineSections --force`
- `pnpm gate:function --file modules/sleep/src/engine/morning-log.ts --tests src/__tests__/morning-log.test.ts,src/engine/__tests__/morning-log.function-gate.test.ts`
- `pnpm gate:function --file modules/sleep/src/engine/timeline.ts --tests src/__tests__/timeline.test.ts,src/engine/__tests__/timeline.function-gate.test.ts`

Blocked outside MySleep:

- `pnpm gate:function:changed`
  - still fails in the dirty mobile app worktree during package lint
  - real blocking error remains:
  - `apps/mobile/app/(notes)/discovery 2.tsx:48`
  - `react-hooks/rules-of-hooks`
  - `React Hook "useMemo" is called conditionally`

## Next step

P2 can build on top of a real entry shell now: dreams can attach to existing sleep-entry detail views, delete already cascades through related rows, and both hosts now have stable list/detail/edit surfaces to hang dream-specific UI on.
