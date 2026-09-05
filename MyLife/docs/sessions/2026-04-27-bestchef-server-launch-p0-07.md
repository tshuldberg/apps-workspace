# BestChef Server Launch P0-07

Date: 2026-04-27

## Phase

BCSERVER-P0-07: Moderation, Reporting, Safety Ops, and Admin Surface.

## Outcome

Completed locally for the minimum P0 SQL/function launch ops path.

Public launch now has a server-backed report and decision path:

- `bc_report_content` creates `bc_flags` and `bc_moderation_queue` rows for public social targets.
- `bc_apply_moderation_decision` applies role-gated decisions for submissions, comments, media assets, product contributions, product evidence, profiles, and vote proofs.
- `bc_moderation_decisions` records `previous_state` and `new_state` JSON snapshots for audit review.
- Vote-proof moderation decisions now write the same previous/new audit state.
- `ReportMenu` uses the cloud reporting RPC for cloud-backed targets and fails closed in public-launch mode instead of treating local SQLite as the public moderation authority.
- `docs/runbooks/bestchef-moderation-ops-runbook.md` documents the launch SQL/RPC operator path.

## Remaining Work

The full moderator/admin UI is not complete and is explicitly post-P0/P1 unless Product requires it before launch. Remaining work includes queue previews, target history, appeal notes, support-safe evidence export, staffing/SLAs, support macros, account lock/mute/suspension actions, and infrastructure-enforced rate limits.

## Files Changed

- `supabase/migrations/20260427000011_bestchef_moderation_ops.sql`
- `supabase/tests/bc_moderation_ops.sql`
- `supabase/tests/bc_vote_proofs.sql`
- `modules/bestchef/src/cloud/moderation.ts`
- `modules/bestchef/src/cloud/types.ts`
- `modules/bestchef/src/cloud/schema.sql`
- `modules/bestchef/src/cloud/submission.ts`
- `modules/bestchef/src/cloud/comments.ts`
- `modules/bestchef/src/cloud/ranking-engine.ts`
- `modules/bestchef/src/cloud/chef-profile.ts`
- `modules/bestchef/src/cloud/photo-verification.ts`
- `modules/bestchef/src/cloud/__tests__/moderation.test.ts`
- `modules/bestchef/src/cloud/__tests__/schema.test.ts`
- `modules/bestchef/src/cloud/__tests__/ranking-engine.test.ts`
- `modules/bestchef/src/index.ts`
- `apps/bestchef/app/(root)/components/ReportMenu.tsx`
- `apps/bestchef/app/(root)/recipe/[id].tsx`
- `docs/plans/features/recipes/bestchef-server-launch-mission-control.md`
- `docs/plans/features/recipes/bestchef-production-launch-mission-control.md`
- `docs/runbooks/bestchef-public-data-policy-runbook.md`
- `docs/runbooks/bestchef-moderation-ops-runbook.md`
- `memory.md`
- `errors_log.md`

## Verification

- `pnpm --filter @mylife/bestchef test -- moderation schema ranking-engine` passed.
- `pnpm --filter @mylife/bestchef typecheck` passed.
- `pnpm --filter @mylife/bestchef-app typecheck` passed.
- `pnpm --filter @mylife/bestchef-app test` passed with 116/116 tests.
- `pnpm --filter @mylife/bestchef-app test:uiux` passed with 27/27 tests.
- `pnpm --filter @mylife/bestchef test` passed with 787/787 tests.
- `supabase migration up --local` applied pending local migrations `20260427000010` and `20260427000011`.
- `supabase test db supabase/tests/bc_moderation_ops.sql --local` passed with 14/14 tests.
- `supabase test db supabase/tests/bc_vote_proofs.sql --local` passed with 44/44 tests.
- `pnpm gate:function:changed` passed after the host Recipes comments fixture was updated for the shared `CloudComment` type.
- `pnpm check:parity --quiet` passed with existing standalone parity warnings.
- `pnpm check:generated-artifacts` passed.

## Errors Logged

- Module typecheck initially failed after the content moderation status field became required on cloud entities. Resolved by mapping `moderationStatus` in all submission/comment mappers and updating the ranking fixture.
- Moderation pgTAP initially failed because the local DB had not applied the new migration and then exposed an ambiguous `target_id` reference. Resolved by qualifying queue/flag updates and patching the local test DB through the Supabase Postgres container.
- BestChef app test initially failed because the UIUX report-menu contract expected direct callback-backed menu items. Resolved by keeping `onPress: () => submit(key)`.
- Changed-function gate initially failed because the host mobile Recipes comments fixture needed `moderationStatus` on a `CloudComment` stub. Resolved and reran successfully.
