# MyPay Phase 1B: ledger and domain engine

Date: 2026-04-20

## Summary

Built MyPay Phase 1B on top of the existing Phase 1A money-core schema by adding a pure package-local engine in `modules/payments/src/engine/`.

This slice adds:

- transfer and request state machines with explicit legal transitions
- stable domain errors for insufficient funds, limits, compliance holds, stale quotes, provider deadlines, and idempotency conflicts
- fee policy for P2P, instant payout, merchant, card, and remittance flows
- balance-availability rules for internal sends, funding, and withdrawals
- balanced ledger-plan builders for transfers and reversals
- an idempotent command executor for send, request, fund, withdraw, reverse, dispute-open, and dispute-close

## Files changed

- `modules/payments/src/engine/types.ts`
- `modules/payments/src/engine/errors.ts`
- `modules/payments/src/engine/fsm.ts`
- `modules/payments/src/engine/fees.ts`
- `modules/payments/src/engine/availability.ts`
- `modules/payments/src/engine/idempotency.ts`
- `modules/payments/src/engine/ledger.ts`
- `modules/payments/src/engine/engine.ts`
- `modules/payments/src/engine/index.ts`
- `modules/payments/src/engine/__tests__/fsm.test.ts`
- `modules/payments/src/engine/__tests__/fees.test.ts`
- `modules/payments/src/engine/__tests__/engine.test.ts`
- `modules/payments/src/index.ts`

## Design choices

- The engine stays pure and local to the payments package. It does not require a live Supabase runtime to validate command semantics.
- External funding and withdrawal flows are modeled through an explicit settlement wallet so the generated ledger plans stay balanced by currency.
- Idempotency is handled before result persistence and only stores successful command outcomes. Failed attempts do not poison later retries with the same key.
- Reversal builds a new reversal transfer plus an inverted ledger plan. Dispute open and dispute close stay as status transitions on the existing transfer model.
- Phase 1A schema and migration were not changed in this slice. Phase 1B is a package-domain layer above that storage boundary.

## Verification

Passed:

- `pnpm --filter @mylife/payments test`
- `pnpm --filter @mylife/payments exec tsc --noEmit`
- `pnpm gate:function --dir modules/payments`

Blocked outside Payments:

- `pnpm gate:function:changed`

The shared changed-file gate still fails on the existing unrelated mobile lint error:

- `apps/mobile/app/(notes)/discovery 2.tsx:48`
- `react-hooks/rules-of-hooks`
- `React Hook "useMemo" is called conditionally`

## Next step

Phase 1C can now wire provider adapters and runtime orchestration against a real domain surface instead of embedding business rules directly in route handlers or SQL entrypoints.

