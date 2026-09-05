# Meerkat Community Feed - Build Handoff (Ultracode multi-agent)

> Paste this verbatim into a fresh Ultracode session. Repo root: `/Users/trey/Desktop/Apps/MyLife`. Work on a NEW branch `feature/meerkat-community-feed` off `main`. Build phase by phase. Read the cited files yourself before touching code - this prompt grounds you, it does not replace the source.

## 1. MISSION

Build the Meerkat "always-on, zero-knowledge, encrypted community feed": any community member opens Meerkat in a browser from anywhere and sees the FULL community feed (all channels, full history, up to date), while every host stores only ciphertext and never reads plaintext. The honest constraint is absolute - the host (a community-owned node or a peer member) holds sealed bytes addressed by opaque tokens; the epoch keys live only with members; a third-party relay sees only opaque tokens plus sizes plus timing. You EXTEND `@mylife/sync` and the existing Meerkat substrate; you NEVER parallel-wire a second crypto or sync path. Every primitive that already exists must be reused, not rebuilt. Where this design relaxes privacy (full history by default), it is a deliberate, owner-confirmed tradeoff, surfaced honestly in the UI.

## 2. READ FIRST (in this order, before any code)

1. `/Users/trey/Desktop/Apps/MyLife/docs/designs/meerkat-community-feed-architecture.md` - the locked design. Section 9 is the phase plan; sections 5 and 6 name the new protocol pieces.
2. `/Users/trey/Desktop/Apps/MyLife/apps/meerkat/CLAUDE.md` - native app conventions, the transport-honesty boundary, table prefixes.
3. `/Users/trey/Desktop/Apps/MyLife/packages/meerkat-relay/CLAUDE.md` - relay vs seeder/community-node split, what is deferred ops.
4. Key source (read the cited line ranges, do not skim the whole file):
   - `packages/sync/src/protocol/group-keys.ts` - epoch keys, wraps, commits (`:53,:72,:86,:102,:115,:146,:164,:176,:185,:210,:236`)
   - `packages/sync/src/protocol/channel-history.ts` - snapshot build/fetch (`:36,:43,:52,:169,:213,:353,:379,:412,:424`)
   - `packages/sync/src/protocol/community.ts` - descriptor, sign, revise, roster checks (`:61,:94,:117,:143,:163,:179,:187,:256,:294,:311,:466,:481,:532`)
   - `packages/sync/src/protocol/mailbox.ts`, `file-request-mailbox.ts`, `mailbox-dispatch.ts`, `mailbox-drain.ts` - the mailbox kind pattern to clone for backfill/notify
   - `packages/sync/src/db/queries.ts` (`:643,:703,:711,:725,:740,:748,:759`) and `packages/sync/src/db/schema.ts` (`:135,:146`)
   - `packages/meerkat-relay/src/protocol.ts` (`:17,:74,:139,:159,:175`), `hub.ts` (`:92,:137,:382,:395`), `seeder-node.ts` (`:37,:201,:224,:245,:301`), `seeder-http.ts` (`:34,:37,:114`)
   - `packages/sync/src/node/host-registry.ts` (`:48,:120,:149`)
   - Web client: `apps/meerkat-web/src/lib/meerkat-data.ts` (`:119-148`), `src/lib/schema.ts` (`:71-165`), `src/lib/MeerkatProvider.tsx`, `src/lib/browser-sync-init.ts`, and the harness `src/lib/__tests__/support/web-node-harness.ts`
   - Web entry barrel everything resolves through: `packages/sync/src/index.native.ts` (Vite aliases `@mylife/sync` here, `vite.config.ts:27-44`)
   - Native sync surface: `apps/meerkat/app/(root)/data/sync-core.ts` (`:34-51`); community policy: `apps/meerkat/app/(root)/data/community-core.ts` (`COMMUNITY_SYNC_POLICY :29`)
   - Background job pattern to mirror: `apps/meerkat/app/(root)/data/background-sync.ts` (`:118,:200`), `background-task-registration.ts` (`:68,:83`)

## 3. LOCKED DECISIONS (verbatim, non-negotiable)

