# MySleep P3-B: evening factor logging UI

Date: 2026-04-22

## Scope
- Completed MySleep P3-B on top of the shared factors CRUD layer from P3-A.
- Shipped a calm evening or retrospective factor-log flow with mobile and web parity.

## What Shipped
- Added a shared factor-log engine in `modules/sleep/src/engine/factor-log.ts` for:
  - quick versus full log modes
  - tonight versus last-night date resolution
  - seeded taxonomy metadata for activities, supplements, room conditions, and stress
  - factor draft hydration, payload building, and display formatting
- Extended the shared sleep data layer so factor logs can save before or after the linked morning entry:
  - `saveFactorLog` now upserts by linked entry or night date and auto-links to an existing same-night entry when present
  - sleep entry create/update now back-link matching same-night factor rows through the shared CRUD layer
- Added the host flows:
  - `apps/mobile/app/(sleep)/factors/log.tsx`
  - `apps/mobile/app/(sleep)/SleepFactorForm.tsx`
  - `apps/web/app/sleep/factors/page.tsx`
  - `apps/web/app/sleep/factors/log/page.tsx`
  - `apps/web/app/sleep/factors/SleepFactorLogForm.tsx`
- Updated both sleep entry detail screens so saved factors now render directly with the linked entry:
  - quick metrics for caffeine, meals, alcohol, exercise, screen cutoff, and stress
  - chip summaries for pre-sleep activities and supplements
  - room condition summaries plus optional disturbance notes
  - edit or log-factor CTA back into the shared factor flow
- Added verification coverage for the new shared and host behavior:
  - `modules/sleep/src/__tests__/factor-log.test.ts`
  - `modules/sleep/src/engine/__tests__/factor-log.function-gate.test.ts`
  - `apps/web/app/sleep/factors/__tests__/SleepFactorLogForm.test.tsx`
  - expanded entry and factor CRUD tests for same-night upsert and deferred auto-linking

## Verification
- `pnpm scaffold:function-test --file modules/sleep/src/engine/factor-log.ts --function buildFactorCreateInput --force`
- `pnpm --filter @mylife/web exec vitest run app/sleep/factors/__tests__/SleepFactorLogForm.test.tsx`
- `pnpm --filter @mylife/sleep exec vitest run src/__tests__/factor-log.test.ts src/engine/__tests__/factor-log.function-gate.test.ts`
- `pnpm --filter @mylife/sleep typecheck`
- `pnpm gate:function --file modules/sleep/src/engine/factor-log.ts --tests src/__tests__/factor-log.test.ts,src/engine/__tests__/factor-log.function-gate.test.ts`
- `pnpm --filter @mylife/sleep test`
  - Fails outside P3-B on the existing `buildSleepTimelineSections` complexity budget in `modules/sleep/src/engine/__tests__/timeline.function-gate.test.ts` (`500 -> 1000` ratio `4.05`, budget `2.80`)
- `pnpm gate:function:changed`
  - Still fails outside MySleep on the known duplicate Notes route blocker at `apps/mobile/app/(notes)/discovery 2.tsx:48`: `React Hook "useMemo" is called conditionally` (`react-hooks/rules-of-hooks`)
  - Latest reconfirmation in this session: `✖ 831 problems (1 error, 830 warnings)`

## Notes
- Factor persistence still lives entirely in the shared sleep module. The hosts only build drafts, render controls, and call `saveFactorLog`.
- The same-night auto-link path now works in both directions:
  - if a sleep entry already exists, saving factors attaches immediately
  - if factors are saved first, creating or updating the matching sleep entry links the factor row afterward
- Quick log intentionally preserves any existing full-log fields for that night instead of clearing them when the user saves only stress, caffeine, and exercise.
