# Meerkat runtime and privacy contracts

Preserved from `MyLife/apps/meerkat/AGENTS.md` during the September 5, 2026 instruction reset. Paths in the retained text are relative to the originating project/package unless stated otherwise. Dated rollout notes are historical evidence, not current readiness claims. Consult the relevant contract when changing its implementation; generic agent workflow is governed by AGENTS.md.

## The @mylife/sync node-layer dependency

This app owns no cryptography. It consumes from `@mylife/sync` (do not reimplement any of it; extend the sync package if a primitive is missing):

- **Identity + config:** `generateDeviceIdentity`, `getPublicKeyFingerprint`, `configureSyncSecretStore`, `configureSyncPrng` (+ `hasConfigured*` checks).
- **Friend codes + rendezvous (MK-016):** `generateFriendCode` / `parseFriendCode` / `isValidFriendCode`; `publishIdentityToRendezvous` / `resolveIdentityFromRendezvous` publish and resolve a signed identity bundle under a code. The relay record is opaque, one-time, TTL-bound.
- **Identity bundles + TOFU (MK-015):** `createSignedIdentityBundle`, `verifySignedIdentityBundle`, `evaluateBundleTrust`; pin store via `getPinnedIdentity` / `pinIdentity` / `touchPinnedIdentity`.
- **Sealed shares + links:** `createSealedShare` / `openSealedShare`; `buildShareLink` / `buildMagnetLink` / `parseShareLink`.
- **Store:** `NodeStore` contract (`pinShare`, `loadSealedShare`, `fetchFromStore`, `unpinShare`, ...). `ExpoNodeStore` in `app/(root)/data/expo-node-store.ts` is the on-device implementation (filesystem blocks + SQLite index).
- **Sync engine (MK-008):** `NativeSyncEngine`, `WebSocketRelayBackend`, `connectRelayPeer`, `createSyncTables`, pairing helpers, `getRecentSyncSessions`, `sha512Hex`.
- **LAN rung (MK-007):** `connectLanPeer`, `startLanListener`, `LanSocketBackend`, `LANDiscovery`. App adapters live in `data/lan-backend.ts` (react-native-tcp-socket + react-native-zeroconf, lazy-loaded; null when native modules are absent so relay flow and Expo Go keep working).


## Transport honesty boundary (Critical)

