# Meerkat Prompt 02 Onboarding

Date: 2026-06-24

## Summary

Implemented Prompt 02: Apple-simple first-run onboarding for Meerkat mobile and web. The flow avoids relay, node, and transport setup language in the primary onboarding path while still using the real identity, community, invite, join, and channel-message machinery.

## What Changed

- Added a mobile `OnboardingGate` that blocks first run until the user chooses a name and takes one of three honest actions: create a community, join with an invite, or copy a friend code.
- The mobile create/join path can continue into a first channel message using the existing `ChatProvider.sendMessage` path, then routes to the real channel.
- Added `ONBOARDING_COMPLETE_KEY` in mobile `mk_settings` and clear it when the local identity is reset.
- Exported `useChatActions()` so onboarding can send through existing signed channel-message logic instead of duplicating message creation.
- Upgraded the web `OnboardingOverlay` from name-only setup to the same name, create/join/connect, first-message path.
- Added a locked web modal mode so first-run onboarding cannot be dismissed through a nonfunctional close button.
- Kept unsupported QR scanning hidden. Join by paste and friend-code sharing are the visible connection paths.

## First-Run Path

1. Pick a display name.
2. Create a community, join with an invite, or copy a friend code.
3. If the user creates or joins a postable community, write a first channel message or open the channel.
4. Onboarding completion persists to `mk_settings`.
5. If owner approval or a connection is not available, the UI says it is waiting and does not claim delivery.

## Verification

- `pnpm --filter @mylife/meerkat-app typecheck`
- `pnpm --filter @mylife/meerkat-web typecheck`
- `pnpm --filter @mylife/meerkat-web test`
- `pnpm --filter @mylife/meerkat-app test`
- `pnpm --filter @mylife/meerkat-app exec vitest run 'app/(root)/data/__tests__/community-files.function-gate.test.ts' --passWithNoTests`
- `node scripts/check-meerkat-parity.mjs`
- `pnpm gate:function:changed`
- `rg -n "\x{2014}"` on changed onboarding/docs/UI files
- Web smoke via Playwright against `http://localhost:5173/`: name `Trey`, create `Friends`, send `Hello from onboarding`, landed in `#general`, no console or page errors.

## Notes

- The first full mobile test run hit a transient `saveFilesBulk` microbenchmark slope failure under full-suite contention. The focused test, full rerun, and changed-function gate all passed, so `errors_log.md` was not updated.
- Mobile simulator inspection was not feasible from this environment.
- The web dev server was started locally on port `5173` for inspection.

## Remaining Work

- QR scan/share affordances are still not supported.
- A joined community may still wait on owner approval before full history or posting access arrives.
- Prompt 03 should add the durable audience-rule model and visible privacy labels.
