# BestChef Security Remediation

Date: 2026-04-24

## Scope

- Standalone app: `apps/bestchef`
- Canonical business module: `modules/bestchef`
- Mesh communication substrate: `packages/sync`
- Release config: `apps/bestchef/app.json`, BestChef Expo config plugins, root dependency overrides

## Remediated Findings

1. Moved sync device private keys and paired shared secrets behind the new sync secret-store abstraction, with Expo SecureStore wired in BestChef and legacy SQLite raw-key refs migrated to opaque secure refs during sync bootstrap.
2. Changed sync security defaults to fail closed: encryption now defaults to `required`, opportunistic mode no longer permits plaintext fallback, and direct encrypted channel lookup canonicalizes paired device IDs.
3. Encrypted handshake and negotiation payloads. HELLO metadata no longer exposes display names or supported modules, and HELLO/ACK/challenge/response plus sync offer/accept payloads use secure JSON.
4. Removed the old plaintext one-shot share path. `shareEntity` now requires an active paired device, module policy eligibility, scope checks, optional workspace membership, column stripping, and encrypted direct payload security before sending.
5. Hardened relay dialing so empty tokens are rejected or skipped, and default token metadata derives an opaque per-peer token instead of accepting blank metadata.
6. Hardened BestChef recipe import fetches: HTTPS only, private/local/loopback/multicast hosts blocked, credentials stripped, redirects validated manually, and redirect count capped.
7. Hardened BestChef generated native config: disabled Android backup/legacy external storage, trimmed blocked legacy media/audio/storage permissions, set export-compliance encryption flag true, added SecureStore plugin, and added a local config plugin to keep post-plugin output hardened.
8. Resolved production dependency audit advisories with root `pnpm.overrides`; `pnpm audit --prod --audit-level moderate` is clean.

## Verification

- `pnpm --filter @mylife/sync typecheck` passed.
- `pnpm --filter @mylife/bestchef typecheck` passed.
- `pnpm --filter @mylife/bestchef-app typecheck` passed.
- `pnpm --filter @mylife/homes typecheck` passed.
- `pnpm --filter @mylife/web typecheck` passed, with the existing Next workspace-root warning from `/Users/trey/package-lock.json`.
- `pnpm --filter @mylife/sync test` passed, 759 tests.
- `pnpm --filter @mylife/bestchef test` passed, 597 tests.
- `pnpm --filter @mylife/bestchef-app test` passed, 10 tests.
- `pnpm --filter @mylife/homes test` passed, 201 tests.
- `pnpm --filter @mylife/web test:parity` passed, 114 passed and 4 skipped.
- `pnpm check:parity --quiet` passed, with the existing standalone-missing warnings.
- `pnpm --filter @mylife/bestchef-app exec expo config --type introspect --json` passed and confirmed the hardened iOS/Android config output.
- Targeted function gates passed for `packages/sync/src/identity/device-identity.ts`, `packages/sync/src/protocol/handshake.ts`, `packages/sync/src/protocol/share-session.ts`, `packages/sync/src/transport/relay-transport.ts`, `modules/bestchef/src/import/fetch.ts`, and `apps/bestchef/app/(root)/providers/DatabaseProvider.tsx`.
- `pnpm audit --prod --audit-level moderate` passed with no known vulnerabilities.

## Remaining Caveat

The standalone BestChef app now uses hardened sync primitives during bootstrap and sharing, but it still does not instantiate the full Automerge-backed `SyncEngine` on native or emit ongoing recipe/submission change logs. That is a separate product-integration phase because the native sync entry currently excludes the Automerge-backed engine.

Repo-wide `pnpm gate:function:changed` remains blocked by the pre-existing duplicate Notes route lint error at `apps/mobile/app/(notes)/discovery 2.tsx:48`; this is unrelated to the BestChef security files and is tracked in `errors_log.md`.
