# SYNC-REAL: Real browser sync engine in the hub web app

Date: 2026-06-25
Branch: feature/mylife-improvements-sprints
Ticket: SYNC-REAL (Sprint 3, second headline build). Supersedes WEB-FIX-2.

## Goal

Every mesh-sync screen on web was a mock (randomly-generated placeholder codes,
fake "request sent" banners, mock workspace/transport lists), the web app never
instantiated a SyncEngine, and the data-sync tier-change path threw because no
tier handler was registered. Make it real: instantiate a real SyncEngine for the
hub using browser adapters (mirroring apps/meerkat-web), wire setSyncProvider +
setTierChangeHandler + createSyncTables, and replace the four mock screens with
real engine-backed flows. Keep the production build green and all imports
browser-safe (no Node fs / Automerge in the bundle).

## What shipped (all real, locally verified)

### Browser sync bootstrap (apps/web/lib/sync/)
- `idb.ts` - promise-wrapped IndexedDB (two stores: sqlite bytes + secrets).
- `load-sqljs.ts` - Next-safe sql.js loader. sql.js's UMD entry references node
  fs/path/crypto at module scope; webpack cannot resolve those in a client
  bundle (Vite stubs them, Next does not). So sql.js is kept OUT of the webpack
  graph entirely: the UMD loader + wasm are copied to public/ and the loader is
  injected as a runtime <script>, then the global initSqlJs is read.
- `browser-database-adapter.ts` - synchronous @mylife/db DatabaseAdapter backed
  by sql.js, persisted to IndexedDB (debounced), mirroring meerkat-web.
- `browser-secret-store.ts` - synchronous SyncSecretStore backed by IndexedDB
  (in-memory image + background persist); holds device private keys + per-peer
  shared secrets (MK-001 durability).
- `browser-sync-boot.ts` - boots PRNG (WebCrypto) -> secret store -> sql.js DB ->
  createSyncTables -> resolve/create the real device identity (persisted) ->
  auto-create a Personal workspace owned by this device. Singleton + cached.
- `hub-sync-engine.ts` - instantiates a real NativeSyncEngine (LWW document
  manager, no Automerge), registers a real SyncProvider via setSyncProvider, and
  a setTierChangeHandler that switches local tiers and refuses cloud tiers with
  honest copy. getStatus() is memoized (cache key tier+lastSyncAt+pendingChanges)
  so useSyncExternalStore does not loop.
- `components/HubSyncProvider.tsx` - boots the engine once client-side and
  exposes { ready, error, handle } to the pages; wired into Providers.tsx.

### packages/sync (one web-safe entry, no shared-logic change)
- `crdt/document-manager.web.ts` - re-exports LwwDocumentManager as
  DocumentManager. Next prefers `.web.ts`, so the bare
  `import '../crdt/document-manager'` inside sync-engine.native.ts (and
  sync-session.ts) resolves to the LWW manager on web and Automerge WASM never
  enters the bundle. Mobile (Metro -> .native.ts) and Node tests (.ts) unchanged.

### Four pages (now real)
- pair-device: shows this device's REAL pairing payload (real Ed25519 + X25519
  public keys); pasting the other device's payload derives the X25519 DH shared
  secret and the REAL 5-emoji SAS via deriveSas; user compares; confirm calls
  completePairing (stores the real shared secret) + insertPairedDevice +
  recordSasVerification. No random codes.
- sync-workspaces: real getWorkspaces/createWorkspace/addWorkspaceMember +
  member counts + last-session times. Auto Personal workspace.
- transport-preferences: real getTransportPreferences/setTransportPreferences
  keyed by device pubkey; rank persisted. Honest note that a browser can only
  use WebRTC/Relay (LAN/nearby/BLE are device-only).
- data-sync: real status/tier from the engine; tier-change no longer throws;
  cloud tiers refused with honest copy; real paired-device count + link to the
  real pairing flow; Backup surfaced prominently as the supported cross-device
  method.