- The RELAY rung is live for MANUAL sessions only (MK-008): both devices join a relay on a phrase-derived token, one taps Listen and the other Sync now, and a real engine session runs (Ed25519 handshake, encrypted payloads, MK-002 inbound enforcement). The Sync screen shows only real recorded sessions.
- Hardened 2026-06-12 (MK-044, audit P0): sessions DEFAULT to required encryption (plaintext only by explicit mutual encryptionMode 'off'), a dropped negotiation frame fails the session instead of downgrading, batch signatures are mandatory on every SYNC_DATA, acks are intersected with the sent batch, and every frame crosses the wire inside a pairwise frame envelope, so the relay sees only sizes and timing (no device ids, no message types, no timestamps).
- The LAN rung is live for MANUAL sessions in a DEV BUILD only (MK-007). Without the native modules the actions fail with recovery guidance, never crash. iOS needs the Local Network permission (NSLocalNetworkUsageDescription + NSBonjourServices are set in app.json).
- Automatic dialing is opt-in (Automatic connections, off by default, Plan 29 item 12): when on, the app runs ONE composed foreground round (mailbox drain + auto-connect session sync over real recorded sessions) on app foreground and when a paired peer appears on the local network. It runs only while the app is open, never flips background_sync_enabled, and shows only real round counts. Copy must never claim a peer is online or that data moved without a real session.
- **Connectivity, the relay-dial choke point (Plan 20):** never read `getSetting(db, RELAY_URL_SETTING_KEY) || DEFAULT_RELAY_URL` directly. ALWAYS dial through `effectiveRelayUrl(db)` (`data/effective-relay.ts`), the single choke point over the pure `@mylife/sync` `pickEffectiveRelayUrl`. It HEALTH-GATES the free default: dialed only after a real `GET /healthz` probe recorded in the device-local `mk_relay_probe` cache, honoring the per-device `default_relay_optout` (AC-4). `DEFAULT_RELAY_URL` is env-read from `app.config.ts` `extra.defaultRelayUrl` and DEFAULTS to `''`; a build with no configured default has NO out-of-box connectivity, and copy must never imply otherwise.
- **Connection status card (Plan 20):** `components/ConnectionStatusCard.tsx` runs the real `/healthz` probe on mount and renders one of five HONEST states (checking / no connection server / unreachable / free server reachable / your server reachable), writing `mk_relay_probe`. It is a verbatim twin with the web card; `check-meerkat-parity.mjs` locks the exact state + pill strings across both surfaces. No state string is a peer count, an online dot, or a "connected to {friend}" claim. A connection card value (`parseConnectionCard`) is a NON-SECRET transport address only (a DoS-risk input): never read, trust, or impersonate its contents beyond dialing it as an address.
- **OS share intake (Plan 20), staged != sent:** an OS share (or file pick) stages into device-local `mk_share_intake` / `mk_share_payload` tables via the single `@mylife/sync` `ensureShareIntakeTables` source of truth. Those tables are deliberately OUTSIDE `MEERKAT_SYNC_PREFIXES` and replicate NOTHING. The Share Inbox shows "Sent" only when `isShareIntakeSent` finds a real `cm_messages` row, never off `mk_share_intake.status`. DMs (1:1 + group) are live on both surfaces (Plan 21, 2026-07-04); delivery lines come only from real verified receipts, and `dm_` tables stay device-local and never replicate.
- **WebRTC / Nearby / BLE rungs are real but mobile-only (Plan 20):** backends under `data/transport-backends.ts`, `data/webrtc-backend.ts`, `data/nearby-backend.ts` are lazy-loaded and NOT Expo-Go-testable (they need a dev/EAS build; they null out when modules are absent, mirroring `lan-backend.ts`). A WebRTC session reports connected ONLY after a real ICE negotiation completes. BLE is WAKE-ONLY (excluded from `DATA_TRANSPORT_LAYER_IDS`), never a data-carrying transport. The web app ships none of these and stays relay-only. Never present a `Simulated*Backend` as a live rung.
- Background mailbox drain is the one honest background slice (Task 3): a best-effort, on-demand drain of channel messages a paired device parked for you while offline, via `runBackgroundSyncOnce` -> `runMailboxDrainJob`, opening only envelopes that verify against this device's key (fail-closed; bad signature / wrong recipient / undecryptable is dropped and counted, NOTHING written). OS-scheduled background runs and data-only push wake are wired but disabled pending release validation behind a dev-build flag (`mk_settings` `background_sync_enabled`, default false); native modules are lazy-loaded and registration no-ops when absent (Expo Go safe). A data-only push only ENQUEUES a drain; a "message received" notification is emitted ONLY after a real applied>0 count. Manual and background relay sessions both go through `runSyncSessionJob` so the paths cannot drift.
- NEVER fake a "connected to mesh" status, a peer count, or a transfer in flight. Every number shown must come from the engine or the sync_ tables.
- The "Open a link" flow opens locally pinned content first; otherwise it fetches the sealed manifest + blocks through `fetchAndPinFromHosts`, verifies with the link key and author, then pins locally. Hosts come from user-pasted URLs unioned with hosts discovered from a configured relay's zero-knowledge host registry (`lookupContentHosts`). Discovery only produces candidates; trust stays entirely in the verify-then-pin path (malicious announcers are skipped fail-closed). The standalone app is resolve-only and never announces its own pins.


## Plan 51 verification account (Critical)

