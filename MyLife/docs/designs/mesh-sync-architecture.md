# Mesh Sync Architecture

**Status:** Design, pre-implementation
**Owners:** sync-dev, module-registry-dev, hub-shell-dev
**Related:** `docs/plans/queue/08-mesh-sync-mission-control.md`, `docs/designs/mesh-sync-module-policy-matrix.md`

Meerkat (product brand; repo stays `MyLife`) treats decentralized mesh sync as a primary data communication layer. Phones prefer talking directly to each other; servers are a fallback path for ciphertext only. This doc specifies the ladder, the trust model, the session protocol, the schema extensions, the per-module policy contract, and the relationship to the existing `packages/sync/` substrate.

## 1. Goals

1. Phone-to-phone data transfer is the default for user-to-user and device-to-device flows.
2. Security lives in the payload. Every channel carries ciphertext signed by a device key.
3. Every entity declares a scope and a conflict strategy. Modules cannot ship without a `syncPolicy`.
4. The transport selector falls through deterministically: LAN → nearby peer → BLE → WebRTC → relay.
5. The existing `packages/sync/` substrate is extended, not paralleled.

## 2. Non-goals

1. Group chat semantics beyond coarse shared-workspace membership.
2. Public content publishing workflows; those live in `packages/sync/src/torrent/` and are out of scope here.

## 3. Transport ladder

The selector attempts layers in order. A failed attempt in layer N records a short cooldown and proceeds to N+1. Layer 1 is always tried first on every sync tick, regardless of prior success on layer 5.

| # | Layer | iOS/macOS API | Android API | Responsibility | Fall-through rule |
|---|-------|---------------|-------------|----------------|-------------------|
| 1 | LAN Wi-Fi | `NWListener` + `NetService` over Bonjour (`_mylife-sync._tcp`) | `NsdManager` mDNS + TCP socket | Device discovery + encrypted TCP stream on shared Wi-Fi | If no peer advertises within 1.5s, proceed |
| 2 | Nearby peer | `MultipeerConnectivity` (`MCSession`, `MCNearbyServiceAdvertiser`) | `WifiP2pManager` + `WifiAwareSession` | Ad-hoc Wi-Fi and Bluetooth radios without shared SSID | If no session forms within 3s, proceed |
| 3 | Bluetooth LE | `CoreBluetooth` GATT characteristic | `BluetoothGattServer` | Wake-up pings only. BLE signals "I have changes" via a GATT notify carrying `{deviceId, pendingModules[], totalBytes}`. Actual data transfer escalates to a higher-bandwidth layer. | If no BLE peer within 2s, proceed |
| 4 | Internet direct | WebRTC DataChannel over STUN/TURN | Same | NAT-traversed peer-to-peer path | If ICE does not complete within 5s, proceed |
| 5 | Encrypted relay | Custom WebSocket relay, ciphertext only, with per-session ephemeral recipient tokens for metadata privacy (see Section 3b) | Same | Server stores opaque blob keyed by ephemeral session token; relay cannot correlate sessions to long-lived device identity | Terminal layer; failure bubbles up |
| 6 | Pairing / recovery | QR (default), NFC (optional), USB bundle | Same | Bootstrap, not runtime sync | Invoked once per device enrollment |

The selector logic extends `packages/sync/src/transport/transport-manager.ts:111`. Today that file tries `LANTransport` and throws if nothing is found (transport-manager.ts:130). Phase 1 finishes LAN, Phase 2 adds nearby adapters, Phase 3 adds WebRTC and relay.

### 3a. Ranked-choice transport preference

Each user maintains a ranked preference list of transport layers in `sync_transport_preferences` (Section 8). When two peers connect, the selector intersects both preference lists and picks the highest-ranked layer that both peers agree on and that is technically available. This eliminates the friction of manual transport selection during sync.

**Resolution algorithm:**
1. Both peers exchange their ranked preference lists during the workspace-auth step (Section 6 step 3).
2. The selector walks the initiator's list top-to-bottom. For each layer, if the responder also has that layer enabled and ranked, it becomes the candidate.
3. The first candidate that is technically reachable (advertised, within range, ICE succeeds) wins.
4. If no mutual candidate works, fall through the default ladder order as a backstop.

