# Meerkat

The front door to the Meerkat private network: a standalone Expo app that runs a
local encrypted node on your device. The node creates, seals, signs, seeds, and
shares content using the real cryptography in `@mylife/sync`.

## Honest state (what works today)

Meerkat does **real local crypto, manual sync, and signed community chat**:

- Generates a persistent Ed25519/X25519 device identity (keys in the OS keychain).
- Generates and checksum-validates friend codes (`MEER-XXXX-XXXX-XXXX-XXXX`).
- Seals content into end-to-end encrypted, signed, content-addressed shares.
- Pins (seeds) sealed blocks to on-device storage and indexes manifests in SQLite.
- Builds and parses `meerkat://` and `magnet:` share links.
- Opens and verifies sealed content end to end (signature, per-chunk hash,
  Merkle root, authenticated decryption), failing closed on any tamper.
- Pairs devices by signed payload or one-time relay friend code, with TOFU key
  pinning and five-emoji SAS verification.
- Runs real manual relay sessions and development-build LAN sessions over the
  native sync engine.
- Creates invite-only signed communities with channels, members, roles, unread
  badges, channel messages, edits/deletes, attachments, and best-effort offline
  mailbox delivery.
- Fetches a host-seeded channel-history snapshot from a pasted signed manifest,
  verifies the encrypted snapshot with the current community group key, and
  imports new signed message events into local channel history.
- Opens `meerkat://share` and magnet links from local pins or pasted HTTP node
  hosts. Remote sealed blocks are verified against the link author/key before
  they are pinned locally.

What does **not** exist yet is automatic/background sync, automatic host catalog
discovery for scrollback, push wake, or automatic peer/host discovery for share
links. Every screen that could be misread as live network connectivity says so
plainly. The app never claims to be "connected to a mesh".

## Screens

Five tabs, all over the real node layer:

- **Node:** local node status (honest), storage stats, and the list of pinned
  content. Tap an item to see its share link and run a local decrypt round-trip.
- **Share:** write text, pick a scope, seal and pin it, then copy the resulting
  `meerkat://` / magnet link. Also opens a pasted link against locally pinned
  content or pasted HTTP node hosts.
- **Identity:** device fingerprint, full public key, editable display name, and
  your friend code with copy and regenerate.
- **Communities:** create and join signed invite-only communities, open
  channels, post signed messages and attachments, view unread badges, and fetch
  host history from a pasted manifest.
- **Settings:** secure storage status, node storage usage, "Clear local node"
  (destructive), alpha test readiness, copyable diagnostics, honest transport
  status, about, and reset identity (destructive).

## Architecture

```
apps/meerkat/
  app/
    _layout.tsx                  # GestureHandler + StatusBar + ErrorBoundary + Stack
    index.tsx                    # redirect into (root)/(tabs)
    (root)/
      _layout.tsx                # SafeArea > AppTheme > Database > Identity > Node > Stack
      (tabs)/                    # 5 tab screens (Node, Share, Identity, Communities, Settings)
      (tabs)/channel/[communityId]/[channelId].tsx # channel chat
      pinned/[id].tsx            # pinned content detail + decrypt round-trip
      sync.tsx                   # pairing, manual relay/LAN sessions, session history
      providers/                 # AppTheme, Database, Identity, Node, Sync, Chat
      data/db.ts                 # meerkat.db schema (mk_ tables) + helpers
      data/community-core.ts     # cm_ community chat schema + helpers
      data/channel-history-import.ts # host-history manifest parse/fetch/import
      data/expo-node-store.ts    # ExpoNodeStore: filesystem blocks + SQLite manifest index
      data/expo-blob-store.ts    # attachment blob bytes for sync sessions
      components/                # ErrorBoundary + UI kit
      theme/tokens.ts            # Meerkat mint/teal palette + formatters
    __tests__/                   # node-core flow + app-config (Node-only, vitest)
  scripts/check-build-env.mjs    # EAS pre-install guard (permissive; no billing)
  shims/crypto.js                # Metro shim: Node crypto.randomBytes -> Web Crypto
```

## The node layer it consumes

All cryptography and storage logic lives in `@mylife/sync` (the `node` barrel),
already built and tested. This app is a UI over it: identity, friend codes,
`createSealedShare` / `openSealedShare`, `buildShareLink` / `parseShareLink`,
`pinShare` / `fetchFromStore` / `unpinShare`, pairing, relay/LAN session
helpers, community descriptors, channel messages, mailbox delivery, and the
`NodeStore` / blob provider interfaces. **Do not** reimplement crypto here.

## Run

```bash
pnpm install                          # from repo root
pnpm --filter @mylife/meerkat-app dev # Expo dev server
pnpm --filter @mylife/meerkat-app typecheck
pnpm --filter @mylife/meerkat-app test
node scripts/check-meerkat-parity.mjs # from repo root
```

## Table prefixes

Local app tables use `mk_`; the manual sync bellwether uses `mp_`; community
chat uses `cm_`; engine-owned tables use `sync_`.

## Conventions

- TypeScript strict everywhere, no `any`.
- No em dashes in code or docs.
- Never fake transport, "connected" status, delivery, read receipts, or peer
  counts. Every number must come from engine/session tables or local records.
