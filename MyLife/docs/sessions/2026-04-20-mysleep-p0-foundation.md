# MySleep P0 foundation

Date: 2026-04-20

## Summary

Reviewed the live MyLife architecture, memory, and existing module contracts before starting MySleep. That review exposed drift in the MySleep proposal and mission control, so I corrected the plan first, then shipped P0-A through P0-C as a hidden foundation:

- new `@mylife/sleep` package with `ModuleDefinition`, schema v1, and starter tests
- registry, billing, consent, and release-state wiring for a hidden health-data-sensitive module
- hidden mobile `(sleep)` route shells and hidden web `/sleep` starter pages
- mission-control and proposal scope narrowed to Mood, Habits, and Health only

## Review findings that changed the plan

- The mission control subtitle and prompt count were out of sync with the actual 25 prompt cards.
- The doc referenced a nonexistent `apps/mobile/lib/module-icons.ts` path.
- Real host touchpoints were missing from the plan, especially `apps/mobile/components/DatabaseProvider.tsx` and `apps/web/lib/db.ts`.
- The initial rollout needed to stay hidden instead of assuming dashboard/sidebar visibility immediately.
- MySleep needed to be treated as its own `sl_` data domain rather than reusing MyHealth sleep tables.
- The requested cross-module scope was tightened to Mood, Habits, and Health only.

## Files changed

Planning and tracking:

- `docs/plans/modules/proposal-mysleep.md`
- `docs/plans/mysleep-mission-control.html`

New MySleep package:

- `modules/sleep/package.json`
- `modules/sleep/tsconfig.json`
- `modules/sleep/CLAUDE.md`
- `modules/sleep/src/index.ts`
- `modules/sleep/src/types.ts`
- `modules/sleep/src/definition.ts`
- `modules/sleep/src/db/index.ts`
- `modules/sleep/src/db/schema.ts`
- `modules/sleep/src/db/migrations/001_init.sql`
- `modules/sleep/src/__tests__/definition.test.ts`
- `modules/sleep/src/__tests__/schema.test.ts`

Registry and host wiring:

- `packages/module-registry/src/types.ts`
- `packages/module-registry/src/constants.ts`
- `packages/module-registry/src/release-states.ts`
- `packages/module-registry/src/__tests__/release-states.test.ts`
- `packages/ui/src/tokens/colors.ts`
- `packages/billing-config/src/index.ts`
- `packages/search/src/__tests__/grouping.property.test.ts`
- `packages/db/src/__tests__/health-consent.property.test.ts`
- `apps/mobile/package.json`
- `apps/mobile/app/_layout.tsx`
- `apps/mobile/components/DatabaseProvider.tsx`
- `apps/mobile/hooks/use-module-toggle.ts`
- `apps/web/package.json`
- `apps/web/components/Providers.tsx`
- `apps/web/lib/db.ts`
- `apps/web/lib/modules.ts`
- `apps/web/lib/module-icons.ts`
- `apps/web/app/__tests__/actions-enabled-modules.test.ts`

Route shells:

- `apps/mobile/app/(sleep)/_layout.tsx`
- `apps/mobile/app/(sleep)/_ui.tsx`
- `apps/mobile/app/(sleep)/index.tsx`
- `apps/mobile/app/(sleep)/dreams.tsx`
- `apps/mobile/app/(sleep)/insights.tsx`
- `apps/mobile/app/(sleep)/settings.tsx`
- `apps/web/app/sleep/layout.tsx`
- `apps/web/app/sleep/_ui.tsx`
- `apps/web/app/sleep/page.tsx`
- `apps/web/app/sleep/dreams/page.tsx`
- `apps/web/app/sleep/insights/page.tsx`
- `apps/web/app/sleep/settings/page.tsx`

Project memory and ledger:

- `memory.md`
- `errors_log.md`

## Verification

Passed:

- `pnpm --filter @mylife/sleep test`
- `pnpm --filter @mylife/sleep typecheck`
- `pnpm --filter @mylife/module-registry exec vitest run src/__tests__/release-states.test.ts src/__tests__/registry.test.ts src/__tests__/types.test.ts --coverage.enabled false`
- `pnpm --filter @mylife/module-registry exec tsc --noEmit`
- `pnpm --filter @mylife/web exec vitest run app/__tests__/actions-enabled-modules.test.ts`
- `pnpm --filter @mylife/mobile exec eslint 'app/(sleep)' 'app/_layout.tsx' 'components/DatabaseProvider.tsx' 'hooks/use-module-toggle.ts' --ext .ts,.tsx`
- `pnpm --filter @mylife/web exec eslint 'app/sleep' 'lib/modules.ts' 'lib/module-icons.ts' 'components/Providers.tsx' --ext .ts,.tsx`

Resolved during verification:

- `packages/module-registry/src/release-states.ts` had existing drift: `friends` existed in the registry but was missing from every release bucket. Classified it as `hidden` and updated the test expectations.

Blocked outside MySleep:

- `pnpm gate:function:changed`

The required shared gate still fails on an unrelated mobile lint error in:

- `apps/mobile/app/(notes)/discovery 2.tsx`
- `react-hooks/rules-of-hooks`
- `React Hook "useMemo" is called conditionally`

That blocker predates MySleep and still prevents the repo-wide changed-file gate from going green.

## Next step

P1 can now start on sleep-entry CRUD and supporting helpers without revisiting host wiring. The integration track should stay constrained to Mood, Habits, and Health unless the mission control is intentionally widened again.