Users set preferences in Settings > Sync > Transport Preferences. Defaults follow the ladder order (LAN first, relay last). Power users can reorder, e.g., prioritizing WebRTC over nearby peer if they're rarely in physical proximity with their sync partners.

### 3b. Relay anonymity (ephemeral session tokens)

The relay must not learn long-lived device identity. To achieve this:

1. **Token minting:** Before each relay session, the initiator generates a random ephemeral X25519 keypair and derives a session token from `HKDF(initiator_ephemeral_secret, relay_pubkey)`. The token is shared with the target peer out-of-band (piggybacked on the last direct transport, or sealed in the workspace key and stored for next connection).
2. **Envelope addressing:** Relay envelopes are keyed by the ephemeral session token, not the device pubkey. The relay stores and forwards ciphertext blobs indexed by opaque tokens it cannot correlate across sessions.
3. **Token rotation:** Tokens rotate every session. A peer that reconnects via relay mints a new token. The relay never sees the same identifier twice unless two sessions overlap.
4. **Threat boundary:** The relay can still observe timing, envelope size, and IP address. This design hides device identity and cross-session linkability, not network-level metadata. Full anonymity (onion routing) remains a non-goal.

Token exchange is wired into the session protocol at step 3 (workspace auth). If the current session is relay-backed, both sides include their ephemeral token in the auth response so the relay can route without knowing who they are.

## 4. Data scopes

Every synced entity declares exactly one scope. The scope is enforced at three points:

1. **Write path:** `ChangeTracker` (`packages/sync/src/crdt/change-tracker.ts`, constructed at sync-engine.ts:61) consults the module's `syncPolicy` before appending to `sync_change_log`.
2. **Transport path:** `TransportManager.connectToPeer` (transport-manager.ts:111) refuses to route a change whose scope is not authorized for the destination peer.
3. **Relay path:** `relay-client` wraps the envelope in the workspace key; relay operators cannot distinguish scope, but the `scope` field is required inside the sealed payload for correct inbound replay.

| Scope | Example entities | Leaves device? | Persisted on relay? |
|-------|------------------|---------------|---------------------|
| `device_local` | device-local settings, cached tokens, draft notes | Never | Never |
| `personal_replica` | personal notes, journal entries, budget rows, meds | Between the user's own trusted devices | Ciphertext only |
| `shared_workspace` | shared notes, RSVP invites, shared recipes, hangouts | Between workspace members | Ciphertext only |
| `published_blob` | content-addressed media, link-shared blobs | To anyone with the blob hash + link key | Optional, ciphertext |

## 5. Trust model

