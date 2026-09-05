# MyHabits Phase 5 Sobriety

**Date:** 2026-04-07  
**Scope:** Complete P5-A and P5-B from `docs/plans/myhabits-uiux-mission-control.html`.

## What Shipped

### P5-A: Sobriety Dashboard + Clock
- Rebuilt `apps/mobile/app/(habits)/sobriety-clock.tsx` around the Phase 0 habits token layer and glass-card primitives.
- Added a new violet-glow hero with live tabular sobriety clock, streak summary, milestone rail, savings metrics, health-benefit timeline, recent cravings snapshot, editable pledge card, and support-resource actions.
- Added cross-platform modal editing for sobriety profile fields instead of relying on `Alert.prompt`, covering start date and daily spend updates plus pledge text updates.
- Wired the dashboard to existing habits sobriety/craving APIs (`getSobrietyProfile`, `getPledgeForDate`, `getRecentPledgeDates`, `getSlipDates`, `getCravingsForHabit`, `getTriggersForCraving`, `getMilestonesForHabit`, `updateSobrietyProfile`, `createPledge`, `recordCompletion`).
- Used profile `motivation` as the editable pledge surface because the current module API stores daily pledge check-ins separately but does not expose a dedicated pledge-text record.

### P5-B: Log Craving + Insights
- Rebuilt `apps/mobile/app/(habits)/log-craving.tsx` with the requested “How are you feeling?” hero, 1-10 intensity selector, multi-select trigger chips, context capture, strategy picker, notes area, and save flow to insights.
- Rebuilt `apps/mobile/app/(habits)/craving-insights.tsx` with total/average/resist-rate hero stats, SVG trigger donut, hourly pattern bars, intensity trend line, strategy effectiveness summary, location summary, and recent craving list.
- Added `apps/mobile/components/habits/phase5.ts` for Phase 5 helpers:
  - sobriety-track inference and recovery timelines
  - craving context serialization/parsing so location/companions/notes can persist through the existing `notes` field without schema changes
  - friendly time/date/currency formatting
- Both screens fall back to the first active sobriety profile when no `habitId` is present, matching the current hamburger-menu routing behavior.

## Verification
- `pnpm --dir apps/mobile exec eslint 'app/(habits)/sobriety-clock.tsx' 'app/(habits)/log-craving.tsx' 'app/(habits)/craving-insights.tsx' 'components/habits/phase5.ts'` ✅
- `pnpm --filter @mylife/mobile exec tsc --noEmit --pretty false 2>&1 | rg 'sobriety-clock|log-craving|craving-insights|components/habits/phase5|error TS'` ✅ no Phase 5 file errors surfaced; repo mobile typecheck still reports unrelated existing parse errors in `app/(budget)/review-transactions.tsx` and `app/(habits)/rpg.tsx`
- `pnpm gate:function:changed` ⚠️ failed in the existing dirty `apps/mobile` sweep on unrelated repo files, including Budget parse errors and numerous pre-existing lint warnings outside the touched Phase 5 files
- `pnpm --filter @mylife/mobile exec vitest run 'app/(habits)/__tests__/index.test.tsx'` ⚠️ still fails in existing habits-test infrastructure because the stale `@mylife/habits` mock does not include newer shared UI exports used by the rebuilt habits tabs

## Files Changed
- `apps/mobile/app/(habits)/sobriety-clock.tsx`
- `apps/mobile/app/(habits)/log-craving.tsx`
- `apps/mobile/app/(habits)/craving-insights.tsx`
- `apps/mobile/components/habits/phase5.ts`
- `docs/plans/myhabits-uiux-mission-control.html`
- `memory.md`

## Decisions
- Kept Phase 5 within the existing habits data model instead of expanding schema mid-sprint. Location and companion context now serialize into the craving `notes` payload so the UI can ship without a migration.
- Did not add `expo-location` because the current mobile app does not carry that dependency. The form supports manual location entry and the insights screen reads it back from saved context.
- Support resource actions use official public resources for 988, SAMHSA, and recovery-meeting lookup.

## Remaining Follow-ups
- Phase 6 can build on the same glass-card layout and habits helper patterns for stacking/program flows.
- The habits tab test mock should be refreshed in a separate session so targeted habits mobile tests can run against the newer shared habits UI exports.
- Global changed-file gates will stay noisy until the unrelated in-flight mobile parse/lint issues are cleaned up.