- settings/page.tsx: links pair-device, sync-workspaces, transport-preferences;
  Backup relabeled "move to a new device".

### Config
- apps/web/middleware.ts: added `'wasm-unsafe-eval'` to the production CSP
  script-src (WASM-only; does NOT permit JS eval). The prior CSP blocked sql.js
  WASM instantiation in production, which silently prevented the engine booting.
- apps/web/package.json: + sql.js 1.13.0, + @types/sql.js; predev/prebuild copy
  the sql.js loader + wasm into public/ (scripts/copy-sql-wasm.mjs). public
  assets gitignored (apps/web/.gitignore).

## Verification (evidence)

- `pnpm --filter @mylife/web typecheck` clean.
- `pnpm --filter @mylife/sync test`: 1180/1180 pass (web-safe entry does not
  affect mobile/node resolution).
- Real-crypto smoke (temp vitest, removed): two real identities derive the SAME
  X25519 shared secret and the SAME 5-emoji SAS (e.g. 16-32-36-5-15); a MITM key
  derives a DIFFERENT SAS; completePairing stores a shared secret retrievable by
  ref. Engine-backed, not a placeholder.
- `pnpm --filter web build`: exits 0; all four sync routes compile + prerender.
- Playwright on the production build (port 3210):
  - pair-device: engine boots, real pairing payload renders (real 64-hex
    Ed25519 + X25519 keys), pasting a real second-device payload derives a real
    5-emoji SAS (🐞 🌲 🍍 🎲 🦒) + the Pair/confirm flow.
  - sync-workspaces: Personal auto-created; creating "Family QA" -> count 1->2;
    persists across a full reload (sql.js -> IndexedDB round-trip).
  - transport-preferences: reorder + Save -> "Preferences saved"; the new order
    persists across reload.
  - data-sync: no render error; tier switch to p2p does NOT throw; selecting a
    cloud tier shows the honest "Cloud sync is not available..." banner; Backup
    callout + link present.

## Honesty boundary (founder ops)

Milestone 1 = whole-hub device-to-device sync for the user's own devices. The
key exchange, identity, SAS, workspaces, and transport prefs are all real and
local. Actually MOVING data between two devices needs a deployed relay and a
second physical device (founder ops + device QA), so the paired/syncing claims
are gated behind honest copy and Backup & Restore is surfaced as the supported
cross-device method. Layering Meerkat transport is Milestone 2 (out of scope).
Two devices were NOT observed paired/synced; not claimed.

## Bug found + fixed mid-build

`/settings/data-sync` crashed with React #185 (max update depth): HubSyncProvider
.getStatus() returned a fresh object each call, so useSyncStatus's
useSyncExternalStore getSnapshot never settled. Fixed by memoizing getStatus()
behind a cache key. See errors_log.md.

## Files changed

- packages/sync/src/crdt/document-manager.web.ts (new)
- apps/web/lib/sync/{idb,load-sqljs,browser-database-adapter,browser-secret-store,browser-sync-boot,hub-sync-engine}.ts (new)
- apps/web/components/HubSyncProvider.tsx (new)
- apps/web/scripts/copy-sql-wasm.mjs (new)
- apps/web/.gitignore (new)
- apps/web/components/Providers.tsx
- apps/web/app/settings/{pair-device,sync-workspaces,transport-preferences,data-sync}/page.tsx
- apps/web/app/settings/page.tsx
- apps/web/middleware.ts
- apps/web/package.json (+ sql.js, @types/sql.js, copy scripts)

## Remaining / handoff

- Device-to-device transfer QA across two real devices + a deployed relay
  (founder ops). Until then the paired/syncing UI stays honest.
- Milestone 2: layer Meerkat transport over the hub sync engine.
- Pre-existing data-sync lint warnings (authLoading, entitlements unused) left
  untouched (present in HEAD, not introduced here).