- Two identities, one-way wall: the VERIFICATION ACCOUNT (Sign in with Apple / Google via `data/account-core.ts`) holds only verification checks + entitlement on the account service; the Meerkat identity (device keypair) is never registered with it. Public participation presents an anonymous blind-signed credential (`x-mk-credential`, minted via `@mylife/sync` blind-credential primitives). No mk_ table, log, or request may carry an account identifier next to a persona/device identifier.
- AC-4: private mesh (DMs, communities, sync) NEVER touches account-core. `app/__tests__/account-isolation.test.ts` is the import-graph guard; extend its allowlist only for genuine account/public-layer surfaces. The sign-in screen lives at the ENTITLEMENT boundary (upgrade + settings), never first launch.
- Account secrets (session bearer, credential, pending mint state) live in the isolated keychain service `com.mylife.meerkat.account`, never in mk_settings.
- Fail-closed honesty (AC-6): unconfigured accountServiceUrl / provider ids give `{ reason: 'not_configured' }` and honest copy; nothing ever fabricates a signed-in, verified, or entitled state. Design doc: `docs/designs/meerkat-account-verification-architecture.md`.
- Age gate: the neutral first-launch gate stays the universal floor. A store ADULT signal may write a 'store'-sourced pass via the shared age-gate core; a minor/unknown signal changes nothing and can never lock. Never overwrite a locked record.
- Account deletion (settings) is independent of "Delete my data": SSO re-auth, clears isolated local account secrets, and never submits a public pass. Until ownership binding is established, account deletion cannot authorize pass revocation. Copy states that other pass copies remain valid through their period and grace interval and that in-app data is untouched.


## Durability fix (MK-001)

