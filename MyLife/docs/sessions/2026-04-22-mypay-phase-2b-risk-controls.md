# MyPay Phase 2B: risk controls

## Summary

Built MyPay Phase 2B by adding a pure TypeScript risk layer under `modules/payments/src/risk/` and wiring it into the payments domain engine. This slice covers OFAC and sanctions checkpoints, tier-aware velocity rules, simple first-launch behavior flags, operator case and queue primitives, and pre-posting hold or reject behavior with machine reasons plus user-safe explanations.

No schema or RPC changes were required for this phase. The Phase 1A core already had the right server-authoritative attachment points in `pay_transfers`, `pay_transfer_events`, and `pay_compliance_cases`, so Phase 2B stayed in the domain layer.

## Files Changed

- `modules/payments/src/risk/types.ts`
- `modules/payments/src/risk/screening.ts`
- `modules/payments/src/risk/velocity.ts`
- `modules/payments/src/risk/behavior.ts`
- `modules/payments/src/risk/assessment.ts`
- `modules/payments/src/risk/index.ts`
- `modules/payments/src/risk/__tests__/screening.test.ts`
- `modules/payments/src/risk/__tests__/velocity.test.ts`
- `modules/payments/src/risk/__tests__/assessment.test.ts`
- `modules/payments/src/risk/__tests__/assessment.function-gate.test.ts`
- `modules/payments/src/engine/engine.ts`
- `modules/payments/src/engine/fsm.ts`
- `modules/payments/src/engine/index.ts`
- `modules/payments/src/engine/__tests__/engine.test.ts`
- `modules/payments/src/engine/__tests__/fsm.test.ts`
- `modules/payments/src/compliance/tiers.ts`
- `modules/payments/src/index.ts`
- `modules/payments/package.json`
- `memory.md`
- `errors_log.md`

## What Built

### Risk domain surface

- Added typed risk primitives for sanctions parties, watchlist hooks, velocity history, behavior context, case references, workflow tags, and review queue items.
- Added sanctions screening helpers that support explicit screening states (`potential_match`, `confirmed_match`, `blocked_country`, `provider_error`) plus a simple local watchlist fallback for first-launch hooks.
- Added tier-aware velocity policies keyed by payment type so P2P, funding, withdrawal, merchant, and remittance flows can each enforce single-transfer and rolling limits without changing transfer tables.
- Added first-launch behavior checks for new high-value devices, country mismatch, recent password reset, and repeat rejected transfer patterns.

### Hold, release, and reject primitives

- Added transfer-risk assessment that combines sanctions, velocity, and behavior findings into a single `approve`, `hold`, or `reject` outcome.
- Added case-reference generation aligned to existing schema enums (`ofac_screening`, `aml_review`, `fraud_review`) plus reusable workflow tags for future suspicious-activity work.
- Added `resolvePaymentsRiskCaseDecision()` so held transfers can later move to release or reject outcomes with explicit case status updates and event types.

### Engine integration

- Added an optional `riskGuard` hook to `createPaymentsDomainEngine()`.
- Approved transfers keep the existing posting behavior.
- Held transfers now return `pending_review` with `hold_applied`, no ledger entries, and structured risk metadata attached to the transfer.
- Rejected transfers now fail before posting and surface machine reason codes, case references, and user-safe copy through `PaymentsDomainError.details`.
- Updated FSM event mapping so `pending_review` creation emits `hold_applied` and review release emits `hold_released`.

## Verification

Passed:

- `pnpm --filter @mylife/payments exec tsc --noEmit`
- `pnpm --filter @mylife/payments test`
- `pnpm gate:function --file modules/payments/src/risk/assessment.ts`
- `pnpm gate:function --file modules/payments/src/engine/engine.ts`

Known blocker:

- `pnpm gate:function:changed`
  - still stops in the unrelated dirty mobile tree at `apps/mobile/app/(notes)/discovery 2.tsx:48`
  - exact error remains `React Hook "useMemo" is called conditionally`
  - latest reconfirmation on `2026-04-22`: `✖ 824 problems (1 error, 823 warnings)`

## Decisions

- Kept Phase 2B server-authoritative and schema-neutral because the current Postgres design already has `pending_review`, hold events, and compliance-case primitives.
- Holds do not post ledger entries. The transfer remains representable and reviewable, but funds do not move until a later release path clears the case.
- Rejections use domain errors with explicit structured details so callers are not forced into generic failure UI.

## Remaining

- The next MyPay phase in line is `P2-C`, the dispute and error-resolution slice.
- That phase should build first-class dispute objects, transaction-linked issue reporting, evidence and deadline tracking, and reversal or provisional-credit hooks back into the ledger service.