- HOSTING is member-seeding base + optional community-owned always-on node. There is NO founder cloud node. If no node and no peer is online, the feed is unreachable and the UI says so.
- ACCESS CONTROL is per-member SIGNED auth (challenge-response): a puller proves it holds a device key in the community's signed member list (and not removed). The host legitimately knows the roster; it still never sees plaintext.
- HISTORY SCOPE is owner-configurable, default FULL. Full means new members can read everything from before they joined (the owner accepts past authors' messages become readable by future members). `join_point` is the cryptographically clean alternative. Default FULL back-wraps prior epochs to the joiner.
- LIVENESS is poll + notify, never a persistent live socket. A community admin sets the poll interval (Manual only / 1m / 5m / 10m / 15m / 30m / 1h / 6h / 24h / 1 week). Members poll on that interval, can tap Refresh anytime, and (with per-member auto-update enabled) get woken by a host notify-on-post ping that triggers a pull. The UI ALWAYS shows honest staleness ("Updated 3m ago") and NEVER a fake "live". Sub-minute intervals are dev-flag-gated; production floor is 1m.
- No em dashes anywhere - code, comments, copy, or docs.

## 4. WHAT ALREADY EXISTS (REUSE, do not rebuild)

| Item | Status | Exact name + location |
|---|---|---|
| Mint epoch secret + per-member X25519 wrap + epoch advance | EXISTS | `createGroupCommit(db, input)` `group-keys.ts:115` |
| Member add/remove as commits | EXISTS (never called by community code) | `commitMemberAdd` `:210`, `commitMemberRemoval` `:236` |
| Read own epoch secret | EXISTS | `getCurrentEpochKey(db, ws, identity)` `:164`, `unwrapEpochSecret(db, ws, epoch, identity)` `:146` |
| Content key derivation | EXISTS | `deriveEpochContentKey(secret, ws, epoch)` `:176` |
| Apply received wrap (+advance version) | EXISTS, UNWIRED (0 callers) | `storeReceivedKeyWrap(db, wrap)` `:185` |
| Internal wrap/unwrap (module-private, NOT exported) | EXISTS | `wrapSecret` `:72`, `unwrapSecret` `:86` (format `ephX25519Pub(32)||nonce(24)||secretbox`; info `meerkat-epoch-wrap-v1:{ws}:{epoch}`) |
| Wrap read/write queries | EXISTS | `insertKeyWrap` `queries.ts:740`, `getKeyWraps` `:748`, `invalidateKeyVersion` `:759` |
| Member queries | EXISTS | `addWorkspaceMember` `queries.ts:703`, `removeWorkspaceMember` `:711`, `getWorkspaceMembers` `:725`, `createWorkspace` `:643` |
| `sync_workspace_keys` table | EXISTS | `schema.ts:146-155` (PK `workspace_id,key_version,wrapped_for_device_id`) |
| Snapshot build (signed + epoch-sealed + ContentManifest + pieces) | EXISTS, no prod caller | `buildChannelHistory(input)` `channel-history.ts:213` (object arg, NOT positional) |
| Snapshot fetch+verify+decrypt+merge (fail-closed) | EXISTS | `fetchChannelHistory(input)` `:424`; parse `:379`; verify `:353`; merge `:412` |
| App resolve wrapper (manual paste today) | EXISTS, resolve-only | `fetchAndImportChannelHistory(input)` `apps/meerkat/app/(root)/data/channel-history-import.ts:161` |
| ContentManifest type + Zod | EXISTS | `types.ts:383`, `ContentManifestSchema :417` (`merkleRoot` single; `pieces[]` hashes; `webSeeds[]` host URLs) |
| Host registry (HKDF rid, sealed records, announce/lookup) | EXISTS | `deriveContentRegistryId :48`, `announceHeldContent :120`, `lookupContentHosts :149` (`host-registry.ts`) |
| Seeder node (content-agnostic, hash-verified pieces, cap-enforced) | EXISTS | `MeerkatSeederNode` `seeder-node.ts:224` (`pin :245`, `servePiece :301`, `sweep :325`, `stats :338`); `FileSeederPieceStore :71` |
| Seeder web-seed HTTP (piece shape - what history fetch reads) | EXISTS | `startSeederHttp` `seeder-http.ts:37`, route `GET /{infoHash}/{index}` (`PIECE_PATH :34`), `GET /healthz` |
| Relay frames + mailbox + registry | EXISTS | `protocol.ts:139` (client), `:159` (server), `RELAY_LIMITS :17` (mailbox TTL `:31` = 5m); `RelayHub` `hub.ts:92,:137,:382,:395` |
| Pair-private sealed envelope (seal/open/encode) | EXISTS | `deriveMailboxToken :48`, `sealMailboxDelta :95`, `openMailboxDelta :137`, `encode/decode :202/:206` (`mailbox.ts`) |
| Mailbox kind pattern (request/grant + dispatcher + drain + handlers) | EXISTS | `file-request-mailbox.ts` (`:48,:49,:204,:224,:360`), `mailbox-dispatch.ts:86` (`MailboxEnvelopeHandlers :55`, switch `:99`), `mailbox-drain.ts:157`, app handlers `file-request-core.ts:233` |
| App send/serve/drain orchestration | EXISTS | `SyncProvider.tsx` (`queueFileRequest :434`, `queueFileGrant :507`, `runForegroundDrain :618`, `buildDrainHandlers :595`) |
| Roster authority (signed) + fast gate | EXISTS | `verifyCommunityDescriptor(signed, prev?)` `community.ts:256`, `communityRole(descriptor, deviceId)` `:294`, `evaluateChannelPost :311`; materialized `isActiveCommunityMember(db, communityId, deviceId)` `file-request-core.ts:301`; revocation `isDeviceRevoked(db, deviceId)` |
| Sign/verify primitives (reuse, add NO new crypto) | EXISTS | `signMessage(extractSigningPrivateKeyHex(identity.privateKeyRef), bytes)` `device-identity.ts:66,:108`; `verifySignature(deviceId, bytes, sig)` `:139` |
| Channel event log + apply | EXISTS | `verifyChannelMessage` `channel-message.ts:106`; `mergeChannelMessageEvents(db, events)` `file-request-core.ts:238`; `listChannelMessageEvents(db, communityId, channelId)` `community-core.ts:367`; cursor primitive `highestHlc` `:536` |
| Two-node real-relay web harness | EXISTS | `apps/meerkat-web/src/lib/__tests__/support/web-node-harness.ts` (`buildWebNode :122`, `pairNodes :158`, `runRelaySession :196`, `withRelay :243`, `drainMailboxes :314`, `parkEnvelope :292`, `readChannelRows :231`, `resolvePairSecretHex :285`) |

Barrel note: all of `db/queries.ts` is re-exported from the web entry via `export * from './db/queries'` at `index.native.ts:240`; group-keys are re-exported at `:310-324`; `buildChannelHistory`/`parseChannelHistory`/`verifyChannelHistorySnapshot` at `:383-399`. The web client imports these directly - no barrel change needed.

## 5. WHAT IS MISSING (build this)

| Gap | What to ADD/EXTEND | Seam |
|---|---|---|
| Community create/join never mint or wrap an epoch key | Call `createGroupCommit` in the founder create path (`storeOwnedCommunity` `meerkat-data.ts:494` + native twin) after members are added. `joinCommunityFromLink` `community.ts:532` writes `current_key_version 0` (`:564`) - a joiner cannot self-mint; it must RECEIVE wraps via sync. | `community.ts`, `meerkat-data.ts`, native `sync-core.ts` |
| Per-member X25519 key absent from descriptor | `CommunityDescriptor.members` carries only `{deviceId, role, displayName}` (`community.ts:163`). The committer needs each member's `dhPublicKey` to wrap. ADD `dhPublicKey` to descriptor members (or source from `getPinnedIdentity`). MUST also add it to `canonicalDescriptor` (`:94-114`) in field order or it travels unsigned. | `community.ts` |
| Key wraps NOT replicated (the P0 precondition that gates everything) | `sync_workspace_keys` is in NO prefix/policy map; `insertKeyWrap` writes raw `db.execute` so the change tracker never sees it; `storeReceivedKeyWrap` has zero callers. Option A (preferred, matches design 5.1): register a prefix for the keys table and route inserts through `recordChange` so wraps replicate as `shared_workspace`; inbound apply routes through `storeReceivedKeyWrap` (advances `current_key_version`). Option B: a dedicated key-wrap session frame calling `storeReceivedKeyWrap` on receive. | `group-keys.ts:185` (wire it), all three policy literals (below) |
| Full-history back-wrap | EXTEND `commitMemberAdd` `:210`: add `historyScope?: 'full' | 'join_point'` (default `'full'`). For `'full'`, after the new commit, for each prior epoch `e` in `1..previous`: `unwrapEpochSecret(committer)` then `insertKeyWrap(wrapSecret(secret, added.dhPublicKey, wrapInfo(ws, e)))`. Because `wrapSecret` is module-private, this loop MUST live inside `group-keys.ts`. `'join_point'` skips the loop (current behavior). | `group-keys.ts` |
| Auto snapshot job + tail + cursor | NEW `buildCommunitySnapshots(db, communityId, identity)` pure core: per channel from `getCommunity(...).descriptor.channels` (`community.ts:466`), `getCurrentEpochKey` → secret, `listChannelMessageEvents`, `buildChannelHistory({..., workspaceId: communityId, groupKey: secret, signer: identity})` → store pieces in a per-community `SeederPieceStore` + persist `catalog.manifest`. NEW live-tail concept (raw signed events since latest snapshot) and per-(community,channel) `last_pulled_hlc` cursor - neither exists. Mirror `runBackgroundSyncCore`/`runBackgroundSyncOnce` (`background-sync.ts:118/:200`) and the scheduler at `background-task-registration.ts:83` (dev-flag gated, lazy native, no-op when absent). | `@mylife/sync` + app data layer |
| Per-member signed pull auth | NEW `protocol/feed-auth.ts`: node issues nonce; client signs `nonce||communityId||ts` via `signMessage`; node verifies via `verifySignature` + `verifyCommunityDescriptor` + `communityRole` (cryptographic authority on the node) and/or `isActiveCommunityMember` (fast), gated by `isDeviceRevoked`. NO new crypto. | new module |
| Community-node mode on the seeder | EXTEND `seeder-node.ts`/`seeder-http.ts`: per-community index (current snapshot vs tail), NEW endpoints `GET /community/{id}/manifest` (AUTH), `POST /community/{id}/append` (AUTH; seeder-http is GET-only today, 405 at `:42`), `GET /community/{id}/challenge`; append-time integrity via `verifyChannelMessage` before storing sealed bytes; announce community to registry. Second deployable image is deferred ops. | `packages/meerkat-relay/src` |
| Member-to-member backfill | NEW `protocol/history-backfill.ts` cloned from `file-request-mailbox.ts`: kinds `meerkat.history-request-v1`/`-grant-v1`; request `{communityId, channelId, sinceHlc, requestId}`; serve queries `cm_messages` > sinceHlc (index `cm_messages_channel` `community-core.ts:75`), re-`verifyChannelMessage` each event before sealing, gate with `isActiveCommunityMember`+`isDeviceRevoked`+`evaluateChannelPost`; receive re-verifies then `mergeChannelMessageEvents`, advances cursor. Add `historyRequest`/`historyGrant` to `MailboxEnvelopeHandlers :55`, switch arms `mailbox-dispatch.ts:99`, drain counters `mailbox-drain.ts:87,:103`, and a `queueHistoryRequest` in `SyncProvider` cloning `queueFileRequest`. | new module + dispatcher/drain/app seams |
| Notify-on-post ping (content-free) | A community-derived relay token (`deriveCommunityNotifyToken(communitySecret, communityId)`, HKDF like `deriveMailboxToken`); auto-update members `hello` on it; host emits ONE opaque `env` after a real `applied>0`. The ping only ENQUEUES a pull; a "message received" notification fires ONLY after a real `applied>0` (mirrors `background-task-registration.ts` data-only-push). | relay `env` frame, optional dispatcher kind |
| Descriptor feed settings | ADD `historyScope`, `feedPollIntervalMs: number|'manual'`, and node URLs to `CommunityDescriptor` (`:61-85`), `canonicalDescriptor` (`:94-114`, field order!), `CommunityRevisionChanges` Pick (`:179-181`), and `reviseCommunity` inherit lines (`:199-201`). The existing `hosts: string[]` (`:76`) is the reachability-hint slot - reusing/renaming it for `nodes` is the lower-risk path; decide explicitly. | `community.ts` |
| Browser Feed surface | NEW Feed UI in `apps/meerkat-web`: instant IndexedDB load, "Updated Xm ago" + Refresh + real source label, honest empty/edge states, per-member auto-update toggle, read-only admin interval. | `apps/meerkat-web/src/ui` |

## 6. PHASES (P0..P6) with acceptance criteria

**P0 - Key-wrap distribution + historyScope + full back-wrap (the foundation everything needs).**
Mint+wrap on create; add `dhPublicKey` + `historyScope` to the descriptor (and `canonicalDescriptor`); replicate `sync_workspace_keys` over the engine as `shared_workspace`; wire `storeReceivedKeyWrap`; extend `commitMemberAdd` with full back-wrap.
Accept: in the two-node real-relay harness, a new member after ONE sync gets `getCurrentEpochKey()` non-null and `deriveEpochContentKey()` opens the current channel-history snapshot - all snapshots under `full`, from-join under `join_point`. Removal stays forward-secret (no new wrap replicates to the removed device). Proven by real `sync_workspace_keys` + `cm_messages` rows.

**P1 - Auto snapshots + tail + incremental cursor.**
`buildCommunitySnapshots` pure core + scheduler hook (mirrors `runMailboxDrainJob`); live tail; per-(community,channel) `last_pulled_hlc`; compaction (one rolling full snapshot + bounded tail).
Accept: a channel's rolling snapshot import reconstructs the full resolved (edit/delete) feed; a warm pull transfers only events after the cursor. Real rows, no manual manifest paste.

**P2 - Community node + per-member auth.**
Community-mode seeder persists per-community sealed snapshot+tail+pieces; `feed-auth.ts` challenge-response; new HTTP endpoints; append integrity via `verifyChannelMessage`; registry announce.
Accept: a browser with a member key pulls the full encrypted feed from another network; a non-member and a removed member are BOTH rejected at auth; the node holds only sealed bytes (proven - it cannot produce plaintext).

**P3 - Member-to-member backfill.**
`history-backfill.ts` request/response over the relay mailbox; dispatcher + drain + app seams.
Accept: with NO node, member B reconstructs the full feed from member A over a real relay (e2e, two harness browser nodes), every event re-verified, cursor advanced.

**P4 - Poll + notify liveness + settings.**
Admin poll-interval descriptor setting (Manual/1m/5m/10m/15m/30m/1h/6h/24h/1week; sub-minute dev-flag gated, 1m prod floor); per-member auto-update toggle; notify-on-post ping; manual refresh.
Accept: posting to the node wakes an auto-update member to pull within the interval; manual refresh pulls now; admin interval honored; "Updated Xm ago" accurate; notification only after real `applied>0`.

**P5 - Browser feed UX + durable cache.**
Feed surface: instant cached load, honest staleness + source, background poll while open, honest empty/edge states.
Accept: open from any browser with the member identity → full feed → refresh pulls new posts; offline shows last-synced honestly ("showing your last synced copy from Xm ago"); removed member sees explicit removed state.

**P6 - Hardening + ops.**
Rate limits, snapshot size caps + cold-start paging, removal re-snapshot + key rotation, community-node deploy artifact, the 2-device/2-network manual checklist (OPFS, real auth, real notify).
Accept: rate limits enforced; oversized snapshots paged; a removal triggers re-snapshot under the new epoch; deploy artifact documented.

## 7. BUILD METHODOLOGY

- One NEW feature branch off `main`: `feature/meerkat-community-feed`. No work on `main`.
- Slice phase by phase. For each phase: design the slice → implement with ONE focused agent owning a clear file zone → adversarial review (a second agent tries to break it, especially the zero-knowledge and honesty claims) → fix.
- The orchestrator PERSONALLY re-runs the real verification (section 8) for each phase before committing. Do not trust an agent's claim of green - run it yourself.
- One commit per phase (Conventional Commits, `feat(meerkat):` ...). Open the PR only at the end.
- Extend the two-node real-relay harness (`web-node-harness.ts`) so EVERY new cross-device flow is proven by real `cm_`/`sync_`/`sync_workspace_keys` DB rows, never stubs. Status comes only from real `SyncSession` objects and real rows.
- Any sync-policy/prefix change MUST land in all THREE parallel literals in the same change or the relay harness deep-equal assertion breaks: native `apps/meerkat/app/(root)/data/sync-core.ts:34-51`, web `apps/meerkat-web/src/lib/meerkat-data.ts:119-148`, and `COMMUNITY_SYNC_POLICY` in `community-core.ts:29`.

## 8. VERIFY-YOURSELF (exact commands + honesty grep)

Run from repo root unless noted.

```bash
# Web client gates (tsc is AUTHORITATIVE - see gotcha a)
pnpm --filter @mylife/meerkat-web typecheck     # tsc --noEmit
pnpm --filter @mylife/meerkat-web test          # vitest run
pnpm --filter @mylife/meerkat-web build         # vite build

# Native app gates
pnpm --filter @mylife/meerkat-app typecheck
pnpm --filter @mylife/meerkat-app test

# Relay / seeder / community-node
pnpm --filter @mylife/meerkat-relay test

# Parity (native artifacts) + changed-function gate
node scripts/check-meerkat-parity.mjs
pnpm gate:function:changed

# HONESTY grep - no fabricated transport/connectivity status
grep -rniE '\b(live|online|delivered|connected|peer count)\b' apps/meerkat-web/src/ui apps/meerkat/app
# Allowed: "Updated Xm ago", real source ("community node"/"peer"/"no host reachable"),
# honest-notice copy. Any literal "live"/"online"/"delivered"/fake peer count FAILS.

# No em dashes anywhere
grep -rn '-' apps/meerkat apps/meerkat-web packages/sync/src packages/meerkat-relay/src
```

There is no committed honesty-grep script; it is a manual convention (rules live as header comments in `meerkat-data.ts`, `schema.ts`, `HonestNotice.tsx`). `check-meerkat-parity.mjs` only asserts NATIVE `apps/meerkat/*` artifacts today; if you add web-feed parity assertions, update it.

## 9. GOTCHAS (each a one-liner)

a. tsc is authoritative; the editor/LSP shows PHANTOM errors for `apps/meerkat-web` - confirm any reported error with `pnpm --filter @mylife/meerkat-web typecheck` before trusting it or claiming a fix.
b. The sql.js dev-bundle fix already LANDED - do NOT regress it: `vite.config.ts` keeps `optimizeDeps.include: ['sql.js']` (`:64-66`, NOT exclude) and `load-sqljs.ts` imports the init factory via DYNAMIC `await import('sql.js')` with `mod.default ?? mod` interop (`:27-49`); a static `import x from 'sql.js'` throws at module-eval and takes the app down before React mounts.
c. MK-001 durability: on any identity/secret write, flush the SECRET store THEN the db before proceeding (`MeerkatProvider.tsx:350-352`, `:483-492`) and keep the unload handlers (`beforeunload`+`pagehide`+`visibilitychange(hidden)` flush both stores, `:437-450`); skipping the order orphans device keys in the in-memory default store.
d. `cm_read_state` is personal-replica: write ROW-ONLY via `markChannelReadRow`, NEVER through `engine.recordChange` (`meerkat-data.ts:299-307,:353-389`, maxScope `personal_replica` `:126`) - recording it leaks personal read state across members. Apply the same discipline to any new personal-replica feed setting (auto-update, cursor).
e. App Isolation: never deep-import `apps/meerkat/app/*` from the web app (no package `exports`); replicate thin app-owned non-crypto helpers VERBATIM with a `SOURCE OF TRUTH` comment citing the native file+lines (pattern in `meerkat-data.ts:1-16`, `schema.ts:1-15`); keep every crypto/protocol primitive imported from `@mylife/sync` unchanged.
f. The native `apps/meerkat` file-save complexity-slope perf test is LOAD-FLAKY in the pre-commit gate - a lone failure there is acceptable if it passes when re-run in isolation; do not chase it as a real regression.
g. `buildChannelHistory` takes a single input OBJECT `{communityId, channelId, workspaceId, epoch, events, groupKey, signer, createdAt?, pieceLength?, webSeeds?}` - the design doc's `buildChannelHistory(events, groupKey, signer)` is shorthand; build the object form (`channel-history.ts:52-60,213`).
h. `groupKey` passed to `buildChannelHistory` is the UNWRAPPED epoch secret (the `secret` from `getCurrentEpochKey`); `deriveEpochContentKey` is applied INSIDE - do not pre-derive it.
i. `wrapSecret`/`unwrapSecret` are module-private (not exported) - any wrapping loop (e.g. back-wrap) MUST live inside `group-keys.ts`; never re-implement wrapping in app code.
j. Channel-history snapshots flow over the seeder PIECE shape `GET /{infoHash}/{index}` (`seeder-http.ts:37`), NOT the NodeStore SHARE shape `/manifest`,`/block` (`startNodeStoreHttp :114`, `fetchAndPinFromHosts`) - do not conflate the two transports.
k. `getKeyWraps` does NOT filter on `valid_until`; it returns all wraps for a version, and `unwrapEpochSecret` finds the one where `wrappedForDeviceId === identity.publicKey` (`group-keys.ts:154-155`) - respect this when writing/reading wraps.
l. Descriptors do NOT sync over the engine: `sync_communities` is in no sync prefix. A descriptor reaches another device only via a self-contained signed invite link (`createCommunityInvite`→`joinCommunityFromLink`). So an owner changing `historyScope`/`feedPollIntervalMs`/`nodes` does NOT auto-propagate - existing members keep the old descriptor until handed a freshly minted invite. The UX must NOT pretend a settings change auto-propagates.
m. Any new descriptor field added WITHOUT adding it to `canonicalDescriptor` (`community.ts:94-114`, fixed field order) travels UNSIGNED and silently mutable - this is the single most important correctness point for the settings change.
n. `pairNodes` in the harness stores the secret inline as `local:shared:${hex}`; a plain `getSharedSecretHex(ref)` returns null - use `resolvePairSecretHex` (`web-node-harness.ts:285`).
o. The relay is the WRONG place for member auth and stays anonymous (it sees no identities by design, `hub.ts:9-12`); auth belongs on the community node (extended seeder). Do not add identity to relay frames.
p. The 5-minute `mailboxTtlMs` (`protocol.ts:31`) is why the relay alone cannot be the always-on feed - backfill rides it for live catch-up, but durable history needs the community node's persistent store.
q. The notify ping is content-free and only ENQUEUES a pull; a "message received" notification fires ONLY after a real `applied>0` (mirrors the existing data-only-push behavior in `background-task-registration.ts`).
r. `apps/meerkat-web` has NO `CLAUDE.md`/`AGENTS.md` - web conventions live as header comments in `meerkat-data.ts`, `schema.ts`, `browser-sync-init.ts`. If you want one, write it; the repo-root `apps/meerkat/CLAUDE.md` is the NATIVE app's doc.

## 10. OUT OF SCOPE / FOUNDER OPS

- Deploying a production community node (second image: needs `@mylife/sync` at runtime + a `DATA_DIR` volume; the relay is ws+zod-only) - building that production image is deferred ops (relay `CLAUDE.md:33-41`).
- Push notification certificates / data-only push token delivery / iOS background-execution timing - wired but DEFERRED behind dev-build flags.
- The 2-device / 2-network MANUAL verification checklist (OPFS, real signed auth from a second network, real notify-on-post wake).
- Tauri / desktop packaging.
These belong to the founder, not the build agents. Code the seams so they are ready; do not block phases on them.

## 11. KEY RISK (call out, do not silently default)

Full-history-by-default is a REAL privacy relaxation: a future member can read messages authored before they joined, so past authors' content becomes readable by people who were not present. The product call is to default it ON, but the owner MUST explicitly confirm this at community creation (an honest one-time confirmation, not a buried setting), and the UI must surface it. `join_point` is the cryptographically clean alternative and matches today's epoch exclusion. Leave room for a future per-message author opt-out of back-provisioning (design 10). Never present full-history as cost-free.

---

Files surfaced for the next session live under: `/Users/trey/Desktop/Apps/MyLife/docs/designs/meerkat-community-feed-architecture.md` (design), `/Users/trey/Desktop/Apps/MyLife/packages/sync/src/protocol/` (group-keys, channel-history, community, mailbox*, channel-message, device-identity), `/Users/trey/Desktop/Apps/MyLife/packages/meerkat-relay/src/` (protocol, hub, seeder-node, seeder-http), and `/Users/trey/Desktop/Apps/MyLife/apps/meerkat-web/src/lib/` (meerkat-data, schema, MeerkatProvider, browser-sync-init, __tests__/support/web-node-harness).
