# 2026-07-05 Meerkat: retire $4.99/mo hosted references (founder request)

> **SUPERSEDED same-day by founder pricing decision:** the app is $4.99 one-time AND the hosted subscription is $4.99/month with storage included. Commit `c2b8e259` (everything below) was reverted; the $4.99/mo hosted price and its copy are restored and now founder-locked by `packages/billing-config/src/__tests__/meerkat-hosted-product.test.ts`. Plan 22's cost-plus reprice item is overridden.

## What was done
Removed every "$4.99/mo" hosted-subscription reference from code, executing the price-collision slice of Plan 22 Phase 0 ahead of the full phase ($4.99 is the one-time app unlock, not the hosted subscription). Commit `c2b8e259` on `feature/meerkat-launch-completion`.

## Changes
- `packages/billing-config/src/index.ts`: `MEERKAT_HOSTED_MONTHLY_PRODUCT` repriced 4.99 -> 8.75, derived from the meerkat-relay cost-plus hosted-pricing ledger Starter tier ((50 GB x $0.02 + 100 GB egress x $0.01 + $5 node) x 1.25), documented as illustrative until real invoices land.
- `packages/meerkat-relay/src/__tests__/hosted-api.test.ts`: new drift-guard test locks the SKU price to `computeTierPrice(starter).totalCents / 100` and asserts it is NOT 4.99; checkout test de-hardcoded to the product config.
- Copy, all five connection sites (mobile `sync.tsx`, `settings.tsx`; web `RelayBar`, `SyncDialog`, `RelaySection`): "the paid tier ($4.99/mo) adds ..." -> "the paid hosted tier adds capacity, backup, public reach, and always-on history".
- `scripts/check-meerkat-parity.mjs`: `FREE_VS_PAID_PHRASE` updated to the new phrase; `$4.99/mo` added to `STALE_CONNECTION_COPY` so it can never reappear on any of the five sites.
- public-publish twins (mobile + web, byte-identical): removed `HOSTED_MONTHLY_PRICE` + `formatHostedPrice` + the billing-config import; `hostedServingPath()` and `archiveManagedTierLabel()` now quote no dollar figure ("Managed always-on (paid)").
- Test twins updated to lock the no-price invariant; `post-schema-v2-parity.test.ts` needles updated (kept `not.toContain('4.99')`, added `not.toContain('/mo')` and the exact label).
- Comments updated in `packages/entitlements/src/meerkat-hosted.ts` and `packages/meerkat-relay/src/index.ts`.
- Plan 22 Status Delta updated (Phase 0 partially done; remaining: `meerkat_app_unlock`, meerkat-app entitlement, IAP, storage-bundling founder decision).

## Kept deliberately
- "The $4.99 app covers private local use" copy (mobile settings + web HostedServicesSection): that IS the founder one-time model.
- Per-module `mylife_*_unlock` $4.99 products: MyLife-hub concern, unrelated per Plan 22.

## Verification
billing-config 2/2, meerkat-relay 348/348, mobile public-publish 46/46, meerkat-web public-publish + post-schema-v2-parity 64/64, full `check-meerkat-parity.mjs` pass, typechecks green on billing-config, entitlements, meerkat-relay, meerkat-app, meerkat-web. Pre-commit function gate passed.
