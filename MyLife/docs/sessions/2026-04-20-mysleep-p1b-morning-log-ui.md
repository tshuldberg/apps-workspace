# MySleep P1-B: morning log UI

Date: 2026-04-20

## Summary

Built the first real MySleep user-facing flow on top of the P1-A CRUD layer:

- added a shared morning-log helper in `modules/sleep` that converts quick-log draft state into `sl_sleep_entries` input and generates the save summary
- shipped the hidden mobile `/(sleep)/log` route as a 7-step morning flow with time controls, quality stars, wake feeling, wake-up stepper, optional notes, and a summary screen
- shipped the web `/sleep/log` flow with matching step order and save behavior through a server action
- replaced the sleep landing placeholders on mobile and web with recent-entry surfaces so a saved log appears immediately at the top after redirect

This completes P1-B in the mission control without pulling the full P1-C detail/edit scope forward.

## Files changed

Shared MySleep logic:

- `modules/sleep/src/engine/morning-log.ts`
- `modules/sleep/src/__tests__/morning-log.test.ts`
- `modules/sleep/src/engine/__tests__/morning-log.function-gate.test.ts`
- `modules/sleep/src/index.ts`

Mobile:

- `apps/mobile/app/(sleep)/_layout.tsx`
- `apps/mobile/app/(sleep)/index.tsx`
- `apps/mobile/app/(sleep)/log.tsx`

Web:

- `apps/web/app/sleep/actions.ts`
- `apps/web/app/sleep/page.tsx`
- `apps/web/app/sleep/log/page.tsx`
- `apps/web/app/sleep/log/SleepMorningLogForm.tsx`

Tracking:

- `docs/plans/mysleep-mission-control.html`
- `memory.md`
- `errors_log.md`

## Notes

- `buildMorningLogEntryInput` freezes the draft against a reference `Date`, resolves wake times that would otherwise land in the future by shifting them to the prior day, and maps bedtime onto the prior night when its clock time is later than wake time.
- The recent-entry surfaces intentionally stop short of P1-C detail/edit features. They only prove the P1-B save loop: log -> redirect -> newest entry visible at top.
- `pnpm scaffold:function-test --file modules/sleep/src/engine/morning-log.ts --function buildMorningLogEntryInput --force` regenerated the gate test with a repo-level helper import that breaks `modules/sleep` `rootDir: "src"`. I restored the module-local helper import pattern afterward and kept the generated test file in-package.

## Verification

Passed:

- `pnpm scaffold:function-test --file modules/sleep/src/engine/morning-log.ts --function buildMorningLogEntryInput --force`
- `pnpm --filter @mylife/sleep test`
- `pnpm --filter @mylife/sleep typecheck`
- `pnpm gate:function --file modules/sleep/src/engine/morning-log.ts --tests src/__tests__/morning-log.test.ts,src/engine/__tests__/morning-log.function-gate.test.ts`

Blocked outside MySleep:

- `pnpm gate:function:changed`
  - still fails on the existing unrelated mobile lint blocker:
  - `apps/mobile/app/(notes)/discovery 2.tsx:48`
  - `react-hooks/rules-of-hooks`
  - `React Hook "useMemo" is called conditionally`
- `pnpm --filter @mylife/mobile typecheck`
  - unrelated hidden MyCreate nullability errors in `apps/mobile/app/(create)/project/edit/[id].tsx:40-61`
- `pnpm --filter @mylife/web typecheck`
  - unrelated hidden MyCreate import errors in `app/create/page.tsx` and sibling `app/create/*/page.tsx` routes looking for missing `./ui` or `../ui`

## Next step

P1-C can now build on top of the saved-entry loop that already exists on both hosts: recent logs render, the newest item surfaces immediately after save, and the shared helper keeps time-to-entry conversion consistent across mobile and web.
