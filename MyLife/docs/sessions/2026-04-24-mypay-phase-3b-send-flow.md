# MyPay Phase 3B: send flow

## Summary

Built the Phase 3B send-money slice for mobile on top of the existing server-authoritative payments layers. The new flow lets a user choose a recipient by handle, phone, email, contact source, or previous counterparty, enter an amount and optional note, preview fees, speed, balance impact, policy warnings, and confirm with biometric or strong step-up auth where configured.

The send surface reuses the domain engine, risk assessment, identity tiers, idempotency, provider timeout, compliance hold, and Phase 2D disclosure/legal-copy surfaces instead of introducing host-only payment semantics.

## Files Changed

- `modules/payments/src/wallet/send.ts`
- `modules/payments/src/wallet/index.ts`
- `modules/payments/src/wallet/__tests__/send.test.ts`
- `modules/payments/src/wallet/__tests__/send.function-gate.test.ts`
- `apps/mobile/app/(payments)/send.tsx`
- `apps/mobile/app/(payments)/index.tsx`
- `apps/mobile/app/(payments)/_layout.tsx`
- `memory.md`
- `errors_log.md`

## Implementation Notes

- Added `buildPaymentsSendFlowViewModel` for recipient matching, amount parsing, preview construction, policy warnings, confirmation readiness, and result-state projection.
- Added deterministic `buildPaymentsSendIdempotencyKey` output from the client submission id plus stable transfer fingerprint.
- Mapped blocked states to existing domain error codes: `invalid_command`, `wallet_unavailable`, `insufficient_funds`, `limit_blocked`, `compliance_hold`, `stale_quote`, and `provider_timeout`.
- Mapped successful, manual-review, failed, and duplicate replay results with `mapPaymentsSendSubmissionState`.
- Added focused tests for amount parsing, recipient search, low-tier limits, compliance holds, stale quotes, insufficient funds, auth gating, domain success, duplicate replay, provider timeout mapping, and function-gate invariants.
- Added the mobile `/(payments)/send` route and wired the wallet-home Send quick action to it.
- Added scenario controls in the mobile screen for ready, manual review, insufficient funds, tier limit, account hold, stale quote, and provider timeout states.

## Verification

- `pnpm --filter @mylife/payments exec tsc --noEmit` passed.
- `pnpm --filter @mylife/payments test -- --run src/wallet/__tests__/send.test.ts src/wallet/__tests__/send.function-gate.test.ts` passed: 2 files, 10 tests.
- `pnpm --filter @mylife/mobile typecheck` passed after fixing the new send route icon names and command narrowing.
- `pnpm --filter @mylife/payments test` passed: 28 files, 105 tests.
- `pnpm --dir apps/mobile exec eslint "app/(payments)/send.tsx" "app/(payments)/index.tsx" "app/(payments)/_layout.tsx"` passed.
- `pnpm gate:function --file modules/payments/src/wallet/send.ts` passed.

## Blocked Verification

- `pnpm gate:function --file apps/mobile/app/(payments)/send.tsx` is blocked by the existing duplicate Notes route lint error at `apps/mobile/app/(notes)/discovery 2.tsx:48`.
- `pnpm gate:function --file apps/mobile/app/(payments)/index.tsx` is blocked by the same duplicate Notes route lint error.
- `pnpm gate:function --file apps/mobile/app/(payments)/_layout.tsx` is blocked by the same duplicate Notes route lint error.
- `pnpm gate:function:changed` still stops at mobile package lint for the same duplicate Notes route and reports `✖ 831 problems (1 error, 830 warnings)`.

## Next Step

The next MyPay mission-control slice is `P3-C`, requests and payment links.
