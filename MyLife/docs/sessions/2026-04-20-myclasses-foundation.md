# MyClasses Foundation - Session 2026-04-20

## Summary

Implemented the next actionable MyClasses mission-control item as a single foundation bundle: P0-A (module package + `ModuleDefinition`), P0-B (SQLite schema + migration wiring), and P0-C (mobile and web starter shells). The work was aligned to the live MyLife architecture instead of the HTML tracker where they diverged.

## Repo Alignment Before Coding

- Used the live module package pattern under `modules/<name>/src/{db,definition,index}.ts` instead of ad hoc SQL or placeholder folders.
- Wired `classes` through the actual registry and host touchpoints: module IDs, metadata, release-state arrays, mobile/web providers, web supported-modules list, sidebar routing, icon maps, onboarding/discovery groupings, and accent tokens.
- Followed the current hub route shapes: `apps/mobile/app/(classes)/...` and `apps/web/app/classes/...`.
- Kept persistence aligned to current `DatabaseAdapter` usage with typed settings CRUD and schema-versioned migrations.

## What Shipped

### Module package

- Added `modules/classes/` with `definition.ts`, `db/schema.ts`, `db/crud.ts`, `types.ts`, package metadata, TS config, and a settings test.

### Persistence

- Added schema version 1 with `cs_settings`.
- Implemented typed settings persistence plus starter stats and foundation checklist helpers.

### Host integration

- Registered `classes` across:
  - `packages/module-registry`
  - mobile host registration and DB migration wiring
  - web providers, DB helpers, supported-module list, sidebar route, and accent/icon maps

### Mobile shell

- Added `(classes)` routes for schedule, assignments, grades, study, and settings.
- Settings save into SQLite and refresh back into the starter views.

### Web shell

- Added `/classes`, `/classes/assignments`, `/classes/grades`, `/classes/study`, and `/classes/settings`.
- Added server-action persistence for settings.

## Verification

- `pnpm install --filter @mylife/classes --filter @mylife/mobile --filter @mylife/web`
- `pnpm --filter @mylife/classes test`
- `pnpm --filter @mylife/module-registry exec vitest run src/__tests__/release-states.test.ts`
- `pnpm --filter @mylife/classes typecheck`
- `pnpm --filter @mylife/mobile typecheck`
- `pnpm --filter @mylife/web typecheck`
- `pnpm --dir apps/mobile exec eslint 'app/(classes)' --ext .ts,.tsx`
- `pnpm gate:function:changed` (fails outside MyClasses; see Gate Status)

## Gate Status

- The required changed-file gate was run.
- The current blocker is unrelated dirty-worktree code:
  - `apps/mobile/app/(notes)/discovery 2.tsx`
  - `react-hooks/rules-of-hooks`: conditional `useMemo`
- Logged in `errors_log.md` as unresolved repo-level gate drift.

## Notes

- The initial mobile MyClasses screens used a synthetic focus tick that triggered hook-lint noise. Replaced that with a focused snapshot helper so the new module surfaces lint cleanly in isolation.
- Registry counts after this pass: 32 module IDs, 12 public beta, 15 hidden, 17 user-visible.
