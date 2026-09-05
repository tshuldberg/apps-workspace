# MyPay Phase 2A: identity, onboarding, and tiers

## Summary

Built MyPay Phase 2A by adding a pure TypeScript compliance layer under `modules/payments/src/compliance/`. This slice covers reserved `@handle` rules, explicit phone and email verification state, discoverability-safe payment profile search, tier-aware KYC assessment with limit explanations, and separate KYB entry points for merchant QR and Market seller payout onboarding.

No schema or migration changes were required in this segment. The existing Phase 1A schema already had the right attachment points in `pay_wallets`, `pay_identities`, and `pay_contacts`, so this phase stayed in the domain layer.

## Files Changed

- `modules/payments/src/compliance/types.ts`
- `modules/payments/src/compliance/handles.ts`
- `modules/payments/src/compliance/tiers.ts`
- `modules/payments/src/compliance/onboarding.ts`
- `modules/payments/src/compliance/profile.ts`
- `modules/payments/src/compliance/index.ts`
- `modules/payments/src/compliance/__tests__/handles.test.ts`
- `modules/payments/src/compliance/__tests__/tiers.test.ts`
- `modules/payments/src/compliance/__tests__/profile.test.ts`
- `modules/payments/src/compliance/__tests__/profile.function-gate.test.ts`
- `modules/payments/src/providers/__tests__/factory.function-gate.test.ts`
- `modules/payments/src/ops/__tests__/reconciliation.function-gate.test.ts`
- `modules/payments/src/index.ts`
- `modules/payments/package.json`
- `memory.md`
- `errors_log.md`

## What Built

### Handle reservation and safe search keys

- Added handle normalization, search-key generation, and reservation helpers.
- Reserved sensitive names such as product, support, and trust-and-safety aliases so future public handles cannot collide with system surfaces.
- Kept identifiers unique and safely searchable with normalized keys.

### Verification-aware payment profiles

- Added explicit verification method models for phone and email, including status, verified timestamp, and fallback field values.
- Added discoverability-safe payment profile builders and search indexing.
- Search only exposes verified, discoverable identifiers and respects profile visibility settings such as `private`, `contacts_only`, and `searchable`.

### KYC tiers and KYB entry points

- Added tier modeling for `unverified`, `basic`, `standard`, and `full`.
- Added tier assessment helpers that explain capability and transfer-limit blocks in terms of missing requirements and current tier state.
- Added separate business onboarding drafts and entry points for `merchant_qr` and `market_seller_payout` so future merchant identity can remain distinct from casual P2P identity.

## Verification

Passed:

- `pnpm --filter @mylife/payments exec tsc --noEmit`
- `pnpm --filter @mylife/payments test`
- `pnpm gate:function --file modules/payments/src/compliance/profile.ts`

Known blocker:

- `pnpm gate:function:changed`
  - still fails in `apps/mobile/app/(notes)/discovery 2.tsx:48`
  - exact error: `React Hook "useMemo" is called conditionally`
  - current lint summary: `✖ 823 problems (1 error, 822 warnings)`

Additional repo blocker surfaced during optional host verification:

- `pnpm --filter @mylife/mobile typecheck`
- `pnpm --filter @mylife/web typecheck`
  - both now fail on unrelated `@mylife/sleep` export drift around missing `CreateDreamInput`
  - the prior payments compliance export/type issues are resolved

## Notes

- While landing this phase, I also stabilized two older micro-benchmark function-gate tests in `providers/` and `ops/` so the expanded payments package no longer causes timing-noise failures.
- The next logical MyPay slice is Phase 2B risk, OFAC and sanctions review hooks, velocity controls, and holds.
