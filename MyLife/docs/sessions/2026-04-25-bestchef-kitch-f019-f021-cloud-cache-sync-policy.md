# BestChef KITCH-F019-F021 Cloud Cache And Sync Policy

Date: 2026-04-25

## What Changed

- Added BestChef server product cache schema for product records, aliases, nutrition rows, user contributions, and product evidence.
- Stored product source, source id, source URL, confidence, license, attribution, fetched timestamp, confirmed timestamp, moderation status, and publication status.
- Added contribution workflow states for `private_draft`, `submitted`, `verified`, `rejected`, and `superseded`.
- Added explicit sharing opt-in, evidence opt-in, image license, and image consent requirements before product data or evidence can publish.
- Added RLS and public-content delta filtering so private pantry quantities, receipt rows, receipt images, raw OCR, and unapproved evidence do not publish by default.
- Capped local kitchen product, nutrition, pantry, pantry batch, receipt, and receipt line sync rules at `personal_replica`.
- Kept grocery lists personal by default while allowing `shared_workspace` by policy.
- Added sync scope ordering enforcement for direct entity sharing.

## Why

BestChef needed a shared product cache and contribution path without converting private pantry inventory, receipt review data, or source images into public or workspace data by accident.

## Files Changed

- `modules/bestchef/src/cloud/schema.sql`
- `supabase/migrations/20260424000005_add_bestchef_core_hub.sql`
- `modules/bestchef/src/cloud/types.ts`
- `modules/bestchef/src/cloud/client.ts`
- `modules/bestchef/src/cloud/moderation.ts`
- `modules/bestchef/src/cloud/__tests__/schema.test.ts`
- `modules/bestchef/src/cloud/__tests__/moderation.test.ts`
- `modules/bestchef/src/db/__tests__/pantry.test.ts`
- `modules/bestchef/src/social/__tests__/follower-updates.test.ts`
- `modules/bestchef/src/definition.ts`
- `packages/sync/src/types.ts`
- `packages/sync/src/index.ts`
- `packages/sync/src/index.native.ts`
- `packages/sync/src/engine/sync-engine.ts`
- `packages/sync/src/__tests__/security-redteam.test.ts`
- `docs/designs/mesh-sync-module-policy-matrix.md`
- `docs/plans/queue/08-mesh-sync-mission-control.md`
- `docs/plans/features/recipes/bestchef-kitchen-intelligence-feature-bug-backlog.md`
- `memory.md`

## Verification

- `pnpm --filter @mylife/bestchef-app test:uiux` passed, 10 tests.
- `pnpm --filter @mylife/bestchef-app test` passed, 41 tests.
- `pnpm --filter @mylife/bestchef-app typecheck` passed.
- `pnpm --filter @mylife/bestchef test` passed, 676 tests.
- `pnpm --filter @mylife/bestchef typecheck` passed.
- `pnpm --filter @mylife/sync test -- src/__tests__/security-redteam.test.ts` passed, 25 tests.
- `pnpm --filter @mylife/sync typecheck` passed.
- `pnpm check:parity --quiet` passed with existing standalone-missing warnings.
- `pnpm gate:function:changed` passed. Existing mobile/web lint warnings remained warning-only.

## Remaining

- No standalone UI was added for viewing or moderating product contributions in this slice.
- Open Food Facts export is represented as workflow status only. Actual upstream submission integration still needs a provider job and legal/product review.
- Product evidence upload/storage jobs and moderation operator surfaces remain separate server launch work.
