# MyPay Phase 2C: error resolution and disputes

## Summary

Built MyPay Phase 2C by adding a pure TypeScript dispute and error-resolution layer under `modules/payments/src/compliance/disputes/` plus a small ledger-adjustment primitive in `modules/payments/src/engine/ledger.ts`. This slice turns "Report an issue" into a first-class transaction-linked domain model for unauthorized transfers, card disputes, and Market escrow disputes, with timelines, evidence slots, deadlines, notes, operator actions, transfer-detail case summaries, and explicit ledger decision hooks.

No schema or RPC changes were required for this phase. The existing Phase 1A schema already has `pay_disputes`, `pay_compliance_cases`, transfer linkage, and immutable ledger tables, so the Phase 2C work stayed server-authoritative and domain-layer first.

## Files Changed

- `modules/payments/src/compliance/disputes/types.ts`
- `modules/payments/src/compliance/disputes/workflow.ts`
- `modules/payments/src/compliance/disputes/ledger.ts`
- `modules/payments/src/compliance/disputes/index.ts`
- `modules/payments/src/compliance/disputes/__tests__/disputes.test.ts`
- `modules/payments/src/compliance/disputes/__tests__/workflow.function-gate.test.ts`
- `modules/payments/src/compliance/index.ts`
- `modules/payments/src/engine/ledger.ts`
- `modules/payments/src/engine/index.ts`
- `memory.md`
- `errors_log.md`

## What Built

### Transaction-detail issue reporting

- Added `buildPaymentsIssueReportDraft()` so transfer detail can resolve whether an issue can be reported, what subtype applies, which reason options are valid, what evidence slots exist, what deadlines matter, and whether an active case already blocks duplicate intake.
- The draft resolver classifies flows into:
  - `unauthorized_transfer` for Reg E style wallet-transfer disputes
  - `card_dispute` for card-linked chargeback flows
  - `market_escrow` for Market escrow cases routed through the same dispute system with a market-specific subtype

### First-class dispute objects and workflow state

- Added `createPaymentsDisputeCase()` so disputes exist as real domain objects rather than a support-chat placeholder.
- Each case carries:
  - case type and subtype
  - reason code and customer statement
  - evidence slots
  - deadlines
  - timeline items
  - notes
  - available operator actions
  - ledger-decision state
  - a computed `nextStep`
- Added `submitPaymentsDisputeEvidence()` and `applyPaymentsDisputeOperatorAction()` so the system can model evidence requests, evidence submission, provider submission, provisional-credit selection, provider outcomes, refund or reversal selection, denials, and closure.
- Provider outcomes such as `chargeback_debit` are captured as case state first. Internal ledger action remains a separate decision, which prevents provider callbacks from implicitly corrupting the internal ledger.

### Transfer-detail case summaries

- Added `buildPaymentsTransferDisputeSummary()` so transfer detail can show the current case status, whether there is an active case, the next action, and the next pending deadline.

### Ledger hooks

- Added `buildPaymentsAdjustmentPlan()` to the engine ledger layer for balanced non-reversal dispute postings.
- Added `resolvePaymentsDisputeLedgerDecision()` so reversal, refund, and provisional-credit decisions can return explicit ledger plans and case-state outcomes:
  - reversal uses the original posted transfer ledger plan
  - refund creates a chargeback-style balanced adjustment plan
  - provisional credit creates a temporary adjustment plan without forcing an immediate transfer-status mutation

## Verification

Passed:

- `pnpm --filter @mylife/payments exec tsc --noEmit`
- `pnpm --filter @mylife/payments test`
- `pnpm gate:function --file modules/payments/src/compliance/disputes/workflow.ts`
- `pnpm gate:function --file modules/payments/src/compliance/disputes/ledger.ts`

Known blocker:

- `pnpm gate:function:changed`
  - still fails in unrelated mobile lint output at `apps/mobile/app/(notes)/discovery 2.tsx:48`
  - exact error remains `React Hook "useMemo" is called conditionally`
  - latest reconfirmation on `2026-04-22`: `✖ 824 problems (1 error, 823 warnings)`

## Decisions

- Kept Phase 2C schema-neutral because the existing payments schema already has dispute and compliance-case attachment points.
- Split provider outcome capture from ledger action selection so chargeback-like events can be recorded before any internal ledger mutation is approved.
- Routed Market escrow disputes into the same case engine as card and unauthorized-transfer flows, but preserved a distinct `market_escrow` subtype for Market-specific rules and UI copy.

## Remaining

- The next MyPay phase in line is `P2-D`, remittance disclosures, receipts, and legal copy center.
- That phase should build disclosure payloads, receipts, and reusable legal-copy blocks for cross-border sends plus stored-balance, custodial, and partner-bank surfaces.
