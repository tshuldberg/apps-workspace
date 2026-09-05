# Meerkat Prompt 08 Hosted Boundaries

Date: 2026-06-24

## Summary

Implemented Prompt 08: hosted boundaries and paid-service copy for Meerkat mobile and web. The work makes the boundary between private local use and paid hosted services visible without adding fake purchases, fake hosted availability, or fake backup state.

## What Changed

- Added mobile hosted-boundary model and tests:
  - `apps/meerkat/app/(root)/data/hosted-boundaries.ts`
  - `apps/meerkat/app/__tests__/hosted-boundaries.test.ts`
- Added web hosted-boundary model, tests, and Settings UI:
  - `apps/meerkat-web/src/lib/hosted-boundaries.ts`
  - `apps/meerkat-web/src/lib/__tests__/hosted-boundaries.test.ts`
  - `apps/meerkat-web/src/ui/settings/HostedServicesSection.tsx`
  - `apps/meerkat-web/src/ui/settings/SettingsOverlay.tsx`
  - `apps/meerkat-web/src/ui/app.css`
- Added a Hosted services section to mobile Settings covering:
  - Cloud backup: `Not backed up`
  - Community history: local history only
  - Public posts and public feed: hidden until real hosted sources exist
  - Large files: local storage only
  - Always-on community node: owner-paid and not configured
  - Hosted relay: first-party paid entitlement when applicable, community/self-hosted otherwise
- Updated relay, recovery, files, share-link, and history copy on mobile and web:
  - Recovery material is now described as a local export, not cloud backup.
  - Public links are explicitly not public posts, public feed inclusion, or cloud backup.
  - File indexes say paid hosted file storage is not connected.
  - Community history notices say always-on history is owner-paid and not connected.
  - Relay notices say first-party hosted relay capacity is paid, while self-hosted/community relays keep private local use available.
- Updated web community feed status copy so a real community node reads as `Hosted for this community`.

## Decisions

- No billing or purchase UI was added.
- No hosted service is marked available unless the existing entitlement state can prove it.
- Local private use remains available under the paid app model.
- Public posts and public feed controls remain hidden until hosted public storage, public source, and moderation support are real.

## Verification

- `pnpm --filter @mylife/meerkat-app typecheck`
- `pnpm --filter @mylife/meerkat-web typecheck`
- `pnpm --filter @mylife/meerkat-web test`
- `pnpm --filter @mylife/meerkat-app exec vitest run app/(root)/data/__tests__/community-files.function-gate.test.ts`
- `pnpm --filter @mylife/meerkat-app exec vitest run app/__tests__/hosted-boundaries.test.ts`
- `pnpm --filter @mylife/meerkat-app test`
- `node scripts/check-meerkat-parity.mjs`
- `pnpm gate:function:changed`

The first full mobile test run hit a transient `saveFilesBulk` microbenchmark slope failure in an unrelated pre-existing function-gate test. The focused test passed immediately, and the full mobile suite passed on rerun without code changes.

## Remaining Work

- Prompt 09: profiles and per-community pseudonyms.
- Actual hosted backup, public posts, public feed inclusion, large hosted file storage, and always-on community node activation still need real entitlement/product wiring before they can be shown as available.
- Pricing names and plan details remain founder decisions. This slice intentionally avoids new price claims.

