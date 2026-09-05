# MySleep P2-C: dream patterns and personal dream dictionary

Date: 2026-04-22

## Scope
- Completed MySleep P2-C on top of the P2-A/P2-B dream archive and UI work.
- Added shared dream-pattern analytics, recurring-thread summaries, and a personal dream dictionary with per-theme notes on both mobile and web.

## What Shipped
- Added `modules/sleep/src/engine/dream-patterns.ts` with pure helpers for theme frequency, emotion distribution, recurring summaries, lucid/nightmare rates, weekly rate trends, dreams-per-week averages, type distribution, dictionary search/sort, and note-map normalization.
- Extended `modules/sleep/src/db/crud/dreams.ts` with shared `listAllDreams`, `getDreamDictionaryNotes`, and `setDreamDictionaryNote` helpers so both hosts reuse the same SQLite-backed archive and settings path instead of forking dream queries.
- Added focused unit coverage in `modules/sleep/src/__tests__/dream-patterns.test.ts`, replaced the generated scaffold with a real function-gate file in `modules/sleep/src/engine/__tests__/dream-patterns.function-gate.test.ts`, and updated exports/types through `modules/sleep/src/index.ts`.
- Added mobile dream-pattern and dream-dictionary screens in `apps/mobile/app/(sleep)/dream/patterns.tsx` and `apps/mobile/app/(sleep)/dream/dictionary.tsx`, wired the routes in `apps/mobile/app/(sleep)/_layout.tsx`, and exposed entry points from `dreams.tsx` plus the existing `insights.tsx`.
- Added web dream-pattern and dream-dictionary screens in `apps/web/app/sleep/dreams/patterns/page.tsx`, `apps/web/app/sleep/dreams/dictionary/page.tsx`, and `apps/web/app/sleep/dreams/SleepDreamDictionaryClient.tsx`; updated `SleepDreamArchiveClient.tsx` and `insights/page.tsx` so the new flows are reachable from the current dream surfaces.
- Extended `apps/web/app/sleep/actions.ts` so dictionary note saves revalidate `/sleep/dreams/patterns` and `/sleep/dreams/dictionary`, and dream CRUD invalidation now refreshes those routes too.

## Verification
- `pnpm scaffold:function-test --file modules/sleep/src/engine/dream-patterns.ts --function getDreamDictionary --force`
- `pnpm --filter @mylife/sleep test`
- `pnpm --filter @mylife/sleep typecheck`
- `pnpm --filter @mylife/mobile typecheck`
  - Fails outside MySleep on unrelated hidden-module registry drift: `app/(shop)/_layout.tsx`, `modules/shop/src/definition.ts`, `packages/module-registry/src/constants.ts`, and related `shop` / `sports` module-ID mismatches. A narrow grep over the typecheck output produced no `sleep`-path errors.
- `pnpm --filter @mylife/web typecheck`
  - Fails on the same unrelated `shop` / `sports` registry drift outside MySleep. A narrow grep over the typecheck output produced no `sleep`-path errors.
- `pnpm gate:function --file modules/sleep/src/engine/dream-patterns.ts --tests src/__tests__/dream-patterns.test.ts,src/engine/__tests__/dream-patterns.function-gate.test.ts`
- `pnpm gate:function:changed`
  - Still fails outside MySleep on the canonical mobile lint blocker at `apps/mobile/app/(notes)/discovery 2.tsx:48`: `React Hook "useMemo" is called conditionally` (`react-hooks/rules-of-hooks`). Latest reconfirmation in this session still reports `✖ 824 problems (1 error, 823 warnings)`.

## Notes
- The generated scaffold for `getDreamDictionary` was replaced with a real function-gate file because the scaffold again emitted placeholder assertions and an invalid helper import path.
- P2-C keeps note persistence scoped to `sl_settings` under `dream.dictionaryNotes`, so no schema migration was needed for this phase.
