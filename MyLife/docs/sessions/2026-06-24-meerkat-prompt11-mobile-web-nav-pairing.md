# Meerkat Prompt 11 Mobile Web Nav And Pairing

Date: 2026-06-24

## Scope

Prompt 11 addressed the two concrete gaps left by Prompt 10:

- Mobile web Feed and channel screens needed visible primary navigation.
- Sync pairing needed a friendlier copy/share flow instead of exposing raw signed JSON by default.

The slice did not add private DM storage, hosted-service implementation, QR scanning, fake connected state, or automatic delivery.

## Changes

- Added a mobile-only web primary tab bar with Feed, Communities, Messages, Friends, and Me.
- Kept desktop web unchanged. On narrow screens, the new tab bar stays visible while Feed, channel, Messages, Friends, and Settings surfaces are foregrounded.
- Added shared `@mylife/sync` pairing-code helpers:
  - `encodeMeerkatPairingCode`
  - `decodeMeerkatPairingCode`
  - `normalizeMeerkatPairingInput`
  - `formatMeerkatPairingCode`
- Wrapped existing signed pairing JSON in a printable `MKPAIR1-...` code for mobile and web.
- Updated web and native Sync pairing UI to show a pairing code plus Copy and Share actions.
- Kept legacy JSON compatible by normalizing either `MKPAIR1` code or raw JSON before calling the existing signed-payload verifier.

## Files Changed

- `packages/sync/src/protocol/pairing-code.ts`
- `packages/sync/src/__tests__/pairing-code.test.ts`
- `packages/sync/src/index.ts`
- `packages/sync/src/index.native.ts`
- `apps/meerkat-web/src/ui/shell/MobilePrimaryNav.tsx`
- `apps/meerkat-web/src/ui/shell/AppShell.tsx`
- `apps/meerkat-web/src/ui/App.tsx`
- `apps/meerkat-web/src/ui/app.css`
- `apps/meerkat-web/src/ui/sync/SyncDialog.tsx`
- `apps/meerkat-web/src/lib/MeerkatProvider.tsx`
- `apps/meerkat/app/(root)/sync.tsx`
- `apps/meerkat/app/(root)/providers/SyncProvider.tsx`

## Product Behavior

- Mobile web users can now move between Feed, Communities, Messages, Friends, and Me without returning to a hidden rail.
- Pairing no longer presents raw JSON as the primary user-facing object.
- Pairing remains honest: the code is only a wrapper around the existing signed identity bundle, and malformed or unsigned inputs still fail.
- Friend-code pairing remains the shorter manual typing path and still requires a connection server.

## Verification

- `pnpm --filter @mylife/sync exec vitest run src/__tests__/pairing-code.test.ts`
- `pnpm --filter @mylife/sync typecheck`
- `pnpm --filter @mylife/meerkat-web typecheck`
- `pnpm --filter @mylife/meerkat-app typecheck`
- `pnpm --filter @mylife/meerkat-web test`
- `pnpm --filter @mylife/meerkat-app test`
- `pnpm --filter @mylife/sync test`
- `node scripts/check-meerkat-parity.mjs`
- `pnpm gate:function:changed`
- Playwright mobile viewport QA at `http://localhost:5175/`: Feed nav visible, channel nav visible, Sync dialog shows `MKPAIR1` code and copy/share actions, console errors 0.

Screenshot:

- `output/playwright/meerkat-prompt11/mobile-sync-pairing.png`

## Remaining

- No QR renderer or camera scanner was added. The code is QR-ready, but the app does not claim scan support in this slice.
- Private DM storage and delivery remain intentionally unavailable.
- Hosted services remain placeholders until real hosted paths and live QA are connected.
- Physical two-device QA is still required.

Recommended next prompt: Prompt 12, private DM storage and delivery if it can reuse real paired-device, channel, and mailbox paths without leaking into public feed modes.
