# BestChef Server Launch P0-06

Date: 2026-04-27

## Summary

Completed BCSERVER-P0-06 locally for the no-public-seed launch path. Public launch mode now suppresses demo social content and blocks demo cloud alias writes unless an approved seed revision is configured.

## Shipped

- Added shared seed approval, rollback, render-decision, and public media URL helpers in `modules/bestchef`.
- Hardened app public-data and public-render policies so public launch requires an approved seed revision before any demo override can write or render.
- Guarded public social routes for home feed entry points, comments, recipe detail, chef profile, challenges, and CookProof vote demo lookups.
- Normalized submission alias media before cloud writes and added HTTPS-only `photo_url` constraints for public BestChef rows.
- Added static route and helper tests for demo social suppression, seed approval/rollback, approved editorial labeling, and local media URI rejection.

## Files Changed

- `apps/bestchef/app/(root)/(tabs)/index.tsx`
- `apps/bestchef/app/(root)/challenges.tsx`
- `apps/bestchef/app/(root)/chef/[id].tsx`
- `apps/bestchef/app/(root)/comments/[submissionId].tsx`
- `apps/bestchef/app/(root)/data/cloud-submissions.ts`
- `apps/bestchef/app/(root)/data/public-data-policy.ts`
- `apps/bestchef/app/(root)/data/public-render-policy.ts`
- `apps/bestchef/app/(root)/data/__tests__/cloud-submissions.function-gate.test.ts`
- `apps/bestchef/app/(root)/data/__tests__/cloud-submissions.test.ts`
- `apps/bestchef/app/(root)/data/__tests__/public-data-policy.function-gate.test.ts`
- `apps/bestchef/app/(root)/data/__tests__/public-data-policy.test.ts`
- `apps/bestchef/app/(root)/data/__tests__/public-render-policy.test.ts`
- `apps/bestchef/app/(root)/data/__tests__/public-social-routes.test.ts`
- `apps/bestchef/app/(root)/recipe/[id].tsx`
- `apps/bestchef/app/(root)/submission/[id]/vote.tsx`
- `modules/bestchef/src/cloud/public-data-policy.ts`
- `modules/bestchef/src/cloud/submission-alias.ts`
- `modules/bestchef/src/cloud/schema.sql`
- `modules/bestchef/src/cloud/__tests__/public-data-policy.test.ts`
- `modules/bestchef/src/cloud/__tests__/schema.test.ts`
- `modules/bestchef/src/index.ts`
- `supabase/migrations/20260427000010_bestchef_public_data_policy.sql`
- `docs/plans/features/recipes/bestchef-server-launch-mission-control.md`
- `docs/plans/features/recipes/bestchef-production-launch-mission-control.md`
- `docs/runbooks/bestchef-public-data-policy-runbook.md`
- `memory.md`

## Verification

- `pnpm --filter @mylife/bestchef-app typecheck` passed.
- `pnpm --filter @mylife/bestchef-app test` passed, 18 files and 116 tests.
- `pnpm --filter @mylife/bestchef-app test:uiux` passed, 27 tests.
- `pnpm --filter @mylife/bestchef typecheck` passed.
- `pnpm --filter @mylife/bestchef test` passed, 59 files and 783 tests.
- `pnpm gate:function --file modules/bestchef/src/cloud/public-data-policy.ts` passed.
- `pnpm gate:function --file apps/bestchef/app/(root)/data/public-data-policy.ts` passed.
- `pnpm gate:function --file apps/bestchef/app/(root)/data/public-render-policy.ts` passed.
- `pnpm gate:function:changed` passed across the current dirty worktree with existing warning-only mobile/web lint debt.
- `pnpm check:parity --quiet` passed with existing missing-standalone warnings.
- `pnpm check:generated-artifacts` passed.

## Caveats

- No Product/Legal seed approval artifact was supplied, so public launch remains no-public-seed by default.
- If editorial or partner seed content is desired, a server seed import job and approval/rollback evidence remain required before seed rendering can be enabled.
- Staging/production deployment evidence for prior BCVOTE and media/storage phases remains pending.

## Next Phase

BCSERVER-P0-07: moderation, reporting, safety ops, and admin surface.
