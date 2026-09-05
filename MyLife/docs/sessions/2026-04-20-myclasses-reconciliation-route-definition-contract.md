# MyClasses Reconciliation: Missing Add Route + Definition Contract

Date: 2026-04-20
Mission-control context: no remaining `data-status="pending"` cards in `docs/plans/myclasses-mission-control.html`, so this session treated `P10-A` as a live-repo reconciliation pass instead of trusting the tracker at face value.

## What changed

- Added the missing mobile route [apps/mobile/app/(classes)/class/add.tsx](/Users/trey/Desktop/Apps/MyLife/apps/mobile/app/(classes)/class/add.tsx) so existing CTAs like the empty Grades state no longer push into a nonexistent screen.
- Extended [apps/mobile/components/classes/AddClassSheet.tsx](/Users/trey/Desktop/Apps/MyLife/apps/mobile/components/classes/AddClassSheet.tsx) with `closeOnSubmit` so the shared add flow can serve both the schedule FAB sheet and the routed add-class screen without forcing an immediate close/back.
- Corrected [modules/classes/src/definition.ts](/Users/trey/Desktop/Apps/MyLife/modules/classes/src/definition.ts) from schema version 5 / 5 tabs to schema version 7 / 9 tabs, and replaced stale screen metadata with the actual routed MyClasses surface.
- Added [modules/classes/src/__tests__/definition.test.ts](/Users/trey/Desktop/Apps/MyLife/modules/classes/src/__tests__/definition.test.ts) to lock the module contract.
- Updated the top-level metadata in [modules/classes/CLAUDE.md](/Users/trey/Desktop/Apps/MyLife/modules/classes/CLAUDE.md) so future sessions do not mistake the package for the old foundation-only slice.

## Architecture alignment notes

- The parity scripts were already green, but they do not validate semantic `ModuleDefinition` drift.
- Mobile and web layouts both expose 9 top-level sections for Classes: Schedule, Assignments, Grades, Study, Degree, Lifelong, Applications, Tests, Settings.
- The actual schema in [modules/classes/src/db/schema.ts](/Users/trey/Desktop/Apps/MyLife/modules/classes/src/db/schema.ts) includes migrations through v7, so `CLASSES_MODULE.schemaVersion` had to match that live contract.
- The mobile schedule screen still uses the inline `AddClassSheet` directly; the new routed add screen intentionally reuses the same component instead of cloning form logic.

## Verification

- `pnpm scaffold:function-test --file apps/mobile/components/classes/AddClassSheet.tsx --function AddClassSheet`
  - Ran to satisfy the repo workflow, but the scaffold generated a bogus component-as-pure-function test and was not kept.
- `pnpm gate:function --file apps/mobile/components/classes/AddClassSheet.tsx`
  - Failed on unrelated repo-wide mobile lint: `apps/mobile/app/(notes)/discovery 2.tsx` violates `react-hooks/rules-of-hooks`.
- `pnpm --filter @mylife/classes exec vitest run src/__tests__/definition.test.ts`
- `pnpm --filter @mylife/classes typecheck`
- `pnpm --dir apps/mobile exec eslint 'app/(classes)/class/add.tsx' 'components/classes/AddClassSheet.tsx' --ext .ts,.tsx`
- `pnpm --filter @mylife/mobile typecheck`
- `pnpm gate:function:changed`
  - Failed on the same unrelated `apps/mobile/app/(notes)/discovery 2.tsx` hook-order error.

## Outcome

MyClasses no longer has a live mobile route hole for adding classes, and its module-registry contract now matches the real shipped schema and top-level navigation surface. The remaining gate failure is external to Classes and remains tracked in `errors_log.md`.
