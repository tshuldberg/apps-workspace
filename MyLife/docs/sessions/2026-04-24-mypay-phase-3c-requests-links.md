# MyPay Phase 3C: requests and payment links

## Summary

Built the Phase 3C requests and payment-links slice for mobile on top of the existing server-authoritative payments layers. The new flow supports direct requests to known MyLife users and single-use payment links for non-users or off-network contacts, with explicit expiry, anti-abuse constraints, pending / paid / declined / expired / canceled states, reminders, cancellation, and payer acceptance through the existing send transfer engine.

The request surface keeps requests distinct from guaranteed receivables. Funds do not move until payer acceptance produces a send command and the domain engine posts the transfer.

## Files Changed

- `modules/payments/src/wallet/request.ts`
- `modules/payments/src/wallet/index.ts`
- `modules/payments/src/wallet/__tests__/request.test.ts`
- `modules/payments/src/wallet/__tests__/request.function-gate.test.ts`
- `apps/mobile/app/(payments)/request.tsx`
- `apps/mobile/app/(payments)/index.tsx`
- `apps/mobile/app/(payments)/_layout.tsx`
- `memory.md`
- `errors_log.md`

## Implementation Notes

- Added `buildPaymentsRequestFlowViewModel` for target search, amount parsing, expiry validation, anti-abuse policy validation, request preview, policy notices, result-state projection, and request detail state.
- Added deterministic `buildPaymentsRequestIdempotencyKey` output from the client submission id plus stable request fingerprint.
- Added `buildPaymentsRequestAcceptanceSendCommand` so request acceptance routes through the existing P3-B send command path.
- Added detail/timeline helpers for pending, paid, declined, expired, and canceled states. Requester and payer timelines are the same timeline object by design.
- Added reminder, cancel, accept, and decline action state with reminder cooldown and max-reminder constraints.
- Added focused tests for direct requests, payment-link guardrails, timeline state mapping, send-engine acceptance, duplicate replay, exact domain error-code mapping, and function-gate invariants.
- Added the mobile `/(payments)/request` route and wired the wallet-home Request quick action to it.

## Verification

- `pnpm --filter @mylife/payments exec tsc --noEmit` passed.
- `pnpm --filter @mylife/mobile typecheck` passed.
- `pnpm --filter @mylife/payments test -- --run src/wallet/__tests__/request.test.ts src/wallet/__tests__/request.function-gate.test.ts` passed: 2 files, 9 tests.
- `pnpm --filter @mylife/payments test` passed on rerun: 30 files, 114 tests.
- `pnpm --dir apps/mobile exec eslint "app/(payments)/request.tsx" "app/(payments)/index.tsx" "app/(payments)/_layout.tsx"` passed.
- `pnpm gate:function --file modules/payments/src/wallet/request.ts` passed.

## Blocked Verification

- The first `pnpm --filter @mylife/payments test` run failed on an existing timing-sensitive risk function-gate slope check in `src/risk/__tests__/assessment.function-gate.test.ts`; the isolated risk gate passed immediately after and the full payments suite passed on rerun.
- `pnpm gate:function --file apps/mobile/app/(payments)/request.tsx` is blocked by the existing duplicate Notes route lint error at `apps/mobile/app/(notes)/discovery 2.tsx:48`.
- `pnpm gate:function --file apps/mobile/app/(payments)/index.tsx` is blocked by the same duplicate Notes route lint error.
- `pnpm gate:function --file apps/mobile/app/(payments)/_layout.tsx` is blocked by the same duplicate Notes route lint error.
- `pnpm gate:function:changed` still stops at mobile package lint for the same duplicate Notes route and reports `✖ 831 problems (1 error, 830 warnings)`.

## Next Step

The next MyPay mission-control slice is `P3-D`, activity feed, transaction detail, and issue reporting.