- **User identity is independent of workspace identity.** A user has one root device identity (Ed25519 keypair). A user can create and join multiple workspaces. Each workspace has its own symmetric key, membership list, and scope boundary. A "personal" workspace is auto-created at first launch for the user's own devices. Additional workspaces (family, friend group, team, community) are created on demand. Cross-workspace federation (data flowing between workspaces without explicit re-sharing) is a non-goal.
- **Device identity:** every device mints an Ed25519 signing key and an X25519 key-exchange key on first launch (`sync_device_identity`, schema.ts:12). Device IDs are the Ed25519 public key hex. A single device can be a member of multiple workspaces.
- **Workspace key:** each workspace has its own symmetric key, independent of other workspaces. Wrapped once per authorized member using X25519 ECDH + HKDF. Removing a member triggers key rotation for that workspace only; old wraps are tombstoned.
- **Workspace types:** `personal` (auto-created, user's own devices only, `personal_replica` scope), `group` (user-created, invited members, `shared_workspace` scope), `community` (larger groups, discoverable, `shared_workspace` scope with rate limits). The `sync_workspaces.workspace_type` column distinguishes these. `personal` workspaces cannot be deleted; `group`/`community` workspaces can be archived by the owner.
- **Pairing:** QR is the default. The QR encodes `{workspaceId, wrappedWorkspaceKey, inviterDeviceId, ephemeralSig}`. NFC is optional for in-room high-trust flows (meds, payments). Fingerprint compare is required for `shared_workspace` handshakes that touch any HIPAA-adjacent module.
- **Revocation:** a revoked device is appended to `sync_device_revocations` (schema.ts:67) with a signed revocation by any active device. Peers drop inbound envelopes signed by revoked device IDs. Revocation is per-workspace: removing a device from one workspace does not affect its membership in others.
- **Rotation:** workspace key rotates on member removal, revocation, or user-initiated rotation. A rotation tombstone in `sync_workspace_keys` (new; see Section 8) marks the previous version and its valid-until timestamp. Rotation is workspace-scoped; other workspaces the user belongs to are unaffected.
- **Storage accounting:** Each workspace tracks its own storage usage. The user's `SyncTier` (billing) sets a total storage cap across all workspaces. The engine sums `sync_session_module_stats` per workspace and rejects new changes when the aggregate exceeds the tier limit.

## 6. Session protocol

One sync session is a linear state machine, extending the flow in `packages/sync/src/protocol/sync-session.ts`. A session targets exactly one workspace. To sync across multiple workspaces with the same peer, the engine opens one session per workspace sequentially (or in parallel if transport supports multiplexing).

1. **Discover.** `LANDiscovery` (or nearby / relay queue) produces a `DiscoveredPeer` (types.ts:489).
2. **Device handshake.** Noise_XK handshake using device keys (`packages/sync/src/encryption/noise-handshake.ts`) establishes a transport-level secure channel. Identities verified against `sync_paired_devices` (schema.ts:22).
3. **Workspace negotiation.** Both sides exchange the list of workspace IDs they share membership in. The initiator proposes one workspace to sync; the responder accepts or counter-proposes. Both sides exchange ranked transport preferences (Section 3a). If the session is relay-backed, both sides exchange ephemeral relay tokens (Section 3b).
4. **Workspace auth.** Challenge-response proving possession of the selected workspace's current key. If the challenger holds a stale version, the responder includes a rotation tombstone so the challenger can upgrade. Scope enforcement: only entities whose scope is authorized for this workspace's type (`personal_replica` for personal workspaces, `shared_workspace` for group/community) are eligible.
5. **Manifest exchange.** Each side sends `{workspaceId, moduleId, lastSyncedVersion, automergeHeads}` per enabled module in the selected workspace (derived from `sync_peer_module_state`, schema.ts:57). Modules whose `syncPolicy` does not authorize this workspace type are excluded.
6. **Signed deltas.** Small structured changes from `sync_change_log` (schema.ts:37) travel as signed envelopes. Per-entity CRDT strategy (Section 7) determines merge. `stripColumns` (Section 9) are removed at change-log write time; stripped data never enters the log and is regenerated on the receiving device.
7. **Blob fetch.** Content-addressed blob hashes referenced by deltas are requested via `BLOB_REQUEST` (types.ts:333) subject to `sync_blob_policy` (schema.ts:89).
8. **Ack / checkpoint.** Both sides advance `sync_peer_module_state.last_synced_version` and record a receipt in the new `sync_receipts` table (Section 8). Per-module byte counts are written to `sync_session_module_stats` (Section 8).
9. **Audit log.** A `sync_sessions` row (schema.ts:98) records the session summary, workspace ID, transport, bytes, and status.

## 7. Conflict strategies

Per-entity-type, not per-module. The `ModuleSyncPolicy` in Section 9 maps each entity kind to a strategy.

| Strategy | When to use | Representative entities |
|----------|-------------|-------------------------|
| LWW | Idempotent settings where last writer wins is acceptable | `hub_settings`, `nt_notes_meta.color`, `wd_saved_meta.sort_order`, `jn_settings` |
| OR-Set | Tag-like membership that must merge adds and removes monotonically | `fn_people_tags`, `nt_note_tags`, `rv_event_tags`, `tr_trail_tags` |
| Counter CRDT | Monotonic counters and streaks | `hb_streak_counters`, `fl_card_review_counts`, `pr_session_totals` |
| Document CRDT (Automerge) | Rich text and shared documents | `nt_notes.body_md`, `jn_entries.body_md`, `rc_recipes.body_md`, `fn_memories.body_md` |
| Manual review | Conflicts must not auto-merge; present both versions to the user | `bg_transactions`, `md_schedules`, `hl_vitals`, `pay_transactions`, `cy_days`, `mo_entries` |

Manual-review entities append both versions to a `sync_conflict_queue` (new) and the module surfaces a UI resolver. No module may ship a manual-review entity without that resolver screen.

## 8. Schema additions

These are sidecar tables in the sync database. Existing module tables do not gain sync columns. Add to `packages/sync/src/db/schema.ts` alongside the current `SYNC_TABLES` array (schema.ts:242).

```sql
CREATE TABLE IF NOT EXISTS sync_workspaces (
  id TEXT PRIMARY KEY NOT NULL,
  display_name TEXT NOT NULL,
  workspace_type TEXT NOT NULL CHECK (workspace_type IN ('personal','group','community')) DEFAULT 'personal',
  created_by_device_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  rotated_at TEXT,
  current_key_version INTEGER NOT NULL DEFAULT 1,
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS sync_workspace_members (
  workspace_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','member','viewer')),
  invited_by_device_id TEXT NOT NULL,
  invited_at TEXT NOT NULL DEFAULT (datetime('now')),
  removed_at TEXT,
  PRIMARY KEY (workspace_id, device_id)
);

CREATE TABLE IF NOT EXISTS sync_workspace_keys (
  workspace_id TEXT NOT NULL,
  key_version INTEGER NOT NULL,
  wrapped_for_device_id TEXT NOT NULL,
  wrapped_key_blob BLOB NOT NULL,
  valid_from TEXT NOT NULL DEFAULT (datetime('now')),
  valid_until TEXT,
  PRIMARY KEY (workspace_id, key_version, wrapped_for_device_id)
);

CREATE TABLE IF NOT EXISTS sync_entity_acl (
  module_id TEXT NOT NULL,
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('device_local','personal_replica','shared_workspace','published_blob')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (module_id, table_name, row_id)
);

CREATE TABLE IF NOT EXISTS sync_tombstones (
  module_id TEXT NOT NULL,
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,
  deleted_by_device_id TEXT NOT NULL,
  deleted_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (module_id, table_name, row_id)
);

CREATE TABLE IF NOT EXISTS sync_receipts (
  session_id TEXT NOT NULL,
  peer_device_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  change_id TEXT NOT NULL,
  acknowledged_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (session_id, peer_device_id, change_id)
);

CREATE TABLE IF NOT EXISTS sync_conflict_queue (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,
  local_version_json TEXT NOT NULL,
  remote_version_json TEXT NOT NULL,
  remote_device_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  resolution TEXT CHECK (resolution IN ('local','remote','merged'))
);

CREATE TABLE IF NOT EXISTS sync_transport_preferences (
  device_id TEXT NOT NULL,
  layer_id INTEGER NOT NULL CHECK (layer_id BETWEEN 1 AND 5),
  rank INTEGER NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (device_id, layer_id)
);

CREATE TABLE IF NOT EXISTS sync_session_module_stats (
  session_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  changes_sent INTEGER NOT NULL DEFAULT 0,
  changes_received INTEGER NOT NULL DEFAULT 0,
  bytes_sent INTEGER NOT NULL DEFAULT 0,
  bytes_received INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (session_id, module_id)
);

CREATE TABLE IF NOT EXISTS sync_relay_tokens (
  workspace_id TEXT NOT NULL,
  peer_device_id TEXT NOT NULL,
  ephemeral_token TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, peer_device_id)
);
```

TypeScript types live next to existing types in `packages/sync/src/types.ts`:

```ts
export type SyncScope = 'device_local' | 'personal_replica' | 'shared_workspace' | 'published_blob';
export type WorkspaceType = 'personal' | 'group' | 'community';
export type WorkspaceMemberRole = 'owner' | 'admin' | 'member' | 'viewer';
export type SyncTransport = 'lan' | 'nearby' | 'ble' | 'wan_webrtc' | 'wan_relay';

export interface SyncWorkspace { id: string; displayName: string; workspaceType: WorkspaceType; createdByDeviceId: string; createdAt: string; rotatedAt: string | null; currentKeyVersion: number; archivedAt: string | null; }
export interface SyncWorkspaceMember { workspaceId: string; deviceId: string; role: WorkspaceMemberRole; invitedByDeviceId: string; invitedAt: string; removedAt: string | null; }
export interface SyncWorkspaceKeyWrap { workspaceId: string; keyVersion: number; wrappedForDeviceId: string; wrappedKeyBlob: Uint8Array; validFrom: string; validUntil: string | null; }
export interface SyncEntityAcl { moduleId: string; tableName: string; rowId: string; workspaceId: string; scope: SyncScope; updatedAt: string; }
export interface SyncTombstone { moduleId: string; tableName: string; rowId: string; deletedByDeviceId: string; deletedAt: string; }
export interface SyncReceipt { sessionId: string; peerDeviceId: string; moduleId: string; changeId: string; acknowledgedAt: string; }
export interface SyncConflictEntry { id: string; workspaceId: string; moduleId: string; tableName: string; rowId: string; localVersionJson: string; remoteVersionJson: string; remoteDeviceId: string; createdAt: string; resolvedAt: string | null; resolution: 'local' | 'remote' | 'merged' | null; }
export interface SyncTransportPreference { deviceId: string; layerId: number; rank: number; enabled: boolean; updatedAt: string; }
export interface SyncSessionModuleStats { sessionId: string; moduleId: string; changesSent: number; changesReceived: number; bytesSent: number; bytesReceived: number; }
export interface SyncRelayToken { workspaceId: string; peerDeviceId: string; ephemeralToken: string; createdAt: string; expiresAt: string; }
```

The existing `SyncSession` interface (types.ts:283) gains a `workspaceId` field:

```ts
export interface SyncSession {
  id: string;
  workspaceId: string;       // NEW: which workspace this session synced
  peerDeviceId: string;
  transport: SyncTransport;  // UPDATED: now includes 'nearby' | 'ble'
  direction: SyncDirection;
  modulesSynced: string[];
  changesSent: number;
  changesReceived: number;
  bytesSent: number;
  bytesReceived: number;
  blobsSent: number;
  blobsReceived: number;
  durationMs: number;
  status: SyncSessionStatus;
  error: string | null;
  startedAt: string;
  completedAt: string;
}
```

## 9. ModuleDefinition extension

Add `syncPolicy` to `ModuleDefinition` in `packages/module-registry/src/types.ts:131`.

```ts
export type ConflictStrategy = 'lww' | 'or_set' | 'counter' | 'document_crdt' | 'manual_review';

export interface ModuleEntitySyncRule {
  /** Table name without module prefix, e.g. 'notes' for 'nt_notes'. */
  tableName: string;
  /** Default scope for new rows of this table. */
  defaultScope: SyncScope;
  /** Maximum scope this entity can ever be escalated to, regardless of workspace type.
   *  E.g. sp_bets has maxScope 'personal_replica' even though sports module is shareable.
   *  If omitted, inherits the module-level shareable flag (shared_workspace if true, personal_replica if false). */
  maxScope?: SyncScope;
  /** Conflict strategy when two devices edit the same row. */
  conflictStrategy: ConflictStrategy;
  /** Columns that are device-local and should never travel, even when the row travels.
   *  Stripped at change-log write time; the data never enters sync_change_log. Receiving
   *  devices regenerate these columns locally. */
  stripColumns?: string[];
  /** If true, rows of this table require a resolver screen before they can ship. */
  requiresManualResolver?: boolean;
  /** Key referencing the module's custom conflict resolver component for this entity.
   *  Must be registered in the module's exports. Required when requiresManualResolver is true. */
  resolverComponent?: string;
}

export interface ModuleSyncPolicy {
  /** Default scope for any entity not explicitly listed. */
  defaultScope: SyncScope;
  /** Whether this module is eligible for shared_workspace scope at all. */
  shareable: boolean;
  /** Per-table rules. Rules beat the default. */
  entityRules: ModuleEntitySyncRule[];
  /** Modules flagged here collect consumer health data; extra consent required before shared_workspace. */
  isSensitive?: boolean;
}

export interface ModuleDefinition {
  // existing fields unchanged...
  syncPolicy?: ModuleSyncPolicy;
}
```

Example declaration for `notes` (device-local + shareable docs):

```ts
syncPolicy: {
  defaultScope: 'personal_replica',
  shareable: true,
  entityRules: [
    { tableName: 'notes', defaultScope: 'personal_replica', conflictStrategy: 'document_crdt' },
    { tableName: 'note_tags', defaultScope: 'personal_replica', conflictStrategy: 'or_set' },
    { tableName: 'settings', defaultScope: 'device_local', conflictStrategy: 'lww' },
  ],
}
```

Example declaration for `meds` (high-risk, personal only):

```ts
syncPolicy: {
  defaultScope: 'personal_replica',
  shareable: false,
  isSensitive: true,
  entityRules: [
    { tableName: 'medications', defaultScope: 'personal_replica', conflictStrategy: 'manual_review', requiresManualResolver: true, resolverComponent: 'MedsConflictResolver' },
    { tableName: 'schedules', defaultScope: 'personal_replica', conflictStrategy: 'manual_review', requiresManualResolver: true, resolverComponent: 'MedsScheduleConflictResolver' },
    { tableName: 'history', defaultScope: 'personal_replica', conflictStrategy: 'lww' },
    { tableName: 'settings', defaultScope: 'device_local', conflictStrategy: 'lww' },
  ],
}
```

Once Phase 0 lands, `ModuleDefinitionSchema` (packages/module-registry/src/types.ts:178) adds `syncPolicy` as required; every entry in `MODULE_METADATA` (packages/module-registry/src/constants.ts:119) must declare one.

## 10. Per-module policy mapping

See `docs/designs/mesh-sync-module-policy-matrix.md` for the canonical per-module table. Summary: 7 modules go to `shared_workspace` early (notes, journal, recipes, rsvp, friends, homes, trails). 4 modules stay `personal_replica` only until consent and resolver ship (budget, health, meds, payments). All others default `personal_replica` with per-table escalation where it makes sense.

## 11. Transport package responsibilities

| Package | Owns |
|---------|------|
| `packages/sync` | Engine, CRDT layer, change log, blob store, session protocol, selector, all transport adapters |
| `packages/sync/src/transport/lan-discovery.ts` | Bonjour/mDNS browsing + advertising (today: stub, lan-discovery.ts:71) |
| `packages/sync/src/transport/lan-transport.ts` | Encrypted TCP stream on shared Wi-Fi |
| `packages/sync/src/transport/nearby-transport.ts` (new) | Apple Multipeer + Android Wi-Fi Direct adapters |
| `packages/sync/src/transport/ble-transport.ts` (new) | CoreBluetooth / BluetoothGatt wake-up pings only (no data transfer) |
| `packages/sync/src/transport/webrtc-transport.ts` (new) | WebRTC DataChannel, extracted from `providers/p2p.ts:53` |
| `packages/sync/src/transport/relay-transport.ts` (new) | WebSocket ciphertext relay client |
| `packages/sync/src/transport/transport-manager.ts` | Ladder selector, existing file at transport-manager.ts:37 |
| `packages/module-registry` | `ModuleSyncPolicy` type, validation, helper queries |
| `packages/db` | Nothing net-new; sync tables already live in `@mylife/sync` |
| `apps/mobile`, `apps/web` | Pairing UX, workspace admin, conflict resolver host screens |

## 12. Threat model

| Adversary | What they can do | What they cannot do |
|-----------|------------------|---------------------|
| LAN attacker on same Wi-Fi | See encrypted Bonjour advertisements and encrypted TCP payloads. Attempt connection to our port | Decrypt envelope without workspace key. Forge deltas without device key. Impersonate a paired device |
| Relay operator | Observe ciphertext envelopes, ephemeral session tokens, timing, envelope size, IP addresses | Read payload. Correlate sessions across token rotations. Learn device identity or workspace membership. Inject deltas accepted by peers (Section 3b) |
| Revoked member | Hold historical workspace key for the workspace they were removed from, see historical data they received while a member | Decrypt any message sealed with the rotated key. Pass validation at any peer after revocation tombstone propagates. Access other workspaces they were never a member of |
| Lost-device attacker | Access whatever plaintext is on disk if the OS is unlocked. Forge device signatures if key is not hardware-backed. See all workspaces the device was a member of | Decrypt future workspace traffic once the lost device is revoked from each workspace. Bypass biometric gates on high-trust modules |
| Cross-workspace attacker | A member of workspace A who is also in workspace B can see data in both | Move data from workspace A into workspace B without re-sharing. The engine enforces workspace-scoped change logs; cross-workspace data transfer requires explicit user action |
| Malicious module author | Ship a broken conflict resolver | Bypass `syncPolicy` or `maxScope` (engine enforces at write path). Escalate scope without explicit user pairing action. Bypass `stripColumns` (stripped at write time, data never enters change log) |

## 13. Relationship to existing `packages/sync/`

**Stays as-is:**
- `types.ts` core types: `DeviceIdentity`, `PairedDevice`, `ChangeRecord`, `BlobRef`, `SyncSession`, transport abstractions (types.ts:106, types.ts:168, types.ts:237, types.ts:283, types.ts:473).
- `db/schema.ts` sync + torrent tables (schema.ts:242).
- `engine/sync-engine.ts` coordinator shell (sync-engine.ts:42). Internals extend to consult `ModuleSyncPolicy`.
- `encryption/noise-handshake.ts` for device handshake.
- `crdt/document-manager.ts` and `crdt/change-tracker.ts`.

**Extends:**
- `transport/transport-manager.ts:111` ladder selector (today LAN-only, throws at line 130). Gains ranked-choice preference negotiation (Section 3a).
- `transport/lan-discovery.ts` replace stub (lan-discovery.ts:71) with real Bonjour/mDNS.
- `types.ts` add `SyncScope`, `WorkspaceType`, `SyncTransport` (expanded), workspace/member/key/acl/tombstone/receipt/conflict/preference/relay-token types.
- `db/schema.ts` add ten new tables from Section 8: 7 original sidecar tables + `sync_transport_preferences` + `sync_session_module_stats` + `sync_relay_tokens`.
- `protocol/sync-session.ts` add workspace-negotiation step, workspace-auth step, scope enforcement, and `stripColumns` enforcement at change-log write time.
- `db/queries.ts` add workspace CRUD, ACL lookups, tombstone writes, transport preference CRUD, module stats writes, relay token management.
- `db-integration.ts` (at `packages/sync/src/db-integration.ts`, not under `db/`) must wire the 10 new tables into the database initialization flow.

**Becomes a compatibility layer:**
- `SyncTier` enum in types.ts:17 (`local_only`, `p2p`, `free_cloud`, `starter_cloud`, `power_cloud`) predates scopes. It describes *billing + storage quota*, not *routing*. Keep it for the subscription flow, but add `SyncScope` as the routing concept.
- `SyncTransport` enum in types.ts:279 (`lan`, `wan_webrtc`, `wan_relay`) is too coarse for the six-layer ladder. Phase 0 adds `'nearby'` and `'ble'` variants to the type and Zod schema even before those transports ship (avoids a schema migration later). Existing `sync_sessions` rows retain their old values; new sessions use the expanded enum.
- `providers/p2p.ts:53` wraps WebRTC + a pairing transport. Its WebRTC guts move to `transport/webrtc-transport.ts`; the provider shell stays so callers that still ask for a "tier" keep working.
- `providers/local-only.ts:18` remains the no-op path for users who never pair.

**Inbound anchors flagged by the initiator prompt that live at different paths than listed:**

- `packages/sync/src/engine/sync-session.ts` actually lives at `packages/sync/src/protocol/sync-session.ts`.
- `packages/sync/src/engine/handshake.ts` actually lives at `packages/sync/src/protocol/handshake.ts`.
- `packages/sync/src/engine/noise-handshake.ts` actually lives at `packages/sync/src/encryption/noise-handshake.ts`.
- `packages/sync/src/db/adapter.ts`, `db/sync-adapter.ts`, `db/db-integration.ts` do not exist under `packages/sync`. `db-integration.ts` lives at `packages/sync/src/db-integration.ts` (one level up). A `DatabaseAdapter` is consumed from `@mylife/db`.

These path mismatches are captured in Section 14.

## 14. Tier-scope compatibility matrix

`SyncTier` (billing/quota) and `SyncScope` (data routing) are orthogonal. This matrix defines which transport layers each tier can access:

| SyncTier | Layers available | Rationale |
|----------|-----------------|-----------|
| `local_only` | 1 (LAN), 2 (nearby), 3 (BLE wake-up) | No internet transports. Offline-only mesh. |
| `p2p` | 1, 2, 3, 4 (WebRTC) | Adds NAT-traversed peer-to-peer. No relay server. |
| `free_cloud` | 1, 2, 3, 4, 5 (relay) | All layers including relay. 1 GB aggregate cap. |
| `starter_cloud` | 1, 2, 3, 4, 5 | All layers. 5 GB aggregate cap. |
| `power_cloud` | 1, 2, 3, 4, 5 | All layers. 25 GB aggregate cap. |

Storage caps are aggregate across all workspaces the user belongs to. The engine sums per-workspace usage from `sync_session_module_stats` and rejects new changes when the total exceeds the tier limit.

`SyncScope` determines data routing independently of tier. A `local_only` user can still have `personal_replica` entities that sync over LAN between their own devices. A `p2p` user with `shared_workspace` entities can sync them over WebRTC but not via relay (they'd need to upgrade to `free_cloud`).

Document this matrix in `packages/sync/README.md` during Phase 0.

## 15. Supabase module engine guard

Modules with `storageType !== 'sqlite'` (forums, market, mail, payments) declare `defaultScope: 'device_local'` for cached data. The canonical record lives in the cloud provider. The `SyncEngine` enforces this:

- If `storageType` is `supabase` or `drizzle`, the engine refuses to write any change to `sync_change_log` for that module unless the entity's scope is `device_local`.
- This guard lives in the `ChangeTracker` write path (sync-engine.ts:61), alongside the `syncPolicy` scope check.
- `mail` is a special case: its canonical data lives on the user's IMAP server, not in any MyLife storage backend. The sync layer treats it identically to supabase modules (device-local cache only).

## 16. Resolved design decisions

These were open questions during the design phase. All resolved as of 2026-04-22.

1. **Anchor-file path drift.** Docs fix. Phase 0 acceptance criteria item 6 covers this in the `packages/sync/README.md` update.

2. **Multi-workspace.** Users can create and join multiple workspaces (personal, group, community). A personal workspace is auto-created at first launch. Schema, trust model, session protocol, and relay addressing all updated in Sections 5, 6, 8, and 3b. Workspace negotiation is step 3 of the session protocol. Each session targets one workspace; multi-workspace sync with the same peer runs one session per workspace.

3. **BLE is wake-up only.** BLE (layer 3) sends a GATT notify with `{deviceId, pendingModules[], totalBytes}` to signal "I have changes." Actual data transfer escalates to a higher-bandwidth layer. No data fragmentation over BLE. Updated in Section 3.

4. **Relay anonymity is in initial scope.** Per-session ephemeral recipient tokens prevent the relay from learning device identity or correlating sessions. Designed in Section 3b. Schema includes `sync_relay_tokens` table. Token exchange is wired into session protocol step 3.

5. **Supabase-backed modules.** Every module gets a `syncPolicy`. Supabase/drizzle modules declare `defaultScope: 'device_local'`. Engine guard in Section 15 blocks non-device-local changes for these modules. `payments` main table is `device_local`; user-authored annotations are `personal_replica`.

6. **Health data consent.** `fast` moved to Phase 6 (matches `HEALTH_DATA_MODULE_IDS`). `presence` entities split: `pr_sessions` capped at `personal_replica` via `maxScope`, `pr_intentions`/`pr_summaries` shareable in Phase 5. `maxScope` field added to `ModuleEntitySyncRule` (Section 9) for per-entity scope caps (replaces coarse module-level `shareable` for mixed cases like `sports.sp_bets`). Legal review required before Phase 6 enables `shared_workspace` for any `HEALTH_DATA_MODULE_IDS` module.

7. **Conflict resolver: hybrid model.** A shared generic `<ConflictResolver>` ships in `@mylife/ui` for the queue list view and basic "pick A or B" fallback. Each module with `manual_review` entities registers a custom resolver component via the `resolverComponent` field in `ModuleEntitySyncRule`. Parity gate: `check:module-parity` validates that any entity with `requiresManualResolver: true` has a registered `resolverComponent`. **Post-development review gate:** after all phases complete, a dedicated review pass audits the hybrid resolver model for function, accuracy, and whether the shared/per-module split was the right call.

8. **SyncTier and SyncScope coexist.** `SyncTier` is billing/quota. `SyncScope` is routing. Tier-scope compatibility matrix in Section 14. Documented in `packages/sync/README.md` during Phase 0.

9. **Bonjour service type stays `_mylife-sync._tcp`.** The service type is a technical identifier, not a user-facing brand. `mylife` matches the repo, packages, table prefixes, and imports. The Meerkat brand lives in the App Store listing and marketing. No migration needed.

10. **Per-module audit UX.** `sync_session_module_stats` table added (Section 8) to track per-session per-module byte counts. Audit UX in Settings > Sync Activity shows per-module breakdown. Cheap to add in Phase 0; avoids a schema migration later.
