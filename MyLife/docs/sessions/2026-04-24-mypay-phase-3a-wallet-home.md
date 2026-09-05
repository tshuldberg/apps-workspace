# MyPay Phase 3A: wallet home and balance hero

## Summary

Built the Phase 3A wallet home across the shared payments module, mobile route, and web route. The new slice replaces the Phase 0 placeholder with a server-authoritative wallet projection that renders the MyPay header, handle, settings entry, available balance hero, pending indicator, disclosure slot, quick actions, recent activity preview, linked-account summary, realtime refresh metadata, read-only banner support, and prepared hooks for cards, remittance, and disputes.

The wallet disclosure slot is derived from the Phase 2D disclosure system. The shared wallet-home view model builds legal-copy blocks for stored balance, partner bank, custodial account, card, remittance cancellation, and error resolution, then maps the active hero state to the appropriate disclosure callout instead of hardcoding legal notice text in host UI components.

## Files Changed

- `modules/payments/src/wallet/home.ts`
- `modules/payments/src/wallet/index.ts`
- `modules/payments/src/wallet/__tests__/home.test.ts`
- `modules/payments/src/wallet/__tests__/home.function-gate.test.ts`
- `modules/payments/src/index.ts`
- `modules/payments/package.json`
- `apps/mobile/app/(payments)/index.tsx`
- `apps/web/app/payments/page.tsx`
- `memory.md`
- `errors_log.md`

## Implementation Notes

- Added `buildPaymentsWalletHomeViewModel` as the shared state mapper for wallet home.
- Modeled brand-new, zero, pending, available, and held hero states.
- Centralized send readiness, action enablement, read-only banner selection, linked-account state, activity empty state, and realtime channel names.
- Added focused tests for brand-new wallet setup, pending balance, degraded read-only mode, and held balance behavior.
- Added function-gate coverage for the wallet-home view model contract, fuzz invariants, complexity budget, and memory budget.
- Updated mobile and web wallet home surfaces to consume the same view model and render the Phase 3A sections from mission control.
- Started the web dev server on `http://localhost:3000` and verified `/payments` returns `HTTP/1.1 200 OK`.

## Verification

- `pnpm --filter @mylife/payments exec tsc --noEmit` passed.
- `pnpm --filter @mylife/payments test` passed: 26 files, 95 tests.
- `pnpm --filter @mylife/mobile typecheck` passed.
- `pnpm --filter @mylife/web typecheck` passed.
- `pnpm gate:function --file modules/payments/src/wallet/home.ts` passed.
- `pnpm --dir apps/mobile exec eslint 'app/(payments)/index.tsx' --ext .tsx` passed.
- `pnpm --dir apps/web exec eslint app/payments/page.tsx --ext .tsx` passed.
- `curl -I http://localhost:3000/payments` returned `HTTP/1.1 200 OK`.

## Blocked Verification

- `pnpm gate:function --file apps/mobile/app/(payments)/index.tsx` is blocked by the existing duplicate Notes route lint error at `apps/mobile/app/(notes)/discovery 2.tsx:48`.
- `pnpm gate:function --file apps/web/app/payments/page.tsx` is blocked by the existing Shop lint rule-resolution error at `apps/web/app/shop/purchases/[id]/page.tsx:194` and `:202`.
- `pnpm gate:function:changed` still stops at mobile package lint for the same duplicate Notes route and reports `✖ 831 problems (1 error, 830 warnings)`.

## Next Step

The next MyPay mission-control slice is `P3-B`, the send money flow.
