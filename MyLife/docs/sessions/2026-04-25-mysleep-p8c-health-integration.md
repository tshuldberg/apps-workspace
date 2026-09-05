# MySleep P8-C Health Integration

Date: 2026-04-25

## Scope

Implemented the explicit opt-in bridge between MySleep and MyHealth.

## Changes

- Added `modules/sleep/src/integrations/health.ts` with:
  - `getHealthBridgeSummary(db, dateRange?)`
  - `buildHealthSyncPreview(db, dateRange?)`
  - shared bridge setting constants and typed summary/preview contracts
- Added `modules/health/src/integrations/sleep-link.ts` with:
  - `getSleepJournalContext(db, dateRange?)`
  - `getManualSleepBridgeStatus(db)`
  - `setManualSleepBridgeEnabled(db, enabled)`
- Exported the bridge APIs from `@mylife/sleep` and `@mylife/health`.
- Wired Sleep Insights on mobile and web to show either:
  - a consented Health summary, or
  - a Health Bridge Preview that lists what would and would not be shared before opt-in.
- Wired Health dashboard on mobile and web to show MySleep journal context.
- Added explicit consent UI:
  - web Health Settings toggle for `MySleep Journal Bridge`
  - mobile Health Today consent card with an `Enable Summary Bridge` action.
- Added focused package, function-gate, mobile, and web coverage.

## Privacy Boundary

- MySleep remains the canonical manual sleep journal.
- MyHealth remains the canonical health and sensor summary surface.
- The bridge never writes MySleep rows into `hl_sleep_sessions`.
- The consumable Health summary is unavailable until explicit consent is enabled.
- The Sleep-side preview can show what aggregate fields would be shared before opt-in.

## Verification

- Passed: `pnpm scaffold:function-test --file modules/sleep/src/integrations/health.ts --function getHealthBridgeSummary`
- Passed: `pnpm scaffold:function-test --file modules/health/src/integrations/sleep-link.ts --function getSleepJournalContext`
- Passed: `pnpm --filter @mylife/sleep typecheck`
- Passed: `pnpm --filter @mylife/health typecheck`
- Passed: `pnpm --filter @mylife/sleep test -- src/__tests__/health-integration.test.ts src/integrations/__tests__/health.function-gate.test.ts`
- Passed: `pnpm --filter @mylife/health test -- src/__tests__/sleep-link.test.ts src/integrations/__tests__/sleep-link.function-gate.test.ts`
- Passed: `pnpm --filter @mylife/mobile test -- 'app/(sleep)/__tests__/insights.test.tsx' 'app/(health)/__tests__/index.test.tsx'`
- Passed: `pnpm --filter @mylife/web test -- app/sleep/insights/__tests__/page.test.tsx app/health/__tests__/health-page.test.tsx`
- Passed: `pnpm --filter @mylife/mobile typecheck`
- Passed: `pnpm --filter @mylife/web typecheck`
- Passed: file-scoped mobile ESLint for touched Sleep and Health files. Warning-only existing Health Today hook/import lint remains.
- Passed: file-scoped web ESLint for touched Sleep and Health files.
- Passed: `pnpm gate:function --file modules/sleep/src/integrations/health.ts --tests src/__tests__/health-integration.test.ts,src/integrations/__tests__/health.function-gate.test.ts`
- Passed: `pnpm gate:function --file modules/health/src/integrations/sleep-link.ts --tests src/__tests__/sleep-link.test.ts,src/integrations/__tests__/sleep-link.function-gate.test.ts`
- Passed: `pnpm gate:function:changed`
- Passed: `pnpm check:parity --quiet`

## Notes

- `pnpm gate:function:changed` scanned the current dirty worktree and passed, including unrelated BestChef, Payments, Sync, Mood, Habits, and host gates.
- The mobile Sleep Insights host test still prints the known React Native web warning for `showsVerticalScrollIndicator`; it does not fail the test.
- No new `errors_log.md` row was added because P8-C verification did not hit a failing build, test, typecheck, lint, function gate, or parity gate.
- Full package `pnpm --filter @mylife/sleep test` was not rerun because historical package-wide timing-sensitive function-gate failures remain tracked separately.

## Continuation Prompt

Continue MySleep with Phase P8-D in `/Users/trey/Desktop/Apps/MyLife`.

Current date: 2026-04-25.

Read `AGENTS.md` and `CLAUDE.md` before substantial edits. Follow repo rules: TypeScript-first, use `apply_patch` for manual edits, update `memory.md`, `errors_log.md`, `docs/plans/mysleep-mission-control.html`, and a dated session log, and run the function quality gate for new or changed function logic.

Current MySleep state:

- P0-A through P8-C are complete.
- P8-C shipped:
  - `modules/sleep/src/integrations/health.ts`
  - `getHealthBridgeSummary(db, dateRange?)`
  - `buildHealthSyncPreview(db, dateRange?)`
  - `modules/health/src/integrations/sleep-link.ts`
  - `getSleepJournalContext(db, dateRange?)`
  - `getManualSleepBridgeStatus(db)`
  - `setManualSleepBridgeEnabled(db, enabled)`
  - Sleep and Health mobile/web summary and preview cards
  - explicit Health bridge consent UI
  - focused package, function-gate, mobile, and web tests
- `pnpm gate:function:changed` passed on 2026-04-25.
- Full package `pnpm --filter @mylife/sleep test` was not rerun; existing package-wide timing-sensitive function-gate history remains tracked in `errors_log.md`.

Next task from `docs/plans/mysleep-mission-control.html`:

P8-D - Mood + Habits + Health triad bundle.

Files to create:

- `modules/sleep/src/integrations/triad.ts`
  - `getSleepRoutineMoodInsights(dateRange)`: combine sleep quality, routine adherence, and mood outcomes
  - `getSleepHealthMoodSummary(dateRange)`: combine manual sleep trends, health context, and mood recovery notes
- `modules/sleep/src/engine/cross-module-insights.ts`
  - `buildCompositeInsightCards(input)`: returns human-readable cards with confidence + sample size
  - `filterLowConfidenceInsights(cards)`: suppress tiny or noisy samples

Integration pattern:

- Use only Mood, Habits, and Health bridge outputs.
- Gracefully hide only the affected composite insights when one module is disabled.
- Each insight reports sample size and avoids causal claims.

Acceptance:

- Composite insights never depend on disallowed modules.
- Insight text stays descriptive, not diagnostic or prescriptive.
- All composite cards degrade cleanly when one bridge is unavailable.
