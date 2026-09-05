# MyPay Phase 1C: provider abstraction and adapters

Date: 2026-04-20

## Summary

Built MyPay Phase 1C by adding a dedicated provider abstraction layer under `modules/payments/src/providers/` and wiring the existing cloud runtime to use it through a compatibility client.

This phase adds:

- rail-specific interfaces for domestic wallet and ACH transfers, payouts, card issuing and disputes, bank linking and funding, remittance quoting and settlement, webhook verification, and notification delivery
- normalized provider failure codes and typed provider result unions
- first-class fake and sandbox bundles for offline tests
- live provider bundle factories for Unit, Stripe Treasury, Synctera, and a future remittance partner without forcing UI or engine changes
- runtime selection that chooses fake, sandbox, or live bundles from `PaymentsRuntimeConfig`
- a compatibility client so the existing cloud runtime surface can keep using `createTransfer`, `createRemittanceQuote`, and `openDispute`

## Files changed

- `modules/payments/src/providers/types.ts`
- `modules/payments/src/providers/helpers.ts`
- `modules/payments/src/providers/fake.ts`
- `modules/payments/src/providers/sandbox.ts`
- `modules/payments/src/providers/live.ts`
- `modules/payments/src/providers/factory.ts`
- `modules/payments/src/providers/index.ts`
- `modules/payments/src/providers/__tests__/factory.test.ts`
- `modules/payments/src/providers/__tests__/factory.function-gate.test.ts`
- `modules/payments/src/test/function-quality.ts`
- `modules/payments/src/cloud/config.ts`
- `modules/payments/src/cloud/provider.ts`
- `modules/payments/src/cloud/fake-provider.ts`
- `modules/payments/src/cloud/runtime.ts`
- `modules/payments/src/cloud/index.ts`
- `modules/payments/src/cloud/__tests__/config.test.ts`
- `modules/payments/src/index.ts`
- `modules/payments/package.json`

## Design choices

- The new `providers/` layer is the canonical abstraction. `cloud/provider.ts` is now a compatibility wrapper, not the source of truth.
- Fake and sandbox bundles are deterministic and network-free, so provider behavior can be tested locally.
- Sandbox capability differences are explicit. The Unit sandbox bundle exposes bank-link flows but reports card issuing as `not_supported`, while Synctera sandbox supports both.
- Remittance stays behind a rail-neutral interface. The only named live remittance surface in this phase is `future_remittance_partner`, so cross-border settlement details stay out of UI and engine code.
- Live provider factories intentionally default to `not_configured` results unless server-only implementations are injected. This keeps the adapter surface testable without shipping fake production behavior.

## Verification

Passed:

- `pnpm --filter @mylife/payments exec tsc --noEmit`
- `pnpm --filter @mylife/payments test`
- `pnpm gate:function --file modules/payments/src/providers/factory.ts`

Blocked outside Payments:

- `pnpm gate:function:changed`

The shared changed-file gate still fails on the existing unrelated mobile lint error:

- `apps/mobile/app/(notes)/discovery 2.tsx:48`
- `react-hooks/rules-of-hooks`
- `React Hook "useMemo" is called conditionally`

## Next step

Phase 1D can now build reconciliation, replay tooling, and audit controls on top of typed provider events and rail-specific adapter boundaries instead of raw provider-specific callbacks.

