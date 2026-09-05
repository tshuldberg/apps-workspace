# Meerkat Prompt 10 Polish Readiness

Date: 2026-06-24

## Scope

Prompt 10 reviewed the user-facing Meerkat flows from Prompts 01 through 09 and fixed narrow, safe polish issues. The slice stayed focused on copy, responsive fit, honest status, and browser-console readiness.

## Changes

- Replaced primary UI jargon such as relay, node storage, sync session, signed descriptor, device key, signed time, and recorded event with user-level wording where it appeared in Feed, Friends, Communities, Messages, Files, Settings, Sync, hosted services, and file-request flows.
- Kept the real connection/server behavior intact while presenting it as "connection server", "connection options", "local file storage", "safety identity", and "verified file record".
- Aligned mobile and web copy for hosted service boundaries, friend-code setup, file requests, background drain states, feed ordering, and unavailable DMs.
- Added a web favicon to remove the first-load `favicon.ico` console 404.
- Shortened the web channel composer placeholder from keyboard-shortcut text to `Write a message`, fixing mobile clipping.
- Updated exact tests for changed UI strings.

## QA

Browser QA used the Playwright CLI skill because the gstack browse binary was not installed in this checkout.

Checked flows:
- First-run onboarding: name, safety code, community creation, first message.
- Feed: source controls, empty state, public/DM honesty copy.
- Community channel: visible post audience, visible message audience, local saved message.
- Settings: identity, connection server, connection options, local file storage, hosted services, recovery key.
- Sync: connection server setup, pairing payload, manual session copy.
- Responsive web: desktop feed/settings/sync and mobile feed/channel.

Artifacts:
- `output/playwright/meerkat-prompt10/feed-desktop.png`
- `output/playwright/meerkat-prompt10/settings-desktop.png`
- `output/playwright/meerkat-prompt10/sync-desktop.png`
- `output/playwright/meerkat-prompt10/channel-mobile.png`

## Findings

Resolved:
- Web first load logged a favicon 404. Added `apps/meerkat-web/public/favicon.svg` and linked it from `apps/meerkat-web/index.html`.
- Mobile web channel composer clipped the long keyboard-shortcut placeholder. Shortened the placeholder.

Still open:
- Mobile web Feed view does not expose the primary navigation in the responsive snapshot. The channel route has a back control, but the feed route needs a mobile app-level nav affordance.
- The advanced Sync modal still exposes a raw JSON pairing payload. This is honest, but not Discord-simple and should become a friendlier QR/code/share flow.
- Private DM storage and delivery remain intentionally unavailable.
- Hosted backup, public reach, hosted history, hosted file storage, and always-on community history remain paid-service placeholders until real hosted paths are connected.
- Physical two-device QA and production hosted service deployment are still required before App Store readiness.

## Verification

- `pnpm --filter @mylife/meerkat-web typecheck`
- `pnpm --filter @mylife/meerkat-app typecheck`
- `node scripts/check-meerkat-parity.mjs`
- `pnpm --filter @mylife/meerkat-web test`
- `pnpm --filter @mylife/meerkat-app test`
- `pnpm gate:function:changed`
- Playwright console check: 0 errors after favicon fix.
- Runtime grep found no remaining old jargon or em-dash hits in primary UI copy. Remaining hits are technical tests or guard assertions.

Note: the first `pnpm --filter @mylife/meerkat-app test` run hit the known timing-sensitive `community-files.function-gate.test.ts` slope assertion, then the rerun passed all 173 tests.

## Readiness

Meerkat is stronger for private alpha dogfooding after Prompt 10. It is not App Store ready yet because the mobile web navigation gap, raw pairing payload UX, private DM storage, hosted-service implementation, and live device QA remain open.

Recommended next prompt: Prompt 11, mobile web navigation plus friendly pairing UX.
