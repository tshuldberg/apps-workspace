# @mylife/sync

Decentralized mesh sync for the MyLife suite. LAN-first, privacy-first, zero-relay-trust by default.

## Core Concepts

### SyncTier vs SyncScope

These are orthogonal concepts:

- **SyncTier** controls billing and quota. It determines which transport layers a user can access and how much relay bandwidth they get.
- **SyncScope** controls data routing. It declares where a piece of data is allowed to travel.

A user on `p2p` tier can still have `shared_workspace` scoped data; it just syncs over LAN/WebRTC instead of relay.

### SyncScope Values

| Scope | Meaning |
|-------|---------|
| `device_local` | Never leaves the device. Not synced. |
| `personal_replica` | Syncs across the user's own devices only. |
| `shared_workspace` | Syncs within a workspace (group or community). |
| `published_blob` | Immutable blob shared publicly (e.g. exported recipe). |

### SyncTier Values

| Tier | Meaning |
|------|---------|
| `local_only` | No cloud relay. LAN/nearby/BLE only. |
| `p2p` | Adds WebRTC direct connections. |
| `free_cloud` | All layers including encrypted relay. 1 GB cap. |
| `starter_cloud` | All layers. 5 GB cap. |
| `power_cloud` | All layers. 25 GB cap. |

## Tier-Scope Compatibility Matrix

| Tier | LAN | Nearby | BLE | WebRTC | Relay |
|------|-----|--------|-----|--------|-------|
| `local_only` | Yes | Yes | Yes | No | No |
| `p2p` | Yes | Yes | Yes | Yes | No |
| `free_cloud` | Yes | Yes | Yes | Yes | Yes (1 GB) |
| `starter_cloud` | Yes | Yes | Yes | Yes | Yes (5 GB) |
| `power_cloud` | Yes | Yes | Yes | Yes | Yes (25 GB) |

## Transport Ladder

Connections attempt transports in order, falling through on timeout:

```
LAN Wi-Fi / Bonjour (_mylife-sync._tcp)
  -> nearby peer (Apple Multipeer / Android Wi-Fi Direct)
    -> BLE (wake-up pings only, not bulk data)
      -> WebRTC (direct peer connection via signaling)
        -> encrypted relay (ciphertext only, ephemeral tokens)
```

Each layer has a configurable timeout before the next layer is attempted. Users set a ranked-choice preference list per device; when two peers connect, the selector intersects both lists and picks the highest mutual match.

## Multi-Workspace Model

- **Personal workspace**: auto-created at first launch. Scoped to the user's own devices.
- **Group workspace**: invite-only, shared symmetric key. For families, couples, roommates.
- **Community workspace**: larger groups with role-based access. Shared interest groups, clubs.

Each workspace has its own symmetric encryption key, membership roster, and scope boundary. Data tagged `shared_workspace` stays within its workspace. Cross-workspace sharing requires explicit re-scoping or `published_blob` export.

## Anchor File Paths

Key files in this package and where they live:

| File | Path |
|------|------|
| DB integration (change log, clock) | `packages/sync/src/db-integration.ts` |
| Session protocol | `packages/sync/src/protocol/sync-session.ts` |
| Handshake protocol | `packages/sync/src/protocol/handshake.ts` |
| Noise handshake (encryption) | `packages/sync/src/encryption/noise-handshake.ts` |
| CRDT implementations | `packages/sync/src/crdt/` |
| Transport layer adapters | `packages/sync/src/transport/` |
| Identity and device keys | `packages/sync/src/identity/` |
| Blob/torrent subsystem | `packages/sync/src/blob/`, `packages/sync/src/torrent/` |

Note: `db-integration.ts` lives in the sync package, not under `packages/db/`. The sync package owns the change log write path and clock management.

## stripColumns Semantics

Columns listed in a module's `stripColumns` array are removed at change-log write time. The data never enters `sync_change_log`. Receiving devices regenerate these columns locally (e.g. computed caches, device-specific paths, local UI state).

This is a privacy and bandwidth optimization: stripped data is not transmitted, not stored in the log, and not available to peers. Modules must ensure stripped columns can be reconstructed from synced data or local context.

## Module Sync Policy

Each module declares a `ModuleSyncPolicy` in its `ModuleDefinition` (required after Phase 5). The policy specifies:

- `defaultScope`: the default sync scope for the module's data
- `shareable`: whether the module's data can enter `shared_workspace` scope
- `entityRules`: per-table rules with conflict strategy, max scope, and strip columns
- `isSensitive`: if true, requires fingerprint-compare pairing before `shared_workspace` is allowed

Conflict strategies: `lww` (last-writer-wins), `or_set` (observed-remove set), `counter` (grow-only counter), `document_crdt` (Yjs/Automerge), `manual_review` (queues for user resolution).

See `docs/designs/mesh-sync-architecture.md` for the full design and `docs/designs/mesh-sync-module-policy-matrix.md` for per-module policy details.
