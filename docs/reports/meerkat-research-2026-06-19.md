# Meerkat Research - 2026-06-19

## Scope

Reviewed the Meerkat git history and current source across:

- `/Users/trey/Desktop/Apps/MyLife/apps/meerkat`
- `/Users/trey/Desktop/Apps/MyLife/apps/meerkat-web`
- `/Users/trey/Desktop/Apps/MyLife/packages/sync`
- `/Users/trey/Desktop/Apps/MyLife/packages/meerkat-relay`

Working tree note: pre-existing local changes were present in `.claude/settings.json` and several `packages/meerkat-relay/bin/*.mjs` files. This review did not modify product code.

## Git History Summary

- Current branch: `fix/ci-green`, current HEAD: `7f4d6240`.
- Current checked-out Meerkat path history across app, web, sync, and relay: 20 commits from 2026-03-05 through 2026-06-17.
- `apps/meerkat` itself has 5 path commits, all June 14 to June 17, 2026.
- A June 18 MK-P01 posts branch exists in history, but `a63f2530` is not an ancestor of current `HEAD`.

Key checked-out milestones:

- `1af44fb3` on 2026-06-14: standalone mobile app, sync v2, zero-knowledge relay.
- `60eaa9f1` on 2026-06-14: in-channel files, file index, request and approve re-send.
- `62943a1c` on 2026-06-15: web client foundation and tester guide.
- `16d1ae3b` on 2026-06-16: zero-knowledge community feed and community node.
- `0822062d` on 2026-06-17: full web client UX.
- `d2b57e4b` on 2026-06-17: one-click and self-serve relay deploy onboarding.

## How Meerkat Works

Meerkat is a local encrypted node with mobile and web clients. The app does not own crypto primitives. It consumes `@mylife/sync` for identity, sealed shares, pairing, friend-code rendezvous, signed communities, group keys, channel messages, mailbox delivery, relay sessions, LAN sessions, and host discovery.

Data model:

- `mk_`: local-only identity, settings, and pinned manifest index.
- `mp_`: manual sync bellwether pad.
- `cm_`: signed community messages, attachments, read state, and related community data.
- `sync_`: engine-owned pairing and session tables.

Transport:

- Relay is real for manual sessions and forwards ciphertext only.
- LAN is real for dev builds with native modules.
- Browser client is relay-only.
- Automatic live peer auto-dial is not built.
- Background mailbox drain exists as an honest on-demand and deferred OS-scheduled slice.

Storage:

- Mobile uses Expo SQLite, Expo SecureStore, Expo Crypto, and filesystem blocks.
- Web uses sql.js, IndexedDB or OPFS, and WebCrypto.
- Hosted community nodes store opaque encrypted pieces and per-community snapshots, with per-member signed auth. They do not hold group keys.

## Distribution Readiness

Ready or close:

- Native app code exists.
- Web client exists.
- Relay image, Render, Fly, Docker, Caddy, and GHCR publishing artifacts exist.
- Community node runtime exists.
- Automated protocol coverage is broad.

Blockers before broad public distribution:

- `apps/meerkat/app.json` is missing. `expo config` falls back to package metadata, producing name `@mylife/meerkat-app`, slug `@mylifemeerkat-app`, and no checked bundle IDs or deep-link scheme.
- Meerkat has no billing or entitlement integration. Its build guard explicitly says no paywall and no RevenueCat.
- No default hosted relay is deployed or baked into mobile or web.
- Physical device QA is still pending for two-device, three-device, LAN, background execution, push wake, and real TLS/WAN behavior.
- Web has no auth, billing, hosted entitlement sync, or desktop wrapper yet.

## Secure $4.99 Per-User Path

Recommended model: treat `$4.99/user` as a recurring hosted service price, not the existing one-time MyLife standalone-module SKU. Meerkat has ongoing relay, community node, storage, egress, monitoring, abuse, and support cost.

Architecture:

- Mobile: App Store and Google Play subscription products, ideally unified through RevenueCat or the existing `@mylife/subscription` abstraction.
- Web: Stripe Billing subscription.
- Server entitlement authority: webhook-verified store events create short-lived signed entitlement tokens.
- Client gate: app and web cache entitlements for offline use, but hosted relay and community node access must be enforced server-side.
- Hosted nodes stay zero-knowledge: billing gates provisioning and quota, never plaintext.

Security requirements:

- Store private device keys only in platform secure storage or WebCrypto-backed origin storage.
- Do not put billing secrets in clients.
- Verify App Store, Play, RevenueCat, and Stripe webhooks server-side.
- Sign entitlements server-side with rotating keys and expiry.
- Enforce quota, rate limits, tenant isolation, revocation, and audit logs at relay and community-node boundaries.
- Keep UI copy honest: no fake connected status, delivered status, peer count, or mesh claims.

## Recommendation

Ship order:

1. Fix packaging: add Meerkat Expo config, icons, bundle IDs, schemes, permissions, privacy copy, and store metadata.
2. Deploy the hosted relay plus community node with TLS, monitoring, and rate limits.
3. Add Meerkat billing SKU and entitlement bridge for mobile and web.
4. Gate hosted services server-side while keeping local-only mode free or limited.
5. Run physical device QA and web runtime QA.
6. Package all formats: iOS App Store, Google Play, hosted web/PWA, and signed desktop wrappers from the web client.
