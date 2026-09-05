# MyPresence Phase 4

## Summary

Completed the mobile Phase 4 gap-fill work for MyPresence in the hub app:
- Added schema v2 coverage for scheduled sessions, badge persistence, accountability partners, rewards, commitment contracts, and app reflection notes.
- Added new engines for schedule recurrence, badge sync, and reward evaluation.
- Added the mobile Phase 4 routes: scheduled, accountability, rewards, commitment, breathing-pause, intention-prompt, and reflection.
- Integrated Phase 4 into existing mobile flows: session completion sync, badges progress UI, sessions/settings links, report commitment callout, and breathing-pause preview.
- Added focused test coverage for Phase 4 CRUD and engines, then fixed remaining Presence mobile type issues in badges and insights.

## Key Files

- `modules/presence/src/db/schema.ts`
- `modules/presence/src/db/crud.ts`
- `modules/presence/src/definition.ts`
- `modules/presence/src/types.ts`
- `modules/presence/src/engines/schedule.ts`
- `modules/presence/src/engines/badges-sync.ts`
- `modules/presence/src/engines/rewards.ts`
- `apps/mobile/app/(presence)/scheduled.tsx`
- `apps/mobile/app/(presence)/accountability.tsx`
- `apps/mobile/app/(presence)/rewards.tsx`
- `apps/mobile/app/(presence)/commitment.tsx`
- `apps/mobile/app/(presence)/breathing-pause.tsx`
- `apps/mobile/app/(presence)/reflection.tsx`
- `apps/mobile/app/(presence)/session-active.tsx`
- `apps/mobile/app/(presence)/session-complete.tsx`
- `apps/mobile/app/(presence)/badges.tsx`
- `apps/mobile/app/(presence)/insights.tsx`
- `modules/presence/__tests__/schedule.test.ts`
- `modules/presence/__tests__/phase4-crud.test.ts`
- `modules/presence/__tests__/badges-sync.test.ts`
- `modules/presence/__tests__/rewards.test.ts`

## Verification

- `pnpm --filter @mylife/presence test`
- `pnpm --filter @mylife/presence typecheck`
- `pnpm --filter @mylife/mobile typecheck`
- `pnpm gate:function --package @mylife/presence --tests modules/presence/__tests__/presence.test.ts,modules/presence/__tests__/schedule.test.ts,modules/presence/__tests__/phase4-crud.test.ts,modules/presence/__tests__/badges-sync.test.ts,modules/presence/__tests__/rewards.test.ts`
- `pnpm gate:function --file 'apps/mobile/app/(presence)/session-active.tsx' --skip-test`

## Notes

- `pnpm gate:function:changed` was attempted first, but it expands to the broader dirty mobile worktree and is not a reliable scoped signal during the concurrent Cycle/Garden/Workouts sessions.
- The final verification signal for this task came from the scoped Presence package gate plus clean `@mylife/mobile` typecheck.
