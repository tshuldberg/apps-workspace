# Session: Meerkat Readiness App Gaps

Date: 2026-06-14
Branch: feature/meerkat-network

## Scope

Reviewed Meerkat readiness against the user goal: private encrypted transfer
between own devices and friends, local community-style data updates, server-backed
and localized community modes, user-selected storage destinations, and honest
production readiness.

Then coded the next app-resolvable gaps without claiming unbuilt transport:

- Alpha tester readiness diagnostics in Settings.
- Manual host-history import for community channels.
- Remote share-link fetch from pasted HTTP node hosts.
- Documentation and launch-plan updates that keep the honesty boundary current.

## Built

### Alpha Readiness

- Added `alpha-readiness.ts` with deterministic readiness items and redacted
  diagnostics.
- Settings now shows relay, pairing, SAS, session, pending-change, and file-save
  readiness from real local state.
- Added tests and function-gate coverage.

### Host History Import

- Added `channel-history-import.ts` to parse signed host manifests, fetch channel
  history over injected HTTP fetch, verify it through `@mylife/sync`, and merge
  valid events into the local channel database.
- Channel screens now include a manual Host history panel for pasted manifests and
  host URLs.
- ChatProvider records imported messages and attachments as local changes so they
  can participate in existing sync paths.
- Automatic catalog discovery remains pending.

### Remote Share Links

- Added `fetchAndPinFromHosts` in `packages/sync/src/node/remote-store.ts`.
- The new path fetches sealed shares from remote host sources, verifies manifest
  signature, content id, block hashes, and authenticated decryption, then pins
  only after verification.
- Added Meerkat `remote-share.ts` for HTTP(S) host parsing and app-level open.
- Share screen now opens local pins first, then falls back to pasted HTTP hosts.
- If content verifies but local pinning fails, the UI reports the verified fetch
  separately from the failed seed state.
- Automatic share-link host discovery remains pending.

## Verification

- `pnpm --filter @mylife/meerkat-app test`: 66 tests passed.
- `pnpm --filter @mylife/meerkat-app typecheck`: passed.
- `pnpm --filter @mylife/sync test`: 1054 tests passed.
- `pnpm --filter @mylife/sync typecheck`: passed.
- `pnpm gate:function` for changed app and sync files: passed.
- `pnpm gate:function:changed`: passed.
- `pnpm check:parity --quiet`: passed with existing standalone warnings only.
- `git diff --check`: passed.
- Touched-file em dash scan: no matches.

## Remaining

- Physical two-device and three-device QA.
- Dev-build LAN QA.
- Background sync, auto dialing, and push wake.
- Automatic share-link peer or host discovery.
- First-class save destination UX for downloaded files.
- Production relay and host deployment.
- Packaged community host or hosted-node provisioning.
- Discord or Slack style richness beyond current signed channel chat.
