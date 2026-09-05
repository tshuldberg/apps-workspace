# BestChef Security Pass

Date: 2026-04-24

Status: Remediated later on 2026-04-24. See `docs/sessions/2026-04-24-bestchef-security-remediation.md` for the implemented fixes and verification.

## Scope

- Standalone app: `apps/bestchef`
- Canonical business module: `modules/bestchef`
- Mesh communication substrate: `packages/sync`
- Related release config: Expo app config and generated introspection

## What Was Checked

- BestChef local database bootstrap, profile, media, location, submissions, comments, and settings storage.
- Recipe import network boundaries, including URL fetch, social metadata fetch, Open Food Facts lookup, and Claude API calls.
- Mesh sync identity, pairing, payload encryption, relay token, transport, direct-share, and module policy code paths.
- Dependency audit for production dependencies.

## Key Findings

1. Critical: sync identity private keys and pairing shared secrets are currently stored in SQLite as `local:` refs containing raw hex key material.
2. Critical: direct entity sharing bypasses the full authenticated sync handshake and sends share payloads as plain JSON.
3. High: relay connections can be attempted without a relay token through the generic transport path, and the relay token derivation path is still metadata-only.
4. High: default sync security is opportunistic, so a paired session can proceed without payload encryption if the shared-secret lookup fails.
5. Medium: BestChef standalone currently bootstraps sync tables, identity, and workspace defaults, but does not instantiate `SyncEngine` or record recipe/submission changes.
6. Medium: user-supplied recipe URLs are fetched without scheme or private-network validation.
7. Medium: Android generated config grants broad media/storage/location permissions and leaves Android backup enabled.
8. Medium: Expo iOS config declares `ITSAppUsesNonExemptEncryption: false` while the app imports custom sync cryptography. This needs export-compliance review.
9. Medium: `pnpm audit --prod --audit-level moderate` reports 45 advisories: 30 high, 15 moderate. BestChef-relevant runtime path includes `cheerio -> undici@7.22.0`; most other BestChef paths are transitive Expo CLI/Metro tooling.

## Positive Checks

- No hardcoded production API keys or service-role secrets were found under `apps/bestchef`, `modules/bestchef`, or `packages/sync`.
- SQL access in reviewed BestChef paths uses bind parameters rather than string-interpolated user input.
- BestChef `rc_settings` is marked `device_local` in the module sync policy, so local submissions, votes, comments, profile defaults, media URIs, language, and theme settings should not enter the regular sync change log when `ChangeTracker` is used.
- Targeted sync security tests passed.

## Verification

- `pnpm --filter @mylife/bestchef-app typecheck` passed.
- `pnpm --filter @mylife/bestchef-app test` passed, 10 tests.
- `pnpm --filter @mylife/bestchef test` passed, 590 tests.
- `pnpm --filter @mylife/sync typecheck` passed.
- `pnpm --filter @mylife/sync test -- --run src/__tests__/payload-security.test.ts src/__tests__/security-redteam.test.ts src/__tests__/relay-transport.test.ts src/__tests__/crdt.test.ts` passed, 82 tests.
- `pnpm --filter @mylife/bestchef-app exec expo config --type introspect --json` confirmed tracked iOS purpose strings are present in generated config.
- `pnpm audit --prod --audit-level moderate` failed with 45 advisories.

## Recommended Next Fix Pass

1. Move sync private keys and shared secrets to platform secure storage, and migrate SQLite rows to opaque refs.
2. Route `shareEntity` through authenticated pairing, module policy enforcement, column stripping, and `createSecureJsonMessage`.
3. Require non-empty relay tokens and implement actual HKDF-derived token creation before enabling relay in generic dialing.
4. Change BestChef sync bootstrap defaults to encryption `required` once key migration is in place.
5. Add URL validation for recipe import: `https:` only by default, block localhost/private IP ranges unless a developer flag is set.
6. Trim Android permissions, disable backup for private SQLite data, and review iOS export compliance.
7. Add pnpm overrides or dependency updates for BestChef-relevant advisories, starting with `undici >=7.24.0` through `cheerio`.

These items were addressed in `docs/sessions/2026-04-24-bestchef-security-remediation.md`, except the separate product-integration caveat that standalone BestChef still does not instantiate the full Automerge-backed `SyncEngine`.
