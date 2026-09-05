# MySleep P2-A: dream CRUD, taxonomy, and search

Date: 2026-04-21

## Summary

Built the P2-A dream-journal data layer for MySleep:

- added Zod-backed dream schemas, theme taxonomy exports, JSON array normalization, and typed stats/list option contracts
- added `sl_dreams` CRUD for create, read, update, delete, entry-linked lookups, recurring-group reads, and aggregate dream stats
- added FTS-backed dream search plus a lightweight fallback search path and a dedicated v2 migration with trigger-maintained indexing
- covered the new flow with CRUD tests, search tests, and file-level function-gate suites for both the CRUD and engine files

This completes P2-A in the MySleep mission control.

## Files changed

Shared MySleep logic:

- `modules/sleep/src/models/dream-schemas.ts`
- `modules/sleep/src/db/crud/dreams.ts`
- `modules/sleep/src/engine/dream-search.ts`
- `modules/sleep/src/db/schema.ts`
- `modules/sleep/src/db/index.ts`
- `modules/sleep/src/db/crud/index.ts`
- `modules/sleep/src/definition.ts`
- `modules/sleep/src/index.ts`

Tests and migration artifacts:

- `modules/sleep/src/db/migrations/002_dream_fts.sql`
- `modules/sleep/src/__tests__/dreams-crud.test.ts`
- `modules/sleep/src/__tests__/dream-search.test.ts`
- `modules/sleep/src/db/crud/__tests__/dreams.function-gate.test.ts`
- `modules/sleep/src/engine/__tests__/dream-search.function-gate.test.ts`
- `modules/sleep/src/__tests__/definition.test.ts`
- `modules/sleep/src/__tests__/schema.test.ts`

Tracking:

- `docs/plans/mysleep-mission-control.html`
- `memory.md`
- `errors_log.md`

## Notes

- The base `sl_dreams` table already existed in schema v1, so P2-A ships as schema v2: FTS, recurring-group indexes, and new typed accessors layered on top of the original table.
- Theme and emotion arrays are normalized to lower-case and deduplicated before storage; people are deduplicated but preserve display casing.
- Recurring dreams automatically get a group id when one is not provided, which lets the first dream in a recurring series act as its own group anchor.
- Search uses FTS5 against dream content, themes, and people, with a fallback in-memory matcher so the helper still returns sensible results if the virtual table is unavailable.

## Verification

Passed:

- `pnpm scaffold:function-test --file modules/sleep/src/db/crud/dreams.ts --function createDream --force`
- `pnpm scaffold:function-test --file modules/sleep/src/engine/dream-search.ts --function searchDreams --force`
- `pnpm --filter @mylife/sleep test`
- `pnpm --filter @mylife/sleep typecheck`
- `pnpm gate:function --file modules/sleep/src/db/crud/dreams.ts --tests src/__tests__/dreams-crud.test.ts,src/db/crud/__tests__/dreams.function-gate.test.ts`
- `pnpm gate:function --file modules/sleep/src/engine/dream-search.ts --tests src/__tests__/dream-search.test.ts,src/engine/__tests__/dream-search.function-gate.test.ts`

Blocked outside MySleep:

- `pnpm gate:function:changed`
  - still fails in the dirty mobile app worktree during package lint
  - current blocking error remains:
  - `apps/mobile/app/(notes)/discovery 2.tsx:48`
  - `react-hooks/rules-of-hooks`
  - `React Hook "useMemo" is called conditionally`

## Next step

P2-B can build directly on this layer: both hosts now have typed dream records, recurring-group reads, theme stats, and search available for dream list/detail UI without needing more schema work first.
