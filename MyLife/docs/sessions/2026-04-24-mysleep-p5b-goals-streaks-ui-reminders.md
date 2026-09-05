# MySleep P5-B Goals And Streaks UI Reminders

Date: 2026-04-24

## Scope

Implemented the MySleep goals and streaks UI plus bedtime reminder settings for Phase P5-B.

## Files Changed

- `apps/mobile/app/(sleep)/goals.tsx`
- `apps/mobile/app/(sleep)/settings.tsx`
- `apps/mobile/app/(sleep)/index.tsx`
- `apps/mobile/app/(sleep)/_layout.tsx`
- `apps/mobile/app/(sleep)/__tests__/goals.test.tsx`
- `apps/mobile/app/(sleep)/__tests__/settings.test.tsx`
- `apps/web/app/sleep/goals/page.tsx`
- `apps/web/app/sleep/settings/page.tsx`
- `apps/web/app/sleep/settings/SleepReminderPermission.tsx`
- `apps/web/app/sleep/page.tsx`
- `apps/web/app/sleep/layout.tsx`
- `apps/web/app/sleep/actions.ts`
- `apps/web/app/sleep/goals/__tests__/page.test.tsx`
- `apps/web/app/sleep/settings/__tests__/page.test.tsx`
- `modules/sleep/src/engine/goals-presentation.ts`
- `modules/sleep/src/engine/__tests__/goals-presentation.function-gate.test.ts`
- `modules/sleep/src/__tests__/goals-presentation.test.ts`
- `modules/sleep/src/db/crud/entries.ts`
- `modules/sleep/src/__tests__/entries-crud.test.ts`
- `modules/sleep/src/index.ts`
- `docs/plans/mysleep-mission-control.html`
- `memory.md`
- `errors_log.md`

## Implementation Notes

- Added mobile and web goals dashboards with goal setup, active-goal progress, edit/deactivate controls, weekly dot indicators, streak cards, longest-record badges, and compact streak history.
- Added shared goals presentation helpers for labels, progress copy, weekly dots, streak history windows, and reminder fire-time calculation.
- Wired sleep-entry create/update paths to refresh streak summaries for current or newer entries.
- Added weekly accountability cards to the mobile and web Sleep Log screens after 7+ nights.
- Replaced placeholder settings screens with target-hours and bedtime-reminder controls.
- Added mobile reminder scheduling through `expo-notifications`.
- Added web Notification API permission handling for browser-tab wind-down reminders.

## Verification

- `pnpm --filter @mylife/sleep typecheck` passed.
- `pnpm --filter @mylife/sleep test -- --run src/__tests__/entries-crud.test.ts src/__tests__/goals-presentation.test.ts src/engine/__tests__/goals-presentation.function-gate.test.ts src/db/crud/__tests__/entries.function-gate.test.ts` passed.
- `pnpm --filter @mylife/mobile test -- --run 'app/(sleep)/__tests__/goals.test.tsx' 'app/(sleep)/__tests__/settings.test.tsx' 'app/(sleep)/__tests__/insights.test.tsx'` passed.
- `pnpm --filter @mylife/web test -- --run app/sleep/goals/__tests__/page.test.tsx app/sleep/settings/__tests__/page.test.tsx app/sleep/insights/__tests__/page.test.tsx` passed.
- `pnpm --filter @mylife/mobile typecheck` passed.
- `pnpm --filter @mylife/web typecheck` passed after changing the web goal form actions to return `void`.
- File-scoped quiet ESLint for the touched MySleep mobile and web files passed.
- `pnpm gate:function --file modules/sleep/src/engine/goals-presentation.ts --tests src/__tests__/goals-presentation.test.ts src/engine/__tests__/goals-presentation.function-gate.test.ts` passed.
- `pnpm gate:function --file modules/sleep/src/db/crud/entries.ts --tests src/__tests__/entries-crud.test.ts src/db/crud/__tests__/entries.function-gate.test.ts` passed.

## Known Blockers

- App-level `pnpm gate:function` wrappers for the new mobile sleep files still stop before tests on the unrelated duplicate Notes route lint blocker at `apps/mobile/app/(notes)/discovery 2.tsx:48`.
- App-level `pnpm gate:function` wrappers for the new web sleep files still stop before tests on the unrelated shop purchase page `@next/next/no-img-element` ESLint rule-resolution blocker at `apps/web/app/shop/purchases/[id]/page.tsx:194` and `:202`.
- `pnpm gate:function:changed` still stops on the same mobile Notes lint blocker after the BestChef app subgate passes.
- `pnpm --filter @mylife/sleep test` still has package-wide timing-sensitive function-gate failures outside P5-B: `createDream repeated inserts` ratio `4.89` over budget `2.80`, and `createNap repeated inserts` ratio `7.11` over budget `4.50`.

## Status

P5-B is complete and marked done in `docs/plans/mysleep-mission-control.html`. Next MySleep phase is `P6-A` CBT-I diary export + sleep efficiency + restriction tracking.
