# MyPay Phase 0A-0D Build

Date: 2026-04-20

## What I changed

Built the MyPay Phase 0 foundation as a hidden hub module.

- Created `modules/payments/` with:
  - `package.json`, `tsconfig.json`
  - `src/definition.ts`
  - `src/index.ts`
  - `src/types.ts`
  - `src/ui/{tokens,typography,format,index,index.native,components,components.native}.ts[x]`
  - `src/cloud/{config,provider,fake-provider,runtime,index}.ts`
  - tests for amount formatting and runtime config
- Added `payments` to the live registry contract in `packages/module-registry`:
  - `ModuleId`
  - `MODULE_IDS`
  - `MODULE_METADATA`
  - `HIDDEN_MODULE_IDS`
  - release-state tests and registry tests
- Added MyPay accent coverage to shared helpers:
  - `packages/ui/src/tokens/colors.ts`
  - `apps/web/lib/module-icons.ts`
  - `packages/billing-config/src/index.ts` exclusion list for not-yet-sold standalone SKUs
- Wired the hidden module into hosts:
  - `apps/mobile/app/_layout.tsx`
  - `apps/web/components/Providers.tsx`
  - `packages/db/src/hub-queries.ts` cloud-storage module set
  - `apps/mobile/package.json`
  - `apps/web/package.json`
- Added route scaffolds:
  - mobile `(payments)` tab group with `index`, `activity`, `cards`, `protect`, `settings`
  - web `/payments` scaffold page
- Fixed web architecture so hidden modules stay hidden even if route support exists:
  - `apps/web/lib/modules.ts` now separates `WEB_SUPPORTED_MODULE_IDS` from `WEB_VISIBLE_MODULE_IDS`
  - `apps/web/app/actions.ts` bootstraps and enables only visible modules
  - `apps/web/app/discover/page.tsx` and `apps/web/app/__tests__/actions-enabled-modules.test.ts` updated to match

## Decisions

- Kept `payments` in `HIDDEN_MODULE_IDS`.
- Treated Payments as a server-authoritative `supabase` module from day one.
- Did not add a live billing SKU yet. `payments` is excluded from the current standalone product map until pricing and launch packaging are decided.
- Added both web and native UI surfaces so the shared payment primitives render on both platforms without repeating styling.
- Kept provider orchestration behind `modules/payments/src/cloud/` and did not export it from the root barrel.

## Verification

Passed:

- `pnpm install`
- `pnpm --filter @mylife/payments test`
- `pnpm --filter @mylife/payments exec tsc --noEmit`
- `pnpm --filter @mylife/module-registry test`
- `pnpm --filter @mylife/web exec vitest run app/__tests__/actions-enabled-modules.test.ts`
- `pnpm --filter @mylife/mobile exec tsc --noEmit`
- `pnpm --filter @mylife/web typecheck`

Required gate:

- Ran `pnpm gate:function:changed`
- Result: failed on an unrelated pre-existing dirty-worktree file, `apps/mobile/app/(notes)/discovery 2.tsx`, with `react-hooks/rules-of-hooks` (`useMemo` called conditionally)
- Logged in `errors_log.md`

## Remaining follow-up

- Add real ledger schema, projections, and provider-backed routes in later MyPay phases.
- Decide eventual billing packaging for Payments.
- Clear the unrelated duplicate Notes route lint failure so shared changed-file gates can pass cleanly again.
