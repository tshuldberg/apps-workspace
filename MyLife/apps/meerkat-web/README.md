# Meerkat web

The browser build of Meerkat (`@mylife/meerkat-web`): a Vite + React single-page
app that runs the same local encrypted node as the mobile app, using the real
cryptography in `@mylife/sync`. Identity keys, sealed blocks, and the SQLite index
live in the browser (IndexedDB + sql.js), never on a server.

This app is a byte-for-byte twin of the mobile app on all shared logic (identity,
sealed shares, community chat, public layer, the relay-dial choke point, share
intake). `node scripts/check-meerkat-parity.mjs` (from the repo root) locks the
twins so a change to one surface cannot silently diverge from the other.

## Connectivity (relay-only in the browser)

A browser has no raw sockets and no background scheduler, so web Meerkat is
**relay-only**. There is no local Wi-Fi (LAN) transfer, no background sync, and no
peer-to-peer data transport (no WebRTC / Nearby / BLE data backend anywhere in the
web tree). The Settings **Connection options** section says this plainly: only the
encrypted connection server is available; LAN and background sync are marked not
available in the browser.

- **The dial choke point.** Never read the relay setting directly. Always dial
  through `effectiveRelayUrl(db)` (`src/lib/effective-relay.ts`), the single choke
  point that wraps the pure `@mylife/sync` decision. It health-gates the free
  default (dialed only after a real `GET /healthz` probe recorded in the
  device-local `mk_relay_probe` cache) and honors the per-device opt-out. The
  default relay URL defaults to empty, so a build with no configured default has
  no out-of-box connectivity, and the copy never implies otherwise.
- **The connection status card.** `src/ui/sync/ConnectionStatusCard.tsx` runs the
  real `/healthz` probe and renders one of five honest states (checking / no
  connection server / unreachable / free server reachable / your server
  reachable), with a "Check again" button. It is a verbatim twin of the mobile
  card and is rendered in both connection surfaces: the Sync dialog
  (`SyncDialog.tsx`) and Settings > Connection server (`RelaySection.tsx`). No
  state is a peer count, an online dot, or a "connected to {friend}" claim.
- **A connection server is a meeting point, not delivery.** A manual session still
  needs the other device online at the same time. The `StatusPill` never renders a
  peer/online count (it is always 0 in the browser, so it stays hidden).

## Share intake (staged is not sent)

Content comes into web Meerkat two ways, both of which stage into the device-local
`mk_share_intake` / `mk_share_payload` tables through the single `@mylife/sync`
`ensureShareIntakeTables` source of truth. Those tables sit outside the sync prefix
map, so they replicate nothing.

- **File pick and drag-and-drop.** The Share Inbox (`src/ui/inbox/ShareInbox.tsx`)
  has a dropzone and a file picker; dropped or chosen files are re-sniffed for
  their real MIME and staged locally.
- **Web Share Target (capability-gated).** When Meerkat is installed as a PWA on a
  browser that supports a service worker plus the Cache API, other apps can share
  INTO it (`src/lib/web-share-target.ts`). This is entirely optional and
  feature-detected: `isWebShareTargetSupported()` gates the install hint, so where
  the browser cannot host a share target the entry is absent, never a faked button.

**Staged is not sent.** A staged item is never delivered until it is routed into a
real message. The inbox shows "Sent" only when `isShareIntakeSent` finds a real
`cm_messages` row (a `COUNT(*)` against the real table), never off
`mk_share_intake.status`. The direct-message destination is hidden behind a false
flag until it ships, so it is absent rather than a dead button.

## Commands

```bash
pnpm --filter @mylife/meerkat-web dev        # Vite dev server
pnpm --filter @mylife/meerkat-web build      # production build
pnpm --filter @mylife/meerkat-web preview    # preview the build
pnpm --filter @mylife/meerkat-web typecheck  # tsc --noEmit
pnpm --filter @mylife/meerkat-web test       # vitest
node scripts/check-meerkat-parity.mjs        # from repo root: mobile/web twin locks
```

## Layout

```
src/
  main.tsx                     # SPA entry
  lib/                         # node layer + data (twins of the mobile data/ dir)
    effective-relay.ts         # the single relay-dial choke point (health-gated default)
    schema.ts                  # mk_ / cm_ schema, share-intake + mk_relay_probe DDL
    meerkat-data.ts            # MEERKAT_SYNC_PREFIXES (share/probe tables excluded)
    share-route.ts             # isShareIntakeSent (reads the real cm_messages table)
    web-share-target.ts        # capability-gated PWA Web Share Target
    public-publish.ts          # byte-identical twin of the mobile publish path
    storage/                   # browser NodeStore, blob store, secret store, sql.js
  ui/
    sync/ConnectionStatusCard.tsx  # 5-state connection card (twin of mobile)
    sync/SyncDialog.tsx, RelayBar.tsx
    settings/RelaySection.tsx, TransportSection.tsx
    inbox/ShareInbox.tsx           # file-pick / drag-drop + Web Share Target hint
    shell/StatusPill.tsx           # never renders a peer/online count
```

## Honesty rules (do not regress)

- No out-of-box connectivity a given build does not have (the default relay URL may
  be empty).
- Never fake a "connected" status, a peer count, or a transfer in flight. Every
  number shown comes from the engine or the `sync_` / `cm_` tables.
- Keep the web tree relay-only: no WebRTC / Nearby / BLE data backend, and no such
  rung in the Connection options section (the parity check enforces this).
