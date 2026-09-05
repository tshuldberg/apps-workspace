# Sync protocol contracts

Preserved from `MyLife/packages/sync/CLAUDE.md` during the September 5, 2026 instruction reset. Paths in the retained text are relative to the originating project/package unless stated otherwise. Dated rollout notes are historical evidence, not current readiness claims. Consult the relevant contract when changing its implementation; generic agent workflow is governed by AGENTS.md.

## Layering (Critical)

```
src/
  protocol/   # 24 PURE files: no IO, no platform deps. Identity bundles + TOFU,
              # 5-emoji SAS, introductions, signed revocations + gossip, MLS-shaped
              # group keys (epoch commits), per-entity keys (crypto-shredding),
              # communities (descriptors/channels/roles/fork), mailbox mode,
              # abuse rails, host credits, blob transfer, batch signatures
  node/       # 10 files: HKDF-SHA512 (RFC5869), content addressing + Merkle,
              # Ed25519 sealed shares (fail-closed tamper detection), MEER friend
              # codes, friend rendezvous, recovery keys (MKR1), seeding store
  transport/  # 14 files: WebSocketRelayBackend, LanSocketBackend + frame codec,
              # relay-selector (/healthz latency ranking), rendezvous client
  engine/     # native sync engine, document managers (LWW, Automerge-free native),
              # session runner (receipts/outbox, replay guard, Noise FS)
  db/         # sidecar sync_* tables created via createSyncTables in the host DB
  torrent/    # community catalog (signed Merkle manifests, rarest-first placement,
              # web seeds), seeding engine
  crdt/ encryption/ identity/ blob/ secrets/ signaling/ hooks.ts providers/
```

Pure protocol code goes in `protocol/`; anything touching sockets/files goes in `transport/`/`node/`. Keep that boundary.


## Security Invariants (do not regress)

- MK-002: ALL inbound changes pass `applyReceivedDocumentChanges` enforcement: revocation, authorization, module ownership, scope/maxScope caps, fail-closed (no policy = device_local), tombstone no-resurrection, `sync_inbound_audit` rows.
- Sessions default to required encryption; dropped negotiation = failed session, never a downgrade. Every SYNC_DATA is Ed25519-signed (batch signatures) and frame-enveloped so relays see only sizes and timing.
- isSensitive modules require SAS-verified peers for `shared_workspace` scope.
- Sealed shares fail closed on any tamper.


## Plan 19 P9 public layer (exports)

- `protocol/publication.ts`: `PublicationDescriptor` carries optional owner-signed blocks via CONDITIONAL CANONICAL APPEND (byte-identical when absent): `rights` (P9.3b) and `publicJoin` (FF3, tagged `meerkat-public-join-v1`). NO detached signatures -- the one owner Ed25519 descriptor signature authenticates both (unforgeable + non-transplantable). `verifyOwnerTakedown` (terminal, any-revision, owner-authenticated, ignores previousHash) + `verifyPublicJoinGrant` (open + active + grant-present).
- `protocol/public-archive.ts`: signed `ArchiveJob` (`createArchiveJob`/`verifyArchiveJob`, fail-closed rights/consent verdicts; `deriveArchiveIndexKey === deriveContentRegistryId`).
- `protocol/public-join.ts`: `redeemPublicJoinGrant` writes a ROSTER `sync_workspace_members` row ONLY -- NEVER an epoch key (getCurrentEpochKey stays null; proven). Open-join changes owner POLICY, never the key MECHANISM.
- `node/public-snapshot-client.ts`: `fetchPublicSnapshot` (+ `sinceHlc`/`sinceHlcByChannel` warm-tail filter, FF2) and `fetchPublicPage` (incremental page route; re-verifies each event author sig + community/channel scope, fail-closed -- never trusts the node).
- `blob/upload-manifest.ts`: resumable `buildUploadManifest`/`nextMissingBlock`/`verifyUploadBlock` (Stage 0, RN-safe injectable hash).
