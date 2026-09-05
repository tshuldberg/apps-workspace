# MyPay Phase 2D: remittance disclosures, receipts, and legal copy center

## Summary

Built MyPay Phase 2D by adding a pure TypeScript disclosure and receipt layer under `modules/payments/src/compliance/disclosures/`. This slice centralizes remittance quote payloads, versioned legal-copy blocks, normalized receipt payloads, and transfer-detail disclosure assembly so web, mobile, PDF, email, and support exports can all consume the same server-authoritative content contract.

No schema or RPC changes were required for this phase. The existing Phase 1A schema already exposes `pay_remittance_quotes.disclosures` and `pay_remittances.receipt_payload`, so Phase 2D stayed schema-neutral and focused on typed payload assembly over the existing storage fields.

## Files Changed

- `modules/payments/src/compliance/disclosures/types.ts`
- `modules/payments/src/compliance/disclosures/content.ts`
- `modules/payments/src/compliance/disclosures/legal.ts`
- `modules/payments/src/compliance/disclosures/remittance.ts`
- `modules/payments/src/compliance/disclosures/receipts.ts`
- `modules/payments/src/compliance/disclosures/detail.ts`
- `modules/payments/src/compliance/disclosures/index.ts`
- `modules/payments/src/compliance/disclosures/__tests__/disclosures.test.ts`
- `modules/payments/src/compliance/disclosures/__tests__/legal.function-gate.test.ts`
- `modules/payments/src/compliance/index.ts`
- `modules/payments/package.json`
- `memory.md`
- `errors_log.md`

## What Built

### Disclosure content center

- Added shared disclosure payload types for:
  - locale and surface metadata
  - reusable content sections and fact lines
  - legal-copy blocks with explicit `version` and `effectiveAt`
  - multi-surface disclosure bundles that carry callouts, sections, and legal blocks together
- Kept the structure locale-ready by resolving requested locale separately from the rendered payload and by returning surface metadata for `mobile`, `web`, `email`, `pdf`, and `support_export`.

### Versioned legal-copy blocks

- Added `buildPaymentsLegalCopyBlocks()` for centralized, reusable regulated copy blocks:
  - `stored_balance`
  - `partner_bank`
  - `custodial_account`
  - `debit_card`
  - `stablecoin_rail`
  - `remittance_cancellation`
  - `error_resolution`
- Each block now carries explicit placement hints, surfaces, tags, version IDs, and absolute effective dates so wallet settings, funding, card, receipt, quote, and support views can all source the same copy without hardcoding strings inside components.

### Remittance quote disclosures

- Added `buildPaymentsRemittanceQuotePayload()` so cross-border sends can assemble:
  - exchange-rate disclosure
  - fee and total-debit breakdown
  - corridor-availability messaging
  - delivery-estimate messaging
  - cancellation-window messaging
  - Travel Rule / originator-recipient recordkeeping placeholders
  - reusable legal-copy blocks for remittance-adjacent surfaces
- The quote payload is server-authoritative and does not assume a specific partner implementation. Stablecoin-backed settlement can remain hidden behind the same remittance rail while still exposing the required legal-copy slot when enabled.

### Receipt model and transfer-detail hooks

- Added `buildPaymentsReceiptPayload()` with first-class receipt kinds for:
  - `p2p`
  - `merchant`
  - `card`
  - `remittance`
  - `refund`
  - `reversal`
- Added `buildPaymentsTransferDetailPayload()` so transfer detail can resolve:
  - rail-aware status callouts
  - remittance quote disclosures when available
  - receipt payloads
  - reusable legal-copy blocks
- This keeps quote, confirmation, history, receipt export, and support export payloads aligned without per-screen copy branching.

## Verification

Passed:

- `pnpm --filter @mylife/payments exec tsc --noEmit`
- `pnpm --filter @mylife/payments test`
- `pnpm scaffold:function-test --file modules/payments/src/compliance/disclosures/legal.ts --function buildPaymentsLegalCopyBlocks --force`
- `pnpm gate:function --file modules/payments/src/compliance/disclosures/legal.ts`

Known blocker:

- `pnpm gate:function:changed`
  - still fails in unrelated mobile lint output at `apps/mobile/app/(notes)/discovery 2.tsx:48`
  - exact error remains `React Hook "useMemo" is called conditionally`
  - latest reconfirmation on `2026-04-22`: `✖ 825 problems (1 error, 824 warnings)`

## Decisions

- Kept Phase 2D schema-neutral because the core remittance quote and receipt tables already had the correct JSON payload attachment points.
- Used one content model for callouts, sections, and legal blocks so the same payload can power web, mobile, PDF/email, and support export surfaces.
- Kept legal and operational copy behind typed builders rather than UI components so partner-bank, custody, cancellation, and error-resolution language can be revised without screen rewrites.

## Remaining

- The next MyPay phase in line is `P3-A`, wallet home and balance hero.
- That phase should consume the new disclosure slot by showing available balance, pending funds, quick actions, linked-account summary, and recent activity preview while keeping disclosure copy server-authored and rail-aware.
