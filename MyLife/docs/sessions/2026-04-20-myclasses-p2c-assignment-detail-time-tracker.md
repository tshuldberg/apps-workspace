# MyClasses P2-C - Assignment Detail, Group Workflow, Time Tracking

## Summary

Implemented the next real MyClasses mission-control item, `P2-C`, after reconciling the tracker against the live repo. The repo already had assignment CRUD, dependency helpers, late-policy math, and a partial web detail view, so this pass focused on the missing pieces: the shared time-tracker engine, the missing mobile assignment detail route, and upgrading the web detail flow from a manual minute stepper to a real start/pause/stop timer model.

## Repo Alignment

- Kept the live route contract instead of the tracker's stale singular web path:
  - mobile: `apps/mobile/app/(classes)/assignment/[id].tsx`
  - web: existing `apps/web/app/classes/assignments/[id]/page.tsx`
- Reused existing assignment CRUD and `assignment-engine.ts` helpers rather than adding tables or duplicated logic.
- Kept timer persistence host-specific:
  - engine in `modules/classes/src/engine/time-tracker.ts`
  - web storage via `localStorage`
  - mobile storage via `expo-sqlite/kv-store`

## What Shipped

### Shared engine

- Added `modules/classes/src/engine/time-tracker.ts`
- Added `modules/classes/src/__tests__/time-tracker.test.ts`
- Exported the timer API from `modules/classes/src/index.ts`
- Extended `GroupMemberSchema` with optional `is_me`

Timer API now supports:
- `startAssignmentTimer`
- `pauseAssignmentTimer`
- `stopAssignmentTimer`
- `getActiveTimer`
- single-active-timer replacement behavior
- memory storage helper for tests

### Mobile

- Added the missing route:
  - `apps/mobile/app/(classes)/assignment/[id].tsx`
- Added timer persistence adapter:
  - `apps/mobile/app/(classes)/_time-tracker-storage.ts`
- Mobile detail screen now includes:
  - assignment hero with class/type/priority/due state
  - status workflow controls
  - real start/pause/stop timer with logged minutes written back to `actual_minutes`
  - grade section for submitted/graded work
  - group project checklist with responsibility assignments and `is_me` highlighting
  - dependency visualization
  - late-policy penalty display
  - class/teacher deep links

### Web

- Upgraded `apps/web/components/classes/AssignmentDetailControls.tsx`
  - real start/pause/stop timer using `localStorage`
  - current/other-assignment timer awareness
  - stop-and-log flow that increments `actual_minutes`
  - richer group member editing with responsibility text and `Mine` highlighting
- Updated `apps/web/app/classes/data.ts` so late penalties also compute against the current time when work is overdue but not yet submitted

## Verification

- `pnpm --filter @mylife/classes test -- time-tracker`
- `pnpm --filter @mylife/classes test`
- `pnpm --filter @mylife/classes typecheck`
- `pnpm --filter @mylife/mobile typecheck`
- `pnpm --filter @mylife/web typecheck`
- `pnpm --dir apps/mobile exec eslint 'app/(classes)/assignment/[id].tsx' --ext .ts,.tsx`
- `pnpm --dir apps/web exec eslint 'app/classes/assignments/[id]/page.tsx' 'components/classes/AssignmentDetailControls.tsx' --ext .ts,.tsx`
- `pnpm gate:function:changed`

## Gate Status

- The required changed-file gate still fails outside MyClasses.
- The blocker remains the unrelated duplicate Notes route:
  - `apps/mobile/app/(notes)/discovery 2.tsx`
  - `react-hooks/rules-of-hooks`
- The new MyClasses files do not appear in the failing gate log.
