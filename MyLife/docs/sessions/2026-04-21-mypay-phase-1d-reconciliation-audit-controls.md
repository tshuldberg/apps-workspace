# MyPay Phase 1D: reconciliation and audit controls

## Summary

Built MyPay Phase 1D by adding an operational `ops/` layer on top of the existing domain engine and provider abstractions. The new slice covers structured audit logging, transfer timelines, reconciliation and balance-proof reporting, break queue primitives, provider-event deduplication, and safe webhook replay controls.

No schema or migration changes were required in this segment. The work stays in pure TypeScript under `modules/payments/src/ops/` so it can plug into the existing Supabase-backed money core without forcing a second schema pass in the same phase.

## Files Changed

- `modules/payments/src/ops/types.ts`
- `modules/payments/src/ops/audit.ts`
- `modules/payments/src/ops/breaks.ts`
- `modules/payments/src/ops/reconciliation.ts`
- `modules/payments/src/ops/replay.ts`
- `modules/payments/src/ops/index.ts`
- `modules/payments/src/ops/__tests__/audit.test.ts`
- `modules/payments/src/ops/__tests__/reconciliation.test.ts`
- `modules/payments/src/ops/__tests__/reconciliation.function-gate.test.ts`
- `modules/payments/src/ops/__tests__/replay.test.ts`
- `modules/payments/src/index.ts`
- `modules/payments/package.json`
- `memory.md`
- `errors_log.md`

## What Built

### Structured audit logging

- Added `createPaymentsAuditLogger()` and `createInMemoryPaymentsAuditSink()`.
- Standardized audit event shapes for commands, provider events, reconciliation runs, break detection, and replay actions.
- Added `buildPaymentsTransactionTrace()` so operations can answer "what happened?" for a transfer using audit entries, provider events, transfer events, and related breaks.

### Reconciliation and balance proofs

- Added `buildPaymentsBalanceProofs()` for ledger-net vs cached-balance vs provider-balance comparison.
- Added `runPaymentsReconciliationJob()` to produce operator-facing sandbox reports with:
  - local vs remote transfer status comparison
  - missing-local and missing-remote transfer detection
  - stale remittance detection
  - stuck pending transfer detection
  - duplicate callback grouping
  - launch-blocking summary lines

### Break queue primitives

- Added `createInMemoryPaymentsBreakQueue()` and stable break fingerprints.
- Breaks are upserted instead of duplicated and can be acknowledged or resolved.
- Reconciliation and replay both emit queueable breaks with severity and attached transfer or provider-event references.

### Safe provider-event replay

- Added `createInMemoryPaymentsProviderEventStore()`.
- Added `acceptPaymentsProviderEvent()` for provider-event ingest with duplicate callback suppression.
- Added `createPaymentsWebhookReplayService()` for safe replay of failed or ignored callbacks without double-posting already applied events.

## Verification

Passed:

- `pnpm --filter @mylife/payments exec tsc --noEmit`
- `pnpm --filter @mylife/payments test`
- `pnpm gate:function --file modules/payments/src/ops/reconciliation.ts`

Known blocker:

- `pnpm gate:function:changed`
  - still fails in `apps/mobile/app/(notes)/discovery 2.tsx:48`
  - exact error: `React Hook "useMemo" is called conditionally`
  - current lint summary: `✖ 818 problems (1 error, 817 warnings)`

## Notes

- This phase deliberately stops at operational primitives and reports. It does not yet wire a live scheduler, Supabase cron, or operator UI surface.
- The next logical MyPay slice is Phase 2A compliance identity and onboarding tiers, unless you want a narrower follow-up on production wiring for this new ops layer first.
