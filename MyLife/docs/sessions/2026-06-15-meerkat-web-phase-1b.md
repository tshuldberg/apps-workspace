# Meerkat Web Phase 1B - running, real web client + proof

Date: 2026-06-15
Branch: feature/meerkat-network
Scope: apps/meerkat-web only (App Isolation; @mylife/sync unmodified)

## Goal

Turn the Phase 1A web foundation (browser-sync-init + 3 browser storage
adapters) into a running, minimal-but-real Meerkat web client, and PROVE the
browser adapters + @mylife/sync carry a real session end to end.

## What was built

- `src/lib/meerkat-data.ts` (new): non-React DB-helper layer replicated verbatim
  from the cited app sources (App Isolation; the app's `data/*` files live inside
  the apps/meerkat boundary and cannot be deep-imported). Identity rows +
  settings (db.ts), sync wiring + community policy + rendezvous token
  (sync-core.ts), cm_ channel-message row helpers (community-core.ts), and
  `storeOwnedCommunity` (the create-path workspace bridge, mirroring the relay
  harness `installCommunityOnNode`). Every crypto/protocol primitive is consumed
  from @mylife/sync unchanged.
- `src/lib/MeerkatProvider.tsx` (new): one React context that boots via
  bootBrowserSync, resolves/creates identity with the MK-001 flush guarantee,
  builds a real NativeSyncEngine, and exposes a flat honest API: identity,
  fingerprint, engine, db, status, relayUrl/setRelayUrl, createCommunity,
  joinFromLink, createInviteLink, listCommunities, listChannelMessages,
  sendChannelMessage, runRelaySession, lastSession/lastSessionError, revision,
  refresh.
- `src/ui/App.tsx` (new): minimal honest UI - header strip (name + fingerprint +
  device id), relay bar (honest empty state, no fabricated default), communities
  list (create + join-by-link + copy invite), channel view (#general, message
  list + composer), manual relay session control (Sync now / Listen, phrase +
  peer id, real engine status, no fake "connected"/peer count).
- `src/main.tsx`: wraps App in MeerkatProvider.

## MK-001 web durability (hard requirement)

Web persistence is debounced/async, so an identity created and the tab closed
inside the 250ms debounce window would orphan the device keys (the exact MK-001
failure). `resolveOrCreateIdentity` in MeerkatProvider:

1. generateDeviceIdentity (writes the private key into the configured secret
   store's in-memory Map; only public fields go to mk_identity).
2. saveIdentityRow.
3. `await secrets.flush()` THEN `await db.flush()` - order matters: the private
   key bytes first, then the row that references them, so a crash between flushes
   never leaves a row pointing at an unflushed key.

Plus best-effort beforeunload + pagehide + visibilitychange(hidden) handlers
that flush both stores (cover later writes + mobile-Safari/BFCache where
beforeunload does not fire). The explicit await at create is the real guarantee.

Proven by `src/lib/__tests__/identity-durability.test.ts`:
- POSITIVE: generate -> flush -> simulate tab reload (drop in-memory caches, keep
  IndexedDB) -> reboot finds the row AND the private key bytes, matching.
- NEGATIVE control: build the stores with a 1,000,000ms debounce, write the row +
  secret WITHOUT flush, drop caches, reboot -> finds NO identity (so the flush is
  load-bearing, not decorative).

## The integration proof (Node-runnable)

`src/lib/__tests__/web-node-relay-e2e.test.ts`: two independent web nodes, each
using the REAL Phase 1A browser adapters (sql.js DatabaseAdapter with a per-node
in-memory bytes store + the WebCrypto/IndexedDB BrowserSecretStore) + a real
NativeSyncEngine, connected through a REAL @mylife/meerkat-relay
`startRelayServer` on 127.0.0.1 with Node `ws` injected as the WebSocket. Node A
creates a community + posts a signed channel message; node B joins via the invite
link; one manual relay session runs (connectRelayPeer + engine
syncWithConnection/handleIncomingConnection, the exact app path). Asserts B's OWN
sql.js cm_messages holds the verified row and resolveChannelMessages returns the
body. Both engines record a real lastSyncAt. Mirrors the relay harness's rung-4
channel-delivery test but with the browser adapters as the stores.

Secret-store isolation: configureSyncSecretStore is a process-global singleton
(one store per origin, the real web behavior), so the two nodes SHARE one
BrowserSecretStore keyed by distinct device refs; the per-node ISOLATED sql.js
DatabaseAdapter is what carries the proof. Documented in-test.

## Key debugging finding (the load-bearing fix)

The first integration run had the relay session complete but B received 0 cm_
rows (only meerkatpad synced). Root cause: in Node/vitest the default
NativeSyncEngine resolves the Automerge `DocumentManager` (binary sync messages
the session's scope filter cannot parse), whereas the native app resolves
`document-manager.native.ts` = `LwwDocumentManager` (plain-JSON snapshots). Fix:
pass `documentManager: new LwwDocumentManager()` to the engine (same trick the
relay harness uses). This is also the correct PRODUCT decision - the web node
must speak the same LWW CRDT wire format as native Meerkat nodes to interoperate
over the relay.

## Build fix (Vite aliases)

`@mylife/sync` package `main` is index.ts, which statically re-exports Node-only
modules (filesystem BlobStore, torrent crypto) and the Automerge DocumentManager
(WASM). For the web bundle, vite.config.ts adds two resolve aliases mirroring
Metro's native resolution:
- `@mylife/sync` -> `src/index.native.ts` (the mobile-safe subset: relay-only, no
  Node fs).
- any `crdt/document-manager` -> `crdt/document-manager.native.ts` (LWW).
This keeps Automerge and Node builtins entirely out of the web bundle and is the
honest web profile (matches what native ships).

## Honesty boundary

Web is relay-only (no LAN). DEFAULT_RELAY_URL stays ''. The relay bar shows an
honest "set a relay URL" empty state, never a fabricated default. Session status
comes only from the real engine status store + the returned SyncSession; no fake
"connected" or peer count. No blocking SAS step (community module is not
isSensitive). No mailbox parking in 1B (native Phase 2); messages cross only when
a relay session runs, and the UI copy says so.

## Files

Created:
- apps/meerkat-web/src/lib/meerkat-data.ts
- apps/meerkat-web/src/lib/MeerkatProvider.tsx
- apps/meerkat-web/src/lib/__tests__/identity-durability.test.ts
- apps/meerkat-web/src/lib/__tests__/web-node-relay-e2e.test.ts
- apps/meerkat-web/src/ui/App.tsx

Modified:
- apps/meerkat-web/src/main.tsx (wire MeerkatProvider + App)
- apps/meerkat-web/vite.config.ts (resolve aliases: sync native entry + LWW doc manager)
- apps/meerkat-web/package.json (devDeps: @mylife/meerkat-relay, ws, @types/ws)

## Verification (all run, all green)

- `pnpm --filter @mylife/meerkat-web test`: 6 files, 17 tests passed (incl. the
  integration proof + the MK-001 positive + negative persistence tests).
- `pnpm --filter @mylife/meerkat-web typecheck`: clean.
- `pnpm --filter @mylife/meerkat-web build`: built (Automerge + Node fs out of the
  bundle; one benign Vite dynamic/static chunking notice).
- `pnpm gate:function:changed`: exit 0 (relay 110 tests + mobile/web consumer
  typechecks green; triggered by the pnpm-lock devDep change).

## Remaining

- Live two-tab / phone relay QA (cannot run headless here): start a local relay
  with `PORT=8787 pnpm --filter @mylife/meerkat-relay start`, set the relay URL to
  `ws://<host>:8787` in two tabs, create a community in tab A, copy the invite to
  tab B, join, post in A, then run "Sync now" in A + "Listen" in B on a shared
  phrase, confirm the message appears in B.
- Phase 2 web: offline mailbox parking, attachments/blobs, richer UI.