`data/meerkat-db.ts` is the single source of truth for the MK-001 boot order: `getMeerkatDatabase()` configures the sync PRNG (`expo-crypto`) and secret store (`expo-secure-store`) BEFORE opening the db or any identity/seal call. `DatabaseProvider` (foreground) and `runBackgroundSyncOnce` (headless) both call it so the boot order cannot drift. Without it, a relaunch or headless run would orphan authored shares (keys would live in the sync package's default in-memory Map instead of the OS keychain).


## Private storage boundary (S4)

`data/private-storage.ts` owns the internal filesystem root. Standalone iOS uses `Library/Application Support/MeerkatPrivate/`; Android retains its app sandbox, and Expo Go retains only its explicitly identified experience sandbox (the developer host does not enable Meerkat Files sharing). Every internal writer, snapshot, restore, reset, and SQLite open must use this boundary. Foreground and headless boot recover legacy restores and migrate internal entries before opening SQLite; conflicts fail closed. Only explicit exports use `Documents/Meerkat Exports/`. Never place private working files in the export directory or reintroduce a Documents fallback on standalone iOS.


## Table prefixes (mk_, mp_, cm_, sync_)

`mk_` tables are deliberately OUTSIDE the sync prefix map and never replicate. Sealed ciphertext blocks are files under `getPrivateStorageRoot()/meerkat/blocks/`, not DB rows.

| Table group | Purpose |
|-------------|---------|
| `mk_identity`, `mk_settings` | Single `self` identity row; key/value settings (`friend_code`, `relay_url`, `background_sync_enabled` default false, `last_background_run_at` real runs only) |
| `mk_pinned`, `mk_library_pin_policy`, `mk_library_kept`, `mk_community_prefs` | Pinned manifest index (PK content_id + pin_context, pin_class, refcounted blocks) and device-local pin policy / keeps / community list prefs (never replicate) |
| `mp_pad` | The synced bellwether row |
| `cm_messages`, `cm_message_attachments`, `cm_read_state` | Signed channel message events incl. edit/delete tombstones; attachment metadata; personal-replica last-read HLC (never sent over a shared community session) |
| `cm_community_identity` | OWNER-signed community identity; verified at APPLY and at read; unverified renders NOTHING |
| `cm_libraries*`, `cm_library_*` | Data-hub libraries (Plan 38): owner-signed config + curator-signed item metadata over sealed blobs; `cm_library_progress` is PERSONAL watch/read resume (personal_replica default AND max) |
| `sync_*` | Engine tables from `createSyncTables` (sessions, paired devices, audit, ...) |

Channel messaging is live for manual community sessions. Keep UI copy honest about delivery: show only locally recorded events; never claim a remote member received or read a message unless a real protocol row says so.


## Chat, feed, and community rules (Plans 30-32)

- The channel and post-thread screens render on the shared chat kit in `components/chat/` (props-only; no provider imports except the theme seam, enforced by `chat-kit-no-providers.test.ts`). Consume it from the barrel; do not rebuild bubbles/composer per screen (DM threads consume the same kit).
- The channel header shows exactly ONE always-visible audience label (`rule.explanation`); no per-message audience chips, no manual Refresh button. History import lives behind the header overflow menu.
- Reactions are v2 `cm_messages` with `intent 'react'`: the UI renders ONLY the verified, safety-filtered read model (`listChannelReactions`) toggled via `resolveReactionTap`. Never an optimistic fake chip; the local echo is the real recorded row.
- `@mention` autocomplete lists trusted community peer names and signs picked deviceIds into the v2 `mentions` array. Mention highlighting is display sugar (`segmentBodyMentions`), never an identity claim. Pure mapping helpers live in `data/channel-view-core.ts` with unit tests.
- Signed photo avatars (Plan 32 T5.1): bubbles, People rows, and Feed cards render a member's signature-verified community avatar via `resolveCommunityAvatarImage` (image -> initial -> ?). Only a verified v2 profile yields an image; the screen that has `db` passes the resolved data URI IN so the kit stays props-only.
- Feed link previews render only the sender-generated local verified blob (`FeedItem.linkPreview`), never a receiver fetch (NC-2). A link-preview attachment is a decoration, never a shared file: excluded from `aggregateCommunityFiles` and never rendered as a file chip.


## Public layer (Plan 19 P9)

- `data/public-publish.ts` is a byte-identical twin with web (FF5-guarded). `cm_publications` carries `rights_json` so a rights-bearing descriptor reconstructs byte-exact for an owner takedown; the archive terminal is the HONEST "Scanning and queued for review..." copy, never "Published" (gated on a real approved+clean host scan).
- `COMMUNITY_SYNC_POLICY.defaultScope` is `device_local`: a cm_ table OMITTED from `entityRules` fails CLOSED; a guard test asserts no created cm_ table is rule-less. `cm_publications` is the SOLE `published_blob` escalation point.
- Public reader: FF2 warm-tail paging off `cm_public_feed_cursor` (device_local, never synced). `onJoin` dispatches by descriptor `joinPolicy`: open + valid owner-signed grant -> `redeemPublicJoinGrant` (roster row only, NO key access); request/no-grant -> honest "needs a connection server" notice. Reading stays anonymous; nothing fabricates a sent/joined state.


## Data hub, identity, and organization (Plan 38)

- **Sealing model (D.3, binding):** a library blob is a sealed share (chunked at-rest encryption, plaintext-Merkle contentId, author-signed manifest) whose per-object DEK wraps under the WORKSPACE EPOCH KEY inside the signed item row (`key_epoch` + `wrapped_key`). Membership is the read capability: `historyScope` governs late joiners, removal revokes new items, and sealed blocks ride the existing blob pipeline by sealedId (`*manifest_json` columns feed `collectBlobRefs`).
- **Rule:** every synced table carries an `id` column equal to the sync rowId (the engine injects id=rowId; an id-less table fails INSERT silently).
- **Community identity + retheme:** owner-signed `cm_community_identity` events (apply-time validator rejects forgeries BEFORE insert); themes resolve ONLY through `resolveActiveTheme` (high contrast always wins, member 'mine' override, malformed blobs fail safe). The theme boundary wraps ONLY the community route subtrees; the tab bar, Feed, Messages, and DM threads never retheme (leakage-tested).
- **Organization:** descriptor channels carry kind/categoryId/order/topic/archived via CONDITIONAL canonical append (legacy signatures verify byte-for-byte, fixture-locked). One revision per channel-manager save. Archived channels are read-only (banner, composers hidden), never deleted.
- **Libraries are personal-first:** the My Library hub works with ZERO communities. Ingest: file picker, OS share intake, promote-channel-file (the only Model-A plaintext -> sealed path). Within-workspace dedup only (cross-workspace dedup is a plaintext-equality oracle). Metadata extraction is local (GPS stripped by default); BYO-key enrichment NEVER fires on a receiving device.
- **Playback honesty:** dev build = loopback 127.0.0.1 range server (token-in-path, constant-time, per-chunk verified streaming decrypt; no A/V plaintext at rest); Expo Go = OS open-in behind the explicit 'exports a decrypted copy' warning. Sealed cbz/epub readers render attacker-controlled bytes fully sandboxed (no scripts, no network). Storage: pin classes + device budget with LRU over fetch_cache only; last-copy honesty is device-local; NO seeder counts.
- **Transport reality (E):** community library blobs move during manual sessions or file-request when a holder is reachable. Copy must never imply always-on availability ('Available from members who have it, when a sync connects.').
